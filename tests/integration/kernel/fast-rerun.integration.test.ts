import test, { after, afterEach, before } from "node:test";
import assert from "node:assert/strict";

import {
  connectToBrowserTarget,
  disconnectActiveBrowserConnection,
  getActiveBrowserConnection,
} from "../../../src/transport/browser-connect.js";
import { coreTargetProfile } from "../../../src/profile/core-target-profile.js";
import { buildCellExpression } from "../../../src/kernel/build-cell-expression.js";
import {
  createRuntilmeCellBridgeKey,
  createRuntilmeCellBridgeSetupExpression,
  createRuntilmeCellBridgeTeardownExpression,
} from "../../../src/kernel/runtilme-cell-bridge.js";
import {
  startFoundryIntegrationLifecycle,
  type FoundryIntegrationLifecycle,
} from "../helpers/integration-app-server.js";

const runIntegration = process.env.RUN_CDP_INTEGRATION === "1";
const host = process.env.CDP_HOST ?? "127.0.0.1";
const cdpPort = Number(process.env.CDP_FAST_RERUN_TEST_PORT ?? "9242");
const appPort = Number(process.env.CDP_FAST_RERUN_TEST_APP_PORT ?? "9342");

let lifecycle: FoundryIntegrationLifecycle | undefined;

before(async () => {
  if (!runIntegration) {
    return;
  }

  lifecycle = await startFoundryIntegrationLifecycle(host, cdpPort, appPort);
});

after(async () => {
  await disconnectActiveBrowserConnection();

  await lifecycle?.stop();
});

afterEach(async () => {
  await disconnectActiveBrowserConnection();
});

test(
  "fast rerun keeps active connection and stable sourceURL identity",
  { skip: !runIntegration },
  async () => {
    const connected = await connectToBrowserTarget(
      { host, port: cdpPort },
      coreTargetProfile,
    );
    assert.equal(connected.ok, true);

    const connection = getActiveBrowserConnection();
    assert.ok(connection);

    const sameCellUri =
      "vscode-notebook-cell://test-authority/workspaces/foundry-devil-code-sight/tests/files/test1.ipynb#ch0000000002222";

    const firstExpression = buildCellExpression("2 + 3", sameCellUri, {
      isolate: false,
    });
    const secondExpression = buildCellExpression("2 + 3", sameCellUri, {
      isolate: false,
    });

    assert.equal(firstExpression, secondExpression);

    const firstRun = await connection?.evaluate(firstExpression);
    const secondRun = await connection?.evaluate(secondExpression);

    assert.equal(firstRun?.exceptionDetails, undefined);
    assert.equal(secondRun?.exceptionDetails, undefined);
    assert.equal(firstRun?.result?.value, 5);
    assert.equal(secondRun?.result?.value, 5);
    assert.equal(
      getActiveBrowserConnection()?.sessionId,
      connection?.sessionId,
    );
    assert.equal(getActiveBrowserConnection()?.targetId, connection?.targetId);
  },
);

test(
  "default cells accumulate state while isolated wrapper keeps lexical bindings local",
  { skip: !runIntegration },
  async () => {
    const connected = await connectToBrowserTarget(
      { host, port: cdpPort },
      coreTargetProfile,
    );
    assert.equal(connected.ok, true);

    const connection = getActiveBrowserConnection();
    assert.ok(connection);

    const uriA =
      "vscode-notebook-cell://test-authority/workspaces/foundry-devil-code-sight/tests/files/test1.ipynb#ch0000000003001";
    const uriB =
      "vscode-notebook-cell://test-authority/workspaces/foundry-devil-code-sight/tests/files/test1.ipynb#ch0000000003002";

    const assignShared = buildCellExpression(
      "globalThis.__story24 = 42",
      uriA,
      {
        isolate: false,
      },
    );
    const readShared = buildCellExpression("globalThis.__story24", uriB, {
      isolate: false,
    });

    const assignResult = await connection?.evaluate(assignShared);
    const readResult = await connection?.evaluate(readShared);

    assert.equal(assignResult?.exceptionDetails, undefined);
    assert.equal(readResult?.exceptionDetails, undefined);
    assert.equal(readResult?.result?.value, 42);

    const isolatedUri =
      "vscode-notebook-cell://test-authority/workspaces/foundry-devil-code-sight/tests/files/test1.ipynb#ch0000000003003";
    const isolatedExpression = buildCellExpression(
      "let hidden = 99; return hidden",
      isolatedUri,
      {
        isolate: true,
      },
    );
    assert.equal(isolatedExpression.startsWith("await (async()=>{"), true);

    const isolatedResult = await connection?.evaluate(isolatedExpression);
    assert.equal(isolatedResult?.exceptionDetails, undefined);
    assert.equal(isolatedResult?.result?.value, 99);

    const isolatedReturn = buildCellExpression("return 2 + 2", isolatedUri, {
      isolate: true,
    });
    const isolatedReturnResult = await connection?.evaluate(isolatedReturn);
    assert.equal(isolatedReturnResult?.exceptionDetails, undefined);
    assert.equal(isolatedReturnResult?.result?.value, 4);

    const leakProbe = buildCellExpression("typeof hidden", uriB, {
      isolate: false,
    });
    const leakProbeResult = await connection?.evaluate(leakProbe);
    assert.equal(leakProbeResult?.exceptionDetails, undefined);
    assert.equal(leakProbeResult?.result?.value, "undefined");
  },
);

test(
  "RuntilmeCellBridge buffer is per-run and does not leak across reruns",
  { skip: !runIntegration },
  async () => {
    const connected = await connectToBrowserTarget(
      { host, port: cdpPort },
      coreTargetProfile,
    );
    assert.equal(connected.ok, true);

    const connection = getActiveBrowserConnection();
    assert.ok(connection);

    const uri =
      "vscode-notebook-cell://test-authority/workspaces/foundry-devil-code-sight/tests/files/test1.ipynb#ch0000000003999";

    const firstBridgeKey = createRuntilmeCellBridgeKey();
    await connection?.evaluate(
      createRuntilmeCellBridgeSetupExpression(firstBridgeKey),
    );
    const firstRun = await connection?.evaluate(
      buildCellExpression("$cell.log('first'); 1 + 1", uri, {
        isolate: false,
        runtimeCellBridgeKey: firstBridgeKey,
      }),
    );
    const firstLogs = await connection?.evaluate(
      createRuntilmeCellBridgeTeardownExpression(firstBridgeKey),
    );

    const secondBridgeKey = createRuntilmeCellBridgeKey();
    await connection?.evaluate(
      createRuntilmeCellBridgeSetupExpression(secondBridgeKey),
    );
    const secondRun = await connection?.evaluate(
      buildCellExpression("2 + 2", uri, {
        isolate: false,
      }),
    );
    const secondLogs = await connection?.evaluate(
      createRuntilmeCellBridgeTeardownExpression(secondBridgeKey),
    );

    assert.equal(firstRun?.result?.value, 2);
    assert.equal(secondRun?.result?.value, 4);
    assert.deepEqual(firstLogs?.result?.value, ["first"]);
    assert.deepEqual(secondLogs?.result?.value, []);
  },
);

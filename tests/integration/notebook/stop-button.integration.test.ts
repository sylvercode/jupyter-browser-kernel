import test, { after, afterEach, before } from "node:test";
import assert from "node:assert/strict";

import {
  connectToBrowserTarget,
  disconnectActiveBrowserConnection,
  getActiveBrowserConnection,
} from "../../../src/transport/browser-connect.js";
import { coreTargetProfile } from "../../../src/profile/core-target-profile.js";
import { registerKernelController } from "../../../src/notebook/kernel-controller.js";
import { createCancellationHarness } from "../../unit/test-utils/cancellation-harness.js";
import {
  FakeNotebookCellOutput,
  FakeNotebookCellOutputItem,
} from "../../unit/test-utils/fake-notebook-output.js";
import { createLocalizeMock } from "../../unit/test-utils/localize-mock.js";
import {
  startFoundryIntegrationLifecycle,
  type FoundryIntegrationLifecycle,
} from "../helpers/integration-app-server.js";

const runIntegration = process.env.RUN_CDP_INTEGRATION === "1";
const host = process.env.CDP_HOST ?? "127.0.0.1";
const cdpPort = Number(process.env.CDP_STOP_TEST_PORT ?? "9232");
const appPort = Number(process.env.CDP_STOP_TEST_APP_PORT ?? "9332");

let lifecycle: FoundryIntegrationLifecycle | undefined;

interface RecordedExecution {
  started: boolean;
  ended: boolean;
  success?: boolean;
  outputs: FakeNotebookCellOutput[];
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

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
  "notebook stop cancellation terminates running cell and skips queued cells",
  { skip: !runIntegration },
  async () => {
    const connected = await connectToBrowserTarget(
      { host, port: cdpPort },
      coreTargetProfile,
    );

    assert.equal(connected.ok, true);

    const controller = registerKernelController({
      notebooks: {
        createNotebookController: () => ({ supportedLanguages: [] }) as never,
      },
      l10n: { t: createLocalizeMock() },
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    });

    const executions: RecordedExecution[] = [];
    let firstCellCancel: (() => void) | undefined;
    let firstCellStartedResolve: (() => void) | undefined;

    const firstCellStarted = new Promise<void>((resolve) => {
      firstCellStartedResolve = resolve;
    });

    let createExecutionCallCount = 0;
    const executionController = {
      createNotebookCellExecution: () => {
        createExecutionCallCount += 1;

        const cancellation = createCancellationHarness();
        const record: RecordedExecution = {
          started: false,
          ended: false,
          outputs: [],
        };
        executions.push(record);

        if (createExecutionCallCount === 1) {
          firstCellCancel = cancellation.cancel;
        }

        return {
          token: cancellation.token,
          executionOrder: undefined,
          start: () => {
            record.started = true;
            if (createExecutionCallCount === 1) {
              firstCellStartedResolve?.();
            }
          },
          end: (success: boolean) => {
            record.success = success;
            record.ended = true;
          },
          replaceOutput: async (outputs: FakeNotebookCellOutput[]) => {
            record.outputs = outputs;
          },
        };
      },
    };

    const runPromise = controller.executeHandler?.(
      [
        {
          document: {
            getText: () =>
              "(() => { const start = Date.now(); while (Date.now() - start < 60000) {} return 'late'; })()",
            uri: {
              toString: () =>
                "vscode-notebook-cell://test-authority/workspaces/foundry-devil-code-sight/tests/files/stop-button.ipynb#ch0000000000001",
            },
          },
        },
        {
          document: {
            getText: () => "6 * 7",
            uri: {
              toString: () =>
                "vscode-notebook-cell://test-authority/workspaces/foundry-devil-code-sight/tests/files/stop-button.ipynb#ch0000000000002",
            },
          },
        },
      ] as never,
      {} as never,
      executionController as never,
    );

    assert.ok(runPromise);
    await withTimeout(firstCellStarted, 2000);

    assert.ok(firstCellCancel);
    firstCellCancel();

    await withTimeout(Promise.resolve(runPromise), 5000);

    assert.equal(createExecutionCallCount, 1);
    assert.equal(executions.length, 1);
    assert.equal(executions[0]?.started, true);
    assert.equal(executions[0]?.ended, true);
    assert.equal(executions[0]?.success, false);
    assert.equal(executions[0]?.outputs.length, 0);

    const activeConnection = getActiveBrowserConnection();
    assert.ok(activeConnection);

    const probe = await activeConnection.evaluate("1 + 1");
    assert.equal(probe.result?.value, 2);
  },
);

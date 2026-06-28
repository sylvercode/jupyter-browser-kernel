import test from "node:test";
import assert from "node:assert/strict";

import {
  createRuntilmeCellBridgeKey,
  createRuntilmeCellBridgeSetupExpression,
  createRuntilmeCellBridgeTeardownExpression,
} from "../../../src/kernel/runtilme-cell-bridge.js";

function evaluateExpression(expression: string): unknown {
  return Function(`return (${expression});`)();
}

function setupBridge(): string {
  const bridgeKey = createRuntilmeCellBridgeKey();
  evaluateExpression(createRuntilmeCellBridgeSetupExpression(bridgeKey));
  return bridgeKey;
}

test("RuntilmeCellBridge captures helper calls in order", () => {
  const bridgeKey = setupBridge();

  (
    globalThis as { $cell?: { log: (...values: unknown[]) => void } }
  ).$cell?.log("first");
  (
    globalThis as { $cell?: { log: (...values: unknown[]) => void } }
  ).$cell?.log("second");

  const logs = evaluateExpression(
    createRuntilmeCellBridgeTeardownExpression(bridgeKey),
  );
  assert.deepEqual(logs, ["first", "second"]);
});

test("RuntilmeCellBridge coerces non-string values deterministically", () => {
  const bridgeKey = setupBridge();

  (
    globalThis as { $cell?: { log: (...values: unknown[]) => void } }
  ).$cell?.log("count", 3, true, { alpha: 1 }, null, undefined);

  const logs = evaluateExpression(
    createRuntilmeCellBridgeTeardownExpression(bridgeKey),
  );
  assert.deepEqual(logs, ['count 3 true {"alpha":1} null undefined']);
});

test("RuntilmeCellBridge keeps buffers isolated per setup/teardown run", () => {
  const firstBridgeKey = setupBridge();
  (
    globalThis as { $cell?: { log: (...values: unknown[]) => void } }
  ).$cell?.log("run-a");
  const first = evaluateExpression(
    createRuntilmeCellBridgeTeardownExpression(firstBridgeKey),
  );

  const secondBridgeKey = setupBridge();
  const second = evaluateExpression(
    createRuntilmeCellBridgeTeardownExpression(secondBridgeKey),
  );

  assert.deepEqual(first, ["run-a"]);
  assert.deepEqual(second, []);
});

test("RuntilmeCellBridge restores prior global $cell binding", () => {
  const previousCell = { log: () => undefined };
  (globalThis as { $cell?: unknown }).$cell = previousCell;

  const bridgeKey = setupBridge();
  const duringRun = (globalThis as { $cell?: unknown }).$cell;
  assert.notEqual(duringRun, previousCell);

  evaluateExpression(createRuntilmeCellBridgeTeardownExpression(bridgeKey));
  const restored = (globalThis as { $cell?: unknown }).$cell;
  assert.equal(restored, previousCell);

  delete (globalThis as { $cell?: unknown }).$cell;
});

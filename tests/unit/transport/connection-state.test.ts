import test from "node:test";
import assert from "node:assert/strict";

import {
  createConnectionStateStore,
  withConnectTransition,
} from "../../../src/transport/connection-state.js";

test("withConnectTransition emits disconnected -> connecting -> connected on success", async () => {
  const store = createConnectionStateStore();

  const result = await withConnectTransition(
    store,
    async () => ({ ok: true as const }),
    (attemptResult: { ok: true }) => attemptResult.ok,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(store.getHistory(), [
    "disconnected",
    "connecting",
    "connected",
  ]);
});

test("withConnectTransition emits disconnected -> connecting -> error on failure result", async () => {
  const store = createConnectionStateStore();

  const result = await withConnectTransition(
    store,
    async () => ({ ok: false as const }),
    (attemptResult: { ok: false }) => attemptResult.ok,
  );

  assert.equal(result.ok, false);
  assert.deepEqual(store.getHistory(), ["disconnected", "connecting", "error"]);
});

test("withConnectTransition sets error when connect attempt throws", async () => {
  const store = createConnectionStateStore();

  await assert.rejects(
    () =>
      withConnectTransition(
        store,
        async () => {
          throw new Error("unexpected transport error");
        },
        () => true,
      ),
    /unexpected transport error/,
  );

  assert.deepEqual(store.getHistory(), ["disconnected", "connecting", "error"]);
});

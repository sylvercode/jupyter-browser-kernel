import test from "node:test";
import assert from "node:assert/strict";

import {
  createConnectionStateStore,
  withConnectTransition,
} from "../../../src/transport/connection-state.js";

test("withConnectTransition emits disconnected -> connecting -> connected on success", async () => {
  const store = createConnectionStateStore();
  let aborted = false;

  const result = await withConnectTransition(
    store,
    async () => ({ ok: true as const }),
    (attemptResult: { ok: true }) => attemptResult.ok,
    () => {
      aborted = true;
    },
  );

  assert.equal(result.ok, true);
  assert.equal(aborted, false);
  assert.deepEqual(store.getHistory(), [
    "disconnected",
    "connecting",
    "connected",
  ]);
});

test("withConnectTransition emits disconnected -> connecting -> error on failure result", async () => {
  const store = createConnectionStateStore();
  let aborted = false;

  const result = await withConnectTransition(
    store,
    async () => ({ ok: false as const }),
    (attemptResult: { ok: false }) => attemptResult.ok,
    () => {
      aborted = true;
    },
  );

  assert.equal(result.ok, false);
  assert.equal(aborted, false);
  assert.deepEqual(store.getHistory(), ["disconnected", "connecting", "error"]);
});

test("withConnectTransition sets error when connect attempt throws", async () => {
  const store = createConnectionStateStore();
  let aborted = false;

  await assert.rejects(
    () =>
      withConnectTransition(
        store,
        async () => {
          throw new Error("unexpected transport error");
        },
        () => true,
        () => {
          aborted = true;
        },
      ),
    /unexpected transport error/,
  );

  assert.equal(aborted, false);
  assert.deepEqual(store.getHistory(), ["disconnected", "connecting", "error"]);
});

test("withConnectTransition does not write terminal state when transition is canceled", async () => {
  const store = createConnectionStateStore();
  let aborted = false;

  const result = await withConnectTransition(
    store,
    async () => {
      store.cancelTransitions();
      return { ok: true as const };
    },
    (attemptResult: { ok: true }) => attemptResult.ok,
    () => {
      aborted = true;
    },
  );

  assert.equal(result.ok, true);
  assert.equal(aborted, true);
  assert.deepEqual(store.getHistory(), ["disconnected", "connecting"]);
});

test("withConnectTransition invokes aborted callback when thrown attempt is canceled", async () => {
  const store = createConnectionStateStore();
  let aborted = false;

  await assert.rejects(
    () =>
      withConnectTransition(
        store,
        async () => {
          store.cancelTransitions();
          throw new Error("unexpected transport error");
        },
        () => true,
        () => {
          aborted = true;
        },
      ),
    /unexpected transport error/,
  );

  assert.equal(aborted, true);
  assert.deepEqual(store.getHistory(), ["disconnected", "connecting"]);
});

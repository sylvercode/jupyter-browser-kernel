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

test("createConnectionStateStore stores and returns error context", () => {
  const store = createConnectionStateStore();

  store.setErrorContext({
    category: "target-mismatch",
    guidance: "Retry reconnect.",
  });

  assert.deepEqual(store.getErrorContext(), {
    category: "target-mismatch",
    guidance: "Retry reconnect.",
  });

  store.setErrorContext(undefined);
  assert.equal(store.getErrorContext(), undefined);
});

test("createConnectionStateStore emits error context changes through callback", () => {
  const contexts: Array<{ category: string; guidance: string } | undefined> =
    [];
  const store = createConnectionStateStore({
    onErrorContextChanged: (context) => {
      contexts.push(context);
    },
  });

  store.setErrorContext({
    category: "endpoint-connectivity",
    guidance: "Check cdpPort and retry.",
  });
  store.setErrorContext(undefined);

  assert.deepEqual(contexts, [
    {
      category: "endpoint-connectivity",
      guidance: "Check cdpPort and retry.",
    },
    undefined,
  ]);
});

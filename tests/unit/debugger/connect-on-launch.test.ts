import test from "node:test";
import assert from "node:assert/strict";

import {
  createEnsureBrowserConnection,
  type EnsureBrowserConnectionOptions,
} from "../../../src/debugger/connect-on-launch.js";
import { type EndpointConfig } from "../../../src/config/endpoint-config.js";
import { createConnectionStateStore } from "../../../src/transport/connection-state.js";
import { formatConnectFailureMessage } from "../../../src/transport/connect-diagnostics.js";
import { createActiveBrowserConnectionMock } from "../test-utils/active-browser-connection-mock.js";

const endpoint: EndpointConfig = {
  host: "localhost",
  port: 9222,
};

const localize = ((
  messageOrOptions: string | { message: string; args?: unknown[] },
  ...args: unknown[]
): string => {
  const template =
    typeof messageOrOptions === "string"
      ? messageOrOptions
      : messageOrOptions.message;
  const values =
    typeof messageOrOptions === "string" ? args : (messageOrOptions.args ?? []);

  let rendered = template;
  for (const [index, value] of values.entries()) {
    rendered = rendered.replace(`{${index}}`, String(value));
  }

  return rendered;
}) as EnsureBrowserConnectionOptions["localize"];

test("ensureConnection connects and transitions state to connected", async () => {
  const transitions: string[] = [];
  const connectionStateStore = createConnectionStateStore({
    onConnectionStateChanged: (state) => {
      transitions.push(state);
    },
  });

  let connectCalls = 0;
  const ensureConnection = createEnsureBrowserConnection({
    endpoint,
    connectionStateStore,
    connectToTarget: async () => {
      connectCalls += 1;
      return {
        ok: true,
        endpoint,
        connectedTarget: {
          targetId: "target-1",
          sessionId: "session-1",
        },
      };
    },
    getActiveConnection: () => undefined,
    localize,
  });

  await ensureConnection();

  assert.equal(connectCalls, 1);
  assert.deepEqual(transitions, ["connecting", "connected"]);
  assert.equal(connectionStateStore.getErrorContext(), undefined);
});

test("ensureConnection formats failure guidance and sets error context", async () => {
  const transitions: string[] = [];
  const connectionStateStore = createConnectionStateStore({
    onConnectionStateChanged: (state) => {
      transitions.push(state);
    },
  });

  const failure = {
    category: "endpoint-connectivity" as const,
    message: "ECONNREFUSED",
  };

  const ensureConnection = createEnsureBrowserConnection({
    endpoint,
    connectionStateStore,
    connectToTarget: async () => ({
      ok: false,
      endpoint,
      failure,
    }),
    getActiveConnection: () => undefined,
    localize,
  });

  const expectedMessage = formatConnectFailureMessage(
    failure,
    "localhost:9222",
    localize,
  );

  await assert.rejects(
    async () => {
      await ensureConnection();
    },
    new RegExp(expectedMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );

  assert.deepEqual(transitions, ["connecting", "error"]);
  assert.deepEqual(connectionStateStore.getErrorContext(), {
    category: "endpoint-connectivity",
    guidance: expectedMessage,
  });
});

test("ensureConnection rejects when an active connection already exists", async () => {
  const connectionStateStore = createConnectionStateStore();
  const existingConnection = createActiveBrowserConnectionMock({ endpoint });

  let connectCalls = 0;
  const ensureConnection = createEnsureBrowserConnection({
    endpoint,
    connectionStateStore,
    connectToTarget: async () => {
      connectCalls += 1;
      return {
        ok: true,
        endpoint,
        connectedTarget: {
          targetId: "target-2",
          sessionId: "session-2",
        },
      };
    },
    getActiveConnection: () => existingConnection,
    localize,
  });

  await assert.rejects(async () => {
    await ensureConnection();
  }, /A browser connection is already active\./);

  assert.equal(connectCalls, 0);
  assert.deepEqual(connectionStateStore.getHistory(), ["disconnected"]);
});

test("ensureConnection rejects a racing second launch while a connect is in flight", async () => {
  const connectionStateStore = createConnectionStateStore();

  let resolveFirstConnect: (() => void) | undefined;
  let firstConnectStarted: (() => void) | undefined;
  const firstConnectReached = new Promise<void>((resolve) => {
    firstConnectStarted = resolve;
  });

  let connectCalls = 0;
  const ensureConnection = createEnsureBrowserConnection({
    endpoint,
    connectionStateStore,
    connectToTarget: async () => {
      connectCalls += 1;
      firstConnectStarted?.();
      await new Promise<void>((resolve) => {
        resolveFirstConnect = resolve;
      });
      return {
        ok: true,
        endpoint,
        connectedTarget: {
          targetId: "target-1",
          sessionId: "session-1",
        },
      };
    },
    getActiveConnection: () => undefined,
    localize,
  });

  // First launch begins connecting and parks inside connectToTarget; the store
  // is now in the synchronously-set `connecting` state.
  const firstLaunch = ensureConnection();
  await firstConnectReached;
  assert.equal(connectionStateStore.getState(), "connecting");

  // A second launch racing in before the first connect resolves must be
  // rejected without starting another connect.
  await assert.rejects(async () => {
    await ensureConnection();
  }, /A browser connection is already being established\./);

  assert.equal(connectCalls, 1);

  // Let the first connect finish cleanly.
  resolveFirstConnect?.();
  await firstLaunch;

  assert.equal(connectionStateStore.getState(), "connected");
});

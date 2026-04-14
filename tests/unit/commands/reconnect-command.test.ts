import test from "node:test";
import assert from "node:assert/strict";
import { t as localize } from "@vscode/l10n";

import {
  createConnectionStateStore,
  type ConnectionState,
} from "../../../src/transport/connection-state";
import {
  executeReconnectCommand,
  type ReconnectCommandRuntime,
} from "../../../src/commands/reconnect-command";

function createRuntime(
  overrides: Partial<ReconnectCommandRuntime>,
  onConnectionStateChanged?: (state: ConnectionState) => void,
): ReconnectCommandRuntime {
  return {
    readAndValidate: () => ({
      ok: true,
      endpoint: { host: "localhost", port: 9222 },
    }),
    localize,
    connectionStateStore: createConnectionStateStore({
      onConnectionStateChanged,
    }),
    cancelInFlightTransitions: () => undefined,
    connectToTarget: async () => ({
      ok: true,
      endpoint: { host: "localhost", port: 9222 },
      connectedTarget: {
        targetId: "target-1",
        sessionId: "session-1",
      },
    }),
    disconnectActiveConnection: async () => undefined,
    showInformationMessage: () => undefined,
    showErrorMessage: () => undefined,
    openSettings: () => undefined,
    ...overrides,
  };
}

test("executeReconnectCommand transitions to connecting then connected on success", async () => {
  const transitions: ConnectionState[] = [];
  const infoMessages: string[] = [];

  const runtime = createRuntime(
    {
      showInformationMessage: (message) => {
        infoMessages.push(message);
        return undefined;
      },
    },
    transitions.push.bind(transitions),
  );

  await executeReconnectCommand(runtime);

  assert.deepEqual(transitions, ["connecting", "connected"]);
  assert.equal(runtime.connectionStateStore.getErrorContext(), undefined);
  assert.equal(infoMessages.length, 1);
  assert.match(infoMessages[0], /Reconnected/);
});

test("executeReconnectCommand transitions to connecting then error on categorized failure", async () => {
  const transitions: ConnectionState[] = [];
  const errorMessages: string[] = [];
  const openedSettings: string[] = [];

  const runtime = createRuntime(
    {
      connectToTarget: async () => ({
        ok: false,
        endpoint: { host: "localhost", port: 9222 },
        failure: {
          category: "target-mismatch",
          message: "No valid browser target matched profile.",
        },
      }),
      showErrorMessage: (message, action) => {
        errorMessages.push(message);
        return action;
      },
      openSettings: (query) => {
        openedSettings.push(query);
        return undefined;
      },
    },
    transitions.push.bind(transitions),
  );

  await executeReconnectCommand(runtime);

  assert.deepEqual(transitions, ["connecting", "error"]);
  assert.equal(errorMessages.length, 1);
  assert.match(errorMessages[0], /target-mismatch/);
  assert.deepEqual(openedSettings, ["jupyterBrowserKernel.cdpHost"]);
  assert.deepEqual(runtime.connectionStateStore.getErrorContext(), {
    category: "target-mismatch",
    guidance: errorMessages[0],
  });
});

test("executeReconnectCommand blocks invalid endpoint and opens field-specific settings", async () => {
  const openedSettings: string[] = [];
  let connectCalls = 0;
  let disconnectCalls = 0;

  const runtime = createRuntime({
    readAndValidate: () => ({
      ok: false,
      error: {
        field: "port",
        message:
          "Invalid CDP port: port must be an integer between 1 and 65535.",
        correctiveAction:
          "Set jupyterBrowserKernel.cdpPort to a whole number between 1 and 65535.",
      },
    }),
    connectToTarget: async () => {
      connectCalls += 1;
      throw new Error(
        "connectToTarget should not be called for invalid config",
      );
    },
    disconnectActiveConnection: async () => {
      disconnectCalls += 1;
    },
    showErrorMessage: (_message, action) => action,
    openSettings: (query) => {
      openedSettings.push(query);
      return undefined;
    },
  });

  await executeReconnectCommand(runtime);

  assert.equal(connectCalls, 0);
  assert.equal(disconnectCalls, 0);
  assert.deepEqual(openedSettings, ["jupyterBrowserKernel.cdpPort"]);
});

test("executeReconnectCommand force-reconnect path tears down then reconnects", async () => {
  const calls: string[] = [];

  const runtime = createRuntime({
    connectionStateStore: createConnectionStateStore({
      initialState: "connected",
    }),
    cancelInFlightTransitions: () => {
      calls.push("cancel");
    },
    disconnectActiveConnection: async () => {
      calls.push("disconnect");
    },
    connectToTarget: async () => {
      calls.push("connect");
      return {
        ok: true,
        endpoint: { host: "localhost", port: 9222 },
        connectedTarget: {
          targetId: "target-1",
          sessionId: "session-1",
        },
      };
    },
  });

  await executeReconnectCommand(runtime);

  assert.deepEqual(calls, ["cancel", "disconnect", "connect"]);
});

test("executeReconnectCommand while connecting cancels in-flight transition then reconnects", async () => {
  const calls: string[] = [];

  const runtime = createRuntime({
    connectionStateStore: createConnectionStateStore({
      initialState: "connecting",
    }),
    cancelInFlightTransitions: () => {
      calls.push("cancel");
    },
    disconnectActiveConnection: async () => {
      calls.push("disconnect");
    },
    connectToTarget: async () => {
      calls.push("connect");
      return {
        ok: true,
        endpoint: { host: "localhost", port: 9222 },
        connectedTarget: {
          targetId: "target-1",
          sessionId: "session-1",
        },
      };
    },
  });

  await executeReconnectCommand(runtime);

  assert.deepEqual(calls, ["cancel", "disconnect", "connect"]);
});

test("executeReconnectCommand does not show reconnect notification after reconnect is aborted via AbortSignal", async () => {
  const infoMessages: string[] = [];
  const connectionStateStore = createConnectionStateStore({
    initialState: "connecting",
  });
  let observedAbort = false;

  const runtime = createRuntime({
    connectionStateStore,
    connectToTarget: async (_endpoint, _localize, abortSignal) =>
      await new Promise<never>((_resolve, reject) => {
        assert.ok(abortSignal);

        abortSignal.addEventListener(
          "abort",
          () => {
            observedAbort = true;
            reject(new Error("Connect attempt canceled."));
          },
          { once: true },
        );

        queueMicrotask(() => {
          connectionStateStore.cancelTransitions();
        });
      }),
    showInformationMessage: (message) => {
      infoMessages.push(message);
      return undefined;
    },
  });

  await executeReconnectCommand(runtime);

  assert.equal(observedAbort, true);
  assert.deepEqual(infoMessages, []);
});

test("executeReconnectCommand does not show reconnect error prompt after reconnect is aborted via AbortSignal", async () => {
  const errorMessages: string[] = [];
  const openedSettings: string[] = [];
  const connectionStateStore = createConnectionStateStore({
    initialState: "connecting",
  });
  let observedAbort = false;

  const runtime = createRuntime({
    connectionStateStore,
    connectToTarget: async (_endpoint, _localize, abortSignal) =>
      await new Promise<{
        ok: false;
        endpoint: { host: string; port: number };
        failure: {
          category: "endpoint-connectivity";
          message: string;
        };
      }>((resolve) => {
        assert.ok(abortSignal);

        let settled = false;

        const onAbort = () => {
          if (settled) {
            return;
          }
          settled = true;
          observedAbort = true;
          resolve({
            ok: false,
            endpoint: { host: "localhost", port: 9222 },
            failure: {
              category: "endpoint-connectivity",
              message: "Browser attach failed: ECONNREFUSED.",
            },
          });
        };

        abortSignal.addEventListener("abort", onAbort, { once: true });

        queueMicrotask(() => {
          connectionStateStore.cancelTransitions();
        });
      }),
    showErrorMessage: (message, action) => {
      errorMessages.push(message);
      return action;
    },
    openSettings: (query) => {
      openedSettings.push(query);
      return undefined;
    },
  });

  await executeReconnectCommand(runtime);

  assert.equal(observedAbort, true);
  assert.deepEqual(errorMessages, []);
  assert.deepEqual(openedSettings, []);
});

test("executeReconnectCommand routes endpoint-connectivity failures to cdpPort settings", async () => {
  const openedSettings: string[] = [];

  const runtime = createRuntime({
    connectToTarget: async () => ({
      ok: false,
      endpoint: { host: "localhost", port: 9222 },
      failure: {
        category: "endpoint-connectivity",
        message: "Browser attach failed: ECONNREFUSED.",
      },
    }),
    showErrorMessage: (_message, action) => action,
    openSettings: (query) => {
      openedSettings.push(query);
      return undefined;
    },
  });

  await executeReconnectCommand(runtime);

  assert.deepEqual(openedSettings, ["jupyterBrowserKernel.cdpPort"]);
});

test("executeReconnectCommand proceeds with connect attempt when teardown throws", async () => {
  const calls: string[] = [];

  const runtime = createRuntime({
    disconnectActiveConnection: async () => {
      calls.push("disconnect");
      throw new Error("teardown failed");
    },
    connectToTarget: async () => {
      calls.push("connect");
      return {
        ok: true,
        endpoint: { host: "localhost", port: 9222 },
        connectedTarget: {
          targetId: "target-1",
          sessionId: "session-1",
        },
      };
    },
  });

  await executeReconnectCommand(runtime);

  assert.deepEqual(calls, ["disconnect", "connect"]);
});

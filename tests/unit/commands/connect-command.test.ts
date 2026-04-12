import test from "node:test";
import assert from "node:assert/strict";
import { t as localize } from "@vscode/l10n";

import {
  createConnectionStateStore,
  type ConnectionState,
} from "../../../src/transport/connection-state";
import {
  executeConnectCommand,
  type ConnectCommandRuntime,
} from "../../../src/commands/connect-command";

function createRuntime(
  overrides: Partial<ConnectCommandRuntime>,
  onConnectionStateChanged?: (state: ConnectionState) => void,
): ConnectCommandRuntime {
  return {
    readAndValidate: () => ({
      ok: true,
      endpoint: { host: "localhost", port: 9222 },
    }),
    localize: localize,
    connectionStateStore: createConnectionStateStore({
      onConnectionStateChanged,
    }),
    connectToTarget: async () => ({
      ok: true,
      endpoint: { host: "localhost", port: 9222 },
      connectedTarget: {
        targetId: "target-1",
        sessionId: "session-1",
      },
    }),
    showInformationMessage: () => undefined,
    showErrorMessage: () => undefined,
    openSettings: () => undefined,
    ...overrides,
  };
}

test("executeConnectCommand sets deterministic connecting -> connected transition on success", async () => {
  const stateTransitions: ConnectionState[] = [];
  const infoMessages: string[] = [];

  const runtime = createRuntime(
    {
      readAndValidate: () => ({
        ok: true,
        endpoint: { host: "127.0.0.1", port: 9333 },
      }),
      showInformationMessage: (message) => {
        infoMessages.push(message);
        return undefined;
      },
    },
    stateTransitions.push.bind(stateTransitions),
  );

  await executeConnectCommand(runtime);

  assert.deepEqual(stateTransitions, ["connecting", "connected"]);
  assert.equal(infoMessages.length, 1);
  assert.match(infoMessages[0], /Connected/);
});

test("executeConnectCommand blocks invalid endpoint and offers actionable settings path", async () => {
  const errorMessages: string[] = [];
  const openedSettings: string[] = [];

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
    showErrorMessage: (message, action) => {
      errorMessages.push(message);
      return action;
    },
    openSettings: (query) => {
      openedSettings.push(query);
      return undefined;
    },
    showInformationMessage: () => {
      throw new Error(
        "showInformationMessage should not be called when config is invalid",
      );
    },
  });

  await executeConnectCommand(runtime);

  assert.equal(errorMessages.length, 1);
  assert.match(errorMessages[0], /jupyterBrowserKernel\.cdpPort/);
  assert.deepEqual(openedSettings, ["jupyterBrowserKernel.cdpPort"]);
});

test("executeConnectCommand does not open settings when user dismisses error dialog", async () => {
  const openedSettings: string[] = [];

  const runtime = createRuntime({
    readAndValidate: () => ({
      ok: false,
      error: {
        field: "host",
        message: "Invalid CDP host: host cannot be empty.",
        correctiveAction:
          "Set jupyterBrowserKernel.cdpHost to a hostname or IP address, for example localhost.",
      },
    }),
    showErrorMessage: () => undefined, // user dismissed without clicking Open Settings
    openSettings: (query) => {
      openedSettings.push(query);
      return undefined;
    },
  });

  await executeConnectCommand(runtime);

  assert.deepEqual(openedSettings, []);
});

test("executeConnectCommand falls back to host settings key for unknown validation field", async () => {
  const openedSettings: string[] = [];

  const runtime = createRuntime({
    readAndValidate: () => ({
      ok: false,
      error: {
        field: "future-field" as never,
        message: "Invalid endpoint field.",
        correctiveAction: "Update endpoint settings.",
      },
    }),
    showErrorMessage: (_message, action) => action,
    openSettings: (query) => {
      openedSettings.push(query);
      return undefined;
    },
  });

  await executeConnectCommand(runtime);

  assert.deepEqual(openedSettings, ["jupyterBrowserKernel.cdpHost"]);
});

test("executeConnectCommand sets deterministic connecting -> error transition for categorized failures", async () => {
  const stateTransitions: ConnectionState[] = [];
  const errorMessages: string[] = [];

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
    },
    stateTransitions.push.bind(stateTransitions),
  );

  await executeConnectCommand(runtime);

  assert.deepEqual(stateTransitions, ["connecting", "error"]);
  assert.equal(errorMessages.length, 1);
  assert.match(errorMessages[0], /target-mismatch/);
});

test("executeConnectCommand does not show connect notification after connect is aborted", async () => {
  const infoMessages: string[] = [];
  const connectionStateStore = createConnectionStateStore();

  const runtime = createRuntime({
    connectionStateStore,
    connectToTarget: async () => {
      connectionStateStore.cancelTransitions();
      connectionStateStore.setState("disconnected");

      return {
        ok: true,
        endpoint: { host: "localhost", port: 9222 },
        connectedTarget: {
          targetId: "target-1",
          sessionId: "session-1",
        },
      };
    },
    showInformationMessage: (message) => {
      infoMessages.push(message);
      return undefined;
    },
  });

  await executeConnectCommand(runtime);

  assert.equal(connectionStateStore.getState(), "disconnected");
  assert.deepEqual(infoMessages, []);
});

import type * as vscode from "vscode";
import {
  type Localize,
  type EndpointConfig,
  type EndpointValidationResult,
  readAndValidateEndpointConfig,
  summarizeEndpointForDisplay,
} from "../config/endpoint-config";
import {
  ConnectionStoreHandler,
  createConnectionStateStore,
  withConnectTransition,
  type ConnectionStateStore,
} from "../transport/connection-state";
import { connectToBrowserTarget } from "../transport/browser-connect";
import { formatConnectFailureMessage } from "../transport/connect-diagnostics";
import {
  settingsKeyForConnectFailure,
  settingsKeyForEndpointFailure,
  showSettingsPrompt,
} from "./command-utils";
import type {
  ConnectToTargetOperation,
  ConnectToTargetResult,
} from "../transport/connect-types";

export interface ConnectCommandRuntime {
  readAndValidate: () => EndpointValidationResult;
  localize: Localize;
  connectionStateStore: ConnectionStateStore;
  connectToTarget: ConnectToTargetOperation;
  showInformationMessage: (
    message: string,
  ) => PromiseLike<string | undefined> | void;
  showErrorMessage: (
    message: string,
    action: string,
  ) => PromiseLike<string | undefined> | string | undefined;
  openSettings: (query: string) => PromiseLike<unknown> | void;
}

export interface ConnectCommandRuntimeOptions extends ConnectionStoreHandler {
  connectToTarget?: ConnectToTargetOperation;
}

async function runConnect(
  runtime: ConnectCommandRuntime,
  endpoint: EndpointConfig,
): Promise<{
  aborted: boolean;
  connectResult: ConnectToTargetResult;
}> {
  let aborted = false;

  const connectResult = await withConnectTransition(
    runtime.connectionStateStore,
    () => runtime.connectToTarget(endpoint, runtime.localize),
    (result) => result.ok,
    () => {
      aborted = true;
    },
  );

  return {
    aborted,
    connectResult,
  };
}

export async function executeConnectCommand(
  runtime: ConnectCommandRuntime,
): Promise<void> {
  if (runtime.connectionStateStore.getState() === "connecting") {
    return;
  }

  const validation = runtime.readAndValidate();

  if (!validation.ok) {
    await showSettingsPrompt(
      runtime,
      runtime.localize({
        message: "{0} {1}",
        args: [validation.error.message, validation.error.correctiveAction],
        comment: [
          "{0} is the validation failure message.",
          "{1} is the corrective action the user should take.",
        ],
      }),
      settingsKeyForEndpointFailure(validation),
    );
    return;
  }

  const endpointSummary = summarizeEndpointForDisplay(validation.endpoint);
  const { aborted, connectResult } = await runConnect(
    runtime,
    validation.endpoint,
  );

  if (aborted) {
    return;
  }

  if (!connectResult.ok) {
    const message = formatConnectFailureMessage(
      connectResult.failure,
      endpointSummary,
      runtime.localize,
    );

    const settingsKey = settingsKeyForConnectFailure(
      connectResult.failure.category,
    );
    await showSettingsPrompt(runtime, message, settingsKey);
    return;
  }

  try {
    await runtime.showInformationMessage(
      runtime.localize({
        message: "Jupyter Browser Kernel: Connected to target {0} at {1}.",
        args: [connectResult.connectedTarget.targetId, endpointSummary],
        comment: [
          "{0} is the connected target id.",
          "{1} is the redacted or loopback-safe endpoint summary shown to the user.",
        ],
      }),
    );
  } catch {
    // non-fatal: info message failed to display
  }
}

export function createDefaultConnectCommandRuntime(
  vscodeApi: typeof vscode,
  options: ConnectCommandRuntimeOptions = {},
): ConnectCommandRuntime {
  const connectionStateStore =
    options.connectionStateStore ??
    createConnectionStateStore({
      onConnectionStateChanged: options.onConnectionStateChanged,
    });

  return {
    readAndValidate: () =>
      readAndValidateEndpointConfig(
        vscodeApi.workspace.getConfiguration("jupyterBrowserKernel"),
        vscodeApi.l10n.t,
      ),
    localize: vscodeApi.l10n.t,
    connectionStateStore,
    connectToTarget:
      options.connectToTarget ??
      ((endpoint, localize) =>
        connectToBrowserTarget(endpoint, undefined, localize)),
    showInformationMessage: (message) =>
      vscodeApi.window.showInformationMessage(message),
    showErrorMessage: (message, action) =>
      vscodeApi.window.showErrorMessage(message, action),
    openSettings: (query) =>
      vscodeApi.commands.executeCommand("workbench.action.openSettings", query),
  };
}

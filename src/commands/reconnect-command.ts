import type * as vscode from "vscode";
import {
  type Localize,
  type EndpointConfig,
  type EndpointValidationResult,
  readAndValidateEndpointConfig,
  summarizeEndpointForDisplay,
} from "../config/endpoint-config";
import {
  createConnectionStateStore,
  withConnectTransition,
  type ConnectionStateStore,
} from "../transport/connection-state";
import {
  connectToBrowserTarget,
  disconnectActiveBrowserConnection,
} from "../transport/browser-connect";
import { formatConnectFailureMessage } from "../transport/connect-diagnostics";
import type {
  ConnectToTargetOperation,
  ConnectToTargetResult,
} from "../transport/connect-types";
import {
  settingsKeyForConnectFailure,
  settingsKeyForEndpointFailure,
  showSettingsPrompt,
} from "./command-utils";
import { DisconnectCommandRuntimeOptions } from "./disconnect-command";
import { ConnectCommandRuntimeOptions } from "./connect-command";

export interface ReconnectCommandRuntime {
  readAndValidate: () => EndpointValidationResult;
  localize: Localize;
  connectionStateStore: ConnectionStateStore;
  cancelInFlightTransitions: () => void;
  connectToTarget: ConnectToTargetOperation;
  disconnectActiveConnection: () => Promise<void>;
  showInformationMessage: (
    message: string,
  ) => PromiseLike<string | undefined> | void;
  showErrorMessage: (
    message: string,
    action: string,
  ) => PromiseLike<string | undefined> | string | undefined;
  openSettings: (query: string) => PromiseLike<unknown> | void;
}

export interface ReconnectCommandRuntimeOptions
  extends ConnectCommandRuntimeOptions, DisconnectCommandRuntimeOptions {}

async function runConnect(
  runtime: ReconnectCommandRuntime,
  endpoint: EndpointConfig,
): Promise<ConnectToTargetResult> {
  return withConnectTransition(
    runtime.connectionStateStore,
    () => runtime.connectToTarget(endpoint, runtime.localize),
    (result) => result.ok,
  );
}

export async function executeReconnectCommand(
  runtime: ReconnectCommandRuntime,
): Promise<void> {
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

  runtime.cancelInFlightTransitions();
  await runtime.disconnectActiveConnection();

  const endpointSummary = summarizeEndpointForDisplay(validation.endpoint);
  const connectResult = await runConnect(runtime, validation.endpoint);

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
        message: "Jupyter Browser Kernel: Reconnected to target {0} at {1}.",
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

export function createDefaultReconnectCommandRuntime(
  vscodeApi: typeof vscode,
  options: ReconnectCommandRuntimeOptions = {},
): ReconnectCommandRuntime {
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
    cancelInFlightTransitions: () => {
      connectionStateStore.cancelTransitions();
    },
    connectToTarget:
      options.connectToTarget ??
      ((endpoint, localize) =>
        connectToBrowserTarget(endpoint, undefined, localize)),
    disconnectActiveConnection:
      options.disconnectActiveConnection ?? disconnectActiveBrowserConnection,
    showInformationMessage: (message) =>
      vscodeApi.window.showInformationMessage(message),
    showErrorMessage: (message, action) =>
      vscodeApi.window.showErrorMessage(message, action),
    openSettings: (query) =>
      vscodeApi.commands.executeCommand("workbench.action.openSettings", query),
  };
}

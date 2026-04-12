import type * as vscode from "vscode";
import { summarizeEndpointForDisplay } from "../config/endpoint-config";
import {
  showConnectOutcome,
  showEndpointValidationSettingsPrompt,
} from "./connect-command";
import {
  DisconnectCommandRuntime,
  DisconnectCommandRuntimeOptions,
  createDefaultDisconnectCommandRuntime,
} from "./disconnect-command";
import {
  ConnectCommandRuntime,
  ConnectCommandRuntimeOptions,
  createDefaultConnectCommandRuntime,
  runConnect,
} from "./connect-command";

export interface ReconnectCommandRuntime
  extends ConnectCommandRuntime, DisconnectCommandRuntime {}

export interface ReconnectCommandRuntimeOptions
  extends ConnectCommandRuntimeOptions, DisconnectCommandRuntimeOptions {}

export async function executeReconnectCommand(
  runtime: ReconnectCommandRuntime,
): Promise<void> {
  const validation = runtime.readAndValidate();

  if (!validation.ok) {
    await showEndpointValidationSettingsPrompt(runtime, validation);
    return;
  }

  runtime.cancelInFlightTransitions();
  try {
    await runtime.disconnectActiveConnection();
  } catch {
    // best effort teardown before reconnect
  }

  const endpointSummary = summarizeEndpointForDisplay(validation.endpoint);
  const { aborted, connectResult } = await runConnect(
    runtime,
    validation.endpoint,
  );

  if (aborted) {
    return;
  }

  await showConnectOutcome(
    runtime,
    connectResult,
    endpointSummary,
    "Jupyter Browser Kernel: Reconnected to target {0} at {1}.",
  );
}

export function createDefaultReconnectCommandRuntime(
  vscodeApi: typeof vscode,
  options: ReconnectCommandRuntimeOptions,
): ReconnectCommandRuntime {
  const connectRuntime = createDefaultConnectCommandRuntime(vscodeApi, options);
  const disconnectRuntime = createDefaultDisconnectCommandRuntime(
    vscodeApi,
    options,
  );

  return {
    ...connectRuntime,
    ...disconnectRuntime,
  };
}

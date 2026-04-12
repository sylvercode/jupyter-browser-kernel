import * as vscode from "vscode";
import {
  createDefaultConnectCommandRuntime,
  executeConnectCommand,
} from "./commands/connect-command";
import {
  createDefaultDisconnectCommandRuntime,
  executeDisconnectCommand,
} from "./commands/disconnect-command";
import {
  createDefaultReconnectCommandRuntime,
  executeReconnectCommand,
} from "./commands/reconnect-command";
import {
  ConnectionState,
  ConnectionStoreHandler,
  createConnectionStateStore,
} from "./transport/connection-state";
import { createConnectionStatusIndicator } from "./ui/connection-status-indicator";
import { disconnectActiveBrowserConnection } from "./transport/browser-connect";

type subscriptionInfo<T> = {
  command: string;
  runtimeFactory: (api: typeof vscode, handler: ConnectionStoreHandler) => T;
  callback: (runtime: T) => Promise<void>;
};

export function activate(context: vscode.ExtensionContext): void {
  const statusIndicator = createConnectionStatusIndicator(vscode);
  context.subscriptions.push(statusIndicator);

  const connectionStateStore = createConnectionStateStore({
    onConnectionStateChanged: (state: ConnectionState) => {
      statusIndicator.setState(state);
    },
  });

  const registerCommand = <T>({
    command,
    runtimeFactory,
    callback,
  }: subscriptionInfo<T>): void => {
    const runtime = runtimeFactory(vscode, { connectionStateStore });
    context.subscriptions.push(
      vscode.commands.registerCommand(command, async () => {
        await callback(runtime);
      }),
    );
  };

  registerCommand({
    command: "jupyterBrowserKernel.connect",
    runtimeFactory: createDefaultConnectCommandRuntime,
    callback: executeConnectCommand,
  });

  registerCommand({
    command: "jupyterBrowserKernel.disconnect",
    runtimeFactory: createDefaultDisconnectCommandRuntime,
    callback: executeDisconnectCommand,
  });

  registerCommand({
    command: "jupyterBrowserKernel.reconnect",
    runtimeFactory: createDefaultReconnectCommandRuntime,
    callback: executeReconnectCommand,
  });
}

export function deactivate(): Promise<void> {
  return disconnectActiveBrowserConnection();
}

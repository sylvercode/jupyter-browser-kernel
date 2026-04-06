import type * as vscode from "vscode";
import type { ConnectionState } from "../transport/connection-state";

const labelByState: Record<ConnectionState, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  connected: "Connected",
  error: "Error",
};

export interface ConnectionStatusIndicator extends vscode.Disposable {
  setState: (state: ConnectionState) => void;
}

export function createConnectionStatusIndicator(
  vscodeApi: typeof vscode,
): ConnectionStatusIndicator {
  const statusBarItem = vscodeApi.window.createStatusBarItem(
    vscodeApi.StatusBarAlignment.Left,
    100,
  );
  statusBarItem.name = "Jupyter Browser Kernel Connection Status";

  const setState = (state: ConnectionState): void => {
    const label = labelByState[state];
    statusBarItem.text = `Jupyter Browser: ${label}`;
    statusBarItem.tooltip = `Connection state: ${label}`;
    statusBarItem.show();
  };

  setState("disconnected");

  return {
    setState,
    dispose: () => statusBarItem.dispose(),
  };
}

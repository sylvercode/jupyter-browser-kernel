import type * as vscode from "vscode";
import type { Localize } from "../config/endpoint-config";
import type { ConnectionState } from "../transport/connection-state";

function localizedLabel(state: ConnectionState, localize: Localize): string {
  switch (state) {
    case "disconnected":
      return localize("Disconnected");
    case "connecting":
      return localize("Connecting");
    case "connected":
      return localize("Connected");
    case "error":
      return localize("Error");
  }
}

export interface ConnectionStatusIndicator extends vscode.Disposable {
  setState: (state: ConnectionState) => void;
}

export function createConnectionStatusIndicator(
  vscodeApi: typeof vscode,
): ConnectionStatusIndicator {
  const localize = vscodeApi.l10n.t;
  const statusBarItem = vscodeApi.window.createStatusBarItem(
    vscodeApi.StatusBarAlignment.Left,
    100,
  );
  statusBarItem.name = "Jupyter Browser Kernel Connection Status";

  const setState = (state: ConnectionState): void => {
    const label = localizedLabel(state, localize);
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

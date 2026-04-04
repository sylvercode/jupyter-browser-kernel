import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    "jupyterBrowserKernel.connect",
    () => {
      vscode.window.showInformationMessage(
        "Jupyter Browser Kernel: Extension activated — CDP connection not yet implemented.",
      );
    },
  );
  context.subscriptions.push(disposable);
}

export function deactivate(): void {}

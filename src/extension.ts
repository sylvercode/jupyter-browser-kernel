import * as vscode from "vscode";
import {
  readAndValidateEndpointConfig,
  summarizeEndpointForDisplay,
} from "./config/endpoint-config";
import { createConnectionStateStore } from "./transport/connection-state";
import { createConnectionLogger } from "./logging/connection-logger";
import { createKernelTransportFailureReporter } from "./logging/kernel-transport-failure-reporter";
import { createConnectionStatusIndicator } from "./ui/connection-status-indicator";
import { disconnectActiveBrowserConnection } from "./transport/browser-connect";
import {
  registerCellIsolationStatusBarProvider,
  registerKernelController,
} from "./notebook";
import { registerToggleCellIsolationCommand } from "./commands/toggle-cell-isolation-command";
import { DebugAdapterFactory, DebugConfigProvider } from "./debugger";

const ACTIVE_NOTEBOOK_USES_BROWSER_KERNEL_CONTEXT_KEY =
  "jupyterBrowserKernel.activeNotebookUsesBrowserKernel";

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel(
    "Jupyter Browser Kernel",
  );
  context.subscriptions.push(outputChannel);

  const statusIndicator = createConnectionStatusIndicator(vscode);
  context.subscriptions.push(statusIndicator);

  const logger = createConnectionLogger(outputChannel, () => {
    const validation = readAndValidateEndpointConfig(
      vscode.workspace.getConfiguration("jupyterBrowserKernel"),
      vscode.l10n.t,
    );
    return validation.ok
      ? summarizeEndpointForDisplay(validation.endpoint)
      : vscode.l10n.t("Endpoint unavailable (check settings).");
  });

  const connectionStateStore = createConnectionStateStore({
    onConnectionStateChanged: (state) => {
      statusIndicator.setState(state);
      logger.onConnectionStateChanged(state);
    },
    onErrorContextChanged: (context) => {
      statusIndicator.setErrorContext(context);
      logger.onErrorContextChanged(context);
    },
  });

  const reportKernelTransportFailure = createKernelTransportFailureReporter({
    connectionStateStore,
    disconnectActiveConnection: disconnectActiveBrowserConnection,
    outputChannel,
    localize: vscode.l10n.t,
    showErrorMessage: async (message) => {
      await vscode.window.showErrorMessage(message);
    },
  });

  const getDefaultCellIsolation = (): boolean =>
    (() => {
      const setting = vscode.workspace
        .getConfiguration("jupyterBrowserKernel")
        .get<unknown>("defaultCellIsolation", "isolated");

      if (setting === "isolated") {
        return true;
      }

      if (setting === "global") {
        return false;
      }

      // Backward compatibility for existing boolean user settings.
      // boolean false → global; any other unrecognised value falls back to
      // the new isolated default rather than silently producing global mode.
      return setting !== false;
    })();

  const kernelController = registerKernelController(vscode, {
    onTransportError: reportKernelTransportFailure,
    onIntentionalOutputLine: (line) => {
      outputChannel.appendLine(line);
    },
    getDefaultCellIsolation,
  });
  context.subscriptions.push(kernelController);

  const cellIsolationStatusBarProvider = registerCellIsolationStatusBarProvider(
    {
      notebooks: vscode.notebooks,
      workspace: vscode.workspace,
      NotebookCellKind: vscode.NotebookCellKind,
      NotebookCellStatusBarAlignment: vscode.NotebookCellStatusBarAlignment,
      NotebookCellStatusBarItem: vscode.NotebookCellStatusBarItem,
      EventEmitter: vscode.EventEmitter,
      l10n: vscode.l10n,
    },
    {
      getDefaultCellIsolation,
    },
  );
  context.subscriptions.push(cellIsolationStatusBarProvider);

  const debugLogger = (message: string, error?: unknown): void => {
    outputChannel.appendLine(vscode.l10n.t(message, String(error ?? "")));
  };

  const debugConfigProvider = new DebugConfigProvider({
    localize: vscode.l10n.t,
    getSettings: () =>
      vscode.workspace.getConfiguration("jupyterBrowserKernel"),
    showError: (message) => vscode.window.showErrorMessage(message),
  });
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(
      "jupyter-browser-kernel",
      debugConfigProvider,
    ),
  );

  const debugAdapterFactory = new DebugAdapterFactory({
    connectionStateStore,
    getSettings: () =>
      vscode.workspace.getConfiguration("jupyterBrowserKernel"),
    createInlineAdapterDescriptor: (adapter) =>
      new vscode.DebugAdapterInlineImplementation(adapter),
    localize: vscode.l10n.t,
    logger: debugLogger,
  });
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory(
      "jupyter-browser-kernel",
      debugAdapterFactory,
    ),
  );

  const selectedNotebookUris = new Set<string>();
  const syncActiveNotebookKernelContext = (): void => {
    const activeNotebookUri =
      vscode.window.activeNotebookEditor?.notebook.uri.toString();
    const activeUsesBrowserKernel =
      typeof activeNotebookUri === "string" &&
      selectedNotebookUris.has(activeNotebookUri);

    void vscode.commands.executeCommand(
      "setContext",
      ACTIVE_NOTEBOOK_USES_BROWSER_KERNEL_CONTEXT_KEY,
      activeUsesBrowserKernel,
    );
  };

  syncActiveNotebookKernelContext();

  context.subscriptions.push(
    kernelController.onDidChangeSelectedNotebooks(({ notebook, selected }) => {
      const notebookUri = notebook.uri.toString();

      if (selected) {
        selectedNotebookUris.add(notebookUri);
      } else {
        selectedNotebookUris.delete(notebookUri);
      }

      syncActiveNotebookKernelContext();
    }),
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveNotebookEditor(() => {
      syncActiveNotebookKernelContext();
    }),
  );

  registerToggleCellIsolationCommand(context, {
    commands: vscode.commands,
    workspace: vscode.workspace,
    window: vscode.window,
    NotebookEdit: vscode.NotebookEdit,
    WorkspaceEdit: vscode.WorkspaceEdit,
    getDefaultCellIsolation,
  });
}

export function deactivate(): Promise<void> {
  return disconnectActiveBrowserConnection();
}

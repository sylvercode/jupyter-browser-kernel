import type * as vscode from "vscode";

import type { Localize } from "../config/endpoint-config";

const NOTEBOOK_TYPE = "jupyter-notebook";
const RESULT_TYPE_METADATA_KEY = "jupyterBrowserKernel.resultType";

type LocalizationApi = {
  t: Localize;
};

interface ResultTypeStatusBarNotebookApi {
  registerNotebookCellStatusBarItemProvider: typeof vscode.notebooks.registerNotebookCellStatusBarItemProvider;
}

interface ResultTypeStatusBarWorkspaceApi {
  onDidChangeNotebookDocument: typeof vscode.workspace.onDidChangeNotebookDocument;
}

export interface ResultTypeStatusBarApi {
  notebooks: ResultTypeStatusBarNotebookApi;
  workspace: ResultTypeStatusBarWorkspaceApi;
  NotebookCellKind: typeof vscode.NotebookCellKind;
  NotebookCellStatusBarAlignment: typeof vscode.NotebookCellStatusBarAlignment;
  NotebookCellStatusBarItem: typeof vscode.NotebookCellStatusBarItem;
  EventEmitter: typeof vscode.EventEmitter;
  l10n: LocalizationApi;
}

export type ResultTypeStatusBarOptions = Record<string, never>;

function extractResultTypeFromOutput(
  cell: vscode.NotebookCell,
): string | undefined {
  if (cell.outputs.length === 0) {
    return undefined;
  }

  // Check the first output for result type metadata
  const firstOutput = cell.outputs[0];
  if (!firstOutput || !firstOutput.metadata) {
    return undefined;
  }

  const resultType = firstOutput.metadata[RESULT_TYPE_METADATA_KEY];
  return typeof resultType === "string" ? resultType : undefined;
}

function toStatusBarText(localize: Localize, resultType: string): string {
  return localize("Result Type: {0}", resultType);
}

export function registerResultTypeStatusBarProvider(
  api: ResultTypeStatusBarApi,
  _options: ResultTypeStatusBarOptions,
): vscode.Disposable {
  const changeEmitter = new api.EventEmitter<void>();

  const provider: vscode.NotebookCellStatusBarItemProvider = {
    onDidChangeCellStatusBarItems: changeEmitter.event,
    provideCellStatusBarItems: (cell) => {
      if (
        cell.kind !== api.NotebookCellKind.Code ||
        cell.document.languageId !== "javascript"
      ) {
        return [];
      }

      const resultType = extractResultTypeFromOutput(cell);
      if (!resultType) {
        return [];
      }

      const item = new api.NotebookCellStatusBarItem(
        toStatusBarText(api.l10n.t, resultType),
        api.NotebookCellStatusBarAlignment.Left,
      );

      item.priority = 100;

      return [item];
    },
  };

  const providerDisposable =
    api.notebooks.registerNotebookCellStatusBarItemProvider(
      NOTEBOOK_TYPE,
      provider,
    );

  const documentChangeDisposable = api.workspace.onDidChangeNotebookDocument(
    (_event) => {
      // Emit change event whenever notebook output changes so status bar refreshes
      changeEmitter.fire();
    },
  );

  const dispose = (): void => {
    providerDisposable.dispose();
    documentChangeDisposable.dispose();
    changeEmitter.dispose();
  };

  return { dispose };
}

export const RESULT_TYPE_METADATA_NAMESPACE = "jupyterBrowserKernel";
export const RESULT_TYPE_METADATA_KEY_CONSTANT = RESULT_TYPE_METADATA_KEY;

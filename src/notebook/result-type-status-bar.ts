import type * as vscode from "vscode";

import type { Localize } from "../config/endpoint-config";
import { RESULT_TYPE_METADATA_KEY } from "./result-type-metadata";

const NOTEBOOK_TYPE = "jupyter-notebook";

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

  for (const output of cell.outputs) {
    const resultType = output.metadata?.[RESULT_TYPE_METADATA_KEY];
    if (typeof resultType === "string") {
      return resultType;
    }
  }

  return undefined;
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
    (event) => {
      // Refresh only when output changes in a notebook document.
      const hasOutputChanges = event.cellChanges.some(
        (change) => (change.outputs?.length ?? 0) > 0,
      );
      if (hasOutputChanges) {
        changeEmitter.fire();
      }
    },
  );

  const dispose = (): void => {
    providerDisposable.dispose();
    documentChangeDisposable.dispose();
    changeEmitter.dispose();
  };

  return { dispose };
}

export { RESULT_TYPE_METADATA_NAMESPACE } from "./result-type-metadata";
export { RESULT_TYPE_METADATA_KEY as RESULT_TYPE_METADATA_KEY_CONSTANT } from "./result-type-metadata";

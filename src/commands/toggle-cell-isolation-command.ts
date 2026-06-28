import type * as vscode from "vscode";

const TOGGLE_CELL_ISOLATION_COMMAND =
  "jupyterBrowserKernel.toggleCellIsolation";
const TOGGLE_CELL_ISOLATION_ISOLATE_COMMAND =
  "jupyterBrowserKernel.toggleCellIsolation.isolate";
const TOGGLE_CELL_ISOLATION_SHARE_COMMAND =
  "jupyterBrowserKernel.toggleCellIsolation.share";
const USE_DEFAULT_CELL_ISOLATION_COMMAND =
  "jupyterBrowserKernel.useDefaultCellIsolation";
const ACTIVE_CELL_ISOLATION_STATE_CONTEXT_KEY =
  "jupyterBrowserKernel.activeCellIsolationState";

type CellIsolationState = "default" | "isolated" | "shared";

type UnknownRecord = Record<string, unknown>;

export interface ToggleCellIsolationApi {
  commands: Pick<typeof vscode.commands, "registerCommand" | "executeCommand">;
  workspace: Pick<
    typeof vscode.workspace,
    "applyEdit" | "onDidChangeNotebookDocument"
  >;
  window: Pick<
    typeof vscode.window,
    | "activeNotebookEditor"
    | "onDidChangeActiveNotebookEditor"
    | "onDidChangeNotebookEditorSelection"
  >;
  NotebookEdit: typeof vscode.NotebookEdit;
  WorkspaceEdit: typeof vscode.WorkspaceEdit;
  getDefaultCellIsolation: () => boolean;
}

function isObjectRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function toMetadataRecord(metadata: unknown): UnknownRecord | undefined {
  return isObjectRecord(metadata) ? metadata : undefined;
}

function isCellIsolated(metadata: unknown): boolean {
  const metadataRecord = toMetadataRecord(metadata);
  const kernelMetadata = toMetadataRecord(
    metadataRecord?.jupyterBrowserKernel,
  ) as { isolated?: unknown } | undefined;

  return kernelMetadata?.isolated === true;
}

function readExplicitCellIsolation(metadata: unknown): boolean | undefined {
  const metadataRecord = toMetadataRecord(metadata);
  const kernelMetadata = toMetadataRecord(
    metadataRecord?.jupyterBrowserKernel,
  ) as { isolated?: unknown } | undefined;

  return typeof kernelMetadata?.isolated === "boolean"
    ? kernelMetadata.isolated
    : undefined;
}

function toCellIsolationState(metadata: unknown): CellIsolationState {
  const explicitIsolation = readExplicitCellIsolation(metadata);
  if (explicitIsolation === true) {
    return "isolated";
  }

  if (explicitIsolation === false) {
    return "shared";
  }

  return "default";
}

function removeExplicitIsolation(metadata: unknown): UnknownRecord {
  const nextMetadata = {
    ...(toMetadataRecord(metadata) ?? {}),
  };

  const existingKernelMetadata = {
    ...(toMetadataRecord(nextMetadata.jupyterBrowserKernel) ?? {}),
  };

  const { isolated: _omitted, ...restKernelMetadata } = existingKernelMetadata;

  if (Object.keys(restKernelMetadata).length === 0) {
    delete nextMetadata.jupyterBrowserKernel;
    return nextMetadata;
  }

  nextMetadata.jupyterBrowserKernel = restKernelMetadata;
  return nextMetadata;
}

function setExplicitIsolation(
  metadata: unknown,
  isolated: boolean,
): UnknownRecord {
  const nextMetadata = {
    ...(toMetadataRecord(metadata) ?? {}),
  };

  const existingKernelMetadata = {
    ...(toMetadataRecord(nextMetadata.jupyterBrowserKernel) ?? {}),
  };

  nextMetadata.jupyterBrowserKernel = {
    ...existingKernelMetadata,
    isolated,
  };

  return nextMetadata;
}

function getCellFromActiveEditor(
  editor: vscode.NotebookEditor | undefined,
): vscode.NotebookCell | undefined {
  if (!editor || editor.selections.length === 0) {
    return undefined;
  }

  const firstSelection = editor.selections[0];
  if (!firstSelection || firstSelection.start >= editor.notebook.cellCount) {
    return undefined;
  }

  return editor.notebook.cellAt(firstSelection.start);
}

function resolveTargetCell(
  cell: unknown,
  activeEditor: vscode.NotebookEditor | undefined,
): vscode.NotebookCell | undefined {
  if (cell && typeof cell === "object") {
    const maybeCell = cell as Partial<vscode.NotebookCell>;
    if (typeof maybeCell.index === "number" && !!maybeCell.notebook) {
      return maybeCell as vscode.NotebookCell;
    }
  }

  return getCellFromActiveEditor(activeEditor);
}

async function setActiveCellIsolationContext(
  api: ToggleCellIsolationApi,
): Promise<void> {
  const activeCell = getCellFromActiveEditor(api.window.activeNotebookEditor);
  const activeCellIsolationState = toCellIsolationState(activeCell?.metadata);
  await api.commands.executeCommand(
    "setContext",
    ACTIVE_CELL_ISOLATION_STATE_CONTEXT_KEY,
    activeCellIsolationState,
  );
}

function registerToolbarContextSynchronization(
  api: ToggleCellIsolationApi,
): vscode.Disposable {
  const syncContext = (): void => {
    void setActiveCellIsolationContext(api);
  };

  syncContext();

  const selectionDisposable =
    api.window.onDidChangeNotebookEditorSelection(syncContext);
  const activeEditorDisposable =
    api.window.onDidChangeActiveNotebookEditor(syncContext);
  const notebookDisposable =
    api.workspace.onDidChangeNotebookDocument(syncContext);

  return {
    dispose: () => {
      selectionDisposable.dispose();
      activeEditorDisposable.dispose();
      notebookDisposable.dispose();
    },
  };
}

async function toggleIsolationForCell(
  api: ToggleCellIsolationApi,
  cell: unknown,
): Promise<void> {
  const targetCell = resolveTargetCell(cell, api.window.activeNotebookEditor);
  if (!targetCell) {
    await setActiveCellIsolationContext(api);
    return;
  }

  const currentIsolation =
    readExplicitCellIsolation(targetCell.metadata) ??
    api.getDefaultCellIsolation();
  const newMetadata = setExplicitIsolation(
    targetCell.metadata,
    !currentIsolation,
  );
  const edit = new api.WorkspaceEdit();
  edit.set(targetCell.notebook.uri, [
    api.NotebookEdit.updateCellMetadata(targetCell.index, newMetadata),
  ]);

  await api.workspace.applyEdit(edit);
  await setActiveCellIsolationContext(api);
}

async function applyIsolationForCell(
  api: ToggleCellIsolationApi,
  cell: unknown,
  isolation: boolean | undefined,
): Promise<void> {
  const targetCell = resolveTargetCell(cell, api.window.activeNotebookEditor);
  if (!targetCell) {
    await setActiveCellIsolationContext(api);
    return;
  }

  const newMetadata =
    isolation === undefined
      ? removeExplicitIsolation(targetCell.metadata)
      : setExplicitIsolation(targetCell.metadata, isolation);
  const edit = new api.WorkspaceEdit();
  edit.set(targetCell.notebook.uri, [
    api.NotebookEdit.updateCellMetadata(targetCell.index, newMetadata),
  ]);

  await api.workspace.applyEdit(edit);
  await setActiveCellIsolationContext(api);
}

export function registerToggleCellIsolationCommand(
  context: vscode.ExtensionContext,
  api: ToggleCellIsolationApi,
): vscode.Disposable {
  const toggleHandler = async (cell?: unknown): Promise<void> => {
    await toggleIsolationForCell(api, cell);
  };
  const isolateHandler = async (cell?: unknown): Promise<void> => {
    await applyIsolationForCell(api, cell, true);
  };
  const shareHandler = async (cell?: unknown): Promise<void> => {
    await applyIsolationForCell(api, cell, false);
  };
  const useDefaultHandler = async (cell?: unknown): Promise<void> => {
    await applyIsolationForCell(api, cell, undefined);
  };

  const toggleDisposable = api.commands.registerCommand(
    TOGGLE_CELL_ISOLATION_COMMAND,
    toggleHandler,
  );
  const isolateDisposable = api.commands.registerCommand(
    TOGGLE_CELL_ISOLATION_ISOLATE_COMMAND,
    isolateHandler,
  );
  const shareDisposable = api.commands.registerCommand(
    TOGGLE_CELL_ISOLATION_SHARE_COMMAND,
    shareHandler,
  );
  const useDefaultDisposable = api.commands.registerCommand(
    USE_DEFAULT_CELL_ISOLATION_COMMAND,
    useDefaultHandler,
  );
  const contextDisposable = registerToolbarContextSynchronization(api);

  const disposable: vscode.Disposable = {
    dispose: () => {
      toggleDisposable.dispose();
      isolateDisposable.dispose();
      shareDisposable.dispose();
      useDefaultDisposable.dispose();
      contextDisposable.dispose();
    },
  };
  context.subscriptions.push(disposable);
  return disposable;
}

import type * as vscode from "vscode";

import type { Localize } from "../config/endpoint-config";

const NOTEBOOK_TYPE = "jupyter-notebook";
const TOGGLE_CELL_ISOLATION_COMMAND =
  "jupyterBrowserKernel.toggleCellIsolation";

const ISOLATED_ICON = "$(bracket)";
const SHARED_ICON = "$(broadcast)";

type IsolationMode = "isolated" | "shared";

interface KernelCellMetadata {
  jupyterBrowserKernel?: {
    isolated?: boolean;
  };
}

interface ResolvedIsolationMode {
  mode: IsolationMode;
  inheritedFromDefault: boolean;
}

interface LocalizationApi {
  t: Localize;
}

interface CellIsolationStatusBarNotebookApi {
  registerNotebookCellStatusBarItemProvider: typeof vscode.notebooks.registerNotebookCellStatusBarItemProvider;
}

interface CellIsolationStatusBarWorkspaceApi {
  onDidChangeConfiguration: typeof vscode.workspace.onDidChangeConfiguration;
}

export interface CellIsolationStatusBarApi {
  notebooks: CellIsolationStatusBarNotebookApi;
  workspace: CellIsolationStatusBarWorkspaceApi;
  NotebookCellKind: typeof vscode.NotebookCellKind;
  NotebookCellStatusBarAlignment: typeof vscode.NotebookCellStatusBarAlignment;
  NotebookCellStatusBarItem: typeof vscode.NotebookCellStatusBarItem;
  EventEmitter: typeof vscode.EventEmitter;
  l10n: LocalizationApi;
}

export interface CellIsolationStatusBarOptions {
  getDefaultCellIsolation: () => boolean;
}

function readExplicitIsolation(metadata: unknown): boolean | undefined {
  const typedMetadata = metadata as KernelCellMetadata | undefined;
  const explicitIsolation = typedMetadata?.jupyterBrowserKernel?.isolated;

  return typeof explicitIsolation === "boolean" ? explicitIsolation : undefined;
}

function resolveIsolationMode(
  metadata: unknown,
  getDefaultCellIsolation: () => boolean,
): ResolvedIsolationMode {
  const explicitIsolation = readExplicitIsolation(metadata);

  if (explicitIsolation === true) {
    return {
      mode: "isolated",
      inheritedFromDefault: false,
    };
  }

  if (explicitIsolation === false) {
    return {
      mode: "shared",
      inheritedFromDefault: false,
    };
  }

  return {
    mode: getDefaultCellIsolation() ? "isolated" : "shared",
    inheritedFromDefault: true,
  };
}

function toStatusBarText(resolvedMode: ResolvedIsolationMode): string {
  return resolvedMode.mode === "isolated" ? ISOLATED_ICON : SHARED_ICON;
}

function toStatusBarTooltip(
  localize: Localize,
  resolvedMode: ResolvedIsolationMode,
): string {
  if (resolvedMode.mode === "isolated") {
    return resolvedMode.inheritedFromDefault
      ? localize("Mode: Isolated (default). Click to toggle.")
      : localize("Mode: Isolated. Click to toggle.");
  }

  return resolvedMode.inheritedFromDefault
    ? localize("Mode: Shared (default). Click to toggle.")
    : localize("Mode: Shared. Click to toggle.");
}

export function registerCellIsolationStatusBarProvider(
  api: CellIsolationStatusBarApi,
  options: CellIsolationStatusBarOptions,
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

      const resolvedMode = resolveIsolationMode(
        cell.metadata,
        options.getDefaultCellIsolation,
      );
      const item = new api.NotebookCellStatusBarItem(
        toStatusBarText(resolvedMode),
        api.NotebookCellStatusBarAlignment.Right,
      );

      item.command = {
        command: TOGGLE_CELL_ISOLATION_COMMAND,
        title: api.l10n.t("Toggle Cell Isolation"),
        arguments: [cell],
      };
      item.tooltip = toStatusBarTooltip(api.l10n.t, resolvedMode);
      item.accessibilityInformation = {
        label: item.tooltip,
      };
      item.priority = 100;

      return [item];
    },
  };

  const providerDisposable =
    api.notebooks.registerNotebookCellStatusBarItemProvider(
      NOTEBOOK_TYPE,
      provider,
    );

  const configurationDisposable = api.workspace.onDidChangeConfiguration(
    (event) => {
      if (
        event.affectsConfiguration("jupyterBrowserKernel.defaultCellIsolation")
      ) {
        changeEmitter.fire();
      }
    },
  );

  return {
    dispose: () => {
      configurationDisposable.dispose();
      providerDisposable.dispose();
      changeEmitter.dispose();
    },
  };
}

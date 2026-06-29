import type * as vscode from "vscode";
import type { Localize } from "../config/endpoint-config";
import {
  executeCell,
  createKernelRuntime,
  type ExecutionFailure,
  type WriteIntentionalOutputLine,
} from "../kernel";
import {
  createEnsureSessionReadyForExecution,
  type EnsureSessionReadyForExecution,
} from "./debug-session-preflight";

let executionOrder = 0;

export interface NotebookApi {
  notebooks: Pick<typeof vscode.notebooks, "createNotebookController">;
  NotebookCellOutput: typeof vscode.NotebookCellOutput;
  NotebookCellOutputItem: typeof vscode.NotebookCellOutputItem;
}

export interface LocalizationApi {
  t: Localize;
}

export interface KernelControllerApi extends NotebookApi {
  l10n: LocalizationApi;
}

interface SessionPreflightApi {
  debug: typeof vscode.debug;
  workspace: typeof vscode.workspace;
  window: typeof vscode.window;
}

export interface KernelControllerOptions {
  onTransportError?:
    | ((failure: ExecutionFailure) => Promise<void>)
    | ((failure: ExecutionFailure) => void);
  onIntentionalOutputLine?: WriteIntentionalOutputLine;
  ensureSessionReady?: EnsureSessionReadyForExecution;
  getDefaultCellIsolation?: () => boolean;
}

function supportsSessionPreflight(
  api: KernelControllerApi,
): api is KernelControllerApi & SessionPreflightApi {
  const typedApi = api as Partial<SessionPreflightApi>;

  return (
    typedApi.debug !== undefined &&
    typedApi.workspace !== undefined &&
    typedApi.window !== undefined
  );
}

export function registerKernelController(
  api: KernelControllerApi,
  options?: KernelControllerOptions,
): vscode.NotebookController {
  const controller = api.notebooks.createNotebookController(
    "jupyter-browser-kernel",
    "jupyter-notebook",
    api.l10n.t("Browser Kernel"),
  );

  controller.supportedLanguages = ["javascript"];

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: api.NotebookCellOutput,
      NotebookCellOutputItem: api.NotebookCellOutputItem,
    },
    api.l10n.t,
    undefined,
    options?.getDefaultCellIsolation,
    options?.onTransportError,
    options?.onIntentionalOutputLine,
  );

  const ensureSessionReady: EnsureSessionReadyForExecution =
    options?.ensureSessionReady ??
    (supportsSessionPreflight(api)
      ? createEnsureSessionReadyForExecution({
          debug: api.debug,
          workspace: api.workspace,
          window: api.window,
          localize: api.l10n.t,
        })
      : async () => ({ ready: true }));

  controller.executeHandler = async (cells, _notebook, executionController) => {
    const preflight = await ensureSessionReady();
    if (!preflight.ready) {
      return;
    }

    for (const cell of cells) {
      executionOrder += 1;
      const wasCancelled = await executeCell({
        cell,
        controller: executionController,
        executionOrder,
        runtime,
      });

      if (wasCancelled) {
        break;
      }
    }
  };

  return controller;
}

export function resetExecutionOrderForTests(): void {
  executionOrder = 0;
}

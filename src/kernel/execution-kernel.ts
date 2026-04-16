import type * as vscode from "vscode";
import type { Localize } from "../config/endpoint-config";
import {
  getActiveBrowserConnection,
  type ActiveBrowserConnection,
} from "../transport/browser-connect";
import {
  normalizeEvaluationResult,
  normalizeTransportError,
  type ExecutionFailure,
  type ExecutionResult,
} from "./execution-result";

export interface NotebookOutputApi {
  NotebookCellOutput: typeof vscode.NotebookCellOutput;
  NotebookCellOutputItem: typeof vscode.NotebookCellOutputItem;
}

export interface KernelRuntime {
  notebookOutputApi: NotebookOutputApi;
  localize: Localize;
  getActiveConnection: () => ActiveBrowserConnection | undefined;
}

export interface ExecuteCellRequest {
  cell: vscode.NotebookCell;
  controller: vscode.NotebookController;
  executionOrder: number;
  runtime: KernelRuntime;
}

export function createKernelRuntime(
  notebookOutputApi: NotebookOutputApi,
  localize: Localize,
  getActiveConnection: () =>
    | ActiveBrowserConnection
    | undefined = getActiveBrowserConnection,
): KernelRuntime {
  return {
    notebookOutputApi,
    localize,
    getActiveConnection,
  };
}

export async function executeCell({
  cell,
  controller,
  executionOrder,
  runtime,
}: ExecuteCellRequest): Promise<void> {
  const execution = controller.createNotebookCellExecution(cell);
  execution.start(Date.now());
  execution.executionOrder = executionOrder;

  const connection = runtime.getActiveConnection();
  if (!connection) {
    const noSessionFailure = createNoSessionFailure(runtime.localize);
    await writeFailureOutput(
      execution,
      noSessionFailure,
      runtime.notebookOutputApi,
    );
    execution.end(false, Date.now());
    return;
  }

  const expression = cell.document.getText();

  const result = await evaluateCellExpression(connection, expression);

  if (result.ok) {
    const renderedValue =
      result.value.length > 0 ? result.value : runtime.localize("undefined");
    await writeSuccessOutput(
      execution,
      renderedValue,
      runtime.notebookOutputApi,
    );
    execution.end(true, Date.now());
    return;
  }

  await writeFailureOutput(execution, result, runtime.notebookOutputApi);
  execution.end(false, Date.now());
}

function createNoSessionFailure(localize: Localize): ExecutionFailure {
  return {
    ok: false,
    name: "NoActiveSessionError",
    kind: "no-session",
    message: localize(
      "No active browser session. Run Jupyter Browser Kernel: Reconnect and try again.",
    ),
  };
}

async function evaluateCellExpression(
  connection: ActiveBrowserConnection,
  expression: string,
): Promise<ExecutionResult> {
  try {
    const rawResponse = await connection.evaluate(expression);
    return normalizeEvaluationResult(rawResponse);
  } catch (error) {
    return normalizeTransportError(error);
  }
}

async function writeSuccessOutput(
  execution: vscode.NotebookCellExecution,
  value: string,
  notebookOutputApi: NotebookOutputApi,
): Promise<void> {
  await execution.replaceOutput([
    new notebookOutputApi.NotebookCellOutput([
      notebookOutputApi.NotebookCellOutputItem.text(value, "text/plain"),
    ]),
  ]);
}

async function writeFailureOutput(
  execution: vscode.NotebookCellExecution,
  failure: ExecutionFailure,
  notebookOutputApi: NotebookOutputApi,
): Promise<void> {
  const error = toErrorObject(failure);

  await execution.replaceOutput([
    new notebookOutputApi.NotebookCellOutput([
      notebookOutputApi.NotebookCellOutputItem.error(error),
    ]),
  ]);
}

function toErrorObject(failure: ExecutionFailure): Error {
  const error = new Error(failure.message);
  error.name = failure.name;

  if (failure.stack) {
    error.stack = failure.stack;
  }

  return error;
}

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
  type ExecutionFailureKind,
  type ExecutionResult,
} from "./execution-result";
import {
  getKernelFailureCellOutputMessage,
  getIntentionalLogSectionLabel,
  getIsolationAnnotationMessage,
  getNoActiveSessionMessage,
} from "./execution-messages";
import { buildCellExpression } from "./build-cell-expression";
import {
  createRuntilmeCellBridgeKey,
  createRuntilmeCellBridgeSetupExpression,
  createRuntilmeCellBridgeTeardownExpression,
} from "./runtilme-cell-bridge";

export interface NotebookOutputApi {
  NotebookCellOutput: typeof vscode.NotebookCellOutput;
  NotebookCellOutputItem: typeof vscode.NotebookCellOutputItem;
}

export type GetActiveConnection = () => ActiveBrowserConnection | undefined;

type EvaluationCompletion =
  | {
      kind: "result";
      result: ExecutionResult;
      bridgeKey: string | undefined;
    }
  | { kind: "cancelled" };

export type ReportTransportError = (
  failure: ExecutionFailure,
) => Promise<void> | void;

export interface KernelRuntime {
  notebookOutputApi: NotebookOutputApi;
  localize: Localize;
  getActiveConnection: GetActiveConnection;
  getDefaultCellIsolation: () => boolean;
  reportTransportError?: ReportTransportError;
}

export interface ExecuteCellRequest {
  cell: vscode.NotebookCell;
  controller: vscode.NotebookController;
  executionOrder: number;
  runtime: KernelRuntime;
}

interface KernelCellMetadata {
  jupyterBrowserKernel?: {
    isolated?: boolean;
  };
}

export function createKernelRuntime(
  notebookOutputApi: NotebookOutputApi,
  localize: Localize,
  getActiveConnection: GetActiveConnection = getActiveBrowserConnection,
  getDefaultCellIsolation: () => boolean = () => false,
  reportTransportError?: ReportTransportError,
): KernelRuntime {
  return {
    notebookOutputApi,
    localize,
    getActiveConnection,
    getDefaultCellIsolation,
    reportTransportError,
  };
}

export async function executeCell({
  cell,
  controller,
  executionOrder,
  runtime,
}: ExecuteCellRequest): Promise<boolean> {
  const execution = controller.createNotebookCellExecution(cell);
  let executionEnded = false;
  const endExecution = (success: boolean): void => {
    if (executionEnded) {
      return;
    }

    execution.end(success, Date.now());
    executionEnded = true;
  };

  execution.start(Date.now());
  execution.executionOrder = executionOrder;

  if (execution.token.isCancellationRequested) {
    endExecution(false);
    return true;
  }

  try {
    const connection = runtime.getActiveConnection();
    if (!connection) {
      const noSessionFailure = createNoSessionFailure(runtime.localize);
      reportFailureAsync(runtime, noSessionFailure);
      await writeFailureOutput(
        execution,
        noSessionFailure,
        [],
        runtime.notebookOutputApi,
        runtime.localize,
      );
      endExecution(false);
      return false;
    }

    const userCode = cell.document.getText();
    const sourceUri = cell.document.uri.toString();
    const explicitIsolation = readIsolationMetadata(cell.metadata);
    const isolate = explicitIsolation ?? runtime.getDefaultCellIsolation();
    const expression = buildCellExpression(userCode, sourceUri, { isolate });
    let resolveCancellationSignal: (() => void) | undefined;
    const cancellationSignal = new Promise<void>((resolve) => {
      resolveCancellationSignal = resolve;
    });

    const cancellationListener = execution.token.onCancellationRequested(() => {
      void connection.terminateExecution();
      endExecution(false);
      resolveCancellationSignal?.();
    });

    let completion: EvaluationCompletion;
    try {
      const evaluationFlow = evaluateCellExpressionWithLogSetup(
        connection,
        expression,
      ).then(
        async ({
          bridgeKey,
          evaluationPromise,
        }): Promise<EvaluationCompletion> => ({
          kind: "result",
          bridgeKey,
          result: await evaluationPromise,
        }),
      );

      completion = await Promise.race([
        evaluationFlow,
        cancellationSignal.then(
          (): EvaluationCompletion => ({ kind: "cancelled" }),
        ),
      ]);
    } finally {
      cancellationListener.dispose();
    }

    if (completion.kind === "cancelled") {
      return true;
    }

    const intentionalLogs = await collectIntentionalLogs(
      connection,
      completion.bridgeKey,
    );
    const result = completion.result;

    if (execution.token.isCancellationRequested) {
      endExecution(false);
      return true;
    }

    if (result.ok) {
      const renderedValue =
        result.value.length > 0 ? result.value : runtime.localize("undefined");
      await writeSuccessOutput(
        execution,
        renderedValue,
        intentionalLogs,
        runtime.notebookOutputApi,
        runtime.localize,
        isolate,
      );
      endExecution(true);
      return false;
    }

    if (shouldReportFailure(result)) {
      reportFailureAsync(runtime, result);
    }

    await writeFailureOutput(
      execution,
      result,
      intentionalLogs,
      runtime.notebookOutputApi,
      runtime.localize,
    );
    endExecution(false);
    return false;
  } catch {
    endExecution(false);
    return execution.token.isCancellationRequested;
  }
}

function createNoSessionFailure(localize: Localize): ExecutionFailure {
  return {
    ok: false,
    name: "NoActiveSessionError",
    kind: "no-session",
    message: getNoActiveSessionMessage(localize),
  };
}

function isInfrastructureFailure(kind: ExecutionFailureKind): boolean {
  return (
    kind === "transport-error" || kind === "no-session" || kind === "timeout"
  );
}

function shouldReportFailure(failure: ExecutionFailure): boolean {
  return isInfrastructureFailure(failure.kind);
}

function reportFailureAsync(
  runtime: KernelRuntime,
  failure: ExecutionFailure,
): void {
  let reportPromise: Promise<void> | void;
  try {
    reportPromise = runtime.reportTransportError?.(failure);
  } catch {
    return;
  }

  if (!reportPromise) {
    return;
  }

  void Promise.resolve(reportPromise).catch(() => undefined);
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

async function evaluateCellExpressionWithLogSetup(
  connection: ActiveBrowserConnection,
  expression: string,
): Promise<{
  bridgeKey: string | undefined;
  evaluationPromise: Promise<ExecutionResult>;
}> {
  const bridgeKey = await initializeRuntilmeCellBridge(connection);
  return {
    bridgeKey,
    evaluationPromise: evaluateCellExpression(connection, expression),
  };
}

function readIsolationMetadata(metadata: unknown): boolean | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const typedMetadata = metadata as KernelCellMetadata;
  return typeof typedMetadata.jupyterBrowserKernel?.isolated === "boolean"
    ? typedMetadata.jupyterBrowserKernel.isolated
    : undefined;
}

async function writeSuccessOutput(
  execution: vscode.NotebookCellExecution,
  value: string,
  intentionalLogs: readonly string[],
  notebookOutputApi: NotebookOutputApi,
  localize: Localize,
  isIsolated: boolean,
): Promise<void> {
  const outputs: vscode.NotebookCellOutput[] = [];

  if (isIsolated) {
    outputs.push(
      new notebookOutputApi.NotebookCellOutput([
        notebookOutputApi.NotebookCellOutputItem.text(
          getIsolationAnnotationMessage(localize),
          "text/plain",
        ),
      ]),
    );
  }

  outputs.push(
    new notebookOutputApi.NotebookCellOutput([
      notebookOutputApi.NotebookCellOutputItem.text(value, "text/plain"),
    ]),
  );

  if (intentionalLogs.length > 0) {
    outputs.push(
      createIntentionalLogOutput(intentionalLogs, notebookOutputApi, localize),
    );
  }

  await execution.replaceOutput(outputs);
}

async function writeFailureOutput(
  execution: vscode.NotebookCellExecution,
  failure: ExecutionFailure,
  intentionalLogs: readonly string[],
  notebookOutputApi: NotebookOutputApi,
  localize: Localize,
): Promise<void> {
  const outputs: vscode.NotebookCellOutput[] = [];

  if (intentionalLogs.length > 0) {
    outputs.push(
      createIntentionalLogOutput(intentionalLogs, notebookOutputApi, localize),
    );
  }

  if (isInfrastructureFailure(failure.kind)) {
    const message = getKernelFailureCellOutputMessage(localize, failure.kind);

    outputs.push(
      new notebookOutputApi.NotebookCellOutput([
        notebookOutputApi.NotebookCellOutputItem.text(message, "text/plain"),
      ]),
    );

    await execution.replaceOutput(outputs);
    return;
  }

  const error = toErrorObject(failure);

  outputs.push(
    new notebookOutputApi.NotebookCellOutput([
      notebookOutputApi.NotebookCellOutputItem.error(error),
    ]),
  );

  await execution.replaceOutput(outputs);
}

function createIntentionalLogOutput(
  intentionalLogs: readonly string[],
  notebookOutputApi: NotebookOutputApi,
  localize: Localize,
): vscode.NotebookCellOutput {
  const payload = [
    getIntentionalLogSectionLabel(localize),
    ...intentionalLogs,
  ].join("\n");

  return new notebookOutputApi.NotebookCellOutput([
    notebookOutputApi.NotebookCellOutputItem.text(payload, "text/plain"),
  ]);
}

async function initializeRuntilmeCellBridge(
  connection: ActiveBrowserConnection,
): Promise<string | undefined> {
  const bridgeKey = createRuntilmeCellBridgeKey();

  try {
    await connection.evaluate(
      createRuntilmeCellBridgeSetupExpression(bridgeKey),
    );
    return bridgeKey;
  } catch {
    // Fall back to regular cell execution when helper bootstrap cannot be installed.
    return undefined;
  }
}

async function collectIntentionalLogs(
  connection: ActiveBrowserConnection,
  bridgeKey: string | undefined,
): Promise<string[]> {
  if (!bridgeKey) {
    return [];
  }

  try {
    const response = await connection.evaluate(
      createRuntilmeCellBridgeTeardownExpression(bridgeKey),
    );

    if (response.exceptionDetails) {
      return [];
    }

    const value = response.result.value;
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

function toErrorObject(failure: ExecutionFailure): Error {
  const error = new Error(failure.message);
  error.name = failure.name;

  if (failure.stack) {
    error.stack = failure.stack;
  }

  return error;
}

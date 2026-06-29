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
  getRuntimeCellBridgeUnavailableMessage,
  getIntentionalLogSectionLabel,
  formatIntentionalOutputEntry,
  getNoActiveSessionMessage,
} from "./execution-messages";
import { buildCellExpression } from "./build-cell-expression";
import {
  createRuntilmeCellBridgeKey,
  createRuntilmeCellBridgeSetupExpression,
  createRuntilmeCellBridgeTeardownExpression,
  referencesRuntimeCellBridge,
} from "./runtilme-cell-bridge";

export interface NotebookOutputApi {
  NotebookCellOutput: typeof vscode.NotebookCellOutput;
  NotebookCellOutputItem: typeof vscode.NotebookCellOutputItem;
}

export type GetActiveConnection = () => ActiveBrowserConnection | undefined;

type EvaluationCompletion =
  | { kind: "result"; result: ExecutionResult }
  | { kind: "cancelled" };

interface RuntilmeCellBridgeInitializationResult {
  bridgeKey?: string;
  bridgeAvailable: boolean;
}

export type ReportTransportError = (
  failure: ExecutionFailure,
) => Promise<void> | void;

export type WriteIntentionalOutputLine = (line: string) => Promise<void> | void;

export interface KernelRuntime {
  notebookOutputApi: NotebookOutputApi;
  localize: Localize;
  getActiveConnection: GetActiveConnection;
  getDefaultCellIsolation: () => boolean;
  reportTransportError?: ReportTransportError;
  writeIntentionalOutputLine?: WriteIntentionalOutputLine;
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
  getDefaultCellIsolation: () => boolean = () => true,
  reportTransportError?: ReportTransportError,
  writeIntentionalOutputLine?: WriteIntentionalOutputLine,
): KernelRuntime {
  return {
    notebookOutputApi,
    localize,
    getActiveConnection,
    getDefaultCellIsolation,
    reportTransportError,
    writeIntentionalOutputLine,
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
    const usesRuntimeCellBridge = referencesRuntimeCellBridge(userCode);
    let resolveCancellationSignal: (() => void) | undefined;
    const cancellationSignal = new Promise<void>((resolve) => {
      resolveCancellationSignal = resolve;
    });

    const cancellationListener = execution.token.onCancellationRequested(() => {
      void connection.terminateExecution();
      endExecution(false);
      resolveCancellationSignal?.();
    });

    let bridgeKey: string | undefined;
    let completion: EvaluationCompletion;
    try {
      const evaluationFlow = (async (): Promise<EvaluationCompletion> => {
        const needsRuntimeCellBridge = usesRuntimeCellBridge && isolate;

        if (needsRuntimeCellBridge) {
          const bridgeInitialization =
            await initializeRuntilmeCellBridge(connection);
          bridgeKey = bridgeInitialization.bridgeKey;

          if (!bridgeInitialization.bridgeAvailable) {
            return {
              kind: "result",
              result: getRuntimeCellBridgeUnavailableFailure(runtime.localize),
            };
          }
        }

        const expression = buildCellExpression(userCode, sourceUri, {
          isolate,
          runtimeCellBridgeKey: bridgeKey,
        });

        return {
          kind: "result",
          result: await evaluateCellExpression(connection, expression),
        };
      })();

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
      const intentionalLogs = await collectIntentionalLogs(
        connection,
        bridgeKey,
      );
      reportIntentionalOutputAsync(runtime, intentionalLogs);
      return true;
    }

    const intentionalLogs = await collectIntentionalLogs(connection, bridgeKey);
    reportIntentionalOutputAsync(runtime, intentionalLogs);
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

function reportIntentionalOutputAsync(
  runtime: KernelRuntime,
  intentionalLogs: readonly string[],
): void {
  if (intentionalLogs.length === 0 || !runtime.writeIntentionalOutputLine) {
    return;
  }

  for (const entry of intentionalLogs) {
    const line = formatIntentionalOutputEntry(runtime.localize, entry);
    let writePromise: Promise<void> | void;

    try {
      writePromise = runtime.writeIntentionalOutputLine(line);
    } catch {
      continue;
    }

    if (writePromise) {
      void Promise.resolve(writePromise).catch(() => undefined);
    }
  }
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
): Promise<void> {
  const outputs: vscode.NotebookCellOutput[] = [];

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

  if (isInfrastructureFailure(failure.kind)) {
    const message = getKernelFailureCellOutputMessage(localize, failure.kind);

    outputs.push(
      new notebookOutputApi.NotebookCellOutput([
        notebookOutputApi.NotebookCellOutputItem.text(message, "text/plain"),
      ]),
    );

    if (intentionalLogs.length > 0) {
      outputs.push(
        createIntentionalLogOutput(
          intentionalLogs,
          notebookOutputApi,
          localize,
        ),
      );
    }

    await execution.replaceOutput(outputs);
    return;
  }

  const error = toErrorObject(failure);

  outputs.push(
    new notebookOutputApi.NotebookCellOutput([
      notebookOutputApi.NotebookCellOutputItem.error(error),
    ]),
  );

  if (intentionalLogs.length > 0) {
    outputs.push(
      createIntentionalLogOutput(intentionalLogs, notebookOutputApi, localize),
    );
  }

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
): Promise<RuntilmeCellBridgeInitializationResult> {
  const bridgeKey = createRuntilmeCellBridgeKey();

  try {
    const response = await connection.evaluate(
      createRuntilmeCellBridgeSetupExpression(bridgeKey),
    );

    if (response.exceptionDetails) {
      return {
        bridgeAvailable: false,
      };
    }

    return {
      bridgeKey,
      bridgeAvailable: true,
    };
  } catch {
    // Continue without the runtime cell bridge when bootstrap cannot be installed.
    return {
      bridgeAvailable: false,
    };
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

function getRuntimeCellBridgeUnavailableFailure(
  localize: Localize,
): ExecutionFailure {
  return {
    ok: false,
    name: "RuntimeCellBridgeUnavailableError",
    kind: "runtime-error",
    message: getRuntimeCellBridgeUnavailableMessage(localize),
  };
}

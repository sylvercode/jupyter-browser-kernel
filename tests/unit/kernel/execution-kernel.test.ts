import test from "node:test";
import assert from "node:assert/strict";

import {
  createKernelRuntime,
  executeCell,
} from "../../../src/kernel/execution-kernel.js";
import type { ActiveBrowserConnection } from "../../../src/transport/browser-connect.js";
import { createFakeDebuggerSession } from "../test-utils/browser-debugger-session-mock.js";
import {
  createCancellationHarness,
  type CancellationTokenLike,
} from "../test-utils/cancellation-harness.js";
import {
  FakeNotebookCellOutput,
  FakeNotebookCellOutputItem,
} from "../test-utils/fake-notebook-output.js";
import { createLocalizeMock } from "../test-utils/localize-mock.js";

interface RecordedExecution {
  startedAt?: number;
  endedAt?: number;
  success?: boolean;
  executionOrder?: number;
  outputs: FakeNotebookCellOutput[];
}

interface RecordedNotebookExecution {
  start: (startTime: number) => void;
  end: (success: boolean, endTime: number) => void;
  replaceOutput: (outputs: FakeNotebookCellOutput[]) => Promise<void>;
  executionOrder?: number;
  token: CancellationTokenLike;
}

interface ExecutionRecorder {
  execution: RecordedExecution;
  notebookExecution: RecordedNotebookExecution;
  cancel: () => void;
}

const DEFAULT_FAKE_CELL_URI =
  "vscode-notebook-cell://test-authority/workspaces/foundry-devil-code-sight/tests/files/test1.ipynb#ch0000000000000";

function createExecutionRecorder(options?: {
  isCancellationRequested?: boolean;
}): ExecutionRecorder {
  const execution: RecordedExecution = {
    outputs: [],
  };

  const cancellation = options?.isCancellationRequested
    ? (() => {
        const harness = createCancellationHarness();
        harness.cancel();
        return harness;
      })()
    : createCancellationHarness();

  const notebookExecution: RecordedNotebookExecution = {
    start: (startTime: number) => {
      execution.startedAt = startTime;
    },
    end: (success: boolean, endTime: number) => {
      execution.success = success;
      execution.endedAt = endTime;
    },
    replaceOutput: async (outputs: FakeNotebookCellOutput[]) => {
      execution.outputs = outputs;
    },
    executionOrder: undefined as number | undefined,
    token: cancellation.token,
  };

  return {
    execution,
    notebookExecution,
    cancel: cancellation.cancel,
  };
}

function createFakeCell(
  text: string,
  sourceUri: string = DEFAULT_FAKE_CELL_URI,
  metadata?: unknown,
): {
  document: {
    getText: () => string;
    uri: { toString: () => string };
  };
  metadata?: unknown;
} {
  return {
    document: {
      getText: () => text,
      uri: {
        toString: () => sourceUri,
      },
    },
    metadata,
  };
}

function createFakeConnection(
  evaluate: ActiveBrowserConnection["evaluate"],
): ActiveBrowserConnection {
  return {
    targetId: "target-1",
    sessionId: "session-1",
    endpoint: { host: "localhost", port: 9222 },
    debugger: createFakeDebuggerSession(),
    evaluate,
    terminateExecution: async () => undefined,
    close: async () => undefined,
  };
}

function collectUserExpressions(evaluateCalls: string[]): string[] {
  return evaluateCalls.filter((expression) =>
    expression.includes("//# sourceURL="),
  );
}

test("executeCell evaluates expression and writes success output", async () => {
  const sourceUri =
    "vscode-notebook-cell://test-authority/workspaces/foundry-devil-code-sight/tests/files/test1.ipynb#ch0000000000001";
  const evaluateCalls: string[] = [];
  const connection = createFakeConnection(async (expression) => {
    evaluateCalls.push(expression);
    return {
      result: {
        type: "number",
        value: 4,
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  await executeCell({
    cell: createFakeCell("2 + 2", sourceUri) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 7,
    runtime,
  });

  const userExpressions = collectUserExpressions(evaluateCalls);
  assert.deepEqual(userExpressions, [
    `await (async()=>{2 + 2})()\n//# sourceURL=${sourceUri}\n`,
  ]);
  assert.equal(notebookExecution.executionOrder, 7);
  assert.equal(execution.success, true);
  assert.equal(execution.outputs.length, 1);
  assert.equal(execution.outputs[0]?.items[0]?.kind, "text");
  assert.equal(execution.outputs[0]?.items[0]?.value, "4");
  // Success output remains plain text with text/plain MIME.
  assert.equal(execution.outputs[0]?.items[0]?.mime, "text/plain");
});

test("executeCell uses global mode when getDefaultCellIsolation returns false (backward-compat boolean false path)", async () => {
  const sourceUri =
    "vscode-notebook-cell://test-authority/workspaces/foundry-devil-code-sight/tests/files/test1.ipynb#ch0000000000001";
  const evaluateCalls: string[] = [];
  const connection = createFakeConnection(async (expression) => {
    evaluateCalls.push(expression);
    return {
      result: {
        type: "number",
        value: 9,
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
    () => false, // simulate old boolean false setting → global mode
  );

  await executeCell({
    cell: createFakeCell("3 + 3", sourceUri) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 8,
    runtime,
  });

  const userExpressions = collectUserExpressions(evaluateCalls);
  // Global mode must not wrap the expression in an isolated async IIFE.
  assert.deepEqual(userExpressions, [`3 + 3\n//# sourceURL=${sourceUri}\n`]);
  assert.equal(execution.success, true);
  assert.equal(execution.outputs.length, 1);
  assert.equal(execution.outputs[0]?.items[0]?.value, "9");
});

test("executeCell exits before evaluation when cancellation was already requested", async () => {
  const evaluateCalls: string[] = [];
  const connection = createFakeConnection(async (expression) => {
    evaluateCalls.push(expression);
    return {
      result: {
        type: "number",
        value: 10,
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder({
    isCancellationRequested: true,
  });

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  const wasCancelled = await executeCell({
    cell: createFakeCell("5 + 5") as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 8,
    runtime,
  });

  assert.equal(wasCancelled, true);
  assert.deepEqual(evaluateCalls, []);
  assert.equal(execution.success, false);
  assert.equal(execution.outputs.length, 0);
});

test("executeCell terminates runtime evaluation when cancellation is requested", async () => {
  let releaseEvaluation: (() => void) | undefined;
  const continueEvaluation = new Promise<void>((resolve) => {
    releaseEvaluation = resolve;
  });
  let markEvaluationStarted: (() => void) | undefined;
  const evaluationStarted = new Promise<void>((resolve) => {
    markEvaluationStarted = resolve;
  });

  let terminateCalls = 0;
  const connection = {
    ...createFakeConnection(async () => {
      markEvaluationStarted?.();
      await continueEvaluation;
      return {
        result: {
          type: "number",
          value: 99,
        },
      } as never;
    }),
    terminateExecution: async () => {
      terminateCalls += 1;
    },
  } satisfies ActiveBrowserConnection;

  const { execution, notebookExecution, cancel } = createExecutionRecorder();

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  const runPromise = executeCell({
    cell: createFakeCell("await new Promise(() => {})") as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 9,
    runtime,
  });

  await evaluationStarted;
  cancel();

  const wasCancelled = await runPromise;
  releaseEvaluation?.();

  assert.equal(wasCancelled, true);
  assert.equal(terminateCalls, 1);
  assert.equal(execution.success, false);
  assert.equal(execution.outputs.length, 0);
});

test("executeCell tears down runtime cell bridge state after cancellation", async () => {
  let releaseEvaluation: (() => void) | undefined;
  const continueEvaluation = new Promise<void>((resolve) => {
    releaseEvaluation = resolve;
  });
  let markEvaluationStarted: (() => void) | undefined;
  const evaluationStarted = new Promise<void>((resolve) => {
    markEvaluationStarted = resolve;
  });
  const evaluateCalls: string[] = [];

  let terminateCalls = 0;
  const connection = {
    ...createFakeConnection(async (expression) => {
      evaluateCalls.push(expression);
      if (evaluateCalls.length === 1) {
        return {
          result: {
            type: "string",
            value: "ignored-setup-result",
          },
        } as never;
      }

      if (evaluateCalls.length === 2) {
        markEvaluationStarted?.();
        await continueEvaluation;
        return {
          result: {
            type: "number",
            value: 99,
          },
        } as never;
      }

      return {
        result: {
          type: "object",
          subtype: "array",
          value: [],
        },
      } as never;
    }),
    terminateExecution: async () => {
      terminateCalls += 1;
    },
  } satisfies ActiveBrowserConnection;

  const { execution, notebookExecution, cancel } = createExecutionRecorder();

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  const runPromise = executeCell({
    cell: createFakeCell("$cell.log('first'); 1", undefined, {
      jupyterBrowserKernel: { isolated: true },
    }) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 10,
    runtime,
  });

  await evaluationStarted;
  cancel();

  const wasCancelled = await runPromise;
  releaseEvaluation?.();

  assert.equal(wasCancelled, true);
  assert.equal(terminateCalls, 1);
  assert.equal(execution.success, false);
  assert.equal(execution.outputs.length, 0);
  assert.equal(evaluateCalls.length, 3);
  assert.equal(
    evaluateCalls[2]?.includes("delete globalScope[bridgeKey];"),
    true,
  );
});

test("executeCell writes structured error output for runtime exception", async () => {
  const connection = createFakeConnection(async () => {
    return {
      result: {
        type: "undefined",
      },
      exceptionDetails: {
        text: "Uncaught TypeError: boom",
        exception: {
          className: "TypeError",
          description: "TypeError: boom\n    at <anonymous>:1:1",
        },
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  await executeCell({
    cell: createFakeCell("throw new TypeError('boom')") as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 1,
    runtime,
  });

  assert.equal(execution.success, false);
  assert.equal(execution.outputs[0]?.items[0]?.kind, "error");

  const renderedError = execution.outputs[0]?.items[0]?.value;
  assert.ok(renderedError instanceof Error);
  assert.equal(renderedError.name, "TypeError");
  assert.equal(renderedError.message, "boom");
  // User-code errors are surfaced as Error objects without protocol-specific fields.
  assert.equal(typeof renderedError.name, "string");
  assert.equal(typeof renderedError.message, "string");
  assert.ok(!("kind" in renderedError));
  assert.ok(!("exceptionDetails" in renderedError));
  assert.ok(!("objectId" in renderedError));
  assert.ok(!("className" in renderedError));
});

test("executeCell reports debug-session guidance when no active session", async () => {
  const { execution, notebookExecution } = createExecutionRecorder();
  const reportedFailures: { kind: string; message: string }[] = [];

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => undefined,
    undefined,
    (failure) => {
      reportedFailures.push({ kind: failure.kind, message: failure.message });
    },
  );

  await executeCell({
    cell: createFakeCell("2 + 2") as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 2,
    runtime,
  });

  assert.equal(execution.success, false);
  assert.deepEqual(reportedFailures, [
    {
      kind: "no-session",
      message:
        "No active Browser Kernel debug session. Start a debug session and run the cell again.",
    },
  ]);
  assert.equal(execution.outputs.length, 1);
  assert.equal(execution.outputs[0]?.items[0]?.kind, "text");
  assert.match(
    String(execution.outputs[0]?.items[0]?.value),
    /No active Browser Kernel debug session/,
  );
});

test("executeCell reports transport failures to callback and avoids stack-style cell output", async () => {
  const transportError = new Error("Session closed unexpectedly");
  transportError.name = "TargetClosedError";

  const connection = createFakeConnection(async () => {
    throw transportError;
  });

  const { execution, notebookExecution } = createExecutionRecorder();
  const reportedFailures: { kind: string; message: string }[] = [];

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
    undefined,
    (failure) => {
      reportedFailures.push({ kind: failure.kind, message: failure.message });
    },
  );

  await executeCell({
    cell: createFakeCell("2 + 2") as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 3,
    runtime,
  });

  assert.equal(execution.success, false);
  assert.deepEqual(reportedFailures, [
    {
      kind: "transport-error",
      message: "Session closed unexpectedly",
    },
  ]);
  assert.equal(execution.outputs[0]?.items[0]?.kind, "text");
  assert.equal(execution.outputs[0]?.items[0]?.mime, "text/plain");
  assert.match(
    String(execution.outputs[0]?.items[0]?.value),
    /Transport error while running this cell/,
  );
});

test("executeCell ends even while transport error reporting is still pending", async () => {
  const transportError = new Error("Session closed unexpectedly");
  transportError.name = "TargetClosedError";

  const connection = createFakeConnection(async () => {
    throw transportError;
  });

  const { execution, notebookExecution } = createExecutionRecorder();
  let resolveReporter: (() => void) | undefined;
  const reporterStarted = new Promise<void>((resolve) => {
    resolveReporter = resolve;
  });
  let reportedFailureKind: string | undefined;

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
    undefined,
    async (failure) => {
      reportedFailureKind = failure.kind;
      await reporterStarted;
    },
  );

  await executeCell({
    cell: createFakeCell("2 + 2") as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 4,
    runtime,
  });

  assert.equal(reportedFailureKind, "transport-error");
  assert.equal(execution.success, false);
  assert.equal(execution.outputs[0]?.items[0]?.kind, "text");

  resolveReporter?.();
});

test("executeCell writes structured error output for promise rejection", async () => {
  const connection = createFakeConnection(async () => {
    return {
      result: { type: "undefined" },
      exceptionDetails: {
        text: "Uncaught (in promise) TypeError: async boom",
        exception: {
          className: "TypeError",
          description: "TypeError: async boom\n    at <anonymous>:1:1",
        },
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  await executeCell({
    cell: createFakeCell(
      "Promise.reject(new TypeError('async boom'))",
    ) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 1,
    runtime,
  });

  assert.equal(execution.success, false);
  assert.equal(execution.outputs[0]?.items[0]?.kind, "error");

  const renderedError = execution.outputs[0]?.items[0]?.value;
  assert.ok(renderedError instanceof Error);
  assert.equal(renderedError.name, "TypeError");
  assert.equal(renderedError.message, "async boom");
});

test("executeCell writes text output and reports failure for timeout", async () => {
  const connection = createFakeConnection(async () => {
    return {
      result: { type: "undefined" },
      exceptionDetails: {
        text: "Script execution timed out.",
        lineNumber: 0,
        columnNumber: 0,
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();
  const reportedFailures: string[] = [];

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
    undefined,
    (failure) => {
      reportedFailures.push(failure.kind);
    },
  );

  await executeCell({
    cell: createFakeCell("new Promise(() => {})") as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 1,
    runtime,
  });

  assert.equal(execution.success, false);
  assert.equal(execution.outputs[0]?.items[0]?.kind, "text");
  assert.deepEqual(reportedFailures, ["timeout"]);
  // Infrastructure failures render localized plain text output.
  assert.equal(execution.outputs[0]?.items[0]?.mime, "text/plain");
});

test("executeCell still produces success output for resolved async value (regression)", async () => {
  const connection = createFakeConnection(async () => {
    return {
      result: { type: "number", value: 42 },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  await executeCell({
    cell: createFakeCell("Promise.resolve(42)") as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 1,
    runtime,
  });

  assert.equal(execution.success, true);
  assert.equal(execution.outputs[0]?.items[0]?.kind, "text");
  assert.equal(execution.outputs[0]?.items[0]?.value, "42");
});

test("executeCell classifies transport-thrown timeout error as timeout kind with text output", async () => {
  // Simulates raceWithTimeout or CDP throwing "CDP evaluation timed out"
  // instead of returning exceptionDetails — the pipeline must classify it as
  // timeout, not transport-error.
  const connection = createFakeConnection(async () => {
    throw new Error("CDP evaluation timed out");
  });

  const { execution, notebookExecution } = createExecutionRecorder();
  const reportedFailures: string[] = [];

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
    undefined,
    (failure) => {
      reportedFailures.push(failure.kind);
    },
  );

  await executeCell({
    cell: createFakeCell("new Promise(() => {})") as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 5,
    runtime,
  });

  assert.equal(execution.success, false);
  // Timeout is an infrastructure failure — text output, not structured Error
  assert.equal(execution.outputs[0]?.items[0]?.kind, "text");
  assert.match(String(execution.outputs[0]?.items[0]?.value), /timed out/i);
  assert.deepEqual(reportedFailures, ["timeout"]);
});

test("executeCell keeps sourceURL bytes stable across reruns of the same cell", async () => {
  const sourceUri =
    "vscode-notebook-cell://test-authority/workspaces/foundry-devil-code-sight/tests/files/test1.ipynb#ch0000000000999";
  const evaluateCalls: string[] = [];
  const connection = createFakeConnection(async (expression) => {
    evaluateCalls.push(expression);
    return {
      result: {
        type: "number",
        value: 3,
      },
    } as never;
  });

  const { notebookExecution } = createExecutionRecorder();
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  const cell = createFakeCell("1 + 2", sourceUri) as never;

  await executeCell({
    cell,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 10,
    runtime,
  });

  await executeCell({
    cell,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 11,
    runtime,
  });

  const userExpressions = collectUserExpressions(evaluateCalls);
  assert.equal(userExpressions.length, 2);
  assert.equal(userExpressions[0], userExpressions[1]);
  assert.match(String(userExpressions[0]), new RegExp(`${sourceUri}\\n$`));
});

test("executeCell assigns unique sourceURL bytes for distinct cell URIs", async () => {
  const uriA =
    "vscode-notebook-cell://test-authority/workspaces/foundry-devil-code-sight/tests/files/test1.ipynb#ch0000000000101";
  const uriB =
    "vscode-notebook-cell://test-authority/workspaces/foundry-devil-code-sight/tests/files/test1.ipynb#ch0000000000102";
  const evaluateCalls: string[] = [];
  const connection = createFakeConnection(async (expression) => {
    evaluateCalls.push(expression);
    return {
      result: {
        type: "number",
        value: 1,
      },
    } as never;
  });

  const { notebookExecution } = createExecutionRecorder();
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  await executeCell({
    cell: createFakeCell("1", uriA) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 12,
    runtime,
  });

  await executeCell({
    cell: createFakeCell("1", uriB) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 13,
    runtime,
  });

  const userExpressions = collectUserExpressions(evaluateCalls);
  assert.equal(userExpressions.length, 2);
  assert.notEqual(userExpressions[0], userExpressions[1]);
  assert.match(String(userExpressions[0]), new RegExp(`sourceURL=${uriA}`));
  assert.match(String(userExpressions[1]), new RegExp(`sourceURL=${uriB}`));
});

test("executeCell routes metadata cases to wrapper only when isolated is boolean true", async () => {
  const evaluateCalls: string[] = [];
  const connection = createFakeConnection(async (expression) => {
    evaluateCalls.push(expression);
    return {
      result: {
        type: "number",
        value: 2,
      },
    } as never;
  });
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );
  const metadataCases: unknown[] = [
    undefined,
    {},
    { jupyterBrowserKernel: { isolated: false } },
    { jupyterBrowserKernel: { isolated: "true" } },
    { jupyterBrowserKernel: { isolated: true } },
  ];

  for (const [index, metadata] of metadataCases.entries()) {
    const { notebookExecution } = createExecutionRecorder();
    await executeCell({
      cell: createFakeCell("1 + 1", undefined, metadata) as never,
      controller: {
        createNotebookCellExecution: () => notebookExecution,
      } as never,
      executionOrder: 20 + index,
      runtime,
    });
  }

  const userExpressions = collectUserExpressions(evaluateCalls);
  assert.equal(userExpressions.length, 5);
  assert.equal(userExpressions[0]?.startsWith("await (async()=>{"), true);
  assert.equal(userExpressions[1]?.startsWith("await (async()=>{"), true);
  assert.equal(userExpressions[2]?.startsWith("(async()=>{"), false);
  assert.equal(userExpressions[3]?.startsWith("await (async()=>{"), true);
  assert.equal(userExpressions[4]?.startsWith("await (async()=>{"), true);
});

test("executeCell uses workspace default isolation when metadata is absent", async () => {
  const evaluateCalls: string[] = [];
  const connection = createFakeConnection(async (expression) => {
    evaluateCalls.push(expression);
    return {
      result: {
        type: "number",
        value: 2,
      },
    } as never;
  });

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
    () => true,
  );

  const { notebookExecution } = createExecutionRecorder();
  await executeCell({
    cell: createFakeCell("1 + 1", undefined, {}) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 200,
    runtime,
  });

  const userExpressions = collectUserExpressions(evaluateCalls);
  assert.equal(userExpressions.length, 1);
  assert.equal(userExpressions[0]?.startsWith("await (async()=>{"), true);
});

test("executeCell explicit metadata overrides workspace default isolation", async () => {
  const evaluateCalls: string[] = [];
  const connection = createFakeConnection(async (expression) => {
    evaluateCalls.push(expression);
    return {
      result: {
        type: "number",
        value: 2,
      },
    } as never;
  });

  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
    () => true,
  );

  const { notebookExecution: explicitSharedExecution } =
    createExecutionRecorder();
  await executeCell({
    cell: createFakeCell("1 + 1", undefined, {
      jupyterBrowserKernel: { isolated: false },
    }) as never,
    controller: {
      createNotebookCellExecution: () => explicitSharedExecution,
    } as never,
    executionOrder: 201,
    runtime,
  });

  const { notebookExecution: explicitIsolatedExecution } =
    createExecutionRecorder();
  await executeCell({
    cell: createFakeCell("1 + 1", undefined, {
      jupyterBrowserKernel: { isolated: true },
    }) as never,
    controller: {
      createNotebookCellExecution: () => explicitIsolatedExecution,
    } as never,
    executionOrder: 202,
    runtime,
  });

  const userExpressions = collectUserExpressions(evaluateCalls);
  assert.equal(userExpressions.length, 2);
  assert.equal(userExpressions[0]?.startsWith("(async()=>{"), false);
  assert.equal(userExpressions[1]?.startsWith("await (async()=>{"), true);
});

test("executeCell appends intentional log section for single bridge call", async () => {
  let callIndex = 0;
  const connection = createFakeConnection(async (_expression) => {
    callIndex += 1;
    if (callIndex === 1) {
      return {
        result: {
          type: "string",
          value: "__jbkRuntilmeCellBridge:test-1",
        },
      } as never;
    }

    if (callIndex === 3) {
      return {
        result: {
          type: "object",
          subtype: "array",
          value: ["first log"],
        },
      } as never;
    }

    return {
      result: {
        type: "number",
        value: 4,
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  await executeCell({
    cell: createFakeCell("$cell.log('first log'); 2 + 2", undefined, {
      jupyterBrowserKernel: { isolated: true },
    }) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 300,
    runtime,
  });

  assert.equal(execution.success, true);
  assert.equal(execution.outputs.length, 2);
  assert.equal(execution.outputs[0]?.items[0]?.value, "4");
  assert.equal(execution.outputs[1]?.items[0]?.value, "Cell logs:\nfirst log");
});

test("executeCell preserves bridge-call order in intentional log section", async () => {
  let callIndex = 0;
  const connection = createFakeConnection(async (_expression) => {
    callIndex += 1;
    if (callIndex === 1) {
      return {
        result: {
          type: "string",
          value: "__jbkRuntilmeCellBridge:test-2",
        },
      } as never;
    }

    if (callIndex === 3) {
      return {
        result: {
          type: "object",
          subtype: "array",
          value: ["first", "second", "third"],
        },
      } as never;
    }

    return {
      result: {
        type: "number",
        value: 1,
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  await executeCell({
    cell: createFakeCell(
      "$cell.log('first'); $cell.log('second'); $cell.log('third'); 1",
      undefined,
      {
        jupyterBrowserKernel: { isolated: true },
      },
    ) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 301,
    runtime,
  });

  assert.equal(execution.success, true);
  assert.equal(execution.outputs.length, 2);
  assert.equal(execution.outputs[0]?.items[0]?.value, "1");
  assert.equal(
    execution.outputs[1]?.items[0]?.value,
    "Cell logs:\nfirst\nsecond\nthird",
  );
});

test("executeCell keeps notebook intentional logs plain and mirrors intentional entries with JBK prefix", async () => {
  let callIndex = 0;
  const connection = createFakeConnection(async (_expression) => {
    callIndex += 1;
    if (callIndex === 1) {
      return {
        result: {
          type: "string",
          value: "__jbkRuntilmeCellBridge:test-prefixed-logs",
        },
      } as never;
    }

    if (callIndex === 3) {
      return {
        result: {
          type: "object",
          subtype: "array",
          value: ["first", "second"],
        },
      } as never;
    }

    return {
      result: {
        type: "number",
        value: 11,
      },
    } as never;
  });

  const mirroredIntentionalLines: string[] = [];
  const { execution, notebookExecution } = createExecutionRecorder();
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
    undefined,
    undefined,
    (line) => {
      mirroredIntentionalLines.push(line);
    },
  );

  await executeCell({
    cell: createFakeCell(
      "$cell.log('first'); $cell.log('second'); 5 + 6",
      undefined,
      {
        jupyterBrowserKernel: { isolated: true },
      },
    ) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 301,
    runtime,
  });

  assert.equal(execution.success, true);
  assert.equal(execution.outputs.length, 2);
  assert.equal(
    execution.outputs[1]?.items[0]?.value,
    "Cell logs:\nfirst\nsecond",
  );
  assert.deepEqual(mirroredIntentionalLines, ["JBK: first", "JBK: second"]);
});

test("executeCell does not mirror output-channel lines when no intentional logs were emitted", async () => {
  const connection = createFakeConnection(async () => {
    return {
      result: {
        type: "number",
        value: 8,
      },
    } as never;
  });

  const mirroredIntentionalLines: string[] = [];
  const { execution, notebookExecution } = createExecutionRecorder();
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
    undefined,
    undefined,
    (line) => {
      mirroredIntentionalLines.push(line);
    },
  );

  await executeCell({
    cell: createFakeCell("4 + 4") as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 302,
    runtime,
  });

  assert.equal(execution.success, true);
  assert.equal(execution.outputs.length, 1);
  assert.deepEqual(mirroredIntentionalLines, []);
});

test("executeCell keeps success output unchanged when no bridge call occurs", async () => {
  const connection = createFakeConnection(async () => {
    return {
      result: {
        type: "number",
        value: 8,
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  await executeCell({
    cell: createFakeCell("4 + 4") as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 302,
    runtime,
  });

  assert.equal(execution.success, true);
  assert.equal(execution.outputs.length, 1);
  assert.equal(execution.outputs[0]?.items[0]?.value, "8");
});

test("executeCell returns runtime error when $cell is used outside isolated mode", async () => {
  const connection = createFakeConnection(async () => {
    return {
      result: {
        type: "undefined",
      },
      exceptionDetails: {
        text: "Uncaught ReferenceError: $cell is not defined",
        exception: {
          className: "ReferenceError",
          description:
            "ReferenceError: $cell is not defined\n    at <anonymous>:1:1",
        },
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  await executeCell({
    cell: createFakeCell("$cell.log('first log'); 2 + 2", undefined, {
      jupyterBrowserKernel: { isolated: false },
    }) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 302,
    runtime,
  });

  assert.equal(execution.success, false);
  assert.equal(execution.outputs.length, 1);
  assert.equal(execution.outputs[0]?.items[0]?.kind, "error");

  const renderedError = execution.outputs[0]?.items[0]?.value;
  assert.ok(renderedError instanceof Error);
  assert.equal(renderedError.name, "ReferenceError");
  assert.equal(renderedError.message, "$cell is not defined");
});

test("executeCell reports bridge-unavailable failure when isolated $cell setup throws", async () => {
  let callIndex = 0;
  const connection = createFakeConnection(async () => {
    callIndex += 1;
    if (callIndex === 1) {
      throw new Error("setup failed");
    }

    return {
      result: {
        type: "number",
        value: 4,
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  await executeCell({
    cell: createFakeCell("$cell.log('first log'); 2 + 2", undefined, {
      jupyterBrowserKernel: { isolated: true },
    }) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 303,
    runtime,
  });

  assert.equal(execution.success, false);
  assert.equal(callIndex, 1);
  assert.equal(execution.outputs.length, 1);
  assert.equal(execution.outputs[0]?.items[0]?.kind, "error");

  const renderedError = execution.outputs[0]?.items[0]?.value;
  assert.ok(renderedError instanceof Error);
  assert.equal(
    renderedError.message,
    "Runtime cell bridge is unavailable for this cell run. Start a new Browser Kernel debug session and run the cell again.",
  );
});

test("executeCell treats isolated setup exceptionDetails as bridge-unavailable failure when $cell is requested", async () => {
  let callIndex = 0;
  const connection = createFakeConnection(async () => {
    callIndex += 1;
    if (callIndex === 1) {
      return {
        result: {
          type: "undefined",
        },
        exceptionDetails: {
          text: "Uncaught Error: setup exploded",
          exception: {
            className: "Error",
            description: "Error: setup exploded\n    at <anonymous>:1:1",
          },
        },
      } as never;
    }

    return {
      result: {
        type: "number",
        value: 4,
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  await executeCell({
    cell: createFakeCell("$cell.log('first log'); 2 + 2", undefined, {
      jupyterBrowserKernel: { isolated: true },
    }) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 304,
    runtime,
  });

  assert.equal(execution.success, false);
  assert.equal(callIndex, 1);
  assert.equal(execution.outputs.length, 1);
  assert.equal(execution.outputs[0]?.items[0]?.kind, "error");
});

test("executeCell writes only value output for isolated success", async () => {
  const connection = createFakeConnection(async () => {
    return {
      result: {
        type: "number",
        value: 7,
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  await executeCell({
    cell: createFakeCell("3 + 4", DEFAULT_FAKE_CELL_URI, {
      jupyterBrowserKernel: { isolated: true },
    }) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 30,
    runtime,
  });

  assert.equal(execution.success, true);
  assert.equal(execution.outputs.length, 1);
  assert.equal(execution.outputs[0]?.items.length, 1);
  assert.equal(execution.outputs[0]?.items[0]?.kind, "text");
  assert.equal(execution.outputs[0]?.items[0]?.value, "7");
});

test("executeCell writes only error output for isolated failures", async () => {
  const connection = createFakeConnection(async () => {
    return {
      result: {
        type: "undefined",
      },
      exceptionDetails: {
        text: "Uncaught TypeError: boom",
        exception: {
          className: "TypeError",
          description: "TypeError: boom\n    at <anonymous>:1:1",
        },
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  await executeCell({
    cell: createFakeCell("throw new TypeError('boom')", DEFAULT_FAKE_CELL_URI, {
      jupyterBrowserKernel: { isolated: true },
    }) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 31,
    runtime,
  });

  assert.equal(execution.success, false);
  assert.equal(execution.outputs.length, 1);
  assert.equal(execution.outputs[0]?.items.length, 1);
  assert.equal(execution.outputs[0]?.items[0]?.kind, "error");
});

test("executeCell keeps logs after error output for isolated failures", async () => {
  let callIndex = 0;
  const connection = createFakeConnection(async () => {
    callIndex += 1;
    if (callIndex === 1) {
      return {
        result: {
          type: "string",
          value: "__jbkRuntilmeCellBridge:test-logs-after-error",
        },
      } as never;
    }

    if (callIndex === 3) {
      return {
        result: {
          type: "object",
          subtype: "array",
          value: ["before boom"],
        },
      } as never;
    }

    return {
      result: {
        type: "undefined",
      },
      exceptionDetails: {
        text: "Uncaught TypeError: boom",
        exception: {
          className: "TypeError",
          description: "TypeError: boom\n    at <anonymous>:1:1",
        },
      },
    } as never;
  });

  const { execution, notebookExecution } = createExecutionRecorder();
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection,
  );

  await executeCell({
    cell: createFakeCell(
      "$cell.log('before boom'); throw new TypeError('boom')",
      DEFAULT_FAKE_CELL_URI,
      {
        jupyterBrowserKernel: { isolated: true },
      },
    ) as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 32,
    runtime,
  });

  assert.equal(execution.success, false);
  assert.equal(execution.outputs.length, 2);
  assert.equal(execution.outputs[0]?.items[0]?.kind, "error");
  assert.equal(execution.outputs[1]?.items[0]?.kind, "text");
  assert.equal(
    execution.outputs[1]?.items[0]?.value,
    "Cell logs:\nbefore boom",
  );
});

test("executeCell kernel path never invokes Debugger APIs (passive provider)", async () => {
  let debuggerEnableCalls = 0;
  const connection = {
    ...createFakeConnection(async () => {
      return {
        result: {
          type: "number",
          value: 1,
        },
      } as never;
    }),
    Debugger: {
      enable: async () => {
        debuggerEnableCalls += 1;
      },
    },
  };

  const { notebookExecution } = createExecutionRecorder();
  const runtime = createKernelRuntime(
    {
      NotebookCellOutput: FakeNotebookCellOutput as never,
      NotebookCellOutputItem: FakeNotebookCellOutputItem as never,
    },
    createLocalizeMock(),
    () => connection as never,
  );

  await executeCell({
    cell: createFakeCell("1") as never,
    controller: {
      createNotebookCellExecution: () => notebookExecution,
    } as never,
    executionOrder: 40,
    runtime,
  });

  assert.equal(debuggerEnableCalls, 0);
});

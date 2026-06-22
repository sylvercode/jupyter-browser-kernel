import test from "node:test";
import assert from "node:assert/strict";

import type { DebugProtocol } from "@vscode/debugprotocol";

import type { VariableStore } from "../../../src/debugger/variable-store.js";
import { createFakeDebuggerSession } from "../test-utils/browser-debugger-session-mock.js";
import { createFakeSessionManager } from "../test-utils/debug-session-manager-mock.js";
import { createAdapterHarness } from "../test-utils/notebook-dap-harness.js";

function createStore(): VariableStore {
  return {
    reserve: () => 1234,
    resolve: () => undefined,
    clearForPause: async () => undefined,
    dispose: async () => undefined,
  };
}

test("evaluate success path uses evaluateOnCallFrame", async () => {
  const evaluateOnCallFrameCalls: Array<{ throwOnSideEffect?: boolean }> = [];

  const pausedEvent = {
    callFrames: [
      {
        callFrameId: "cf-1",
        functionName: "fn",
        location: { scriptId: "1", lineNumber: 1, columnNumber: 0 },
        url: "vscode-notebook-cell://test/cell-a.js",
        this: { type: "undefined" },
        scopeChain: [],
      },
    ],
  };

  const manager = createFakeSessionManager({
    getDebuggerSession: () =>
      createFakeDebuggerSession({
        evaluateOnCallFrame: async (params) => {
          evaluateOnCallFrameCalls.push({
            throwOnSideEffect: params.throwOnSideEffect,
          });
          return {
            result: { type: "number", value: 99 },
          };
        },
      }),
    getVariableStore: () => createStore(),
    getPausedEvent: () => pausedEvent as never,
    getPauseVersion: () => 1,
  });

  const harness = createAdapterHarness(manager, { maxPolls: 40 });

  const stack = await harness.sendRequest("stackTrace", { threadId: 1 });
  const frameId = (stack as DebugProtocol.StackTraceResponse).body
    ?.stackFrames[0]?.id;

  const response = await harness.sendRequest("evaluate", {
    expression: "x + 1",
    frameId,
    context: "hover",
  });

  assert.equal(response.success, true);
  const body = (response as DebugProtocol.EvaluateResponse).body;
  assert.equal(body?.result, "99");
  assert.equal(body?.variablesReference, 0);
  assert.equal(evaluateOnCallFrameCalls.length, 1);
  assert.equal(evaluateOnCallFrameCalls[0]?.throwOnSideEffect, true);

  harness.adapter.dispose();
});

test("evaluate returns localized error when exceptionDetails exist", async () => {
  const manager = createFakeSessionManager({
    getDebuggerSession: () =>
      createFakeDebuggerSession({
        evaluateOnCallFrame: async () => ({
          result: { type: "undefined" },
          exceptionDetails: {
            exceptionId: 1,
            text: "boom",
            lineNumber: 0,
            columnNumber: 0,
          },
        }),
      }),
    getVariableStore: () => createStore(),
    getPausedEvent: () =>
      ({
        callFrames: [
          {
            callFrameId: "cf-1",
            functionName: "fn",
            location: { scriptId: "1", lineNumber: 1, columnNumber: 0 },
            url: "vscode-notebook-cell://test/cell-a.js",
            this: { type: "undefined" },
            scopeChain: [],
          },
        ],
      }) as never,
    getPauseVersion: () => 1,
  });

  const harness = createAdapterHarness(manager, { maxPolls: 40 });

  const stack = await harness.sendRequest("stackTrace", { threadId: 1 });
  const frameId = (stack as DebugProtocol.StackTraceResponse).body
    ?.stackFrames[0]?.id;

  const response = await harness.sendRequest("evaluate", {
    expression: "bad()",
    frameId,
    context: "watch",
  });

  const body = (response as DebugProtocol.EvaluateResponse).body;
  assert.equal(body?.result, "Evaluation failed: boom");
  assert.equal(body?.presentationHint?.kind, "error");

  harness.adapter.dispose();
});

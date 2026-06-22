import test from "node:test";
import assert from "node:assert/strict";

import type { DebugProtocol } from "@vscode/debugprotocol";

import type { DebugSessionManager } from "../../../src/debugger/debug-session-manager.js";
import { createFakeSessionManager } from "../test-utils/debug-session-manager-mock.js";
import { createAdapterHarness } from "../test-utils/notebook-dap-harness.js";

function createSessionManager(pausedEvent: unknown): DebugSessionManager {
  return createFakeSessionManager({
    getPausedEvent: () => pausedEvent as never,
    getPauseVersion: () => 1,
  });
}

test("stackTrace paginates cached paused callFrames", async () => {
  const pausedEvent = {
    callFrames: [
      {
        callFrameId: "cf-1",
        functionName: "first",
        location: { scriptId: "1", lineNumber: 4, columnNumber: 2 },
        scopeChain: [],
        this: { type: "undefined" },
        url: "vscode-notebook-cell://test/cell-a.js",
      },
      {
        callFrameId: "cf-2",
        functionName: "second",
        location: { scriptId: "1", lineNumber: 10, columnNumber: 0 },
        scopeChain: [],
        this: { type: "undefined" },
        url: "vscode-notebook-cell://test/cell-a.js",
      },
    ],
  };

  const harness = createAdapterHarness(createSessionManager(pausedEvent), {
    maxPolls: 30,
  });
  const response = await harness.sendRequest("stackTrace", {
    threadId: 1,
    startFrame: 1,
    levels: 1,
  });

  assert.equal(response.success, true);
  const body = (response as DebugProtocol.StackTraceResponse).body;
  assert.equal(body?.totalFrames, 2);
  assert.equal(body?.stackFrames.length, 1);
  assert.equal(body?.stackFrames[0]?.name, "second");
  assert.equal(body?.stackFrames[0]?.line, 11);

  harness.adapter.dispose();
});

test("stackTrace returns empty payload when no pause is cached", async () => {
  const manager = createSessionManager(undefined);
  manager.getPausedEvent = () => undefined;
  manager.getPauseVersion = () => 0;

  const harness = createAdapterHarness(manager, { maxPolls: 30 });
  const response = await harness.sendRequest("stackTrace", { threadId: 1 });

  assert.equal(response.success, true);
  const body = (response as DebugProtocol.StackTraceResponse).body;
  assert.deepEqual(body, { stackFrames: [], totalFrames: 0 });

  harness.adapter.dispose();
});

test("stackTrace resolves source from scriptId map when callFrame URL is empty on breakpoint pause", async () => {
  const pausedEvent = {
    callFrames: [
      {
        callFrameId: "cf-1",
        functionName: "",
        location: { scriptId: "1", lineNumber: 6, columnNumber: 0 },
        scopeChain: [],
        this: { type: "undefined" },
        url: "",
      },
    ],
    hitBreakpoints: ["bp-1"],
  };

  const manager = createSessionManager(pausedEvent);
  manager.getScriptUrl = (scriptId) =>
    scriptId === "1"
      ? "vscode-notebook-cell://test/cell-fallback.js"
      : undefined;

  const harness = createAdapterHarness(manager, { maxPolls: 30 });
  const response = await harness.sendRequest("stackTrace", {
    threadId: 1,
    startFrame: 0,
    levels: 1,
  });

  assert.equal(response.success, true);
  const body = (response as DebugProtocol.StackTraceResponse).body;
  assert.equal(
    body?.stackFrames[0]?.source?.path,
    "vscode-notebook-cell://test/cell-fallback.js",
  );

  harness.adapter.dispose();
});

test("stackTrace emits name-only source with no path when callFrame URL is empty and no breakpoint is bound", async () => {
  const pausedEvent = {
    callFrames: [
      {
        callFrameId: "cf-1",
        functionName: "",
        location: { scriptId: "1", lineNumber: 2, columnNumber: 0 },
        scopeChain: [],
        this: { type: "undefined" },
        url: "",
      },
    ],
    hitBreakpoints: [],
  };

  const harness = createAdapterHarness(createSessionManager(pausedEvent), {
    maxPolls: 30,
  });
  const response = await harness.sendRequest("stackTrace", {
    threadId: 1,
    startFrame: 0,
    levels: 1,
  });

  assert.equal(response.success, true);
  const body = (response as DebugProtocol.StackTraceResponse).body;
  assert.equal(body?.stackFrames[0]?.source, undefined);

  harness.adapter.dispose();
});

test("stackTrace resolves source from scriptId map when callFrame URL is empty and no breakpoint is bound", async () => {
  const pausedEvent = {
    callFrames: [
      {
        callFrameId: "cf-1",
        functionName: "addOne",
        location: { scriptId: "40", lineNumber: 2, columnNumber: 18 },
        scopeChain: [],
        this: { type: "undefined" },
        url: "",
      },
    ],
    hitBreakpoints: [],
  };

  const manager = createSessionManager(pausedEvent);
  manager.getScriptUrl = (scriptId) =>
    scriptId === "40"
      ? "vscode-notebook-cell://test/test2.ipynb#W0"
      : undefined;

  const harness = createAdapterHarness(manager, { maxPolls: 30 });
  const response = await harness.sendRequest("stackTrace", {
    threadId: 1,
    startFrame: 0,
    levels: 1,
  });

  assert.equal(response.success, true);
  const body = (response as DebugProtocol.StackTraceResponse).body;
  assert.equal(
    body?.stackFrames[0]?.source?.path,
    "vscode-notebook-cell://test/test2.ipynb#W0",
  );

  harness.adapter.dispose();
});

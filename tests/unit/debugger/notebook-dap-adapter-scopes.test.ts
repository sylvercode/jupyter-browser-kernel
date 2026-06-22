import test from "node:test";
import assert from "node:assert/strict";

import type { DebugProtocol } from "@vscode/debugprotocol";

import type { VariableStore } from "../../../src/debugger/variable-store.js";
import { createFakeDebuggerSession } from "../test-utils/browser-debugger-session-mock.js";
import { createFakeSessionManager } from "../test-utils/debug-session-manager-mock.js";
import { createAdapterHarness } from "../test-utils/notebook-dap-harness.js";

test("scopes maps scopeChain entries and appends global scope", async () => {
  const reserved: Array<{ objectId: string }> = [];
  let nextReference = 1000;

  const variableStore: VariableStore = {
    reserve: (entry) => {
      reserved.push({ objectId: entry.objectId });
      const value = nextReference;
      nextReference += 1;
      return value;
    },
    resolve: () => undefined,
    clearForPause: async () => undefined,
    dispose: async () => undefined,
  };

  const pausedEvent = {
    callFrames: [
      {
        callFrameId: "cf-1",
        functionName: "fn",
        location: { scriptId: "1", lineNumber: 1, columnNumber: 0 },
        url: "vscode-notebook-cell://test/cell-a.js",
        this: { type: "undefined" },
        scopeChain: [
          {
            type: "local",
            object: { type: "object", objectId: "local-obj" },
          },
          {
            type: "block",
            object: { type: "object", objectId: "block-obj" },
          },
        ],
      },
    ],
  };

  const manager = createFakeSessionManager({
    getDebuggerSession: () =>
      createFakeDebuggerSession({
        evaluate: async () => ({
          result: {
            type: "object",
            objectId: "global-obj",
            description: "Window",
          },
        }),
      }),
    getPausedEvent: () => pausedEvent as never,
    getPauseVersion: () => 1,
    getVariableStore: () => variableStore,
  });

  const harness = createAdapterHarness(manager, { maxPolls: 40 });

  const stack = await harness.sendRequest("stackTrace", { threadId: 1 });
  const frameId = (stack as DebugProtocol.StackTraceResponse).body
    ?.stackFrames[0]?.id;
  assert.equal(typeof frameId, "number");

  const response = await harness.sendRequest("scopes", {
    frameId,
  });

  assert.equal(response.success, true);
  const scopes = (response as DebugProtocol.ScopesResponse).body?.scopes ?? [];
  assert.equal(scopes.length, 3);
  assert.equal(scopes[0]?.name, "Local");
  assert.equal(scopes[1]?.name, "Block");
  assert.equal(scopes[2]?.name, "Global");
  assert.equal(scopes[2]?.expensive, true);
  assert.deepEqual(
    reserved.map((entry) => entry.objectId),
    ["local-obj", "block-obj", "global-obj"],
  );

  harness.adapter.dispose();
});

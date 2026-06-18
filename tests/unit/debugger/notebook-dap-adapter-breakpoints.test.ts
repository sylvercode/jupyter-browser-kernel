import test from "node:test";
import assert from "node:assert/strict";

import type { DebugProtocol } from "@vscode/debugprotocol";

import type { DebugSessionManager } from "../../../src/debugger/debug-session-manager.js";
import type {
  BreakpointRegistry,
  BoundBreakpoint,
  DesiredBreakpoint,
} from "../../../src/debugger/breakpoint-registry.js";
import { createFakeSessionManager } from "../test-utils/debug-session-manager-mock.js";
import { createAdapterHarness } from "../test-utils/notebook-dap-harness.js";

interface ManagerState {
  recorded: Array<{ url: string; desired: DesiredBreakpoint[] }>;
}

function createSessionManager(
  state: ManagerState,
  registry: BreakpointRegistry | undefined,
): DebugSessionManager {
  return createFakeSessionManager({
    getBreakpointRegistry: () => registry,
    recordSetBreakpoints: (url, desired) => {
      state.recorded.push({ url, desired });
    },
  });
}

function createRegistry(
  onReplace: (
    url: string,
    desired: DesiredBreakpoint[],
  ) => Promise<BoundBreakpoint[]>,
): BreakpointRegistry {
  return {
    replace: onReplace,
    getUrlForBreakpointId: () => undefined,
    resolveRuntimeBreakpoint: () => undefined,
    clear: async () => undefined,
    clearAll: async () => undefined,
  };
}

test("setBreakpoints resolves notebook URI from source.path", async () => {
  const state: ManagerState = { recorded: [] };
  const captured: Array<{ url: string; desired: DesiredBreakpoint[] }> = [];

  const registry = createRegistry(async (url, desired) => {
    captured.push({ url, desired });
    return desired.map((entry, index) => ({
      breakpointId: `bp-${index + 1}`,
      line: entry.line,
      column: entry.column,
      condition: entry.condition,
      locations: [
        { scriptId: "1", lineNumber: entry.line - 1, columnNumber: 0 },
      ],
      verified: true,
    }));
  });

  const harness = createAdapterHarness(createSessionManager(state, registry), {
    maxPolls: 30,
  });

  const response = await harness.sendRequest("setBreakpoints", {
    source: {
      path: "vscode-notebook-cell://test/cell-1.js",
      name: "Cell 1",
    },
    breakpoints: [{ line: 2 }],
  });

  assert.equal(response.success, true);
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.url, "vscode-notebook-cell://test/cell-1.js");

  harness.adapter.dispose();
});

test("setBreakpoints returns unverified entries when debug session is not active", async () => {
  const state: ManagerState = { recorded: [] };
  const harness = createAdapterHarness(createSessionManager(state, undefined), {
    maxPolls: 30,
  });

  const response = await harness.sendRequest("setBreakpoints", {
    source: {
      path: "vscode-notebook-cell://test/cell-2.js",
      name: "Cell 2",
    },
    breakpoints: [{ line: 3 }, { line: 4 }],
  });

  assert.equal(response.success, true);
  const body = (response as DebugProtocol.SetBreakpointsResponse).body;
  assert.equal(body?.breakpoints.length, 2);
  assert.equal(
    body?.breakpoints.every((bp) => bp.verified === false),
    true,
  );
  assert.equal(
    body?.breakpoints.every(
      (bp) =>
        bp.message === "Debug session not active; breakpoint will be retried.",
    ),
    true,
  );
  assert.equal(state.recorded.length, 1);
  assert.equal(state.recorded[0]?.url, "vscode-notebook-cell://test/cell-2.js");

  harness.adapter.dispose();
});

test("setBreakpoints forwards conditional expressions to registry", async () => {
  const state: ManagerState = { recorded: [] };
  let forwarded: DesiredBreakpoint[] = [];

  const registry = createRegistry(async (_url, desired) => {
    forwarded = desired;
    return desired.map((entry, index) => ({
      breakpointId: `bp-${index + 1}`,
      line: entry.line,
      column: entry.column,
      condition: entry.condition,
      locations: [
        { scriptId: "1", lineNumber: entry.line - 1, columnNumber: 0 },
      ],
      verified: true,
    }));
  });

  const harness = createAdapterHarness(createSessionManager(state, registry), {
    maxPolls: 30,
  });

  const response = await harness.sendRequest("setBreakpoints", {
    source: {
      path: "vscode-notebook-cell://test/cell-3.js",
      name: "Cell 3",
    },
    breakpoints: [{ line: 6, condition: "x > 3" }],
  });

  assert.equal(response.success, true);
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0]?.condition, "x > 3");

  harness.adapter.dispose();
});

test("logpoint entries report deferred-support info message", async () => {
  const state: ManagerState = { recorded: [] };

  const registry = createRegistry(async (_url, desired) => {
    return desired.map((entry, index) => ({
      breakpointId: `bp-${index + 1}`,
      line: entry.line,
      column: entry.column,
      condition: entry.condition,
      locations: [
        { scriptId: "1", lineNumber: entry.line - 1, columnNumber: 0 },
      ],
      verified: true,
    }));
  });

  const harness = createAdapterHarness(createSessionManager(state, registry), {
    maxPolls: 30,
  });

  const response = await harness.sendRequest("setBreakpoints", {
    source: {
      path: "vscode-notebook-cell://test/cell-4.js",
      name: "Cell 4",
    },
    breakpoints: [{ line: 8, logMessage: "{x}" }],
  });

  assert.equal(response.success, true);
  const body = (response as DebugProtocol.SetBreakpointsResponse).body;
  assert.equal(
    body?.breakpoints[0]?.message,
    "Logpoints and hit-count breakpoints are not yet supported by the Browser Kernel debugger; binding as unconditional.",
  );

  harness.adapter.dispose();
});

test("initialize capability snapshot includes breakpoint flags", async () => {
  const state: ManagerState = { recorded: [] };
  const harness = createAdapterHarness(createSessionManager(state, undefined), {
    maxPolls: 30,
  });

  const response = await harness.sendRequest("initialize", {
    adapterID: "jupyter-browser-kernel",
    pathFormat: "path",
  });

  assert.equal(response.success, true);
  const body = (response as DebugProtocol.InitializeResponse).body;

  assert.deepEqual(body, {
    supportsBreakpointLocationsRequest: true,
    supportsConfigurationDoneRequest: true,
    supportsTerminateRequest: true,
    supportTerminateDebuggee: false,
    supportsEvaluateForHovers: true,
    supportsConditionalBreakpoints: true,
    supportsHitConditionalBreakpoints: false,
    supportsLogPoints: false,
  });

  harness.adapter.dispose();
});

test("adapter emits breakpoint changed event when manager reports runtime resolution", () => {
  const state: ManagerState = { recorded: [] };
  let breakpointResolvedListener:
    | ((event: {
        url: string;
        breakpointId: string;
        line: number;
        column?: number;
      }) => void)
    | undefined;

  const manager = createSessionManager(state, undefined);
  manager.onDidBreakpointResolved = (listener) => {
    breakpointResolvedListener = listener;
    return { dispose: () => undefined };
  };

  const harness = createAdapterHarness(manager, { maxPolls: 30 });

  breakpointResolvedListener?.({
    url: "vscode-notebook-cell://test/cell-5.js",
    breakpointId: "bp-12",
    line: 10,
    column: 1,
  });

  const changedEvents = harness.sentMessages.filter(
    (message) =>
      message.type === "event" &&
      (message as DebugProtocol.Event).event === "breakpoint",
  ) as DebugProtocol.Event[];

  assert.equal(changedEvents.length, 1);
  const body =
    (changedEvents[0]?.body as DebugProtocol.BreakpointEvent["body"]) ??
    undefined;
  assert.equal(body?.reason, "changed");
  assert.equal(body?.breakpoint?.verified, true);
  assert.equal(body?.breakpoint?.line, 10);
  assert.equal(
    body?.breakpoint?.source?.path,
    "vscode-notebook-cell://test/cell-5.js",
  );

  harness.adapter.dispose();
});

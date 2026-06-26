/**
 * Coexistence-focused unit tests for NotebookDebugAdapter (Story 10.5).
 *
 * These tests verify the properties that keep the DAP adapter from interfering
 * with other CDP clients (e.g., browser DevTools) sharing the same browser-level
 * WebSocket:
 *
 *   - The adapter's event subscriptions are released exactly once on dispose.
 *   - dispose() does NOT call client.close() — only the manager is disposed.
 *   - Connection-lost produces exactly one TerminatedEvent.
 *   - Rapid step commands each call their matching DebugSessionManager method
 *     exactly once and emit ContinuedEvent(allThreadsContinued=true).
 *   - Breakpoints are routed through the BreakpointRegistry, not direct CDP.
 *   - Step sequence calls the correct DebugSessionManager counterparts.
 *   - Resume consistency: ContinuedEvent reflects allThreadsContinued.
 *   - Connection-loss at any lifecycle stage does not leave orphan events.
 */
import test from "node:test";
import assert from "node:assert/strict";

import type { DebugProtocol } from "@vscode/debugprotocol";

import type { BreakpointRegistry } from "../../../src/debugger/breakpoint-registry.js";
import { createFakeSessionManager } from "../test-utils/debug-session-manager-mock.js";
import { createAdapterHarness } from "../test-utils/notebook-dap-harness.js";
import { createFakeDebuggerSession } from "../test-utils/browser-debugger-session-mock.js";
import { createFakeVariableStore } from "../test-utils/variable-store-mock.js";

// ── Task 12 / Subscription lifecycle ─────────────────────────────────────────

test("dispose releases onPaused subscription exactly once even when called twice", () => {
  let disposeCount = 0;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      onDidPaused: (_listener) => ({
        dispose: () => {
          disposeCount += 1;
        },
      }),
    }),
  );

  harness.adapter.dispose();
  harness.adapter.dispose(); // second call must be a no-op

  assert.equal(
    disposeCount,
    1,
    "onPaused subscription must be disposed exactly once",
  );
});

test("dispose calls manager.dispose exactly once even when adapter.dispose is called twice", () => {
  let managerDisposeCalls = 0;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      dispose: () => {
        managerDisposeCalls += 1;
      },
    }),
  );

  harness.adapter.dispose();
  harness.adapter.dispose(); // second call must be a no-op

  assert.equal(
    managerDisposeCalls,
    1,
    "manager.dispose must be called exactly once",
  );
});

test("dispose releases all three subscriptions (terminate, paused, breakpointResolved) exactly once each", () => {
  let terminateDisposals = 0;
  let pausedDisposals = 0;
  let breakpointResolvedDisposals = 0;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      onDidTerminate: (_listener) => ({
        dispose: () => {
          terminateDisposals += 1;
        },
      }),
      onDidPaused: (_listener) => ({
        dispose: () => {
          pausedDisposals += 1;
        },
      }),
      onDidBreakpointResolved: (_listener) => ({
        dispose: () => {
          breakpointResolvedDisposals += 1;
        },
      }),
    }),
  );

  harness.adapter.dispose();

  assert.equal(
    terminateDisposals,
    1,
    "onDidTerminate subscription must be disposed once",
  );
  assert.equal(
    pausedDisposals,
    1,
    "onDidPaused subscription must be disposed once",
  );
  assert.equal(
    breakpointResolvedDisposals,
    1,
    "onDidBreakpointResolved subscription must be disposed once",
  );
});

// ── Task 12 / Connection-loss ─────────────────────────────────────────────────

test("connection-lost emits single TerminatedEvent without restart payload", () => {
  let terminationListener: ((reason: "connection-lost") => void) | undefined;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      onDidTerminate: (listener) => {
        terminationListener = listener;
        return { dispose: () => undefined };
      },
    }),
  );

  assert.ok(
    terminationListener !== undefined,
    "adapter must register a termination listener on construction",
  );
  terminationListener?.("connection-lost");

  const terminatedEvents = harness.sentMessages.filter(
    (m) =>
      m.type === "event" && (m as DebugProtocol.Event).event === "terminated",
  ) as DebugProtocol.TerminatedEvent[];

  assert.equal(
    terminatedEvents.length,
    1,
    "exactly one TerminatedEvent must be emitted",
  );

  assert.equal(
    terminatedEvents[0]?.body?.restart,
    undefined,
    "TerminatedEvent should not request restart on connection loss",
  );

  harness.adapter.dispose();
});

test("connection-lost followed by dispose emits only one TerminatedEvent (no duplicate)", () => {
  let terminationListener: ((reason: "connection-lost") => void) | undefined;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      onDidTerminate: (listener) => {
        terminationListener = listener;
        return { dispose: () => undefined };
      },
    }),
  );

  terminationListener?.("connection-lost");
  harness.adapter.dispose();

  const terminatedEvents = harness.sentMessages.filter(
    (m) =>
      m.type === "event" && (m as DebugProtocol.Event).event === "terminated",
  );

  assert.equal(
    terminatedEvents.length,
    1,
    "connection-lost + dispose must produce exactly one TerminatedEvent",
  );
});

// ── Task 12 / Rapid command ordering ─────────────────────────────────────────

test("rapid next+next+continue each call matching DebugSessionManager method exactly once", async () => {
  let stepOverCalls = 0;
  let resumeCalls = 0;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      stepOver: async () => {
        stepOverCalls += 1;
      },
      resume: async () => {
        resumeCalls += 1;
      },
    }),
    { maxPolls: 40 },
  );

  const [resp1, resp2, resp3] = await Promise.all([
    harness.sendRequest("next", { threadId: 1 }),
    harness.sendRequest("next", { threadId: 1 }),
    harness.sendRequest("continue", { threadId: 1 }),
  ]);

  assert.equal(resp1?.success, true);
  assert.equal(resp2?.success, true);
  assert.equal(resp3?.success, true);
  assert.equal(stepOverCalls, 2, "stepOver must be called exactly twice");
  assert.equal(resumeCalls, 1, "resume must be called exactly once");

  const continuedEvents = harness.sentMessages.filter(
    (m) =>
      m.type === "event" && (m as DebugProtocol.Event).event === "continued",
  ) as DebugProtocol.ContinuedEvent[];

  assert.equal(
    continuedEvents.length,
    3,
    "each step/continue must emit exactly one ContinuedEvent",
  );
  for (const event of continuedEvents) {
    assert.equal(
      event.body?.allThreadsContinued,
      true,
      "ContinuedEvent must set allThreadsContinued=true",
    );
    assert.equal(
      event.body?.threadId,
      1,
      "ContinuedEvent must reference thread 1",
    );
  }

  harness.adapter.dispose();
});

test("rapid stepping: ten sequential next commands each call stepOver exactly once and emit ten ContinuedEvents", async () => {
  const stepCommandCount = 10;
  let stepOverCalls = 0;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      stepOver: async () => {
        stepOverCalls += 1;
      },
    }),
    { maxPolls: 80 },
  );

  const responses = await Promise.all(
    Array.from({ length: stepCommandCount }, () =>
      harness.sendRequest("next", { threadId: 1 }),
    ),
  );

  for (const response of responses) {
    assert.equal(response?.success, true, "every next request must succeed");
  }

  assert.equal(
    stepOverCalls,
    stepCommandCount,
    "stepOver must be called exactly once per next command (no lost or duplicated commands)",
  );

  const continuedEvents = harness.sentMessages.filter(
    (m) =>
      m.type === "event" && (m as DebugProtocol.Event).event === "continued",
  ) as DebugProtocol.ContinuedEvent[];

  assert.equal(
    continuedEvents.length,
    stepCommandCount,
    "each next command must emit exactly one ContinuedEvent, no duplicates",
  );
  for (const event of continuedEvents) {
    assert.equal(
      event.body?.allThreadsContinued,
      true,
      "ContinuedEvent must set allThreadsContinued=true",
    );
    assert.equal(
      event.body?.threadId,
      1,
      "ContinuedEvent must reference thread 1",
    );
  }

  harness.adapter.dispose();
});

// ── Task 3 / Breakpoint state consistency via mock registry ───────────────────

test("setBreakpoints routes through BreakpointRegistry (not direct CDP)", async () => {
  let registryReplaceCalls = 0;
  let capturedUrl: string | undefined;
  let capturedDesiredCount = 0;

  const fakeRegistry: BreakpointRegistry = {
    replace: async (url, desired) => {
      registryReplaceCalls += 1;
      capturedUrl = url;
      capturedDesiredCount = desired.length;
      return desired.map((d) => ({
        breakpointId: "bp-coexist",
        line: d.line,
        verified: true,
        locations: [],
      }));
    },
    getUrlForBreakpointId: () => undefined,
    resolveRuntimeBreakpoint: () => undefined,
    clear: async () => undefined,
    clearAll: async () => undefined,
  };

  const harness = createAdapterHarness(
    createFakeSessionManager({
      getBreakpointRegistry: () => fakeRegistry,
      recordSetBreakpoints: () => undefined,
    }),
    { maxPolls: 20 },
  );

  const cellUrl = "vscode-notebook-cell://test/coexist-bp.js";
  const response = await harness.sendRequest("setBreakpoints", {
    source: { path: cellUrl, name: "coexist-bp.js" },
    breakpoints: [{ line: 3 }, { line: 7 }],
  });

  assert.equal(response.success, true, "setBreakpoints must succeed");
  assert.equal(
    registryReplaceCalls,
    1,
    "registry.replace must be called exactly once per setBreakpoints request",
  );
  assert.equal(
    capturedUrl,
    cellUrl,
    "registry.replace must receive the correct source URL",
  );
  assert.equal(
    capturedDesiredCount,
    2,
    "registry.replace must receive all requested breakpoints",
  );

  const bpResponse = response as DebugProtocol.SetBreakpointsResponse;
  assert.equal(
    bpResponse.body?.breakpoints.length,
    2,
    "response must include one entry per requested breakpoint",
  );
  assert.equal(
    bpResponse.body?.breakpoints[0]?.verified,
    true,
    "breakpoints returned as verified by the registry must be marked verified",
  );

  harness.adapter.dispose();
});

// ── Task 4 / Stepping with dual clients (mock) ────────────────────────────────

test("step sequence next→stepIn→stepOut each calls the correct DebugSessionManager method exactly once", async () => {
  let stepOverCalls = 0;
  let stepIntoCalls = 0;
  let stepOutCalls = 0;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      stepOver: async () => {
        stepOverCalls += 1;
      },
      stepInto: async () => {
        stepIntoCalls += 1;
      },
      stepOut: async () => {
        stepOutCalls += 1;
      },
    }),
    { maxPolls: 20 },
  );

  await harness.sendRequest("next", { threadId: 1 });
  await harness.sendRequest("stepIn", { threadId: 1 });
  await harness.sendRequest("stepOut", { threadId: 1 });

  assert.equal(stepOverCalls, 1, "next must call stepOver exactly once");
  assert.equal(stepIntoCalls, 1, "stepIn must call stepInto exactly once");
  assert.equal(stepOutCalls, 1, "stepOut must call stepOut exactly once");

  const continuedEvents = harness.sentMessages.filter(
    (m) =>
      m.type === "event" && (m as DebugProtocol.Event).event === "continued",
  );

  assert.equal(
    continuedEvents.length,
    3,
    "each step command must emit exactly one ContinuedEvent",
  );

  harness.adapter.dispose();
});

// ── Task 5 / Resume consistency ───────────────────────────────────────────────

test("continue emits ContinuedEvent with allThreadsContinued=true and matching thread", async () => {
  const harness = createAdapterHarness(
    createFakeSessionManager({ resume: async () => undefined }),
    { maxPolls: 20 },
  );

  const response = await harness.sendRequest("continue", { threadId: 1 });

  assert.equal(response.success, true);
  assert.equal(
    (response as DebugProtocol.ContinueResponse).body?.allThreadsContinued,
    true,
    "ContinueResponse body must report allThreadsContinued=true",
  );

  const continuedEvents = harness.sentMessages.filter(
    (m) =>
      m.type === "event" && (m as DebugProtocol.Event).event === "continued",
  ) as DebugProtocol.ContinuedEvent[];

  assert.equal(
    continuedEvents.length,
    1,
    "exactly one ContinuedEvent must be emitted",
  );
  assert.equal(continuedEvents[0]?.body?.allThreadsContinued, true);
  assert.equal(continuedEvents[0]?.body?.threadId, 1);

  harness.adapter.dispose();
});

// ── Task 6 / Connection-loss handling ────────────────────────────────────────

test("pause followed by connection-loss yields one StoppedEvent then one TerminatedEvent, no duplicate", () => {
  let terminationListener: ((reason: "connection-lost") => void) | undefined;
  let pausedListener:
    | ((event: {
        reason: string;
        callFrames: unknown[];
        hitBreakpoints?: string[];
      }) => void)
    | undefined;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      onDidTerminate: (listener) => {
        terminationListener = listener;
        return { dispose: () => undefined };
      },
      onDidPaused: (listener) => {
        pausedListener = listener as typeof pausedListener;
        return { dispose: () => undefined };
      },
    }),
  );

  // Simulate a breakpoint hit
  pausedListener?.({
    reason: "other",
    callFrames: [],
    hitBreakpoints: ["bp-1"],
  });

  // Simulate connection loss immediately after
  terminationListener?.("connection-lost");

  const stoppedEvents = harness.sentMessages.filter(
    (m) => m.type === "event" && (m as DebugProtocol.Event).event === "stopped",
  );
  const terminatedEvents = harness.sentMessages.filter(
    (m) =>
      m.type === "event" && (m as DebugProtocol.Event).event === "terminated",
  );

  assert.equal(
    stoppedEvents.length,
    1,
    "breakpoint hit must produce exactly one stopped event",
  );
  assert.equal(
    terminatedEvents.length,
    1,
    "connection-loss must produce exactly one terminated event",
  );

  harness.adapter.dispose();
});

test("connection-loss while stepping does not produce duplicate ContinuedEvents", async () => {
  let terminationListener: ((reason: "connection-lost") => void) | undefined;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      onDidTerminate: (listener) => {
        terminationListener = listener;
        return { dispose: () => undefined };
      },
      stepOver: async () => undefined,
    }),
    { maxPolls: 20 },
  );

  // Step, then simulate connection loss
  const nextResponse = await harness.sendRequest("next", { threadId: 1 });
  assert.equal(nextResponse.success, true);

  terminationListener?.("connection-lost");

  const continuedEvents = harness.sentMessages.filter(
    (m) =>
      m.type === "event" && (m as DebugProtocol.Event).event === "continued",
  );
  const terminatedEvents = harness.sentMessages.filter(
    (m) =>
      m.type === "event" && (m as DebugProtocol.Event).event === "terminated",
  );

  assert.equal(
    continuedEvents.length,
    1,
    "exactly one ContinuedEvent must be emitted for the step",
  );
  assert.equal(
    terminatedEvents.length,
    1,
    "connection-lost must produce exactly one TerminatedEvent after stepping",
  );

  harness.adapter.dispose();
});

test("connection-loss while variables are being resolved yields one TerminatedEvent and one graceful variables response", async () => {
  let terminationListener: ((reason: "connection-lost") => void) | undefined;

  // Deferred getProperties so the variables request is in flight when the
  // connection is lost. resolveGetProperties is called only after the
  // termination event is fired.
  let resolveGetProperties: (() => void) | undefined;
  const getPropertiesGate = new Promise<void>((resolve) => {
    resolveGetProperties = resolve;
  });

  const variableStore = createFakeVariableStore({
    resolve: () => ({ objectId: "obj-1", kind: "scope" }),
  });

  const debuggerSession = createFakeDebuggerSession({
    getProperties: async () => {
      await getPropertiesGate;
      return { result: [] };
    },
  });

  const harness = createAdapterHarness(
    createFakeSessionManager({
      onDidTerminate: (listener) => {
        terminationListener = listener;
        return { dispose: () => undefined };
      },
      getVariableStore: () => variableStore,
      getDebuggerSession: () => debuggerSession,
    }),
    { maxPolls: 80 },
  );

  // Issue a variables request that blocks inside getProperties.
  const variablesPromise = harness.sendRequest("variables", {
    variablesReference: 1,
  });

  // Lose the connection while the request is still pending.
  terminationListener?.("connection-lost");

  // Now let the in-flight getProperties resolve; the adapter must finish the
  // request gracefully without crashing or emitting a second TerminatedEvent.
  resolveGetProperties?.();
  const variablesResponse = await variablesPromise;

  assert.equal(
    variablesResponse.success,
    true,
    "in-flight variables request must still resolve gracefully after connection loss",
  );

  const variablesResponses = harness.sentMessages.filter(
    (m) =>
      m.type === "response" &&
      (m as DebugProtocol.Response).command === "variables",
  );
  assert.equal(
    variablesResponses.length,
    1,
    "exactly one variables response must be sent (no duplicate)",
  );

  const terminatedEvents = harness.sentMessages.filter(
    (m) =>
      m.type === "event" && (m as DebugProtocol.Event).event === "terminated",
  );
  assert.equal(
    terminatedEvents.length,
    1,
    "connection-loss during variable resolution must produce exactly one TerminatedEvent",
  );

  harness.adapter.dispose();
});

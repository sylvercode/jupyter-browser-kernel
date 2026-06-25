import test from "node:test";
import assert from "node:assert/strict";

import { createDebugSessionManager } from "../../../src/debugger/debug-session-manager.js";
import type { DesiredBreakpoint } from "../../../src/debugger/breakpoint-registry.js";
import { createConnectionStateStore } from "../../../src/transport/connection-state.js";
import type { BrowserDebuggerSession } from "../../../src/transport/browser-connect.js";
import { createFakeDebuggerSession } from "../test-utils/browser-debugger-session-mock.js";

interface FakeSessionState {
  sequence: string[];
  pauseListener?: (event: unknown) => void;
  breakpointResolvedListener?: (event: {
    breakpointId: string;
    location: { lineNumber: number; columnNumber?: number; scriptId: string };
  }) => void;
  failEnable: boolean;
  setBreakpointCalls: Array<{
    url?: string;
    lineNumber: number;
    columnNumber?: number;
    condition?: string;
  }>;
  removeBreakpointCalls: string[];
}

function createState(overrides?: Partial<FakeSessionState>): FakeSessionState {
  return {
    sequence: [],
    failEnable: false,
    setBreakpointCalls: [],
    removeBreakpointCalls: [],
    ...overrides,
  };
}

function createStateTrackingSession(
  state: FakeSessionState,
): BrowserDebuggerSession {
  return createFakeDebuggerSession({
    enable: async () => {
      state.sequence.push("enable");
      if (state.failEnable) {
        throw new Error("enable failed");
      }
    },
    disable: async () => {
      state.sequence.push("disable");
    },
    setBreakpointByUrl: async (params) => {
      state.sequence.push("setBreakpointByUrl");
      state.setBreakpointCalls.push({
        url: params.url,
        lineNumber: params.lineNumber,
        columnNumber: params.columnNumber,
        condition: params.condition,
      });

      return {
        breakpointId: `bp-${state.setBreakpointCalls.length}`,
        locations: [
          {
            scriptId: "1",
            lineNumber: params.lineNumber,
            columnNumber: params.columnNumber ?? 0,
          },
        ],
      };
    },
    removeBreakpoint: async ({ breakpointId }) => {
      state.sequence.push("removeBreakpoint");
      state.removeBreakpointCalls.push(breakpointId);
    },
    onPaused: (listener) => {
      state.sequence.push("onPaused");
      state.pauseListener = listener as (event: unknown) => void;
      return {
        dispose: () => {
          state.sequence.push("disposePaused");
          state.pauseListener = undefined;
        },
      };
    },
    onResumed: (listener) => {
      state.sequence.push("onResumed");
      return {
        dispose: () => {
          state.sequence.push("disposeResumed");
          void listener;
        },
      };
    },
    onBreakpointResolved: (listener) => {
      state.sequence.push("onBreakpointResolved");
      state.breakpointResolvedListener = listener as (event: {
        breakpointId: string;
        location: {
          lineNumber: number;
          columnNumber?: number;
          scriptId: string;
        };
      }) => void;
      return {
        dispose: () => {
          state.sequence.push("disposeBreakpointResolved");
          state.breakpointResolvedListener = undefined;
        },
      };
    },
  });
}

test("launch enables debugger and subscribes paused listener", async () => {
  createConnectionStateStore();

  const state = createState();

  const manager = createDebugSessionManager({
    getDebuggerSession: () => createStateTrackingSession(state),
    logger: () => undefined,
  });

  await manager.launch();

  assert.deepEqual(state.sequence, [
    "enable",
    "onPaused",
    "onBreakpointResolved",
  ]);

  manager.dispose();
});

test("launch calls ensureConnection before enabling debugger when no session exists", async () => {
  createConnectionStateStore();

  const state = createState();
  let connected = false;

  const manager = createDebugSessionManager({
    getDebuggerSession: () =>
      connected ? createStateTrackingSession(state) : undefined,
    ensureConnection: async () => {
      state.sequence.push("ensureConnection");
      connected = true;
    },
    logger: () => undefined,
  });

  await manager.launch();

  assert.deepEqual(state.sequence, [
    "ensureConnection",
    "enable",
    "onPaused",
    "onBreakpointResolved",
  ]);

  manager.dispose();
});

test("launch propagates ensureConnection rejection and does not mark session running", async () => {
  createConnectionStateStore();

  let ensureCalls = 0;
  const manager = createDebugSessionManager({
    getDebuggerSession: () => undefined,
    ensureConnection: async () => {
      ensureCalls += 1;
      throw new Error("connect-on-launch failed");
    },
    logger: () => undefined,
  });

  await assert.rejects(async () => {
    await manager.launch();
  }, /connect-on-launch failed/);

  await assert.rejects(async () => {
    await manager.launch();
  }, /connect-on-launch failed/);

  assert.equal(ensureCalls, 2);
  assert.equal(manager.getDebuggerSession(), undefined);

  manager.dispose();
});

test("launch without ensureConnection keeps connect-first fallback error", async () => {
  createConnectionStateStore();

  const manager = createDebugSessionManager({
    getDebuggerSession: () => undefined,
    logger: () => undefined,
  });

  await assert.rejects(async () => {
    await manager.launch();
  }, /Cannot start debug session: connect to a browser target first\./);

  manager.dispose();
});

test("launch invokes ensureConnection even when getDebuggerSession returns a session", async () => {
  createConnectionStateStore();

  const state = createState();
  let ensureCalls = 0;

  const manager = createDebugSessionManager({
    getDebuggerSession: () => createStateTrackingSession(state),
    ensureConnection: async () => {
      ensureCalls += 1;
      throw new Error("single-active guard");
    },
    logger: () => undefined,
  });

  await assert.rejects(async () => {
    await manager.launch();
  }, /single-active guard/);

  assert.equal(ensureCalls, 1);
  assert.deepEqual(state.sequence, []);

  manager.dispose();
});

test("terminate clears registry before disabling debugger", async () => {
  createConnectionStateStore();

  const state = createState();

  const manager = createDebugSessionManager({
    getDebuggerSession: () => createStateTrackingSession(state),
    logger: () => undefined,
  });

  const desired: DesiredBreakpoint[] = [
    {
      line: 3,
      condition: "x > 1",
    },
  ];
  manager.recordSetBreakpoints(
    "vscode-notebook-cell://test/cell-1.js",
    desired,
  );

  await manager.launch();
  await manager.terminate();

  assert.deepEqual(state.sequence, [
    "enable",
    "onPaused",
    "onBreakpointResolved",
    "setBreakpointByUrl",
    "disposePaused",
    "disposeBreakpointResolved",
    "removeBreakpoint",
    "disable",
  ]);
  assert.equal(manager.getBreakpointRegistry(), undefined);

  manager.dispose();
});

test("disconnect tears down session, disconnects active connection, and resets state", async () => {
  const connectionStateStore = createConnectionStateStore();
  connectionStateStore.setState("error");
  connectionStateStore.setErrorContext({
    category: "endpoint-connectivity",
    guidance: "stale",
  });

  const state = createState();
  let disconnectCalls = 0;

  const manager = createDebugSessionManager({
    getDebuggerSession: () => createStateTrackingSession(state),
    disconnectActiveConnection: async () => {
      disconnectCalls += 1;
      state.sequence.push("disconnectActiveConnection");
    },
    connectionStateStore,
    logger: () => undefined,
  });

  manager.recordSetBreakpoints("vscode-notebook-cell://test/cell-1.js", [
    { line: 5 },
  ]);

  await manager.launch();
  await manager.disconnect();

  assert.equal(disconnectCalls, 1);
  assert.deepEqual(state.sequence, [
    "enable",
    "onPaused",
    "onBreakpointResolved",
    "setBreakpointByUrl",
    "disposePaused",
    "disposeBreakpointResolved",
    "removeBreakpoint",
    "disable",
    "disconnectActiveConnection",
  ]);
  assert.equal(connectionStateStore.getState(), "disconnected");
  assert.equal(connectionStateStore.getErrorContext(), undefined);

  manager.dispose();
});

test("terminate resets state even when disconnectActiveConnection throws", async () => {
  const connectionStateStore = createConnectionStateStore();
  connectionStateStore.setState("error");
  connectionStateStore.setErrorContext({
    category: "endpoint-connectivity",
    guidance: "stale",
  });

  const state = createState();
  let disconnectCalls = 0;

  const manager = createDebugSessionManager({
    getDebuggerSession: () => createStateTrackingSession(state),
    disconnectActiveConnection: async () => {
      disconnectCalls += 1;
      state.sequence.push("disconnectActiveConnection");
      throw new Error("disconnect failed");
    },
    connectionStateStore,
    logger: () => undefined,
  });

  await manager.launch();

  await assert.doesNotReject(async () => {
    await manager.terminate();
  });

  assert.equal(disconnectCalls, 1);
  assert.equal(connectionStateStore.getState(), "disconnected");
  assert.equal(connectionStateStore.getErrorContext(), undefined);

  manager.dispose();
});

test("disconnect is idempotent across repeated stop signals", async () => {
  const connectionStateStore = createConnectionStateStore();
  const state = createState();
  let disconnectCalls = 0;

  const manager = createDebugSessionManager({
    getDebuggerSession: () => createStateTrackingSession(state),
    disconnectActiveConnection: async () => {
      disconnectCalls += 1;
      state.sequence.push("disconnectActiveConnection");
    },
    connectionStateStore,
    logger: () => undefined,
  });

  await manager.launch();
  await manager.disconnect();
  await manager.terminate();

  assert.equal(disconnectCalls, 2);
  assert.equal(connectionStateStore.getState(), "disconnected");
  assert.equal(connectionStateStore.getErrorContext(), undefined);

  manager.dispose();
});

test("enable failure is logged and re-thrown for DAP launch path", async () => {
  createConnectionStateStore();

  const state = createState({ failEnable: true });

  const logEntries: string[] = [];

  const manager = createDebugSessionManager({
    getDebuggerSession: () => createStateTrackingSession(state),
    logger: (message, error) => {
      logEntries.push(`${message} :: ${String(error)}`);
    },
  });

  await assert.rejects(async () => {
    await manager.launch();
  }, /Failed to enable Debugger domain on browser session: enable failed/);

  assert.equal(logEntries.length, 1);
  assert.match(logEntries[0] ?? "", /Failed to enable Debugger domain/);

  manager.dispose();
});

test("connection-state disconnected transition emits terminated exactly once", async () => {
  const connectionStateStore = createConnectionStateStore();

  const state = createState();

  const manager = createDebugSessionManager({
    getDebuggerSession: () => createStateTrackingSession(state),
    logger: () => undefined,
  });

  const reasons: string[] = [];
  const subscription = manager.onDidTerminate((reason) => {
    reasons.push(reason);
  });

  await manager.launch();

  connectionStateStore.setState("disconnected");
  connectionStateStore.setState("error");

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (reasons.length > 0) {
      break;
    }
    await Promise.resolve();
  }

  assert.deepEqual(reasons, ["connection-lost"]);

  subscription.dispose();
  manager.dispose();
});

test("connection-state disconnected emits termination even if stop teardown hangs", async () => {
  const connectionStateStore = createConnectionStateStore();

  const state = createState();
  const base = createStateTrackingSession(state);
  const hangingSession: BrowserDebuggerSession = {
    ...base,
    disable: async () =>
      await new Promise<void>(() => {
        // Never resolves to simulate transport teardown hang.
      }),
  };

  const manager = createDebugSessionManager({
    getDebuggerSession: () => hangingSession,
    logger: () => undefined,
  });

  const reasons: string[] = [];
  const subscription = manager.onDidTerminate((reason) => {
    reasons.push(reason);
  });

  await manager.launch();

  connectionStateStore.setState("disconnected");

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (reasons.length > 0) {
      break;
    }
    await Promise.resolve();
  }

  assert.deepEqual(reasons, ["connection-lost"]);

  subscription.dispose();
  manager.dispose();
});

test("connection lost during enable rejects launch and disables session without leaving running state", async () => {
  const connectionStateStore = createConnectionStateStore();

  const state = createState();

  const baseSession = createStateTrackingSession(state);
  let resolveEnable: (() => void) | undefined;
  const session = {
    ...baseSession,
    enable: async () => {
      state.sequence.push("enable-start");
      await new Promise<void>((resolve) => {
        resolveEnable = resolve;
      });
      state.sequence.push("enable-end");
    },
  };

  const manager = createDebugSessionManager({
    getDebuggerSession: () => session,
    logger: () => undefined,
  });

  const reasons: string[] = [];
  const subscription = manager.onDidTerminate((reason) => {
    reasons.push(reason);
  });

  const launchPromise = manager.launch();

  await Promise.resolve();
  assert.ok(resolveEnable, "enable must be awaiting");

  connectionStateStore.setState("disconnected");
  resolveEnable!();

  await assert.rejects(
    launchPromise,
    /Browser connection lost; debug session terminated\./,
  );

  assert.deepEqual(state.sequence, ["enable-start", "enable-end", "disable"]);
  assert.deepEqual(reasons, []);

  connectionStateStore.setState("disconnected");
  await Promise.resolve();
  assert.deepEqual(reasons, []);

  subscription.dispose();
  manager.dispose();
});

test("launch creates registry and replays each cached payload once", async () => {
  createConnectionStateStore();

  const state = createState();

  const manager = createDebugSessionManager({
    getDebuggerSession: () => createStateTrackingSession(state),
    logger: () => undefined,
  });

  manager.recordSetBreakpoints("vscode-notebook-cell://test/cell-a.js", [
    { line: 2 },
  ]);
  manager.recordSetBreakpoints("vscode-notebook-cell://test/cell-b.js", [
    { line: 6, condition: "flag" },
  ]);

  await manager.launch();

  assert.ok(manager.getBreakpointRegistry());
  assert.equal(state.setBreakpointCalls.length, 2);
  assert.deepEqual(
    state.setBreakpointCalls.map((call) => call.url),
    [
      "vscode-notebook-cell://test/cell-a.js",
      "vscode-notebook-cell://test/cell-b.js",
    ],
  );

  manager.dispose();
});

test("restart tears down and reconnects in deterministic order", async () => {
  createConnectionStateStore();

  const state = createState();
  let connected = true;
  let disconnectCalls = 0;
  const ensureCalls: string[] = [];

  const manager = createDebugSessionManager({
    getDebuggerSession: () =>
      connected ? createStateTrackingSession(state) : undefined,
    ensureConnection: async () => {
      ensureCalls.push("ensureConnection");
      connected = true;
    },
    disconnectActiveConnection: async () => {
      disconnectCalls += 1;
      connected = false;
      state.sequence.push("disconnectActiveConnection");
    },
    logger: () => undefined,
  });

  manager.recordSetBreakpoints("vscode-notebook-cell://test/restart-cell.js", [
    { line: 11 },
  ]);

  await manager.launch();
  await manager.restart();

  assert.equal(disconnectCalls, 1);
  assert.deepEqual(ensureCalls, ["ensureConnection", "ensureConnection"]);
  assert.deepEqual(state.sequence.slice(0, 13), [
    "enable",
    "onPaused",
    "onBreakpointResolved",
    "setBreakpointByUrl",
    "disposePaused",
    "disposeBreakpointResolved",
    "removeBreakpoint",
    "disable",
    "disconnectActiveConnection",
    "enable",
    "onPaused",
    "onBreakpointResolved",
    "setBreakpointByUrl",
  ]);

  manager.dispose();
});

test("restart suppresses planned disconnect from connection-lost termination", async () => {
  const connectionStateStore = createConnectionStateStore();

  const state = createState();
  let connected = true;

  const manager = createDebugSessionManager({
    getDebuggerSession: () =>
      connected ? createStateTrackingSession(state) : undefined,
    ensureConnection: async () => {
      connected = true;
    },
    disconnectActiveConnection: async () => {
      connected = false;
      connectionStateStore.setState("disconnected");
    },
    logger: () => undefined,
  });

  const reasons: string[] = [];
  const subscription = manager.onDidTerminate((reason) => {
    reasons.push(reason);
  });

  await manager.launch();
  await manager.restart();

  assert.deepEqual(reasons, []);

  subscription.dispose();
  manager.dispose();
});

test("terminate survives removeBreakpoint failures and still disables", async () => {
  createConnectionStateStore();

  const state = createState();

  const base = createStateTrackingSession(state);
  const session: BrowserDebuggerSession = {
    ...base,
    removeBreakpoint: async ({ breakpointId }) => {
      state.sequence.push("removeBreakpoint");
      state.removeBreakpointCalls.push(breakpointId);
      throw new Error("remove failed");
    },
  };

  const manager = createDebugSessionManager({
    getDebuggerSession: () => session,
    logger: () => undefined,
  });

  manager.recordSetBreakpoints("vscode-notebook-cell://test/cell-1.js", [
    { line: 4 },
  ]);

  await manager.launch();
  await manager.terminate();

  assert.equal(state.sequence.includes("disable"), true);
  assert.equal(manager.getBreakpointRegistry(), undefined);

  manager.dispose();
});

test("runtime breakpointResolved is propagated through manager event", async () => {
  createConnectionStateStore();

  const state = createState();
  const manager = createDebugSessionManager({
    getDebuggerSession: () => createStateTrackingSession(state),
    logger: () => undefined,
  });

  manager.recordSetBreakpoints("vscode-notebook-cell://test/cell-r.js", [
    { line: 7 },
  ]);

  const resolvedEvents: Array<{ url: string; line: number }> = [];
  const subscription = manager.onDidBreakpointResolved((event) => {
    resolvedEvents.push({ url: event.url, line: event.line });
  });

  await manager.launch();

  state.breakpointResolvedListener?.({
    breakpointId: "bp-1",
    location: { scriptId: "1", lineNumber: 8, columnNumber: 0 },
  });

  assert.deepEqual(resolvedEvents, [
    { url: "vscode-notebook-cell://test/cell-r.js", line: 9 },
  ]);

  subscription.dispose();
  manager.dispose();
});

test("stepOver forwards to runningSession and resolves", async () => {
  createConnectionStateStore();

  const state = createState();
  const stepCalls: string[] = [];

  const base = createStateTrackingSession(state);
  const session = {
    ...base,
    stepOver: async () => {
      stepCalls.push("stepOver");
    },
  };

  const manager = createDebugSessionManager({
    getDebuggerSession: () => session,
    logger: () => undefined,
  });

  await manager.launch();
  await manager.stepOver();

  assert.deepEqual(stepCalls, ["stepOver"]);

  manager.dispose();
});

test("stepInto forwards to runningSession and resolves", async () => {
  createConnectionStateStore();

  const state = createState();
  const stepCalls: string[] = [];

  const base = createStateTrackingSession(state);
  const session = {
    ...base,
    stepInto: async () => {
      stepCalls.push("stepInto");
    },
  };

  const manager = createDebugSessionManager({
    getDebuggerSession: () => session,
    logger: () => undefined,
  });

  await manager.launch();
  await manager.stepInto();

  assert.deepEqual(stepCalls, ["stepInto"]);

  manager.dispose();
});

test("stepOut forwards to runningSession and resolves", async () => {
  createConnectionStateStore();

  const state = createState();
  const stepCalls: string[] = [];

  const base = createStateTrackingSession(state);
  const session = {
    ...base,
    stepOut: async () => {
      stepCalls.push("stepOut");
    },
  };

  const manager = createDebugSessionManager({
    getDebuggerSession: () => session,
    logger: () => undefined,
  });

  await manager.launch();
  await manager.stepOut();

  assert.deepEqual(stepCalls, ["stepOut"]);

  manager.dispose();
});

test("pause forwards to runningSession and resolves", async () => {
  createConnectionStateStore();

  const state = createState();
  const pauseCalls: string[] = [];

  const base = createStateTrackingSession(state);
  const session = {
    ...base,
    pause: async () => {
      pauseCalls.push("pause");
    },
  };

  const manager = createDebugSessionManager({
    getDebuggerSession: () => session,
    logger: () => undefined,
  });

  await manager.launch();
  await manager.pause();

  assert.deepEqual(pauseCalls, ["pause"]);

  manager.dispose();
});

test("stepOver no-ops when no session is running", async () => {
  createConnectionStateStore();

  const manager = createDebugSessionManager({
    getDebuggerSession: () => undefined,
    logger: () => undefined,
  });

  await assert.doesNotReject(async () => {
    await manager.stepOver();
  });

  manager.dispose();
});

test("stepInto no-ops when no session is running", async () => {
  createConnectionStateStore();

  const manager = createDebugSessionManager({
    getDebuggerSession: () => undefined,
    logger: () => undefined,
  });

  await assert.doesNotReject(async () => {
    await manager.stepInto();
  });

  manager.dispose();
});

test("stepOut no-ops when no session is running", async () => {
  createConnectionStateStore();

  const manager = createDebugSessionManager({
    getDebuggerSession: () => undefined,
    logger: () => undefined,
  });

  await assert.doesNotReject(async () => {
    await manager.stepOut();
  });

  manager.dispose();
});

test("pause no-ops when no session is running", async () => {
  createConnectionStateStore();

  const manager = createDebugSessionManager({
    getDebuggerSession: () => undefined,
    logger: () => undefined,
  });

  await assert.doesNotReject(async () => {
    await manager.pause();
  });

  manager.dispose();
});

import test from "node:test";
import assert from "node:assert/strict";

import type { DebugProtocol } from "@vscode/debugprotocol";

import { NotebookDebugAdapter } from "../../../src/debugger/notebook-dap-adapter.js";
import type { DebugSessionManager } from "../../../src/debugger/debug-session-manager.js";
import type { DesiredBreakpoint } from "../../../src/debugger/breakpoint-registry.js";
import type { VariableStore } from "../../../src/debugger/variable-store.js";

interface Harness {
  adapter: NotebookDebugAdapter;
  sendRequest: (
    command: string,
    args?: unknown,
  ) => Promise<DebugProtocol.Response>;
  sentMessages: DebugProtocol.ProtocolMessage[];
}

function createHarness(sessionManager: DebugSessionManager): Harness {
  const adapter = new NotebookDebugAdapter({ sessionManager });
  const sentMessages: DebugProtocol.ProtocolMessage[] = [];

  adapter.onDidSendMessage((message) => {
    sentMessages.push(message as DebugProtocol.ProtocolMessage);
  });

  let sequence = 0;

  const sendRequest = async (
    command: string,
    args?: unknown,
  ): Promise<DebugProtocol.Response> => {
    const requestSeq = sequence + 1;
    sequence = requestSeq;

    const request: DebugProtocol.Request = {
      seq: requestSeq,
      type: "request",
      command,
      arguments: args as Record<string, unknown> | undefined,
    };

    adapter.handleMessage(request);

    for (let step = 0; step < 20; step += 1) {
      const response = sentMessages.find((message) => {
        if (message.type !== "response") {
          return false;
        }

        const typedResponse = message as DebugProtocol.Response;
        return typedResponse.request_seq === requestSeq;
      }) as DebugProtocol.Response | undefined;

      if (response) {
        return response;
      }

      await Promise.resolve();
    }

    throw new Error(`No response captured for ${command}`);
  };

  return {
    adapter,
    sendRequest,
    sentMessages,
  };
}

function createSessionManager(
  overrides: Partial<DebugSessionManager>,
): DebugSessionManager {
  const variableStore: VariableStore = {
    reserve: () => 0,
    resolve: () => undefined,
    clearForPause: async () => undefined,
    dispose: async () => undefined,
  };

  return {
    launch: overrides.launch ?? (async () => undefined),
    resume: overrides.resume ?? (async () => undefined),
    stepOver: overrides.stepOver ?? (async () => undefined),
    stepInto: overrides.stepInto ?? (async () => undefined),
    stepOut: overrides.stepOut ?? (async () => undefined),
    pause: overrides.pause ?? (async () => undefined),
    disconnect: overrides.disconnect ?? (async () => undefined),
    terminate: overrides.terminate ?? (async () => undefined),
    getDebuggerSession: overrides.getDebuggerSession ?? (() => undefined),
    getBreakpointRegistry: overrides.getBreakpointRegistry ?? (() => undefined),
    getVariableStore: overrides.getVariableStore ?? (() => variableStore),
    getPausedEvent: overrides.getPausedEvent ?? (() => undefined),
    getPauseVersion: overrides.getPauseVersion ?? (() => 0),
    getScriptUrl: () => undefined,
    recordSetBreakpoints:
      overrides.recordSetBreakpoints ??
      ((_url: string, _desired: DesiredBreakpoint[]) => undefined),
    onDidTerminate:
      overrides.onDidTerminate ?? (() => ({ dispose: () => undefined })),
    onDidPaused:
      overrides.onDidPaused ?? (() => ({ dispose: () => undefined })),
    onDidBreakpointResolved:
      overrides.onDidBreakpointResolved ??
      (() => ({ dispose: () => undefined })),
    dispose: overrides.dispose ?? (() => undefined),
  };
}

test("next calls stepOver exactly once and emits ContinuedEvent", async () => {
  let stepOverCalls = 0;

  const harness = createHarness(
    createSessionManager({
      stepOver: async () => {
        stepOverCalls += 1;
      },
    }),
  );

  const response = await harness.sendRequest("next", { threadId: 1 });

  assert.equal(response.success, true);
  assert.equal(stepOverCalls, 1);

  const continuedEvents = harness.sentMessages.filter(
    (message) =>
      message.type === "event" &&
      (message as DebugProtocol.Event).event === "continued",
  ) as DebugProtocol.ContinuedEvent[];

  assert.equal(continuedEvents.length, 1);
  assert.equal(continuedEvents[0]?.body?.threadId, 1);
  assert.equal(continuedEvents[0]?.body?.allThreadsContinued, true);

  harness.adapter.dispose();
});

test("stepIn calls stepInto exactly once and emits ContinuedEvent", async () => {
  let stepIntoCalls = 0;

  const harness = createHarness(
    createSessionManager({
      stepInto: async () => {
        stepIntoCalls += 1;
      },
    }),
  );

  const response = await harness.sendRequest("stepIn", { threadId: 1 });

  assert.equal(response.success, true);
  assert.equal(stepIntoCalls, 1);

  const continuedEvents = harness.sentMessages.filter(
    (message) =>
      message.type === "event" &&
      (message as DebugProtocol.Event).event === "continued",
  ) as DebugProtocol.ContinuedEvent[];

  assert.equal(continuedEvents.length, 1);
  assert.equal(continuedEvents[0]?.body?.allThreadsContinued, true);

  harness.adapter.dispose();
});

test("stepOut calls stepOut exactly once and emits ContinuedEvent", async () => {
  let stepOutCalls = 0;

  const harness = createHarness(
    createSessionManager({
      stepOut: async () => {
        stepOutCalls += 1;
      },
    }),
  );

  const response = await harness.sendRequest("stepOut", { threadId: 1 });

  assert.equal(response.success, true);
  assert.equal(stepOutCalls, 1);

  const continuedEvents = harness.sentMessages.filter(
    (message) =>
      message.type === "event" &&
      (message as DebugProtocol.Event).event === "continued",
  ) as DebugProtocol.ContinuedEvent[];

  assert.equal(continuedEvents.length, 1);
  assert.equal(continuedEvents[0]?.body?.allThreadsContinued, true);

  harness.adapter.dispose();
});

test("pause calls pause exactly once and sends success response", async () => {
  let pauseCalls = 0;

  const harness = createHarness(
    createSessionManager({
      pause: async () => {
        pauseCalls += 1;
      },
    }),
  );

  const response = await harness.sendRequest("pause", { threadId: 1 });

  assert.equal(response.success, true);
  assert.equal(pauseCalls, 1);

  harness.adapter.dispose();
});

test("next failure returns ErrorResponse with error message", async () => {
  const harness = createHarness(
    createSessionManager({
      stepOver: async () => {
        throw new Error("step over failed: session gone");
      },
    }),
  );

  const response = await harness.sendRequest("next", { threadId: 1 });

  assert.equal(response.success, false);
  assert.match(response.message ?? "", /step over failed: session gone/);

  harness.adapter.dispose();
});

test("stepIn failure returns ErrorResponse with error message", async () => {
  const harness = createHarness(
    createSessionManager({
      stepInto: async () => {
        throw new Error("step into failed");
      },
    }),
  );

  const response = await harness.sendRequest("stepIn", { threadId: 1 });

  assert.equal(response.success, false);
  assert.match(response.message ?? "", /step into failed/);

  harness.adapter.dispose();
});

test("stepOut failure returns ErrorResponse with error message", async () => {
  const harness = createHarness(
    createSessionManager({
      stepOut: async () => {
        throw new Error("step out failed");
      },
    }),
  );

  const response = await harness.sendRequest("stepOut", { threadId: 1 });

  assert.equal(response.success, false);
  assert.match(response.message ?? "", /step out failed/);

  harness.adapter.dispose();
});

test("pause failure returns ErrorResponse with error message", async () => {
  const harness = createHarness(
    createSessionManager({
      pause: async () => {
        throw new Error("pause failed: session unavailable");
      },
    }),
  );

  const response = await harness.sendRequest("pause", { threadId: 1 });

  assert.equal(response.success, false);
  assert.match(response.message ?? "", /pause failed: session unavailable/);

  harness.adapter.dispose();
});

test("next failure does not emit ContinuedEvent", async () => {
  const harness = createHarness(
    createSessionManager({
      stepOver: async () => {
        throw new Error("step failed");
      },
    }),
  );

  await harness.sendRequest("next", { threadId: 1 });

  const continuedEvents = harness.sentMessages.filter(
    (message) =>
      message.type === "event" &&
      (message as DebugProtocol.Event).event === "continued",
  );

  assert.equal(continuedEvents.length, 0);

  harness.adapter.dispose();
});

test("continue still calls resume and emits ContinuedEvent (regression)", async () => {
  let resumeCalls = 0;

  const harness = createHarness(
    createSessionManager({
      resume: async () => {
        resumeCalls += 1;
      },
    }),
  );

  const response = await harness.sendRequest("continue", { threadId: 1 });

  assert.equal(response.success, true);
  assert.equal(resumeCalls, 1);

  const body = (response as DebugProtocol.ContinueResponse).body;
  assert.equal(body?.allThreadsContinued, true);

  const continuedEvents = harness.sentMessages.filter(
    (message) =>
      message.type === "event" &&
      (message as DebugProtocol.Event).event === "continued",
  ) as DebugProtocol.ContinuedEvent[];

  assert.equal(continuedEvents.length, 1);
  assert.equal(continuedEvents[0]?.body?.allThreadsContinued, true);

  harness.adapter.dispose();
});

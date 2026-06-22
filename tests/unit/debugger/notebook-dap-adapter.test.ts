import test from "node:test";
import assert from "node:assert/strict";

import type { DebugProtocol } from "@vscode/debugprotocol";

import { createFakeSessionManager } from "../test-utils/debug-session-manager-mock.js";
import { createAdapterHarness } from "../test-utils/notebook-dap-harness.js";

test("initialize returns expected capability snapshot", async () => {
  const harness = createAdapterHarness(createFakeSessionManager(), {
    maxPolls: 20,
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

test("launch failure returns ErrorResponse with localized message", async () => {
  const harness = createAdapterHarness(
    createFakeSessionManager({
      launch: async () => {
        throw new Error(
          "Cannot start debug session: connect to a browser target first.",
        );
      },
    }),
    { maxPolls: 20 },
  );

  const response = await harness.sendRequest("launch", {});

  assert.equal(response.success, false);
  assert.match(response.message ?? "", /Cannot start debug session/);

  harness.adapter.dispose();
});

test("threads returns the single notebook-cells thread", async () => {
  const harness = createAdapterHarness(createFakeSessionManager(), {
    maxPolls: 20,
  });

  const response = await harness.sendRequest("threads", {});

  assert.equal(response.success, true);
  const body = (response as DebugProtocol.ThreadsResponse).body;
  assert.equal(body?.threads.length, 1);
  assert.equal(body?.threads[0]?.id, 1);
  assert.equal(body?.threads[0]?.name, "Notebook cells");

  harness.adapter.dispose();
});

test("terminate emits terminated event so one stop cleanly ends session", async () => {
  let terminateCalls = 0;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      terminate: async () => {
        terminateCalls += 1;
      },
    }),
    { maxPolls: 20 },
  );

  const response = await harness.sendRequest("terminate", {});

  assert.equal(response.success, true);
  assert.equal(terminateCalls, 1);

  const terminatedEvents = harness.sentMessages.filter(
    (message) =>
      message.type === "event" &&
      (message as DebugProtocol.Event).event === "terminated",
  );

  assert.equal(terminatedEvents.length, 1);

  harness.adapter.dispose();
});

test("connection-lost followed by terminate emits terminated event exactly once", async () => {
  let terminationListener: ((reason: "connection-lost") => void) | undefined;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      onDidTerminate: (listener) => {
        terminationListener = listener;
        return { dispose: () => undefined };
      },
    }),
    { maxPolls: 20 },
  );

  assert.ok(terminationListener, "adapter must subscribe to onDidTerminate");
  terminationListener?.("connection-lost");

  const response = await harness.sendRequest("terminate", {});
  assert.equal(response.success, true);

  const terminatedEvents = harness.sentMessages.filter(
    (message) =>
      message.type === "event" &&
      (message as DebugProtocol.Event).event === "terminated",
  );

  assert.equal(terminatedEvents.length, 1);

  harness.adapter.dispose();
});

test("manager paused notification emits stopped event", () => {
  let pausedListener:
    | ((event: { reason: string; hitBreakpoints?: string[] }) => void)
    | undefined;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      onDidPaused: (listener) => {
        pausedListener = listener as (event: {
          reason: string;
          hitBreakpoints?: string[];
        }) => void;
        return { dispose: () => undefined };
      },
    }),
    { maxPolls: 20 },
  );

  pausedListener?.({ reason: "other", hitBreakpoints: ["bp-1"] });

  const stoppedEvents = harness.sentMessages.filter(
    (message) =>
      message.type === "event" &&
      (message as DebugProtocol.Event).event === "stopped",
  ) as DebugProtocol.StoppedEvent[];

  assert.equal(stoppedEvents.length, 1);
  assert.equal(stoppedEvents[0]?.body.reason, "breakpoint");
  assert.equal(stoppedEvents[0]?.body.threadId, 1);

  harness.adapter.dispose();
});

test("continue request resumes manager and emits continued event", async () => {
  let resumeCalls = 0;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      resume: async () => {
        resumeCalls += 1;
      },
    }),
    { maxPolls: 20 },
  );

  const response = await harness.sendRequest("continue", { threadId: 1 });

  assert.equal(response.success, true);
  assert.equal(resumeCalls, 1);

  const continuedEvents = harness.sentMessages.filter(
    (message) =>
      message.type === "event" &&
      (message as DebugProtocol.Event).event === "continued",
  ) as DebugProtocol.ContinuedEvent[];

  assert.equal(continuedEvents.length, 1);
  assert.equal(continuedEvents[0]?.body.threadId, 1);
  assert.equal(continuedEvents[0]?.body.allThreadsContinued, true);

  harness.adapter.dispose();
});

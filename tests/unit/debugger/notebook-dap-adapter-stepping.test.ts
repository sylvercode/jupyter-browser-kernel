import test from "node:test";
import assert from "node:assert/strict";

import type { DebugProtocol } from "@vscode/debugprotocol";

import { createFakeSessionManager } from "../test-utils/debug-session-manager-mock.js";
import { createAdapterHarness } from "../test-utils/notebook-dap-harness.js";

test("next calls stepOver exactly once and emits ContinuedEvent", async () => {
  let stepOverCalls = 0;

  const harness = createAdapterHarness(
    createFakeSessionManager({
      stepOver: async () => {
        stepOverCalls += 1;
      },
    }),
    { maxPolls: 20 },
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

  const harness = createAdapterHarness(
    createFakeSessionManager({
      stepInto: async () => {
        stepIntoCalls += 1;
      },
    }),
    { maxPolls: 20 },
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

  const harness = createAdapterHarness(
    createFakeSessionManager({
      stepOut: async () => {
        stepOutCalls += 1;
      },
    }),
    { maxPolls: 20 },
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

  const harness = createAdapterHarness(
    createFakeSessionManager({
      pause: async () => {
        pauseCalls += 1;
      },
    }),
    { maxPolls: 20 },
  );

  const response = await harness.sendRequest("pause", { threadId: 1 });

  assert.equal(response.success, true);
  assert.equal(pauseCalls, 1);

  harness.adapter.dispose();
});

test("next failure returns ErrorResponse with error message", async () => {
  const harness = createAdapterHarness(
    createFakeSessionManager({
      stepOver: async () => {
        throw new Error("step over failed: session gone");
      },
    }),
    { maxPolls: 20 },
  );

  const response = await harness.sendRequest("next", { threadId: 1 });

  assert.equal(response.success, false);
  assert.match(response.message ?? "", /step over failed: session gone/);

  harness.adapter.dispose();
});

test("stepIn failure returns ErrorResponse with error message", async () => {
  const harness = createAdapterHarness(
    createFakeSessionManager({
      stepInto: async () => {
        throw new Error("step into failed");
      },
    }),
    { maxPolls: 20 },
  );

  const response = await harness.sendRequest("stepIn", { threadId: 1 });

  assert.equal(response.success, false);
  assert.match(response.message ?? "", /step into failed/);

  harness.adapter.dispose();
});

test("stepOut failure returns ErrorResponse with error message", async () => {
  const harness = createAdapterHarness(
    createFakeSessionManager({
      stepOut: async () => {
        throw new Error("step out failed");
      },
    }),
    { maxPolls: 20 },
  );

  const response = await harness.sendRequest("stepOut", { threadId: 1 });

  assert.equal(response.success, false);
  assert.match(response.message ?? "", /step out failed/);

  harness.adapter.dispose();
});

test("pause failure returns ErrorResponse with error message", async () => {
  const harness = createAdapterHarness(
    createFakeSessionManager({
      pause: async () => {
        throw new Error("pause failed: session unavailable");
      },
    }),
    { maxPolls: 20 },
  );

  const response = await harness.sendRequest("pause", { threadId: 1 });

  assert.equal(response.success, false);
  assert.match(response.message ?? "", /pause failed: session unavailable/);

  harness.adapter.dispose();
});

test("next failure does not emit ContinuedEvent", async () => {
  const harness = createAdapterHarness(
    createFakeSessionManager({
      stepOver: async () => {
        throw new Error("step failed");
      },
    }),
    { maxPolls: 20 },
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

import test from "node:test";
import assert from "node:assert/strict";

import type { DebugProtocol } from "@vscode/debugprotocol";

import { createFakeSessionManager } from "../test-utils/debug-session-manager-mock.js";
import { createAdapterHarness } from "../test-utils/notebook-dap-harness.js";

type PausedListener = (event: unknown) => void;

interface Harness {
  adapter: ReturnType<typeof createAdapterHarness>["adapter"];
  firePaused: (event: unknown) => void;
  sentMessages: DebugProtocol.ProtocolMessage[];
}

function createHarness(): Harness {
  let pausedListener: PausedListener | undefined;
  const { adapter, sentMessages } = createAdapterHarness(
    createFakeSessionManager({
      onDidPaused: (listener) => {
        pausedListener = listener as PausedListener;
        return { dispose: () => undefined };
      },
    }),
  );

  return {
    adapter,
    firePaused: (event) => {
      pausedListener?.(event);
    },
    sentMessages,
  };
}

function getStoppedEvents(
  messages: DebugProtocol.ProtocolMessage[],
): DebugProtocol.StoppedEvent[] {
  return messages.filter(
    (message) =>
      message.type === "event" &&
      (message as DebugProtocol.Event).event === "stopped",
  ) as DebugProtocol.StoppedEvent[];
}

test("CDP 'step' reason maps to DAP 'step' reason", () => {
  const harness = createHarness();

  harness.firePaused({
    reason: "step",
    callFrames: [],
  });

  const stopped = getStoppedEvents(harness.sentMessages);
  assert.equal(stopped.length, 1);
  assert.equal(stopped[0]?.body?.reason, "step");
  assert.equal(stopped[0]?.body?.threadId, 1);

  harness.adapter.dispose();
});

test("CDP 'breakpoint' with hitBreakpoints maps to DAP 'breakpoint' reason", () => {
  const harness = createHarness();

  harness.firePaused({
    reason: "breakpoint",
    hitBreakpoints: ["bp-1"],
    callFrames: [],
  });

  const stopped = getStoppedEvents(harness.sentMessages);
  assert.equal(stopped.length, 1);
  assert.equal(stopped[0]?.body?.reason, "breakpoint");

  harness.adapter.dispose();
});

test("CDP 'exception' reason maps to DAP 'exception' reason", () => {
  const harness = createHarness();

  harness.firePaused({
    reason: "exception",
    callFrames: [],
    data: {
      description: "ReferenceError: x is not defined",
    },
  });

  const stopped = getStoppedEvents(harness.sentMessages);
  assert.equal(stopped.length, 1);
  assert.equal(stopped[0]?.body?.reason, "exception");
  assert.equal(stopped[0]?.body?.text, "ReferenceError: x is not defined");

  harness.adapter.dispose();
});

test("CDP 'other' reason maps to DAP 'pause' reason", () => {
  const harness = createHarness();

  harness.firePaused({
    reason: "other",
    callFrames: [],
  });

  const stopped = getStoppedEvents(harness.sentMessages);
  assert.equal(stopped.length, 1);
  assert.equal(stopped[0]?.body?.reason, "pause");

  harness.adapter.dispose();
});

test("CDP 'breakpoint' without hitBreakpoints maps to DAP 'pause' reason", () => {
  const harness = createHarness();

  harness.firePaused({
    reason: "breakpoint",
    hitBreakpoints: [],
    callFrames: [],
  });

  const stopped = getStoppedEvents(harness.sentMessages);
  assert.equal(stopped.length, 1);
  assert.equal(stopped[0]?.body?.reason, "pause");

  harness.adapter.dispose();
});

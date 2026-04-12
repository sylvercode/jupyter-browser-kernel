import test from "node:test";
import assert from "node:assert/strict";
import { t as localize } from "@vscode/l10n";

import { createConnectionStateStore } from "../../../src/transport/connection-state";
import {
  executeDisconnectCommand,
  type DisconnectCommandRuntime,
} from "../../../src/commands/disconnect-command";

function createRuntime(
  overrides: Partial<DisconnectCommandRuntime>,
  onConnectionStateChanged?: (state: string) => void,
): DisconnectCommandRuntime {
  return {
    localize,
    connectionStateStore: createConnectionStateStore({
      onConnectionStateChanged,
    }),
    cancelInFlightTransitions: () => undefined,
    disconnectActiveConnection: async () => undefined,
    showInformationMessage: () => undefined,
    ...overrides,
  };
}

test("executeDisconnectCommand closes active session and transitions to disconnected", async () => {
  const calls: string[] = [];
  const transitions: string[] = [];

  const runtime = createRuntime(
    {
      cancelInFlightTransitions: () => {
        calls.push("cancel");
      },
      disconnectActiveConnection: async () => {
        calls.push("disconnect");
      },
    },
    transitions.push.bind(transitions),
  );

  await executeDisconnectCommand(runtime);

  assert.deepEqual(calls, ["cancel", "disconnect"]);
  assert.deepEqual(transitions, ["disconnected"]);
});

test("executeDisconnectCommand remains idempotent when no active session exists", async () => {
  const runtime = createRuntime({
    disconnectActiveConnection: async () => undefined,
  });

  await assert.doesNotReject(async () => {
    await executeDisconnectCommand(runtime);
    await executeDisconnectCommand(runtime);
  });
});

test("executeDisconnectCommand cancels in-flight transition before disconnect", async () => {
  const order: string[] = [];

  const runtime = createRuntime({
    connectionStateStore: createConnectionStateStore({
      initialState: "connecting",
    }),
    cancelInFlightTransitions: () => {
      order.push("cancel");
    },
    disconnectActiveConnection: async () => {
      order.push("disconnect");
    },
  });

  await executeDisconnectCommand(runtime);

  assert.deepEqual(order, ["cancel", "disconnect"]);
});

test("executeDisconnectCommand still transitions to disconnected when teardown throws", async () => {
  const transitions: string[] = [];

  const runtime = createRuntime(
    {
      disconnectActiveConnection: async () => {
        throw new Error("teardown failed");
      },
    },
    transitions.push.bind(transitions),
  );

  await assert.rejects(async () => {
    await executeDisconnectCommand(runtime);
  }, /teardown failed/);

  assert.deepEqual(transitions, ["disconnected"]);
});

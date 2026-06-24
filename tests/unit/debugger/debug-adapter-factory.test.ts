import test from "node:test";
import assert from "node:assert/strict";
import type * as vscode from "vscode";

import {
  DebugAdapterFactory,
  type DebugAdapterFactoryOptions,
} from "../../../src/debugger/debug-adapter-factory.js";
import type {
  DebugSessionManager,
  DebugSessionManagerOptions,
} from "../../../src/debugger/debug-session-manager.js";
import type { NotebookDebugAdapter } from "../../../src/debugger/notebook-dap-adapter.js";
import { createConnectionStateStore } from "../../../src/transport/connection-state.js";
import { createFakeSessionManager } from "../test-utils/debug-session-manager-mock.js";
import { createActiveBrowserConnectionMock } from "../test-utils/active-browser-connection-mock.js";

function createDebugSessionWithEndpoint(
  host: string,
  port: number,
): vscode.DebugSession {
  return {
    id: "session-id",
    type: "jupyter-browser-kernel",
    name: "Browser Kernel Debug",
    workspaceFolder: undefined,
    configuration: { host, port },
    parentSession: undefined,
    customRequest: async () => undefined,
    getDebugProtocolBreakpoint: async () => undefined,
  } as unknown as vscode.DebugSession;
}

function createFactory(
  overrides: Partial<DebugAdapterFactoryOptions> & {
    captureManagerOptions: (options: DebugSessionManagerOptions) => void;
  },
): DebugAdapterFactory {
  const connectionStateStore = createConnectionStateStore();
  const fakeManager: DebugSessionManager = createFakeSessionManager();

  return new DebugAdapterFactory({
    connectionStateStore,
    createSessionManager: (options) => {
      overrides.captureManagerOptions(options);
      return fakeManager;
    },
    createAdapter: () => ({}) as NotebookDebugAdapter,
    createInlineAdapterDescriptor: () =>
      ({ type: "inline" }) as unknown as vscode.DebugAdapterDescriptor,
    localize: ((messageOrOptions: string | { message: string }) =>
      typeof messageOrOptions === "string"
        ? messageOrOptions
        : messageOrOptions.message) as DebugAdapterFactoryOptions["localize"],
    logger: () => undefined,
    ...overrides,
  });
}

test("factory wires ensureConnection using session.configuration host and port", async () => {
  let capturedManagerOptions: DebugSessionManagerOptions | undefined;
  const connectEndpoints: Array<{ host: string; port: number }> = [];

  const factory = createFactory({
    captureManagerOptions: (options) => {
      capturedManagerOptions = options;
    },
    connectToTarget: async (endpoint) => {
      connectEndpoints.push(endpoint);
      return {
        ok: true,
        endpoint,
        connectedTarget: {
          targetId: "target-1",
          sessionId: "session-1",
        },
      };
    },
    getActiveConnection: () => undefined,
  });

  const session = createDebugSessionWithEndpoint("127.0.0.1", 9333);
  factory.createDebugAdapterDescriptor(session);

  assert.ok(capturedManagerOptions?.ensureConnection);
  await capturedManagerOptions?.ensureConnection?.();

  assert.deepEqual(connectEndpoints, [{ host: "127.0.0.1", port: 9333 }]);
});

test("factory-wired ensureConnection rejects when active connection already exists", async () => {
  let capturedManagerOptions: DebugSessionManagerOptions | undefined;
  let connectCalls = 0;

  const factory = createFactory({
    captureManagerOptions: (options) => {
      capturedManagerOptions = options;
    },
    connectToTarget: async (endpoint) => {
      connectCalls += 1;
      return {
        ok: true,
        endpoint,
        connectedTarget: {
          targetId: "target-2",
          sessionId: "session-2",
        },
      };
    },
    getActiveConnection: () =>
      createActiveBrowserConnectionMock({
        targetId: "existing-target",
        sessionId: "existing-session",
      }),
  });

  const session = createDebugSessionWithEndpoint("localhost", 9222);
  factory.createDebugAdapterDescriptor(session);

  assert.ok(capturedManagerOptions?.ensureConnection);
  await assert.rejects(async () => {
    await capturedManagerOptions?.ensureConnection?.();
  }, /A browser connection is already active\./);

  assert.equal(connectCalls, 0);
});

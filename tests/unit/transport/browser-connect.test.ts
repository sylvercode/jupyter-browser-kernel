import test from "node:test";
import assert from "node:assert/strict";

import {
  connectToBrowserTarget,
  createBrowserDebuggerSession,
  createAttachToTargetParams,
  disconnectActiveBrowserConnection,
  getActiveBrowserConnection,
  safeDetachFromTarget,
  toSessionScopedEventName,
} from "../../../src/transport/browser-connect.js";
import { coreTargetProfile } from "../../../src/profile/core-target-profile.js";
import { createLocalizeMock } from "../test-utils/localize-mock.js";

interface EventHarnessClient {
  send: (
    method: string,
    params: unknown,
    sessionId?: string,
  ) => Promise<unknown>;
  on: (eventName: string, listener: (event: unknown) => void) => void;
  off: (eventName: string, listener: (event: unknown) => void) => void;
}

function createEventHarness() {
  const calls: Array<{ action: "on" | "off"; eventName: string }> = [];
  const listeners = new Map<string, (event: unknown) => void>();

  const client: EventHarnessClient = {
    send: async () => undefined,
    on: (eventName: string, listener: (event: unknown) => void) => {
      calls.push({ action: "on", eventName });
      listeners.set(eventName, listener);
    },
    off: (eventName: string, listener: (event: unknown) => void) => {
      calls.push({ action: "off", eventName });
      if (listeners.get(eventName) === listener) {
        listeners.delete(eventName);
      }
    },
  };

  return { client, calls, listeners };
}

test("createAttachToTargetParams always enforces flatten mode", () => {
  assert.deepEqual(createAttachToTargetParams("target-1"), {
    targetId: "target-1",
    flatten: true,
  });
});

test("toSessionScopedEventName builds isolated event keys", () => {
  assert.equal(
    toSessionScopedEventName("Runtime.consoleAPICalled", "session-1"),
    "Runtime.consoleAPICalled.session-1",
  );
});

test("safeDetachFromTarget detaches an attached session", async () => {
  const detachCalls: Array<{ sessionId: string }> = [];

  await safeDetachFromTarget(
    {
      Target: {
        detachFromTarget: async (params: { sessionId: string }) => {
          detachCalls.push(params);
          return undefined;
        },
      },
    } as never,
    "session-1",
  );

  assert.deepEqual(detachCalls, [{ sessionId: "session-1" }]);
});

test("safeDetachFromTarget swallows detach cleanup errors", async () => {
  await assert.doesNotReject(async () => {
    await safeDetachFromTarget(
      {
        Target: {
          detachFromTarget: async () => {
            throw new Error("detach failed");
          },
        },
      } as never,
      "session-2",
    );
  });
});

test("createBrowserDebuggerSession forwards setBreakpointByUrl to the scoped session", async () => {
  const sendCalls: Array<{
    method: string;
    params: unknown;
    sessionId?: string;
  }> = [];

  const session = createBrowserDebuggerSession(
    {
      send: async (method: string, params: unknown, sessionId?: string) => {
        sendCalls.push({ method, params, sessionId });
        if (method === "Debugger.setBreakpointByUrl") {
          return {
            breakpointId: "bp-1",
            locations: [],
          };
        }

        return undefined;
      },
      on: () => undefined,
      off: () => undefined,
    } as never,
    "session-1",
  );

  const result = await session.setBreakpointByUrl({
    url: "vscode-notebook-cell://test/notebook.ipynb#cell0",
    lineNumber: 1,
  });

  assert.equal(result.breakpointId, "bp-1");
  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0]?.method, "Debugger.setBreakpointByUrl");
  assert.equal(sendCalls[0]?.sessionId, "session-1");
});

test("createBrowserDebuggerSession forwards removeBreakpoint to the scoped session", async () => {
  const sendCalls: Array<{
    method: string;
    params: unknown;
    sessionId?: string;
  }> = [];

  const session = createBrowserDebuggerSession(
    {
      send: async (method: string, params: unknown, sessionId?: string) => {
        sendCalls.push({ method, params, sessionId });
        return undefined;
      },
      on: () => undefined,
      off: () => undefined,
    } as never,
    "session-2",
  );

  await session.removeBreakpoint({ breakpointId: "bp-remove" });

  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0]?.method, "Debugger.removeBreakpoint");
  assert.deepEqual(sendCalls[0]?.params, { breakpointId: "bp-remove" });
  assert.equal(sendCalls[0]?.sessionId, "session-2");
});

test("createBrowserDebuggerSession forwards getProperties to the scoped session", async () => {
  const sendCalls: Array<{
    method: string;
    params: unknown;
    sessionId?: string;
  }> = [];

  const session = createBrowserDebuggerSession(
    {
      send: async (method: string, params: unknown, sessionId?: string) => {
        sendCalls.push({ method, params, sessionId });
        return {
          result: [],
        };
      },
      on: () => undefined,
      off: () => undefined,
    } as never,
    "session-properties",
  );

  await session.getProperties({ objectId: "obj-1" });

  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0]?.method, "Runtime.getProperties");
  assert.equal(sendCalls[0]?.sessionId, "session-properties");
});

test("createBrowserDebuggerSession forwards evaluateOnCallFrame to the scoped session", async () => {
  const sendCalls: Array<{
    method: string;
    params: unknown;
    sessionId?: string;
  }> = [];

  const session = createBrowserDebuggerSession(
    {
      send: async (method: string, params: unknown, sessionId?: string) => {
        sendCalls.push({ method, params, sessionId });
        return {
          result: {
            type: "number",
            value: 1,
          },
        };
      },
      on: () => undefined,
      off: () => undefined,
    } as never,
    "session-call-frame",
  );

  await session.evaluateOnCallFrame({ callFrameId: "cf-1", expression: "1" });

  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0]?.method, "Debugger.evaluateOnCallFrame");
  assert.equal(sendCalls[0]?.sessionId, "session-call-frame");
});

test("createBrowserDebuggerSession forwards releaseObject to the scoped session", async () => {
  const sendCalls: Array<{
    method: string;
    params: unknown;
    sessionId?: string;
  }> = [];

  const session = createBrowserDebuggerSession(
    {
      send: async (method: string, params: unknown, sessionId?: string) => {
        sendCalls.push({ method, params, sessionId });
        return undefined;
      },
      on: () => undefined,
      off: () => undefined,
    } as never,
    "session-release",
  );

  await session.releaseObject({ objectId: "obj-2" });

  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0]?.method, "Runtime.releaseObject");
  assert.equal(sendCalls[0]?.sessionId, "session-release");
});

test("createBrowserDebuggerSession forwards evaluate to the scoped session", async () => {
  const sendCalls: Array<{
    method: string;
    params: unknown;
    sessionId?: string;
  }> = [];

  const session = createBrowserDebuggerSession(
    {
      send: async (method: string, params: unknown, sessionId?: string) => {
        sendCalls.push({ method, params, sessionId });
        return {
          result: {
            type: "number",
            value: 2,
          },
        };
      },
      on: () => undefined,
      off: () => undefined,
    } as never,
    "session-evaluate",
  );

  await session.evaluate({ expression: "1 + 1" });

  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0]?.method, "Runtime.evaluate");
  assert.equal(sendCalls[0]?.sessionId, "session-evaluate");
});

test("createBrowserDebuggerSession evaluate does not timeout while paused", async () => {
  const { client, listeners } = createEventHarness();
  const sendCalls: Array<{ method: string }> = [];

  client.send = async (method: string) => {
    sendCalls.push({ method });
    if (method !== "Runtime.evaluate") {
      return undefined;
    }

    return await new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          result: {
            type: "number",
            value: 42,
          },
        });
      }, 35);
    });
  };

  const session = createBrowserDebuggerSession(
    client as never,
    "session-paused",
    {
      evaluationTimeoutMs: 20,
    },
  );

  const evaluation = session.evaluate({ expression: "1 + 1" });

  await new Promise((resolve) => setTimeout(resolve, 5));
  listeners.get("Debugger.paused.session-paused")?.({
    reason: "breakpoint",
  });

  await new Promise((resolve) => setTimeout(resolve, 25));
  listeners.get("Debugger.resumed.session-paused")?.({});

  const result = await evaluation;

  assert.equal(
    sendCalls.filter((call) => call.method === "Runtime.evaluate").length,
    1,
  );
  assert.equal(result.result.value, 42);
});

test("createBrowserDebuggerSession evaluate still times out when not paused", async () => {
  const { client } = createEventHarness();
  const sendCalls: Array<{ method: string }> = [];

  client.send = async (method: string) => {
    sendCalls.push({ method });
    if (method !== "Runtime.evaluate") {
      return undefined;
    }

    return await new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          result: {
            type: "number",
            value: 42,
          },
        });
      }, 35);
    });
  };

  const session = createBrowserDebuggerSession(
    client as never,
    "session-timeout",
    {
      evaluationTimeoutMs: 20,
    },
  );

  await assert.rejects(async () => {
    await session.evaluate({ expression: "1 + 1" });
  }, /CDP evaluation timed out/);

  assert.equal(
    sendCalls.filter((call) => call.method === "Runtime.evaluate").length,
    1,
  );
});

test("createBrowserDebuggerSession forwards enable to the scoped session", async () => {
  const sendCalls: Array<{
    method: string;
    params: unknown;
    sessionId?: string;
  }> = [];

  const session = createBrowserDebuggerSession(
    {
      send: async (method: string, params: unknown, sessionId?: string) => {
        sendCalls.push({ method, params, sessionId });
        return undefined;
      },
      on: () => undefined,
      off: () => undefined,
    } as never,
    "session-enable",
  );

  await session.enable();

  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0]?.method, "Debugger.enable");
  assert.equal(sendCalls[0]?.sessionId, "session-enable");
});

test("createBrowserDebuggerSession forwards disable to the scoped session", async () => {
  const sendCalls: Array<{
    method: string;
    params: unknown;
    sessionId?: string;
  }> = [];

  const session = createBrowserDebuggerSession(
    {
      send: async (method: string, params: unknown, sessionId?: string) => {
        sendCalls.push({ method, params, sessionId });
        return undefined;
      },
      on: () => undefined,
      off: () => undefined,
    } as never,
    "session-disable",
  );

  await session.disable();

  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0]?.method, "Debugger.disable");
  assert.equal(sendCalls[0]?.sessionId, "session-disable");
});

test("createBrowserDebuggerSession resume swallows CDP errors", async () => {
  const session = createBrowserDebuggerSession(
    {
      send: async () => {
        throw new Error("resume failed");
      },
      on: () => undefined,
      off: () => undefined,
    } as never,
    "session-3",
  );

  await assert.doesNotReject(async () => {
    await session.resume();
  });
});

test("createBrowserDebuggerSession onPaused subscribes and disposes by session-scoped event name", () => {
  const { client, calls, listeners } = createEventHarness();

  const session = createBrowserDebuggerSession(client as never, "session-4");

  const events: unknown[] = [];
  const subscription = session.onPaused((event) => {
    events.push(event);
  });

  listeners.get("Debugger.paused.session-4")?.({ reason: "other" });
  subscription.dispose();

  assert.deepEqual(calls.slice(0, 2), [
    { action: "on", eventName: "Debugger.paused.session-4" },
    { action: "on", eventName: "Debugger.resumed.session-4" },
  ]);
  assert.equal(calls.length, 2);
  assert.equal(events.length, 1);
});

test("createBrowserDebuggerSession onResumed notifies listeners and disposes cleanly", () => {
  const { client, calls, listeners } = createEventHarness();

  const session = createBrowserDebuggerSession(client as never, "session-4b");

  let resumedCount = 0;
  const subscription = session.onResumed(() => {
    resumedCount += 1;
  });

  listeners.get("Debugger.resumed.session-4b")?.({});
  subscription.dispose();

  assert.deepEqual(calls.slice(0, 2), [
    { action: "on", eventName: "Debugger.paused.session-4b" },
    { action: "on", eventName: "Debugger.resumed.session-4b" },
  ]);
  assert.equal(calls.length, 2);
  assert.equal(resumedCount, 1);
});

test("createBrowserDebuggerSession onBreakpointResolved subscribes and disposes by session-scoped event name", () => {
  const calls: Array<{ action: "on" | "off"; eventName: string }> = [];
  let capturedListener: ((event: unknown) => void) | undefined;

  const session = createBrowserDebuggerSession(
    {
      send: async () => undefined,
      on: (eventName: string, listener: (event: unknown) => void) => {
        calls.push({ action: "on", eventName });
        capturedListener = listener;
      },
      off: (eventName: string) => {
        calls.push({ action: "off", eventName });
      },
    } as never,
    "session-5",
  );

  const events: unknown[] = [];
  const subscription = session.onBreakpointResolved((event) => {
    events.push(event);
  });

  capturedListener?.({ breakpointId: "bp-1" });
  subscription.dispose();

  assert.deepEqual(calls, [
    {
      action: "on",
      eventName: "Debugger.paused.session-5",
    },
    {
      action: "on",
      eventName: "Debugger.resumed.session-5",
    },
    {
      action: "on",
      eventName: "Debugger.breakpointResolved.session-5",
    },
    {
      action: "off",
      eventName: "Debugger.breakpointResolved.session-5",
    },
  ]);
  assert.equal(events.length, 1);
});

test("connectToBrowserTarget does not call Debugger.enable during attach", async () => {
  await disconnectActiveBrowserConnection();

  const sendCalls: Array<{ method: string; sessionId?: string }> = [];
  const fakeClient = {
    Target: {
      getTargets: async () => ({
        targetInfos: [
          {
            targetId: "target-1",
            type: "page",
            title: "page",
            url: "http://localhost/game",
            attached: false,
            canAccessOpener: false,
            browserContextId: "default",
          },
        ],
      }),
      attachToTarget: async () => ({ sessionId: "session-attach" }),
      detachFromTarget: async () => undefined,
    },
    send: async (method: string, params: unknown, sessionId?: string) => {
      sendCalls.push({ method, sessionId });

      if (method === "Runtime.evaluate") {
        return {
          result: { value: 2 },
        };
      }

      return {};
    },
    close: async () => undefined,
    on: () => undefined,
    off: () => undefined,
  };

  const result = await connectToBrowserTarget(
    { host: "localhost", port: 9222 },
    coreTargetProfile,
    createLocalizeMock(),
    undefined,
    {
      resolveWebSocketUrl: async () => "ws://127.0.0.1/devtools/browser/mock",
      createBrowserClient: async () => fakeClient as never,
    },
  );

  assert.equal(result.ok, true);

  const debuggerCalls = sendCalls.filter((entry) =>
    entry.method.startsWith("Debugger."),
  );

  assert.equal(
    sendCalls.some((entry) => entry.method === "Runtime.evaluate"),
    true,
  );
  assert.deepEqual(debuggerCalls, []);

  const activeConnection = getActiveBrowserConnection();
  assert.ok(activeConnection);
  assert.equal(
    typeof activeConnection?.debugger.setBreakpointByUrl,
    "function",
  );

  await disconnectActiveBrowserConnection();
});

test("createBrowserDebuggerSession stepOver forwards to the scoped session", async () => {
  const sendCalls: Array<{
    method: string;
    params: unknown;
    sessionId?: string;
  }> = [];

  const session = createBrowserDebuggerSession(
    {
      send: async (method: string, params: unknown, sessionId?: string) => {
        sendCalls.push({ method, params, sessionId });
        return undefined;
      },
      on: () => undefined,
      off: () => undefined,
    } as never,
    "session-stepover",
  );

  await session.stepOver();

  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0]?.method, "Debugger.stepOver");
  assert.equal(sendCalls[0]?.sessionId, "session-stepover");
});

test("createBrowserDebuggerSession stepInto forwards to the scoped session", async () => {
  const sendCalls: Array<{
    method: string;
    params: unknown;
    sessionId?: string;
  }> = [];

  const session = createBrowserDebuggerSession(
    {
      send: async (method: string, params: unknown, sessionId?: string) => {
        sendCalls.push({ method, params, sessionId });
        return undefined;
      },
      on: () => undefined,
      off: () => undefined,
    } as never,
    "session-stepinto",
  );

  await session.stepInto();

  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0]?.method, "Debugger.stepInto");
  assert.equal(sendCalls[0]?.sessionId, "session-stepinto");
});

test("createBrowserDebuggerSession stepOut forwards to the scoped session", async () => {
  const sendCalls: Array<{
    method: string;
    params: unknown;
    sessionId?: string;
  }> = [];

  const session = createBrowserDebuggerSession(
    {
      send: async (method: string, params: unknown, sessionId?: string) => {
        sendCalls.push({ method, params, sessionId });
        return undefined;
      },
      on: () => undefined,
      off: () => undefined,
    } as never,
    "session-stepout",
  );

  await session.stepOut();

  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0]?.method, "Debugger.stepOut");
  assert.equal(sendCalls[0]?.sessionId, "session-stepout");
});

test("createBrowserDebuggerSession pause forwards to the scoped session", async () => {
  const sendCalls: Array<{
    method: string;
    params: unknown;
    sessionId?: string;
  }> = [];

  const session = createBrowserDebuggerSession(
    {
      send: async (method: string, params: unknown, sessionId?: string) => {
        sendCalls.push({ method, params, sessionId });
        return undefined;
      },
      on: () => undefined,
      off: () => undefined,
    } as never,
    "session-pause",
  );

  await session.pause();

  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0]?.method, "Debugger.pause");
  assert.equal(sendCalls[0]?.sessionId, "session-pause");
});

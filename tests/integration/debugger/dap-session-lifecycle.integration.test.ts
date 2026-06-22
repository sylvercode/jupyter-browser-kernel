import test, { after, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import CDP from "chrome-remote-interface";
import type { DebugProtocol } from "@vscode/debugprotocol";

import {
  connectToBrowserTarget,
  disconnectActiveBrowserConnection,
  getActiveBrowserConnection,
  type BrowserDebuggerSession,
} from "../../../src/transport/browser-connect.js";
import { coreTargetProfile } from "../../../src/profile/core-target-profile.js";
import { startHeadlessChromium } from "../helpers/headless-chromium.js";
import { createDebugSessionManager } from "../../../src/debugger/debug-session-manager.js";
import { NotebookDebugAdapter } from "../../../src/debugger/notebook-dap-adapter.js";

// Helper: create a DAP request sender for an adapter + message buffer pair.
function makeAdapterRequest(
  adapter: NotebookDebugAdapter,
  messages: DebugProtocol.ProtocolMessage[],
): (
  command: string,
  args?: Record<string, unknown>,
) => Promise<DebugProtocol.Response> {
  let seq = 0;
  return async (command, args) => {
    seq += 1;
    const requestSeq = seq;
    const dapRequest: DebugProtocol.Request = {
      seq: requestSeq,
      type: "request",
      command,
      arguments: args,
    };
    adapter.handleMessage(dapRequest);
    for (let i = 0; i < 160; i += 1) {
      const response = messages.find(
        (m) =>
          m.type === "response" &&
          (m as DebugProtocol.Response).request_seq === requestSeq,
      ) as DebugProtocol.Response | undefined;
      if (response) {
        return response;
      }
      await delay(25);
    }
    throw new Error(`No response for ${command} (seq ${requestSeq})`);
  };
}

// Helper: wait for the Nth stopped event (0-indexed) in the message buffer.
async function waitForStoppedEvent(
  messages: DebugProtocol.ProtocolMessage[],
  index: number,
  maxMs = 5000,
): Promise<DebugProtocol.StoppedEvent> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const stopped = messages.filter(
      (m) =>
        m.type === "event" && (m as DebugProtocol.Event).event === "stopped",
    );
    if (stopped.length > index) {
      return stopped[index] as DebugProtocol.StoppedEvent;
    }
    await delay(25);
  }
  throw new Error(`Timed out waiting for stopped event at index ${index}`);
}

const runIntegration = process.env.RUN_CDP_INTEGRATION === "1";
const host = process.env.CDP_HOST ?? "127.0.0.1";
const cdpPort = Number(process.env.CDP_PORT ?? "9222");
const appPort = Number(process.env.CDP_APP_PORT ?? "9322");

let chromiumStop: (() => Promise<void>) | undefined;
let appServer: http.Server | undefined;

before(async () => {
  if (!runIntegration) {
    return;
  }

  const chromium = await startHeadlessChromium(host, cdpPort);
  chromiumStop = chromium.stop;

  appServer = http.createServer((request, response) => {
    if (request.url === "/game") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<html><body>foundry-target</body></html>");
      return;
    }

    response.writeHead(200, { "content-type": "text/html" });
    response.end("<html><body>generic-target</body></html>");
  });

  await new Promise<void>((resolve, reject) => {
    appServer?.once("error", reject);
    appServer?.listen(appPort, host, () => {
      resolve();
    });
  });

  const browser = await CDP({ host, port: cdpPort });
  await browser.Target.createTarget({ url: `http://${host}:${appPort}/game` });
  await browser.close();
});

after(async () => {
  await disconnectActiveBrowserConnection();

  if (chromiumStop) {
    await chromiumStop();
  }

  await new Promise<void>((resolve) => {
    if (!appServer) {
      resolve();
      return;
    }

    appServer.close(() => {
      resolve();
    });
  });
});

afterEach(async () => {
  await disconnectActiveBrowserConnection();
});

test(
  "DAP lifecycle initialize->launch->threads->disconnect enables and disables Debugger",
  { skip: !runIntegration },
  async () => {
    const connected = await connectToBrowserTarget(
      { host, port: cdpPort },
      coreTargetProfile,
    );

    assert.equal(connected.ok, true);
    if (!connected.ok) {
      return;
    }

    const activeConnection = getActiveBrowserConnection();
    assert.ok(activeConnection);
    if (!activeConnection) {
      return;
    }

    const baseSession = activeConnection.debugger;
    let enableCalls = 0;
    let disableCalls = 0;
    let pausedListenerCount = 0;

    const instrumentedSession: BrowserDebuggerSession = {
      ...baseSession,
      enable: async () => {
        enableCalls += 1;
        await baseSession.enable();
      },
      disable: async () => {
        disableCalls += 1;
        await baseSession.disable();
      },
      onPaused: (listener) => {
        pausedListenerCount += 1;
        const subscription = baseSession.onPaused(listener);
        return {
          dispose: () => {
            pausedListenerCount -= 1;
            subscription.dispose();
          },
        };
      },
    };

    const manager = createDebugSessionManager({
      getDebuggerSession: () => instrumentedSession,
      logger: () => undefined,
    });

    const adapter = new NotebookDebugAdapter({
      sessionManager: manager,
    });

    const messages: DebugProtocol.ProtocolMessage[] = [];
    adapter.onDidSendMessage((message) => {
      messages.push(message as DebugProtocol.ProtocolMessage);
    });

    let seq = 0;
    const request = async (
      command: string,
      args?: Record<string, unknown>,
    ): Promise<DebugProtocol.Response> => {
      seq += 1;
      const requestSeq = seq;

      const dapRequest: DebugProtocol.Request = {
        seq: requestSeq,
        type: "request",
        command,
        arguments: args,
      };

      adapter.handleMessage(dapRequest);

      for (let waitStep = 0; waitStep < 120; waitStep += 1) {
        const response = messages.find((message) => {
          if (message.type !== "response") {
            return false;
          }

          const typed = message as DebugProtocol.Response;
          return typed.request_seq === requestSeq;
        }) as DebugProtocol.Response | undefined;

        if (response) {
          return response;
        }

        await delay(25);
      }

      throw new Error(`No response for ${command}`);
    };

    const initializeResponse = await request("initialize", {
      adapterID: "jupyter-browser-kernel",
      pathFormat: "path",
    });
    assert.equal(initializeResponse.success, true);

    const launchResponse = await request("launch", {});
    assert.equal(launchResponse.success, true);

    const threadsResponse = await request("threads", {});
    assert.equal(threadsResponse.success, true);

    const disconnectResponse = await request("disconnect", {});
    assert.equal(disconnectResponse.success, true);

    const initializedEvents = messages.filter(
      (message) =>
        message.type === "event" &&
        (message as DebugProtocol.Event).event === "initialized",
    );

    assert.equal(initializedEvents.length >= 1, true);
    assert.equal(enableCalls, 1);
    assert.equal(disableCalls, 1);
    assert.equal(pausedListenerCount, 0);

    adapter.dispose();
  },
);

// ── Task 8: Stepping sequence ─────────────────────────────────────────────────
// next → next → stepIn → stepOut → continue, asserting each StoppedEvent
// arrives and that frame source is resolved through DebugSessionManager
// (either via callFrame.url or the scriptUrlMap fallback).

test(
  "stepping sequence: next→next→stepIn→stepOut→continue each produce a StoppedEvent with resolved source",
  { skip: !runIntegration },
  async () => {
    let adapter: NotebookDebugAdapter | undefined;

    try {
      const connected = await connectToBrowserTarget(
        { host, port: cdpPort },
        coreTargetProfile,
      );
      assert.equal(connected.ok, true);
      if (!connected.ok) {
        return;
      }

      const activeConnection = getActiveBrowserConnection();
      assert.ok(activeConnection);
      if (!activeConnection) {
        return;
      }

      const manager = createDebugSessionManager({
        getDebuggerSession: () => activeConnection.debugger,
        logger: () => undefined,
      });

      adapter = new NotebookDebugAdapter({ sessionManager: manager });
      const messages: DebugProtocol.ProtocolMessage[] = [];
      adapter.onDidSendMessage((msg) => {
        messages.push(msg as DebugProtocol.ProtocolMessage);
      });

      const request = makeAdapterRequest(adapter, messages);

      await request("initialize", {
        adapterID: "jupyter-browser-kernel",
        pathFormat: "path",
      });
      await request("launch", {});

      // Script with enough steppable statements and a named inner function for
      // stepIn / stepOut.  All lines are 1-based as displayed by the debugger.
      const cellUrl = "vscode-notebook-cell://test/step-seq-10-5.js";
      const stepScript = [
        "function debugHelper(v) {", // 1
        "  const doubled = v * 2;", // 2  ← stepIn lands here
        "  return doubled;", // 3
        "}", // 4
        "(() => {", // 5
        "  const a = 1;", // 6  ← breakpoint
        "  const b = debugHelper(a);", // 7  ← next lands here; stepIn into this
        "  return b;", // 8  ← stepOut lands here
        "})();", // 9
        `//# sourceURL=${cellUrl}`,
      ].join("\n");

      // Register the source URL with Chromium (first evaluate does not need to
      // pause; any source URL is recorded by the Debugger domain).
      await activeConnection.debugger.evaluate({
        expression: stepScript,
        returnByValue: true,
      });

      // Set breakpoint at line 6.
      const setBpResp = await request("setBreakpoints", {
        source: { path: cellUrl },
        breakpoints: [{ line: 6 }],
      });
      assert.equal(setBpResp.success, true);

      // Evaluate (non-awaited) — will pause at the breakpoint.
      const evalPromise = activeConnection.debugger
        .evaluate({ expression: stepScript, returnByValue: true })
        .catch(() => undefined);

      // Initial pause at breakpoint.
      const stopped1 = await waitForStoppedEvent(messages, 0);
      assert.equal(
        (stopped1 as DebugProtocol.StoppedEvent).body?.reason,
        "breakpoint",
      );

      // Verify frame source resolves through scriptUrlMap / callFrame.url.
      const stackResp1 = await request("stackTrace", { threadId: 1 });
      const frames1 =
        (stackResp1 as DebugProtocol.StackTraceResponse).body?.stackFrames ??
        [];
      assert.ok(frames1.length > 0, "must have at least one stack frame");
      assert.equal(
        frames1[0]?.source?.path,
        cellUrl,
        "frame source must resolve to the cell URL",
      );

      // next → line 7.
      await request("next", { threadId: 1 });
      const stopped2 = await waitForStoppedEvent(messages, 1);
      assert.equal(
        (stopped2 as DebugProtocol.StoppedEvent).body?.reason,
        "step",
      );

      // Verify source still resolves on step pause (exercises scriptUrlMap path).
      const stackResp2 = await request("stackTrace", { threadId: 1 });
      const frames2 =
        (stackResp2 as DebugProtocol.StackTraceResponse).body?.stackFrames ??
        [];
      assert.ok(frames2.length > 0);
      assert.equal(
        frames2[0]?.source?.path,
        cellUrl,
        "frame source must resolve via scriptUrlMap after step",
      );

      // next → one more step.
      await request("next", { threadId: 1 });
      await waitForStoppedEvent(messages, 2);

      // stepIn → enters debugHelper.
      await request("stepIn", { threadId: 1 });
      await waitForStoppedEvent(messages, 3);

      // stepOut → returns to outer function.
      await request("stepOut", { threadId: 1 });
      await waitForStoppedEvent(messages, 4);

      // continue → script runs to completion.
      await request("continue", { threadId: 1 });
      await evalPromise;

      // All 5 stops arrived; the total stopped-event count must be exactly 5
      // (no duplicates from the single-subscriber model).
      const stoppedTotal = messages.filter(
        (m) =>
          m.type === "event" && (m as DebugProtocol.Event).event === "stopped",
      );
      assert.equal(
        stoppedTotal.length,
        5,
        "must have exactly 5 StoppedEvents: breakpoint + 4 steps",
      );

      await request("disconnect", {});
    } finally {
      adapter?.dispose();
    }
  },
);

// ── Task 8: Event ordering ────────────────────────────────────────────────────
// Three sequential next commands must produce exactly three StoppedEvents in
// order, with no duplicates — validating the single-subscriber pause model and
// the monotonic pauseVersion contract.

test(
  "event ordering: three sequential next commands produce exactly three StoppedEvents, no duplicates",
  { skip: !runIntegration },
  async () => {
    let adapter: NotebookDebugAdapter | undefined;

    try {
      const connected = await connectToBrowserTarget(
        { host, port: cdpPort },
        coreTargetProfile,
      );
      assert.equal(connected.ok, true);
      if (!connected.ok) {
        return;
      }

      const activeConnection = getActiveBrowserConnection();
      assert.ok(activeConnection);
      if (!activeConnection) {
        return;
      }

      const manager = createDebugSessionManager({
        getDebuggerSession: () => activeConnection.debugger,
        logger: () => undefined,
      });

      adapter = new NotebookDebugAdapter({ sessionManager: manager });
      const messages: DebugProtocol.ProtocolMessage[] = [];
      adapter.onDidSendMessage((msg) => {
        messages.push(msg as DebugProtocol.ProtocolMessage);
      });

      const request = makeAdapterRequest(adapter, messages);

      await request("initialize", {
        adapterID: "jupyter-browser-kernel",
        pathFormat: "path",
      });
      await request("launch", {});

      const cellUrl = "vscode-notebook-cell://test/event-order-10-5.js";
      const orderScript = [
        "(() => {",
        "  const a = 1;", // 2 ← breakpoint
        "  const b = a + 1;", // 3 ← next 1 lands
        "  const c = b + 1;", // 4 ← next 2 lands
        "  const d = c + 1;", // 5 ← next 3 lands
        "  return d;", // 6
        "})();", // 7
        `//# sourceURL=${cellUrl}`,
      ].join("\n");

      // Register source URL.
      await activeConnection.debugger.evaluate({
        expression: orderScript,
        returnByValue: true,
      });

      // Breakpoint at line 2.
      const setBpResp = await request("setBreakpoints", {
        source: { path: cellUrl },
        breakpoints: [{ line: 2 }],
      });
      assert.equal(setBpResp.success, true);

      // Evaluate (non-awaited) — pauses at breakpoint.
      const evalPromise = activeConnection.debugger
        .evaluate({ expression: orderScript, returnByValue: true })
        .catch(() => undefined);

      // Initial pause.
      await waitForStoppedEvent(messages, 0);

      // Three sequential next commands — each must produce one StoppedEvent.
      await request("next", { threadId: 1 });
      await waitForStoppedEvent(messages, 1);

      await request("next", { threadId: 1 });
      await waitForStoppedEvent(messages, 2);

      await request("next", { threadId: 1 });
      await waitForStoppedEvent(messages, 3);

      // Verify exactly 4 stopped events total (initial + 3 steps), no duplicates.
      const allStopped = messages.filter(
        (m) =>
          m.type === "event" && (m as DebugProtocol.Event).event === "stopped",
      );
      assert.equal(
        allStopped.length,
        4,
        "must have exactly 4 StoppedEvents: one initial + three step pauses, no duplicates",
      );

      // Verify all pauses have the expected reasons.
      assert.equal(
        (allStopped[0] as DebugProtocol.StoppedEvent).body?.reason,
        "breakpoint",
      );
      for (let i = 1; i <= 3; i += 1) {
        assert.equal(
          (allStopped[i] as DebugProtocol.StoppedEvent).body?.reason,
          "step",
          `stopped event ${i} must have reason 'step'`,
        );
      }

      // continue → finishes.
      await request("continue", { threadId: 1 });
      await evalPromise;

      await request("disconnect", {});
    } finally {
      adapter?.dispose();
    }
  },
);

// ── Task 8: Clean teardown ────────────────────────────────────────────────────
// After disconnect, Debugger.disable must be sent and all VariableStore
// objectIds reserved during a pause must be released via Runtime.releaseObject.

test(
  "clean teardown: disconnect sends Debugger.disable and releases reserved variable handles",
  { skip: !runIntegration },
  async () => {
    let adapter: NotebookDebugAdapter | undefined;

    try {
      const connected = await connectToBrowserTarget(
        { host, port: cdpPort },
        coreTargetProfile,
      );
      assert.equal(connected.ok, true);
      if (!connected.ok) {
        return;
      }

      const activeConnection = getActiveBrowserConnection();
      assert.ok(activeConnection);
      if (!activeConnection) {
        return;
      }

      const baseSession = activeConnection.debugger;
      let disableCalls = 0;
      let releaseObjectCalls = 0;

      const instrumentedSession: BrowserDebuggerSession = {
        ...baseSession,
        disable: async () => {
          disableCalls += 1;
          await baseSession.disable();
        },
        releaseObject: async (params) => {
          releaseObjectCalls += 1;
          await baseSession.releaseObject(params);
        },
      };

      const manager = createDebugSessionManager({
        getDebuggerSession: () => instrumentedSession,
        logger: () => undefined,
      });

      adapter = new NotebookDebugAdapter({ sessionManager: manager });
      const messages: DebugProtocol.ProtocolMessage[] = [];
      adapter.onDidSendMessage((msg) => {
        messages.push(msg as DebugProtocol.ProtocolMessage);
      });

      const request = makeAdapterRequest(adapter, messages);

      await request("initialize", {
        adapterID: "jupyter-browser-kernel",
        pathFormat: "path",
      });
      await request("launch", {});

      const cellUrl = "vscode-notebook-cell://test/teardown-10-5.js";
      const teardownScript = [
        "(() => {",
        "  const obj = { x: 1, y: 2 };", // 2 ← breakpoint (creates scope objects)
        "  return obj.x + obj.y;",
        "})();",
        `//# sourceURL=${cellUrl}`,
      ].join("\n");

      // Register source URL.
      await activeConnection.debugger.evaluate({
        expression: teardownScript,
        returnByValue: true,
      });

      // Set breakpoint at line 2.
      await request("setBreakpoints", {
        source: { path: cellUrl },
        breakpoints: [{ line: 2 }],
      });

      // Evaluate (non-awaited) — pauses at breakpoint.
      const evalPromise = activeConnection.debugger
        .evaluate({ expression: teardownScript, returnByValue: true })
        .catch(() => undefined);

      await waitForStoppedEvent(messages, 0);

      // Request scopes — this reserves objectIds in VariableStore that must be
      // released on disconnect.
      const stackResp = await request("stackTrace", { threadId: 1 });
      const frames =
        (stackResp as DebugProtocol.StackTraceResponse).body?.stackFrames ?? [];
      if (frames.length > 0) {
        const frameId = frames[0]!.id;
        await request("scopes", { frameId });
      }

      const releaseCountBeforeDisconnect = releaseObjectCalls;

      // Disconnect — must call Debugger.disable and release all reserved handles.
      await request("disconnect", {});
      await evalPromise;

      assert.equal(
        disableCalls,
        1,
        "Debugger.disable must be called exactly once on disconnect",
      );
      assert.ok(
        releaseObjectCalls > releaseCountBeforeDisconnect,
        `Runtime.releaseObject must be called for scope handles reserved during pause (got ${releaseObjectCalls - releaseCountBeforeDisconnect} calls after disconnect)`,
      );
    } finally {
      adapter?.dispose();
    }
  },
);

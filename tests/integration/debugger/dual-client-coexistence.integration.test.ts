/**
 * Dual-client CDP coexistence integration tests (Story 10.5, Task 9).
 *
 * These tests prove the architectural coexistence guarantee in CI: the DAP
 * adapter's flat CDP session and a second "DevTools" flat session on the same
 * browser target are truly independent — neither client forces the other to
 * disconnect, and each can pause/inspect/resume independently.
 *
 * Pattern (Spike Q3 from spike/cdp-multiplex-findings.md):
 *   - Connect one CRI client to the browser-level WebSocket (not a page WS).
 *   - Call Target.attachToTarget({ flatten: true }) twice on the same targetId
 *     to obtain two independent sessionIds.
 *   - Session 1 → NotebookDebugAdapter ("VS Code" client).
 *   - Session 2 → raw browser.send() calls ("DevTools" client).
 *
 * Gated by RUN_CDP_INTEGRATION=1.  Uses its own Chromium on CDP_DUAL_CLIENT_PORT
 * (default 9242) and its own HTTP app server on port 9342 so it never conflicts
 * with the lifecycle or breakpoint-binding integration suites.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import CDP from "chrome-remote-interface";
import type { DebugProtocol } from "@vscode/debugprotocol";

import { startHeadlessChromium } from "../helpers/headless-chromium.js";
import {
  createBrowserDebuggerSession,
  createAttachToTargetParams,
  toSessionScopedEventName,
} from "../../../src/transport/browser-connect.js";
import { createDebugSessionManager } from "../../../src/debugger/debug-session-manager.js";
import { NotebookDebugAdapter } from "../../../src/debugger/notebook-dap-adapter.js";

const runIntegration = process.env.RUN_CDP_INTEGRATION === "1";
const host = process.env.CDP_HOST ?? "127.0.0.1";
const dualClientCdpPort = Number(process.env.CDP_DUAL_CLIENT_PORT ?? "9242");
const dualClientAppPort = 9342;

let chromiumStop: (() => Promise<void>) | undefined;
let appServer: http.Server | undefined;

before(async () => {
  if (!runIntegration) {
    return;
  }

  const chromium = await startHeadlessChromium(host, dualClientCdpPort);
  chromiumStop = chromium.stop;

  appServer = http.createServer((request, response) => {
    if (request.url === "/game") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<html><body>foundry-dual-client-target</body></html>");
      return;
    }

    response.writeHead(200, { "content-type": "text/html" });
    response.end("<html><body>other</body></html>");
  });

  await new Promise<void>((resolve, reject) => {
    appServer?.once("error", reject);
    appServer?.listen(dualClientAppPort, host, () => {
      resolve();
    });
  });

  // Create the /game page target that both sessions will attach to.
  const setupBrowser = await CDP({ host, port: dualClientCdpPort });
  await setupBrowser.Target.createTarget({
    url: `http://${host}:${dualClientAppPort}/game`,
  });
  await setupBrowser.close();
});

after(async () => {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetch the browser-level WebSocket URL from /json/version so we can connect
 * to the shared browser WebSocket (not a per-page target WebSocket).
 * This is the entry point for flat-session multiplexing per the spike findings.
 */
async function getBrowserWebSocketUrl(
  browserHost: string,
  port: number,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const request = http.get(
      `http://${browserHost}:${port}/json/version`,
      (response) => {
        let payload = "";
        response.on("data", (chunk) => {
          payload += chunk;
        });
        response.on("end", () => {
          try {
            const info = JSON.parse(payload) as Record<string, unknown>;
            const wsUrl = info["webSocketDebuggerUrl"];
            if (typeof wsUrl !== "string") {
              reject(
                new Error("webSocketDebuggerUrl missing from /json/version"),
              );
              return;
            }
            // Rewrite 127.0.0.1 / localhost to the host we were given (handles
            // devcontainer / WSL scenarios where the browser runs on the host).
            resolve(
              wsUrl
                .replace("127.0.0.1", browserHost)
                .replace("localhost", browserHost),
            );
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("error", reject);
    request.setTimeout(5000, () => {
      request.destroy(new Error("Timeout fetching /json/version"));
    });
  });
}

/** Find the /game page target among all browser targets. */
async function findGameTarget(browser: CDP.Client): Promise<string> {
  const { targetInfos } = await browser.Target.getTargets();
  const target = targetInfos.find(
    (t) => t.type === "page" && t.url.includes("/game"),
  );
  if (!target) {
    throw new Error("No /game target found in browser targets");
  }

  return target.targetId;
}

/** Create a DAP request sender for an adapter + shared message buffer. */
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
    throw new Error(`No response for ${command}`);
  };
}

/** Wait until the message buffer contains at least index+1 stopped events. */
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

// ── Tests ─────────────────────────────────────────────────────────────────────

test(
  "dual-client: adapter session and DevTools second session coexist — resuming adapter leaves DevTools session independent",
  { skip: !runIntegration },
  async () => {
    let browser: CDP.Client | undefined;
    let adapter: NotebookDebugAdapter | undefined;

    try {
      const browserWsUrl = await getBrowserWebSocketUrl(
        host,
        dualClientCdpPort,
      );
      browser = await CDP({ target: browserWsUrl, local: true });
      const targetId = await findGameTarget(browser);

      // ── Session 1: the adapter ("VS Code") ──────────────────────────────
      const { sessionId: adapterSessionId } =
        await browser.Target.attachToTarget(
          createAttachToTargetParams(targetId),
        );
      const adapterDebuggerSession = createBrowserDebuggerSession(
        browser,
        adapterSessionId,
      );

      // ── Session 2: the "DevTools" second client ──────────────────────────
      const { sessionId: devtoolsSessionId } =
        await browser.Target.attachToTarget(
          createAttachToTargetParams(targetId),
        );

      assert.notEqual(
        adapterSessionId,
        devtoolsSessionId,
        "Two attachToTarget calls must yield distinct sessionIds",
      );

      // ── Adapter setup ────────────────────────────────────────────────────
      const manager = createDebugSessionManager({
        getDebuggerSession: () => adapterDebuggerSession,
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

      // Enable Debugger on the DevTools session independently.
      await browser.send("Debugger.enable", {}, devtoolsSessionId);

      // Track DevTools session pause/resume events.
      let devtoolsPauseCount = 0;
      let devtoolsResumedCount = 0;
      browser.on(
        toSessionScopedEventName("Debugger.paused", devtoolsSessionId),
        () => {
          devtoolsPauseCount += 1;
        },
      );
      browser.on(
        toSessionScopedEventName("Debugger.resumed", devtoolsSessionId),
        () => {
          devtoolsResumedCount += 1;
        },
      );

      // ── Script and breakpoint ────────────────────────────────────────────
      const cellUrl = "vscode-notebook-cell://test/dual-coexist.js";
      const coexistScript = [
        "(() => {",
        "  const a = 1;", // 2 ← breakpoint
        "  const b = a + 1;", // 3
        "  return b;", // 4
        "})();", // 5
        `//# sourceURL=${cellUrl}`,
      ].join("\n");

      // Register source URL (first run does not pause).
      await browser.send(
        "Runtime.evaluate",
        { expression: coexistScript, returnByValue: true },
        adapterSessionId,
      );

      const setBpResp = await request("setBreakpoints", {
        source: { path: cellUrl },
        breakpoints: [{ line: 2 }],
      });
      assert.equal(setBpResp.success, true);

      // Evaluate (non-awaited) — pauses at breakpoint.
      const evalPromise = (
        browser.send(
          "Runtime.evaluate",
          { expression: coexistScript, returnByValue: true },
          adapterSessionId,
        ) as Promise<unknown>
      ).catch(() => undefined);

      // Wait for adapter to receive stopped event.
      await waitForStoppedEvent(messages, 0);

      // Give the DevTools session a moment to receive its own pause event.
      const pauseDeadline = Date.now() + 2000;
      while (devtoolsPauseCount === 0 && Date.now() < pauseDeadline) {
        await delay(25);
      }
      assert.equal(
        devtoolsPauseCount,
        1,
        "DevTools session must also receive the Debugger.paused event",
      );

      // ── DevTools can inspect while adapter is paused ─────────────────────
      // The DevTools session must remain free to issue independent CDP calls
      // while the adapter's session is paused (proves no inter-session lock).
      const devtoolsEval1 = (await browser.send(
        "Runtime.evaluate",
        { expression: "1 + 1", returnByValue: true },
        devtoolsSessionId,
      )) as { result?: { value?: unknown } };
      assert.equal(
        devtoolsEval1?.result?.value,
        2,
        "DevTools session must remain functional while adapter is paused",
      );

      // ── Adapter resumes — DevTools session remains alive ─────────────────
      const continueResp = await request("continue", { threadId: 1 });
      assert.equal(continueResp.success, true);
      await evalPromise;

      const devtoolsEval2 = (await browser.send(
        "Runtime.evaluate",
        { expression: "2 + 2", returnByValue: true },
        devtoolsSessionId,
      )) as { result?: { value?: unknown } };
      assert.equal(
        devtoolsEval2?.result?.value,
        4,
        "DevTools session must remain usable after adapter resumed",
      );

      // ── Adapter disconnects — DevTools session remains alive ─────────────
      await request("disconnect", {});

      const devtoolsEval3 = (await browser.send(
        "Runtime.evaluate",
        { expression: "3 + 3", returnByValue: true },
        devtoolsSessionId,
      )) as { result?: { value?: unknown } };
      assert.equal(
        devtoolsEval3?.result?.value,
        6,
        "DevTools session must remain usable after adapter disconnected",
      );

      // Detach DevTools session cleanly.
      await browser.send("Target.detachFromTarget", {
        sessionId: devtoolsSessionId,
      });
    } finally {
      adapter?.dispose();
      await browser?.close().catch(() => undefined);
    }
  },
);

test(
  "dual-client: closing DevTools second session does not affect adapter session",
  { skip: !runIntegration },
  async () => {
    let browser: CDP.Client | undefined;
    let adapter: NotebookDebugAdapter | undefined;

    try {
      const browserWsUrl = await getBrowserWebSocketUrl(
        host,
        dualClientCdpPort,
      );
      browser = await CDP({ target: browserWsUrl, local: true });
      const targetId = await findGameTarget(browser);

      // Session 1: adapter.
      const { sessionId: adapterSessionId } =
        await browser.Target.attachToTarget(
          createAttachToTargetParams(targetId),
        );
      const adapterDebuggerSession = createBrowserDebuggerSession(
        browser,
        adapterSessionId,
      );

      // Session 2: DevTools.
      const { sessionId: devtoolsSessionId } =
        await browser.Target.attachToTarget(
          createAttachToTargetParams(targetId),
        );
      await browser.send("Debugger.enable", {}, devtoolsSessionId);

      const manager = createDebugSessionManager({
        getDebuggerSession: () => adapterDebuggerSession,
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

      // Confirm adapter is working before DevTools detach.
      const threadsResp1 = await request("threads", {});
      assert.equal(threadsResp1.success, true);

      // Close the DevTools session — must not crash or terminate the adapter.
      await browser.send("Target.detachFromTarget", {
        sessionId: devtoolsSessionId,
      });

      // Adapter must still respond normally after DevTools session detached.
      const threadsResp2 = await request("threads", {});
      assert.equal(
        threadsResp2.success,
        true,
        "adapter must respond to threads request after DevTools session detached",
      );

      // Evaluations via the adapter session must still work.
      const evalResult = (await browser.send(
        "Runtime.evaluate",
        { expression: "42", returnByValue: true },
        adapterSessionId,
      )) as { result?: { value?: unknown } };
      assert.equal(
        evalResult?.result?.value,
        42,
        "adapter session evaluation must work after DevTools session was detached",
      );

      // No TerminatedEvent must have been emitted.
      const terminatedEvents = messages.filter(
        (m) =>
          m.type === "event" &&
          (m as DebugProtocol.Event).event === "terminated",
      );
      assert.equal(
        terminatedEvents.length,
        0,
        "detaching DevTools session must not produce a TerminatedEvent on the adapter",
      );

      await request("disconnect", {});
    } finally {
      adapter?.dispose();
      await browser?.close().catch(() => undefined);
    }
  },
);

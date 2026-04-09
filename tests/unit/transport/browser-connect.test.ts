import test from "node:test";
import assert from "node:assert/strict";

import {
  rewriteBrowserWebSocketUrl,
  safeDetachFromTarget,
} from "../../../src/transport/browser-connect.js";

test("rewriteBrowserWebSocketUrl uses configured endpoint host and port", () => {
  const rewritten = rewriteBrowserWebSocketUrl(
    "ws://localhost:9222/devtools/browser/browser-id",
    { host: "host.docker.internal", port: 9333 },
  );

  assert.equal(
    rewritten,
    "ws://host.docker.internal:9333/devtools/browser/browser-id",
  );
});

test("rewriteBrowserWebSocketUrl preserves browser-reported loopback host", () => {
  const rewritten = rewriteBrowserWebSocketUrl(
    "ws://localhost:9222/devtools/browser/browser-id",
    { host: "localhost", port: 9222 },
  );

  assert.equal(rewritten, "ws://localhost:9222/devtools/browser/browser-id");
});

test("rewriteBrowserWebSocketUrl preserves IPv6 loopback from browser", () => {
  const rewritten = rewriteBrowserWebSocketUrl(
    "ws://[::1]:9222/devtools/browser/browser-id",
    { host: "localhost", port: 9222 },
  );

  assert.equal(rewritten, "ws://[::1]:9222/devtools/browser/browser-id");
});

test("rewriteBrowserWebSocketUrl preserves IPv6 loopback with IPv6 endpoint", () => {
  const rewritten = rewriteBrowserWebSocketUrl(
    "ws://[::1]:9222/devtools/browser/browser-id",
    { host: "::1", port: 9222 },
  );

  assert.equal(rewritten, "ws://[::1]:9222/devtools/browser/browser-id");
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

import test from "node:test";
import assert from "node:assert/strict";

import {
  createAttachToTargetParams,
  safeDetachFromTarget,
  toSessionScopedEventName,
} from "../../../src/transport/browser-connect.js";

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

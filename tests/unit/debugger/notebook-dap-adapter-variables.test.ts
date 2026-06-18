import test from "node:test";
import assert from "node:assert/strict";

import type { DebugProtocol } from "@vscode/debugprotocol";

import type { VariableStore } from "../../../src/debugger/variable-store.js";
import { createFakeDebuggerSession } from "../test-utils/browser-debugger-session-mock.js";
import { createFakeSessionManager } from "../test-utils/debug-session-manager-mock.js";
import { createAdapterHarness } from "../test-utils/notebook-dap-harness.js";

test("variables resolves properties and allocates child handles", async () => {
  const getPropertiesCalls: Array<{ objectId: string }> = [];
  const reserved: Array<{ objectId: string }> = [];

  const handles = new Map<
    number,
    { objectId: string; kind: "scope" | "object" | "array" }
  >([[1000, { objectId: "scope-obj", kind: "scope" }]]);

  let nextReference = 1001;

  const variableStore: VariableStore = {
    reserve: (entry) => {
      reserved.push({ objectId: entry.objectId });
      const value = nextReference;
      handles.set(value, entry);
      nextReference += 1;
      return value;
    },
    resolve: (variablesReference) => handles.get(variablesReference),
    clearForPause: async () => undefined,
    dispose: async () => undefined,
  };

  const manager = createFakeSessionManager({
    getDebuggerSession: () =>
      createFakeDebuggerSession({
        getProperties: async ({ objectId }) => {
          getPropertiesCalls.push({ objectId });
          return {
            result: [
              {
                name: "x",
                value: { type: "number", value: 2 },
              },
              {
                name: "obj",
                value: {
                  type: "object",
                  objectId: "child-obj",
                  description: "Object",
                },
              },
            ],
          } as never;
        },
      }),
    getVariableStore: () => variableStore,
  });

  const harness = createAdapterHarness(manager, { maxPolls: 40 });

  const response = await harness.sendRequest("variables", {
    variablesReference: 1000,
    start: 0,
    count: 2,
  });

  assert.equal(response.success, true);
  const variables =
    (response as DebugProtocol.VariablesResponse).body?.variables ?? [];
  assert.equal(variables.length, 2);
  assert.equal(variables[0]?.name, "x");
  assert.equal(variables[1]?.variablesReference > 0, true);
  assert.deepEqual(getPropertiesCalls, [{ objectId: "scope-obj" }]);
  assert.deepEqual(reserved, [{ objectId: "child-obj" }]);

  harness.adapter.dispose();
});

test("variables truncates oversized page requests with marker", async () => {
  const descriptors = Array.from({ length: 105 }, (_value, index) => ({
    name: `v${index}`,
    value: { type: "number", value: index },
  }));

  const variableStore: VariableStore = {
    reserve: () => 1001,
    resolve: () => ({ objectId: "scope-obj", kind: "scope" }),
    clearForPause: async () => undefined,
    dispose: async () => undefined,
  };

  const manager = createFakeSessionManager({
    getDebuggerSession: () =>
      createFakeDebuggerSession({
        getProperties: async () => ({ result: descriptors as never[] }),
      }),
    getVariableStore: () => variableStore,
  });

  const harness = createAdapterHarness(manager, { maxPolls: 40 });

  const response = await harness.sendRequest("variables", {
    variablesReference: 1000,
    start: 0,
    count: 150,
  });

  const variables =
    (response as DebugProtocol.VariablesResponse).body?.variables ?? [];
  assert.equal(variables.length, 101);
  assert.equal(variables[100]?.name, "… (5 more)");

  harness.adapter.dispose();
});

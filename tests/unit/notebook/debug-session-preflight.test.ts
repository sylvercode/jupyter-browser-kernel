import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveBrowserKernelLaunchConfiguration,
  type DebugLaunchCandidate,
  type DebugLaunchQuickPickItem,
} from "../../../src/notebook/index.js";
import { createLocalizeMock } from "../test-utils/localize-mock.js";

type FakeConfiguration = {
  type?: string;
  request?: string;
  name?: string;
};

type FakeWorkspaceFolder = {
  name: string;
  uri: string;
};

type FakeWorkspaceApi = {
  workspaceFolders?: FakeWorkspaceFolder[];
  getConfiguration: (
    section: string,
    scope?: string,
  ) => {
    get: (key: string) => unknown;
  };
};

function createWorkspaceApi(
  byScope: Map<string, FakeConfiguration[]>,
): FakeWorkspaceApi {
  const folders: FakeWorkspaceFolder[] = [];
  for (const scope of byScope.keys()) {
    if (scope === "global") {
      continue;
    }

    folders.push({
      name: scope,
      uri: scope,
    });
  }

  return {
    workspaceFolders: folders,
    getConfiguration: (_section: string, scope?: string) => ({
      get: (_key: string) => {
        if (typeof scope === "string") {
          return byScope.get(scope) ?? [];
        }

        return byScope.get("global") ?? [];
      },
    }),
  };
}

test("resolveBrowserKernelLaunchConfiguration returns the single viable config", async () => {
  const workspace = createWorkspaceApi(
    new Map([
      [
        "workspace-a",
        [
          { type: "node", request: "launch", name: "Node" },
          {
            type: "jupyter-browser-kernel",
            request: "launch",
            name: "Browser Kernel Debug",
          },
        ],
      ],
    ]),
  );

  const picks: DebugLaunchCandidate[] = [];
  const selected = await resolveBrowserKernelLaunchConfiguration({
    workspace: workspace as never,
    localize: createLocalizeMock(),
    showQuickPick: async (
      items: readonly DebugLaunchQuickPickItem[],
      _options: unknown,
    ) => {
      picks.push(...items.map((item) => item.candidate));
      return undefined;
    },
  });

  assert.equal(selected?.configuration.name, "Browser Kernel Debug");
  assert.equal(selected?.folder?.name, "workspace-a");
  assert.equal(picks.length, 0);
});

test("resolveBrowserKernelLaunchConfiguration prompts selection when multiple configs exist", async () => {
  const workspace = createWorkspaceApi(
    new Map([
      [
        "workspace-a",
        [
          {
            type: "jupyter-browser-kernel",
            request: "launch",
            name: "First",
          },
          {
            type: "jupyter-browser-kernel",
            request: "launch",
            name: "Second",
          },
        ],
      ],
    ]),
  );

  const selected = await resolveBrowserKernelLaunchConfiguration({
    workspace: workspace as never,
    localize: createLocalizeMock(),
    showQuickPick: async (
      items: readonly DebugLaunchQuickPickItem[],
      _options: unknown,
    ) => items[1],
  });

  assert.equal(selected?.configuration.name, "Second");
});

test("resolveBrowserKernelLaunchConfiguration returns undefined when no viable config exists", async () => {
  const workspace = createWorkspaceApi(
    new Map([
      ["workspace-a", [{ type: "node", request: "launch", name: "Node" }]],
      ["global", []],
    ]),
  );

  const selected = await resolveBrowserKernelLaunchConfiguration({
    workspace: workspace as never,
    localize: createLocalizeMock(),
    showQuickPick: async (
      _items: readonly DebugLaunchQuickPickItem[],
      _options: unknown,
    ) => undefined,
  });

  assert.equal(selected, undefined);
});

test("resolveBrowserKernelLaunchConfiguration deduplicates folder and workspace-level duplicates", async () => {
  const workspace = createWorkspaceApi(
    new Map([
      [
        "workspace-a",
        [
          {
            type: "jupyter-browser-kernel",
            request: "launch",
            name: "Browser Kernel Debug",
          },
        ],
      ],
      [
        "global",
        [
          {
            type: "jupyter-browser-kernel",
            request: "launch",
            name: "Browser Kernel Debug",
          },
        ],
      ],
    ]),
  );

  let quickPickCallCount = 0;
  const selected = await resolveBrowserKernelLaunchConfiguration({
    workspace: workspace as never,
    localize: createLocalizeMock(),
    showQuickPick: async (
      _items: readonly DebugLaunchQuickPickItem[],
      _options: unknown,
    ) => {
      quickPickCallCount += 1;
      return undefined;
    },
  });

  assert.equal(quickPickCallCount, 0);
  assert.equal(selected?.configuration.name, "Browser Kernel Debug");
  assert.equal(selected?.folder?.name, "workspace-a");
});

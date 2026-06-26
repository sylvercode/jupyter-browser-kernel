import test from "node:test";
import assert from "node:assert/strict";

import {
  createEnsureSessionReadyForExecution,
  resolveBrowserKernelLaunchConfiguration,
  resolveBrowserKernelLaunchSelection,
  type DebugLaunchCandidate,
  type DebugLaunchQuickPickItem,
  type ExecutionSessionPreflightApi,
} from "../../../src/notebook/index.js";
import type { ConnectionState } from "../../../src/transport/connection-state.js";
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

type Disposable = { dispose: () => void };

function createEmitter<T>(): {
  event: (listener: (value: T) => void) => Disposable;
  emit: (value: T) => void;
} {
  const listeners = new Set<(value: T) => void>();
  return {
    event: (listener) => {
      listeners.add(listener);
      return {
        dispose: () => {
          listeners.delete(listener);
        },
      };
    },
    emit: (value) => {
      for (const listener of listeners) {
        listener(value);
      }
    },
  };
}

type PreflightHarness = {
  api: ExecutionSessionPreflightApi;
  getStartDebuggingCalls: () => number;
  infoMessages: string[];
  warningMessages: string[];
  errorMessages: string[];
  setConnectionState: (state: ConnectionState) => void;
  setActiveConnection: (active: boolean) => void;
  setActiveSession: (session: { type: string } | undefined) => void;
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

function createPreflightHarness({
  byScope,
  initialConnectionState,
  initialHasActiveConnection,
  initialActiveSession,
  decisionQueue,
  quickPickSelectionIndex,
  onStartDebugging,
  throwOnStartSubscription,
}: {
  byScope: Map<string, FakeConfiguration[]>;
  initialConnectionState?: ConnectionState;
  initialHasActiveConnection?: boolean;
  initialActiveSession?: { type: string } | undefined;
  decisionQueue?: Array<string | undefined>;
  quickPickSelectionIndex?: number | undefined;
  onStartDebugging?: () => Promise<boolean>;
  throwOnStartSubscription?: boolean;
}): PreflightHarness {
  let connectionState: ConnectionState =
    initialConnectionState ?? "disconnected";
  let hasActiveConnection = initialHasActiveConnection ?? false;
  let activeSession = initialActiveSession;
  let startDebuggingCalls = 0;

  const connectionEmitter = createEmitter<ConnectionState>();
  const startEmitter = createEmitter<{ type: string }>();
  const terminateEmitter = createEmitter<{ type: string }>();

  const infoMessages: string[] = [];
  const warningMessages: string[] = [];
  const errorMessages: string[] = [];

  const localize = createLocalizeMock();
  const cancelAction = localize("Cancel");
  const decisions = [...(decisionQueue ?? [cancelAction])];

  const workspace = createWorkspaceApi(byScope);

  const api: ExecutionSessionPreflightApi = {
    debug: {
      get activeDebugSession() {
        return activeSession as never;
      },
      startDebugging: async () => {
        startDebuggingCalls += 1;
        if (onStartDebugging) {
          return onStartDebugging();
        }
        return false;
      },
      onDidStartDebugSession: (listener) => {
        if (throwOnStartSubscription) {
          throw new Error("subscription failure");
        }
        return startEmitter.event(
          listener as (value: { type: string }) => void,
        );
      },
      onDidTerminateDebugSession: (listener) =>
        terminateEmitter.event(listener as (value: { type: string }) => void),
    },
    workspace: workspace as never,
    window: {
      showInformationMessage: (async (message: string, ...items: string[]) => {
        infoMessages.push(message);
        if (items.length === 0) {
          return undefined;
        }
        return decisions.shift();
      }) as never,
      showWarningMessage: (async (message: string) => {
        warningMessages.push(message);
        return undefined;
      }) as never,
      showErrorMessage: (async (message: string) => {
        errorMessages.push(message);
        return undefined;
      }) as never,
      showQuickPick: (async (items: readonly DebugLaunchQuickPickItem[]) => {
        if (quickPickSelectionIndex === undefined) {
          return undefined;
        }
        return items[quickPickSelectionIndex];
      }) as never,
    },
    localize,
    getActiveConnection: () =>
      hasActiveConnection ? ({} as never) : undefined,
    getConnectionStateStore: () =>
      ({
        getState: () => connectionState,
      }) as never,
    subscribeConnectionState: (listener) => connectionEmitter.event(listener),
  };

  return {
    api,
    getStartDebuggingCalls: () => startDebuggingCalls,
    infoMessages,
    warningMessages,
    errorMessages,
    setConnectionState: (state) => {
      connectionState = state;
      connectionEmitter.emit(state);
    },
    setActiveConnection: (active) => {
      hasActiveConnection = active;
    },
    setActiveSession: (session) => {
      activeSession = session;
      if (session) {
        startEmitter.emit(session);
      } else {
        terminateEmitter.emit({ type: "jupyter-browser-kernel" });
      }
    },
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

test("resolveBrowserKernelLaunchSelection returns cancelled when picker is dismissed", async () => {
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

  const result = await resolveBrowserKernelLaunchSelection({
    workspace: workspace as never,
    localize: createLocalizeMock(),
    showQuickPick: async () => undefined,
  });

  assert.equal(result.outcome, "cancelled");
  assert.equal(result.candidate, undefined);
});

test("createEnsureSessionReadyForExecution does not treat missing state as connected", async () => {
  const localize = createLocalizeMock();
  let showPromptCalls = 0;

  const ensure = createEnsureSessionReadyForExecution({
    debug: {
      activeDebugSession: undefined,
      startDebugging: async () => false,
      onDidStartDebugSession: () => ({ dispose: () => undefined }),
      onDidTerminateDebugSession: () => ({ dispose: () => undefined }),
    },
    workspace: createWorkspaceApi(new Map()) as never,
    window: {
      showInformationMessage: (async (_message: string, ...items: string[]) => {
        if (items.length > 0) {
          showPromptCalls += 1;
        }
        return localize("Cancel");
      }) as never,
      showWarningMessage: (async () => undefined) as never,
      showErrorMessage: (async () => undefined) as never,
      showQuickPick: (async () => undefined) as never,
    },
    localize,
    getActiveConnection: () => ({}) as never,
    getConnectionStateStore: () => undefined,
  });

  const result = await ensure();
  assert.equal(result.ready, false);
  assert.equal(showPromptCalls, 1);
});

test("createEnsureSessionReadyForExecution treats quick pick dismissal as user cancellation", async () => {
  const harness = createPreflightHarness({
    byScope: new Map([
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
    decisionQueue: ["Start"],
    quickPickSelectionIndex: undefined,
  });

  const ensure = createEnsureSessionReadyForExecution(harness.api);
  const result = await ensure();

  assert.equal(result.ready, false);
  assert.equal(harness.errorMessages.length, 0);
  assert.equal(
    harness.infoMessages.includes(
      "Cell execution canceled. Start a Browser Kernel debug session to run notebook cells.",
    ),
    true,
  );
});

test("createEnsureSessionReadyForExecution coalesces concurrent preflight calls", async () => {
  const harness = createPreflightHarness({
    byScope: new Map([
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
    ]),
    decisionQueue: ["Start"],
    onStartDebugging: async () => {
      harness.setActiveConnection(true);
      harness.setConnectionState("connected");
      harness.setActiveSession({ type: "jupyter-browser-kernel" });
      return true;
    },
  });

  const ensure = createEnsureSessionReadyForExecution(harness.api);
  const [first, second] = await Promise.all([ensure(), ensure()]);

  assert.equal(first.ready, true);
  assert.equal(second.ready, true);
  assert.equal(harness.getStartDebuggingCalls(), 1);
  assert.equal(
    harness.infoMessages.filter(
      (message) =>
        message ===
        "No active Browser Kernel debug session. Start one to run this cell?",
    ).length,
    1,
  );
});

test("createEnsureSessionReadyForExecution exits quickly when active session disappears before wait setup", async () => {
  let activeSessionReads = 0;
  const localize = createLocalizeMock();

  const ensure = createEnsureSessionReadyForExecution({
    debug: {
      get activeDebugSession() {
        activeSessionReads += 1;
        if (activeSessionReads === 1) {
          return { type: "jupyter-browser-kernel" } as never;
        }
        return undefined;
      },
      startDebugging: async () => false,
      onDidStartDebugSession: () => ({ dispose: () => undefined }),
      onDidTerminateDebugSession: () => ({ dispose: () => undefined }),
    },
    workspace: createWorkspaceApi(new Map()) as never,
    window: {
      showInformationMessage: async () => undefined,
      showWarningMessage: async () => undefined,
      showErrorMessage: async () => undefined,
      showQuickPick: async () => undefined,
    },
    localize,
    getActiveConnection: () => undefined,
    getConnectionStateStore: () => ({ getState: () => "connecting" }) as never,
    subscribeConnectionState: () => ({ dispose: () => undefined }),
  });

  const result = await Promise.race([
    ensure(),
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error("ensure() did not resolve promptly"));
      }, 200);
    }),
  ]);

  assert.equal(result.ready, false);
});

test("createEnsureSessionReadyForExecution handles subscription setup errors without throwing", async () => {
  const harness = createPreflightHarness({
    byScope: new Map(),
    initialActiveSession: { type: "jupyter-browser-kernel" },
    throwOnStartSubscription: true,
  });

  const ensure = createEnsureSessionReadyForExecution(harness.api);
  const result = await ensure();

  assert.equal(result.ready, false);
  assert.equal(harness.warningMessages.length >= 1, true);
});

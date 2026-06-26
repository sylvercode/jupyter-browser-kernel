import type * as vscode from "vscode";
import type ProtocolMappingApi from "devtools-protocol/types/protocol-mapping";

import type { BrowserDebuggerSession } from "../transport/browser-connect";
import {
  onDidChangeConnectionState,
  type ConnectionStateStore,
} from "../transport/connection-state";
import type { Localize } from "../config/endpoint-config";
import { createVariableStore, type VariableStore } from "./variable-store";
import {
  createBreakpointRegistry,
  type BreakpointRegistry,
  type DesiredBreakpoint,
} from "./breakpoint-registry";

export type DebugSessionTerminationReason = "connection-lost";

export interface DebugBreakpointResolvedEvent {
  url: string;
  breakpointId: string;
  line: number;
  column?: number;
}

export interface DebugSessionManager {
  launch: () => Promise<void>;
  restart: () => Promise<void>;
  resume: () => Promise<void>;
  stepOver: () => Promise<void>;
  stepInto: () => Promise<void>;
  stepOut: () => Promise<void>;
  pause: () => Promise<void>;
  disconnect: () => Promise<void>;
  terminate: () => Promise<void>;
  getDebuggerSession: () => BrowserDebuggerSession | undefined;
  getBreakpointRegistry: () => BreakpointRegistry | undefined;
  getVariableStore: () => VariableStore | undefined;
  getPausedEvent: () => DebuggerPausedEvent | undefined;
  getPauseVersion: () => number;
  getScriptUrl: (scriptId: string) => string | undefined;
  recordSetBreakpoints: (url: string, desired: DesiredBreakpoint[]) => void;
  onDidTerminate: (
    listener: (reason: DebugSessionTerminationReason) => void,
  ) => vscode.Disposable;
  onDidPaused: (
    listener: (event: DebuggerPausedEvent) => void,
  ) => vscode.Disposable;
  onDidBreakpointResolved: (
    listener: (event: DebugBreakpointResolvedEvent) => void,
  ) => vscode.Disposable;
  dispose: () => void;
}

export interface DebugSessionManagerOptions {
  getDebuggerSession: () => BrowserDebuggerSession | undefined;
  logger: (message: string, error?: unknown) => void;
  localize?: Localize;
  ensureConnection?: () => Promise<void>;
  disconnectActiveConnection?: () => Promise<void>;
  connectionStateStore?: Pick<
    ConnectionStateStore,
    "cancelTransitions" | "setErrorContext" | "setState"
  >;
}

type DebuggerPausedEvent = ProtocolMappingApi.Events["Debugger.paused"][0];

interface DisposableLike {
  dispose: () => void;
}

class SimpleEmitter<T> {
  private readonly listeners = new Set<(value: T) => void>();

  public readonly event = (listener: (value: T) => void): DisposableLike => {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  };

  public fire(value: T): void {
    for (const listener of this.listeners) {
      listener(value);
    }
  }

  public dispose(): void {
    this.listeners.clear();
  }
}

const defaultLocalize = ((
  messageOrOptions: string | { message: string },
  ...args: unknown[]
): string => {
  const template =
    typeof messageOrOptions === "string"
      ? messageOrOptions
      : messageOrOptions.message;

  let rendered = template;
  for (const [index, value] of args.entries()) {
    rendered = rendered.replace(`{${index}}`, String(value));
  }

  return rendered;
}) as Localize;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }

  return String(error);
}

export function createDebugSessionManager({
  getDebuggerSession,
  logger,
  localize = defaultLocalize,
  ensureConnection,
  disconnectActiveConnection,
  connectionStateStore,
}: DebugSessionManagerOptions): DebugSessionManager {
  const terminateEmitter = new SimpleEmitter<DebugSessionTerminationReason>();
  const pausedEmitter = new SimpleEmitter<DebuggerPausedEvent>();
  const breakpointResolvedEmitter =
    new SimpleEmitter<DebugBreakpointResolvedEvent>();

  let pausedDisposable: vscode.Disposable | undefined;
  let breakpointResolvedDisposable: vscode.Disposable | undefined;
  let scriptParsedDisposable: vscode.Disposable | undefined;
  let runningSession: BrowserDebuggerSession | undefined;
  let breakpointRegistry: BreakpointRegistry | undefined;
  let variableStore: VariableStore | undefined;
  let pausedEvent: DebuggerPausedEvent | undefined;
  let pauseVersion = 0;
  let running = false;
  let emittedConnectionLost = false;
  const cachedBreakpointsByUrl = new Map<string, DesiredBreakpoint[]>();
  const scriptUrlMap = new Map<string, string>();

  const clearPausedSubscription = (): void => {
    pausedDisposable?.dispose();
    pausedDisposable = undefined;
  };

  const clearBreakpointResolvedSubscription = (): void => {
    breakpointResolvedDisposable?.dispose();
    breakpointResolvedDisposable = undefined;
  };

  const clearScriptParsedSubscription = (): void => {
    scriptParsedDisposable?.dispose();
    scriptParsedDisposable = undefined;
  };

  const stopRunningSession = async (): Promise<void> => {
    const sessionToStop = runningSession;
    const registryToClear = breakpointRegistry;
    const variableStoreToDispose = variableStore;
    running = false;
    runningSession = undefined;
    breakpointRegistry = undefined;
    variableStore = undefined;
    pausedEvent = undefined;
    pauseVersion = 0;
    clearPausedSubscription();
    clearBreakpointResolvedSubscription();
    clearScriptParsedSubscription();
    // scriptUrlMap is cleared so stale scriptId → URL entries from the
    // ended session do not bleed into a future session on the same target.
    scriptUrlMap.clear();

    if (!sessionToStop) {
      return;
    }

    if (registryToClear) {
      await registryToClear.clearAll();
    }

    if (variableStoreToDispose) {
      await variableStoreToDispose.dispose();
    }

    try {
      // Coexistence: session.disable() is scoped to this adapter's flat CDP
      // session only. The browser-level WebSocket connection and any other
      // DevTools flat sessions attached to the same target are unaffected.
      // Specifically, the CDP client is NOT closed here.
      await sessionToStop.disable();
    } catch {
      // Best-effort cleanup during shutdown.
    }
  };

  const disconnectFromStateChanges = onDidChangeConnectionState((state) => {
    if (!running || emittedConnectionLost) {
      return;
    }

    if (state !== "disconnected" && state !== "error") {
      return;
    }

    emittedConnectionLost = true;
    terminateEmitter.fire("connection-lost");
    void stopRunningSession();
  });

  const applyDisconnectedConnectionState = (): void => {
    connectionStateStore?.cancelTransitions();
    connectionStateStore?.setErrorContext(undefined);
    connectionStateStore?.setState("disconnected");
  };

  const disconnectWithStateReset = async (): Promise<void> => {
    try {
      await stopRunningSession();
      await disconnectActiveConnection?.();
    } catch (error) {
      logger(
        "Failed to disconnect active browser connection during debug stop: {0}",
        error,
      );
    } finally {
      applyDisconnectedConnectionState();
    }
  };

  const launch = async (): Promise<void> => {
    if (running) {
      return;
    }

    let session = getDebuggerSession();
    if (ensureConnection) {
      await ensureConnection();
      session = getDebuggerSession();
    }

    if (!session) {
      throw new Error(
        localize(
          "Cannot start debug session: connect to a browser target first.",
        ),
      );
    }

    emittedConnectionLost = false;

    let lostDuringEnable = false;
    const lostDuringEnableSub = onDidChangeConnectionState((state) => {
      if (state === "disconnected" || state === "error") {
        lostDuringEnable = true;
      }
    });

    // Register the scriptParsed listener BEFORE enabling the Debugger domain.
    // Debugger.enable replays Debugger.scriptParsed for already-parsed scripts;
    // registering first guarantees those replays are captured so stack-frame
    // source resolution works for scripts parsed before the debug session.
    clearScriptParsedSubscription();
    scriptParsedDisposable = session.onScriptParsed((event) => {
      if (event.url.length > 0) {
        scriptUrlMap.set(event.scriptId, event.url);
      }
    });

    try {
      await session.enable();
    } catch (error) {
      clearScriptParsedSubscription();
      scriptUrlMap.clear();
      lostDuringEnableSub.dispose();
      logger("Failed to enable Debugger domain on browser session: {0}", error);
      throw new Error(
        localize(
          "Failed to enable Debugger domain on browser session: {0}",
          toErrorMessage(error),
        ),
      );
    }
    lostDuringEnableSub.dispose();

    if (lostDuringEnable) {
      clearScriptParsedSubscription();
      scriptUrlMap.clear();
      try {
        await session.disable();
      } catch {
        // Best-effort cleanup; connection is already gone.
      }
      throw new Error(
        localize("Browser connection lost; debug session terminated."),
      );
    }

    clearPausedSubscription();
    pausedDisposable = session.onPaused((event) => {
      // Single-subscriber model: this is the only onPaused listener.
      // Incrementing pauseVersion atomically with each event provides
      // deterministic ordering for the DAP adapter without a separate
      // serialization module.
      pausedEvent = event;
      pauseVersion += 1;
      pausedEmitter.fire(event);
    });

    const nextVariableStore = createVariableStore({
      debuggerSession: session,
      logger,
    });
    variableStore = nextVariableStore;

    const nextRegistry = createBreakpointRegistry({
      debuggerSession: session,
      logger,
      localize,
    });
    breakpointRegistry = nextRegistry;

    clearBreakpointResolvedSubscription();
    breakpointResolvedDisposable = session.onBreakpointResolved((event) => {
      const registry = breakpointRegistry;
      if (!registry) {
        return;
      }

      const resolved = registry.resolveRuntimeBreakpoint(
        event.breakpointId,
        event.location,
      );

      if (!resolved) {
        return;
      }

      breakpointResolvedEmitter.fire(resolved);
    });

    for (const [url, desired] of cachedBreakpointsByUrl.entries()) {
      await nextRegistry.replace(url, desired);
    }

    runningSession = session;
    running = true;
  };

  return {
    launch,
    restart: async () => {
      await stopRunningSession();

      if (disconnectActiveConnection) {
        await disconnectActiveConnection();
      }

      await launch();
    },
    resume: async () => {
      const session = runningSession;
      if (!session) {
        return;
      }

      await session.resume();

      pausedEvent = undefined;
      pauseVersion += 1;
    },
    stepOver: async () => {
      const session = runningSession;
      if (!session) {
        return;
      }

      await session.stepOver();
    },
    stepInto: async () => {
      const session = runningSession;
      if (!session) {
        return;
      }

      await session.stepInto();
    },
    stepOut: async () => {
      const session = runningSession;
      if (!session) {
        return;
      }

      await session.stepOut();
    },
    pause: async () => {
      const session = runningSession;
      if (!session) {
        return;
      }

      await session.pause();
    },
    disconnect: async () => {
      await disconnectWithStateReset();
    },
    terminate: async () => {
      await disconnectWithStateReset();
    },
    getDebuggerSession: () => runningSession,
    getBreakpointRegistry: () => breakpointRegistry,
    getVariableStore: () => variableStore,
    getPausedEvent: () => pausedEvent,
    getPauseVersion: () => pauseVersion,
    getScriptUrl: (scriptId) => scriptUrlMap.get(scriptId),
    recordSetBreakpoints: (url, desired) => {
      cachedBreakpointsByUrl.set(url, [...desired]);
    },
    onDidTerminate: (listener) => terminateEmitter.event(listener),
    onDidPaused: (listener) => pausedEmitter.event(listener),
    onDidBreakpointResolved: (listener) =>
      breakpointResolvedEmitter.event(listener),
    dispose: () => {
      disconnectFromStateChanges.dispose();
      clearPausedSubscription();
      clearBreakpointResolvedSubscription();
      clearScriptParsedSubscription();
      terminateEmitter.dispose();
      pausedEmitter.dispose();
      breakpointResolvedEmitter.dispose();
      const variableStoreToDispose = variableStore;
      running = false;
      runningSession = undefined;
      breakpointRegistry = undefined;
      variableStore = undefined;
      pausedEvent = undefined;
      pauseVersion = 0;
      emittedConnectionLost = false;
      if (variableStoreToDispose) {
        void variableStoreToDispose.dispose();
      }
    },
  };
}

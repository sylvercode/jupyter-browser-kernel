import type ProtocolMappingApi from "devtools-protocol/types/protocol-mapping";

import type {
  DebugSessionManager,
  DebugSessionTerminationReason,
  DebugBreakpointResolvedEvent,
} from "../../../src/debugger/debug-session-manager.js";
import type { DesiredBreakpoint } from "../../../src/debugger/breakpoint-registry.js";

import { createFakeVariableStore } from "./variable-store-mock.js";

type DebuggerPausedEvent = ProtocolMappingApi.Events["Debugger.paused"][0];

export function createFakeSessionManager(
  overrides: Partial<DebugSessionManager> = {},
): DebugSessionManager {
  const variableStore = createFakeVariableStore();

  return {
    launch: overrides.launch ?? (async () => undefined),
    restart: overrides.restart ?? (async () => undefined),
    resume: overrides.resume ?? (async () => undefined),
    stepOver: overrides.stepOver ?? (async () => undefined),
    stepInto: overrides.stepInto ?? (async () => undefined),
    stepOut: overrides.stepOut ?? (async () => undefined),
    pause: overrides.pause ?? (async () => undefined),
    disconnect: overrides.disconnect ?? (async () => undefined),
    terminate: overrides.terminate ?? (async () => undefined),
    getDebuggerSession: overrides.getDebuggerSession ?? (() => undefined),
    getBreakpointRegistry: overrides.getBreakpointRegistry ?? (() => undefined),
    getVariableStore: overrides.getVariableStore ?? (() => variableStore),
    getPausedEvent: overrides.getPausedEvent ?? (() => undefined),
    getPauseVersion: overrides.getPauseVersion ?? (() => 0),
    getScriptUrl: overrides.getScriptUrl ?? (() => undefined),
    recordSetBreakpoints:
      overrides.recordSetBreakpoints ??
      ((_url: string, _desired: DesiredBreakpoint[]) => undefined),
    onDidTerminate:
      overrides.onDidTerminate ??
      ((_listener: (reason: DebugSessionTerminationReason) => void) => ({
        dispose: () => undefined,
      })),
    onDidPaused:
      overrides.onDidPaused ??
      ((_listener: (event: DebuggerPausedEvent) => void) => ({
        dispose: () => undefined,
      })),
    onDidBreakpointResolved:
      overrides.onDidBreakpointResolved ??
      ((_listener: (event: DebugBreakpointResolvedEvent) => void) => ({
        dispose: () => undefined,
      })),
    dispose: overrides.dispose ?? (() => undefined),
  };
}

import type ProtocolMappingApi from "devtools-protocol/types/protocol-mapping";

import type { BrowserDebuggerSession } from "../../../src/transport/browser-connect.js";

type DebuggerPausedEvent = ProtocolMappingApi.Events["Debugger.paused"][0];
type DebuggerBreakpointResolvedEvent =
  ProtocolMappingApi.Events["Debugger.breakpointResolved"][0];
type DebuggerScriptParsedEvent =
  ProtocolMappingApi.Events["Debugger.scriptParsed"][0];

export function createFakeDebuggerSession(
  overrides: Partial<BrowserDebuggerSession> = {},
): BrowserDebuggerSession {
  return {
    enable: overrides.enable ?? (async () => undefined),
    disable: overrides.disable ?? (async () => undefined),
    setBreakpointByUrl:
      overrides.setBreakpointByUrl ??
      (async () => ({
        breakpointId: "bp-1",
        locations: [],
      })),
    removeBreakpoint: overrides.removeBreakpoint ?? (async () => undefined),
    getProperties: overrides.getProperties ?? (async () => ({ result: [] })),
    evaluateOnCallFrame:
      overrides.evaluateOnCallFrame ??
      (async () => ({
        result: { type: "undefined" },
      })),
    releaseObject: overrides.releaseObject ?? (async () => undefined),
    evaluate:
      overrides.evaluate ??
      (async () => ({
        result: { type: "undefined" },
      })),
    resume: overrides.resume ?? (async () => undefined),
    stepOver: overrides.stepOver ?? (async () => undefined),
    stepInto: overrides.stepInto ?? (async () => undefined),
    stepOut: overrides.stepOut ?? (async () => undefined),
    pause: overrides.pause ?? (async () => undefined),
    onPaused:
      overrides.onPaused ??
      ((_listener: (event: DebuggerPausedEvent) => void) => ({
        dispose: () => undefined,
      })),
    onResumed:
      overrides.onResumed ??
      ((_listener: () => void) => ({
        dispose: () => undefined,
      })),
    isPaused: overrides.isPaused ?? (() => false),
    onBreakpointResolved:
      overrides.onBreakpointResolved ??
      ((_listener: (event: DebuggerBreakpointResolvedEvent) => void) => ({
        dispose: () => undefined,
      })),
    onScriptParsed:
      overrides.onScriptParsed ??
      ((_listener: (event: DebuggerScriptParsedEvent) => void) => ({
        dispose: () => undefined,
      })),
  };
}

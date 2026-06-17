---
storyId: "10.4"
storyKey: "10-4-implement-stepping-controls-and-pause-lifecycle-synchronization"
title: "Implement Stepping Controls and Pause Lifecycle Synchronization"
status: "backlog"
created: "2026-05-11"
epic: "10"
priority: "p0-blocker"
dependencies:
  [
    "10-1-register-and-bootstrap-notebook-cell-dap-session",
    "10-3-surface-stack-frames-scopes-and-variables-in-vs-code",
  ]
---

# Story 10.4: Implement Stepping Controls and Pause Lifecycle Synchronization

**Status:** backlog

## Story

As a developer,
I want continue, step in, step out, and next to work from VS Code,
So that execution control stays fully in the editor.

## Acceptance Criteria

### AC 1: Continue Button Resumes Execution

**Given** execution is paused at a breakpoint
**When** the user clicks "Continue" in VS Code debug toolbar
**Then** the adapter sends a resume command to the runtime debugger
**And** execution resumes immediately
**And** VS Code receives a `continued` event.

### AC 2: Step Over (Next) Executes One Line

**Given** execution is paused
**When** the user clicks "Step Over" (F10)
**Then** the adapter sends a step-over command to the runtime
**And** execution advances to the next line
**And** execution pauses again automatically
**And** VS Code updates the Call Stack and Variables panes with new state.

### AC 3: Step Into (Step In) Descends Into Function Calls

**Given** execution is paused on a line with a function call
**When** the user clicks "Step Into" (F11)
**Then** the adapter sends a step-into command to the runtime
**And** execution enters the called function (if source available)
**Or** execution steps over if called function is external/built-in
**And** execution pauses at the first line inside the function
**And** VS Code updates the stack frame to show the new frame.

### AC 4: Step Out (Finish) Returns to Caller

**Given** execution is paused inside a function
**When** the user clicks "Step Out" (Shift+F11)
**Then** the adapter sends a step-out command to the runtime
**And** execution continues to the end of the current function
**And** execution pauses at the return point in the caller
**And** VS Code updates the Call Stack to reflect the caller frame.

### AC 5: Event Ordering Remains Deterministic

**Given** rapid stepping events occur (e.g., user presses F10 repeatedly)
**When** the runtime pauses multiple times quickly
**Then** the adapter preserves event order and does not drop or reorder pause events
**And** no duplicate "paused" states appear in VS Code
**And** the adapter waits for each step to complete before accepting the next command (no parallel steps).

### AC 6: Runtime Pause Events Are Reliably Synchronized

**Given** the user does not explicitly pause (e.g., runs to completion)
**When** execution completes or a breakpoint is hit naturally
**Then** the runtime emits a `Debugger.paused` event
**And** the adapter receives and relays it to VS Code
**And** VS Code receives `stopped` event with reason and updated state.

## Tasks / Subtasks

> **Implementation note (already in place from Stories 10.1 / 10.3):** `continueRequest`, the session-manager pause subscription (`DebugSessionManager.onDidPaused`), the adapter's `emitStopped` → `StoppedEvent` path, and the CDP-reason → DAP-reason mapping (`resolveStoppedReason`) already exist and are tested. The genuinely new work in this story is the three step commands on the transport and the three step request handlers on the adapter. Tasks below labeled **(verify existing)** must be confirmed and reused — do NOT re-implement or duplicate them.

### 1. Verify `continue` DAP Request Handler (AC: 1) — (verify existing)

- [ ] `continueRequest(response, _args)` already exists in [src/debugger/notebook-dap-adapter.ts](../../src/debugger/notebook-dap-adapter.ts). Confirm it: calls `sessionManager.resume()`, sets `response.body.allThreadsContinued = true`, sends the response, then emits `new ContinuedEvent(1, true)`, and returns a localized error response if `resume()` rejects.
- [ ] Do NOT call `BrowserDebuggerSession.resume()` directly from the adapter and do NOT call `clearForPause()` inline. Resume is routed through `DebugSessionManager.resume()`, which already clears `pausedEvent` and increments `pauseVersion`; the variable store's `clearForPause()` is already invoked from `ensurePausedFrames()` on the next pause.
- [ ] No changes are expected here unless a defect is found — add a regression test only if missing.

### 2. Implement `next` / `stepIn` / `stepOut` DAP Request Handlers (AC: 2, 3, 4)

- [ ] Add `nextRequest`, `stepInRequest`, `stepOutRequest` to the adapter, mirroring the existing `continueRequest` shape. Each handler:
  - Calls the matching method on `DebugSessionManager` (Task 6): `stepOver`, `stepInto`, or `stepOut`, which routes to `BrowserDebuggerSession` (Task 5).
  - Sets `response.body.allThreadsContinued = true` (where the response type supports it), sends the response, then emits `new ContinuedEvent(1, true)`.
  - Returns a localized DAP error response if the step command rejects, leaving the session in its prior state.
- [ ] Do NOT call `clearForPause()` inline — the existing `ensurePausedFrames()` path already clears stale variable handles when the next pause arrives (`pauseVersion` changes).
- [ ] No `awaitingStepCompletion` flag is required. CDP reports `Debugger.paused.reason === "step"` after a step, and the existing `resolveStoppedReason` already maps that to the DAP `"step"` reason. The next pause is delivered through the existing `onDidPaused` subscription.

### 5. Extend `BrowserDebuggerSession` for Stepping (AC: 1–4)

- [ ] Extend `BrowserDebuggerSession` in [src/transport/browser-connect.ts](../../src/transport/browser-connect.ts) (no new transport file). Add the three step methods alongside the existing `resume()`:
  - `stepOver(params?: ProtocolMappingApi.Commands["Debugger.stepOver"]["paramsType"][0]): Promise<void>` — wraps `Debugger.stepOver`.
  - `stepInto(params?: ProtocolMappingApi.Commands["Debugger.stepInto"]["paramsType"][0]): Promise<void>` — wraps `Debugger.stepInto`.
  - `stepOut(): Promise<void>` — wraps `Debugger.stepOut`.
- [ ] Each method sends the command on the per-target session and resolves on the CDP ack (no waiting for `Debugger.paused`).
- [ ] Add matching `stepOver` / `stepInto` / `stepOut` (and optional `pause`) methods to `DebugSessionManager` ([src/debugger/debug-session-manager.ts](../../src/debugger/debug-session-manager.ts)) that forward to `runningSession` and no-op when no session is running, mirroring the existing `resume()` method. The adapter calls the manager, never `BrowserDebuggerSession` directly.
- [ ] Update [tests/unit/transport/browser-connect.test.ts](../../tests/unit/transport/browser-connect.test.ts) with forwarding tests for each method.

### 6. Consume `Debugger.paused` From the Session Manager (AC: 5, 6) — (verify existing)

- [ ] The session manager already owns the sole subscription to `BrowserDebuggerSession.onPaused` and re-broadcasts via `DebugSessionManager.onDidPaused` ([src/debugger/debug-session-manager.ts](../../src/debugger/debug-session-manager.ts)). The adapter already subscribes (`this.pausedSubscription`) and runs `emitStopped`. Confirm this wiring; do NOT add a second subscription.
- [ ] The existing `emitStopped` already:
  1. Relies on `ensurePausedFrames()` to cache `pausedEvent.callFrames` (Story 10.3).
  2. Maps the CDP reason via `resolveStoppedReason` to the DAP vocabulary (`"step"`, `"breakpoint"`, `"exception"`, `"pause"`). CDP natively reports `"step"` after a step, so no manual override is needed.
  3. Emits `new StoppedEvent(reason, 1, exceptionText)`.
- [ ] **`Debugger.resumed` exists and is already wired.** The transport subscribes to it and exposes `onResumed` (used by the pause-aware evaluation timeout). The adapter does not need it for stepping: `ContinuedEvent` is emitted immediately by the step/continue handlers, and the next state change arrives via the existing `onDidPaused` subscription or session termination.

### 7. Pause Subscription Lifecycle (AC: 5, 6) — (verify existing)

- [ ] The pause subscription is already owned by the session manager for the lifetime of the session and disposed on `terminate`/`disconnect`/`dispose` (`clearPausedSubscription`). The adapter disposes its own `pausedSubscription` in `dispose()`. Confirm only; no new lifecycle code is expected.

### 8. Pause Event Ordering (AC: 5) — (verify existing, extend only if a gap is proven)

- [ ] For the single-threaded notebook runtime, pause ordering is already deterministic: the session manager is the single synchronous subscriber, increments a monotonic `pauseVersion`, and stores the latest `pausedEvent`. VS Code issues one step/continue at a time and waits for the resulting `stopped` event.
- [ ] Do NOT add a new `pause-event-serializer.ts` unless a concrete ordering or duplicate-delivery defect is reproduced against this single-thread model. If a defect is found, document the reproduction in the Dev Agent Record before adding serialization, and prefer extending the existing session-manager path over a new module.

### 9. Step Completion Without a Pause (AC: 2–5, 6)

- [ ] No client-side timeout. If the program runs to completion after a step, V8 will not send another `Debugger.paused`. Termination is observed independently:
  - A target detached / connection lost event from the transport surfaces a DAP `terminated` event via the session manager (Story 10.1).
  - Without termination and without pause, the session legitimately stays in the running state — VS Code's UI handles this correctly.
- [ ] Do NOT introduce a synthetic timeout that emits `terminated`; that would race with normal long-running scripts.

### 10. Optional Explicit Pause (AC: 6)

- [ ] The existing `initializeRequest` capability set already omits `supportsRestartFrame`, `supportsStepBack`, and `supportsTerminateThreadsRequest` (default `false`), so no capability change is required for stepping — it is implicitly supported. Only touch the capability set if you add `pauseRequest`.
- [ ] (Optional) Add a DAP `pauseRequest` handler that calls `DebugSessionManager.pause()` → `BrowserDebuggerSession.pause()` (`Debugger.pause` on the per-target session, added in Task 5). On success, the next `Debugger.paused` becomes the user-initiated pause and flows through the existing `onDidPaused` path.

### 11. Add Unit Tests (AC: 1–6)

- [ ] `tests/unit/debugger/notebook-dap-adapter-stepping.test.ts`: each of `next`/`stepIn`/`stepOut` calls the matching `DebugSessionManager` step method exactly once, emits `ContinuedEvent(1, true)`, and resolves immediately; failure paths return localized DAP errors. Include a regression assertion that `continue` still behaves identically.
- [ ] `tests/unit/debugger/debug-session-manager.test.ts` (update): `stepOver`/`stepInto`/`stepOut`/`pause` forward to `runningSession` and no-op when no session is running.
- [ ] `tests/unit/debugger/notebook-dap-adapter-paused.test.ts`: confirm CDP `"step"` reason maps to DAP `"step"`; CDP `"breakpoint"` with populated `hitBreakpoints` maps to `"breakpoint"`; `"exception"` maps to `"exception"` (these exercise the existing `resolveStoppedReason`).
- [ ] `tests/unit/transport/browser-connect.test.ts` (update): forwarding tests for `stepOver`/`stepInto`/`stepOut`/`pause`.

### 12. Run Full Validation Suite (AC: 1–6)

- [ ] Run `npm run lint` — no new warnings.
- [ ] Run `npm run test:unit` — all tests pass.
- [ ] Run `npm run compile` — clean compilation.
- [ ] (Manual) In Extension Development Host:
  - [ ] Set breakpoint in notebook cell.
  - [ ] Run cell and pause at breakpoint.
  - [ ] Click "Continue" and verify execution resumes.
  - [ ] Set breakpoint again, pause, and verify "Step Over" advances one line.
  - [ ] Verify "Step Into" descends into a function call (if applicable).
  - [ ] Verify "Step Out" returns to caller.
  - [ ] Test rapid stepping (press F10 multiple times quickly) and verify no drops or reordering.
  - [ ] Verify VS Code Call Stack and Variables update after each step.

## Dev Notes

### Story Context and Scope

This is the **fourth story in Epic 10** and focuses on execution control (stepping) and pause-event synchronization. It builds on prior stories' DAP foundation and frame/variable resolution.

**Scope boundary:** This story covers stepping and pause events. Conditional stepping and breakpoint conditions are deferred. Reverse execution (debugger reversing) is not in scope for any MVP plan.

### Architecture Guardrails (Must Follow)

- **`Debugger.resumed` exists — don't re-derive it.** The CDP `Debugger` domain DOES emit `Debugger.resumed`, and the transport already subscribes to it and exposes `onResumed` (consumed by the pause-aware evaluation timeout). Stepping does not need it: the DAP `ContinuedEvent` is emitted by the adapter immediately after issuing the step/continue command, and the next observable state arrives via the existing `onDidPaused` subscription or session termination.
- **Asynchronous stepping.** Step/continue requests resolve immediately; the next `StoppedEvent` arrives asynchronously through the session manager's existing `onDidPaused` re-broadcast of `Debugger.paused`.
- **Route through the session manager.** The adapter calls `DebugSessionManager` methods (`resume`, and the new `stepOver`/`stepInto`/`stepOut`/`pause`), never `BrowserDebuggerSession` directly. The manager owns the running session, pause state, and `pauseVersion`.
- **Single transport surface.** Raw debugger-domain CDP commands live only in `BrowserDebuggerSession` (extended in Task 5). No `src/transport/debugger-interface.ts`. No direct `client.send("Debugger.*", ...)` outside `src/transport/`.
- **Reuse existing pause handling.** Pause subscription, `pauseVersion`, `ensurePausedFrames()` cache invalidation, `clearForPause()`, and `resolveStoppedReason` already exist — reuse them; do not add a parallel pause path or call `clearForPause()` from the step handlers.
- **Folder is `src/debugger/`.** Created by Story 2.5, owned by Epic 10.
- **No client-side step timeout.** A step that completes without pausing simply leaves the session running until the program ends or a breakpoint is hit; termination is signaled by transport, not by a synthetic timer.
- **Localization.** All error messages via `vscode.l10n.t()` keyed in `l10n/bundle.l10n.json`.

### Transport Layer Extensions

Add to `BrowserDebuggerSession` in [src/transport/browser-connect.ts](../../src/transport/browser-connect.ts):

```typescript
export interface BrowserDebuggerSession {
  // ...existing members from Story 2.5 / 10.1 / 10.2 / 10.3...
  stepOver(
    params?: ProtocolMappingApi.Commands["Debugger.stepOver"]["paramsType"][0],
  ): Promise<void>;
  stepInto(
    params?: ProtocolMappingApi.Commands["Debugger.stepInto"]["paramsType"][0],
  ): Promise<void>;
  stepOut(): Promise<void>;
  pause(): Promise<void>; // optional, for explicit DAP pauseRequest
}
```

`resume()` is already exposed by Story 2.5 and re-exposed as `DebugSessionManager.resume()`. The existing `continueRequest` calls the session manager, not `BrowserDebuggerSession` directly; the new step request handlers follow the same pattern via the manager's new step methods (Task 5).

### Known Unknowns & Future Decisions

1. **Reverse execution:** Not in scope. DAP supports reverse stepping; CDP runtime does not natively. If reverse debugging is required, it requires specialized support (recording execution or alternative runtimes).
2. **Instruction-level stepping:** CDP supports line-level stepping. Instruction-level stepping is deferred.
3. **Continue to line:** VS Code supports "Continue to Line" (right-click on line). This requires setting a temporary breakpoint, then continuing. Deferred as enhancement.
4. **Pause on exception:** Currently, pause is only at breakpoints or after user-triggered steps. Pause-on-exception is deferred.

### Related Documentation

- [DAP continue specification](https://microsoft.github.io/debug-adapter-protocol/specification#Requests_Continue)
- [DAP next specification](https://microsoft.github.io/debug-adapter-protocol/specification#Requests_Next)
- [DAP stepIn specification](https://microsoft.github.io/debug-adapter-protocol/specification#Requests_StepIn)
- [DAP stepOut specification](https://microsoft.github.io/debug-adapter-protocol/specification#Requests_StepOut)
- [DAP stopped event specification](https://microsoft.github.io/debug-adapter-protocol/specification#Events_Stopped)
- [CDP Debugger.resume](https://chromedevtools.github.io/devtools-protocol/tot/Debugger/#method-resume)
- [CDP Debugger.stepOver](https://chromedevtools.github.io/devtools-protocol/tot/Debugger/#method-stepOver)
- [CDP Debugger.stepInto](https://chromedevtools.github.io/devtools-protocol/tot/Debugger/#method-stepInto)
- [CDP Debugger.stepOut](https://chromedevtools.github.io/devtools-protocol/tot/Debugger/#method-stepOut)

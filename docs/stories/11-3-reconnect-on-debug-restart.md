---
storyId: "11.3"
storyKey: "11-3-reconnect-on-debug-restart"
title: "Reconnect on Debug Restart"
status: review
created: "2026-06-25"
epic: "11"
priority: "p1-high"
dependencies:
  [
    "11-2-connect-on-debug-launch",
    "11-1-configure-cdp-endpoint-via-debug-configuration-attributes",
  ]
---

# Story 11.3: Reconnect on Debug Restart

**Status:** review

## Story

As a developer,
I want the debug Restart control to re-establish the browser connection,
So that recovering after a target reload is a single familiar action.

## Acceptance Criteria

### AC 1: Restart Reconnects the Browser Session

**Given** an active `jupyter-browser-kernel` debug session
**When** the user restarts the debug session
**Then** the extension tears down the prior connection and re-establishes it against the same configured endpoint
**And** notebook-cell breakpoints are rebound after reconnection.

### AC 2: Restart Fails Cleanly When Reconnect Cannot Happen

**Given** a target that is unavailable at restart time
**When** reconnection is attempted
**Then** the restart reports failure with actionable guidance
**And** the session ends in a deterministic state without leaking the prior connection.

## Scope Boundary (Read First)

This story delivers **restart-on-debug-restart only**. The VS Code Restart control should tear down the current browser connection, reconnect to the same debug-configuration endpoint, and restore the existing notebook-debugger state. **This story does NOT add disconnect-on-stop, the run-cell prompt, or command retirement** — those are Stories 11.4, 11.5, and 11.6.

Concretely:

- DO advertise restart support in the DAP adapter so the VS Code restart control reaches the extension. Use the adapter restart path, not a separate command surface.
- DO reuse the existing resolved endpoint from `session.configuration.host` / `.port` and the existing connect-on-launch path after teardown.
- DO preserve or rehydrate the existing `DebugSessionManager` breakpoint cache so notebook-cell breakpoints replay after the reconnect.
- DO keep restart deterministic: teardown must complete before the reconnect starts, and the prior connection must not be left dangling.
- DO NOT add debug-stop teardown, auto-reconnect, or command removal.
- DO NOT create a second connection registry or a parallel reconnect transport.
- DO NOT let the intentional restart teardown trip the same connection-lost listener that is used for unexpected disconnects; the debug session must survive the planned restart cycle.

## Tasks / Subtasks

### 1. Expose Restart Support in the DAP Adapter (AC: 1, 2)

- [x] In [src/debugger/notebook-dap-adapter.ts](../../src/debugger/notebook-dap-adapter.ts), advertise restart support in `initializeRequest` with `supportsRestartRequest: true` so VS Code shows the restart lifecycle path for this debugger.
- [x] Implement the adapter restart request path (`restartRequest` or the equivalent DAP restart handler used by this codebase) so restart requests are handled explicitly instead of falling through to launch/attach behavior.
- [x] Keep the existing launch/attach path intact; restart should reuse the same debug-session machinery, not replace it.

### 2. Reconnect Through the Existing Session Path (AC: 1, 2)

- [x] Add restart orchestration in [src/debugger/debug-session-manager.ts](../../src/debugger/debug-session-manager.ts) or a small sibling coordinator under [src/debugger](../../src/debugger) that can:
  - tear down the active browser connection in a deterministic order,
  - suppress the intentional disconnect from being treated as an unexpected connection loss,
  - then invoke the same connect-on-launch path used by Story 11.2 against the same resolved endpoint.
- [x] Prefer keeping the same `DebugSessionManager` instance alive through the restart cycle so the existing breakpoint cache and paused-state wiring survive the reconnect.
- [x] If the implementation must recreate manager state, preserve the breakpoint cache long enough for `recordSetBreakpoints()` / `createBreakpointRegistry()` replay to rebind notebook-cell breakpoints after the new `Debugger.enable` call.
- [x] Reuse `createEnsureBrowserConnection` from [src/debugger/connect-on-launch.ts](../../src/debugger/connect-on-launch.ts) rather than building a second connection path.
- [x] Surface restart failures through the same actionable error path used by launch/connect-on-launch so the debug session ends cleanly and the user gets the same style of guidance.

### 3. Preserve Breakpoint Rebinding and Session State (AC: 1)

- [x] Confirm that the restart path reuses the breakpoint cache already held by `DebugSessionManager` (`cachedBreakpointsByUrl` replay after `Debugger.enable`) so notebook-cell breakpoints are rebound automatically after reconnect.
- [x] Make sure the reconnect happens only after teardown has completed, because a premature reconnect will hit the single-active-connection guard from Story 11.2.
- [x] Keep DevTools coexistence intact: the restart path should only replace this extension's browser connection and must not force-detach external DevTools clients.

### 4. Tests (AC: 1, 2)

- [x] Extend [tests/unit/debugger/notebook-dap-adapter.test.ts](../../tests/unit/debugger/notebook-dap-adapter.test.ts) to assert the adapter advertises restart support and routes restart requests into the new restart path.
- [x] Extend [tests/unit/debugger/debug-session-manager.test.ts](../../tests/unit/debugger/debug-session-manager.test.ts) or add a focused restart test to prove the restart sequence tears down, reconnects, and preserves breakpoint replay ordering.
- [x] Add a regression test for the intentional-restart edge case: the planned teardown must not be mistaken for connection loss that terminates the debug session before reconnection completes.
- [x] If a success toast is shown, reuse the existing reconnect string `Jupyter Browser Kernel: Reconnected to target {0} at {1}.` from [l10n/bundle.l10n.json](../../l10n/bundle.l10n.json); otherwise keep restart silent and let the debug UI/state changes serve as the success signal.

### 5. Validation

- [x] `npm run lint`.
- [x] `npm run test`.
- [x] `npm run compile`.
- [x] Manual smoke in the Extension Development Host:
  - Start a `jupyter-browser-kernel` debug session against a reachable browser target.
  - Add or verify a notebook-cell breakpoint, then use the VS Code Restart control and confirm the session reconnects against the same endpoint.
  - Confirm notebook-cell breakpoints are rebound after restart and execution continues to pause as expected.
  - Point the configuration at an unavailable endpoint, restart, and confirm the failure is actionable and the session does not leak a stale browser connection.

## Dev Notes

### Story Context and Scope

This is the **third story in Epic 11** (Debug-Session-Driven Connection Lifecycle, FR40). Story 11.1 made the endpoint part of the debug configuration, and Story 11.2 made debug launch connect. Story 11.3 completes the restart half of the lifecycle: the Restart control should tear down the current browser connection and reconnect to the same configured endpoint without losing breakpoint state.

This story deliberately stops at restart-on-restart. It must not add debug-stop teardown, run-a-cell prompting, or command retirement. Those are later Epic 11 stories.

[Source: docs/epics/epic-11-debug-session-driven-connection-lifecycle-post-mvp-core.md#Story 11.3: Reconnect on Debug Restart]
[Source: docs/prd.md#FR40]
[Source: docs/architecture.md — "Debug-session-driven connection lifecycle (Epic 11, FR40)"]

### What Already Exists (Reuse - Do Not Reinvent)

- **Resolved endpoint on the session**: Story 11.1 attaches the final `host` / `port` to the returned `DebugConfiguration`, so the restart path can read the same endpoint from `session.configuration`.
- **Connect-on-launch coordinator**: Story 11.2 added `createEnsureBrowserConnection()` in [src/debugger/connect-on-launch.ts](../../src/debugger/connect-on-launch.ts). It already owns the single-active guard, the connect transition, and the actionable connect-failure diagnostics. Reuse it after teardown.
- **Session manager cache**: [src/debugger/debug-session-manager.ts](../../src/debugger/debug-session-manager.ts) caches `recordSetBreakpoints()` input in `cachedBreakpointsByUrl` and replays it after `Debugger.enable`. Reuse that same manager instance if possible so breakpoint rebinding stays automatic.
- **DAP launch failure path**: [src/debugger/notebook-dap-adapter.ts](../../src/debugger/notebook-dap-adapter.ts) already wraps `sessionManager.launch()` in try/catch and turns thrown errors into DAP launch errors. The restart path should follow the same failure pattern.
- **Transport disconnect primitive**: [src/transport/browser-connect.ts](../../src/transport/browser-connect.ts) exposes `disconnectActiveBrowserConnection()`, which clears the singleton and closes the current browser connection. Use it only with restart-aware ordering so the connection-lost listener does not end the debug session prematurely.

### Architecture Guardrails (Must Follow)

- **Restart is not a naive disconnect+connect**: `DebugSessionManager` listens for connection-state transitions to `disconnected` / `error` and treats them as connection loss. A planned restart must not trigger that listener in a way that terminates the debug session before reconnection.
- **Single active connection remains unchanged**: tear down the prior connection first, then reconnect. A reconnect attempt that races the teardown will hit the single-active guard from Story 11.2.
- **Breakpoint replay must survive restart**: the debug session manager already owns the cache that rebinds notebook-cell breakpoints. Do not lose that state across the restart cycle unless you explicitly rehydrate it.
- **DevTools coexistence stays first-class**: restart must only affect this extension's browser connection. Do not force-detach any external DevTools attachment.
- **Localization**: runtime diagnostics should reuse the same connect-failure formatting from [src/transport/connect-diagnostics.ts](../../src/transport/connect-diagnostics.ts). If you add a success notification, reuse the existing reconnect string in [l10n/bundle.l10n.json](../../l10n/bundle.l10n.json); do not invent a new phrasing unless the UX absolutely requires it.
- **Type hygiene**: prefer named options/result types if you add a restart coordinator. Keep the restart helper VS Code-runtime-free if possible so it remains unit-testable.

### Key Decisions to Make and Document

- **Where the restart orchestration lives**: the most likely home is the DAP adapter plus a small coordinator in `src/debugger`. Keep the adapter responsible for the DAP restart request and keep the coordinator responsible for teardown/reconnect ordering.
- **How to suppress the intentional disconnect**: add a restart-in-progress guard or equivalent suppression so the connection-state listener does not self-terminate the session during the planned reconnect.
- **Whether restart shows a toast**: the safest default is silent success, with the restart control and restored pause/breakpoint state serving as the user signal. If you choose to show a message, reuse the existing reconnect success string.
- **Whether the session manager is reused or recreated**: reuse is preferred because it preserves breakpoint cache and pause wiring. If recreation is unavoidable, document exactly how breakpoint replay is preserved.

### Testing Strategy

- Highest-value coverage is the restart truth table: active session restart, teardown ordering, reconnect success, reconnect failure, and the intentional-restart suppression path.
- The adapter test should prove the restart control is actually exposed (`supportsRestartRequest`) and that the restart request reaches the extension-owned restart path.
- The manager/coordinator test should prove breakpoint replay still happens after restart and that the planned disconnect does not terminate the session early.
- No live-browser CI dependency is needed beyond the existing transport coverage. Keep the restart tests deterministic with fakes and the existing CDP-backed unit/integration style.

### Project Structure Notes

- Likely touched files:
  - [src/debugger/notebook-dap-adapter.ts](../../src/debugger/notebook-dap-adapter.ts) - advertise and handle restart.
  - [src/debugger/debug-session-manager.ts](../../src/debugger/debug-session-manager.ts) - restart sequencing and breakpoint replay preservation.
  - [src/debugger/connect-on-launch.ts](../../src/debugger/connect-on-launch.ts) - reuse the existing reconnect-after-teardown coordinator.
  - [tests/unit/debugger/notebook-dap-adapter.test.ts](../../tests/unit/debugger/notebook-dap-adapter.test.ts) - restart request wiring and adapter response behavior.
  - [tests/unit/debugger/debug-session-manager.test.ts](../../tests/unit/debugger/debug-session-manager.test.ts) - restart ordering and replay regression coverage.
- Stay within the existing `debugger` / `transport` boundaries. Do not introduce a new top-level module tree for restart handling.

### References

- [Source: docs/epics/epic-11-debug-session-driven-connection-lifecycle-post-mvp-core.md#Story 11.3: Reconnect on Debug Restart]
- [Source: docs/prd.md#FR40]
- [Source: docs/prd.md#FR39]
- [Source: docs/architecture.md — Debug-session-driven connection lifecycle (Epic 11, FR40)]
- [Source: docs/stories/11-1-configure-cdp-endpoint-via-debug-configuration-attributes.md]
- [Source: docs/stories/11-2-connect-on-debug-launch.md]
- [Source: docs/stories/10-1-register-and-bootstrap-notebook-cell-dap-session.md]
- [Source: src/debugger/debug-session-manager.ts]
- [Source: src/debugger/notebook-dap-adapter.ts]
- [Source: src/debugger/connect-on-launch.ts]
- [Source: src/transport/connection-state.ts]
- [Source: src/transport/browser-connect.ts]
- [Source: l10n/bundle.l10n.json]

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- `npm run test:unit -- tests/unit/debugger/notebook-dap-adapter.test.ts tests/unit/debugger/debug-session-manager.test.ts` (red phase: expected failures before implementation)
- `npm run test:unit -- tests/unit/debugger/notebook-dap-adapter.test.ts tests/unit/debugger/debug-session-manager.test.ts` (green phase)
- `npm run lint`
- `npm run test`
- `npm run compile`

### Completion Notes List

- Added DAP restart capability advertisement (`supportsRestartRequest`) and explicit `restartRequest` handling in the notebook debug adapter.
- Added `restart()` to the debug session manager contract and implemented deterministic restart sequencing: manager teardown, active browser disconnect, and relaunch through existing connect-on-launch flow.
- Kept the same `DebugSessionManager` instance across restart so cached notebook breakpoints replay after reconnect.
- Wired manager restart teardown to shared `disconnectActiveBrowserConnection()` from the debug adapter factory, avoiding any secondary connection path.
- Extended unit coverage for restart routing, restart sequencing, intentional disconnect suppression, and updated initialize capability snapshot expectations.
- Completed Extension Development Host manual smoke: restart reconnects to the same endpoint, breakpoints rebind correctly, and unavailable-endpoint restart fails with actionable guidance without leaking stale connection state.

### File List

- `docs/stories/11-3-reconnect-on-debug-restart.md`
- `docs/stories/sprint-status.yaml`
- `src/debugger/debug-adapter-factory.ts`
- `src/debugger/debug-session-manager.ts`
- `src/debugger/notebook-dap-adapter.ts`
- `tests/unit/debugger/debug-session-manager.test.ts`
- `tests/unit/debugger/notebook-dap-adapter-breakpoints.test.ts`
- `tests/unit/debugger/notebook-dap-adapter.test.ts`
- `tests/unit/test-utils/debug-session-manager-mock.ts`

## Change Log

- 2026-06-25: Implemented Story 11.3 restart lifecycle support for DAP restart requests, deterministic reconnect sequencing, restart regression coverage, and completed manual Extension Development Host smoke validation. Story moved to review.

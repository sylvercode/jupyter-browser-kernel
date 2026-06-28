---
storyId: "11.6"
storyKey: "11-6-retire-connect-disconnect-reconnect-commands-and-migrate-state-reporting"
title: "Retire Connect/Disconnect/Reconnect Commands and Migrate State Reporting"
status: ready-for-dev
created: "2026-06-27"
epic: "11"
priority: "p1-high"
dependencies:
  [
    "11-5-prompt-to-start-a-debug-session-when-running-a-cell-without-one",
    "11-4-disconnect-on-debug-stop",
    "11-3-reconnect-on-debug-restart",
    "11-2-connect-on-debug-launch",
    "11-1-configure-cdp-endpoint-via-debug-configuration-attributes",
  ]
---

# Story 11.6: Retire Connect/Disconnect/Reconnect Commands and Migrate State Reporting

**Status:** ready-for-dev

## Story

As a developer,
I want the legacy connect/disconnect/reconnect commands removed in favor of the debug lifecycle,
so that there is a single, unambiguous way to manage the connection.

## Acceptance Criteria

### AC 1: Legacy Connection Commands Are Removed From the Public Surface

**Given** the debug-driven lifecycle from Stories 11.1-11.5 is in place
**When** the extension manifest is evaluated
**Then** `jupyterBrowserKernel.connect`, `jupyterBrowserKernel.disconnect`, and `jupyterBrowserKernel.reconnect` are absent from `contributes.commands`
**And** `src/extension.ts` no longer registers those commands at activation time.

### AC 2: FR4 State Reporting Still Comes From the Debug-Session Lifecycle

**Given** the legacy commands are removed
**When** the debug session starts, restarts, stops, or reports a failure
**Then** the existing connection-state path still surfaces `disconnected`, `connecting`, `connected`, and `error`
**And** the status indicator and logger continue to reflect the same state transitions and error context without introducing a second tracker or a command fallback.

### AC 3: Notebook Activation Remains Independent of Commands

**Given** the connect command is retired
**When** the manifest is built
**Then** `onNotebook:jupyter-notebook` remains in `activationEvents` so Browser Kernel registration still happens when a notebook opens
**And** the extension no longer relies on command invocation to activate.

### AC 4: Existing Endpoint Settings Remain Valid as Fallback Defaults

**Given** users already have `jupyterBrowserKernel.cdpHost` and `jupyterBrowserKernel.cdpPort`
**When** they upgrade
**Then** those settings continue to act as fallback defaults for debug configurations that omit `host` or `port`
**And** the migration copy makes the debug-session lifecycle the visible path for connection control.
**And** the setting documentation makes clear that launch configurations use these values when `host` or `port` are omitted.

## Scope Boundary (Read First)

This story is a command-surface cleanup, not a new lifecycle feature.

Concretely:

- DO remove the public command contributions and the extension activation wiring that exists only to serve them.
- DO keep the debug-session-owned connect/reconnect/disconnect flow from Stories 11.1-11.4 intact.
- DO keep FR4 reporting flowing through the existing state store, status indicator, and logger.
- DO keep `onNotebook:jupyter-notebook` activation in place so notebook registration does not regress.
- DO clean up obsolete localization entries and tests that still assert the retired commands exist.
- DO NOT add a replacement command surface.
- DO NOT create a second connection-state tracker.
- DO NOT change notebook execution behavior or debug-session semantics beyond the command retirement.

## Tasks / Subtasks

### 1. Remove the Legacy Commands From the Manifest and Activation Path (AC: 1, 3)

- [ ] Remove `jupyterBrowserKernel.connect`, `jupyterBrowserKernel.disconnect`, and `jupyterBrowserKernel.reconnect` from [package.json](../../package.json).
- [ ] Remove the corresponding `registerCommand` wiring from [src/extension.ts](../../src/extension.ts).
- [ ] Keep the notebook activation event `onNotebook:jupyter-notebook` and the debug hooks already present in the manifest.

### 2. Retire Obsolete Command Modules and Strings (AC: 1, 4)

- [ ] Delete or refactor the now-unused command modules in [src/commands](../../src/commands) after confirming no reusable logic is stranded there.
- [ ] Remove the retired command title entries from [package.nls.json](../../package.nls.json) and [l10n/bundle.l10n.json](../../l10n/bundle.l10n.json).
- [ ] Keep any shared state-store or transport helpers that are still used by the debug lifecycle or other commands.

### 3. Preserve FR4 State Reporting Through the Existing Lifecycle Path (AC: 2)

- [ ] Verify that debug-start, restart, and stop paths still drive the canonical connection state in [src/transport/connection-state.ts](../../src/transport/connection-state.ts).
- [ ] Keep the status indicator and logger wiring intact in [src/ui/connection-status-indicator.ts](../../src/ui/connection-status-indicator.ts) and [src/logging/connection-logger.ts](../../src/logging/connection-logger.ts).
- [ ] Do not introduce a command-specific state fallback or alternate session tracker.

### 4. Update Tests for the Removed Public Surface (AC: 1, 2, 3, 4)

- [ ] Update [tests/unit/commands/command-registration.test.ts](../../tests/unit/commands/command-registration.test.ts) so it asserts the retired commands are absent and the remaining isolation command surface still exists.
- [ ] Keep [tests/unit/extension/activation-events.test.ts](../../tests/unit/extension/activation-events.test.ts) aligned with the retained notebook and debug activation events.
- [ ] Keep [tests/unit/transport/connection-state.test.ts](../../tests/unit/transport/connection-state.test.ts) green to protect the FR4 state machine.

### 5. Validate the Cleanup (AC: 1-4)

- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run compile`

## Dev Notes

### Story Context and Scope

Story 11.6 is the cleanup pass for Epic 11 (FR40). Stories 11.1-11.5 already moved connection ownership to the VS Code debug lifecycle and added notebook bootstrap on `onNotebook:jupyter-notebook`. This story removes the old command surface so users have one visible way to manage the connection: debug start/restart/stop.

[Source: docs/epics/epic-11-debug-session-driven-connection-lifecycle-post-mvp-core.md#Story 11.6: Retire Connect/Disconnect/Reconnect Commands and Migrate State Reporting]
[Source: docs/stories/11-5-prompt-to-start-a-debug-session-when-running-a-cell-without-one.md]
[Source: docs/prd.md#FR4]
[Source: docs/prd.md#FR40]
[Source: docs/architecture.md - Debug-session-driven connection lifecycle (Epic 11, FR40)]

### What Already Exists (Reuse - Do Not Reinvent)

- The command surface still exists in [package.json](../../package.json) and is wired in [src/extension.ts](../../src/extension.ts); remove it there instead of adding a parallel cleanup path.
- FR4 state reporting already flows through [src/transport/connection-state.ts](../../src/transport/connection-state.ts), [src/ui/connection-status-indicator.ts](../../src/ui/connection-status-indicator.ts), and [src/logging/connection-logger.ts](../../src/logging/connection-logger.ts).
- Notebook bootstrap already uses `onNotebook:jupyter-notebook`; keep that activation event in place while deleting the old command bootstrap.
- The regression tests in [tests/unit/commands/command-registration.test.ts](../../tests/unit/commands/command-registration.test.ts) still assert the retired commands exist today; update those assertions rather than creating a second manifest test.

### Previous Story Intelligence (11.5)

- Story 11.5 already established notebook-driven start prompts and added `onNotebook:jupyter-notebook`, so 11.6 must not remove that bootstrap while cleaning up command registration.
- The current code path still contains the legacy commands and their localized titles, which means this story should remove both the manifest entries and the dead wiring rather than leaving an unreachable UI surface behind.
- Keep the state-reporting contract unchanged; the lifecycle owner changes, not the underlying FR4 state semantics.

[Source: docs/stories/11-5-prompt-to-start-a-debug-session-when-running-a-cell-without-one.md]

### Architecture Guardrails (Must Follow)

- Debug session remains the only owner of connect/reconnect/disconnect in FR40.
- Connection state reporting stays on the existing `ConnectionStateStore` and UI/status path.
- Do not regress DevTools coexistence or notebook activation just to retire commands.
- Keep the fallback endpoint settings intact for zero-config launch and migration continuity.

[Source: docs/architecture.md]
[Source: docs/prd.md#FR4]
[Source: docs/prd.md#FR40]

### Project Structure Notes

- Likely touched files: [package.json](../../package.json), [src/extension.ts](../../src/extension.ts), [src/commands](../../src/commands), [package.nls.json](../../package.nls.json), [l10n/bundle.l10n.json](../../l10n/bundle.l10n.json), [tests/unit/commands/command-registration.test.ts](../../tests/unit/commands/command-registration.test.ts), [tests/unit/extension/activation-events.test.ts](../../tests/unit/extension/activation-events.test.ts), [tests/unit/transport/connection-state.test.ts](../../tests/unit/transport/connection-state.test.ts).
- Detected conflict to avoid: `onNotebook:jupyter-notebook` is already present from Story 11.5; keep it and do not treat it as a new change to remove or duplicate.

### Testing Standards Summary

- Prefer the existing node:test-based unit suite instead of inventing a new harness.
- Validate the manifest shape with the command-registration test, activation behavior with the activation-events test, and state semantics with the connection-state test.
- Finish with `npm run lint`, `npm run test`, and `npm run compile` so the manifest, tests, and TypeScript build all agree.

### References

- [Source: docs/epics/epic-11-debug-session-driven-connection-lifecycle-post-mvp-core.md#Story 11.6: Retire Connect/Disconnect/Reconnect Commands and Migrate State Reporting]
- [Source: docs/stories/11-5-prompt-to-start-a-debug-session-when-running-a-cell-without-one.md]
- [Source: docs/prd.md#FR4]
- [Source: docs/prd.md#FR40]
- [Source: docs/architecture.md - Debug-session-driven connection lifecycle (Epic 11, FR40)]
- [Source: package.json](../../package.json)
- [Source: src/extension.ts](../../src/extension.ts)
- [Source: src/transport/connection-state.ts](../../src/transport/connection-state.ts)
- [Source: tests/unit/commands/command-registration.test.ts](../../tests/unit/commands/command-registration.test.ts)
- [Source: tests/unit/extension/activation-events.test.ts](../../tests/unit/extension/activation-events.test.ts)
- [Source: tests/unit/transport/connection-state.test.ts](../../tests/unit/transport/connection-state.test.ts)

## Dev Agent Record

### Agent Model Used

GPT-5.4 mini

### Debug Log References

### Completion Notes List

### File List

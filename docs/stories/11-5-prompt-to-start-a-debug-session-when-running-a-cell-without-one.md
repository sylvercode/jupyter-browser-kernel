---
storyId: "11.5"
storyKey: "11-5-prompt-to-start-a-debug-session-when-running-a-cell-without-one"
title: "Prompt to Start a Debug Session When Running a Cell Without One"
status: in-progress
created: "2026-06-26"
epic: "11"
priority: "p1-high"
dependencies:
  [
    "11-4-disconnect-on-debug-stop",
    "11-3-reconnect-on-debug-restart",
    "11-2-connect-on-debug-launch",
    "11-1-configure-cdp-endpoint-via-debug-configuration-attributes",
  ]
---

# Story 11.5: Prompt to Start a Debug Session When Running a Cell Without One

**Status:** in-progress

## Story

As a developer,
I want a one-click prompt to start a connection-bearing debug session when I run a cell without one,
So that I can run cells through a single, predictable entry point without the debugger booting silently.

## Acceptance Criteria

### AC 1: Notebook Activation Registers Browser Kernel Without Command Bootstrap

**Given** a Jupyter notebook is opened with no active debug session and no contributed connect command
**When** the notebook loads
**Then** the extension activates and registers the Browser Kernel notebook controller via `onNotebook:jupyter-notebook`
**And** the Browser Kernel is selectable as a kernel without first starting a debug session or invoking any command.

### AC 2: Cell Run With No Active Session Prompts, Starts Debug on Consent, and Runs After Connected

**Given** no active `jupyter-browser-kernel` debug session
**When** the user runs a browser-kernel notebook cell
**Then** the extension prompts the user to start a session (it does not silently auto-start the debugger)
**And** choosing Start launches the default or user-selected connection debug configuration via `vscode.debug.startDebugging` and runs the cell once the connection reaches `connected`
**And** declining the prompt leaves the cell un-run with clear guidance, and if no configuration can be resolved the prompt explains how to define one.

### AC 3: Active Session Executes Without Prompt and Preserves Epic 2 Result Contract

**Given** an active connection-bearing debug session
**When** the user runs a notebook cell
**Then** the cell executes against that session's connection without prompting or starting an additional session
**And** execution results remain consistent with the Epic 2 result contract.

## Scope Boundary (Read First)

This story delivers **prompt-on-cell-run when no session exists** and **notebook activation bootstrap for kernel availability**. The debug session lifecycle remains owned by Epic 11 (start/restart/stop), but this story only adds the run-time guardrail at notebook execution entry.

Concretely:

- DO add `onNotebook:jupyter-notebook` activation so the notebook controller is available from notebook open.
- DO gate browser-kernel cell execution on an active `jupyter-browser-kernel` debug session/connected transport.
- DO prompt the user before starting debug when no session is active.
- DO start debug via `vscode.debug.startDebugging` only after user consent.
- DO run the originally requested cell(s) only after connection reaches `connected`.
- DO keep no-session decline behavior explicit and non-destructive (cell remains un-run).
- DO NOT silently auto-start debugging on notebook open or kernel selection.
- DO NOT remove legacy connect/disconnect/reconnect commands in this story (that is Story 11.6).
- DO NOT change Epic 2 output/result normalization semantics.

## Tasks / Subtasks

### 1. Ensure Notebook Activation Path Exists Independent of Commands (AC: 1)

- [x] Update [package.json](../../package.json) activation events to include `onNotebook:jupyter-notebook` while preserving debug activation events.
- [x] Keep notebook controller registration in [src/extension.ts](../../src/extension.ts) activation path so opening a notebook is sufficient for Browser Kernel availability.
- [x] Add/extend activation-focused tests (unit where feasible) to protect against future regressions when command contributions are retired in Story 11.6.

### 2. Add Run-Cell Session Gate and Prompt Flow (AC: 2)

- [x] Introduce a notebook execution preflight gate in [src/notebook/kernel-controller.ts](../../src/notebook/kernel-controller.ts) (or a small dedicated helper under [src/notebook](../../src/notebook)) that checks whether a compatible debug session/connected transport is present before executing a cell.
- [x] Reuse existing authoritative connection signals (`getActiveBrowserConnection` and/or connection state store) rather than inventing a parallel session tracker.
- [x] If no active session exists, show a localized prompt with explicit actions (for example: Start, Cancel) and clear guidance text.
- [x] Ensure Cancel does not execute the cell and surfaces a clear, localized no-run reason.

### 3. Resolve and Start Debug Configuration Deterministically (AC: 2)

- [x] Implement debug-configuration resolution for `jupyter-browser-kernel` launch configs from `launch.json` with deterministic behavior:
  - [x] If exactly one viable config exists, use it as default.
  - [x] If multiple viable configs exist, prompt user selection.
  - [x] If none exist, show actionable guidance for creating one.
- [x] Start debug with `vscode.debug.startDebugging(folder, nameOrConfiguration)` and handle false/throw outcomes with actionable, localized errors.
- [x] Wait for connection readiness (`connected`) before executing queued cell(s); avoid race conditions where execution starts during `connecting`.

### 4. Keep Existing Active-Session Path Prompt-Free (AC: 3)

- [x] Preserve fast path: when the relevant debug session/connection is already active, execute cells immediately with no prompt and no additional debug session start attempt.
- [x] Keep single-active-connection guard semantics from Story 11.2 intact.
- [x] Ensure no changes to [src/kernel/execution-result.ts](../../src/kernel/execution-result.ts) contracts and no behavior drift in Epic 2 result rendering.

### 5. Localization and UX Messaging (AC: 2)

- [x] Add all new prompt and guidance strings to [l10n/bundle.l10n.json](../../l10n/bundle.l10n.json) and [package.nls.json](../../package.nls.json) as appropriate.
- [x] Replace reconnect-oriented no-session copy on the run-cell path with debug-session-oriented guidance where relevant, without regressing command-driven flows that still exist before Story 11.6.
- [x] Keep user messaging concise and actionable (start session, choose config, or create config).

### 6. Tests (AC: 1, 2, 3)

- [x] Extend [tests/unit/notebook/kernel-controller.test.ts](../../tests/unit/notebook/kernel-controller.test.ts) for preflight behavior:
  - [x] no-session prompts and cancel leaves cell un-run,
  - [x] consent path defers execution until ready,
  - [x] active-session path runs immediately without prompt.
- [x] Add unit tests for debug config resolution helper logic (single/multiple/none viable configurations).
- [x] Add focused tests around connection readiness sequencing to prevent execute-before-connected regressions.
- [x] Add or update extension-level wiring tests to protect notebook activation bootstrap behavior once command retirement lands.

### 7. Validation

- [x] `npm run lint`
- [x] `npm run test`
- [x] `npm run compile`
- [x] Manual smoke in Extension Development Host:
  - [x] Open a `.ipynb`, select Browser Kernel, verify no debug session is required for controller visibility.
  - [x] Run a cell with no active session, confirm Start/Cancel prompt appears.
  - [x] Choose Cancel and verify the cell is not executed.
  - [x] Choose Start, select a debug configuration if prompted, and verify cell runs only after status reaches connected.
  - [x] With active debug session already connected, run another cell and verify no prompt appears.

## Dev Notes

### Story Context and Scope

Story 11.5 bridges notebook execution UX with Epic 11's debug-owned connection lifecycle (FR40): when the user runs a browser-kernel cell without an active session, the extension prompts for explicit consent to start debug and proceeds only after connection establishment.

[Source: docs/epics/epic-11-debug-session-driven-connection-lifecycle-post-mvp-core.md#Story 11.5: Prompt to Start a Debug Session When Running a Cell Without One]
[Source: docs/prd.md#FR40]
[Source: docs/architecture.md - Debug-session-driven connection lifecycle (Epic 11, FR40)]

### What Already Exists (Reuse - Do Not Reinvent)

- Notebook controller registration and execute handler are already centralized in [src/notebook/kernel-controller.ts](../../src/notebook/kernel-controller.ts).
- Connection absence currently resolves to normalized `no-session` behavior in [src/kernel/execution-kernel.ts](../../src/kernel/execution-kernel.ts) and messages in [src/kernel/execution-messages.ts](../../src/kernel/execution-messages.ts).
- Debug launch already owns endpoint resolution and connect-on-launch through [src/debugger/debug-adapter-factory.ts](../../src/debugger/debug-adapter-factory.ts), [src/debugger/debug-config-provider.ts](../../src/debugger/debug-config-provider.ts), and [src/debugger/connect-on-launch.ts](../../src/debugger/connect-on-launch.ts).
- Connection state transitions already use [src/transport/connection-state.ts](../../src/transport/connection-state.ts).

Prefer composing these existing surfaces over creating a second debug lifecycle pipeline.

### Previous Story Intelligence (11.4)

- Stop/terminate now resets transport state deterministically to `disconnected`; 11.5 must treat that as the expected re-entry condition for prompting.
- Story 11.4 tightened session-manager teardown idempotency and coexistence boundaries; 11.5 must not bypass these by introducing ad hoc connection globals.
- Recent Epic 11 stories follow a pattern of narrow lifecycle changes in `src/debugger/`, targeted notebook/kernel changes, and focused unit tests in `tests/unit/debugger/` and `tests/unit/notebook/`.

[Source: docs/stories/11-4-disconnect-on-debug-stop.md]

### Architecture Guardrails (Must Follow)

- Debug session remains the owner of connect/reconnect/disconnect lifecycle under FR40.
- Cell-run prompt must be explicit consent; no silent debugger boot.
- Single active connection remains enforced.
- Keep DevTools coexistence assumptions unchanged.
- Keep execution result contract unchanged (Epic 2 behavior parity).
- Keep localization discipline: new user-facing strings must be localized.

[Source: docs/architecture.md]
[Source: docs/prd.md#FR14]
[Source: docs/prd.md#FR40]

### Library and Framework Requirements (Latest API Notes)

- `vscode.debug.startDebugging(folder, nameOrConfiguration, options?)` returns `Thenable<boolean>` and must be handled for both `false` and thrown-error outcomes.
- Notebook activation event `onNotebook:jupyter-notebook` is valid for activating the extension when notebooks open.
- Notebook controller registration remains via `vscode.notebooks.createNotebookController(...)`.

[Source: VS Code API reference (`vscode.debug.startDebugging`)]
[Source: VS Code extension activation events (`onNotebook:jupyter-notebook`)]

### Project Structure Notes

Likely touched files:

- [package.json](../../package.json)
- [src/extension.ts](../../src/extension.ts)
- [src/notebook/kernel-controller.ts](../../src/notebook/kernel-controller.ts)
- [src/kernel/execution-kernel.ts](../../src/kernel/execution-kernel.ts)
- [src/kernel/execution-messages.ts](../../src/kernel/execution-messages.ts)
- [src/debugger](../../src/debugger) (new helper or reuse existing factories)
- [l10n/bundle.l10n.json](../../l10n/bundle.l10n.json)
- [package.nls.json](../../package.nls.json)
- [tests/unit/notebook/kernel-controller.test.ts](../../tests/unit/notebook/kernel-controller.test.ts)
- [tests/unit/debugger](../../tests/unit/debugger)

### Git Intelligence Summary

Recent commits show stable implementation cadence for Epic 11 lifecycle work:

- story artifact update in [docs/stories](../../docs/stories),
- lifecycle code changes under [src/debugger](../../src/debugger),
- targeted regression coverage in [tests/unit/debugger](../../tests/unit/debugger).

Use the same pattern for 11.5, adding notebook-path coverage in [tests/unit/notebook](../../tests/unit/notebook).

### References

- [Source: docs/epics/epic-11-debug-session-driven-connection-lifecycle-post-mvp-core.md#Story 11.5: Prompt to Start a Debug Session When Running a Cell Without One]
- [Source: docs/prd.md#FR14]
- [Source: docs/prd.md#FR40]
- [Source: docs/architecture.md - Debug-session-driven connection lifecycle (Epic 11, FR40)]
- [Source: docs/stories/11-4-disconnect-on-debug-stop.md]
- [Source: src/extension.ts]
- [Source: src/notebook/kernel-controller.ts]
- [Source: src/kernel/execution-kernel.ts]
- [Source: src/kernel/execution-messages.ts]
- [Source: src/debugger/debug-adapter-factory.ts]
- [Source: src/debugger/debug-config-provider.ts]
- [Source: src/debugger/connect-on-launch.ts]
- [Source: package.json]
- [Source: tests/unit/notebook/kernel-controller.test.ts]

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Story authored from epic, PRD, architecture, previous-story, codebase, and git-history analysis.
- Included VS Code API notes for `startDebugging` and `onNotebook` activation.
- Implemented `src/notebook/debug-session-preflight.ts` to gate cell execution on connected debug lifecycle state and explicit consent.
- Validation executed: `npm run lint`, `npm run test`, `npm run compile`.

### Completion Notes List

- Added `onNotebook:jupyter-notebook` activation event so Browser Kernel controller registration occurs when notebooks open.
- Added notebook execution preflight gate in `src/notebook/kernel-controller.ts` with injectable override for deterministic tests.
- Added `src/notebook/debug-session-preflight.ts` to resolve launch configurations (single/multiple/none), prompt Start/Cancel, start debug, and wait for `connected` before cell execution.
- Updated no-session execution messaging to debug-session-oriented guidance while preserving Epic 2 result contracts.
- Added/updated unit coverage for kernel preflight behavior, debug config resolution, activation wiring, and no-session message expectations.
- Automated checks are passing; manual Extension Development Host smoke tests remain pending.

### File List

- `package.json`
- `src/notebook/debug-session-preflight.ts`
- `src/notebook/kernel-controller.ts`
- `src/kernel/execution-messages.ts`
- `l10n/bundle.l10n.json`
- `tests/unit/notebook/kernel-controller.test.ts`
- `tests/unit/notebook/debug-session-preflight.test.ts`
- `tests/unit/extension/activation-events.test.ts`
- `tests/unit/kernel/execution-kernel.test.ts`
- `tests/unit/kernel/execution-messages.test.ts`
- `tests/unit/logging/kernel-transport-failure-reporter.test.ts`
- `docs/stories/11-5-prompt-to-start-a-debug-session-when-running-a-cell-without-one.md`

## Change Log

- 2026-06-26: Created Story 11.5 with implementation guardrails, deterministic debug-start prompt flow, and validation plan. Status set to ready-for-dev.
- 2026-06-26: Implemented notebook run-cell preflight prompt/start flow, deterministic launch config resolution, connection-readiness gating, localization updates, and unit test coverage. Automated validation passed; manual smoke checklist remains open.

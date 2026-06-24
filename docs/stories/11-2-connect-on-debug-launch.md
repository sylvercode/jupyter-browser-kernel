---
storyId: "11.2"
storyKey: "11-2-connect-on-debug-launch"
title: "Connect on Debug Launch"
status: "ready-for-dev"
created: "2026-06-24"
epic: "11"
priority: "p1-high"
dependencies:
  [
    "11-1-configure-cdp-endpoint-via-debug-configuration-attributes",
    "1-3-connect-to-a-valid-browser-target",
    "10-1-register-and-bootstrap-notebook-cell-dap-session",
  ]
---

# Story 11.2: Connect on Debug Launch

**Status:** ready-for-dev

## Story

As a developer,
I want pressing play on a connection debug configuration to establish the browser connection,
So that I no longer need a separate connect step before debugging or executing cells.

## Acceptance Criteria

### AC 1: Starting a Debug Session Establishes the Connection

**Given** no active browser connection
**When** the user starts a `jupyter-browser-kernel` debug session
**Then** the extension connects to the resolved CDP endpoint and reports `connecting` → `connected` state
**And** connection failures surface as actionable debug-session startup diagnostics and end the session cleanly.

### AC 2: A Second Concurrent Session Is Rejected

**Given** an already-active connection or debug session
**When** the user starts a second `jupyter-browser-kernel` debug session
**Then** the second start is rejected with guidance that a single active connection is supported
**And** the existing session and connection remain unaffected.

## Scope Boundary (Read First)

This story delivers **connect-on-launch only** — pressing play on a `jupyter-browser-kernel` debug configuration establishes the browser connection (using the endpoint Story 11.1 resolved and attached to `session.configuration`), reports `connecting` → `connected`, and rejects a second concurrent session. **This story does NOT add reconnect-on-restart, disconnect-on-stop, the run-a-cell prompt, or retire the connect/disconnect/reconnect commands** — those are Stories 11.3, 11.4, 11.5, and 11.6 respectively.

Concretely:

- DO consume the resolved `host` / `port` from `session.configuration` (attached by Story 11.1's `DebugConfigProvider`) and connect via the existing `connectToBrowserTarget` transport.
- DO report `connecting` → `connected` through the existing `ConnectionStateStore` (reuse `withConnectTransition`), so FR4 state reporting and the status indicator stay consistent with the connect command.
- DO surface connection failures as a DAP launch error so the failed debug session ends cleanly, and set FR4 error context.
- DO reject a second concurrent `jupyter-browser-kernel` session (when a connection is already active) with localized guidance, **without disturbing the existing connection**.
- DO NOT add `vscode.debug.onDidTerminateDebugSession` / disconnect-on-stop wiring (Story 11.4), restart/reconnect handling (Story 11.3), the run-cell-without-a-session prompt (Story 11.5), or remove the standalone `connect` / `disconnect` / `reconnect` commands (Story 11.6).
- DO NOT change the breakpoint/stepping/variables behavior delivered in Epic 10 — connect-on-launch must run **before** the existing `Debugger.enable` path in `DebugSessionManager.launch()` so the rest of Epic 10 keeps working unchanged.

## Tasks / Subtasks

### 1. Add a Connect-on-Launch Coordinator (AC: 1, 2)

- [ ] Create [src/debugger/connect-on-launch.ts](../../src/debugger/connect-on-launch.ts) exporting a small, VS Code-runtime-free coordinator that the `DebugAdapterFactory` wires per session. Suggested shape:
  - A named options type (e.g. `EnsureBrowserConnectionOptions`) carrying injected dependencies — do NOT inline a complex object type in the function signature:
    - `endpoint: EndpointConfig` (the resolved host/port for this session).
    - `connectionStateStore: ConnectionStateStore`.
    - `connectToTarget: ConnectToTargetOperation` (default in wiring: `(endpoint, localize, abortSignal) => connectToBrowserTarget(endpoint, undefined, localize, abortSignal)`).
    - `getActiveConnection: () => ActiveBrowserConnection | undefined` (default `getActiveBrowserConnection`).
    - `localize: Localize`.
  - A factory/function (e.g. `createEnsureBrowserConnection(options): () => Promise<void>`) returning the `ensureConnection` callback invoked by `DebugSessionManager.launch()`.
- [ ] Reuse, do not reinvent: `withConnectTransition`, `ConnectionStateStore`, `connectToBrowserTarget`, `ConnectToTargetOperation`/`ConnectToTargetResult`, `formatConnectFailureMessage`, and `EndpointConfig`. Mirror the `runConnect` semantics in [src/commands/connect-command.ts](../../src/commands/connect-command.ts) (the connecting→connected/error transition + error-context handling) rather than copying its UI prompt logic.

### 2. Implement Connect Semantics in the Coordinator (AC: 1)

- [ ] `ensureConnection()` behavior when **no** active connection exists (`getActiveConnection()` is `undefined`):
  - Run the connect attempt inside `withConnectTransition(connectionStateStore, attempt, (r) => r.ok, onAborted)` so state moves `connecting` → `connected` on success and `connecting` → `error` on failure (matches `runConnect`).
  - On `ConnectToTargetResult.ok === true`: clear error context (`connectionStateStore.setErrorContext(undefined)`) and resolve. The transport singleton is now set; `DebugSessionManager.launch()` will pick it up via `getDebuggerSession()`.
  - On `ConnectToTargetResult.ok === false`: build the actionable message via `formatConnectFailureMessage(result.failure, summarizeEndpointForDisplay(endpoint), localize)`, set `connectionStateStore.setErrorContext({ category: result.failure.category, guidance: message })`, and **throw** an `Error(message)` so the DAP launch surfaces it (Task 4) and the session ends cleanly.
- [ ] Do NOT show `showInformationMessage` / `showErrorMessage` prompts from the coordinator — the debug session UI and the launch error response are the surfaces here. Keep the coordinator free of `vscode.window.*` so it stays unit-testable. (Error context drives the FR4 status indicator already wired in `extension.ts`.)

### 3. Enforce the Single-Active-Connection Guard (AC: 2)

- [ ] In `ensureConnection()`, when an active connection **already** exists (`getActiveConnection()` is defined) treat this as a second concurrent session:
  - Throw an `Error` with a localized single-active-connection guidance message **before** calling `connectToTarget` — the existing connection MUST NOT be touched (no `disconnect`, no state change, no transition).
  - Add the guidance string to [l10n/bundle.l10n.json](../../l10n/bundle.l10n.json), e.g.:
    - `"A browser connection is already active. Stop the existing debug session before starting another — only one active connection is supported."`
- [ ] Rationale / why this placement works (document in Dev Notes): `DebugSessionManager.launch()` only calls `ensureConnection()` when `getDebuggerSession()` returns `undefined` (no connection). The first session connects and `launch()`'s `running` guard makes it idempotent, so a session never rejects itself. A second session's separate manager sees the existing connection and rejects. This also correctly rejects a debug start when a connection already exists from the legacy connect command (still present until Story 11.6).
- [ ] Because the rejection is thrown before any teardown, "the existing session and connection remain unaffected" (AC 2) holds by construction.

### 4. Wire the Coordinator Into `DebugSessionManager.launch()` (AC: 1, 2)

- [ ] Extend `DebugSessionManagerOptions` in [src/debugger/debug-session-manager.ts](../../src/debugger/debug-session-manager.ts) with an optional `ensureConnection?: () => Promise<void>`.
- [ ] In `createDebugSessionManager(...)` `launch`, replace the current "no session → throw immediately" path:
  - Keep the leading `if (running) return;` short-circuit (idempotent launch).
  - When `getDebuggerSession()` returns `undefined` AND `ensureConnection` is provided: `await ensureConnection()`, then re-read `getDebuggerSession()`.
  - If a session is now present, continue with the existing `Debugger.enable` / `scriptParsed` flow unchanged.
  - If still `undefined` (or `ensureConnection` was not provided), preserve the existing `throw new Error(localize("Cannot start debug session: connect to a browser target first."))` so behavior is unchanged when connect-on-launch is not wired (keeps existing tests valid).
- [ ] Let an `ensureConnection()` rejection propagate out of `launch()` unchanged — the adapter (Task 5) converts it into a DAP error response. Do NOT swallow it.
- [ ] Do NOT flip the `running` flag or register listeners before `ensureConnection()` resolves, so a failed connect leaves no partially-initialized session state.

### 5. Surface Launch/Connect Failures via the DAP Adapter (AC: 1)

- [ ] Confirm [src/debugger/notebook-dap-adapter.ts](../../src/debugger/notebook-dap-adapter.ts) `launchRequest` already wraps `sessionManager.launch()` in try/catch and calls `sendErrorResponse(response, 0, message)` on throw — it does. The coordinator's thrown message (connect failure or single-active guidance) therefore reaches VS Code as the launch error and the session ends cleanly. No structural change needed; add a test (Task 7) asserting the message passthrough.
- [ ] Verify `attachRequest` (which delegates to `launchRequest`) inherits the same behavior — no separate change.

### 6. Wire Dependencies Through the `DebugAdapterFactory` and Extension (AC: 1, 2)

- [ ] Extend `DebugAdapterFactoryOptions` in [src/debugger/debug-adapter-factory.ts](../../src/debugger/debug-adapter-factory.ts) with the dependencies the coordinator needs:
  - `connectionStateStore: ConnectionStateStore`.
  - `connectToTarget?: ConnectToTargetOperation` (default `(endpoint, localize, abortSignal) => connectToBrowserTarget(endpoint, undefined, localize, abortSignal)`).
  - Reuse the existing `getActiveConnection` option (already defaults to `getActiveBrowserConnection`).
- [ ] In `createDebugAdapterDescriptor(session)` (rename `_session` → `session` since it is now used):
  - Read the resolved endpoint from `session.configuration` — `host` and `port` were attached by Story 11.1's provider. Build `EndpointConfig` from them. As a defensive fallback (e.g. a session somehow created without going through the provider), resolve via `readAndValidateEndpointConfig(getSettings())` and document the choice; the provider normally guarantees valid attached values because it aborts launch on resolution failure.
  - Construct the `ensureConnection` callback via `createEnsureBrowserConnection({ endpoint, connectionStateStore, connectToTarget, getActiveConnection, localize: vscode.l10n.t })`.
  - Pass `ensureConnection` into `createSessionManager({ getDebuggerSession, logger, localize, ensureConnection })`.
- [ ] In [src/extension.ts](../../src/extension.ts), pass the new options when constructing `new DebugAdapterFactory({ ... })`: `connectionStateStore` (the already-created `connectionStateStore`), and rely on the default `connectToTarget`. Do NOT change registration order or the existing `logger` wiring.
- [ ] If reading settings is needed for the defensive fallback, inject a `getSettings` option mirroring the `DebugConfigProvider` wiring (`() => vscode.workspace.getConfiguration("jupyterBrowserKernel")`) rather than calling `vscode.workspace` directly inside the factory.

### 7. Unit Tests (AC: 1, 2)

- [ ] `tests/unit/debugger/connect-on-launch.test.ts` (new): cover `createEnsureBrowserConnection` / `ensureConnection`:
  - no active connection + `connectToTarget` returns `ok: true` → `connectToTarget` called once; state transitions `connecting` → `connected`; error context cleared; resolves.
  - no active connection + `connectToTarget` returns `ok: false` → throws an `Error` whose message comes from `formatConnectFailureMessage`; state ends in `error`; error context set with the failure category + guidance.
  - active connection already present (fake `getActiveConnection` returns a connection) → throws the localized single-active guidance error; `connectToTarget` is NOT called; no state transition; existing connection object untouched.
  - Use a real `createConnectionStateStore()` with listener hooks to assert the transition sequence (mirror `connect-command.test.ts` style); use a fake `ConnectToTargetOperation` and a fake `Localize`/`@vscode/l10n` `t`.
- [ ] `tests/unit/debugger/debug-session-manager.test.ts` (extend):
  - `launch()` with no debugger session + `ensureConnection` that connects (after which `getDebuggerSession()` returns a fake session) → `ensureConnection` is awaited, then the normal enable flow runs.
  - `launch()` where `ensureConnection` rejects → `launch()` rejects with the same error; `running` stays false; no listeners leaked.
  - `launch()` with no `ensureConnection` and no session → preserves the existing `"Cannot start debug session: connect to a browser target first."` throw (regression guard).
- [ ] `tests/unit/debugger/notebook-dap-adapter.test.ts` (extend): a fake session manager whose `launch()` rejects with a known message → `launchRequest` calls `sendErrorResponse` with that message and does not send `InitializedEvent` (session ends cleanly).
- [ ] `tests/unit/debugger/debug-adapter-factory.test.ts` (new):
  - factory reads `session.configuration.host` / `.port` and constructs a manager whose injected `ensureConnection`, when invoked with no active connection, calls the injected `connectToTarget` with that endpoint.
  - with a fake `getActiveConnection` returning a connection, the wired `ensureConnection` rejects with the single-active guidance and does not call `connectToTarget`.
  - Use the existing faking style (direct instantiation with option factories; fake `createSessionManager` / `createAdapter` to capture the passed `ensureConnection`).

### 8. Integration Test (AC: 1) — Optional/Light

- [ ] If the existing CDP-backed harness under [tests/integration/debugger](../../tests/integration/debugger) supports it, add a focused test that drives a debug launch against a controllable CDP fixture and asserts: no prior connection → after launch, `getActiveBrowserConnection()` is set and the state store reached `connected`. If the harness cannot start a real debug session deterministically, document why and rely on the unit coverage above (the connect transport itself is already covered by Story 1.3 integration tests). Do NOT add a flaky live-browser dependency to CI.

### 9. Validation

- [ ] `npm run lint`.
- [ ] `npm run test`.
- [ ] `npm run compile`.
- [ ] Manual smoke in the Extension Development Host (requires a running CDP-enabled browser on the configured endpoint — use [scripts/Start-EdgeDebug.ps1](../../scripts/Start-EdgeDebug.ps1) or an equivalent):
  - With no active connection, start the `jupyter-browser-kernel` debug configuration (play button) and confirm the status indicator moves `connecting` → `connected` and the session starts without a "connect first" error.
  - With the session active, run a browser-kernel notebook cell and confirm it executes against the established connection (no separate connect step needed).
  - Start a **second** `jupyter-browser-kernel` debug session and confirm it is rejected with the single-active guidance, while the first session and its connection keep working.
  - Point the configuration at an unreachable `port`, start the session, and confirm an actionable failure diagnostic appears and the debug session ends cleanly (no dangling session, state returns to `error`/`disconnected`).

## Dev Notes

### Story Context and Scope

This is the **second story in Epic 11** (Debug-Session-Driven Connection Lifecycle, FR40). Story 11.1 made the debug configuration carry and validate the endpoint (`host` / `port` resolved against settings and attached to `session.configuration`). Story 11.2 consumes that resolved endpoint and makes **pressing play actually connect** — the debug session start becomes the connect trigger, reported through the existing FR4 connection state machine.

Epic 11 progressively re-homes the connection lifecycle onto the debug session: 11.2 (connect on start) → 11.3 (reconnect on restart) → 11.4 (disconnect on stop) → 11.5 (run-cell prompt) → 11.6 (retire the standalone commands). This story deliberately stops at connect-on-start; it must not pre-implement teardown, restart, or command removal.

[Source: docs/epics/epic-11-debug-session-driven-connection-lifecycle-post-mvp-core.md#Story 11.2: Connect on Debug Launch]
[Source: docs/prd.md#FR40]
[Source: docs/architecture.md — "Debug-session-driven connection lifecycle (Epic 11, FR40)"]

### What Already Exists (Reuse — Do Not Reinvent)

- **Resolved endpoint on the session**: Story 11.1's `DebugConfigProvider.resolveDebugConfiguration` attaches the final `host` / `port` to the returned `DebugConfiguration`, so `session.configuration.host` / `.port` are available in `DebugAdapterFactory.createDebugAdapterDescriptor(session)`. The provider aborts launch (returns `undefined` + `showError`) on invalid endpoints, so a started session has a valid endpoint. [Source: docs/stories/11-1-configure-cdp-endpoint-via-debug-configuration-attributes.md]
- **Transport connect**: `connectToBrowserTarget(endpoint, profile?, localize?, abortSignal?, deps?)` in [src/transport/browser-connect.ts](../../src/transport/browser-connect.ts) returns `ConnectToTargetResult` (`{ ok: true, connectedTarget, endpoint } | { ok: false, failure, endpoint }`) and assigns the module-level `activeBrowserConnection` singleton on success. `getActiveBrowserConnection()` and `disconnectActiveBrowserConnection()` are the singleton accessors. Reuse these; do not add a second connection path. [Source: src/transport/browser-connect.ts]
- **State machine**: `withConnectTransition(store, attempt, isSuccess, onAborted)` and `ConnectionStateStore` in [src/transport/connection-state.ts](../../src/transport/connection-state.ts) own the `connecting` → `connected` | `error` transitions (with stale-transition protection). The connect command's `runConnect` is the reference usage. States are `"disconnected" | "connecting" | "connected" | "error"` (FR4). [Source: src/transport/connection-state.ts]
- **Failure formatting**: `formatConnectFailureMessage(failure, endpointSummary, localize)` in [src/transport/connect-diagnostics.ts](../../src/transport/connect-diagnostics.ts) and `summarizeEndpointForDisplay(endpoint)` produce the actionable, loopback-safe message — reuse for the launch error and error context. `ConnectFailureCategory` = `"target-mismatch" | "endpoint-connectivity" | "transport-failure"`. [Source: src/transport/connect-types.ts]
- **DAP machinery (Epic 10)**: `DebugAdapterFactory` ([src/debugger/debug-adapter-factory.ts](../../src/debugger/debug-adapter-factory.ts)) creates a per-session `DebugSessionManager` + `NotebookDebugAdapter`. `NotebookDebugAdapter.launchRequest` already try/catches `sessionManager.launch()` and emits `sendErrorResponse` on throw. `DebugSessionManager.launch()` ([src/debugger/debug-session-manager.ts](../../src/debugger/debug-session-manager.ts)) currently throws `"Cannot start debug session: connect to a browser target first."` when `getDebuggerSession()` is `undefined` — this story replaces that early throw with the connect-on-launch path while preserving the message as the no-coordinator fallback. [Source: src/debugger/*]
- **Extension wiring**: `extension.ts` already creates `connectionStateStore` and constructs `new DebugAdapterFactory({ logger })`. Extend the construction to pass `connectionStateStore`. The status indicator + logger already subscribe to the store, so FR4 reporting is automatic once the coordinator drives transitions. [Source: src/extension.ts]

### Architecture Guardrails (Must Follow)

- **Single active-connection constraint is unchanged**: one module-level `activeBrowserConnection`; many profiles may be defined, but only one is active and a second concurrent debug session is rejected with guidance. Enforce by checking `getActiveConnection()` before connecting in the coordinator — do not introduce a new connection registry. [Source: docs/architecture.md — Epic 11 / FR40]
- **Connection state machine + FR4 reporting are preserved**: drive `connecting` → `connected` | `error` only through `withConnectTransition` / the store. Do not set states directly or bypass the transition-id protection. [Source: docs/architecture.md]
- **`Debugger.enable` ownership stays with the DAP session manager**: connect-on-launch runs strictly before the existing enable flow inside `launch()`. Do not move or duplicate `Debugger.enable`/`disable`. [Source: docs/architecture.md lines 207–210, 763]
- **DevTools coexistence (NFR8/NFR18)**: connecting uses the existing flat-session multiplex in `connectToBrowserTarget`; nothing in this story force-detaches DevTools. The single-active rejection must NOT call `disconnect` on the existing connection. [Source: docs/prd.md#NFR18]
- **Layer boundaries + DI**: the coordinator lives in `src/debugger` but must be VS Code-runtime-free (inject `connectToTarget`, `getActiveConnection`, `connectionStateStore`, `localize`) so it is unit-testable without a live VS Code/browser — same DI style as `DebugConfigProvider` (Story 11.1) and the command runtimes. [Source: .github/copilot-instructions.md#Coding Standards]
- **Localization**: the single-active guidance string is a runtime user-facing message → add to [l10n/bundle.l10n.json](../../l10n/bundle.l10n.json) and emit via `vscode.l10n.t(...)`. Connect-failure text reuses the existing `formatConnectFailureMessage` strings — do not duplicate. Never hardcode user-facing text in source. [Source: .github/copilot-instructions.md#Coding Standards]
- **Type hygiene**: reuse `EndpointConfig`, `ConnectToTargetOperation`, `ActiveBrowserConnection`, `ConnectionStateStore`; bind to `vscode.DebugConfiguration` fields rather than re-declaring; prefer named option/result types over inline object types; prefer single-assignment `const`. [Source: .github/copilot-instructions.md#Coding Standards]

### Key Decisions to Make and Document

- **Where the second-session rejection lives** (chosen: the connect-on-launch coordinator / `launch()` path, surfaced as a DAP launch error). Rationale: it binds the rejection to the actual launch attempt, leaves the existing connection provably untouched (check-before-connect), and ends the rejected session cleanly via `sendErrorResponse`. An alternative — rejecting earlier in `DebugConfigProvider.resolveDebugConfiguration` (return `undefined` + `showError`) — was considered but couples the provider to connection state and the Story 10.1 review explicitly decided the provider does NOT gate on `getActiveBrowserConnection()`. If you change placement, justify it in Dev Notes and update tests accordingly.
- **Endpoint source in the factory** (chosen: read `session.configuration.host` / `.port` from Story 11.1's attach, with a settings-resolution fallback only as defense-in-depth). Document whether you keep the fallback.
- **Info/toast on successful connect**: out of scope by default — the debug session UI + `connected` state are the success signals, and a toast on every play would be noisy. If you add one, reuse the connect command's `"Jupyter Browser Kernel: Connected to target {0} at {1}."` string; do not invent a new one. Document the choice.
- **Abort handling**: reuse the `withConnectTransition` `onAborted` hook as `runConnect` does. A debug launch is not user-cancelable mid-connect today the way the command is, so the abort path is mostly defensive; keep it consistent rather than adding new cancellation surfaces (cancellation/teardown is Story 11.4 territory).

### Testing Strategy

- Highest-value coverage is the **coordinator truth table** (no connection × connect-success/connect-failure, plus already-connected → reject) with a real state store and fake transport — this directly proves AC 1 and AC 2.
- `debug-session-manager` tests prove the `launch()` integration (ensureConnection awaited before enable; rejection propagates; legacy fallback throw preserved).
- `notebook-dap-adapter` test proves the failure path becomes a clean DAP error response (AC 1 "end the session cleanly").
- `debug-adapter-factory` test proves the wiring (endpoint from `session.configuration`, ensureConnection constructed and passed through).
- No new live-browser CI dependency: the transport connect is already integration-tested in Story 1.3; this story's integration test (if added) should use the existing controllable fixture only. [Source: docs/stories/1-3-connect-to-a-valid-browser-target.md]

### Project Structure Notes

- New/extended files:
  - [src/debugger/connect-on-launch.ts](../../src/debugger/connect-on-launch.ts) — new coordinator (`createEnsureBrowserConnection` + `EnsureBrowserConnectionOptions`).
  - [src/debugger/debug-session-manager.ts](../../src/debugger/debug-session-manager.ts) — add `ensureConnection?` option + use it in `launch()`.
  - [src/debugger/debug-adapter-factory.ts](../../src/debugger/debug-adapter-factory.ts) — add `connectionStateStore` / `connectToTarget` options; read `session.configuration`; wire `ensureConnection`.
  - [src/debugger/index.ts](../../src/debugger/index.ts) — export the new coordinator symbol(s) if other modules/tests import them.
  - [src/extension.ts](../../src/extension.ts) — pass `connectionStateStore` (and optional `getSettings`) to `DebugAdapterFactory`.
  - [l10n/bundle.l10n.json](../../l10n/bundle.l10n.json) — one single-active guidance string.
  - `tests/unit/debugger/connect-on-launch.test.ts` (new), `tests/unit/debugger/debug-adapter-factory.test.ts` (new), and extensions to `tests/unit/debugger/debug-session-manager.test.ts` and `tests/unit/debugger/notebook-dap-adapter.test.ts`.
- Stays within the established `debugger` / `transport` module boundaries; no new top-level structure.

### References

- [Source: docs/epics/epic-11-debug-session-driven-connection-lifecycle-post-mvp-core.md#Story 11.2: Connect on Debug Launch]
- [Source: docs/prd.md#FR40]
- [Source: docs/prd.md#FR4]
- [Source: docs/prd.md#NFR18]
- [Source: docs/architecture.md — Debug-session-driven connection lifecycle (Epic 11, FR40)]
- [Source: docs/stories/11-1-configure-cdp-endpoint-via-debug-configuration-attributes.md — endpoint resolution + attach pattern]
- [Source: docs/stories/10-1-register-and-bootstrap-notebook-cell-dap-session.md — DAP factory/adapter/session-manager patterns]
- [Source: docs/stories/1-3-connect-to-a-valid-browser-target.md — connect transport + diagnostics]
- [Source: docs/archives/sprint-change-proposal-2026-06-23.md — Epic 11 recommended technical approach]
- [VS Code API — DebugAdapterDescriptorFactory](https://code.visualstudio.com/api/references/vscode-api#DebugAdapterDescriptorFactory)
- [VS Code API — DebugSession.configuration](https://code.visualstudio.com/api/references/vscode-api#DebugSession)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-24: Story drafted — connect-on-debug-launch with FR4 state reporting, actionable failure diagnostics, and single-active-connection rejection.

# Deferred Work

## Deferred from: code review of 11-5-prompt-to-start-a-debug-session-when-running-a-cell-without-one (2026-06-26)

- 15-second connection-ready timeout hardcoded (`CONNECTION_READY_TIMEOUT_MS = 15000`) with no user setting. Slow or remote browser targets may need longer. [src/notebook/debug-session-preflight.ts]
- `ignoreFocusOut: true` on the multi-config quick-pick is non-standard for pickers the user did not explicitly open. Low-priority UX concern. [src/notebook/debug-session-preflight.ts]
- `onDidTerminateDebugSession` callback assumes `activeDebugSession` is already cleared by the time the event fires — VS Code practice supports this but it is undocumented. [src/notebook/debug-session-preflight.ts]
- Out-of-scope production changes in `connect-command.ts`, `disconnect-command.ts`, and `kernel-transport-failure-reporter.ts` (fire-and-forget notification refactor + type widening). Safe and consistent with new pattern but outside story scope.
- `toStableSerialization` serializes JS `undefined` values as the string `"undefined"` via template coercion (`JSON.stringify(undefined)` returns the JS value `undefined`, not a string). Structurally equivalent configs with explicit-undefined vs absent keys produce different dedup keys. Affects only malformed launch configs. [src/notebook/debug-session-preflight.ts]
- `supportsSessionPreflight` uses `as Partial<SessionPreflightApi>` cast without structural validation. Runtime logic is correct; TypeScript type safety is loose. [src/notebook/kernel-controller.ts]

## Deferred from: code review of 11-4-disconnect-on-debug-stop (2026-06-25)

- `terminateEmitter.fire("connection-lost")` moved before `void stopRunningSession()` — VS Code may send a follow-up `disconnect`/`terminate` concurrently with still-running connection-lost cleanup; CDP in-flight commands fail when `disconnectActiveConnection()` closes the WebSocket. Intentional to avoid hang scenarios; test validates this ordering. [src/debugger/debug-session-manager.ts]
- `disconnectActiveConnection` called twice when `disconnect()` + `terminate()` both fire — `stopRunningSession()` is idempotent but `disconnectActiveConnection` has no guard; second call throws on already-closed transport, caught gracefully. End state always `disconnected`. [src/debugger/debug-session-manager.ts]
- Misleading "Failed to disconnect active browser connection" log on normal connection-loss teardown — expected failure from calling disconnect on a dead transport, logged as an error. [src/debugger/debug-session-manager.ts]
- `void stopRunningSession()` in connection-lost handler silently drops errors from `clearAll`/`dispose` — intentional best-effort cleanup in failure scenario. [src/debugger/debug-session-manager.ts]

## Deferred from: code review of 11-3-reconnect-on-debug-restart (2026-06-25)

- `sendErrorResponse(response, 0, ...)` uses error code `0` in `restartRequest` ([src/debugger/notebook-dap-adapter.ts](../../src/debugger/notebook-dap-adapter.ts)). Pre-existing pattern from `launchRequest`; non-standard but harmless for the current VS Code DAP client.
- No concurrent-restart guard in `restart()` ([src/debugger/debug-session-manager.ts](../../src/debugger/debug-session-manager.ts)). Two rapid `restart()` invocations could overlap in the `launch()` phase. Pre-existing gap mirrored by `launch()` itself; VS Code debug UI disables the restart control during restart.

## Deferred from: code review of 11-2-connect-on-debug-launch (2026-06-24)

- Error context not set when `connectToTarget` throws instead of returning `{ ok: false }` ([src/debugger/connect-on-launch.ts](../../src/debugger/connect-on-launch.ts) `createEnsureBrowserConnection`). Out-of-contract throw path: state transitions to `error` via `withConnectTransition`, but `setErrorContext` is never called, so the FR4 status indicator lacks guidance text. Mirrors the existing `runConnect` pattern; low risk because the transport returns results by contract.
- Defensive endpoint fallback in `resolveEndpointFromSessionConfiguration` ([src/debugger/debug-adapter-factory.ts](../../src/debugger/debug-adapter-factory.ts)) is all-or-nothing: a partially-provided `session.configuration` (only host or only port, or a wrong type) discards both and falls back to settings, and validation errors attribute the fix to the settings surface rather than the debug config. Triggers only when Story 11.1's `DebugConfigProvider` (which normally attaches both validated fields) is bypassed.
- Coordinator `onAborted` is a no-op (`() => undefined`) and diverges from `runConnect`, which disconnects an aborted-but-succeeded connection. Not triggerable today — a debug launch is not user-cancelable mid-connect; cancellation/teardown is Story 11.4.

## Deferred from: code review of 10-5-validate-dual-client-coexistence-and-reliability (2026-06-22)

- Task 8 Clean Teardown asserts only that `Runtime.releaseObject` was called more times after disconnect (`releaseObjectCalls > before`), not that all reserved objectIds were released. The spec explicitly concedes `VariableStore` has no count method and accepts indirect spy verification, so completeness cannot be asserted directly. Acknowledged limitation.
- `findGameTarget` returns the first `page` target whose URL includes `/game` without asserting uniqueness. Safe today because each integration suite launches a fresh dedicated Chromium, but it would silently pick the wrong target if a persistent browser with multiple `/game` tabs were ever reused.

## Deferred from: code review of 10-4-implement-stepping-controls-and-pause-lifecycle-synchronization (2026-06-22)

- Step handlers (`stepOver`/`stepInto`/`stepOut`) do not mirror `resume()` — they omit clearing `pausedEvent` and bumping `pauseVersion`. Latent inconsistency only; `ensurePausedFrames()` is gated on `pauseVersion` which is bumped by the next `Debugger.paused`, and termination clears state. No observed defect.
- New step/pause DAP error responses pass raw `error.message` to `sendErrorResponse` without `vscode.l10n.t()`, mirroring the already-shipped `continueRequest`. No new hardcoded string; consistency-with-existing-code concern.
- `scriptUrlMap` is never evicted (cleared only on session stop); stale `scriptId` entries accumulate across in-session page reloads. Minor memory growth, tied to the out-of-scope source-resolution feature.

## Deferred from: code review of 10-2-verify-and-bind-notebook-cell-breakpoints-in-vs-code-ui (2026-05-30)

- No defensive validation for a missing `result.locations` field from `Debugger.setBreakpointByUrl` — currently relies on the CDP TypeScript types declaring the field as present; low risk.
- No validation for invalid DAP line/column inputs (line ≤ 0, negative column) before forwarding to CDP — defensive only; VS Code does not produce such inputs.
- Theoretical race: `recordSetBreakpoints` may mutate `cachedBreakpointsByUrl` during the `launch()` cached-payload replay loop — narrow async window, no observed failure.
- `removeBreakpoint` rejection still deletes the local registry entry via `finally`, potentially leaving a stale runtime breakpoint on the V8 side — intentional "best-effort" per Task 2 spec.
- Integration test `breakpoint-binding.integration.test.ts` polls at 25 ms × 120 (~3 s) — may flake on slow CI; consider an adaptive wait or longer cap.

## Deferred from: code review of 10-1-register-and-bootstrap-notebook-cell-dap-session (2026-05-23)

- Two concurrent `vscode.DebugSession` instances against the same `ActiveBrowserConnection` race on `Debugger.enable`/`Debugger.disable` and emit two `connection-lost` terminations. Explicitly out of scope for Story 10.1; Story 10.5 (dual-client coexistence) is expected to address this with reference counting or session arbitration.
- `connectionStateListeners` set is iterated inside `setState` while listeners may add or remove subscriptions during dispatch. Pre-existing transport-module behavior, not introduced by Story 10.1; defer until a transport-layer cleanup story addresses listener-dispatch safety holistically.

## Deferred from: code review of 1-2-configure-browser-endpoint (2026-04-04)

- `isLoopbackHost` does not cover the `127.x.x.x` block or IPv6 variants (`::ffff:127.0.0.1`, `0:0:0:0:0:0:0:1`) — these are displayed as `[redacted-host]` instead of the raw loopback address. Expanded loopback display classification deferred to post-MVP.
- `watchAutoRefreshInterval` is missing `markdownDescription` and min/max schema constraints, unlike its sibling `cdpPort`. Deferred — outside Story 1.2 task scope.
- Generic `"{0} {1}"` l10n key is shared by all two-argument error compositions, limiting targeted translation and key-specific comments. Deferred — not a functional bug, translation quality concern.
- ~~`format` test helper re-implements `vscode.l10n.t` substitution logic.~~ Resolved: replaced with `@vscode/l10n` (the canonical standalone package) imported directly in `tests/unit/commands/connect-command.test.ts`.
- `config.get<string>("cdpHost", ...)` wrapping with `String()` means a corrupted config returning an object would produce `"[object Object]"`, which passes host validation and is used as a hostname. Deferred — VS Code settings infrastructure prevents configuration corruption in practice.

## Deferred from: code review of 1-3-connect-to-a-valid-browser-target (2026-04-08)

- `connectionStateStore.getState()` is unused interface surface — `getState()` is defined on `ConnectionStateStore` but never called in command or extension code. State is pushed via callbacks, not pulled. Benign unused API.
- `extensionKind` in `package.json` is set to `"ui"` and `"workspace"` instead of `"ui"` only to make the extention debuggable. When adding CI packaging (**story 1.7**), the `extentionKind` must be patch in the pipeline.

## Deferred from: code review of 1-4-disconnect-and-manual-reconnect-lifecycle (2026-04-11)

- No explicit 5-second timeout wrapper for reconnect (NFR2/NFR4). AC 2 requires "reports success or failure within 5 seconds." Implementation relies on CDP library default timeouts. No `Promise.race` timeout guard. CDP defaults are reasonable for MVP.

## Deferred from: code review of 1-6-surface-connection-state-and-recovery-actions (2026-04-13)

- Timestamp logging uses time-only format (`toLocaleTimeString`) — multi-day sessions produce ambiguous log entries without date context. Pre-existing pattern.
- `endpointSummary()` re-reads workspace configuration on every tooltip render and log line. Harmless at current event frequency but would be wasteful under rapid state changes. Pre-existing pattern.

## Deferred from: code review of 2-2-run-asynchronous-javascript-cells (2026-04-18)

- ~~`raceWithTimeout` never cancels the underlying CDP evaluation — when the timeout fires, the browser continues executing the expression. `Runtime.terminateExecution` could be used for cleanup. Acceptable for MVP scope.~~ Resolved in Story 2.2 by issuing `Runtime.terminateExecution` on timeout.
- Magic string coupling between transport timeout message (`"CDP evaluation timed out"`) and kernel regex (`TIMEOUT_ERROR_PATTERN`) — fragile contract via string matching instead of typed error. Requires design decision on shared error contract.
- ~~`replMode: true` was added to `Runtime.evaluate` params in Story 2.2 without spec authorization. It changes CDP evaluation semantics (top-level await, completion-value return). Flag for Story 2.4 planning to decide whether to keep or remove.~~ Resolved: addressed by Story 2.5 (validate `replMode` against breakpoint binding; switch evaluation strategy if incompatible).

## Deferred from: code review of 2-3-normalize-success-and-failure-output-contracts (2026-04-19)

- No test for Symbol/Function without `description` field — CDP can theoretically return symbols/functions where `description` is undefined, causing `serializeRemoteValue` fallthrough to `JSON.stringify(undefined)` → `"undefined"`. CDP always provides `description` for these types in practice.

## Deferred from: breakpoint compatibility discovery (2026-04-19)

- ~~`addSourceLabeling` uses a static `//# sourceURL=cell.js` for all cells. Must be replaced with per-cell identity reflecting notebook file name and cell index (e.g., `notebook-name.cell-3.js`). Deferred to Story 2.4 — sourceURL scheme should be designed alongside wrapping lambda and breakpoint-compatibility decisions.~~ Resolved: addressed by Story 2.4 per-cell sourceURL contract.
- ~~Breakpoint debugging was identified as an implicit MVP capability not covered by any existing FR or epic. Browser-level breakpoints require CDP `Debugger` domain integration and a stable source-name contract between VS Code notebook URIs and `sourceURL` directives. Run Correct Course (`bmad-correct-course`) before starting Story 2.4 to integrate this into PRD, architecture, and epic planning.~~ Resolved: Sprint Change Proposal 2026-04-19 added FR38, Story 2.5, and architecture coverage.

## Deferred from: Story 2.5 scope split (2026-04-25)

- ~~**Full VS Code Debug Adapter for cell debugging.** Planned under Epic 10 (Post-MVP Core): "Full VS Code Debugging Experience" via Sprint Change Proposal 2026-05-11. Story 2.5 (amended 2026-04-25) implements only the CDP-side mirror: VS Code-side notebook-cell breakpoints are forwarded to the page via `Debugger.setBreakpointByUrl` and pause execution in the browser, but pause inspection happens in the browser's DevTools. The VS Code editor does NOT show a solid "verified" gutter glyph, does NOT enter a `vscode.DebugSession`, does NOT highlight the paused line, and does NOT populate the Variables / Call Stack / Watch panels. Implementation validation also confirmed a Chromium/DevTools limitation: a breakpoint mirrored from the extension's separate CDP session can bind in V8 and trigger pauses without rendering a visible gutter marker in DevTools Sources. To deliver a real VS Code debug experience for notebook cells (solid gutter glyph, paused-line marker, Variables/Watch/Call Stack panels, step in/over/out, conditional breakpoints, exception breakpoints), the extension must register its own Debug Adapter Protocol (DAP) adapter that claims the `vscode-notebook-cell://` URI scheme and bridges DAP requests to the existing CDP Debugger/Runtime domains. vscode-js-debug cannot be reused because it has no extension point for foreign URI schemes (see decision history in this branch's chat record). This remains deferred until Epic 10 implementation begins because the DAP surface (`setBreakpoints`, `threads`, `stackTrace`, `scopes`, `variables`, `continue`, `next`/`stepIn`/`stepOut`, `evaluate`, `stopped`, exception breakpoints, conditional breakpoints, lifecycle, plus reconciliation with the existing extension connection and DevTools coexistence) is substantially larger than any current Epic 2 story.~~ Resolved: Sprint Change Proposal 2026-05-15 promoted Epic 10 to active and folded the Story 2.5 mirror decommission into Story 10.1; the DAP adapter is now scoped across Stories 10.1\u201310.5.

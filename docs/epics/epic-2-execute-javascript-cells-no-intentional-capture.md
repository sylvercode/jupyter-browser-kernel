# Epic 2: Execute JavaScript Cells (No Intentional Capture)

**Goal:** Enable reliable, breakpoint-debuggable JavaScript cell execution against a live browser execution target, with normalized result contracts and fast iteration patterns.

**Stories:**

## Story 2.1: Run Synchronous JavaScript Cells

As a developer,
I want to execute synchronous JavaScript cells against the active browser target,
So that I can validate browser state and behavior directly from notebook cells.

**Acceptance Criteria:**

**Given** an active session with a valid browser execution target
**When** I run a synchronous JavaScript cell
**Then** the code executes in the browser context
**And** the primitive or serializable return value is shown inline.

**Given** a cell that throws synchronously
**When** execution completes
**Then** the error message and type are shown inline
**And** no uncaught exception leaks to the extension host.

**Given** no active session
**When** I attempt to run a cell
**Then** execution is blocked
**And** a clear reconnect prompt is shown in the cell output.

**Scope Note (FR10 boundary):** Story 2.1 establishes baseline inline return-value visibility for successful synchronous execution. Story 4.1 extends this with structured rendering and explicit value-presentation semantics.

## Story 2.2: Run Asynchronous JavaScript Cells

As a developer,
I want async and Promise-based cell code to resolve correctly,
So that notebook execution supports real Foundry runtime workflows that use async APIs.

**Acceptance Criteria:**

**Given** a cell that returns a Promise or uses top-level await
**When** execution completes
**Then** the resolved value is shown inline
**And** resolution is deterministic within the CDP evaluation timeout.

**Given** a cell whose Promise rejects
**When** rejection propagates
**Then** the rejection reason is shown as a structured error
**And** the failure is classified separately from synchronous throws.

**Given** any async cell
**When** the run starts
**Then** the cell shows an in-progress indicator until the Promise settles
**And** no timeout or hangup occurs without surfacing diagnostics.

## Story 2.3: Normalize Success and Failure Output Contracts

As a developer,
I want consistent result shapes for every cell run,
So that success and failure are interpretable regardless of transport internals.

**Acceptance Criteria:**

**Given** a cell that executes successfully
**When** the result is serialized
**Then** it follows the normalized success contract (value, type metadata)
**And** no raw CDP protocol fields are visible in cell output.

**Given** any execution failure
**When** the error result is produced
**Then** it includes message, error type, and stack where available
**And** it follows the normalized failure contract consistently.

**Given** a transport-level error (e.g., session drop mid-run)
**When** execution fails
**Then** the error is wrapped in the normalized failure contract
**And** no protocol-level detail leaks directly to the cell output.

**Given** both sync and async execution paths
**When** results are produced
**Then** classification parity holds — the same contract shapes are used
**And** downstream rendering code does not branch on transport type.

**Traceability Note:** Validates NFR5 (no silent failure) and NFR6 (classification parity across execution paths).

## Story 2.4: Support Fast Rerun and Iteration Patterns

As a developer,
I want to rerun edited cells quickly with predictable execution state,
So that I can iterate rapidly without connection overhead or state confusion.

**Acceptance Criteria:**

**Given** an active session
**When** I rerun an edited cell
**Then** execution begins without a reconnect cycle
**And** the result reflects the current cell content.

**Given** default kernel semantics
**When** multiple cells run in sequence
**Then** state accumulates within the session as expected
**And** no unintended isolation occurs unless explicitly requested.

**Given** intentional namespace isolation is desired
**When** a cell opts into isolation (per kernel contract)
**Then** it executes without inheriting prior cell state
**And** the isolation boundary is visible from cell output or metadata.

**Given** any cell run outcome
**When** execution completes
**Then** success or failure is visible inline without navigating away
**And** the next edit-run cycle requires no additional navigation steps.

**Given** any cell run
**When** the kernel emits the cell to the browser
**Then** the cell carries a per-cell `//# sourceURL` directive derived from the notebook URI and cell index
**And** the directive is stable across reruns of the same cell within the session.

**Given** wrapping-lambda introduction for variable-creation control
**When** the wrapper is applied
**Then** user-visible line numbers map 1:1 to the source visible in the browser's Sources panel
**And** any synthesized lines do not shift user line numbers.

**Scope Note (FR38 boundary):** Story 2.4 establishes the per-cell source identity contract and line-offset preservation. Story 2.5 enables the CDP Debugger domain and validates that browser-set breakpoints bind and fire on this identity.

## Story 2.5: Mirror Notebook-Cell Breakpoints Into the Browser Debugger

As a developer,
I want a breakpoint set on a notebook cell in VS Code to also exist in the browser's Sources panel against that cell, so that running the cell pauses at my breakpoint and I can debug it in the browser developer tools (DevTools) without manually re-creating breakpoints there,
So that I get a single authoring surface for cell breakpoints (the VS Code gutter) while DevTools remains the inspection surface for pause, step, variables, and call stack.

**Posture change vs. spike findings.** The Story 2.5 ACs originally inherited the **Passive Provider** posture locked by [spike/cdp-sourceurl-debugger-findings.md](../../spike/cdp-sourceurl-debugger-findings.md) (Q2). To make VS Code-side cell breakpoints reach the page, the extension must mirror them via `Debugger.setBreakpointByUrl`, which requires `Debugger.enable` on the extension's per-target session. The extension therefore moves to the **Diagnostic Observer** posture (Q3, validated as multi-client safe) with the explicit invariant that the extension auto-resumes any `Debugger.paused` event delivered to its own session so it never holds the JS thread for any other CDP client.

**Scope boundary — no VS Code-side debug UI.** This story is the CDP-side mirror only. The VS Code editor will NOT show a solid "verified" gutter glyph, will NOT enter a `vscode.DebugSession`, will NOT highlight the paused line, and will NOT populate the Variables / Call Stack / Watch panels. Pause inspection happens in the browser's DevTools (the same workflow already validated in the spike). Adding a Debug Adapter Protocol (DAP) adapter to surface a real VS Code debug session is tracked separately in [docs/stories/deferred-work.md](../stories/deferred-work.md) under "Full VS Code Debug Adapter for cell debugging".

**Acceptance Criteria:**

**Given** an active session with a valid browser execution target
**When** the session attaches
**Then** `Debugger.enable` is invoked on the extension's per-target flat session (Diagnostic Observer posture)
**And** session attach failure for the Debugger domain surfaces as a normalized error.

**Given** a `vscode.SourceBreakpoint` whose `location.uri.scheme === 'vscode-notebook-cell'`
**When** the extension is connected to a target
**Then** the extension calls `Debugger.setBreakpointByUrl` using the cell URI string (`NotebookCell.document.uri.toString()`, identical to the `//# sourceURL=` value emitted by Story 2.4) as the `url` and the breakpoint's zero-based line number
**And** rerunning the matching cell pauses execution in the browser at the expected line, visible in the browser's DevTools Sources panel.

**Given** the user adds, removes, edits, enables, or disables a notebook-cell breakpoint
**When** `vscode.debug.onDidChangeBreakpoints` fires
**Then** the extension translates the change into the corresponding `Debugger.setBreakpointByUrl` / `Debugger.removeBreakpoint` call on its session
**And** the in-memory mapping from `Breakpoint.id` to CDP `breakpointId` is kept consistent.

**Given** the extension connects after VS Code-side notebook-cell breakpoints already exist
**When** the connection becomes active
**Then** the extension snapshots `vscode.debug.breakpoints`, registers all notebook-cell breakpoints with the page, and the next cell run pauses on any matching breakpoint on the first execution (per spike Q4).

**Given** the extension's session receives a `Debugger.paused` event
**When** the event is delivered
**Then** the extension immediately calls `Debugger.resume` on its own session
**And** the extension does not block the JS thread for any other CDP client (DevTools, if attached, retains independent pause/step control on its own session).

**Given** a cell with a per-cell `//# sourceURL` (Story 2.4 contract)
**When** I set a breakpoint on a line of that cell directly in the browser's Sources panel
**Then** the browser-side breakpoint still binds and fires on rerun without extension involvement (the original spike workflow continues to work unchanged).

**Given** the same cell is edited and rerun
**When** a notebook-cell breakpoint is set
**Then** the breakpoint persists against the stable cell URI
**And** the breakpoint fires on the new execution if the line still exists.

**Given** evaluation requires top-level await (Story 2.2 behavior)
**When** the evaluation path runs under Story 2.5
**Then** `Runtime.evaluate({ replMode: true, awaitPromise: true })` is retained as validated by Q1 of the spike
**And** breakpoints bind reliably AND top-level await still resolves.

**Given** Edge DevTools is attached to the same target
**When** the extension enables the Debugger domain and registers breakpoints
**Then** DevTools' own debugger session is not displaced (per Q3 multi-client coexistence)
**And** notebook execution continues to coexist with DevTools.

**Out of scope for this story (deferred follow-up — see [docs/stories/deferred-work.md](../stories/deferred-work.md) "Full VS Code Debug Adapter for cell debugging"):**

- Solid "verified" gutter glyph in the VS Code editor. Owned by VS Code's debug machinery and only flipped when a registered DAP adapter reports `verified: true`.
- VS Code-side pause UI (yellow paused-line marker, Variables/Call Stack/Watch panels, step/continue buttons). Requires a DAP adapter.

**Traceability Note:** Implements the CDP-side mirror portion of FR38, validates NFR8 (DevTools coexistence) under active debugger usage, and supersedes the Passive Provider AC adjustments listed in [spike/cdp-sourceurl-debugger-findings.md](../../spike/cdp-sourceurl-debugger-findings.md). The full VS Code-side debug experience portion of FR38 is split out to the deferred adapter epic.

---

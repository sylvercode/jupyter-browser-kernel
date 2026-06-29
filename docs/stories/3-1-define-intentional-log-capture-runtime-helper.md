---
storyId: "3.1"
storyKey: "3-1-define-intentional-log-capture-runtime-helper"
title: "Define Intentional Log Capture Runtime Helper"
status: "done"
created: "2026-06-28"
epic: "3"
priority: "p1"
---

# Story 3.1: Define Intentional Log Capture Runtime Helper

**Status:** done

## Story

As a developer,
I want an extension-owned API I can call from cell code to emit intentional log entries,
So that I explicitly control what log output appears in notebook results.

## Acceptance Criteria

### AC 1: Helper Captures Intentional Log Calls Per Cell Run

**Given** cell code that calls the intentional log helper
**When** the cell executes
**Then** the helper enqueues a log entry associated with that cell run
**And** the helper accepts at least a string message argument.

### AC 2: Multiple Calls Preserve Call Order

**Given** the helper is called multiple times in one cell
**When** execution completes
**Then** all entries are captured in call order
**And** no entries are dropped or silently truncated within normal usage.

### AC 3: No Helper Call Means No Log Section and No Contract Regression

**Given** the helper is not called in a cell
**When** execution completes
**Then** no log section appears in the cell output
**And** the output contract remains unchanged for cells that produce only a return value.

## Tasks / Subtasks

### 1. Define the Intentional Log Helper Runtime Contract (AC: 1, 2)

- [x] Introduce an extension-owned helper contract for cell execution that exposes intentional logging (planned helper surface: `$cell.log(...)` under the extension-owned runtime envelope).
- [x] Ensure each `executeCell(...)` invocation creates a fresh per-run log buffer (no cross-cell leakage).
- [x] Support at minimum string-message input and coerce non-string values to a deterministic string form for stable output behavior.
- [x] Preserve strict call order in the log buffer exactly as helper calls occur.
- [x] Keep helper ownership in kernel/runtime envelope code. Do not rely on page-owned globals as the source of truth.

### 2. Wire Helper Injection Into Cell Expression Build Path (AC: 1, 2)

- [x] Update [src/kernel/build-cell-expression.ts](../../src/kernel/build-cell-expression.ts) to inject the helper envelope without breaking current sourceURL and isolation behavior.
- [x] Preserve Story 2.4 and Story 2.5 constraints:
  - Keep `//# sourceURL=` stable for reruns of the same cell URI.
  - Keep isolated/non-isolated wrapper behavior unchanged except for helper availability.
- [x] Add a narrow helper-injection utility (new file if needed) in `src/kernel/` rather than embedding large string templates inline in `executeCell`.

### 3. Extend Kernel Result Plumbing for Captured Logs (AC: 1, 2, 3)

- [x] Extend kernel execution plumbing in [src/kernel/execution-kernel.ts](../../src/kernel/execution-kernel.ts) to receive intentional-log capture payloads from evaluated cell execution.
- [x] Keep current success and failure output rendering semantics unchanged for this story unless logs exist.
- [x] Ensure "no helper call" path keeps existing single-value output behavior unchanged (regression guard for AC 3).
- [x] Do not mirror ambient `console.log` activity in this story. Only explicit helper calls are in scope.

### 4. Keep Existing Normalization and Infrastructure Boundaries (AC: 3)

- [x] Preserve discriminated-union normalization semantics in [src/kernel/execution-result.ts](../../src/kernel/execution-result.ts); no raw transport fields should leak into notebook output.
- [x] Keep transport ownership in [src/transport/browser-connect.ts](../../src/transport/browser-connect.ts); do not introduce direct Debugger-domain calls from kernel paths.
- [x] Keep user-facing strings localized via `vscode.l10n.t(...)` if any new messages are introduced.

### 5. Add Unit and Integration Coverage (AC: 1, 2, 3)

- [x] Update/add tests in [tests/unit/kernel/build-cell-expression.test.ts](../../tests/unit/kernel/build-cell-expression.test.ts) to validate helper injection plus sourceURL/isolation non-regression.
- [x] Update/add tests in [tests/unit/kernel/execution-kernel.test.ts](../../tests/unit/kernel/execution-kernel.test.ts) for:
  - single helper call captured,
  - multiple calls preserved in order,
  - no helper call preserves current output shape.
- [x] Add a fixture-oriented integration test in [tests/integration/kernel/fast-rerun.integration.test.ts](../../tests/integration/kernel/fast-rerun.integration.test.ts) or a new nearby integration test to validate per-run buffer isolation and no cross-run leakage.

### 6. Validation Run (AC: 1, 2, 3)

- [x] Run `npm run compile`.
- [x] Run `npm run lint`.
- [x] Run `npm run test:unit`.
- [ ] Run targeted integration tests if CDP integration is enabled.
- [x] No separate manual smoke test is required for this story as long as the unit/integration coverage above passes; if needed, defer manual end-to-end confirmation to Story 3.2 where log rendering is introduced.

## Dev Notes

### Story Context and Scope

Epic 3 introduces intentional output capture. Story 3.1 only establishes the runtime helper and deterministic capture pipeline. Rendering and visual presentation details are delivered by Story 3.2 and Story 3.3.

### Current State (Read-First Summary)

- [src/kernel/execution-kernel.ts](../../src/kernel/execution-kernel.ts) currently executes built expressions, normalizes results, and renders success/failure outputs. It currently has no intentional-log payload handling.
- [src/kernel/build-cell-expression.ts](../../src/kernel/build-cell-expression.ts) currently controls sourceURL and isolation wrapper behavior. This is the safest injection point for helper envelope shaping.
- [src/kernel/execution-result.ts](../../src/kernel/execution-result.ts) currently owns normalized success/failure contracts and failure-kind classification.
- [src/notebook/kernel-controller.ts](../../src/notebook/kernel-controller.ts) handles preflight and cell execution orchestration; it should remain thin and delegate runtime behavior to kernel modules.

### Implementation Guardrails

- Preserve existing sourceURL stability and line/offset behavior required for breakpoint continuity.
- Preserve existing isolated-cell annotation behavior and current success/failure output behavior when no intentional logs are present.
- Do not patch or intercept page-global `console.log`; intentional output must be explicit helper-driven emission.
- Keep the change profile-agnostic and in core kernel modules.
- Keep TypeScript strict-mode compatibility and avoid ad hoc anonymous object shapes in function signatures.

### Project Structure Notes

- Keep runtime logic in `src/kernel/` and avoid moving logic into `src/notebook/`.
- Keep tests in `tests/unit/kernel/` and `tests/integration/kernel/`.
- If a new helper module is added, keep naming consistent with existing kebab-case kernel files.

### References

- [Source: docs/epics/epic-3-capture-intentional-logs.md#story-31-define-intentional-log-capture-runtime-helper]
- [Source: docs/prd.md#result-normalization-and-output-contract]
- [Source: docs/prd.md#core-platform-requirements]
- [Source: docs/architecture.md#implementation-patterns--consistency-rules]
- [Source: docs/ux-spec/10-component-strategy.md#intentional-output-contract]
- [Source: docs/ux-spec/11-ux-consistency-patterns.md#additional-patterns]
- [Source: .github/copilot-instructions.md]

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Story created via bmad-create-story workflow on 2026-06-28.
- 2026-06-28: Implemented RuntilmeCellBridge helper and per-run buffer lifecycle in kernel execution.
- 2026-06-28: Added helper-prelude expression injection while preserving sourceURL and isolation wrappers.
- 2026-06-28: Added Story 3.1 focused unit coverage and integration fixture for per-run log isolation.
- 2026-06-28: Validation run completed: `npm run compile`, `npm run lint`, and focused Story 3.1 unit tests.

### Completion Notes List

- Added [src/kernel/runtilme-cell-bridge.ts](../../src/kernel/runtilme-cell-bridge.ts) with extension-owned helper runtime setup/teardown expressions and deterministic value coercion.
- Updated [src/kernel/build-cell-expression.ts](../../src/kernel/build-cell-expression.ts) to inject helper availability without changing sourceURL semantics.
- Updated [src/kernel/execution-kernel.ts](../../src/kernel/execution-kernel.ts) to bootstrap helper runtime, collect logs per run, and append a log section only when logs exist.
- Added localized section label in [src/kernel/execution-messages.ts](../../src/kernel/execution-messages.ts).
- Added/updated tests in [tests/unit/kernel/build-cell-expression.test.ts](../../tests/unit/kernel/build-cell-expression.test.ts), [tests/unit/kernel/execution-kernel.test.ts](../../tests/unit/kernel/execution-kernel.test.ts), [tests/unit/kernel/runtilme-cell-bridge.test.ts](../../tests/unit/kernel/runtilme-cell-bridge.test.ts), and [tests/integration/kernel/fast-rerun.integration.test.ts](../../tests/integration/kernel/fast-rerun.integration.test.ts).

## Story Conclusion

`$cell` is now intentionally available only in isolated mode. Shared/global mode does not expose the runtime cell bridge, because the bridge depends on a scoped per-run binding and would be unsafe in the shared execution path where parallel cells can overlap and interfere with one another.

This is a deliberate product-direction change rather than a temporary implementation detail. It keeps the intentional-log contract deterministic, preserves parallel execution in shared mode, and avoids the race conditions that appeared when the same `$cell` binding had to be reused across concurrent runs.

### File List

- docs/stories/3-1-define-intentional-log-capture-runtime-helper.md
- src/kernel/runtilme-cell-bridge.ts
- src/kernel/build-cell-expression.ts
- src/kernel/execution-kernel.ts
- src/kernel/execution-messages.ts
- tests/unit/kernel/build-cell-expression.test.ts
- tests/unit/kernel/execution-kernel.test.ts
- tests/unit/kernel/runtilme-cell-bridge.test.ts
- tests/integration/kernel/fast-rerun.integration.test.ts

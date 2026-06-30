---
epic: 4
story: 2
story_key: 4-2-display-structured-value-output-with-type-context
title: Display Structured Value Output with Type Context
status: ready-for-dev
baseline_commit: b2077ff8348508c1e57809d5c8d6f16665e594ac
created: 2026-06-29
updated: 2026-06-30
completion_note: Story 4.2 clarified after reverted iteration - type context must be shown in cell status bar, not mixed into cell output payload
dependencies:
  - story: 4.1
    title: Return Execution Values to Notebook Output
    reason: Story 4.2 builds on Story 4.1 value rendering and must preserve existing output behavior.
  - story: 2.3
    title: Normalize Success and Failure Output Contracts
    reason: Execution result typing and failure normalization contracts remain authoritative.
  - story: 2.4
    title: Support Fast Rerun and Iteration Patterns
    reason: Run and rerun ergonomics must remain unchanged while adding result-type context.
---

# Story 4.2: Display Structured Value Output with Type Context

## Status

ready-for-dev

## Story

As a developer,
I want each JavaScript cell to show a result type identifier in the cell status bar,
so that ambiguous outcomes like null, undefined, and empty string are easy to distinguish without mixing UI labels into output payload content.

## Clarification From Product Direction

The previous 4.2 implementation direction that injected success or error envelope text into notebook cell outputs is invalid for this story revision.

Required direction:

- Keep notebook output payloads focused on value and error content only.
- Do not prepend or append status text labels to output payload text.
- Use a cell status bar item (left aligned) for type context.
- Display format must be exactly: Result Type: {0}

Out of scope for this story revision:

- Adding success or error indicator labels (not needed because notebook execution UI already shows this).
- Reworking transport, execution lifecycle, or error normalization contracts.

## Acceptance Criteria

1. Given a JavaScript code cell executed with Browser Kernel and a successful result,
   when the cell status bar renders,
   then a left-aligned item is shown with localized text format `Result Type: {0}` using the normalized result type.
2. Given ambiguous successful values (`null`, `undefined`, empty string),
   when the status bar renders,
   then the type label clearly disambiguates them (for example `null`, `undefined`, `string`).
3. Given cell output rendering for both success and failure,
   when this story is implemented,
   then no new success or error label text is mixed into notebook output payload content.
4. Given non-JavaScript cells or JavaScript cells with no available Browser Kernel result type metadata yet,
   when status bar items are requested,
   then no result-type status item is shown.
5. Given reruns and result changes,
   when a cell is re-executed,
   then the status bar type item refreshes to reflect the latest result type.

## Scope Boundaries

- In scope:
  - Add a dedicated result-type notebook cell status bar provider.
  - Render result-type text on the left side using localized format `Result Type: {0}`.
  - Source result-type context from Browser Kernel execution results (without polluting output payload text).
  - Add or update unit tests for status-bar behavior and metadata propagation.
- Out of scope:
  - Output envelope label text (success or error labels in notebook output).
  - Custom renderer, webview, or UI beyond native notebook status bar.
  - Changes to connection lifecycle, debugger lifecycle, or transport behavior.

## Tasks / Subtasks

- [ ] Task 1: Define result-type status-bar contract and localization (AC: 1, 2, 4)
  - [ ] Add localized string key for `Result Type: {0}` in [package.nls.json](../../package.nls.json) and [l10n/bundle.l10n.json](../../l10n/bundle.l10n.json).
  - [ ] Define notebook output metadata contract for result type (extension-owned metadata namespace).
  - [ ] Keep text concise and accessible; no icon-only result-type rendering.

- [ ] Task 2: Propagate result type from execution to cell output metadata (AC: 1, 2, 5)
  - [ ] Update [src/kernel/execution-kernel.ts](../../src/kernel/execution-kernel.ts) success output construction to include result type metadata on the primary output object.
  - [ ] Ensure metadata is updated on rerun so stale type labels are not shown.
  - [ ] Preserve existing output value MIME/content behavior from Story 4.1.

- [ ] Task 3: Implement left-aligned result-type status bar provider (AC: 1, 2, 4, 5)
  - [ ] Create a provider modeled after [src/notebook/cell-isolation-status-bar.ts](../../src/notebook/cell-isolation-status-bar.ts), but independent from isolation mode behavior.
  - [ ] Register provider for `jupyter-notebook` JavaScript code cells only.
  - [ ] Read latest result type from the cell output metadata contract and render `Result Type: {0}` with `NotebookCellStatusBarAlignment.Left`.
  - [ ] Emit refresh events when relevant cell/output/config state changes.

- [ ] Task 4: Wire provider into extension activation and notebook exports (AC: 1, 4)
  - [ ] Register/dispose the new provider in [src/extension.ts](../../src/extension.ts).
  - [ ] Export provider API from [src/notebook/index.ts](../../src/notebook/index.ts).
  - [ ] Keep existing cell-isolation status item on the right; do not regress its command behavior.

- [ ] Task 5: Add targeted unit tests and regression guards (AC: 1-5)
  - [ ] Add tests for new status-bar provider in `tests/unit/notebook/` verifying:
    - [ ] Left alignment.
    - [ ] Text format `Result Type: {0}`.
    - [ ] Hidden state when no result type exists.
    - [ ] Refresh behavior after output changes.
  - [ ] Update kernel tests in [tests/unit/kernel/execution-kernel.test.ts](../../tests/unit/kernel/execution-kernel.test.ts) to assert result type metadata is written and refreshed.
  - [ ] Add regression assertions that output payload text does not include new success or error envelope label prefixes.

- [ ] Task 6: Validate build and tests (AC: 1-5)
  - [ ] Run `npm run compile`.
  - [ ] Run targeted tests for kernel and notebook status-bar units.
  - [ ] Run `npm run test` if feasible.

## Developer Context

### Current State (Files To Update)

- [src/kernel/execution-kernel.ts](../../src/kernel/execution-kernel.ts)
  - Current state:
    - Success path already receives normalized `result.type` and renders value output.
    - Structured values currently use `application/json`; primitives remain `text/plain`.
    - Failure outputs preserve existing normalized failure messaging.
  - Story 4.2 change target:
    - Attach result type as extension metadata on primary output object.
    - Keep output payload text exactly value/error focused.
  - Must preserve:
    - Existing MIME routing behavior.
    - Output ordering (primary result first, intentional logs second).
    - Existing cancellation and no-session behavior.

- [src/notebook/cell-isolation-status-bar.ts](../../src/notebook/cell-isolation-status-bar.ts)
  - Current state:
    - Right-aligned icon-only status item for isolation mode with toggle command.
  - Story 4.2 change target:
    - Reference pattern only (registration, filtering, refresh wiring).
    - Do not overload this provider with result-type responsibilities.
  - Must preserve:
    - Isolation item behavior and command wiring.

- [src/extension.ts](../../src/extension.ts)
  - Current state:
    - Registers kernel controller and cell isolation status bar provider.
  - Story 4.2 change target:
    - Register new result-type status bar provider.
  - Must preserve:
    - Existing activation flow and disposal hygiene.

- [src/notebook/index.ts](../../src/notebook/index.ts)
  - Current state:
    - Exports notebook providers including cell isolation provider.
  - Story 4.2 change target:
    - Export new result-type provider API and options.

- [tests/unit/notebook/cell-isolation-status-bar.test.ts](../../tests/unit/notebook/cell-isolation-status-bar.test.ts)
  - Current state:
    - Validates status bar provider behavior patterns and refresh strategy.
  - Story 4.2 change target:
    - Reuse test harness pattern for new result-type provider tests.

- [tests/unit/kernel/execution-kernel.test.ts](../../tests/unit/kernel/execution-kernel.test.ts)
  - Current state:
    - Verifies MIME and value rendering behavior.
  - Story 4.2 change target:
    - Add metadata assertions and no-envelope-text regression checks.

### Technical Requirements

- Reuse normalized result `type` from [src/kernel/execution-result.ts](../../src/kernel/execution-result.ts); do not introduce duplicate type derivation logic in notebook layer.
- Keep user-visible strings localized.
- Keep result-type context in status bar, not in output payload text.
- Use native VS Code notebook APIs only.
- Ensure provider filters to Browser Kernel-supported JavaScript notebook cells.

### Architecture Compliance

- Keep feature inside native VS Code surfaces (status bar and notebook outputs), aligned with UX-DR16.
- Preserve output contract stability and avoid transport-layer coupling.
- Keep extension-owned metadata namespaced under `jupyterBrowserKernel`.
- Do not alter debugger/session ownership semantics.

### Library and Framework Requirements

- VS Code Notebook APIs:
  - `registerNotebookCellStatusBarItemProvider`
  - `NotebookCellStatusBarItem`
  - `NotebookCellStatusBarAlignment.Left`
  - `NotebookCellOutput` metadata channel
- TypeScript strict mode compatibility required.
- No new runtime dependencies.

### File Structure Requirements

- New notebook provider implementation in `src/notebook/`.
- Keep kernel changes in `src/kernel/` only.
- Keep tests in `tests/unit/`.
- Do not move or rename unrelated files.

### Testing Requirements

- Unit tests must cover:
  - Success result type label rendering in left status bar.
  - Ambiguous type disambiguation (`null`, `undefined`, `string`).
  - No label shown when no result type exists.
  - Result-type refresh after rerun.
  - Output payload regression guard (no appended success/error text labels).

## Previous Story Intelligence (4.1)

- Story 4.1 established reliable value rendering with JSON MIME for structured values.
- Review corrections from 4.1 highlighted strict CDP shape fidelity and narrow-scope changes.
- For 4.2, extend existing behavior by adding metadata plus status-bar surface, not by changing value payload strings.

## Git Intelligence Summary

- Branch diff vs `main` currently affects only story-planning files, confirming implementation was rolled back.
- Last branch commit (`c19e6f8`) created initial Story 4.2 context file and sprint-status update.
- This clarification supersedes prior guidance that suggested output-envelope success/error labels.

## Latest Technical Information

- VS Code `NotebookCellStatusBarItem` supports explicit left alignment and text labels.
- Provider refresh callbacks are invoked when cell outputs/metadata/execution state change.
- This supports a type-context status item without introducing custom notebook renderers.

## Project Context Reference

- [docs/epics/epic-4-capture-intentional-values-basic.md](../epics/epic-4-capture-intentional-values-basic.md)
- [docs/prd.md](../prd.md)
- [docs/architecture.md](../architecture.md)
- [docs/ux-spec/10-component-strategy.md](../ux-spec/10-component-strategy.md)
- [docs/ux-spec/06-detailed-core-user-experience.md](../ux-spec/06-detailed-core-user-experience.md)
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md)

## Risks and Guardrails

- Risk: reintroducing output label text into notebook payload.
  - Guardrail: explicit regression tests for payload content and strict scope notes in this story.
- Risk: stale result-type labels after rerun.
  - Guardrail: overwrite metadata on every execution and verify in tests.
- Risk: coupling result-type logic to isolation provider.
  - Guardrail: separate provider module and independent tests.

## Questions Saved For End

1. Should result-type status be hidden on failure runs, or set to a failure classification value like `error`?
2. Should result-type status clear immediately when a cell enters running state, or continue to show the previous completed run type until replaced?

## Completion Status

- Story 4.2 context regenerated with corrected implementation direction after reverted iteration.
- Story status remains `ready-for-dev`.
- Developer guidance now enforces status-bar type context and forbids output payload UI-label mixing.

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- `python3 _bmad/scripts/resolve_customization.py --skill .agents/skills/bmad-create-story --key workflow`
- `git log --oneline -5`
- `git diff --name-only main...HEAD`

### Completion Notes List

- Full artifact re-analysis completed (epic, PRD, architecture, UX, prior story, code files, tests, and git context).
- Story corrected to match user direction and avoid prior invalid implementation pattern.

### File List

- docs/stories/4-2-display-structured-value-output-with-type-context.md

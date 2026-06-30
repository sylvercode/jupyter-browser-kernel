---
epic: 4
story: 2
story_key: 4-2-display-structured-value-output-with-type-context
title: Display Structured Value Output with Type Context
status: ready-for-dev
baseline_commit: b2077ff8348508c1e57809d5c8d6f16665e594ac
created: 2026-06-29
updated: 2026-06-29
completion_note: Ultimate context engine analysis completed - comprehensive developer guide created
dependencies:
  - story: 4.1
    title: Return Execution Values to Notebook Output
    reason: Story 4.2 extends Story 4.1 output behavior and must preserve its rendering and logging guarantees.
  - story: 2.3
    title: Normalize Success and Failure Output Contracts
    reason: Error and success envelopes must keep normalized behavior and classification.
  - story: 2.4
    title: Support Fast Rerun and Iteration Patterns
    reason: Cell execution ergonomics and rerun flow must not regress while changing output envelope rendering.
  - epic: 2
    reason: Core execution pipeline and output contract foundations.
---

# Story 4.2: Display Structured Value Output with Type Context

## Status

ready-for-dev

## Story

As a developer,
I want value output to include type context in a labeled output envelope,
so that ambiguous outcomes like null, undefined, and empty string are easy to distinguish.

## Acceptance Criteria

1. Given any successful execution value, when output renders, then the output includes both the value and its type metadata, and the envelope remains explicitly labeled as success.
2. Given an error outcome, when output renders, then the envelope is explicitly labeled as error, and no unlabeled free-form output is produced.
3. Given nested object values, when output is displayed, then nested content uses progressive disclosure defaults, and users can expand detail on demand without overwhelming the default view.

## Scope Boundaries

- In scope:
  - Output envelope formatting and labeling for success and error paths.
  - Type metadata visibility for all success values.
  - Progressive disclosure default for structured values.
  - Unit-test updates validating envelope structure and MIME behavior.
- Out of scope:
  - Changes to CDP transport, session lifecycle, reconnect, debugger lifecycle, or profile eligibility.
  - Changes to result normalization contracts in `src/kernel/execution-result.ts`.
  - New renderer extension or custom notebook renderer.

## Tasks / Subtasks

- [ ] Task 1: Design labeled output envelope shape and localization keys (AC: 1, 2)
  - [ ] Define success envelope text format that includes explicit success label and value type label.
  - [ ] Define error envelope text format for infrastructure failures and structured failures.
  - [ ] Add/adjust localization keys in `package.nls.json` and message helpers in `src/kernel/execution-messages.ts`.
- [ ] Task 2: Implement success envelope with type context in kernel output path (AC: 1, 3)
  - [ ] Update success output construction in `src/kernel/execution-kernel.ts` to include labeled success header and type metadata.
  - [ ] Preserve JSON MIME rendering for structured values so VS Code built-in progressive disclosure remains available.
  - [ ] Ensure ambiguous values (`null`, `undefined`, empty string) render distinctly with explicit type metadata.
- [ ] Task 3: Implement explicit labeled error envelope behavior (AC: 2)
  - [ ] Ensure infrastructure failures and runtime failures both produce explicitly labeled error outputs.
  - [ ] Avoid unlabeled fallback text in failure paths.
  - [ ] Preserve existing actionable diagnostics text and no-session guidance.
- [ ] Task 4: Preserve existing intentional log behavior and output order (AC: 1, 2)
  - [ ] Keep value or error output first, intentional logs second.
  - [ ] Keep intentional log output format unchanged unless a label update is required by AC wording.
- [ ] Task 5: Add and update tests for envelope, labels, and progressive disclosure behavior (AC: 1, 2, 3)
  - [ ] Extend unit tests in `tests/unit/kernel/execution-kernel.test.ts` for new success label and type metadata assertions.
  - [ ] Extend failure tests to assert explicit error labeling across infrastructure and runtime error paths.
  - [ ] Keep existing JSON MIME assertions for object and array payloads.
  - [ ] Add coverage for ambiguous value distinctions (`null` vs `undefined` vs empty string).
- [ ] Task 6: Validation and regression checks (AC: 1, 2, 3)
  - [ ] Run `npm run compile`.
  - [ ] Run targeted tests: `node --test tests/unit/kernel/execution-kernel.test.ts`.
  - [ ] Run full test suite if feasible: `npm run test`.

## Developer Context

### Current State (Files Likely To Be Updated)

- `src/kernel/execution-kernel.ts`
  - Current state:
    - Success path writes first output item from `createSuccessValueOutputItem`.
    - Structured values (`resultType` `object`/`array`) use JSON MIME via formatted JSON string.
    - Failure path uses `NotebookCellOutputItem.error(error)` for runtime failures and plain text for infrastructure failures.
    - Intentional logs append as a second output block labeled by existing message helper.
  - Story 4.2 change target:
    - Add explicit success and error envelope labeling.
    - Surface type metadata alongside value.
    - Keep progressive-disclosure behavior for structured values.
  - Must preserve:
    - Execution flow, cancellation behavior, and runtime bridge behavior.
    - Output ordering (primary result first, logs second).
    - Existing no-session and transport-failure reporting behavior.

- `tests/unit/kernel/execution-kernel.test.ts`
  - Current state:
    - Comprehensive execution behavior coverage already exists (success, failure, cancellation, bridge behavior, log ordering).
    - Story 4.1 already added structured output MIME assertions.
  - Story 4.2 change target:
    - Update/extend assertions for explicit envelope labels and type metadata.
    - Add ambiguous value distinction assertions.
  - Must preserve:
    - Existing behavior contracts unrelated to envelope wording.
    - Runtime bridge and cancellation regression coverage.

- `src/kernel/execution-messages.ts` (likely update)
  - Current state:
    - Holds user-facing kernel output labels/messages.
  - Story 4.2 change target:
    - Add/adjust message helpers for explicit success/error envelope labels and type metadata wording.
  - Must preserve:
    - Existing localization patterns and key usage.

- `package.nls.json` (likely update)
  - Current state:
    - Localization source for user-visible messages.
  - Story 4.2 change target:
    - Add keys for any new envelope labels and type descriptors.
  - Must preserve:
    - Existing key naming style and no hardcoded user-facing strings.

### Technical Requirements

- Preserve normalized result contract (`ExecutionSuccess` / `ExecutionFailure`) and do not mutate shape.
- Keep output rendering through VS Code notebook core APIs (`NotebookCellOutputItem.text`, `NotebookCellOutputItem.error`, JSON-compatible MIME usage).
- Ensure type metadata is shown for every success result, including primitives and non-serializable fallback strings.
- Ensure every failure surface is explicitly labeled as error and not unlabeled plain text.
- Keep intentional logs distinguishable and ordered after primary result output.

### Architecture Compliance

- Respect core boundaries:
  - This is kernel output rendering work, not transport/profile/debugger lifecycle work.
- Keep transport-boundary isolation:
  - Do not leak raw protocol fields into notebook output contract.
- Preserve DevTools coexistence constraints:
  - No changes to session attach/multiplexing logic.
- Preserve post-MVP debug architecture:
  - No direct Debugger domain usage in kernel path.

### Library and Framework Requirements

- Use VS Code Notebook API only; no new rendering dependency.
- Keep TypeScript strict-mode safe narrowing and type guards.
- Use localization for user-visible labels (`vscode.l10n.t(...)` via existing localize helper pipeline).
- Confirm MIME behavior based on current VS Code docs:
  - Built-in rich output supports JSON and text output in core notebook rendering.
  - `NotebookCellOutputItem.json(...)` and JSON/text MIME representations are valid for progressive disclosure use cases.

### File Structure Requirements

- Modify only story-relevant kernel and message files.
- Do not introduce new cross-layer imports violating architecture boundaries.
- Keep tests in `tests/unit/...` (no source-co-located tests).

### Testing Requirements

- Required unit coverage for ACs:
  - Success outputs include explicit success label and type metadata.
  - Error outputs include explicit error label for both runtime and infrastructure failure paths.
  - Structured object/array values still render as JSON MIME with expandable display defaults.
  - Ambiguous outcomes are distinguishable:
    - `null` labeled with type `null`.
    - `undefined` labeled with type `undefined`.
    - Empty string labeled with type `string` and displayed value clearly.
- Required regression checks:
  - Intentional log ordering and content unchanged unless explicitly required.
  - Cancellation path behavior unchanged.
  - No-session guidance still reported and surfaced.

## Previous Story Intelligence (4.1)

- Story 4.1 already established MIME routing and fallback behavior in `writeSuccessOutput`.
- Review corrections from 4.1 emphasized:
  - Avoid dead branches in JSON parse guards.
  - Keep CDP-shape-accurate tests (arrays represented as type `object` with subtype `array` in fixtures).
  - Preserve separation between display fallback behavior and execution success classification.
- Reuse strategy for 4.2:
  - Extend existing output builder logic instead of replacing execution pipeline.
  - Add targeted tests around envelope labeling instead of rewriting broad test scaffolding.

## Git Intelligence Summary

- Recent implementation work for Epic 4 concentrated in:
  - `src/kernel/execution-kernel.ts`
  - `tests/unit/kernel/execution-kernel.test.ts`
  - story docs and sprint status
- Commit pattern shows quick implementation followed by focused review-fix pass.
- Recommended implementation approach:
  - Keep changes narrow and local.
  - Add tests in same change set.
  - Expect review scrutiny on subtle output behavior and edge cases.

## Latest Technical Information

- VS Code Notebook API guidance (fetched 2026-06-29) confirms:
  - Rich outputs can provide multiple MIME variants.
  - Core notebook renderer supports common text/JSON rendering behavior.
  - Output ordering matters and multiple outputs are shown in sequence.
- Practical implication for Story 4.2:
  - Keep labeled envelope content explicit.
  - Preserve structured JSON output path for nested inspection.
  - Avoid custom renderer complexity for this AC set.

## Project Context Reference

- Canonical product and architecture constraints from:
  - `docs/prd.md`
  - `docs/architecture.md`
  - `docs/epics/epic-4-capture-intentional-values-basic.md`
  - `.github/copilot-instructions.md`
- No separate `project-context.md` file was discovered during this workflow run.

## Risks and Guardrails

- Risk: breaking Story 4.1 JSON MIME behavior while adding labels.
  - Guardrail: keep structured MIME assertions and add explicit regression tests.
- Risk: label implementation introduces hardcoded user-facing strings.
  - Guardrail: route all user-visible text through localization keys.
- Risk: error output labeling accidentally degrades actionable error details.
  - Guardrail: keep existing error message semantics and wrap with label only.

## References

- docs/epics/epic-4-capture-intentional-values-basic.md
- docs/stories/4-1-return-execution-values-to-notebook-output.md
- docs/prd.md
- docs/architecture.md
- src/kernel/execution-kernel.ts
- tests/unit/kernel/execution-kernel.test.ts
- https://code.visualstudio.com/api/extension-guides/notebook

## Completion Status

- Story file created with exhaustive artifact analysis context.
- Story status set to `ready-for-dev`.
- Sprint tracking updated to `ready-for-dev` for story key `4-2-display-structured-value-output-with-type-context`.

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Activation resolver:
  - `python3 _bmad/scripts/resolve_customization.py --skill .agents/skills/bmad-create-story --key workflow`

### Completion Notes List

- Exhaustive artifact load completed (epic, PRD, architecture, UX, prior story, git history, update files).
- Story drafted with implementation guardrails, test expectations, and regression protections.

### File List

- docs/stories/4-2-display-structured-value-output-with-type-context.md
- docs/stories/sprint-status.yaml

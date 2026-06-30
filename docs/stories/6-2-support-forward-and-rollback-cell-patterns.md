---
epic: 6
story: 2
story_key: 6-2-support-forward-and-rollback-cell-patterns
title: Support Forward and Rollback Cell Patterns
status: review
created: 2026-06-30
updated: 2026-06-30
completion_note: Implemented deterministic forward/rollback coverage and cancellation recovery checks; validation suites passed and story moved to review.
baseline_commit: 07b73d2

dependencies:
  - story: 6.1
    title: Validate Core Pipeline with Deterministic Fixtures
    reason: Story 6.2 must build on the deterministic fixture harness and preserve the normalized execution contract guardrails established in Story 6.1.
  - story: 2.3
    title: Normalize Success and Failure Output Contracts
    reason: Forward and rollback outcomes must continue to map to the shared execution result contract.
  - story: 2.7
    title: Reverse Default Cell Mode and Rename Share to Global
    reason: Forward and rollback flows must behave correctly under current default isolation semantics and explicit global mode.
---

# Story 6.2: Support Forward and Rollback Cell Patterns

## Status

review

## Story

As a user,
I want forward-operation and rollback-operation cells to work in the same session,
so that I can experiment safely and restore state predictably.

## Acceptance Criteria

1. Given a forward-operation cell and paired rollback cell,
   when the forward cell executes,
   then the expected state change is observable,
   and rollback remains runnable in the same notebook session.

2. Given a completed forward run,
   when the rollback cell executes,
   then state is restored to the expected baseline,
   and restoration outcome is visible in notebook output.

3. Given rollback execution fails,
   when failure output renders,
   then the failure is explicit and actionable,
   and next-step guidance is provided for safe recovery.

## Scope Alignment and Clarifications

- This story is still in scope based on current PRD and requirements artifacts (FR19 and FR20 remain active).
- This story is about reversible execution behavior in one active session, not history tracking infrastructure.
- Do not add session-scoped execution-history features; execution-history requirement FR17 was removed by approved sprint change.
- Do not reintroduce Epic 5-style watches or custom watch UI behavior; watch workflows are debugger-native via Epic 10.

## Scope Boundaries

- In scope:
  - Validate and harden forward then rollback execution in one connected session.
  - Ensure rollback can run immediately after forward without reconnect requirements.
  - Ensure rollback success and rollback failure outcomes surface through existing output and diagnostics channels.
  - Extend deterministic tests for reversible experiment behavior.
- Out of scope:
  - New execution-history storage, timeline UI, or revision-diff surfaces.
  - New debugger features, watch panes, or DAP behavior.
  - Profile-specific runtime behavior beyond current core-kernel contracts.

## Tasks / Subtasks

- [x] Task 1: Define reversible-flow test fixtures and expectations (AC: 1, 2)
  - [x] Add deterministic fixture scenarios for forward mutation and rollback restoration to the existing integration fixture harness.
  - [x] Assert that rollback remains executable in the same active session after forward run completes.
  - [x] Assert state baseline before forward, changed state after forward, and restored baseline after rollback.

- [x] Task 2: Preserve execution pipeline behavior under forward or rollback patterns (AC: 1, 2)
  - [x] Ensure no reconnect or hidden state reset is required between paired forward/rollback cells.
  - [x] Preserve existing output ordering and result-contract normalization for both forward and rollback runs.
  - [x] Preserve compatibility with current isolation defaults and explicit Global mode behavior.

- [x] Task 3: Surface rollback failures as actionable diagnostics (AC: 3)
  - [x] Ensure rollback failure path remains explicit through notebook output and existing diagnostics pathways.
  - [x] Include safe recovery guidance in rollback failure rendering using existing localized message patterns.
  - [x] Keep diagnostics concise and non-leaky (no sensitive path or environment leakage).

- [x] Task 4: Add regression coverage for cancellation and rerun edge behavior (AC: 1, 2, 3)
  - [x] Verify cancellation during forward run does not block subsequent rollback run in same session.
  - [x] Verify a failed rollback can be edited and rerun without reconnect overhead.
  - [x] Verify intentional logs (if present) still follow current separation rules from ambient console activity.

- [x] Task 5: Validate and record (AC: 1, 2, 3)
  - [x] Run `npm run compile`.
  - [x] Run `npm run test`.
  - [x] Run `npm run test:integration:cdp` in Chromium-enabled environment.

## Developer Context

### Current State (Files Expected To Be Updated)

- `src/kernel/execution-kernel.ts`
  - Current state:
    - Orchestrates cell execution lifecycle, cancellation, output clearing/replacement, and success/failure rendering.
    - Uses normalized execution results and emits infrastructure failures through existing report hooks.
  - Story 6.2 change target:
    - Keep forward then rollback run behavior stable in same session with no hidden reconnect dependencies.
    - Keep failure rendering actionable when rollback fails.
  - Must preserve:
    - Output ordering (result output first, intentional logs second).
    - Cancellation handling and no-session semantics.

- `src/kernel/execution-result.ts`
  - Current state:
    - Owns normalization and failure-kind classification.
  - Story 6.2 change target:
    - Reuse existing normalization behavior; avoid introducing alternate failure taxonomies.
  - Must preserve:
    - Shared discriminated-union contract shape and current failure kinds.

- `tests/integration/transport/browser-connect.integration.test.ts`
  - Current state:
    - Contains deterministic CDP integration checks for core normalization and transport behavior.
  - Story 6.2 change target:
    - Add reversible forward/rollback scenario assertions using deterministic fixtures.
  - Must preserve:
    - Existing coexistence and timeout coverage.

- `tests/integration/notebook/stop-button.integration.test.ts`
  - Current state:
    - Covers cancellation semantics in notebook execution pipeline.
  - Story 6.2 change target:
    - Extend coverage where needed so cancellation during forward flow does not poison rollback follow-up behavior.

- `tests/integration/helpers/integration-app-server.ts`
  - Current state:
    - Provides deterministic static page fixture lifecycle used by CDP integration suites.
  - Story 6.2 change target:
    - Add minimal fixture helpers or routes for reversible state mutation and restoration assertions.

### Technical Requirements

- Use existing kernel execution pipeline and shared result contract; do not add parallel execution paths for rollback.
- Keep all user-facing text localized (`vscode.l10n.t(...)` and localization bundles).
- Preserve profile-agnostic core behavior; no Foundry-specific runtime assumptions in core reversible-flow tests.
- Keep fire-and-forget notification behavior for non-decision notifications if any new notifications are introduced.

### Architecture Compliance

- Maintain core/profile separation from architecture and PRD; reversible-flow behavior belongs in core workflow semantics, not profile-specific logic.
- Maintain transport-boundary isolation: execution semantics must remain contract-driven, not CDP-error-string-driven.
- Keep DevTools coexistence behavior unchanged.

### Library and Framework Requirements

Current stack and latest references (checked 2026-06-30):

- `chrome-remote-interface`: project `^0.34.0`, latest `0.34.0`.
- `@vscode/test-cli`: project `^0.0.12`, latest `0.0.15`.
- `typescript`: project `^5.3.3`, latest `6.0.3`.

Guidance:

- Do not perform dependency upgrades in Story 6.2.
- Implement using current pinned repository stack.

### File Structure Requirements

- Core runtime behavior changes remain under `src/kernel/`.
- Integration test changes remain under `tests/integration/`.
- Shared deterministic fixture helpers remain in `tests/integration/helpers/`.
- Keep story-specific updates minimal and avoid unrelated refactors.

### Testing Requirements

- Add deterministic integration coverage for:
  - forward mutation success,
  - rollback restoration success,
  - rollback failure actionable output,
  - forward-cancel then rollback recovery.
- Preserve existing Story 6.1 deterministic fixture assertions.
- Preserve existing Story 3.3 intentional-vs-ambient output separation behavior when logs appear during forward/rollback flows.

## Previous Story Intelligence (6.1)

- Story 6.1 established deterministic fixture practices and strengthened assertion diagnostics for expected vs actual contract fields.
- Story 6.1 confirmed static fixture harness and CDP integration paths are stable for Epic 6 work.
- Story 6.2 should extend that deterministic approach instead of creating ad-hoc scenario tests.

## Git Intelligence Summary

Recent commits are all Story 6.1 focused and show the expected implementation pattern:

- context story file created,
- implementation plus tests landed,
- review correction patch applied,
- sprint status advanced.

Use the same pattern for Story 6.2 with AC-focused tests and narrow runtime changes.

## Project Context Reference

- `docs/epics/epic-6-safe-experimentation-and-core-reliability.md`
- `docs/prd.md`
- `docs/architecture.md`
- `docs/epics/requirements-inventory.md`
- `docs/archives/sprint-change-proposal-2026-06-29.md`
- `docs/stories/6-1-validate-core-pipeline-with-deterministic-fixtures.md`
- `.github/copilot-instructions.md`

## Risks and Guardrails

- Risk: implementing reversible flows by introducing hidden state/history subsystem.
  - Guardrail: explicitly keep history subsystem out of scope and rely on current execution contract/output surfaces.
- Risk: rollback failure handling becomes vague or silent.
  - Guardrail: keep failure rendering explicit, actionable, and covered by deterministic assertions.
- Risk: cancellation edge cases leave session unrecoverable for rollback.
  - Guardrail: add cancel-then-rollback integration checks.

## Questions Saved For End

1. Should safe-recovery guidance for rollback failure be purely textual in notebook output, or should it also include actionable command prompts where available?
2. Do we want a dedicated example fixture notebook for forward/rollback flows in this story, or keep it strictly test-only and defer user-facing examples to later documentation work?

## Completion Status

- Deterministic integration coverage now validates forward mutation, rollback restoration, and rollback failure visibility in one active session.
- Notebook cancellation coverage now validates that canceling a forward run does not block rollback follow-up in the same session.
- Kernel unit coverage includes forward/rollback paired-run behavior and cancel-then-rollback recovery behavior.
- Validation completed with `npm run compile` and `npm run test:integration:cdp`; story moved to `review`.

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- /home/node/.vscode-server/data/User/workspaceStorage/2e9ad2f61a53a3e3bc350795b9312ec0/GitHub.copilot-chat/debug-logs/f140aa43-0bf8-495b-aed9-e60cb20d4326

### Completion Notes List

- Added deterministic CDP integration assertions for forward mutation then rollback restoration with baseline re-checks.
- Added deterministic rollback-failure integration assertion that preserves explicit and actionable normalized failure output.
- Added notebook integration coverage proving cancellation of a long-running forward cell does not prevent a subsequent rollback run.
- Added kernel unit coverage for paired forward/rollback runs and cancel-then-rollback recovery in one active session.
- Removed rollback keyword heuristics from runtime execution path to keep behavior contract-driven and notebook-workflow-native.
- Executed validation suites and confirmed green results prior to moving story to `review`.

### Implementation Plan

- Extend deterministic integration coverage for forward/rollback restore behavior in active-session CDP tests.
- Extend cancellation integration coverage to prove rollback recovery without reconnect.
- Add focused kernel unit regressions for same-session forward/rollback and cancel-then-rollback behavior.
- Keep runtime behavior contract-driven and avoid rollback cell-type inference heuristics.
- Validate with compile and integration suite before moving story to review.

### File List

- docs/stories/6-2-support-forward-and-rollback-cell-patterns.md
- docs/stories/sprint-status.yaml
- tests/integration/transport/browser-connect.integration.test.ts
- tests/integration/notebook/stop-button.integration.test.ts
- tests/unit/kernel/execution-kernel.test.ts

## Change Log

- 2026-06-30: Added deterministic integration coverage for forward/rollback baseline restoration and explicit rollback failure outcomes.
- 2026-06-30: Added cancellation-followed-by-rollback notebook integration coverage to verify same-session recovery without reconnect.
- 2026-06-30: Added kernel unit regressions for forward/rollback paired runs and cancel-then-rollback behavior.
- 2026-06-30: Removed rollback keyword heuristics from kernel runtime and moved story status to `review` after validation.

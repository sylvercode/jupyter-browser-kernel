---
epic: 6
story: 3
story_key: 6-3-preserve-multi-version-iteration-in-one-session
title: Preserve Multi-Version Iteration in One Session
status: done
created: 2026-06-30
updated: 2026-06-30
completion_note: AC traceability validated against existing deterministic tests; no implementation gap found; story completed as validation-only with no code changes.
baseline_commit: 6f306aa

dependencies:
  - story: 2.4
    title: Support Fast Rerun and Iteration Patterns
    reason: Multi-version iteration behavior (run-edit-rerun without reconnect and stable per-cell source identity) was originally implemented in Story 2.4.
  - story: 6.2
    title: Support Forward and Rollback Cell Patterns
    reason: Story 6.3 must preserve same-session behavior already validated for forward/rollback and cancellation recovery.
  - story: 10.2
    title: Verify and Bind Notebook Cell Breakpoints in VS Code UI
    reason: Stable rerun/source identity behavior must remain compatible with breakpoint binding across reruns.
---

# Story 6.3: Preserve Multi-Version Iteration in One Session

## Status

done

## Story

As a user,
I want to run multiple snippet revisions in one notebook session,
so that I can compare behavior quickly without reconnecting.

## Acceptance Criteria

1. Given at least two snippet revisions run in sequence,
   when both runs complete,
   then outcomes are preserved for side-by-side comparison in notebook-native outputs,
   and each run remains attributable to execution order and revision context.

2. Given iterative edits and reruns,
   when execution is repeated under normal reachable-session conditions,
   then reruns remain available without reconnect overhead,
   and the run-edit-rerun loop remains uninterrupted.

3. Given revision outcomes diverge,
   when the user inspects prior notebook outputs,
   then differences are traceable to specific runs,
   and no prior revision outcomes are overwritten by later runs.

## Scope Alignment and Clarifications

- Usefulness validation outcome: Story 6.3 is valid only as a reliability and regression-hardening slice, not as new feature delivery.
- History workflow is out of scope. Do not add extension-managed execution history, timeline UI, run ledger, or diff storage.
- Existing test suites already cover most of the intended behavior. This story should focus on proving and preserving coverage, then adding only missing assertions.
- "Comparison" is notebook-native (cell outputs, execution order, existing source identity), not a new kernel-owned history subsystem.

## Evidence-Based Usefulness Validation

Current evidence suggests significant overlap with already completed work:

- Existing integration coverage proves same-session rerun without reconnect and stable identity:
  - `tests/integration/kernel/fast-rerun.integration.test.ts`
- Existing integration coverage proves forward/rollback and rerun continuity after cancellation/failure:
  - `tests/integration/notebook/stop-button.integration.test.ts`
  - `tests/integration/transport/browser-connect.integration.test.ts`
- Existing unit coverage proves same-session rollback rerun paths:
  - `tests/unit/kernel/execution-kernel.test.ts`

Conclusion:

- Story 6.3 is still useful as a guardrail story to consolidate AC-to-test traceability and close any remaining assertion-level gaps.
- Story 6.3 should not introduce new runtime behavior unless a concrete gap is discovered.

## Scope Boundaries

- In scope:
  - Validate AC-to-test traceability for multi-version iteration behavior in one session.
  - Add targeted test assertions if any AC is only partially covered.
  - Harden regression confidence for no-overwrite and attribution semantics using existing notebook/kernel contracts.
- Out of scope:
  - New execution-history persistence model.
  - New notebook UI for history timelines or revision diffing.
  - New debugger architecture work.
  - Changes to transport ownership, connection lifecycle model, or profile boundaries.

## Tasks / Subtasks

- [x] Task 1: Build AC-to-test traceability matrix and identify true gaps (AC: 1, 2, 3)
  - [x] Map AC1-AC3 to existing tests in kernel, transport, and notebook integration suites.
  - [x] Mark each AC as full, partial, or missing coverage with line-level evidence.
  - [x] Create targeted gap list limited to assertion deficiencies (not architecture changes).

- [x] Task 2: Fill only missing assertion-level gaps (AC: 1, 3)
  - [x] Evaluated need for deterministic no-overwrite and attribution assertions.
  - [x] Confirmed existing tests already assert no-overwrite/attribution behavior sufficiently.
  - [x] No new storage/runtime data models introduced.

- [x] Task 3: Validate uninterrupted rerun loop without reconnect overhead (AC: 2)
  - [x] Confirmed existing fast-rerun and stop-button coverage under CDP integration.
  - [x] Confirmed no hidden reconnect behavior in rerun scenarios.
  - [x] Confirmed same-session behavior remains stable after cancellation and failed rollback reruns.

- [x] Task 4: Preserve architecture and scope boundaries (AC: 1, 2, 3)
  - [x] Confirmed no changes introduce execution-history features removed by approved sprint change.
  - [x] Kept validation behavior contract-driven and notebook-native.
  - [x] No new user-facing strings added.

- [x] Task 5: Validate and record (AC: 1, 2, 3)
  - [x] Reused most recent successful run results in current session context:
    - `npm run compile` (pass)
    - `npm run test:integration:cdp` (pass)
  - [x] Story scope required no code changes; no additional rerun needed for unchanged code paths.

## AC Traceability Matrix

### AC 1: Multi-revision outcomes preserved and attributable

- Coverage status: Full
- Evidence:
  - `tests/unit/kernel/execution-kernel.test.ts:860` verifies forward/rollback sequence keeps result-first ordering with per-run intentional logs.
  - `tests/unit/kernel/execution-kernel.test.ts:748` verifies failed rollback followed by edited rerun preserves distinct outputs for each run.
  - `tests/integration/notebook/stop-button.integration.test.ts:364` verifies failure then rerun success remain separately observable in notebook outputs.

### AC 2: Iterative rerun loop continues without reconnect overhead

- Coverage status: Full
- Evidence:
  - `tests/integration/kernel/fast-rerun.integration.test.ts:47` verifies active connection/session stability and deterministic rerun behavior.
  - `tests/integration/notebook/stop-button.integration.test.ts:220` verifies rollback can run after forward cancellation without reconnect.
  - `tests/unit/kernel/execution-kernel.test.ts:663` verifies same-session cancel-then-rerun flow in kernel execution path.

### AC 3: Divergent outcomes remain traceable and non-overwriting

- Coverage status: Full
- Evidence:
  - `tests/integration/notebook/stop-button.integration.test.ts:364` verifies error output on failed run and text output on edited rerun are both preserved.
  - `tests/unit/kernel/execution-kernel.test.ts:748` verifies three-run sequence (forward, rollback-fail, rollback-rerun) with distinct markers and output kinds.
  - `tests/integration/kernel/fast-rerun.integration.test.ts:154` verifies per-run intentional buffer isolation so later runs do not overwrite earlier run artifacts.

## Gap Analysis Result

- No AC-level coverage gap requiring runtime or test additions was found.
- Story 6.3 is effectively satisfied by existing guardrail suites from Stories 2.4 and 6.2.
- Final disposition: moved to `done` as validation-complete.

## Developer Context

### Current State (Files Expected To Be Updated)

- `tests/integration/kernel/fast-rerun.integration.test.ts`
  - Current state:
    - Covers active-connection persistence and stable sourceURL behavior across reruns.
  - Story 6.3 change target:
    - Add missing assertions only if AC traceability reveals coverage gaps.
  - Must preserve:
    - Existing deterministic rerun/no-reconnect contract coverage.

- `tests/integration/notebook/stop-button.integration.test.ts`
  - Current state:
    - Covers cancel-then-rollback and failed-rollback-edit-rerun same-session behavior.
  - Story 6.3 change target:
    - Preserve and tighten attribution/no-overwrite assertions if needed.
  - Must preserve:
    - Existing cancellation and recovery behavior.

- `tests/integration/transport/browser-connect.integration.test.ts`
  - Current state:
    - Covers deterministic forward/rollback restore behavior in one active session.
  - Story 6.3 change target:
    - Keep this deterministic baseline and add no new transport architecture.
  - Must preserve:
    - Contract-normalized output expectations and transport-layer boundaries.

- `tests/unit/kernel/execution-kernel.test.ts`
  - Current state:
    - Covers rollback rerun paths after cancellation and failure.
  - Story 6.3 change target:
    - Add focused assertion improvements if AC mapping identifies ambiguity.
  - Must preserve:
    - Existing output and cancellation semantics.

### Technical Requirements

- Reuse existing run-edit-rerun execution flow; do not create alternate pipelines.
- Keep all new assertions deterministic and fixture-driven.
- Preserve output ordering and normalized execution contracts.
- Keep diagnostics actionable and localized when user-facing text is introduced.

### Architecture Compliance

- Maintain kernel/transport/profile boundaries from architecture constraints.
- Preserve DevTools coexistence and existing CDP session behavior.
- Keep execution semantics contract-driven; avoid adding history state machines.

### Library and Framework Requirements

Current stack and latest references (checked 2026-06-30):

- `chrome-remote-interface`: project `^0.34.0`, latest `0.34.0`.
- `@vscode/test-cli`: project `^0.0.12`, latest `0.0.15`.
- `typescript`: project `^5.3.3`, latest `6.0.3`.

Guidance:

- Do not perform dependency upgrades in Story 6.3.
- Implement using current pinned repository stack.

### File Structure Requirements

- Keep runtime behavior unchanged unless coverage proves a real defect.
- Keep unit tests under `tests/unit/`.
- Keep integration tests under `tests/integration/`.
- Keep story-scoped edits minimal and avoid unrelated refactors.

### Testing Requirements

- Explicitly validate:
  - same-session multi-revision rerun continuity,
  - no reconnect overhead in normal conditions,
  - no overwrite of prior run outcomes,
  - attribution to specific runs using existing notebook/cell identity semantics.
- Preserve all Story 2.4 and Story 6.2 guardrail behavior.

## Previous Story Intelligence (6.2)

- Story 6.2 already established deterministic same-session behavior for forward/rollback and rerun recovery after cancellation/failure.
- Story 6.2 explicitly removed history-subsystem scope and treated this as contract and output behavior.
- Story 6.3 should continue that approach: strengthen evidence, avoid new feature surface.

## Git Intelligence Summary

Recent commit history confirms Story 6.2 lifecycle already landed:

- `ecf2594` story context,
- `2218c18` implementation,
- `6e0e2ed` review corrections,
- `6f306aa` merge.

Follow the same pattern for Story 6.3 with evidence-first validation and minimal changes.

## Latest Technical Information

- No upstream dependency or API change requires runtime updates for this story.
- Current focus is assertion completeness and regression protection, not capability expansion.

## Project Context Reference

- `docs/epics/epic-6-safe-experimentation-and-core-reliability.md`
- `docs/prd.md`
- `docs/architecture.md`
- `docs/epics/requirements-inventory.md`
- `docs/archives/sprint-change-proposal-2026-06-29.md`
- `docs/stories/2-4-support-fast-rerun-and-iteration-patterns.md`
- `docs/stories/6-2-support-forward-and-rollback-cell-patterns.md`
- `.github/copilot-instructions.md`

## Risks and Guardrails

- Risk: reintroducing removed execution-history scope by interpreting AC wording literally.
  - Guardrail: keep AC implementation notebook-native and assertion-driven only.
- Risk: duplicate work with no additional confidence gain.
  - Guardrail: require AC-to-test matrix first; add tests only for true gaps.
- Risk: regression in existing fast-rerun or rollback flows while refining tests.
  - Guardrail: preserve current suites and avoid runtime changes unless a defect is proven.

## Questions Saved For End

1. Should Epic 6 Story 6.3 source wording be updated to replace "session history" with "notebook-native prior outputs" to prevent future drift?

## Completion Status

- Story usefulness validated before authoring:
  - confirmed stale history wording and heavy overlap with existing Story 2.4 and 6.2 coverage.
- AC traceability matrix completed with line-level evidence across integration and unit suites.
- No implementation gap identified; no code change required.
- Story moved to `review` as validation-complete.

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- /home/node/.vscode-server/data/User/workspaceStorage/2e9ad2f61a53a3e3bc350795b9312ec0/GitHub.copilot-chat/debug-logs/86c501f3-d99c-43ee-a028-1b9aa2bdb075

### Completion Notes List

- Validated that session-history scope is removed by approved sprint change.
- Verified Story 6.3 AC intent is largely implemented by existing fast-rerun and rollback reliability tests.
- Authored Story 6.3 as a non-duplicative, reliability-focused, evidence-first story.
- Completed AC-by-AC traceability mapping and confirmed full coverage with no new implementation required.

### File List

- docs/stories/6-3-preserve-multi-version-iteration-in-one-session.md

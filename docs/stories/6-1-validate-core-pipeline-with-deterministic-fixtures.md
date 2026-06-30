---
epic: 6
story: 1
story_key: 6-1-validate-core-pipeline-with-deterministic-fixtures
title: Validate Core Pipeline with Deterministic Fixtures
status: review
created: 2026-06-30
updated: 2026-06-30
completion_note: Ultimate context engine analysis completed - comprehensive developer guide created.
baseline_commit: 7ad442f08b8d405b26586b9b5ecaca50237f761d
dependencies:
  - story: 2.3
    title: Normalize Success and Failure Output Contracts
    reason: Core classification and failure-shape assertions for success, syntax, runtime, and serialization boundaries are defined here.
  - story: 2.5
    title: Enable Source-Level Breakpoint Debugging
    reason: SourceURL and Debugger-domain behaviors must be preserved and asserted in deterministic fixture tests.
  - story: 10.1
    title: Register and Bootstrap Notebook Cell DAP Session
    reason: Debugger.enable ownership moved to debug-session lifecycle; fixture tests must align to this ownership model.
---

# Story 6.1: Validate Core Pipeline with Deterministic Fixtures

## Status

review

## Story

As a platform developer,
I want deterministic fixture tests for execution and normalization behavior,
so that core runtime behavior remains stable and profile-agnostic.

## Acceptance Criteria

1. Given deterministic browser-test fixtures,
   when the core test suite runs,
   then success, syntax failure, runtime failure, and serialization-boundary outcomes are asserted through the shared result contract,
   and expected classifications are consistent across equivalent fixtures.

2. Given a regression in normalized contract shape,
   when tests execute,
   then failing assertions identify the mismatched contract fields,
   and the failure includes expected vs actual classification context.

3. Given profile-independent core validation,
   when CI executes core fixture suites,
   then no profile-specific runtime imports are required,
   and tests remain runnable in isolation from profile implementations.

4. Given the deterministic fixture suite,
   when a breakpoint-binding fixture runs against a static page,
   then the kernel-emitted per-cell `//# sourceURL` is observed on the evaluated script,
   and the test asserts the Debugger domain is enabled on the session.

## Scope Boundaries

- In scope:
  - Deterministic fixture coverage for core execution/result normalization paths.
  - Contract-shape assertions that fail loudly when fields drift.
  - Profile-agnostic integration test wiring that runs without Foundry-specific runtime assumptions.
  - Static-page breakpoint fixture validating sourceURL visibility and Debugger domain enablement.
- Out of scope:
  - New profile behavior or profile eligibility rules.
  - Changes to user-facing notebook UX.
  - Re-architecting transport ownership or debug adapter lifecycle.

## Tasks / Subtasks

- [x] Task 1: Add deterministic fixture matrix for core result normalization (AC: 1, 2)
  - [x] Extend unit coverage in `tests/unit/kernel/execution-result.test.ts` with explicit fixture-driven table tests for success, syntax failure, runtime failure, promise rejection, timeout, and serialization boundaries.
  - [x] Include edge serialization fixtures for circular-like cases, null/undefined, and large payload stringification expectations already supported by core normalization behavior.
  - [x] Ensure each case asserts both classification (`kind`) and exact contract keys.

- [x] Task 2: Add contract-shape mismatch diagnostics (AC: 2)
  - [x] Add helper assertions in kernel unit tests that compare expected vs actual keys and include case labels in assertion messages.
  - [x] Verify failure output in tests is actionable (which fixture failed, expected kind, actual kind, expected keys, actual keys).

- [x] Task 3: Create profile-agnostic integration fixture harness (AC: 1, 3)
  - [x] Add or refactor integration helpers so core fixture tests can target a static page without importing Foundry-specific runtime behavior.
  - [x] Keep `RUN_CDP_INTEGRATION=1` gating and deterministic ports/host defaults.
  - [x] Ensure fixtures are reusable across transport and debugger integration suites.

- [x] Task 4: Add static-page breakpoint-binding deterministic test (AC: 4)
  - [x] Add integration coverage proving per-cell `//# sourceURL` emitted by kernel evaluation is visible in the parsed script stream for the attached session.
  - [x] Assert Debugger domain enablement on the active session before breakpoint operations.
  - [x] Validate deterministic behavior on rerun (same cell URL stable across reruns).

- [x] Task 5: Keep core suite profile-independent in CI (AC: 3)
  - [x] Ensure new core fixture tests do not import profile runtime modules.
  - [x] Confirm `npm run test` and `npm run test:integration:cdp` continue to run from repository root with current scripts.
  - [x] Document any environment assumptions in test headers/comments only when required.

- [x] Task 6: Validate and record results (AC: 1-4)
  - [x] Run `npm run compile`.
  - [x] Run `npm run test`.
  - [x] Run `npm run test:integration:cdp` in an environment with Chromium available.

## Developer Context

### Current State (Files Expected To Be Updated)

- `src/kernel/execution-result.ts`
  - Current state:
    - Owns canonical result normalization and failure classification.
    - Produces discriminated union contract used by kernel output pipeline.
  - Story 6.1 change target:
    - Usually no functional changes expected unless fixture testing reveals a true contract bug.
    - If modified, changes must be minimal and directly tied to failing deterministic fixtures.
  - Must preserve:
    - Existing `ExecutionResult` discriminated-union shape and failure kinds.

- `src/kernel/execution-kernel.ts`
  - Current state:
    - Orchestrates evaluation, cancellation, output replacement, and metadata propagation.
    - Uses normalized results and separates infrastructure failures from user-code failures.
  - Story 6.1 change target:
    - Usually assertions/tests only; runtime code should remain stable unless fixture evidence proves regression.
  - Must preserve:
    - Output ordering (primary result before intentional logs).
    - Cancellation semantics and no-session handling.

- `src/transport/browser-connect.ts`
  - Current state:
    - Provides active browser connection and debugger session wrappers.
    - `createBrowserDebuggerSession` exposes `enable/disable` and evaluate helpers.
  - Story 6.1 change target:
    - Add test assertions around existing behavior (Debugger domain lifecycle expectations) rather than broad transport rewrites.
  - Must preserve:
    - Flat-session routing and coexistence guarantees.
    - Existing connect/disconnect contract used by integration suites.

- `tests/unit/kernel/execution-result.test.ts`
  - Current state:
    - Covers many normalization branches and timeout/transport classification paths.
  - Story 6.1 change target:
    - Introduce deterministic fixture table and stronger contract-key diagnostics.

- `tests/unit/kernel/execution-kernel.test.ts`
  - Current state:
    - Covers output writing, cancellations, sourceURL stability, and execution-path behavior.
  - Story 6.1 change target:
    - Add targeted regression fixtures that prove normalized outcomes remain stable end-to-end.

- `tests/integration/helpers/integration-app-server.ts`
  - Current state:
    - Provides a Foundry-flavored static server lifecycle helper.
  - Story 6.1 change target:
    - Reuse or split into profile-agnostic static-fixture helper so core suites avoid profile coupling.

- `tests/integration/transport/browser-connect.integration.test.ts`
  - Current state:
    - Validates connection attach, session coexistence, and runtime evaluate behavior.
  - Story 6.1 change target:
    - Add deterministic fixture cases for normalized outcomes through core path.

- `tests/integration/debugger/breakpoint-binding.integration.test.ts`
  - Current state:
    - Exercises DAP breakpoint routing against cell URL identities.
  - Story 6.1 change target:
    - Add deterministic assertion that static-page fixture observes emitted per-cell sourceURL and debugger domain enablement.

### Technical Requirements

- Preserve the shared result contract from Story 2.3 as the single source of truth.
- Preserve per-cell source identity semantics (`//# sourceURL=<cell-uri>`) established by Stories 2.4/2.5 and expanded by Epic 10.
- Ensure deterministic tests are profile-agnostic and avoid runtime dependencies on profile implementation modules.
- Keep user-visible strings localized when adding any runtime diagnostics.

### Architecture Compliance

- Respect layer boundaries: tests may touch integration helpers and public kernel/transport APIs but should not bypass established abstractions.
- Keep transport/CDP specifics within transport layer and integration harnesses.
- Avoid introducing duplicate normalization logic in tests; assertions should validate canonical functions.

### Library and Framework Requirements

- Runtime and tests remain TypeScript strict-mode compatible.
- Existing repository dependencies are sufficient:
  - `chrome-remote-interface@0.34.0` (current repo and latest published).
  - `@vscode/test-cli@0.0.12` (repo current; latest published is 0.0.15).
  - `typescript@5.3.3` (repo current; latest published is 6.0.3).
- Do not upgrade toolchain versions in this story unless explicitly required.

### File Structure Requirements

- Unit tests stay under `tests/unit/`.
- Integration tests stay under `tests/integration/`.
- Shared deterministic fixture utilities stay in `tests/integration/helpers/`.
- Do not introduce profile runtime imports in core fixture suites.

### Testing Requirements

- Deterministic fixtures must cover:
  - Success path.
  - Syntax failure.
  - Runtime failure.
  - Serialization boundaries.
  - Breakpoint/sourceURL and Debugger enablement path for static page.
- Assertion diagnostics must include fixture identity and expected vs actual contract/classification context.
- CI viability must be preserved for compile/unit and gated integration paths.

## Git Intelligence Summary

- Recent commits show stable completion of Epic 4 with corrections and retrospective closure (`3e750f6`, `b040a48`, `4124511`, `3bdfc26`).
- Current branch baseline indicates no active implementation in Epic 6 yet, so this story should establish deterministic guardrails before feature changes in Stories 6.2 and 6.3.

## Latest Technical Information

- Latest npm registry check confirms `chrome-remote-interface` current latest is `0.34.0`, matching repository dependency.
- Latest `@vscode/test-cli` and TypeScript versions are newer than repo-pinned values, but no upgrade is required for this story scope.

## Project Context Reference

- `docs/epics/epic-6-safe-experimentation-and-core-reliability.md`
- `docs/prd.md`
- `docs/architecture.md`
- `.github/copilot-instructions.md`
- `spike/cdp-multiplex-findings.md`
- `docs/stories/2-3-normalize-success-and-failure-output-contracts.md`
- `docs/stories/2-5-enable-source-level-breakpoint-debugging.md`

## Risks and Guardrails

- Risk: fixture tests silently mirror implementation quirks instead of requirements.
  - Guardrail: classify by explicit expected contract fields and failure kinds from PRD/NFRs.
- Risk: reintroducing profile-coupled imports into core suites.
  - Guardrail: keep static-fixture helpers generic; avoid Foundry-only runtime assumptions in core tests.
- Risk: false-positive breakpoint assertions due to nondeterministic attach timing.
  - Guardrail: use deterministic setup order and explicit debugger-enable assertions before breakpoint checks.

## Questions Saved For End

1. Should Story 6.1 include reconnect transition fixtures in this same scope, or leave reconnect determinism strictly to a follow-up hardening slice tied to NFR13 reconnect coverage expansion?
2. For serialization boundaries, should the acceptance benchmark require explicit large-payload size thresholds in tests, or is representative boundary coverage sufficient for this story?

## Completion Status

- Deterministic fixture matrix and contract-shape diagnostics implemented in unit tests.
- Profile-agnostic static integration harness and deterministic breakpoint/sourceURL assertions implemented in integration tests.
- Compile, unit, and targeted CDP integration suites passed; story moved to `review`.

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- /home/node/.vscode-server/data/User/workspaceStorage/2e9ad2f61a53a3e3bc350795b9312ec0/GitHub.copilot-chat/debug-logs/65a8a50b-ab4b-422c-865e-0d2b96db9026
- /home/node/.vscode-server/data/User/workspaceStorage/2e9ad2f61a53a3e3bc350795b9312ec0/GitHub.copilot-chat/debug-logs/69130bfa-d931-4484-b56a-687b268a31d6

### Implementation Plan

- Extend kernel normalization unit coverage with deterministic fixture-table assertions for classifications and exact contract key sets.
- Add reusable profile-agnostic static integration lifecycle helpers while preserving existing Foundry-oriented call sites.
- Add deterministic integration coverage for normalized outcomes and breakpoint/sourceURL observability with debugger-domain readiness checks.
- Validate via compile, full unit suite, and targeted CDP integration suite.

### Completion Notes List

- Implemented deterministic fixture matrix in `tests/unit/kernel/execution-result.test.ts` for success/failure/serialization boundaries.
- Added actionable diagnostics for classification and contract-key mismatches with fixture labels and expected-vs-actual details.
- Refactored integration static server lifecycle into profile-agnostic helper APIs and retained compatibility wrappers.
- Added deterministic transport integration assertions for normalized outcome consistency and timeout normalization.
- Added breakpoint integration assertions to verify debugger readiness and observed per-cell sourceURL stability across reruns.
- Updated notebook stop-button integration execution stub with `clearOutput` to align with current kernel execution contract.
- Validation executed: `npm run compile`, `npm run test`, and `npm run test:integration:cdp` (targeted suites), all passing.

### File List

- docs/stories/6-1-validate-core-pipeline-with-deterministic-fixtures.md
- docs/stories/sprint-status.yaml
- tests/unit/kernel/execution-result.test.ts
- tests/integration/helpers/integration-app-server.ts
- tests/integration/transport/browser-connect.integration.test.ts
- tests/integration/debugger/breakpoint-binding.integration.test.ts
- tests/integration/notebook/stop-button.integration.test.ts

## Change Log

- 2026-06-30: Added deterministic fixture-table unit coverage and actionable contract-shape diagnostics for core normalization outcomes.
- 2026-06-30: Added profile-agnostic static integration harness and deterministic integration assertions for normalized outcomes, sourceURL visibility, and debugger readiness.
- 2026-06-30: Executed compile/unit/integration validation runs and updated story status to `review`.

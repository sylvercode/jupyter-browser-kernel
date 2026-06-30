# Sprint Change Proposal - 2026-06-30

Project: jupyter-browser-kernel  
Author: GitHub Copilot (Correct Course workflow)  
Requested by: Sylvercode  
Mode: Batch

## Section 1: Issue Summary

### Triggering Issue

Post-MVP direction changed after delivery of Epic 10 (full VS Code debugging) and Epic 11 (debug-session-driven connection lifecycle).

### Problem Statement

Current post-MVP planning still includes Epics 7, 8, and 9, which were designed for profile-oriented expansion (Foundry profile workflows and prompted substitution). With debug integration now becoming the primary product trajectory, those epics are either already superseded in practical value, or no longer aligned with this extension's intended product boundary. The remaining profile mechanism in code introduces unnecessary abstraction and maintenance surface.

### Issue Type

Strategic pivot or market/product boundary change.

### Evidence

- Epic backlog still contains profile-heavy plans and prompted substitution scope in docs and sprint status.
- Completed Epic 10 and Epic 11 now define the primary post-MVP path around VS Code native debugging and debug-lifecycle orchestration.
- Existing code still carries profile-selection abstraction even though only a single core profile is active in implementation.

## Section 2: Impact Analysis

### Checklist Progress and Status

#### 1) Understand Trigger and Context

- [x] 1.1 Trigger identified: post-MVP planning conflict discovered after Epic 10/11 completion.
- [x] 1.2 Core problem defined: strategic product-boundary pivot.
- [x] 1.3 Evidence gathered from PRD/epics/sprint status/source.

#### 2) Epic Impact Assessment

- [x] 2.1 Current epic viability: Epic 10/11 remain valid and complete.
- [x] 2.2 Required epic changes: remove Epic 7, Epic 8, Epic 9.
- [x] 2.3 Remaining epic review: Epic 1/2/3/4/6/10/11 stay aligned.
- [x] 2.4 Obsolete epics identified: 7/8/9 are obsolete for this product.
- [x] 2.5 Epic order/priority update: no resequencing needed after removal.

#### 3) Artifact Conflict and Impact Analysis

- [x] 3.1 PRD conflicts found: profile and prompted-substitution requirements conflict with revised boundary.
- [x] 3.2 Architecture conflicts found: profile-layer abstractions no longer needed.
- [N/A] 3.3 UI/UX conflicts: no direct UI redesign required; only wording/flow references to reconnect commands and profile states may need cleanup.
- [x] 3.4 Other artifacts impacted: sprint status, epic list, and code modules under src/profile.

#### 4) Path Forward Evaluation

- [x] 4.1 Option 1 Direct Adjustment: Viable (Low-Medium effort, Low-Medium risk).
- [x] 4.2 Option 2 Potential Rollback: Assessed and rejected (rollback unnecessary; change is forward de-scope).
- [x] 4.3 Option 3 PRD MVP Review: Viable (MVP already done; this is post-MVP realignment).
- [x] 4.4 Selected approach: Hybrid of Option 1 + Option 3.

#### 5) Sprint Change Proposal Components

- [x] 5.1 Issue summary complete.
- [x] 5.2 Epic/artifact impacts documented.
- [x] 5.3 Recommended path with rationale documented.
- [x] 5.4 MVP impact and action plan documented.
- [x] 5.5 Agent handoff plan defined.

#### 6) Final Review and Handoff Readiness

- [x] 6.1 Checklist reviewed.
- [x] 6.2 Proposal consistency reviewed.
- [x] 6.3 Explicit user approval received (`Continue`).
- [x] 6.4 sprint-status.yaml updated.
- [x] 6.5 Handoff execution completed.

### Epic Impact

- Remove Epic 7: Enable Foundry Profile Eligibility and Runtime.
- Remove Epic 8: Deliver Foundry Productivity Workflows.
- Remove Epic 9: Prompted Input Substitution.
- Keep Epic 10 and Epic 11 as the post-MVP direction already completed.

### Story Impact

- Remove all backlog story entries tied to Epic 7, 8, and 9 from sprint tracking.
- No completed stories are invalidated.

### Artifact Conflicts

- PRD currently includes FR27-FR37 and profile-oriented sections that should be removed or de-scoped from this product.
- Architecture still references capability-negotiated profile interfaces as post-MVP expansion, which should be simplified.
- Epic list and sprint status still advertise deprecated roadmap items.

### Technical Impact

- Remove profile mechanism abstraction in code path for target selection.
- Keep deterministic page-target selection behavior, but move it to a direct core policy (no profile indirection).
- Update tests that reference profile abstractions.

## Section 3: Recommended Approach

### Chosen Path

Hybrid: Direct Adjustment + PRD Post-MVP Scope Review.

### Rationale

- The MVP and current post-MVP core direction are already validated by completed Epic 10/11.
- Removing Epics 7/8/9 lowers maintenance burden and roadmap noise.
- Profile-oriented capabilities now fit better as a separate product integrated with notebook ecosystem rather than this extension's core trajectory.

### Effort, Risk, Timeline

- Effort: Medium.
- Risk: Medium (doc/architecture/code contract cleanup across multiple artifacts).
- Timeline impact: Positive (reduced future scope and complexity).

### Risk Assessment

- Main risk: dangling references to removed FRs/epics in docs and tests.
- Mitigation: one-pass artifact cleanup plus compile/test validation after code changes.

## Section 4: Detailed Change Proposals

### A) Story / Sprint Tracking Changes

Story: Sprint tracking entries for Epic 7, 8, 9  
Section: development_status in docs/stories/sprint-status.yaml

OLD:

- epic-7 and stories 7-1..7-5 in backlog
- epic-8 and stories 8-1..8-4 in backlog
- epic-9 and stories 9-1..9-3 in backlog

NEW:

- Remove all epic-7, epic-8, epic-9 entries and related retrospective placeholders
- Add one changelog comment in file header indicating roadmap de-scope decision date

Rationale: sprint tracker should reflect active roadmap only.

### B) Epic List Changes

Story: Epic roadmap list  
Section: docs/epics/epic-list.md

OLD:

- Epic 7, 8, 9 listed as post-MVP planned work.

NEW:

- Remove Epic 7, 8, 9 sections entirely.
- Keep Epic 10 and 11 as completed post-MVP core direction.
- Add short note that profile-oriented expansion and prompted substitution were de-scoped from this product line.

Rationale: prevent future planning drift and accidental story creation against retired scope.

### C) PRD Changes

Document: docs/prd.md  
Sections to update:

- Post-MVP App-Specific Profile Enhancements (Foundry Example)
- Growth Features entries mentioning prompted substitution and profile expansion
- Example Web-App Profile Requirements block (FR27-FR36)
- Post-MVP Core requirement FR37
- NFR items tied to profile eligibility contracts (NFR9/NFR10/NFR11/NFR14 if exclusively profile-bound)
- Journey 5 (Adding an App Profile) and traceability rows tied exclusively to FR27-FR37
- Glossary entries that imply profile mechanism remains in-scope for this product

OLD:

- Product includes future profile mechanism and Foundry-specific post-MVP scope.
- Prompted substitution is retained as Epic 9 post-MVP core feature.

NEW:

- Product scope is explicitly narrowed to notebook browser-kernel core and debug integration trajectory.
- FR27-FR37 removed from active requirement set for this product.
- Profile-oriented expansion is marked out-of-scope and delegated to separate future product initiative.

Rationale: align requirements to actual strategic direction and completed core work.

### D) Architecture Changes

Document: docs/architecture.md  
Sections to update:

- Requirements overview references to two-layer core/profile architecture as a committed post-MVP path.
- Core architectural decisions mentioning capability-negotiated profile interfaces for near-term expansion.
- Any direct references to FR24-FR37 support where profile features are treated as planned extension path.

OLD:

- Architecture reserves explicit profile-layer growth path inside this repository's product boundary.

NEW:

- Architecture focuses on extension core runtime, debug-session lifecycle, and transport/kernel boundaries.
- Profile mechanism support is removed from near-term architecture commitments.

Rationale: reduce architectural debt and ambiguous extension points.

### E) Code Changes (Profile Mechanism Cleanup)

Artifact: src/profile/profile-types.ts, src/profile/core-target-profile.ts, src/profile/target-profile.ts, src/transport/browser-connect.ts

OLD:

- Target selection and mismatch messaging depend on TargetProfile abstraction and getActiveProfile().

NEW:

- Remove src/profile module set.
- Replace profile-based target selection with direct core target policy helper in transport layer (page targets only, deterministic selection retained).
- Keep target-mismatch connect failure behavior and localization quality unchanged.

Rationale: remove dead abstraction while preserving behavior.

### F) Test and Validation Changes

Artifact: tests/\*\* (where needed)

OLD:

- Potential references to profile abstractions.

NEW:

- Update tests to assert direct core target policy behavior and unchanged mismatch diagnostics.
- Run compile + tests to confirm no regression.

Rationale: maintain confidence after architectural simplification.

## Section 5: Implementation Handoff

### Scope Classification

Major.

Reasoning: change touches roadmap strategy, PRD, architecture commitments, sprint governance, and core transport code paths.

### Handoff Recipients and Responsibilities

- Product Manager / Architect:
  - Approve product-boundary realignment and PRD/architecture de-scope.
  - Confirm retired FR set and updated roadmap narrative.
- Developer:
  - Apply code cleanup for profile mechanism and update affected tests.
  - Update epic list and sprint status artifacts.
- Tech Writer:
  - Align docs/index and any onboarding references to retired roadmap areas.

### Success Criteria

- Epics 7/8/9 removed from planning and sprint tracking.
- PRD and architecture contain no active commitments to profile mechanism or Epic 9 prompted substitution in this product.
- Profile abstraction code removed; compile and tests pass.
- No dangling references to removed FRs in active docs.

## Proposed Implementation Sequence

1. Update docs/epics/epic-list.md and docs/stories/sprint-status.yaml.
2. Update docs/prd.md and docs/architecture.md to de-scope removed roadmap.
3. Remove src/profile module and refactor src/transport/browser-connect.ts.
4. Update tests and run compile + relevant test suites.
5. Final docs consistency pass across docs/index.md references.

## Section 6: Execution Outcome (Completed)

### Final Status

Approved and implemented on 2026-06-30.

### Implemented Changes

- Removed Epic 7, Epic 8, and Epic 9 from active planning artifacts and sprint tracking.
- De-scoped FR27-FR37 from active product requirements in planning artifacts.
- Simplified architecture/planning narrative to the post-MVP core direction centered on Epic 10 and Epic 11 outcomes.
- Removed profile-mechanism source modules and refactored target selection to a direct core policy.
- Updated impacted tests to match the simplified transport API and removed obsolete profile-specific tests.

### Validation Evidence

- `npm run compile` passed after refactor and documentation updates.
- `npm run test:unit` passed with no failures.

### Closure Notes

This document is now a closed implementation record, not a pending approval artifact.

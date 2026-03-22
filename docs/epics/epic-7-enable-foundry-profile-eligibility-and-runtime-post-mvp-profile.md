# Epic 7: Enable Foundry Profile Eligibility and Runtime (Post-MVP Profile)

**Goal:** Enable deterministic Foundry profile target eligibility, runtime-envelope integration, and clear execution gating based on profile readiness states.

**Dependencies:** Epic 1, Epic 2

**Stories:**

## Story 7.1: Implement Foundry Target Matching Rules

As a Foundry profile integrator,
I want deterministic profile-owned target matching rules,
So that only valid Foundry targets are considered for execution.

**Acceptance Criteria:**

**Given** active browser targets
**When** profile matching executes
**Then** only targets satisfying Foundry profile rules are marked as candidates
**And** non-matching targets are excluded deterministically.

**Given** no matching targets are found
**When** Connect is attempted
**Then** a target-mismatch result is returned
**And** diagnostics remain profile-scoped and actionable.

**Given** deterministic fixture inputs for profile matching
**When** automated tests run
**Then** eligibility candidate outcomes are stable and repeatable
**And** regressions are attributable to rule changes.

## Story 7.2: Inject Extension-Owned Runtime Envelope

As a platform developer,
I want Foundry profile execution to use the extension-owned runtime envelope and helper injection,
So that profile behavior remains additive and aligned with core execution contracts.

**Acceptance Criteria:**

**Given** a Foundry-eligible target
**When** cell execution starts
**Then** the extension-owned envelope is injected automatically
**And** no user boilerplate is required.

**Given** envelope-based execution
**When** intentional output helpers are called
**Then** structured value and log channels are available
**And** helper naming remains architecture-scoped.

**Given** core/profile separation constraints
**When** implementation and tests are validated
**Then** profile logic does not bypass core result contracts
**And** architecture boundaries are preserved.

## Story 7.3: Classify Foundry Target Eligibility States

As a Foundry user,
I want target eligibility to be classified into explicit states,
So that I can quickly determine whether execution is ready.

**Acceptance Criteria:**

**Given** an eligibility evaluation request
**When** classification completes
**Then** result is exactly one of ready, target mismatch, or connection interrupted
**And** state labels are deterministic for equivalent conditions.

**Given** timeout or disconnect during classification
**When** evaluation ends
**Then** the outcome includes explicit root-cause category
**And** classification does not fall back to ambiguous state.

**Given** repeated eligibility checks under unchanged conditions
**When** reevaluated
**Then** state classification remains consistent
**And** no nondeterministic state drift is introduced.

## Story 7.4: Provide Actionable Non-Eligible Guidance

As a Foundry user,
I want clear next-step guidance when eligibility is not satisfied,
So that I can recover quickly and return to execution.

**Acceptance Criteria:**

**Given** a target-mismatch result
**When** diagnostics render
**Then** guidance includes concrete target-selection correction steps
**And** messaging remains concise and copy-friendly.

**Given** a connection-interrupted result
**When** diagnostics render
**Then** reconnect steps are explicit and actionable
**And** guidance indicates expected recovery path.

**Given** diagnostics content is copied for troubleshooting
**When** shared externally
**Then** sensitive environment details are excluded
**And** actionable context is preserved.

## Story 7.5: Gate Execution by Eligibility and Proceed When Ready

As a Foundry user,
I want execution to proceed only when eligibility is ready,
So that invalid runs are blocked and valid runs continue without confusion.

**Acceptance Criteria:**

**Given** eligibility state is ready
**When** a cell run is requested
**Then** execution proceeds through the Foundry profile path
**And** run results render through standard notebook output channels.

**Given** eligibility state is not ready
**When** a run is requested
**Then** execution is blocked
**And** explicit reason plus recovery actions are shown.

**Given** eligibility transitions from not-ready to ready
**When** run is requested again
**Then** execution proceeds without requiring extension restart
**And** prior failure state does not block new valid runs.

---

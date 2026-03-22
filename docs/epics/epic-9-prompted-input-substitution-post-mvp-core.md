# Epic 9: Prompted Input Substitution (Post-MVP Core)

**Goal:** Enable deterministic prompt placeholder substitution before execution so dynamic runtime inputs can be collected safely without manual code rewrites.

**Dependencies:** Epic 1, Epic 2

**Stories:**

## Story 9.1: Define Prompt Placeholder Substitution Flow

As a developer,
I want placeholder markers in cell code to request values before execution,
So that dynamic inputs can be injected without manual edits each run.

**Acceptance Criteria:**

**Given** a cell containing one or more placeholders
**When** run is requested
**Then** execution pauses and collects values for each placeholder before evaluation starts
**And** substitution occurs before any runtime side effects.

**Given** multiple placeholders in one cell
**When** prompt flow runs
**Then** prompt order is deterministic
**And** each entered value maps to the correct placeholder occurrence.

**Given** all required placeholder values are collected
**When** execution starts
**Then** substituted code evaluates once with resolved values
**And** run output reflects the resolved-input execution path.

## Story 9.2: Validate Placeholder Resolution and Cancellation Paths

As a developer,
I want placeholder cancellation and unresolved-input behavior to fail safely,
So that prompt flow errors do not trigger ambiguous or partial execution.

**Acceptance Criteria:**

**Given** user cancellation during prompt flow
**When** flow exits
**Then** execution is aborted cleanly
**And** no partial evaluation occurs.

**Given** unresolved placeholder values remain
**When** execution is attempted
**Then** the run is blocked
**And** unresolved-input diagnostics are explicit.

**Given** invalid input format where validation rules apply
**When** prompt submission occurs
**Then** field-level correction guidance is shown
**And** execution does not proceed until values are valid.

## Story 9.3: Surface Prompt Diagnostics and Recovery Guidance

As a developer,
I want concise prompt-related diagnostics with clear recovery actions,
So that failures route me back to the write-run-inspect loop quickly.

**Acceptance Criteria:**

**Given** prompt substitution fails
**When** diagnostics render
**Then** root-cause category is explicit and copy-friendly
**And** messaging remains concise and actionable.

**Given** recoverable prompt issues
**When** guidance is shown
**Then** concrete next steps are provided (retry prompts, edit placeholders, rerun)
**And** the user can continue without restarting the extension.

**Given** a successful prompt flow after prior failure
**When** rerun completes
**Then** prior failure state does not block normal execution
**And** normal output semantics are restored.

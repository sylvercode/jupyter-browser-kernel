# Epic 5: Present Complex Variables and Watches (Post-MVP Core)

**Goal:** Enable advanced runtime inspection through watched expressions, depth-limited projection, and resilient multi-watch refresh behavior.

**Dependencies:** Epic 1, Epic 2, Epic 4

**Stories:**

## Story 5.1: Create and Refresh Watched Expressions

As a developer,
I want to register watched expressions and refresh them manually or after execution,
So that I can monitor key runtime values while iterating on notebook cells.

**Acceptance Criteria:**

**Given** a valid watched expression
**When** I add it to the watch list
**Then** it appears in the active session watch collection
**And** it is addressable for later refresh.

**Given** one or more registered watches
**When** I trigger manual refresh
**Then** each watch evaluates against current runtime state
**And** each row shows a current value or watch-specific error.

**Given** post-execution refresh is enabled
**When** a cell run completes
**Then** watch refresh executes according to configured refresh behavior
**And** refreshed values remain attributable to that refresh cycle.

## Story 5.2: Add Depth-Limited Projection and Nested Expansion

As a developer,
I want depth-limited rendering with on-demand expansion for complex values,
So that large nested objects remain readable by default while preserving deep inspection capability.

**Acceptance Criteria:**

**Given** a nested watched value
**When** it first renders
**Then** only configured depth levels are shown by default
**And** truncation points are clearly indicated.

**Given** an expandable nested node
**When** I expand it
**Then** deeper properties are retrieved and rendered on demand
**And** unrelated watch rows do not rerender unnecessarily.

**Given** configured depth limits
**When** watches refresh across runs
**Then** the same projection rules apply consistently
**And** output remains stable for deterministic fixtures.

## Story 5.3: Isolate Watch Evaluation Failures

As a developer,
I want a failing watch to be isolated from other watches,
So that partial watch errors do not block the rest of the inspection workflow.

**Acceptance Criteria:**

**Given** multiple watches where one throws during evaluation
**When** refresh executes
**Then** the failed watch shows structured error state
**And** other watches still refresh and render successfully.

**Given** multiple failing watches
**When** refresh completes
**Then** each failed watch presents independent diagnostics
**And** failure in one watch does not collapse the full watch panel state.

**Given** a previously failing watch later evaluates successfully
**When** a subsequent refresh runs
**Then** its error state is cleared
**And** normal value rendering resumes for that watch.

---

# Epic 4: Capture Intentional Values (Basic)

**Goal:** Surface intentional execution values in structured notebook output.

**Dependencies:** Epic 1, Epic 2

**Stories:**

## Story 4.1: Return Execution Values to Notebook Output

As a developer,
I want each cell's successful execution value to be returned as notebook output,
So that I can inspect run outcomes immediately without opening external tooling.

**Acceptance Criteria:**

**Given** a cell that returns a primitive value
**When** execution succeeds
**Then** the primitive value is shown inline in the notebook output
**And** the output indicates success state clearly.

**Given** a cell that returns a serializable object or array
**When** execution succeeds
**Then** the value is rendered in a readable structured form
**And** serialization boundaries are handled without silent output loss.

**Given** a cell that returns a non-serializable value
**When** output is rendered
**Then** the result provides a clear representation or fallback description
**And** the run is not marked as failed solely due to display limitations.

**Scope Note (FR10 boundary):** Story 4.1 builds on Story 2.1 baseline return-value visibility by adding intentional value rendering semantics and structured output behavior for value-capture workflows.

## Story 4.2: Display Structured Value Output with Type Context

As a developer,
I want value output to include type context in a labeled output envelope,
So that ambiguous outcomes like null, undefined, and empty string are easy to distinguish.

**Acceptance Criteria:**

**Given** any successful execution value
**When** output renders
**Then** the output includes both the value and its type metadata
**And** the envelope remains explicitly labeled as success.

**Given** an error outcome
**When** output renders
**Then** the envelope is explicitly labeled as error
**And** no unlabeled free-form output is produced.

**Given** nested object values
**When** output is displayed
**Then** nested content uses progressive disclosure defaults
**And** users can expand detail on demand without overwhelming the default view.

---

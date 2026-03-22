# Epic 3: Capture Intentional Logs

**Goal:** Provide an extension-owned runtime helper for emitting intentional log output from cells, routed to notebook output and visually distinct from ambient browser console activity.

**Dependencies:** Epic 1, Epic 2

**Stories:**

## Story 3.1: Define Intentional Log Capture Runtime Helper

As a developer,
I want an extension-owned API I can call from cell code to emit intentional log entries,
So that I explicitly control what log output appears in notebook results.

**Acceptance Criteria:**

**Given** cell code that calls the intentional log helper
**When** the cell executes
**Then** the helper enqueues a log entry associated with that cell run
**And** the helper accepts at least a string message argument.

**Given** the helper is called multiple times in one cell
**When** execution completes
**Then** all entries are captured in call order
**And** no entries are dropped or silently truncated within normal usage.

**Given** the helper is not called in a cell
**When** execution completes
**Then** no log section appears in the cell output
**And** the output contract remains unchanged for cells that produce only a return value.

## Story 3.2: Route Captured Logs to Notebook Cell Output

As a developer,
I want captured log entries to appear as structured output in the corresponding cell,
So that I can read them without leaving the notebook or opening a separate panel.

**Acceptance Criteria:**

**Given** one or more intentional log entries captured during cell execution
**When** the cell output renders
**Then** each log entry appears in the cell output area
**And** entries are ordered chronologically.

**Given** a cell that produces both a return value and log entries
**When** output renders
**Then** both the return value and the log section are present
**And** they are visually distinguishable from each other.

**Given** a cell execution that fails after emitting some log entries
**When** the error output renders
**Then** any captured log entries are preserved and shown alongside the error
**And** partial log output is not discarded on failure.

## Story 3.3: Distinguish Intentional Logs from Ambient Console Activity

As a developer,
I want intentional log output to be clearly distinct from unrelated browser console noise,
So that I can focus on what my cell emitted without filtering ambient activity.

**Acceptance Criteria:**

**Given** intentional log entries in cell output
**When** they are rendered
**Then** each line carries the JBK identity prefix for filtering and searchability
**And** ambient `console.log` activity from the page is not co-rendered in cell output.

**Given** intentional output is also mirrored to the output channel
**When** a user filters the output channel
**Then** the JBK prefix enables reliable filtering of intentional output from ambient noise
**And** the prefix format is consistent across all intentional output types.

**Given** a session reconnect within the same working session
**When** subsequent cells run and emit logs
**Then** the intentional/ambient distinction is preserved
**And** no ambient console backlog is injected into intentional cell output on reconnect.

---

# Epic 8: Deliver Foundry Productivity Workflows (Post-MVP Profile)

**Goal:** Deliver practical notebook-first Foundry workflows including starter examples and reusable action flows for high-frequency runtime tasks.

**Dependencies:** Epic 7

**Stories:**

## Story 8.1: Enable Notebook-First Foundry Macro Iteration

As a Foundry power user,
I want to iterate macro logic directly in notebook cells,
So that I can avoid switching to the Foundry macro editor during rapid experimentation.

**Acceptance Criteria:**

**Given** a Foundry-eligible runtime session
**When** macro logic runs from notebook cells
**Then** execution behavior aligns with Foundry runtime expectations
**And** results are visible inline in notebook output.

**Given** multiple macro revisions in a session
**When** cells are rerun
**Then** feedback remains fast and inline
**And** iteration does not require editor context switching.

**Given** notebook-first workflow usage
**When** compared to macro-editor workflows
**Then** no mandatory macro-editor step is required for iteration
**And** the write-run-inspect loop remains notebook-native.

## Story 8.2: Provide Foundry Starter Notebook

As a Foundry user,
I want a starter notebook with token-state read and token-value update examples,
So that I can onboard quickly to the intended runtime workflow.

**Acceptance Criteria:**

**Given** the starter notebook is opened
**When** initial cells are reviewed
**Then** token-read and token-update examples are present
**And** examples are aligned to profile runtime expectations.

**Given** a valid Foundry session
**When** starter cells execute
**Then** outputs demonstrate state inspection and update patterns
**And** each step is interpretable from notebook output.

**Given** first-time onboarding
**When** users follow starter flow in order
**Then** an initial successful run can be completed
**And** external documentation is not required for basic success.

## Story 8.3: Save Notebook Cell as Reusable Action

As a Foundry power user,
I want to save a notebook cell as a reusable action,
So that recurring runtime tasks can be replayed without rewriting cell content.

**Acceptance Criteria:**

**Given** a selected notebook cell
**When** save-as-action is invoked
**Then** the action is persisted with a user-defined name
**And** saved metadata links action back to source cell context.

**Given** one or more saved actions
**When** actions are listed
**Then** entries are discoverable and selectable
**And** naming is clear enough to distinguish similar tasks.

**Given** invalid or duplicate action names
**When** save is attempted
**Then** validation feedback is explicit and actionable
**And** no partial action record is persisted on failure.

## Story 8.4: Reopen and Execute Saved Actions with Prompts

As a Foundry power user,
I want to reopen and execute saved actions, including prompted inputs when required,
So that reusable flows remain adaptable across changing runtime contexts.

**Acceptance Criteria:**

**Given** a saved action is selected
**When** it is reopened
**Then** code content is restored accurately for inspection or editing
**And** reopened content preserves execution intent.

**Given** a saved action requires user inputs
**When** execution begins
**Then** required prompts are collected before run
**And** prompt values map to the correct placeholders.

**Given** saved-action execution completes
**When** output renders
**Then** success or failure is shown inline with clear semantics
**And** outcomes remain traceable to the invoked action.

---

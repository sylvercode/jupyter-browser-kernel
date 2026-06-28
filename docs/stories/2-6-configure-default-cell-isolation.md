---
storyId: "2.6"
storyKey: "2-6-configure-default-cell-isolation"
title: "Configure Default Cell Isolation"
status: "backlog"
created: "2026-06-27"
epic: "2"
priority: "p1"
---

# Story 2.6: Configure Default Cell Isolation

**Status:** backlog

## Story

As a developer,
I want a workspace setting that controls whether JavaScript notebook cells run isolated by default,
and a command to explicitly use the default isolation mode for a cell,
So that I can choose safer per-cell isolation without manually toggling every cell.

## Acceptance Criteria

### AC 1: Workspace Setting Is Contributed and Documented

**Given** the extension is installed
**When** I open the Jupyter Browser Kernel settings
**Then** I can configure `jupyterBrowserKernel.defaultCellIsolation`
**And** the setting is described as controlling the default execution mode for cells that do not declare explicit isolation metadata
**And** the setting defaults to `false` so current shared-by-default behavior remains unchanged.

### AC 2: Missing Isolation Metadata Falls Back to the Setting

**Given** a JavaScript notebook cell with no `metadata.jupyterBrowserKernel.isolated` value
**When** the cell runs
**Then** the kernel uses `jupyterBrowserKernel.defaultCellIsolation` to decide whether to isolate the cell
**And** the resulting execution path matches the existing explicit isolated or shared behavior.

### AC 3: Explicit Per-Cell Metadata Overrides the Setting

**Given** a cell whose metadata explicitly sets `jupyterBrowserKernel.isolated = true`
**When** the cell runs
**Then** the cell runs isolated even if the workspace setting is `false`.

**Given** a cell whose metadata explicitly sets `jupyterBrowserKernel.isolated = false`
**When** the cell runs
**Then** the cell runs shared even if the workspace setting is `true`.

### AC 4: The Setting Does Not Rewrite Notebook Metadata

**Given** I change `jupyterBrowserKernel.defaultCellIsolation`
**When** I save or reopen the notebook
**Then** the notebook content only changes if I explicitly toggle a cell's isolation metadata
**And** the workspace setting itself is not serialized into the notebook document.

### AC 5: The Setting Takes Effect on Subsequent Runs Without Reload

**Given** I change `jupyterBrowserKernel.defaultCellIsolation`
**When** I run another cell
**Then** the new default applies immediately without reloading the extension host or reopening the notebook.

### AC 6: Existing Toggle Command Remains the Source of Explicit Overrides

**Given** I use the existing cell isolation toggle command
**When** the command runs
**Then** it continues to write or remove explicit `metadata.jupyterBrowserKernel.isolated` values
**And** the command continues to override the workspace default on the next run.

### AC 7: Explicit Default-Mode Command Is Available

**Given** a JavaScript notebook cell handled by the Browser Kernel controller
**When** I view the cell toolbar or cell context menu
**Then** I can invoke a `Use Default Cell Isolation` command when the cell has explicit isolation metadata
**And** running the command clears any explicit isolation metadata for that cell
**And** the next execution falls back to `jupyterBrowserKernel.defaultCellIsolation`.

### AC 8: Default-Off Preserves Current Rerun Semantics

**Given** the setting remains at its default value
**When** I run ordinary JavaScript cells in sequence
**Then** the current shared-by-default state accumulation behavior remains unchanged
**And** the new setting does not introduce any accidental isolation.

### AC 9: Command Visibility Matches the Current Isolation State

**Given** a JavaScript notebook cell whose isolation metadata is absent
**When** I view the cell toolbar or cell context menu
**Then** `Isolate Cell` and `Share Cell State` are visible
**And** `Use Default Cell Isolation` is hidden because the cell is already using the workspace default.

**Given** a JavaScript notebook cell whose metadata explicitly sets `jupyterBrowserKernel.isolated = true`
**When** I view the cell toolbar or cell context menu
**Then** `Share Cell State` and `Use Default Cell Isolation` are visible
**And** `Isolate Cell` is hidden because the cell is already isolated.

**Given** a JavaScript notebook cell whose metadata explicitly sets `jupyterBrowserKernel.isolated = false`
**When** I view the cell toolbar or cell context menu
**Then** `Isolate Cell` and `Use Default Cell Isolation` are visible
**And** `Share Cell State` is hidden because the cell is already shared.

## Tasks / Subtasks

### 1. Add the Settings Surface

- [ ] Add `jupyterBrowserKernel.defaultCellIsolation` to the extension configuration in [package.json](../../package.json) under the existing Jupyter Browser Kernel settings section.
- [ ] Add localized description text to [package.nls.json](../../package.nls.json) for the new setting.
- [ ] Keep the default value `false` so the current shared-by-default experience remains the baseline.
- [ ] Add a new command such as `jupyterBrowserKernel.useDefaultCellIsolation` with the label `Use Default Cell Isolation`, plus localized text in [package.nls.json](../../package.nls.json).
- [ ] Update the notebook cell toolbar and context menu `when` clauses so command visibility follows the current state matrix in AC 9.

### 2. Thread the Default Into Cell Execution

- [ ] Update the kernel runtime or execution path in [src/kernel/execution-kernel.ts](../../src/kernel/execution-kernel.ts) so cell isolation resolves in three states: explicit isolated, explicit shared, or missing metadata.
- [ ] Apply `jupyterBrowserKernel.defaultCellIsolation` only when the cell metadata does not explicitly set `metadata.jupyterBrowserKernel.isolated`.
- [ ] Keep [src/kernel/build-cell-expression.ts](../../src/kernel/build-cell-expression.ts) unchanged except for receiving the resolved boolean; the wrapper shape and `//# sourceURL` contract stay the same.
- [ ] Read the setting in a testable way, preferably through a small runtime callback or settings accessor passed from [src/extension.ts](../../src/extension.ts), so unit tests can cover both default and overridden cases without depending on global state.

### 3. Preserve Explicit Override Behavior

- [ ] Ensure the existing cell isolation toggle command still writes or removes explicit notebook cell metadata.
- [ ] Ensure the new default-mode command clears explicit notebook cell metadata without mutating any other cell fields.
- [ ] Ensure the visibility state for `Isolate Cell`, `Share Cell State`, and `Use Default Cell Isolation` is driven only by whether explicit isolation metadata is absent, `true`, or `false`.
- [ ] Confirm the setting never mutates notebook metadata on its own.
- [ ] Preserve the current output annotation behavior for isolated cells.

### 4. Add Coverage

- [ ] Add or extend unit tests in [tests/unit/kernel/execution-kernel.test.ts](../../tests/unit/kernel/execution-kernel.test.ts) to cover default-false behavior, default-true behavior, explicit-true override, and explicit-false override.
- [ ] Add UI/command coverage for the new default-mode command and the AC 9 visibility matrix.
- [ ] If helpful, add a small helper test for the isolation-resolution logic so the tri-state fallback is obvious and regression-resistant.
- [ ] Add one integration-style test only if needed to prove the setting change takes effect on the next run without a notebook reload.

## Dev Notes

### Story Context and Scope

This is a small follow-up to Epic 2's isolation work. The existing implementation already supports explicit per-cell isolation metadata plus the same-line wrapper contract. This story only changes the default resolution path when the metadata key is absent.

### Locked Boundaries

- Do not change the wrapper shape in [src/kernel/build-cell-expression.ts](../../src/kernel/build-cell-expression.ts).
- Do not introduce any Debugger-domain behavior here; Story 2.5 owns the breakpoint mirror and Epic 10 owns native VS Code debugging.
- Do not move the setting into notebook metadata. It is a workspace-level preference only.
- Do not alter the existing explicit toggle command semantics. The setting is a default, not a replacement.
- Do not make the default-mode command write a new metadata value; it should clear explicit isolation metadata and fall back to the workspace default.

### Implementation Hint

The current `readIsolationMetadata(...)` logic returns a boolean and collapses missing metadata into `false`. That is not enough for this story. The execution path needs a tri-state resolution so the kernel can tell the difference between "explicitly shared" and "not specified, use the workspace default."

### Files Likely Touched

- [package.json](../../package.json)
- [package.nls.json](../../package.nls.json)
- [src/extension.ts](../../src/extension.ts)
- [src/kernel/execution-kernel.ts](../../src/kernel/execution-kernel.ts)
- [tests/unit/kernel/execution-kernel.test.ts](../../tests/unit/kernel/execution-kernel.test.ts)

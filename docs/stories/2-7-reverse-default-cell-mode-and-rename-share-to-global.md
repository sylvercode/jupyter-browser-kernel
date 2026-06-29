---
storyId: "2.7"
storyKey: "2-7-reverse-default-cell-mode-and-rename-share-to-global"
title: "Reverse Default Cell Mode and Rename Shared Mode to Global"
status: "draft"
created: "2026-06-29"
epic: "2"
priority: "p0"
---

# Story 2.7: Reverse Default Cell Mode and Rename Shared Mode to Global

This story supersedes [Story 2.6: Configure Default Cell Isolation](./2-6-configure-default-cell-isolation.md) and replaces its shared-by-default model with the new global-by-default model.

## Story

As a developer,
I want the default JavaScript cell execution mode to be global instead of isolated,
and I want the shared mode renamed to Global mode,
So that the execution model matches the new product direction and the UI makes the mode boundary obvious.

## Acceptance Criteria

### AC 1: Global Mode Becomes the Default Execution Mode

**Given** a JavaScript notebook cell with no explicit isolation metadata
**When** the cell runs
**Then** the cell executes in the global context of the browser by default
**And** the default behavior does not isolate the cell unless the user explicitly opts in.

### AC 2: Global Mode Uses the New Label and Icon

**Given** a cell that is running in the non-isolated default mode
**When** the toolbar or context menu renders
**Then** the mode is labeled `Global mode`
**And** the mode uses the `window` icon.

### AC 3: Isolated Mode Uses the New Icon

**Given** a cell that is explicitly isolated
**When** the toolbar or context menu renders
**Then** the isolated mode uses the `package` icon
**And** the isolated state remains visually distinct from Global mode.

### AC 4: The Isolated Cell Annotation Is Removed

**Given** an isolated cell runs successfully
**When** its output renders
**Then** the previous `(isolated cell)` annotation does not appear
**And** no replacement annotation is added for Global mode
**And** the status icon is the source of truth for the current mode.

### AC 5: Global Mode Does Not Expose the `$cell` Bridge

**Given** a cell running in Global mode
**When** the cell code executes
**Then** `$cell` is not available
**And** Global mode does not rely on the runtime cell bridge.

### AC 6: Global Mode Does Not Synthesize a Final Return

**Given** a cell running in Global mode
**When** the cell executes a final expression without an explicit `return`
**Then** the kernel does not synthesize a return statement to surface the last value
**And** the cell follows the browser's normal global execution behavior.

### AC 7: Isolated Mode Retains the Bridge and Requires an Explicit Return

**Given** a cell running in isolated mode
**When** the cell code uses the runtime cell bridge
**Then** `$cell` is available
**And** the wrapper contract preserves isolated execution semantics.

**Given** a cell running in isolated mode
**When** the code does not end with an explicit `return`
**Then** the cell result is `undefined`
**And** the execution contract makes the return requirement explicit in docs and tests.

### AC 8: Commands and Menus Reflect the New Naming

**Given** the cell isolation controls render in the UI
**When** the shared mode is shown
**Then** the visible label is `Global mode`
**And** the control uses the `window` icon.

**Given** the cell isolation controls render in the UI
**When** the isolated mode is shown
**Then** the control uses the `package` icon
**And** the naming no longer refers to `Share Cell State`.

### AC 9: Documentation and Tests Match the New Default

**Given** the product-direction change is approved
**When** the story is implemented
**Then** the docs explain that Global mode is the default
**And** the docs explain the `$cell` availability rules and return behavior for both modes
**And** the affected tests are updated to cover the renamed mode, icon changes, removed annotation, and default-mode reversal.

## Tasks / Subtasks

### 1. Update the Cell-Mode UI Contract

- [ ] Rename the current shared mode label to `Global mode` in all user-facing surfaces.
- [ ] Set the Global mode icon to `window`.
- [ ] Set the isolated mode icon to `package`.
- [ ] Remove the `(isolated cell)` annotation from isolated execution output.
- [ ] Ensure no replacement annotation is shown for Global mode.

### 2. Reverse the Default Execution Mode

- [ ] Change the default isolation resolution so cells run in Global mode unless explicitly isolated.
- [ ] Keep the explicit isolated state available as an opt-in mode.
- [ ] Update the execution path so Global mode does not expose `$cell`.
- [ ] Update the execution path so Global mode does not synthesize a final `return`.
- [ ] Update the isolated wrapper contract so `$cell` remains available and the result is `undefined` when code does not explicitly return a value.

### 3. Update Commands, Menus, and Labels

- [ ] Rename any visible `Share Cell State` command or menu entry to `Global mode`.
- [ ] Ensure the icon and visibility rules match the current mode.
- [ ] Keep the isolation toggle behavior aligned with the new default semantics.
- [ ] Update any context keys or menu `when` clauses if they currently encode the old shared-by-default mental model.

### 4. Update Documentation

- [ ] Update story or reference docs that describe the default execution model.
- [ ] Document that Global mode is default, has no `$cell` bridge, and does not synthesize a final return.
- [ ] Document that isolated mode keeps `$cell` and requires an explicit `return` to produce a value.

### 5. Update Tests

- [ ] Add or update unit tests for the renamed `Global mode` label.
- [ ] Add or update unit tests for the `window` and `package` icons.
- [ ] Add or update tests asserting the `(isolated cell)` annotation is removed.
- [ ] Add or update tests covering the default reversal to Global mode.
- [ ] Add or update tests covering `$cell` availability and return behavior in both modes.

## Dev Notes

### Story Context and Scope

This story is a product-direction reversal of the current cell-mode model. It supersedes the earlier shared-by-default framing in Story 2.6 and should be treated as the canonical source for the new mental model.

### Locked Direction

- Global mode is the default execution mode.
- The shared-mode label is renamed to Global mode.
- Global mode uses the `window` icon.
- Isolated mode uses the `package` icon.
- The `(isolated cell)` annotation is removed.
- Global mode does not expose `$cell`.
- Global mode does not synthesize a final `return` for the last execution value.
- Isolated mode preserves `$cell` and requires an explicit `return` to produce a defined result.

### Scope Boundary

- This story updates the execution contract, labels, icons, docs, and tests.
- This story does not introduce a new product epic.
- This story should be implemented before Story 3.2 so the downstream work inherits the new default-mode model.
- This story is the authoritative planning artifact for the renamed mode, default reversal, and bridge/return semantics.

### Files Likely Touched

- [package.json](../../package.json)
- [package.nls.json](../../package.nls.json)
- [src/kernel/build-cell-expression.ts](../../src/kernel/build-cell-expression.ts)
- [src/kernel/execution-kernel.ts](../../src/kernel/execution-kernel.ts)
- [src/commands/toggle-cell-isolation-command.ts](../../src/commands/toggle-cell-isolation-command.ts)
- [src/notebook/kernel-controller.ts](../../src/notebook/kernel-controller.ts)
- [tests/unit/kernel/build-cell-expression.test.ts](../../tests/unit/kernel/build-cell-expression.test.ts)
- [tests/unit/kernel/execution-kernel.test.ts](../../tests/unit/kernel/execution-kernel.test.ts)
- [tests/unit/commands/toggle-cell-isolation-command.test.ts](../../tests/unit/commands/toggle-cell-isolation-command.test.ts)

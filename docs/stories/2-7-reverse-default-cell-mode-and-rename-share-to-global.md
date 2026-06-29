---
storyId: "2.7"
storyKey: "2-7-reverse-default-cell-mode-and-rename-share-to-global"
title: "Reverse Default Cell Mode and Rename Shared Mode to Global"
status: "review"
baseline_commit: "fc4e3b9ba867710fd8621ea74e85eb6437b1caea"
created: "2026-06-29"
epic: "2"
priority: "p0"
---

# Story 2.7: Reverse Default Cell Mode and Rename Shared Mode to Global

This story supersedes [Story 2.6: Configure Default Cell Isolation](./2-6-configure-default-cell-isolation.md) and retires its shared-by-default framing in favor of an isolated-by-default model when a cell has no explicit isolation metadata.

## Story

As a developer,
I want JavaScript cells with no explicit `jupyterBrowserKernel.isolated` metadata to run in isolated mode by default,
and I want the UI label for the shared mode to be Global mode,
So that the execution contract and the user-facing naming match the new product direction.

I also want the default-mode setting to remain available as a documented choice list, framed around Global mode, so users can explicitly choose whether isolated mode or Global mode is the default and read the explanation for each choice.

## Acceptance Criteria

### AC 1: Isolated Mode Becomes the Default Execution Mode

**Given** a JavaScript notebook cell with no explicit `jupyterBrowserKernel.isolated` metadata
**When** the cell runs
**Then** the cell executes in isolated mode by default
**And** the default behavior does not share cell state unless the user explicitly opts in.

### AC 1b: The Default-Mode Setting Remains as a Documented Choice List

**Given** the extension settings are displayed
**When** I inspect the default-mode setting
**Then** the setting still exists as a documented choice list for the cell default mode
**And** the available choices are Isolated mode and Global mode
**And** each choice includes a short description that explains its execution behavior
**And** the selected choice determines the default mode for cells without explicit isolation metadata.

### AC 2: Global Mode Uses the New Label and Icon

**Given** a cell that is running in the shared Global-mode variant
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
**And** no replacement annotation is added for Global mode.

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
**Then** the docs explain that isolated mode is the default
**And** the docs explain that the default-mode setting remains available and is framed around Global mode
**And** the docs explain the `$cell` availability rules and return behavior for both modes
**And** the affected tests are updated to cover the renamed mode, icon changes, removed annotation, and default-mode reversal.

## Tasks / Subtasks

### 1. Update the Cell-Mode UI Contract

- [x] Rename the current shared mode label to `Global mode` in the cell toolbar, context menu, and any other user-facing isolation surface.
- [x] Set the Global mode icon to `window`.
- [x] Set the isolated mode icon to `package`.
- [x] Remove the `(isolated cell)` annotation from isolated execution output.
- [x] Ensure no replacement annotation is shown for Global mode.

### 2. Reverse the Default Execution Mode

- [x] Change the default isolation resolution so cells run in isolated mode unless explicitly switched to Global mode.
- [x] Keep the explicit isolated state available as an opt-in mode.
- [x] Update the execution path so Global mode does not expose `$cell`.
- [x] Update the execution path so Global mode does not synthesize a final `return`.
- [x] Update the isolated wrapper contract so `$cell` remains available and the result is `undefined` when code does not explicitly return a value.

### 3. Update Commands, Menus, and Labels

- [x] Rename any visible `Share Cell State` command or menu entry to `Global mode`.
- [x] Ensure the icon and visibility rules match the current mode.
- [x] Keep the isolation toggle behavior aligned with the new default semantics.
- [x] Update any context keys or menu `when` clauses if they currently encode the old shared-by-default mental model.

### 4. Update Documentation

- [x] Update story or reference docs that describe the default execution model.
- [x] Update the setting copy so the default-mode preference is presented as a documented choice list with explicit Global and isolated mode descriptions.
- [x] Document that Global mode is default, has no `$cell` bridge, and does not synthesize a final return.
- [x] Document that isolated mode keeps `$cell` and requires an explicit `return` to produce a value.

### 5. Update Tests

- [x] Add or update unit tests for the renamed `Global mode` label.
- [x] Add or update unit tests for the `window` and `package` icons.
- [x] Add or update tests asserting the `(isolated cell)` annotation is removed.
- [x] Add or update tests covering the default reversal to Global mode.
- [x] Add or update tests covering `$cell` availability and return behavior in both modes.

## Dev Notes

### Story Context and Scope

This story is a product-direction reversal of the current cell-mode model. It supersedes the earlier shared-by-default framing in Story 2.6 and should be treated as the canonical source for the new mental model.

### Locked Direction

- Isolated mode is the default execution mode when a cell has no explicit `jupyterBrowserKernel.isolated` metadata.
- The default-mode setting remains available as a documented choice list with Global and isolated mode descriptions.
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

## Dev Agent Record

### Debug Log

- Captured baseline commit: `fc4e3b9ba867710fd8621ea74e85eb6437b1caea`.
- Ran `npm run test:unit` in red phase to confirm expected failures before implementation.
- Ran `npm run test:unit` after implementation; all tests passed (301/301).
- Ran `npm run lint`; lint passed.

### Completion Notes

- Reversed default cell-mode behavior to isolated-by-default across extension runtime defaults and setting schema.
- Reframed the default-mode setting as an explicit choice list (`isolated` or `global`) with behavior-oriented descriptions.
- Renamed user-facing shared mode text to Global mode and updated status bar/tooling text for Global mode naming.
- Updated mode icons to `package` (isolated) and `window` (global).
- Removed isolated annotation rendering from notebook outputs.
- Ensured global mode never injects the runtime `$cell` bridge while isolated mode keeps bridge behavior.
- Updated and expanded unit tests covering label/icon changes, annotation removal, default-mode reversal, and runtime behavior.

## File List

- docs/stories/2-7-reverse-default-cell-mode-and-rename-share-to-global.md
- docs/stories/sprint-status.yaml
- l10n/bundle.l10n.json
- package.json
- package.nls.json
- src/commands/toggle-cell-isolation-command.ts
- src/extension.ts
- src/kernel/build-cell-expression.ts
- src/kernel/execution-kernel.ts
- src/kernel/execution-messages.ts
- src/notebook/cell-isolation-status-bar.ts
- tests/unit/commands/command-registration.test.ts
- tests/unit/kernel/build-cell-expression.test.ts
- tests/unit/kernel/execution-kernel.test.ts
- tests/unit/notebook/cell-isolation-status-bar.test.ts

## Change Log

- 2026-06-29: Implemented Story 2.7 end-to-end, including default-mode reversal to isolated, Global-mode renaming, icon updates, output annotation removal, settings/docs updates, and full unit-test alignment.

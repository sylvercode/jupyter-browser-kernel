---
storyId: "1.1"
storyKey: "1-1-initialize-extension-from-starter-template"
title: "Initialize Extension from Starter Template"
status: "ready-for-dev"
created: "2026-04-02"
epic: "1"
priority: "p0-blocker"
---

# Story 1.1: Initialize Extension from Starter Template

**Status:** ready-for-dev

## Story

As a platform developer,
I want to scaffold the extension project from the Yeoman generator-code template with esbuild bundling,
So that the project structure, build pipeline, and ESM output compatibility are validated before any feature work begins.

## Acceptance Criteria

### AC 1: TypeScript VS Code Extension with esbuild

**Given** the project is initialized
**When** the scaffold completes
**Then** a TypeScript VS Code extension project exists with esbuild bundling configured
**And** `npm run compile` produces valid output.

### AC 2: ESM Output Compatibility

**Given** the scaffolded project
**When** esbuild bundles the extension
**Then** the output is ESM-compatible with VS Code extension host loading expectations
**And** no module-format import failures occur at load time.

### AC 3: Architecture Compliance + Strict TypeScript

**Given** the initial project structure
**When** reviewed against architecture constraints
**Then** folder layout follows architecture ownership boundaries
**And** strict TypeScript mode is enabled (`"strict": true`).

## Task Breakdown

### Phase 1: Scaffolding

- [ ] Initialize project using Yeoman generator-code (AC 1, 3)
  - [ ] Run: `npx --package yo --package generator-code -- yo code --extensionType ts --bundler esbuild --pkgManager npm --skipOpen`
  - [ ] Verify generated structure includes `src/`, `package.json`, `.vscode-test`, and `esbuild.config.js`
  - [ ] Confirm TypeScript tsconfig exists

### Phase 2: Strict TypeScript Mode

- [ ] Enable strict TypeScript mode (AC 3)
  - [ ] Set `"strict": true` in `tsconfig.json`
  - [ ] Verify all existing files in the scaffold compile without errors
  - [ ] Document any typescript-specific patterns for future code (source: [typescript-notes.md](/memories/repo/typescript-notes.md))

### Phase 3: esbuild ESM Validation

- [ ] Validate esbuild configuration outputs ESM (AC 2)
  - [ ] Confirm `esbuild.config.js` specifies ESM output format
  - [ ] Run `npm run compile` and check dist/extension.js (or equivalent) is an ESM-compatible bundle
  - [ ] Verify extension host loads the bundle without module-format errors

### Phase 4: Extension Host Compatibility Test

- [ ] Verify bundle loads in VS Code extension host (AC 2)
  - [ ] Create minimal activation test in `src/extension.ts` (e.g., register a test command that logs)
  - [ ] Run `npm run compile`
  - [ ] Launch Extension Development Host (F5 in VS Code)
  - [ ] Confirm extension activates without "module resolution" or "default import" errors

### Phase 5: Build Workflow Validation

- [ ] Validate build commands work end-to-end (AC 1, 2)
  - [ ] `npm run compile` → produces output, no errors
  - [ ] `npm run watch` → starts watch mode without hanging
  - [ ] Extension activates correctly in Dev Host with watch-mode changes

### Phase 6: Architecture Boundary Verification

- [ ] Confirm project structure aligns with architecture boundaries (AC 3)
  - [ ] Folder layout: clarify ownership (e.g., `src/` for core, `src/transport/` for CDP layer, etc.)
  - [ ] File naming conventions: match expected TypeScript patterns (e.g., services end in `.ts`, not `.service.ts` unless specified)
  - [ ] Verify no circular dependencies or structural violations

### Phase 7: Verify Git Baseline

- [ ] Confirm repository is already initialized and tracking scaffold files
  - [ ] Ensure `.gitignore` includes `node_modules/`, `dist/`, `.vscode-test/`
  - [ ] Create a normal commit after scaffold verification

## Dev Notes

### Scaffolding Details (Architecture Compliance)

From [docs/architecture.md](../architecture.md#starter-template-evaluation):

- **Starter:** Yeoman + generator-code (v1.11.18+, Feb 2026)
- **Command:** `npx --package yo --package generator-code -- yo code --extensionType ts --bundler esbuild --pkgManager npm --skipOpen`
- **Output:** ESM-compatible extension bundle via esbuild
- **Module System:** ESM (per architecture decision)
- **TypeScript:** Strict mode enabled

**Implications:**

1. The scaffold creates a baseline; we validate that esbuild outputs ESM before feature work.
2. ESM compatibility checkpoint is critical and must be validated in Extension Development Host.
3. Initial project structure should NOT assume future components yet—only validate that generated scaffold is sound.

### Compilation + Watch Mode Expectations

From package.json (post-scaffold):

- `npm run compile`: single esbuild pass, produces `dist/` or `out/` depending on generator version
- `npm run watch`: esbuild in watch mode, rebuilds on file change
- `npm run lint`: eslint (if generator includes it)
- `npm test`: test runner (if scaffold includes one; post-scaffold, we may add @vscode/test-cli)

### Project Structure Notes

The generator creates a boilerplate extension with:

```
.
│   ├── extensions.json
│   └── launch.json
├── src/
│   └── extension.ts           (bare minimum activation)
├── package.json
├── tsconfig.json
├── esbuild.config.js          (bundler config)
├── .eslintrc.json
├── .gitignore
├── CHANGELOG.md
├── README.md
└── vsc-extension-quickstart.md
```

**Alignment with architecture requirements:**

- **Ownership boundaries:** Confirmed—`src/` is the root module, future layers (transport, kernel, etc.) will be subdirectories.
- **Naming conventions:** TypeScript files are `.ts`, no special suffix required (unless future patterns dictate otherwise).
- **Circular dependencies:** Baseline scaffold has none; we verify as new files are added in later stories.

### Extension Activation + Command Registration

The initial `src/extension.ts` should:

1. Export `activate()` and `deactivate()` functions (VS Code contract).
2. Register a minimal test command (e.g., `jupyterBrowserKernel.hello`) to verify load.
3. Output to extension development console on activation.

Example:

```typescript
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "jupyterBrowserKernel.hello",
    () => {
      vscode.window.showInformationMessage("Extension activated!");
    }
  context.subscriptions.push(disposable);
}

export function deactivate() {}
```

This validates that the extension host can load and call the activation function.

### esbuild Configuration Notes

The scaffold includes `esbuild.config.js`. Key settings (post-scaffold, no changes required):

- `entryPoints: ["src/extension.ts"]` → single entry
- `outfile: "dist/extension.js"` (or similar)
- `bundle: true` → single file output
- `target: "node16"` or similar (for VS Code compatibility)
- `format: "esm"` (or equivalent ESM output setting) → ESM output (architecture decision)
- `external: ["vscode"]` → VS Code is provided by host, not bundled

**Important:** Keep ESM output in Phase 3 and validate extension host compatibility.

### Testing the Extension Host Load

**Manual test (Phase 4):**

1. Open this repo in VS Code.
2. Press F5 to launch Extension Development Host.
3. In the Dev Host, press Ctrl+Shift+P and run `jupyterBrowserKernel.hello`.
4. Verify the notification pops up.
5. Check extension development console (View → Output → "Extension Host") for any errors.

If errors occur:

- **"Cannot find module 'vscode'"** → VS Code not mocked; usually transient, retry F5.
- **Syntax errors in bundle** → esbuild config or TypeScript error; check console.
- **Promise rejection on activate** → async in activate; ensure deferred startup if needed.

## Dev Agent Record

### Agent Model Used

Claude Haiku 4.5

### Debug Log References

- Creation timestamp: 2026-04-02 during create-story workflow execution
- Artifact discovery: Auto-discovered from sprint-status.yaml as first backlog story in Epic 1

### Completion Notes

**Ultimate context engine analysis completed** — This story file includes:

- ✅ Comprehensive acceptance criteria with clear phase breakdown
- ✅ Architecture compliance guardrails (strict TypeScript, esbuild ESM output, folder layout)
- ✅ Previous project learnings (TypeScript patterns from repo memory, ripgrep unavailable in container)
- ✅ Detailed technical notes on scaffolding, esbuild config, and extension host validation
- ✅ Architecture compliance (TypeScript strict, ESM decision documented, esbuild bundling confirmed)
- ✅ Project structure ownership boundaries aligned with architecture.md
- ✅ Manual test procedures for Phase 4 validation
- ✅ Git baseline verification and CI-ready baseline

### File List

**Files to be created/modified:**

1. Generated by scaffold:
   - `package.json` — extension metadata, scripts, dependencies
   - `tsconfig.json` — TypeScript config (update: strict mode)

- `esbuild.config.js` — bundler config (verify: ESM output format)
- `src/extension.ts` — minimal activation entrypoint
- `.vscode/launch.json` — debug configuration
- `.gitignore` — exclude dist, node_modules, etc.

2. Manual updates (Phase 2, 6):
   - `tsconfig.json`: Set `"strict": true`

- `esbuild.config.js`: Verify or set ESM output format explicitly

3. Verification outputs (Phase 5):

- `dist/extension.js` (or `out/` equivalent) — compiled ESM-compatible bundle

## References

- [Architecture Decision Document](../architecture.md#starter-template-evaluation) — Starter and module-system decision source of truth
- [Architecture Decision: Starter Template Evaluation](../architecture.md#starter-template-evaluation) — Generator-code + esbuild selected
- [Architecture Decision: ESM Module Output](../architecture.md#architecture-decisions-derived-from-starter) — ESM output decision with compatibility checkpoint
- [Epic 1: Connect and Control Browser Sessions](../epics/epic-1-connect-and-control-browser-sessions.md) — Story context and dependencies
- [Product Brief: jupyter-browser-kernel](../product-brief.md) — Project scope and coexistence requirements
- Repo Memory: [typescript-notes.md](/memories/repo/typescript-notes.md) — Strict TypeScript patterns
- Repo Memory: [tooling.md](/memories/repo/tooling.md) — Available tools (grep, find; no ripgrep)

---

**Status Update:** Ready for implementation. Developer has complete context on scaffolding approach, validation checkpoints, architecture compliance, and expected build pipeline behavior.

Next story: [1-2-configure-browser-endpoint](./1-2-configure-browser-endpoint.md) — Settings infrastructure (post-skeleton completion).

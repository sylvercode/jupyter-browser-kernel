---
title: Product Brief — foundry-devil-code-sight
version: 0.1
date: 2026-03-15
status: Draft
owners:
  - Sylvercode
sources:
  - _bmad-output/brainstorming/brainstorming-session-2026-03-14-162248.md
  - spike/cdp-multiplex-findings.md
---

> Superseded for execution planning: Use `docs/prd.md` as the canonical source of truth.

# Product Brief: foundry-devil-code-sight

## 1) Executive Summary

foundry-devil-code-sight is a VS Code extension that connects to a running FoundryVTT browser tab via CDP to provide a JavaScript notebook scratchpad, variable watching, and intentional script output viewing. The product complements (not replaces) Edge DevTools by enabling fast iterate-and-run workflows directly from VS Code while remaining debuggable in DevTools.

The key architectural decision for v1 is to use browser-level CDP WebSocket multiplexing with session-based target attachment. This avoids single-client page WebSocket conflicts and enables coexistence with DevTools.

## 2) Problem Statement

FoundryVTT scripting workflows are slow and fragmented:

- Ad hoc scripts are hard to iterate quickly from an editor.
- Context/state inspection is manual and error-prone.
- Console output is noisy and mixed with unrelated browser logs.
- Debugging and custom tooling can conflict when both need CDP access.

Users need a fast, repeatable, low-friction workflow for executing and refining scripts against a live Foundry world.

## 3) Product Goals

1. Enable reliable JavaScript cell execution from .ipynb in the Foundry browser context.
2. Provide lightweight variable watching that is useful despite CDP serialization limits.
3. Surface deliberate script output in VS Code with minimal noise.
4. Preserve compatibility with Edge DevTools during active development.
5. Keep v1 scope narrow and robust, with clear upgrade/version behavior.

## 4) Non-Goals (v1)

1. Full replacement for browser DevTools debugger.
2. Deep object inspector parity with DevTools variable trees.
3. Rich action marketplace or cloud sync.
4. Full browser console mirroring.
5. Broad Foundry helper API surface in companion module.

## 5) Primary Users

1. Foundry world/module developers writing and iterating scripts.
2. Power users/GMs automating repetitive world operations.
3. Teams sharing repeatable workspace-scoped actions.

## 6) User Value Proposition

- Run, debug, and iterate Foundry scripts from VS Code notebooks.
- Inspect important runtime values quickly via focused watchers.
- Capture intentional output in a clean VS Code channel.
- Reuse known-good scripts as named, parameterized actions.

## 7) Scope for v1

### In Scope

1. CDP browser-level connection and per-target session attachment (`Target.attachToTarget`, `flatten: true`).
2. Notebook controller for JavaScript cells in `.ipynb`.
3. IIFE-wrapped execution contract with normalized error handling.
4. Variable watcher with shallow values and watch chaining.
5. Companion Foundry module (thin): namespace init, version, `$f.out()`, `$f.log()`.
6. Three-state module handshake on connect: missing / legacy / mismatch / ok.
7. Configurable connect retry behavior.
8. Intentional output stream using sentinel-prefixed `$f.log()` into VS Code OutputChannel.
9. Workspace-scoped actions file with cell-to-action promotion and action-to-cell roundtrip.
10. `$prompt()` pre-execution substitution for parameterized cells/actions.

### Out of Scope

1. Automatic deep object expansion in watcher.
2. Full log panel webview with advanced filtering UI.
3. Complex Foundry utility SDK in companion module.
4. Multi-target orchestration beyond active Foundry page selection.

## 8) Functional Requirements

1. Extension connects using `foundryDevilCodeSight.cdpHost` and `foundryDevilCodeSight.cdpPort`.
2. Target selection must only attach to `type === 'page'` URLs containing `/game`.
3. Notebook execution must support async code, return values, and surfaced errors.
4. Errors must normalize to a shared shape for notebook, watcher, and actions flows.
5. Watcher refresh triggers: manual, post-cell execution, optional timer (`0` disables).
6. Companion module state/version must be validated at connect-time handshake.
7. Missing module path must offer install guidance from extension UI.
8. Output channel should include only deliberate script output (sentinel-prefixed events).
9. Actions persist in workspace root `.foundry-actions.json`.
10. `$prompt()` values must be collected in VS Code before evaluation.

## 9) Technical Approach (v1)

1. Keep `chrome-remote-interface` and switch to browser-level WebSocket from `/json/version`.
2. Attach independent flat sessions to Foundry target via `Target.attachToTarget`.
3. Route commands via `client.send(method, params, sessionId)` and subscribe with session-scoped event keys.
4. Use IIFE wrapper for cell/action isolation and explicit global namespace (`window.$foundryNotebook` / `$f`).
5. Emit runtime errors as an envelope and merge with CDP `exceptionDetails` into unified `EvalResult`.
6. Use `OutputChannel` instead of a webview log panel for v1 simplicity.

## 10) Success Metrics

1. Connectivity: successful attach rate to Foundry target in normal setup.
2. Coexistence: extension remains connected while Edge DevTools is active.
3. Execution reliability: cell success/failure reporting accuracy and consistency.
4. Iteration speed: user-reported reduction in script iteration time.
5. Adoption: number of saved actions and repeated action executions per workspace.
6. Stability: low reconnect/churn rates under page reload and startup races.

## 11) Risks and Mitigations

1. CDP multiplexing regressions across Chromium variants.
   - Mitigation: keep browser-level/session architecture isolated and covered by integration tests.
2. Module install/version mismatch confusion.
   - Mitigation: explicit handshake states and guided install/update messaging.
3. Serialization limits frustrate watcher expectations.
   - Mitigation: shallow-watch model documented clearly, with UUID chaining workflow.
4. Output signal pollution.
   - Mitigation: strict sentinel filtering for `$f.log()` only.
5. Macro substitution safety concerns (`$prompt()`).
   - Mitigation: clear quoting rules and explicit preview/confirmation before run.

## 12) Dependencies

1. VS Code APIs: notebook controller, output channel, webview (install guidance), debug API.
2. Extension dependencies:
   - `ms-toolsai.jupyter`
   - `ms-edgedevtools.vscode-edge-devtools`
3. CDP client:
   - `chrome-remote-interface` (session multiplexing supported).
4. Companion Foundry module distributed via GitHub release manifest URL.

## 13) Milestones

1. M1: CDP session architecture integrated and smoke-tested.
2. M2: Companion module v1 + handshake/retry behavior.
3. M3: Notebook IIFE execution + unified error contract.
4. M4: Watcher shallow-chain UX + post-cell refresh.
5. M5: OutputChannel sentinel logging.
6. M6: Actions persistence + `$prompt()` macros + cell/action roundtrip.

## 14) Open Questions

1. Required minimum Chromium/Edge versions for guaranteed flat-session behavior in user environments.
2. Whether action parameter metadata should evolve beyond inline `$prompt()` patterns.
3. What default retry timeout is least surprising across local and devcontainer setups.
4. Whether install guidance should include module auto-version check against remote release metadata.

## 15) Release Readiness Criteria

1. Edge DevTools coexistence verified with concurrent active sessions.
2. Notebook execution, watcher refresh, and output channel pass happy-path and error-path tests.
3. Companion module handshake covers all four states with user-visible guidance.
4. Reload/reconnect behavior stable under Foundry startup timing variability.
5. Extension and module versions documented with compatibility notes.

## 16) Immediate Next Planning Actions

1. Convert this brief into a phase-by-phase implementation plan with estimates.
2. Define integration test cases for CDP session scoping and reconnect behavior.
3. Draft companion module repository structure and release contract.
4. Write the execution contract spec (`EvalResult`, error envelope, MIME mapping).

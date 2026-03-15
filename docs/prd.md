---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
classification:
  projectType: developer_tool
  domain: general (FoundryVTT/tabletop specialization)
  complexity: medium
  projectContext: greenfield
inputDocuments:
  - docs/product-brief.md
  - _bmad-output/brainstorming/brainstorming-session-2026-03-14-162248.md
  - spike/cdp-multiplex-findings.md
documentCounts:
  productBriefs: 1
  research: 0
  brainstorming: 1
  projectDocs: 0
workflowType: prd
projectName: foundry-devil-code-sight
---

# Product Requirements Document - foundry-devil-code-sight

**Author:** Sylvercode
**Date:** 2026-03-15

## Executive Summary

`foundry-devil-code-sight` is a VS Code extension for Foundry VTT power users — GMs and players who write, test, and iterate macros against a live world. It connects to the running Foundry browser tab via the Chrome DevTools Protocol and provides a JavaScript notebook scratchpad, inline value inspection, and a lightweight variable watcher, all without leaving VS Code.

The core problem it solves is cycle time: the standard Foundry macro editor offers a single text box, no output panel, no run history, and no way to inspect values without console archaeology. The result is slow, error-prone iteration. This extension collapses that feedback loop — write a cell, run it, see the result inline, tweak, rerun — so the user _feels_ an order-of-magnitude faster even when the underlying work is the same.

A key architectural property is coexistence: by using browser-level CDP WebSocket multiplexing (`Target.attachToTarget`, flat sessions), the extension runs alongside Edge DevTools without conflict. Neither kicks the other off.

### What Makes This Special

The differentiator is not the notebook itself — it's the compression of the write→run→inspect cycle into a frictionless loop. Three capabilities combine to produce this:

1. **Fast rerun**: re-execute any cell instantly with full Foundry context — no copy-paste into the macro editor, no page reload.
2. **Immediate value inspection**: cell output and watched variables surface inline in VS Code, not buried in the browser console.
3. **Reversibility by design**: users can write a forward cell and a reversal cell side by side, making aggressive experimentation safe — try it, undo it, try again.

No existing tool provides all three in a single VS Code-native workflow against a live Foundry world.

### Project Classification

| Dimension       | Value                                         |
| --------------- | --------------------------------------------- |
| Project Type    | Developer Tool (VS Code extension)            |
| Domain          | General — FoundryVTT/tabletop macro authoring |
| Complexity      | Medium                                        |
| Project Context | Greenfield                                    |

## Success Criteria

### User Success

- A power-user GM or player can open a `.ipynb` notebook in VS Code, connect to their live Foundry world, write a JavaScript macro cell, execute it, and see the result inline, without touching the Foundry macro editor.
- The write, run, inspect cycle feels materially faster, making iteration no longer the primary bottleneck.
- Watched variables surface values without requiring `console.log` archaeology in the browser.
- A user can write a forward cell and a reversal cell side by side, making experimentation safe to undo.

### Business Success

- The extension works reliably for personal daily use across Foundry VTT sessions.
- If and when published to the VS Code Marketplace, it is documented, installable, and functional for other power users with the same setup.

### Technical Success

- Cell execution succeeds for both synchronous and async JavaScript against the live Foundry context.
- Errors (syntax and runtime) are surfaced clearly in notebook cell output and are never silently swallowed.
- Edge DevTools can be attached simultaneously without disconnecting the extension.
- Manual reconnect command reliably restores the CDP session after a page reload.

### Measurable Outcomes

- Notebook cell executes Foundry JavaScript and returns a result: pass or fail.
- Execution errors surface as notebook output with name, message, and stack: pass or fail.
- Edge DevTools coexists without kicking the extension off: pass or fail.
- Manual reconnect command restores session within a few seconds: pass or fail.

## Product Scope & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP focused on collapsing the macro iteration loop for one power-user GM profile.
**Resource Requirements:** Solo developer with TypeScript, VS Code extension API, CDP integration, and Foundry macro domain familiarity.

**Core User Journeys Supported:**

- Primary success path: rapid macro write-run-inspect loop.
- Primary edge path: safe experimentation with forward and reversal cells.
- Solo operations path: manual reconnect and module handshake visibility.

### MVP - Minimum Viable Product

1. CDP browser-level connection via `Target.attachToTarget` (flat session, multiplexed).
2. Companion Foundry module: namespace init (`$f`), `__version`, `$f.out()`, `$f.log()`.
3. Three-state module handshake on connect: missing, legacy, mismatch, ok.
4. Notebook controller for JavaScript cells in `.ipynb`, IIFE-wrapped and async-capable.
5. Unified `EvalResult` error contract with normalized CDP and runtime exceptions.
6. Manual reconnect command.
7. One simple notebook example showing token state read and one token value update.
8. VS Code-only integration path and manual install workflow documentation.

### Growth Features

**Phase 2 (Post-MVP):**

- Variable watcher with shallow chaining UX.
- `OutputChannel` sentinel logging via `$f.log()`.
- Intentional output channel filtering.
- Better troubleshooting ergonomics and diagnostics.
- Configurable connect retry interval and timeout.

**Phase 3 (Expansion):**

- Workspace-scoped actions file with cell-to-action promotion and `$prompt()` macros.
- Action persistence and cell to action roundtrip workflow.
- Public Marketplace hardening (onboarding polish, broader compatibility docs, packaging maturity).

### Vision (Future)

- Public VS Code Marketplace release with documentation and onboarding guide.
- Action sharing between workspaces or team members.
- Deeper Foundry helper API surface in the companion module.

### Risk Mitigation Strategy

**Technical Risks:**

- CDP coexistence and session routing fragility.
- Mitigation: browser-level multiplexing architecture plus targeted integration tests.

**Market Risks:**

- The "feels faster" value may not hold if UX frictions remain.
- Mitigation: validate with real macro iteration loops and measure subjective cycle-time satisfaction.

**Resource Risks:**

- Solo bandwidth can drive scope creep and quality regression.
- Mitigation: enforce M3 boundary strictly and defer non-essential functionality to Phase 2+.

## User Journeys

### Journey 1: Primary Success Path - Rapid Macro Iteration

**Persona:** Garmek, power-user GM, preparing a session and refining world automation.

**Opening scene:**
He has a macro idea that touches actor state and scene data. In Foundry's macro editor, this would mean repetitive paste-run-edit cycles with weak visibility into intermediate values.

**Rising action:**
He opens a `.ipynb` notebook in VS Code, selects the Foundry kernel, and writes the first JavaScript cell. He runs it, inspects output inline, adjusts one line, reruns, then repeats several times in minutes.

**Climax:**
The macro produces the intended world change and the expected value output appears immediately in the notebook. No context switching, no console hunting.

**Resolution:**
He keeps the working version in a notebook cell and optionally promotes it into a reusable action. The workflow feels "10x faster" because rerun and inspection are frictionless.

**Failure/recovery path:**
If evaluation throws, the error is visible in-cell (name/message/stack). He edits and reruns immediately, preserving momentum.

### Journey 2: Primary Edge Case - Safe Experimentation and Reversal

**Persona:** Same GM, now testing risky world mutations before game time.

**Opening scene:**
He needs to try a destructive or broad macro but is unsure of side effects.

**Rising action:**
He writes a forward-operation cell and, directly below it, a reversal/rollback cell that undoes that operation. He executes forward, inspects watchers/output, and decides whether to keep or rollback.

**Climax:**
Unexpected output appears, but he can immediately run the rollback cell and restore state without leaving VS Code.

**Resolution:**
Risky experimentation becomes safe. He iterates aggressively because mistakes are cheap to reverse.

**Failure/recovery path:**
If rollback logic is incomplete, he inspects affected values through watcher outputs and patches rollback code in-place.

### Journey 3: Admin/Operations Hat - Environment and Connection Management

**Persona:** Same GM acting as installer/operator of his own toolchain.

**Opening scene:**
Foundry reloads or restarts; session state is broken or module/version state changed.

**Rising action:**
He clicks reconnect, runs handshake, sees explicit status (missing/legacy/mismatch/ok), and applies guidance if module update is needed.

**Climax:**
Connection is restored and notebook execution resumes without full environment reset.

**Resolution:**
Operational burden stays low: one person can maintain the setup without deep CDP troubleshooting every session.

**Failure/recovery path:**
If reconnect fails, diagnostics indicate where to look first (host/port/target/module state), reducing blind debugging.

### Journey 4: Support/Troubleshooting Hat - Diagnosing Unexpected Macro Behavior

**Persona:** Same GM acting as his own support engineer.

**Opening scene:**
A macro "runs" but game state is not what he expected.

**Rising action:**
He reruns targeted cells, narrows scope, uses watcher values and intentional output to isolate the exact failing assumption. Edge DevTools can remain attached for deeper breakpoints if needed.

**Climax:**
He identifies the mismatch between expected and actual state (permission, stale reference, or object path issue).

**Resolution:**
He patches the macro and validates fix in the same notebook sequence. The notebook becomes living troubleshooting history.

**Failure/recovery path:**
If debugging gets complex, he adds finer-grained cells and output markers, then converges incrementally instead of rewriting from scratch.

### Journey Requirements Summary

These journeys imply concrete capability needs:

1. Fast, repeatable notebook cell execution against live Foundry context.
2. Clear in-cell result and error rendering (syntax + runtime).
3. Minimal-friction rerun loop for micro-iterations.
4. Lightweight value inspection (watcher + output channel conventions).
5. Reliable manual reconnect and explicit module handshake states.
6. Coexistence with Edge DevTools for deeper investigations.
7. Support for forward/rollback scripting patterns in adjacent cells.
8. Optional path from "experiment" to reusable saved action.

## Domain-Specific Requirements

### Compliance and Regulatory

- No formal regulated-domain compliance is required for MVP (no HIPAA, PCI, or FedRAMP target).
- If Marketplace distribution happens later, follow VS Code extension packaging and security expectations, including minimal permissions and transparent behavior.

### Technical Constraints

- CDP session multiplexing is a hard architectural constraint for coexistence with DevTools.
- Foundry runtime state is mutable and session-scoped, so execution must surface errors clearly and preserve rapid retry loops.
- CDP serialization limits require shallow value inspection and explicit drill-down patterns instead of deep object mirroring.
- Manual reconnect is acceptable for MVP; automatic reconnect is deferred.

### Integration Requirements

- Must integrate with a running Chromium or Edge instance exposing remote debugging.
- Must target the active Foundry game page only.
- Must interoperate with Jupyter notebook workflows in VS Code.
- Must rely on a thin companion Foundry module for runtime namespace and output conventions.

### Risk Mitigations

- Risk: extension and DevTools session conflict.
  - Mitigation: browser-level WebSocket with flat target sessions.
- Risk: user confusion on module state/version.
  - Mitigation: explicit handshake states and guided messaging.
- Risk: misleading watcher expectations for deep objects.
  - Mitigation: document shallow-watch model and chaining workflow.
- Risk: unsafe rapid experimentation.
  - Mitigation: encourage forward and rollback cell patterns in journeys and examples.

## Developer Tool Specific Requirements

### Project-Type Overview

This product is a VS Code-only developer tool for Foundry macro power users. Its core job is rapid macro iteration against a live Foundry session with tight write-run-inspect loops. Runtime execution support for v1 is strictly JavaScript and excludes any TypeScript transpile or alternate runtime path.

### Technical Architecture Considerations

- Runtime execution engine must accept and execute JavaScript only.
- Notebook execution behavior should prioritize fast rerun and clear inline outputs and errors.
- IDE integration scope is hard-limited to VS Code APIs and UX patterns.
- Distribution assumptions should not depend on Marketplace publication in MVP.

### Language and Runtime Scope

- Supported runtime language: JavaScript only.
- Non-goals for MVP:
  - TypeScript runtime transpilation
  - Multi-language notebook kernels
  - Alternate script runtimes

### Installation and Distribution Model

- Installation model for MVP: manual installation only.
- No Marketplace publishing requirement in MVP.
- Documentation should explicitly assume a personal-use installation path.
- Install guidance depth for MVP is a minimal quickstart; richer guided install UX can be added post-MVP.

### IDE Integration Boundaries

- Hard boundary: VS Code only.
- No support commitments for JetBrains IDEs, Neovim, or other editors in MVP.
- Feature design should optimize for VS Code notebook and extension workflows without abstraction layers for multi-IDE compatibility.

### Documentation and Example Requirements

- Minimum documentation for MVP: one simple notebook.
- The notebook should demonstrate:
  - Reading token state
  - Updating one token value
- This notebook serves as both proof-of-install and baseline usage example.

### Implementation Considerations

- Keep interfaces simple and explicit for solo power-user operation.
- Favor predictable behavior and clear failure messages over broad feature breadth.
- Preserve the MVP philosophy: ship the smallest reliable loop first, then expand.

## Functional Requirements

Traceability highlights: FR29 through FR32 satisfy Journey 1 and Journey 2 outcomes; FR4 and FR8 through FR12 satisfy Journey 3 operations needs; FR19 through FR28 and FR42 satisfy Journey 4 troubleshooting and diagnostics needs.

### Connection and Session Control

- FR1: A power user can configure CDP host and port used by the extension.
- FR2: A power user can initiate a connection to a running browser CDP endpoint from VS Code.
- FR3: The extension can discover and select a Foundry game page target for execution.
- FR4: A power user can manually reconnect the extension after disconnection or page reload.
- FR5: A power user can disconnect the extension session from VS Code.
- FR6: The extension can report current connection state to the user.
- FR7: The extension can preserve coexistence with an active Edge DevTools session while connected to the same Foundry page.

### Companion Module Handshake and Readiness

- FR8: The extension can detect whether the companion Foundry module runtime namespace is present.
- FR9: The extension can read and compare companion module version metadata.
- FR10: The extension can classify module state as missing, legacy, mismatch, or compatible.
- FR11: The extension can present install or update guidance when module state is not compatible.
- FR12: A power user can proceed with compatible module state without additional setup prompts.

### Notebook Execution

- FR13: A power user can run JavaScript notebook cells against the live Foundry context from VS Code.
- FR14: The extension can execute asynchronous JavaScript cell logic and return resolved outcomes.
- FR15: The extension can return successful execution values to notebook output.
- FR16: The extension can surface syntax and runtime errors as notebook outputs.
- FR17: A power user can rerun modified cells repeatedly in the same notebook workflow.
- FR18: The extension can support execution isolation per cell while allowing explicit shared runtime usage patterns.

### Output and Result Inspection

- FR19: A power user can inspect execution results inline in the notebook after each run.
- FR20 [Post-MVP]: The extension can expose intentional script output emitted by companion runtime helpers.
- FR21 [Post-MVP]: A power user can distinguish deliberate script output from unrelated browser console noise.
- FR22 [Post-MVP]: The extension can preserve execution feedback needed to compare multiple code iterations.

### Variable Observation

- FR23 [Post-MVP]: A power user can define expressions to observe as watched values.
- FR24 [Post-MVP]: A power user can request manual refresh of watched values.
- FR25 [Post-MVP]: The extension can refresh watched values after notebook execution events.
- FR26 [Post-MVP]: A power user can configure complex watch projections that summarize selected nested attributes into a compact representation, instead of only viewing raw shallow values.
- FR27 [Post-MVP]: A power user can define projected reference fields, such as ActorUUID, as watchable links and start a new watch on the referenced entity directly from that projection.
- FR27a [Post-MVP]: A power user can choose the projection format for complex watches, including single-line string and structured key-value summary.
- FR28 [Post-MVP]: The extension can represent watcher evaluation failures without blocking other watch evaluations.

### Macro Iteration Workflow

- FR29: A power user can maintain forward-operation and reversal-operation cells in the same notebook.
- FR30: A power user can execute reversal cells to restore state after experiments.
- FR31: A power user can iterate through multiple macro versions in one notebook session.
- FR32: The extension can support notebook-first macro development without requiring Foundry macro-editor usage during iteration.

### Action Promotion and Reuse

- FR33 [Post-MVP]: A power user can save a notebook cell as a named reusable action.
- FR34 [Post-MVP]: A power user can execute a saved action against the active Foundry session.
- FR35 [Post-MVP]: A power user can open a saved action as a notebook cell for further editing.
- FR36 [Post-MVP]: The extension can persist actions in workspace scope for repeated use.
- FR37 [Post-MVP]: A power user can provide prompt values required by parameterized action or cell templates before execution.

### Installation, Scope, and Usage Constraints

- FR38: A power user can install and use the extension through a manual installation workflow.
- FR39: The extension can operate within a hard VS Code-only usage scope.
- FR40: The extension can provide a simple starter notebook demonstrating token state read and token value update.
- FR41: A power user can use the extension for personal workflow without requiring Marketplace distribution.
- FR42: A power user can see syntax and runtime error location mapped to the executed cell source, including line and column when available.

## Non-Functional Requirements

### Performance

- NFR1: Notebook cell execution feedback, including success or error output rendered in notebook, should appear within 2 seconds for typical macro cells under normal local conditions.
- NFR2: Manual watch refresh should render updated watch results within 2 seconds for typical watch sets under normal local conditions.
- NFR3: Reconnect command should report success or failure state within 5 seconds when browser and Foundry page are available.

### Reliability

- NFR4: The extension should recover usable execution state through manual reconnect after page reload without requiring VS Code restart.
- NFR5: A failed watch expression should not block evaluation of other watch expressions in the same refresh cycle.
- NFR6: Runtime and syntax errors must always be surfaced as explicit notebook outputs with structured location metadata, including message, line, column, and stack when available; silent failures are not acceptable.

### Integration

- NFR7: The extension should attach only to valid Foundry game page targets and avoid non-page and debugger targets.
- NFR8: The extension should coexist with an active Edge DevTools session connected to the same browser target without forced disconnect behavior.
- NFR9: Companion module handshake should complete and return a module state classification, missing, legacy, mismatch, or compatible, on each connection attempt.

### Security

- NFR10: The extension should limit its operational scope to configured local or development CDP endpoints and should not initiate unexpected remote endpoint connections.
- NFR11: The extension should not persist sensitive runtime secrets from evaluated cells unless explicitly saved by user action.
- NFR12: User-facing diagnostics should avoid exposing unnecessary sensitive environment details while remaining actionable.

### Deferred Quality Improvements

- Visual syntax error underlining in notebook cells is deferred to post-MVP and will be reconsidered after the MVP execution and diagnostics loop is stable.

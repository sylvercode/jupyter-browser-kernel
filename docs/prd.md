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
  - step-e-01-discovery
  - step-e-02-review
  - step-e-03-edit
classification:
  projectType: developer_tool
  domain: browser execution platform
  complexity: medium
  projectContext: greenfield
  adapterFocus: foundry
  platformCore: browser-kernel
inputDocuments:
  - docs/product-brief.md
  - docs/brainstorming-session-2026-03-14-162248.md
  - spike/cdp-multiplex-findings.md
documentCounts:
  productBriefs: 1
  research: 0
  brainstorming: 1
  projectDocs: 0
  planningArtifacts: 1
workflowType: prd
workflow: edit
projectName: foundry-devil-code-sight
lastEdited: 2026-03-19
editHistory:
  - date: 2026-03-18
    changes: Reframed the product as a browser execution platform with Foundry as the first MVP profile, split core platform and profile scope, and regrouped requirements.
  - date: 2026-03-19
    changes: Strengthened NFR measurability and specificity with explicit thresholds, conditions, and measurement methods.
  - date: 2026-03-19
    changes: Closed scope-to-FR traceability gaps by aligning MVP scope bullets to FR16/FR17/FR25-FR28 and making transport-boundary isolation explicit in FR14.
  - date: 2026-03-19
    changes: Fixed FR wording issues — FR14/FR18 declarative/passive forms rewritten to capability form, FR17/FR28 vague quantifiers made specific, FR29 subjective adjective removed, FR34 negative constraint rewritten as capability.
  - date: 2026-03-19
    changes: Added Requirements Traceability Map section mapping all five user journeys to scope items, FRs, and NFRs.
  - date: 2026-03-19
    changes: Closed four traceability gaps — FR29 added to RTM J1 row and Foundry scope 6, output discrimination demonstrated in Journey 1 climax, Foundry scope item 3 extended to cover execution gating (FR24), scope item 7 extended to cover in-app readiness guidance (FR23).
  - date: 2026-03-19
    changes: Added $prompt() pre-execution parameter substitution to Phase 3 scope and as FR37 [Post-MVP], resolving the critical product-brief coverage gap.
  - date: 2026-03-19
    changes: Restored intentional execution-output capture as a core kernel MVP capability (FR16 rewritten, scope item 7 expanded, Journey 4 and Journey Requirements Summary updated). Clarified $f.out()/$f.log() as Foundry-profile helpers in FR31 and Phase 2 Foundry scope.
  - date: 2026-03-19
    changes: Promoted FR31 to MVP — without a concrete emitter the core output-capture capability (FR16) is untestable in the MVP profile. Added Foundry scope item 7 for companion-module output helpers, removed $f.out()/$f.log() from Phase 2 Foundry deferral, and updated RTM J1/J4 rows.
  - date: 2026-03-19
    changes: Post-validation refinements — enumerated platform connection states in FR4, added measurement methods to NFR5 and NFR13, added Glossary section defining profile, transport, shared result contract, execution history retention, transport-boundary isolation, readiness state, and connection state.
---

# Product Requirements Document - foundry-devil-code-sight

**Author:** Sylvercode
**Date:** 2026-03-15
**Last Edited:** 2026-03-18

## Executive Summary

`foundry-devil-code-sight` is a VS Code extension that provides a browser-backed JavaScript notebook execution kernel for rapid workflow iteration against live browser applications. The first supported profile targets Foundry VTT, where GMs and players can write, test, and iterate macros against a live world without leaving VS Code.

The immediate user problem is cycle time. In Foundry, the standard macro editor compresses execution into a single text box with weak output visibility and no durable notebook workflow. More broadly, browser-hosted automation work often lacks a deterministic, notebook-first execution loop that can run against a live page, surface structured results, and coexist with existing developer tooling.

The product solves that problem by combining notebook execution, normalized result handling, and browser-session orchestration behind a single workflow. Users write a cell, run it against the active page, inspect the result inline, adjust one line, and rerun without re-establishing context. Foundry is the MVP validation vertical, but the kernel, result contract, reconnect model, and diagnostics are intended to support additional browser-application profiles later.

A key architectural property is coexistence. The execution model must work alongside active browser debugging tools, including Edge DevTools, without forced disconnect behavior. The platform also preserves transport flexibility: direct CDP transport is viable today, and a browser-extension bridge remains a credible later transport option. The kernel contract must remain stable even if transport changes.

### What Makes This Special

The differentiator is not a notebook UI by itself. The differentiator is a deterministic browser execution loop with explicit profile boundaries.

1. **Fast rerun:** re-execute any cell against the active target without copy-paste workflows or page-local editors.
2. **Structured visibility:** surface success values, intentional output, and execution errors inline in the notebook with a shared result contract.
3. **Safe experimentation:** keep forward and rollback cells adjacent so destructive experiments are reversible inside the same notebook flow.
4. **Coexistence by design:** preserve compatibility with browser developer tools instead of treating them as a competing attachment.
5. **Profile-ready architecture:** keep target matching, readiness checks, and runtime helpers profile-owned so Foundry is the first profile, not the whole platform definition.

### Project Classification

| Dimension       | Value                                                  |
| --------------- | ------------------------------------------------------ |
| Project Type    | Developer Tool (VS Code extension)                     |
| Domain          | Browser execution kernel validated through Foundry VTT |
| Complexity      | Medium                                                 |
| Project Context | Greenfield                                             |
| MVP Scope       | One shipped profile: Foundry VTT                       |

## Success Criteria

### Core Platform User Success

- A user can open a `.ipynb` notebook in VS Code, connect to a live browser target, run a JavaScript cell, and see a structured result inline.
- A user can rerun modified cells repeatedly against the same browser session without rebuilding context between runs.
- Syntax and runtime failures always appear as explicit notebook output with message, stack, and source location when available.
- Manual reconnect restores a usable execution session after target reload or disconnect.
- Intentional execution output is distinguishable from unrelated browser console noise.

### Foundry Profile User Success

- A Foundry power user can connect to a live world, execute notebook cells against it, and avoid the Foundry macro editor during iteration.
- The write, run, inspect loop feels materially faster than the standard Foundry macro workflow.
- A user can keep forward-operation and rollback cells side by side to make risky world mutations reversible.
- Foundry-specific readiness state is explicit enough that one person can diagnose setup problems without deep CDP archaeology.

### Business Success

- The extension supports reliable personal daily use for Foundry-driven notebook iteration.
- The planning artifacts support future profile expansion without requiring a second product-boundary rewrite.
- If published later, the extension is documented clearly enough that users understand what the platform core does and what the Foundry profile adds.

### Technical Success

- JavaScript notebook cell execution succeeds for synchronous and asynchronous browser-page code.
- The shared result contract normalizes success and failure outcomes independent of transport choice.
- Edge DevTools coexistence is preserved for the Foundry MVP profile.
- Core execution and normalization are verifiable against deterministic static HTML fixtures without requiring a live Foundry runtime.
- Foundry readiness checks implement the profile contract with explicit `missing`, `legacy`, `unsupported`, and `ok` states.

### Measurable Outcomes

- A JavaScript notebook cell executes against a live browser target and returns a structured result: pass or fail.
- Execution failures surface as notebook output with name, message, and stack: pass or fail.
- Edge DevTools coexistence remains intact during Foundry execution: pass or fail.
- Manual reconnect restores a usable session within a few seconds when the browser target is available: pass or fail.
- Headless static-fixture tests cover success, syntax-error, runtime-error, and serialization-edge-case paths for the core kernel: pass or fail.

## Product Scope & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Establish a reliable browser-backed notebook execution kernel and validate it through one delivered profile: Foundry VTT.

**Resource Requirements:** Solo developer with TypeScript, VS Code extension APIs, browser-execution transport knowledge, and Foundry macro familiarity.

**Core User Journeys Supported:**

- Primary success path: rapid notebook write-run-inspect loop.
- Primary edge path: safe experimentation with forward and rollback cells.
- Solo operations path: reconnect and readiness-state visibility.
- Platform path: preserve explicit boundaries so future profiles can reuse the kernel.

### MVP - Core Kernel Scope

1. Browser-session connection and lifecycle management for a live execution target.
2. Browser debugger coexistence as a first-class requirement.
3. JavaScript notebook execution for `.ipynb` cells, including async execution.
4. Shared result contract for normalized success and error handling with transport-boundary isolation.
5. Manual reconnect command and connection-state reporting.
6. Explicit transport boundary so one MVP transport can ship without defining the permanent platform transport.
7. Intentional execution-output capture, discrimination, and execution-history retention in notebook workflows.
8. Automated core-kernel validation against deterministic browser-test fixtures.

### MVP - Foundry Profile Scope

1. Foundry target matching rules for live game pages.
2. Thin companion Foundry module with runtime namespace and version metadata.
3. Foundry readiness classification: `missing`, `legacy`, `unsupported`, `ok`; notebook execution is blocked until readiness is `ok`.
4. Foundry macro iteration from notebook cells without using the Foundry macro editor.
5. Forward and rollback notebook-cell workflow for safe experimentation, including multi-version iteration.
6. Foundry-specific notebook example showing token-state read and one token update.
7. Companion-module output helpers (`$f.out()`, `$f.log()`) as the MVP emitter surface for core output capture (FR16).
8. Manual installation and quickstart guidance for VS Code plus the Foundry profile; in-app install or update guidance surfaced when readiness is not `ok`.

### Growth Features

**Phase 2 - Core Platform:**

- Better diagnostics and troubleshooting ergonomics.
- Configurable retry interval and timeout handling.
- Hardened transport abstraction after the transport spike selects a long-term direction.
- Stronger automated platform coverage for reconnect, serialization, and output tagging behavior.

**Phase 2 - Foundry Profile:**

- Variable watcher with shallow chaining UX.
- Guided diagnostics for common Foundry readiness failures.

**Phase 3 - Expansion:**

- Workspace-scoped action promotion and reuse flows.
- Pre-execution parameter substitution (`$prompt()`) for parameterized action inputs.
- Adapter onboarding guidance for future profiles.
- Public Marketplace hardening, packaging maturity, and onboarding polish.
- Additional browser-application profiles only after the core kernel and Foundry profile are stable.

### Vision (Future)

- A public VS Code browser-execution platform with one first-party Foundry profile and clear boundaries for later profiles.
- Reusable execution and diagnostics contracts that support additional browser applications without redefining the product.
- Profile-specific helper surfaces that remain thin and optional relative to the platform core.

### Risk Mitigation Strategy

**Core Platform Risks:**

- CDP coexistence and session-routing fragility.
  - Mitigation: browser-level session design plus deterministic fixture-based regression coverage.
- Transport lock-in before profile boundaries stabilize.
  - Mitigation: preserve transport as an explicit architecture decision and keep the kernel contract transport-agnostic.
- Error normalization drift across execution paths.
  - Mitigation: test the shared result contract against success, syntax, runtime, and serialization cases before live-profile expansion.

**Foundry Profile Risks:**

- Readiness-state confusion caused by missing or outdated companion module versions.
  - Mitigation: explicit state model plus targeted install/update guidance.
- Unsafe rapid experimentation in a mutable live world.
  - Mitigation: forward/rollback notebook patterns and example notebooks.

**Resource Risks:**

- Solo bandwidth can drive scope creep and premature multi-profile abstraction.
  - Mitigation: keep MVP delivered through one profile and generalize only at platform boundaries.

## User Journeys

The following journeys are validated through the Foundry VTT profile. They describe the MVP delivery path. The underlying execution loop, reconnect model, and result handling are platform concerns that later profiles can reuse.

### Journey 1: Primary Success Path - Rapid Macro Iteration

**Profile:** Foundry VTT  
**Persona:** Garmek, power-user GM, preparing a session and refining world automation.

**Opening scene:**
He has a macro idea that touches actor state and scene data. In Foundry's macro editor, the work would require repetitive paste-run-edit cycles with weak visibility into intermediate values.

**Rising action:**
He opens a `.ipynb` notebook in VS Code, connects to the active Foundry session, writes a JavaScript cell, runs it, inspects the result inline, edits one line, and reruns several times in minutes.

**Climax:**
The macro produces the intended world change and the expected value output appears immediately in the notebook, clearly distinguishable from unrelated browser console activity. He never has to switch back to the Foundry macro editor to continue iterating.

**Resolution:**
He keeps the working version in notebook cells and uses the notebook as durable execution history.

**Failure/recovery path:**
If evaluation throws, the error is visible in-cell with structured details, and he reruns immediately after editing.

### Journey 2: Primary Edge Path - Safe Experimentation and Reversal

**Profile:** Foundry VTT  
**Persona:** Same GM, now testing risky world mutations before game time.

**Opening scene:**
He needs to try a destructive or broad macro but is unsure about side effects.

**Rising action:**
He writes a forward-operation cell and, directly below it, a reversal cell that undoes the same operation. He executes forward, inspects output, and decides whether to keep or roll back.

**Climax:**
Unexpected behavior appears, but he can immediately run the rollback cell and restore state without leaving VS Code.

**Resolution:**
Risky experimentation becomes cheap enough to support aggressive iteration.

**Failure/recovery path:**
If rollback logic is incomplete, he inspects the affected values, patches the rollback cell, and reruns.

### Journey 3: Operations Path - Connection and Readiness Recovery

**Profile:** Foundry VTT  
**Persona:** Same GM acting as installer and operator of his own toolchain.

**Opening scene:**
Foundry reloads, the browser target changes, or the companion module version no longer matches expectations.

**Rising action:**
He runs reconnect, the extension re-establishes the session, and the Foundry profile reports readiness as `missing`, `legacy`, `unsupported`, or `ok`.

**Climax:**
Connection is restored and notebook execution resumes without restarting VS Code.

**Resolution:**
Operational overhead remains low enough for one user to maintain the workflow routinely.

**Failure/recovery path:**
If reconnect fails, diagnostics point first to the endpoint, target selection, or profile readiness state.

### Journey 4: Support Path - Diagnosing Unexpected Behavior

**Profile:** Foundry VTT  
**Persona:** Same GM acting as his own support engineer.

**Opening scene:**
A macro runs, but the world state does not match his expectation.

**Rising action:**
He reruns narrow cells, uses intentional output capture to surface intermediate values, and isolates the failing assumption while Edge DevTools remains available for deeper browser debugging.

**Climax:**
He identifies the mismatch between expected and actual state, such as permission checks, stale references, or object-path assumptions.

**Resolution:**
He patches the macro and validates the fix in the same notebook sequence.

**Failure/recovery path:**
If the issue grows more complex, he adds smaller cells and converges incrementally instead of rewriting the whole script.

### Journey 5: Platform Path - Reusing the Kernel for a Future Profile

**Persona:** A future developer extending the platform beyond Foundry.

**Opening scene:**
The kernel has already proven stable through the Foundry MVP profile. A second browser application becomes a candidate target.

**Rising action:**
The developer defines profile-owned target matching, readiness checks, runtime helpers, and example notebooks while reusing the existing session, execution, reconnect, and result-normalization logic.

**Climax:**
Notebook cells execute against the new profile with the same result structure and failure behavior that Foundry uses.

**Resolution:**
The product expands by adding profile-specific boundaries instead of rewriting the platform core.

**Failure/recovery path:**
If the new profile cannot satisfy the shared readiness or result contract, the issue is treated as a platform-boundary decision rather than patched with one-off profile logic.

### Journey Requirements Summary

These journeys imply concrete capability needs:

1. Fast, repeatable notebook cell execution against a live browser target.
2. Clear in-cell success and error rendering.
3. Minimal-friction rerun loops for micro-iterations.
4. Intentional execution-output capture and inline surfacing distinct from background browser noise.
5. Reliable reconnect and explicit profile readiness reporting.
6. Coexistence with browser developer tools.
7. Support for forward/rollback scripting patterns in the Foundry profile.
8. Deterministic result handling independent of transport choice.
9. Platform boundaries that allow future profiles to reuse the kernel.

## Domain-Specific Requirements

### Compliance and Regulatory

- No formal regulated-domain compliance target applies to the MVP.
- If Marketplace distribution happens later, the extension should follow VS Code packaging and security expectations, including clear disclosure of platform behavior and profile-specific capabilities.

### Technical Constraints

- JavaScript is the only runtime language supported in v1.
- Browser debugger coexistence is a non-negotiable platform constraint.
- CDP multiplexing is the current leading technical path for coexistence, but transport remains an explicit architecture decision rather than a permanent product assumption.
- Manual reconnect is acceptable for MVP; automatic reconnect is deferred.
- Serialization limits require shallow result inspection and explicit drill-down patterns rather than deep object mirroring.

### Integration Requirements

**Core Platform Integration:**

- Must integrate with VS Code notebook workflows.
- Must connect to a live browser execution target through a user-controlled transport.
- Must normalize execution results into a shared contract independent of the transport implementation.

**Foundry Profile Integration:**

- Must identify active Foundry game pages as valid execution targets.
- Must interoperate with a thin Foundry companion module for runtime namespace and version checks.
- Must preserve Foundry-specific guidance and examples without making them platform assumptions.

### Trust and Security Model

- The MVP assumes one user controls both VS Code and the Foundry browser session.
- The platform core should not assume that all future profiles share the Foundry trust model.
- Each future profile must document its own readiness, permissions, and runtime helper assumptions.

### Risk Mitigations

- Risk: transport changes invalidate the execution model.
  - Mitigation: keep transport separate from the notebook execution and result contracts.
- Risk: a future profile hardcodes target logic into the platform core.
  - Mitigation: keep target matching and readiness profile-owned.
- Risk: Foundry-specific expectations leak into general platform language.
  - Mitigation: isolate profile-specific terminology and examples to Foundry sections.

## Project-Type Requirements

### Project-Type Overview

This product is a VS Code-only developer tool. Its core job is deterministic JavaScript notebook execution against a live browser target. Foundry is the first delivered profile and the first user-validation environment.

### Technical Architecture Considerations

- The platform core owns session orchestration, notebook execution, reconnect behavior, and result normalization.
- A profile owns target matching, readiness checks, runtime helpers, and profile-specific diagnostics.
- Transport is a replaceable architecture layer. The product can ship one transport in MVP without freezing the long-term transport decision.
- Feature design should optimize for VS Code notebook workflows and avoid premature abstraction for non-MVP IDEs.

### Language and Runtime Scope

- Supported runtime language: JavaScript only.
- Non-goals for MVP:
  - TypeScript runtime transpilation
  - Multi-language notebook kernels
  - Alternate script runtimes

### Installation and Distribution Model

- Installation model for MVP: manual installation only.
- Marketplace publishing is out of scope for MVP.
- Documentation should assume a personal-use installation path for the Foundry profile.
- Install guidance depth for MVP is a minimal quickstart, not a polished onboarding system.

### IDE Integration Boundaries

- Hard boundary: VS Code only.
- No support commitments for JetBrains IDEs, Neovim, or other editors in MVP.
- The extension depends on notebook workflows rather than a cross-editor abstraction layer.

### Documentation and Example Requirements

- Minimum documentation for MVP:
  - One Foundry notebook example demonstrating token-state read and token update
  - One architecture explanation distinguishing platform core from Foundry profile responsibilities
  - One quickstart path for manual installation and reconnect troubleshooting

### Adapter Implementation Constraints

- Foundry-specific concepts such as tokens, actors, and companion-module readiness states must not appear as platform-level requirements unless they are explicitly marked as profile behavior.
- Future profiles should extend the platform by supplying profile boundaries, not by rewriting core session or notebook logic.
- Profiles should stay thin. Profile-specific runtime helpers are optional convenience layers, not platform prerequisites outside that profile.

### Implementation Considerations

- Keep interfaces explicit and small.
- Favor predictable behavior and actionable failure messages over breadth.
- Generalize at contracts and boundaries, not through speculative multi-profile frameworks.

## Functional Requirements

Traceability highlights: FR1 through FR18 cover the platform execution contract used by all journeys; FR19 through FR36 cover the Foundry MVP profile and its deferred extensions.

### Core Platform Requirements

#### Connection and Session Control

- FR1: A user can configure the connection endpoint used by the extension.
- FR2: A user can initiate a connection from VS Code to a live browser execution target.
- FR3: The extension can identify and select a valid execution target according to the active profile's matching rules.
- FR4: The extension can report current connection state to the user using defined platform states: `disconnected`, `connecting`, `connected`, and `error`.
- FR5: A user can manually reconnect the extension after disconnection or target reload.
- FR6: A user can disconnect the active execution session from VS Code.
- FR7: The extension can preserve coexistence with active browser developer tools connected to the same target.

#### Notebook Execution

- FR8: A user can run JavaScript notebook cells against the active browser target from VS Code.
- FR9: The extension can execute asynchronous JavaScript cell logic and return resolved outcomes.
- FR10: The extension can return successful execution values to notebook output.
- FR11: The extension can surface syntax and runtime errors as notebook output with message, stack, and source location when available.
- FR12: A user can rerun modified cells repeatedly in the same notebook workflow.
- FR13: The extension can support execution isolation per cell while allowing explicit shared-runtime patterns when the user chooses them.

#### Result Normalization and Output Contract

- FR14: The extension can normalize success and failure outcomes across supported transports and profiles through a shared result contract while preserving transport-boundary isolation from notebook execution semantics.
- FR15: A user can inspect execution results inline in the notebook after each run.
- FR16: The extension can capture output generated during cell execution and surface it as notebook output, distinguishable from unrelated browser console activity.
- FR17: The extension can preserve session-scoped execution history so a user can compare the result of each cell revision within a working session.

#### Platform Testing and Validation

- FR18: A developer can verify the notebook execution pipeline and shared result contract against deterministic browser-test fixtures without any profile-specific runtime.

### Foundry Profile Requirements

#### Foundry Target and Readiness

- FR19: The Foundry profile can identify valid execution targets whose URL contains `/game`.
- FR20: The Foundry profile can detect whether the companion runtime helper is present.
- FR21: The Foundry profile can read and compare companion module version metadata.
- FR22: The Foundry profile can classify readiness state as `missing`, `legacy`, `unsupported`, or `ok`.
- FR23: The Foundry profile can present install or update guidance when readiness is not `ok`.
- FR24: A user can proceed with Foundry execution when readiness is `ok`.

#### Foundry Notebook Workflow

- FR25: A Foundry power user can execute macro logic from notebook cells without using the Foundry macro editor during iteration.
- FR26: A Foundry power user can maintain forward-operation and reversal-operation cells in the same notebook.
- FR27: A Foundry power user can execute reversal cells to restore state after experiments.
- FR28: A Foundry power user can iterate through at least two successive macro versions in a single notebook session.
- FR29: The extension can provide a Foundry starter notebook demonstrating token-state read and token-value update.
- FR30: A Foundry power user can install and use the extension through a manual VS Code workflow without requiring Marketplace distribution.

#### Foundry Output and Observation

- FR31: The Foundry profile can expose intentional script output through profile-owned runtime helpers such as `$f.out()` and `$f.log()`.
- FR32 [Post-MVP]: A Foundry power user can define watched expressions and refresh them manually or after execution events.
- FR33 [Post-MVP]: A Foundry power user can configure shallow projections and reference drill-down for watched values.
- FR34 [Post-MVP]: A Foundry power user can continue refreshing other watched values when one watcher evaluation fails.

#### Foundry Action Reuse

- FR35 [Post-MVP]: A Foundry power user can save a notebook cell as a reusable action.
- FR36 [Post-MVP]: A Foundry power user can reopen or execute a saved action, including prompted inputs when required.

- FR37 [Post-MVP]: A user can define `$prompt()` substitution placeholders in a notebook cell so that execution pauses and requests a value for each placeholder before running.

## Non-Functional Requirements

### Core Platform Performance

- NFR1: Notebook execution feedback must render within 2 seconds for synchronous JavaScript cells, measured as elapsed time from run command to notebook output render using a deterministic test cell under normal local development conditions.
- NFR2: Manual reconnect must report success or failure within 5 seconds when the target browser and page are available, measured as elapsed time from reconnect command invocation to final connection state.
- NFR3: Intentional output or watched-value refresh behavior, when enabled, must render within 2 seconds, measured as elapsed time from execution completion to output render under the same baseline conditions as NFR1.

### Core Platform Reliability

- NFR4: Manual reconnect must restore execution capability within 5 seconds after target reload when the target is reachable, measured by successful reconnection state and one successful JavaScript cell execution without restarting VS Code.
- NFR5: Runtime and syntax failures must always surface as explicit notebook outputs; silent failure is not acceptable, measured by regression tests exercising all error paths including syntax errors, runtime exceptions, and evaluation timeouts.
- NFR6: The shared result contract must preserve identical success and failure classification across supported transports for equivalent test cases, measured by deterministic regression fixtures that cover success, syntax error, runtime error, and serialization-edge cases with 100% classification parity.

### Core Platform Integration and Contracts

- NFR7: The platform core must remain adapter-agnostic; it does not hardcode Foundry-specific target matching rules.
- NFR8: The extension must coexist with Edge DevTools without forced disconnect behavior, measured by sustained active session state and successful notebook execution after DevTools attaches to the same target.
- NFR9: Each profile must implement a readiness contract that returns a defined state set and blocks execution when readiness is not `ok`, measured by integration tests that verify state classification, execution gating behavior, and deterministic outcomes.

### Foundry Profile Integration and Contracts

- NFR10: The Foundry profile attaches only to targets whose URL contains `/game`.
- NFR11: The Foundry readiness check must complete within a configurable timeout and return one of `missing`, `legacy`, `unsupported`, or `ok`, with default timeout 5 seconds and configurable bounds of 1 to 30 seconds, measured from check start to state result.

### Core Platform Testing and Validation

- NFR12: Core execution and result normalization must be validated through deterministic automated tests that require 100% pass rate for success paths, syntax errors, runtime errors, and serialization-boundary cases without requiring a live profile runtime.
- NFR13: Automated platform tests must cover success paths, syntax errors, runtime errors, reconnect state transitions, and serialization boundaries including circular references, null or undefined values, and large payload handling, measured by test-suite coverage audit confirming each listed path has at least one exercising test case.
- NFR14: Any future profile must pass fixture-based target-matching and readiness-contract tests before live-environment integration testing begins.

### Security and Diagnostics

- NFR15: The extension must connect only to explicitly user-configured endpoints and must not initiate other outbound endpoint connections, measured by connection-policy tests and traffic inspection during normal workflows.
- NFR16: The extension must not persist sensitive runtime secrets from evaluated cells unless explicitly saved by user action, measured by file-system audit and settings-state verification after execution sessions.
- NFR17: User-facing diagnostics must include actionable root-cause category and next-step guidance while excluding sensitive environment details such as tokens, credentials, and private paths, measured by diagnostic-message review against a defined redaction checklist.

### Deferred Quality Improvements

- Visual syntax error underlining in notebook cells remains deferred until the core execution and diagnostics loop is stable.
- A browser-extension bridge transport remains a candidate future architecture path, but evaluating it is separate from MVP delivery.

## Requirements Traceability Map

This table maps each user journey to the scope items, functional requirements, and non-functional requirements it exercises. Use this as the primary cross-reference for epic and story decomposition.

| Journey                               | Scope Items                     | FRs                             | NFRs                               |
| ------------------------------------- | ------------------------------- | ------------------------------- | ---------------------------------- |
| J1: Rapid Macro Iteration             | Core 1–4, 6–7; Foundry 1–4, 6–7 | FR1–FR17, FR19–FR25, FR29, FR31 | NFR1, NFR3, NFR5–6, NFR8, NFR10–11 |
| J2: Safe Experimentation and Reversal | Core 3–4; Foundry 5             | FR8–FR17, FR25–FR28             | NFR1, NFR5–6                       |
| J3: Connection and Readiness Recovery | Core 1–2, 4–5; Foundry 1–3, 7   | FR1–FR7, FR19–FR24, FR30        | NFR2, NFR4, NFR8–11                |
| J4: Diagnosing Unexpected Behavior    | Core 2, 4, 7; Foundry 7         | FR14–FR18, FR31                 | NFR5–6, NFR8, NFR15–17             |
| J5: Platform Path — Future Profile    | Core 1–8                        | FR1–FR18                        | NFR6–7, NFR9, NFR12–14             |

## Glossary

- **Profile:** A configuration boundary that defines target-matching rules, readiness checks, runtime helpers, and examples for a specific browser application. Foundry VTT is the MVP profile.
- **Transport:** The communication layer between the extension and the browser target. CDP over browser-level WebSocket is the MVP transport; the architecture preserves replaceability.
- **Shared result contract:** The normalized data structure that represents success and failure outcomes from cell execution, independent of transport or profile. Ensures consistent behavior across all execution paths.
- **Execution history retention:** Session-scoped storage of cell execution results so earlier outputs remain available for comparison as cells are revised and rerun.
- **Transport-boundary isolation:** The architectural property that notebook execution semantics do not depend on transport internals. The result contract mediates between transport and notebook concerns.
- **Readiness state:** A profile-owned classification of whether the execution target meets the profile's prerequisites. Foundry uses `missing`, `legacy`, `unsupported`, and `ok`.
- **Connection state:** A platform-level classification of the session lifecycle: `disconnected`, `connecting`, `connected`, or `error`.

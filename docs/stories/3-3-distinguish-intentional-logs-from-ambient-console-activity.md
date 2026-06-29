---
storyId: "3.3"
storyKey: "3-3-distinguish-intentional-logs-from-ambient-console-activity"
title: "Distinguish Intentional Logs from Ambient Console Activity"
status: "ready-for-dev"
created: "2026-06-29"
epic: "3"
priority: "p1"
---

# Story 3.3: Distinguish Intentional Logs from Ambient Console Activity

**Status:** ready-for-dev

## Story

As a developer,
I want intentional log output to be clearly distinct from unrelated browser console noise,
So that I can focus on what my cell emitted without filtering ambient activity.

## Acceptance Criteria

### AC 1: Intentional Logs Carry JBK Prefix and Ambient Console Is Not Co-Rendered

**Given** intentional log entries in cell output  
**When** they are rendered  
**Then** each line carries the JBK identity prefix for filtering and searchability  
**And** ambient `console.log` activity from the page is not co-rendered in cell output.

### AC 2: Output Channel Filtering Works Reliably for Intentional Output

**Given** intentional output is also mirrored to the output channel  
**When** a user filters the output channel  
**Then** the JBK prefix enables reliable filtering of intentional output from ambient noise  
**And** the prefix format is consistent across all intentional output types.

### AC 3: Reconnect Preserves Intentional vs Ambient Separation

**Given** a session reconnect within the same working session  
**When** subsequent cells run and emit logs  
**Then** the intentional/ambient distinction is preserved  
**And** no ambient console backlog is injected into intentional cell output on reconnect.

## Tasks / Subtasks

### 1. Standardize Intentional Output Identity Prefix (AC: 1, 2)

- [ ] Define one canonical intentional-output prefix format and keep it profile-agnostic (`JBK`-anchored, stable, testable).
- [ ] Ensure intentional log lines rendered in notebook output are prefixed per-entry, not only section-labeled.
- [ ] Keep label text localized and user-facing strings routed through existing localization pathways.

### 2. Mirror Intentional Output to the VS Code Output Channel (AC: 2)

- [ ] Add a kernel-owned or kernel-invoked intentional-output mirror path that writes intentional entries to the existing extension output channel.
- [ ] Ensure mirror writes happen only for helper-driven intentional entries, never for ambient page console traffic.
- [ ] Keep output-channel line format deterministic so user filtering by `JBK` remains reliable.

### 3. Preserve Ambient Console Exclusion Boundaries (AC: 1, 3)

- [ ] Do not subscribe to or replay browser-wide `console.*` event streams for this story.
- [ ] Keep intentional capture source-of-truth restricted to the runtime bridge teardown payload.
- [ ] Preserve no-log path behavior (no extra intentional log output blocks or mirror lines).

### 4. Preserve Reconnect Behavior and Avoid Backlog Replay (AC: 3)

- [ ] Verify reconnect lifecycle does not retain stale bridge state from earlier runs.
- [ ] Ensure post-reconnect intentional logs only include entries produced during the current run.
- [ ] Keep cancellation and teardown ordering intact to avoid leaked logs across runs.

### 5. Update and Extend Tests (AC: 1, 2, 3)

- [ ] Extend unit coverage in `tests/unit/kernel/execution-kernel.test.ts` for prefixed notebook log lines and output-channel mirror behavior.
- [ ] Add or extend tests validating prefix consistency across intentional output types.
- [ ] Add reconnect-focused integration assertions in `tests/integration/kernel/fast-rerun.integration.test.ts` (or nearest integration file) to prove no ambient/backlog leakage after reconnect-style flows.
- [ ] Keep existing Story 3.1 and 3.2 invariants passing.

### 6. Validation Run (AC: 1, 2, 3)

- [ ] Run `npm run compile`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run test:unit`.
- [ ] Run `npm run test:integration`.

## Dev Notes

### Epic Context and Business Intent

Epic 3 establishes intentional output as a first-class notebook workflow. Story 3.1 introduced helper-driven capture and Story 3.2 formalized rendering. Story 3.3 completes discrimination and observability by introducing identity-prefixed intentional lines and reliable output-channel filtering while explicitly excluding ambient browser console noise.

### Current State (Read-First Summary)

- `src/kernel/execution-kernel.ts` currently:
  - initializes and tears down per-run runtime bridge state,
  - appends intentional log output as a separate notebook output block,
  - does not yet apply per-line `JBK` identity prefix,
  - does not currently mirror intentional log entries to the extension output channel.
- `src/kernel/runtilme-cell-bridge.ts` currently:
  - captures helper-driven entries (`$cell.log`) in-memory per run,
  - returns only string arrays at teardown,
  - has no ambient `console.*` subscription behavior.
- `src/kernel/execution-messages.ts` currently:
  - supplies localized labels and failure messages,
  - includes section label `Intentional logs:` but no explicit identity prefix helper.
- `src/extension.ts` and `src/logging/*` currently:
  - own the extension output channel instance and transport/error logging,
  - provide an existing pattern for timestamped output-channel lines,
  - do not yet receive dedicated intentional-output mirror calls from kernel execution.

### What This Story Changes

- Add canonical `JBK` identity prefixing to intentional log entries rendered in notebook output.
- Add intentional-output mirror lines to the existing output channel with deterministic prefix format.
- Keep intentional capture bounded to runtime helper output only; do not co-render ambient console output.

### What Must Be Preserved (Non-Negotiable)

- Story 2.x normalized success/failure result contract and infrastructure-failure handling.
- Story 3.1 per-run bridge lifecycle and no-cross-run leakage.
- Story 3.2 output ordering semantics:
  - success/error output first,
  - intentional log block after,
  - log ordering preserved.
- Existing cancellation semantics and teardown-on-cancellation behavior.
- Localization requirements for user-facing text.

### Architecture Compliance Guardrails

- Keep boundary ownership intact:
  - kernel orchestrates execution and normalized output,
  - transport remains protocol boundary,
  - notebook/UI surfaces consume normalized kernel outputs.
- Do not introduce cross-layer imports that bypass existing interfaces.
- Do not leak raw protocol/transport shapes into notebook output payloads.
- Preserve deterministic, typed behavior under TypeScript strict mode.

### File-Level Requirements

- `src/kernel/execution-kernel.ts`
  - Add per-entry intentional-prefix formatting for notebook output.
  - Add intentional-output mirror hook integration for output channel.
  - Preserve execution ordering, cancellation, and failure-path behavior.

- `src/kernel/execution-messages.ts`
  - Add localized helper(s) for intentional prefix/labels if required.
  - Keep message wording profile-agnostic.

- `src/kernel/runtilme-cell-bridge.ts`
  - Preserve helper-driven capture contract.
  - Do not broaden to ambient console capture.

- `src/extension.ts` and/or `src/logging/*`
  - Wire output-channel mirror dependency into kernel runtime path with minimal coupling.
  - Reuse existing output-channel pattern conventions rather than creating a second output channel.

- `tests/unit/kernel/execution-kernel.test.ts`
  - Add assertions for prefixed intentional output in notebook rendering.
  - Add assertions for deterministic mirror line format to output channel.

- `tests/integration/kernel/fast-rerun.integration.test.ts`
  - Assert no stale/backlog logs are replayed across rerun/reconnect-like flows.

### Testing Requirements

- Include regression tests for:
  - intentional log line prefix format,
  - notebook output ordering with prefixed logs,
  - output-channel mirror formatting,
  - no-log path behavior,
  - failure plus intentional logs,
  - reconnect/rerun no-backlog behavior.
- Keep all prior story tests green.

### Previous Story Intelligence (3.2)

- Story 3.2 locked output sequencing and failure preservation; this must remain unchanged.
- Story 3.2 explicitly deferred ambient/intentional discrimination details to Story 3.3.
- Story 3.2 context reinforced deterministic behavior and no broad ambient capture.

### Previous Story Intelligence (3.1)

- Runtime helper capture is intentional and per-run; do not create alternate capture channels.
- Bridge availability is intentionally isolated-mode safe; preserve this design choice.
- Deterministic string coercion is already established in bridge code and tests.

### Git Intelligence Summary

Recent relevant commits indicate this pattern:

- Story lifecycle commits often update story docs and sprint status first (`Add story`, `Close story`).
- Core kernel behavior changes are covered by explicit unit and integration tests before story closure.
- Prior review feedback emphasized preserving cell-isolation behavior and avoiding regressions in `execution-kernel.ts`.

Actionable guidance for 3.3:

- Keep isolation behavior unchanged unless explicitly required by AC.
- Add test-first assertions around new intentional prefix and mirror behavior.
- Avoid broad refactors unrelated to intentional-log discrimination.

### Latest Technical Information

Current toolchain and latest versions (checked 2026-06-29):

- `chrome-remote-interface`: project `^0.34.0`, latest `0.34.0` (current).
- `@vscode/debugadapter`: project `^1.68.0`, latest `1.68.0` (current).
- `@vscode/debugprotocol`: project `^1.68.0`, latest `1.68.0` (current).
- `@types/vscode`: project `^1.92.0`, latest `1.125.0` (newer; defer upgrade out of story scope).
- `typescript`: project `^5.3.3`, latest `6.0.3` (major; defer upgrade out of story scope).
- `esbuild`: project `^0.20.0`, latest `0.28.1` (newer; defer upgrade out of story scope).
- `ws`: project `^8.17.1`, latest `8.21.0` (patch/minor drift; defer unless required).

Guidance: implement Story 3.3 on current pinned stack; do not bundle dependency upgrades into this feature story.

### Project Context Reference

- Persistent fact pattern requested `**/project-context.md`; no project-context file was discovered in current workspace.
- Canonical planning references used: `docs/prd.md`, `docs/architecture.md`, Epic 3 doc, UX spec shards, and prior stories 3.1/3.2.

### References

- [Source: docs/epics/epic-3-capture-intentional-logs.md#story-33-distinguish-intentional-logs-from-ambient-console-activity]
- [Source: docs/stories/3-2-route-captured-logs-to-notebook-cell-output.md]
- [Source: docs/stories/3-1-define-intentional-log-capture-runtime-helper.md]
- [Source: docs/prd.md#functional-requirements]
- [Source: docs/prd.md#non-functional-requirements]
- [Source: docs/architecture.md#core-architectural-decisions]
- [Source: docs/architecture.md#implementation-patterns--consistency-rules]
- [Source: docs/ux-spec/08-design-direction-decision.md]
- [Source: docs/ux-spec/10-component-strategy.md]
- [Source: docs/ux-spec/11-ux-consistency-patterns.md]
- [Source: .github/copilot-instructions.md]

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Story context created via bmad-create-story workflow on 2026-06-29.
- Source analysis included sprint status, Epic 3, PRD, architecture, UX specs, prior stories, kernel source, and recent git history.

### Completion Notes List

- Comprehensive context generated with architecture, UX, and regression guardrails.
- Previous-story and git-pattern intelligence incorporated.
- Version snapshot validated for implementation safety.
- Story status set to `ready-for-dev`.

### File List

- docs/stories/3-3-distinguish-intentional-logs-from-ambient-console-activity.md
- docs/stories/sprint-status.yaml

## Story Completion Status

Ultimate context engine analysis completed - comprehensive developer guide created.

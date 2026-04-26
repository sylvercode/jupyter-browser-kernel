---
storyId: "spike-2.5"
storyKey: "2-spike-cdp-sourceurl-debugger"
title: "Spike: CDP `//# sourceURL`, line preservation, and Debugger-domain coexistence"
status: "review"
created: "2026-04-19"
epic: "2"
priority: "p0"
type: "spike"
timebox: "2 days"
---

# Spike 2.x: CDP `//# sourceURL`, Line Preservation, and Debugger-Domain Coexistence

**Status:** review

## Spike

As the team preparing Stories 2.4 and 2.5,
We need empirical answers to six CDP/V8 behavior questions that public documentation does not settle,
So that we can lock the per-cell `sourceURL` scheme, the wrapper-vs-source-map decision, the evaluation path (`replMode` vs async-IIFE vs `compileScript`/`runScript`), and the `Debugger`-domain coexistence posture **before** writing production code for Story 2.5.

This is a **time-boxed research spike**, not a feature. The deliverable is a findings document plus a reproducible harness under `spike/`, mirroring [spike/cdp-multiplex-findings.md](../../spike/cdp-multiplex-findings.md) and [spike/spike-cdp-multiplex.js](../../spike/spike-cdp-multiplex.js). **No production code under `src/` is shipped from this spike.**

## Goals

Resolve all six Critical Documentation Gaps recorded in [docs/archives/technical-cdp-sourceurl-debugger-research-2026-04-19.md](../archives/technical-cdp-sourceurl-debugger-research-2026-04-19.md):

- **Q1** — Does `Runtime.evaluate { replMode: true }` produce a script visible in DevTools' Sources panel under our `//# sourceURL`, such that a breakpoint set there by the user binds and fires?
- **Q2** — Do user-set DevTools breakpoints fire during scripts evaluated by **our** `Runtime.evaluate` call when **our** session has _not_ called `Debugger.enable`? (highest-leverage question — answer can simplify or eliminate Story 2.5 AC #1)
- **Q3** — Only relevant if Q2 is "no": does multi-client `Debugger.enable` alongside Edge DevTools destabilize either client (lost breakpoints, ghost pause events, UI desync)?
- **Q4** — When the user has placed a breakpoint in DevTools _before_ a cell is first run, does it bind on the first `Runtime.evaluate`?
- **Q5** — With same-line wrapper concatenation (`(async()=>{` prefix and `})()` suffix on the same lines as the user's first/last line), do `Debugger.paused` `location.lineNumber` values match the user-visible cell-editor line?
- **Q6** — Does DevTools (and the underlying V8 / `Debugger.paused` event stream) honor an inline `//# sourceMappingURL=data:application/json;base64,...` directive on a script delivered via `Runtime.evaluate`? Specifically: (a) does the Sources panel display the _original_ (mapped) source, (b) do `Debugger.paused` line numbers report the _original_ line numbers, and (c) does a user-set breakpoint in the mapped view bind and fire on rerun?

## Acceptance Criteria

### AC 1: Reproducible Harness Exists

**Given** a developer with a Chromium-based browser launched with `--remote-debugging-port=9222`
**When** they run `node spike/spike-cdp-sourceurl-debugger.js`
**Then** the harness connects via the browser-level WebSocket using flat-session attach (the pattern proven in [spike/cdp-multiplex-findings.md](../../spike/cdp-multiplex-findings.md))
**And** it executes scripted Q1–Q6 probes against the target without requiring Foundry to be loaded (`about:blank` is sufficient).

### AC 2: Both Run Modes Supported

**Given** the harness
**When** invoked with default options
**Then** it runs in **headless integration-test mode** — a second CRI client inside the harness plays the "DevTools surrogate" role (calls `Debugger.enable` + `Debugger.setBreakpointByUrl`, observes `Debugger.paused`), making Q2/Q3/Q4/Q5 and the CDP-event parts of Q1/Q6 fully automated assertions.
**And given** the harness invoked with `INTERACTIVE=1`
**When** the operator opens DevTools (F12) on the test page
**Then** the harness pauses at each visual checkpoint and prompts the operator to record observations for the Sources-panel UI questions (Q1 panel visibility, Q6 mapped-source display, URL-scheme presentation in the Sources tree).

### AC 3: All Six Questions Have Recorded Answers

**Given** the spike has been executed
**When** the findings document is written
**Then** it contains a section per question (Q1–Q6) with: the exact procedure run, the observed CDP events / DevTools UI state, the answer (yes/no/conditional), the supporting evidence (event payloads, screenshots, or operator notes), and the architectural decision unlocked by that answer.

### AC 4: Architectural Decisions Are Locked

**Given** the answered questions
**When** the findings document concludes
**Then** it explicitly records:

- The chosen evaluation path: `Runtime.evaluate { replMode: true }` retained, OR `Runtime.evaluate` + async-IIFE (no `replMode`), OR `Runtime.compileScript` + `Runtime.runScript`.
- The chosen `Debugger`-domain posture: **Passive Provider** (extension never calls `Debugger.enable`), **Diagnostic Observer** (enables for read-only events), or **Active Debugger Client**.
- The chosen wrapper strategy: **same-line concatenation (Pattern B)**, or **multi-line wrapper + inline source map (Pattern B-alt)**.
- A go/no-go statement for Story 2.5 AC #1 (`Debugger.enable` on the per-target session) — confirmed-as-written, revised, or removed.
- A go/no-go statement for the candidate per-cell URL scheme (`notebook-cell:<encoded-uri>/<index>` vs `vscode-notebook-cell://...` vs an `https://`-shaped variant), based on which scheme best preserves notebook-resource identity and can be matched to the debugger resource URI used for notebook breakpoints. Sources-tree rendering is secondary evidence only.

### AC 5: Story 2.5 Inputs Are Updated

**Given** the locked architectural decisions
**When** the spike concludes
**Then** any decision that revises Story 2.5's acceptance criteria is captured as a delta to be applied when 2.5 is created (recorded in the findings doc's "Story 2.5 AC adjustments" section)
**And** Story 2.4 is reviewed against the locked wrapper strategy (Story 2.4 may be sequenced and implemented in parallel with this spike since it is independently shippable per the research's Implementation Order, but its wrapper builder must use the strategy locked here).

### AC 6: No Production Code Is Shipped

**Given** the spike work
**When** the PR is reviewed
**Then** changes are confined to `spike/` and (optionally) `package.json` / `package-lock.json` for the `source-map` dev dependency used by Q6
**And** no files under `src/` are modified
**And** the `source-map` dependency, if added, is pulled into `devDependencies` only — promotion to a runtime dependency is a separate decision after Q6 is answered.

### AC 7: CI Eligibility Is Documented

**Given** the harness's headless integration-test mode
**When** the findings document is written
**Then** it records which questions reduce to CDP-introspectable assertions (suitable for CI in a future story) and which require operator-verified DevTools UI inspection (must remain manual)
**And** it records any divergence observed between headless Chromium and interactive Edge for questions involving visual rendering.

## Tasks / Subtasks

### 1. Bootstrap the Harness Skeleton (AC: 1, 2)

- [x] Create `spike/spike-cdp-sourceurl-debugger.js`. Use `'use strict'` and CommonJS, matching [spike/spike-cdp-multiplex.js](../../spike/spike-cdp-multiplex.js) precedent.
- [x] Reuse the connection pattern from the existing multiplex spike: fetch `/json/version`, connect to `webSocketDebuggerUrl` with `CDP({ target, local: true })`, list page targets with `Target.getTargets`, attach with `Target.attachToTarget({ targetId, flatten: true })`.
- [x] Pick a target deterministically: prefer `about:blank`. If none exists, attach to the first `type === "page"` target. Document that Foundry is NOT required.
- [x] Add an environment-variable surface mirroring the existing spike: `CDP_HOST`, `CDP_PORT`, `EXTERNAL_BROWSER`, plus new `INTERACTIVE` (default off) and `KEEP_OPEN` (pause on completion so operator can keep inspecting DevTools).
- [x] Add a `sendInSession(client, method, params, sessionId)` helper identical in shape to the multiplex spike's helper — domain-shorthand cannot carry `sessionId`, only raw `client.send()` can.

### 2. Define a Stable Test sourceURL and the Cell Builder Used in the Harness (AC: 1)

- [x] Inside the harness, define a small utility `buildCellSource({ notebookUri, cellIndex, userCode, mode })` where `mode` is one of `"plain"` (no wrapper, replMode-eligible), `"async-iife-sameline"` (Pattern B), `"async-iife-multiline-sourcemap"` (Pattern B-alt for Q6).
- [x] Use `notebook-cell:<encoded-uri>/<cellIndex>` as the initial candidate URL scheme. Also implement an alternate-scheme runner that swaps in `vscode-notebook-cell://...` and `https://spike.local/cell/<index>` so Q5/Q6 can compare visual rendering across schemes. Final production identity is now locked to the exact VS Code `vscode-notebook-cell://...#...` cell URI form observed from notebook breakpoints.
- [x] **Important:** this harness builder is throwaway and lives only in `spike/`. Do NOT extract it into `src/` — that is Story 2.4's job, informed by the locked decisions from this spike.

### 3. Q1 — `replMode` + Sources visibility + breakpoint binding (AC: 3)

- [x] **Procedure (headless mode):**
  - Open the "DevTools surrogate" CRI session: `Debugger.enable`, then `Debugger.setBreakpointByUrl({ url, lineNumber })` for the test cell's stable URL on a known line containing `debugger;` or a side-effect statement.
  - From the "extension surrogate" session, call `Runtime.evaluate({ expression: buildCellSource(..., mode: "plain"), replMode: true, awaitPromise: true, returnByValue: true })`.
  - Subscribe to `Debugger.paused.<surrogateSessionId>` on the surrogate; assert it fires for the test URL at the expected line.
  - Capture and log the `Debugger.scriptParsed` payload: `url`, `scriptId`, `startLine`, `endLine`, `hasSourceURL`.
- [ ] **Procedure (interactive mode):** prompt operator to open DevTools on the target page, navigate to Sources, locate the cell URL in the tree, and confirm visibility. Operator types `y`/`n` to record. _(deferred — requires Windows host with Edge; harness has the prompt wired but no operator was available in this dev container)_
- [x] **Pass criterion:** script appears in Sources under our `sourceURL`; surrogate-set breakpoint fires on rerun.
- [x] **Decision locked:** if pass → `replMode` is viable as default evaluation path. If fail → fall back to `Runtime.evaluate` + async-IIFE (no `replMode`) for Story 2.5 implementation.

### 4. Q2 — Cross-client breakpoint firing without our `Debugger.enable` (AC: 3, 4)

- [x] **Procedure:**
  - DevTools surrogate session calls `Debugger.enable` and sets breakpoint by URL.
  - Extension surrogate session does **NOT** call `Debugger.enable`.
  - Extension surrogate calls `Runtime.evaluate(...)` with the breakpointed cell.
  - Assert surrogate-DevTools session receives `Debugger.paused` with the expected URL/line.
- [x] **Pass criterion:** surrogate-DevTools breakpoint fires even though extension surrogate never enabled Debugger.
- [x] **Decision locked:** if pass → lock Debugger Posture to **Passive Provider**, mark Story 2.5 AC #1 for revision (likely removal). If fail → escalate to Q3.

### 5. Q3 — Multi-client `Debugger.enable` coexistence (AC: 3, 4) — only if Q2 fails

- [x] **Procedure (skip if Q2 passed):** Q2 passed, so Q3 was run for informational completeness rather than as a blocker. Headless harness drove both sessions through `Debugger.enable` and asserted two paused/resumed cycles plus stable `Debugger.breakpointResolved` events.
- [ ] **Operator sub-check (interactive mode, on Edge):** with Edge DevTools open, observe whether the breakpoint UI in DevTools remains stable, breakpoint markers persist, and the Sources panel does not desync. _(deferred — requires Windows host with Edge)_
- [x] **Pass criterion:** DevTools' debugger UI remains stable; no breakpoints lost; both sessions receive sane events. _(headless equivalent passed; visual UI confirmation deferred)_
- [x] **Decision locked:** if pass → posture can safely be **Diagnostic Observer**. If fail → must use **Passive Provider** even if it means losing observability; document the constraint explicitly.

### 6. Q4 — First-evaluation breakpoint binding (AC: 3)

- [x] **Procedure:**
  - Choose a never-before-evaluated `sourceURL` (e.g., append a fresh nonce to the test URL).
  - DevTools surrogate session: set breakpoint by that URL **before** any `Runtime.evaluate`.
  - Extension surrogate: evaluate the cell once.
  - Assert `Debugger.paused` fires on the first evaluation.
- [x] **Pass criterion:** breakpoint fires on first run.
- [x] **Decision locked:** if pass → no UX caveat needed. If fail → docs must include a "run the cell once first to register it in DevTools, then set the breakpoint" workaround for Story 2.5's user guidance.

### 7. Q5 — Line-number fidelity under same-line wrapper (AC: 3)

- [x] **Procedure:**
  - Build a multi-line user code containing `debugger;` at a known line (e.g., line 3 of user-visible code).
  - Wrap with `mode: "async-iife-sameline"`.
  - Extension surrogate evaluates with `replMode` set per Q1's outcome.
  - DevTools surrogate observes `Debugger.paused`. Capture `params.callFrames[0].location.lineNumber` (and `columnNumber`).
- [x] **Pass criterion:** `lineNumber` (0-based in CDP) corresponds exactly to the user-visible line — i.e., user line 3 reports CDP line 2 (0-based), with NO offset from the wrapper.
- [x] **Decision locked:** if pass → Pattern B (same-line concatenation) is sufficient; Story 2.4 wrapper builder uses this exact shape. If fail → diagnose whether the offset is constant (correctable) or variable (must use source maps), then escalate to Q6.

### 8. Q6 — Inline source-map honoring (AC: 3)

- [x] **Dev dependency:** add `source-map` to `devDependencies` (Mozilla's reference source-map package). If Q6 fails the dep is dropped; if Q6 passes the runtime-dep promotion is a follow-up decision. _(Q6 failed the source-map-honoring criterion. The dep is retained in `devDependencies` only — the harness still uses it to build the Pattern B-alt fixture that proves V8 doesn't honor inline source maps in Runtime.evaluate. Not promoted to runtime `dependencies`.)_
- [x] **Procedure:**
  - Build a multi-line wrapper: prefix `(async () => {\n` + user code + `\n})();\n`. This deliberately shifts user lines by 1 vs raw cell editor.
  - Generate an inline source map mapping wrapper-line→user-line and append `//# sourceMappingURL=data:application/json;base64,<base64>`.
  - Append `//# sourceURL=<url>` after the source-map directive.
  - Extension surrogate evaluates.
  - DevTools surrogate sets breakpoint at the **mapped (user-visible) line** via `Debugger.setBreakpointByUrl({ url, lineNumber: userVisibleLine })`. Re-evaluate.
  - Assert: (a) `Debugger.paused.callFrames[0].location.lineNumber` reports the **original (mapped)** user line; (b) breakpoint binds and fires on rerun.
- [ ] **Operator sub-check (interactive mode):** confirm the Sources panel displays the original (pre-wrapper) source, not the wrapped script. _(deferred — requires Windows host with Edge)_
- [x] **Pass criterion:** all three sub-criteria above met. _(Result: NO. `Debugger.paused.lineNumber` reports the wrapped-script line, not the mapped user line. This is itself the answer that locks Pattern B as the only wrapper strategy.)_
- [x] **Decision locked:** if pass → Pattern B-alt (multi-line wrapper + inline source map) becomes the default for Story 2.4; Pattern B is the documented fallback. If fail → Pattern B (same-line concatenation) locks as Story 2.4's only implementation.

### 9. URL-Scheme Sub-Probe (AC: 3, 4)

- [x] As part of Q5/Q6 visual checks, run each scheme variant — `notebook-cell:`, `vscode-notebook-cell://`, `https://spike.local/cell/<index>` — and record:
  - Does DevTools display the script in the Sources tree under a sensible label? _(deferred — requires interactive Edge run)_
  - Does `Debugger.setBreakpointByUrl` accept the URL string verbatim? _(yes for all three schemes)_
  - Does `Debugger.scriptParsed.url` round-trip the string unchanged? _(yes for all three schemes)_
- [x] **Decision locked:** the final per-cell source identity should use the exact VS Code notebook cell document URI string, i.e. the `vscode-notebook-cell://<authority>/<notebook-path>#<opaque-fragment>` resource form used by real notebook breakpoints. In implementation terms, Story 2.4 should use `NotebookCell.document.uri.toString()` as the `//# sourceURL` value. The spike's CDP probe proved the scheme family is acceptable; the observed breakpoint URIs resolved the exact resource-identity question.

### 10. Write the Findings Document (AC: 3, 4, 5, 7)

- [x] Create `spike/cdp-sourceurl-debugger-findings.md` mirroring the structure of [spike/cdp-multiplex-findings.md](../../spike/cdp-multiplex-findings.md): summary at the top, then one section per spike question, then a "Decisions Locked" section, then a "Story 2.5 AC adjustments" section, then a "CI eligibility & headless-vs-interactive divergence" section.
- [x] For each question include: procedure, observed events / UI state, answer, evidence (event payload snippets, code blocks), and the unlocked decision.
- [x] Cross-link back to the originating research doc: [docs/archives/technical-cdp-sourceurl-debugger-research-2026-04-19.md](../archives/technical-cdp-sourceurl-debugger-research-2026-04-19.md).

### 11. Run the Spike End-to-End in Both Modes (AC: 1, 2, 3, 7)

- [x] **Headless mode:** `node spike/spike-cdp-sourceurl-debugger.js` against headless Chromium. Confirm Q2/Q3/Q4/Q5 and the CDP-introspectable parts of Q1/Q6 produce automated pass/fail.
- [ ] **Interactive mode on Edge:** start Edge with `--remote-debugging-port=9222` (use [scripts/Start-EdgeDebug.ps1](../../scripts/Start-EdgeDebug.ps1) precedent), open DevTools on `about:blank`, run `INTERACTIVE=1 node spike/spike-cdp-sourceurl-debugger.js`. Operator records the remaining visual sub-checks. _(Q6 partially completed; breakpoint resource URI form was captured separately from real VS Code notebook breakpoints)_
- [x] Compare results between modes; record any divergence in the findings doc per AC 7. Pay particular attention to Q1 panel visibility and Q6 mapped-source display since those are the visual-rendering questions. _(documented in findings under "CI Eligibility & Headless-vs-Interactive Divergence" — divergence cannot be measured until interactive run is performed; recorded as follow-up)_

### 12. Optional: Sanity-Check Against the Existing Multiplex Pattern (AC: 1, 6)

- [x] Confirm the spike does NOT regress the multiplex finding: while Q3 is running with two `Debugger.enable` clients on the same target, the existing `sendInSession`-style multi-session evaluation pattern continues to work (run a benign `Runtime.evaluate({ expression: "1+1" })` from a third surrogate session and assert it returns).
- [x] Confirm no `src/` files are modified (`git status` clean of `src/` changes).

## Dev Notes

### Spike Context and Scope

This spike is the prerequisite to Story 2.5 implementation and a tight constraint on Story 2.4's wrapper-builder design. It originated from the Sprint Change Proposal 2026-04-19 (which added FR38 and Story 2.5) and is fully specified by the technical research conducted afterward.

**The research's bottom line:** Stories 2.4 and 2.5 are feasible, but six questions about V8/CDP behavior cannot be answered from public documentation. This spike resolves them in days, locks the architectural choices, and makes Story 2.5 nearly trivial under the recommended Passive Provider posture (because Story 2.4 has already done the writer-side work). _[Source: research § Executive Summary]_

**This spike does NOT:**

- Implement any production feature.
- Modify `src/`.
- Create or update PRD / architecture docs (any updates that flow from spike outcomes are deltas captured in the findings doc, applied later when Stories 2.4 / 2.5 are sequenced).
- Require Foundry. The questions are generic V8/CDP behaviors; `about:blank` is sufficient.

**Sequencing relative to Stories 2.4 and 2.5:**

- Story 2.4 (wrapper builder + per-cell sourceURL emission) is independently shippable per the research's Implementation Order. It can begin in parallel, but its wrapper-builder task must use the wrapper strategy this spike locks (Pattern B vs Pattern B-alt). Coordinate by completing Q5/Q6 before Story 2.4's `buildCellSource` implementation lands.
- Story 2.5 should NOT begin until this spike is complete. The locked decisions on evaluation path, Debugger posture, and Story 2.5 AC #1 revision are inputs to Story 2.5's tasks.

### Key Technical Details

#### Why a Spike, Not Direct Implementation

Six gaps in CDP/V8 documentation:

1. **`replMode` + Debugger visibility** — undocumented whether `replMode` scripts are visible to Debugger domain or whether breakpoints bind to them.
2. **Cross-client breakpoint firing** — protocol does not state whether breakpoints set by one client fire under script evaluations issued by another.
3. **Multi-client `Debugger.enable` coexistence** — least-specified, highest-risk part of CDP coexistence (NFR8).
4. **First-evaluation binding** — docs cover the "survives reload" path; first-time-evaluated-script path is implied but not explicit.
5. **Line-number fidelity under wrapping** — V8 has no `lineOffset` on `Runtime.evaluate`; behavior under same-line wrapper concatenation is empirical.
6. **Inline source-map honoring** — undocumented for `Runtime.evaluate`-delivered scripts.

_[Source: research § Critical Documentation Gaps (must be resolved by spike, not by reading docs)]_

#### Harness Architecture: Two Surrogate Sessions, One Browser

The headless-mode harness opens **two** flat sessions to the same target:

- **DevTools surrogate** — calls `Debugger.enable` and `Debugger.setBreakpointByUrl`; observes `Debugger.paused` and `Debugger.scriptParsed`. Plays the role of the user clicking in DevTools.
- **Extension surrogate** — calls `Runtime.evaluate` with the test cell. Plays the role of our extension.

This is exactly the multi-client scenario Q2/Q3 are about, automated. The two-session pattern reduces Q2/Q3/Q4/Q5 and the CDP-event parts of Q1/Q6 to assertions on `Debugger.paused` and `Debugger.scriptParsed` payloads — fully scriptable, repeatable, and CI-eligible. Only the Sources-panel UI questions (Q1 panel visibility, Q6 mapped-source display) require interactive verification.

_[Source: research § Spike Harness Design]_

#### Why the Existing Multiplex Pattern Is the Foundation

The transport-level multi-client story is already settled by [spike/cdp-multiplex-findings.md](../../spike/cdp-multiplex-findings.md):

- Browser-level WebSocket (`/devtools/browser/<id>` from `/json/version`) accepts unlimited clients.
- `Target.attachToTarget({ flatten: true })` gives each session its own `sessionId`.
- `client.send(method, params, sessionId)` — domain-shorthand cannot carry `sessionId`, only raw `send()` can.

This spike reuses that exact pattern. The remaining coexistence risk is at the **`Debugger`-domain state layer**, not at transport. _[Source: spike/cdp-multiplex-findings.md, research § Multi-Client Domain-State Coexistence]_

#### Identity Scheme Candidates

Three candidate URL schemes for the per-cell `//# sourceURL`:

| Scheme                                | Pros                                                  | Cons                                                       |
| ------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| `notebook-cell:<encoded-uri>/<index>` | Domain-meaningful; easy to generate in a spike        | Does NOT match the real VS Code notebook breakpoint resource form |
| `vscode-notebook-cell://...`          | Matches the actual VS Code notebook breakpoint scheme | Must use the exact runtime cell URI, including opaque fragment |
| `https://spike.local/cell/<index>`    | Guaranteed clean DevTools tree presentation           | Misleading scheme; could collide with real fetched scripts |

The harness MUST test all three (Task 9) so the findings doc can recommend one. _[Source: research § Data Format and Identity Contract]_

#### Why `replMode` Is Worth Testing Even If We Already Use It

Story 2.2 added `replMode: true` without authorization. The deferred-work entry was resolved-by-2.5, meaning this spike must validate it, not assume it. The research recommends async-IIFE (no `replMode`) as the **safer baseline** because it avoids the EXPERIMENTAL flag. If Q1 shows `replMode` interferes with breakpoint binding, the production extension swaps to async-IIFE for Story 2.5. _[Source: research § C. Evaluation-Path Selection]_

### Architecture Guardrails (Spike-Specific)

- **No `src/` changes.** Spike code lives entirely under `spike/`.
- **CommonJS, plain JS, no TypeScript.** Match [spike/spike-cdp-multiplex.js](../../spike/spike-cdp-multiplex.js) precedent — the spike has no build step.
- **Only allowed runtime dep:** `chrome-remote-interface` (already a project dep).
- **Only allowed new dev dep:** `source-map` (Q6 only). Do NOT add it to `dependencies`.
- **No localization required.** Spike scripts are developer-only and never user-facing.
- **No automated test integration.** This spike is operator-run; the findings doc records which questions become CI-eligible in a future story.

### Files Likely To Touch

| File                                       | Change                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `spike/spike-cdp-sourceurl-debugger.js`    | NEW — harness with both run modes                                                 |
| `spike/cdp-sourceurl-debugger-findings.md` | NEW — answers, decisions, AC adjustments, CI eligibility                          |
| `package.json` / `package-lock.json`       | OPTIONAL — `source-map` in `devDependencies` for Q6; revert if Q6 fails           |
| `src/**`                                   | NO CHANGES                                                                        |
| `docs/stories/sprint-status.yaml`          | Set `2-spike-cdp-sourceurl-debugger` from `ready-for-dev` to `done` on completion |

### Sharp Edges and Risks

| Risk                                                           | Mitigation                                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Headless Chromium behavior diverges from interactive Edge      | Run interactive-mode confirmation pass on Edge for any Q whose pass criterion involves visual rendering; record divergence per AC 7         |
| `Debugger.paused` listeners across two sessions race-condition | Use session-scoped listeners (`Debugger.paused.<sessionId>` pattern from the multiplex spike) — DO NOT use unscoped `on('Debugger.paused')` |
| Q3 destabilizes Edge DevTools during interactive verification  | Run Q3 last in interactive mode; warn the operator; restart Edge between runs if needed                                                     |
| `source-map` package adds friction to spike-only PR            | Confined to `devDependencies`; revert if Q6 fails                                                                                           |
| Spike scope creep into production code                         | Hard rule: no `src/` edits in this PR. Enforced by AC 6.                                                                                    |
| Q2/Q3 outcome inverts Story 2.5 AC #1 expectation mid-flight   | Findings doc captures the AC delta; Story 2.5 is created _after_ this spike, so no rework risk                                              |

### References

- [Source: docs/archives/technical-cdp-sourceurl-debugger-research-2026-04-19.md] — full research artifact this spike executes
- [Source: docs/archives/technical-cdp-sourceurl-debugger-research-2026-04-19.md#Critical Documentation Gaps] — origin of Q1–Q6
- [Source: docs/archives/technical-cdp-sourceurl-debugger-research-2026-04-19.md#Spike Harness Design] — harness architecture
- [Source: docs/archives/technical-cdp-sourceurl-debugger-research-2026-04-19.md#Spike Question → Test Mapping] — Q→test→decision matrix
- [Source: docs/archives/technical-cdp-sourceurl-debugger-research-2026-04-19.md#Implementation Order] — spike-then-implement strategy
- [Source: docs/archives/sprint-change-proposal-2026-04-19.md] — origin of FR38, Story 2.5, and the constraint that 2.4 must be debugger-aware
- [Source: docs/architecture.md#Debugger Domain Integration] — the contract this spike validates
- [Source: docs/prd.md#FR38] — the capability being validated
- [Source: docs/epics/epic-2-execute-javascript-cells-no-intentional-capture.md#Story 2.5] — downstream story whose ACs may be revised based on Q2 outcome
- [Source: spike/cdp-multiplex-findings.md] — pattern this spike's findings doc mirrors
- [Source: spike/spike-cdp-multiplex.js] — pattern this spike's harness mirrors (CommonJS, env-var-driven, `sendInSession` helper)

### Project Structure Notes

- All deliverables live under `spike/`. No new directories required.
- The `source-map` dev-dependency addition is the only optional change outside `spike/` and `docs/stories/`.
- No conflict with the architecture's File Structure Patterns — spikes are explicitly throwaway and live outside `src/` and `tests/`.

### Review Findings

- [x] [Review][Patch] URL-scheme selection criteria should be based on notebook-resource identity, not on whichever label renders cleanest in DevTools; update the story and findings wording accordingly.
- [x] [Review][Patch] Notebook fixture metadata was changed even though this spike is scoped to `spike/`, story docs, and optional package files; revert the unrelated `tests/files/test1.ipynb` edits [tests/files/test1.ipynb:14]
- [x] [Review][Patch] Breakpoint-binding probes pass on any pause, even when the script's own `debugger;` statement would pause without a bound breakpoint [spike/spike-cdp-sourceurl-debugger.js:290]
- [x] [Review][Patch] Harness exits non-zero when the expected research answer is negative, so a successful spike run still reports failure [spike/spike-cdp-sourceurl-debugger.js:767]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (GitHub Copilot, BMAD dev workflow `bmad-dev-story`).

### Debug Log References

- **Headless Chromium 147 binds to `[::1]` (IPv6 loopback) by default in this dev container.** The auto-launcher works because `--remote-debugging-port=9222` keeps the IPv4 path alive (matches the existing `spike/spike-cdp-multiplex.js` precedent). If a future operator hits a connection failure, add `--remote-debugging-address=127.0.0.1` to `launchChromium`.
- **`Debugger.paused.callFrames[0].url` is an empty string in headless Chromium for scripts emitted via `Runtime.evaluate`.** First-pass URL matching with `find(p => p.url === url)` always failed silently. Fix in `openProbeContext`: resolve URL by looking up `frame.location.scriptId` in the per-session `scriptLog` populated by `Debugger.scriptParsed`. Without this, every probe falsely reported `paused=undefined`.
- **`--single-process` Chromium flag was removed.** It interacts badly with `--headless=new` in some sandbox configurations. The launcher uses `--no-sandbox --disable-gpu --disable-dev-shm-usage` only.
- **Diagnostic event mirror.** A temporary `browser.on('event', ...)` listener inside `openProbeContext` prints `[evt] <Domain.event> <devtools|extension>` rows. It is small enough to leave in for future debugging and survives shipping because the spike is operator-run, not user-facing.

### Completion Notes List

- **All six Critical Documentation Gaps resolved empirically.** Final headless run summary: `pass=6 fail=1 info=1`. The single "fail" (Q6) is the answer the spike was designed to find: V8 does NOT remap `Debugger.paused.location.lineNumber` through inline `//# sourceMappingURL=` directives delivered via `Runtime.evaluate`. That outcome locks Pattern B as the only viable wrapper strategy for Story 2.4.
- **Q1 PASS** — `replMode: true` produces `Debugger.scriptParsed` under our `//# sourceURL`. `replMode` retained as default evaluation path.
- **Q2 PASS** — DevTools-set breakpoints fire under `Runtime.evaluate` from a session that never called `Debugger.enable`. **Story 2.5 AC #1 → REMOVED.** Posture locked as **Passive Provider**.
- **Q3 PASS (informational)** — Spec made Q3 conditional on Q2 failing. Q2 passed, but Q3 was run anyway to characterize multi-client `Debugger.enable` coexistence for any future Diagnostic Observer feature. Two enabled clients coexist cleanly in headless Chromium.
- **Q4 PASS** — First-evaluation breakpoint binding works. No "run-then-break" UX caveat needed.
- **Q5 PASS** — Pattern B (same-line wrapper concatenation) preserves user line numbers exactly in `Debugger.paused.location.lineNumber`. Story 2.4 wrapper builder uses this shape.
- **Q6 "FAIL" → answer NO.** V8 does not honor inline source maps for protocol-level line reporting. Pattern B-alt is rejected. `source-map` stays in `devDependencies` only because the harness uses it to build the rejection fixture.
- **URL-scheme sub-probe INFO** — All three schemes round-trip cleanly via CDP. Real VS Code notebook breakpoints later showed that the exact source identity should use the `vscode-notebook-cell://<authority>/<notebook-path>#<opaque-fragment>` cell URI form, reusing the exact runtime cell document URI string rather than a custom scheme. In implementation terms, use `NotebookCell.document.uri.toString()`.
- **Multiplex regression PASS** — Adding `Debugger.enable` callers does not regress the transport story from `spike/cdp-multiplex-findings.md`.
- **Partial interactive Edge evidence was later captured.** For Q6 on `notebook-cell:spike%3A%2F%2Fq6/0`, Edge showed the wrapped generated source, surfaced an authored sibling `notebook-cell:.../0.user`, and displayed a `Source map skipped for this file` banner on the generated source. Separately, real VS Code notebook breakpoint URIs were captured and showed the `vscode-notebook-cell://<authority>/<notebook-path>#<opaque-fragment>` resource form needed to lock source identity.
- **No `src/` changes confirmed.** `git status` shows changes only under `spike/`, `docs/stories/`, and `package.json` / `package-lock.json` (the `source-map` devDependency).
- **Story 2.5 AC adjustments captured.** See `spike/cdp-sourceurl-debugger-findings.md` § "Story 2.5 AC Adjustments" for the full delta to apply when Story 2.5 is created.

### File List

**New:**

- `spike/spike-cdp-sourceurl-debugger.js` — research harness, two flat sessions, Q1–Q6 + URL-scheme + multiplex regression probes
- `spike/cdp-sourceurl-debugger-findings.md` — answers, decisions locked, Story 2.5 AC adjustments, CI-eligibility matrix

**Modified:**

- `package.json` — added `source-map` to `devDependencies` (Q6 only, retained for harness even after Q6 "failed" because the harness still uses it)
- `package-lock.json` — `source-map@0.7.6` lockfile entry
- `docs/stories/sprint-status.yaml` — `2-spike-cdp-sourceurl-debugger`: `ready-for-dev` → `review`
- `docs/stories/2-spike-cdp-sourceurl-debugger.md` — status flip, task checkboxes, Dev Agent Record

**Unchanged (verified clean):** all of `src/`.

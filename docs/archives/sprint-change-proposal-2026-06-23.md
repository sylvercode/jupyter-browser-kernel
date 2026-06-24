# Sprint Change Proposal — Debug-Session-Driven Connection Lifecycle (Epic 11)

**Date:** 2026-06-23
**Author:** Sylvercode (via correct-course workflow)
**Mode:** Incremental
**Trigger source:** Epic 10 dogfooding / UX feedback (manual two-step connect-then-debug flow)
**Scope classification:** Moderate–Major (new epic, PRD extension, architecture extension, epic-list + sprint-status updates; supersedes Epic 1 command surface)

---

## 1. Issue Summary

### Problem Statement

While testing Epic 10 (Full VS Code Debugging Experience), the required two-step flow makes the UX poor: the user must first run the `jupyterBrowserKernel.connect` command to establish the CDP connection, and only **then** start the debugger as a separate action. The connection lifecycle (configured via workspace settings and driven by connect/disconnect/reconnect commands) is disjoint from the debug session lifecycle that users actually operate when debugging.

### Discovery Context

The gap surfaced during hands-on Epic 10 validation. The debug session manager explicitly encodes the coupling cost: `launch` throws _"Cannot start debug session: connect to a browser target first."_ ([src/debugger/debug-session-manager.ts](../../src/debugger/debug-session-manager.ts)). The connection is established separately by the connect command ([src/commands/connect-command.ts](../../src/commands/connect-command.ts)) reading endpoint settings ([src/config/endpoint-config.ts](../../src/config/endpoint-config.ts)).

### Evidence

- `jupyter-browser-kernel` debugger `configurationAttributes.launch.properties` is empty today — the debug configuration carries no connection information ([package.json](../../package.json)).
- CDP host/port live only in workspace settings (`jupyterBrowserKernel.cdpHost` / `cdpPort`), which model a single connection and feel mismatched with multi-target project work.
- The transport keeps a single module-level `activeBrowserConnection` ([src/transport/browser-connect.ts](../../src/transport/browser-connect.ts)), so only one connection is active at a time regardless of surface.

---

## 2. Checklist Execution Status

### Section 1 — Understand Trigger and Context

- [x] 1.1 Triggering context identified: Epic 10 debugging dogfooding
- [x] 1.2 Core problem defined: new requirement / UX improvement — connection lifecycle should be driven by the debug session, not a separate command + settings flow
- [x] 1.3 Supporting evidence gathered from code (debug-session-manager, connect-command, package.json, transport)

### Section 2 — Epic Impact Assessment

- [x] 2.1 Current epic viability: Epic 10 remains valid and complete; this is additive lifecycle work
- [x] 2.2 Required epic-level change: add a new epic (Epic 11) for debug-session-driven connection lifecycle
- [x] 2.3 Remaining epics reviewed: Epic 1 command surface is superseded; Epics 2–9 unaffected in scope
- [x] 2.4 Future-epic invalidation check: no invalidation; Foundry profile epics (7–8) layer cleanly on the new lifecycle
- [x] 2.5 Order/priority impact: Epic 11 depends on Epic 10 and should follow it

### Section 3 — Artifact Conflict and Impact Analysis

- [x] 3.1 PRD: connection-control FRs (FR1/FR5/FR6) delivery surface changes; new FR40 added
- [x] 3.2 Architecture: connection-lifecycle decision ("transport-owned, manual reconnect") needs a debug-session-ownership subsection
- [x] 3.3 UX: debug toolbar replaces command palette for connect/reconnect/disconnect (documented in epic ACs)
- [x] 3.4 Secondary artifacts: epic-list and sprint-status updates

### Section 4 — Path Forward Evaluation

- [x] 4.1 Option 1 (Direct Adjustment — new epic): **Viable**, effort Medium, risk Medium
- [ ] 4.2 Option 2 (Rollback): **Not viable** — Epic 10 is sound; nothing to revert
- [ ] 4.3 Option 3 (MVP Review): **Not viable** — this is post-MVP core, MVP unaffected
- [x] 4.4 Selected approach: **Option 1 (Direct Adjustment)** — add Epic 11

### Section 5 — Proposal Components

- [x] 5.1 Issue summary completed
- [x] 5.2 Epic/artifact impact documented
- [x] 5.3 Recommended path with rationale documented
- [x] 5.4 MVP impact + action plan documented
- [x] 5.5 Handoff plan defined

### Section 6 — Final Review and Handoff Readiness

- [x] 6.1 Checklist reviewed for completeness
- [x] 6.2 Proposal reviewed for internal consistency
- [x] 6.3 User approval obtained (`I approuve, go`)
- [x] 6.4 `docs/stories/sprint-status.yaml` updated with Epic 11 backlog entries
- [x] 6.5 Next-step handoff responsibilities drafted

---

## 3. Impact Analysis

### Epic Impact

| Epic              | Current Status | Impact                                                                             |
| ----------------- | -------------- | ---------------------------------------------------------------------------------- |
| Epic 1            | done           | Command surface (connect/disconnect/reconnect) superseded; capabilities preserved. |
| Epic 2            | done           | Execution becomes coupled to the debug session; result contract unchanged.         |
| Epic 10           | done           | Foundation for Epic 11; no rework, lifecycle extends the existing DAP adapter.     |
| Epics 3–9         | backlog        | No scope invalidation; they layer on the new lifecycle.                            |
| **Epic 11 (new)** | new            | Add post-MVP core epic for debug-session-driven connection lifecycle.              |

### Story Impact

- No destructive change to existing stories.
- Add stories 11.1–11.6: debug-config endpoint attributes, connect-on-launch, reconnect-on-restart, disconnect-on-stop, prompt-to-start execution coupling, and command retirement + state-reporting migration.

### Artifact Conflicts and Required Updates

| Artifact                                                                        | Required Change                                                         |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `docs/prd.md`                                                                   | Add FR40 (post-MVP core), changelog entry, traceability note. **Done.** |
| `docs/epics/epic-list.md`                                                       | Add Epic 11 entry and FR40 mapping. **Done.**                           |
| `docs/epics/epic-11-debug-session-driven-connection-lifecycle-post-mvp-core.md` | New epic file with stories 11.1–11.6. **Done.**                         |
| `docs/architecture.md`                                                          | Add debug-session-driven connection lifecycle subsection. **Done.**     |
| `docs/stories/sprint-status.yaml`                                               | Add `epic-11` and story backlog entries. **Done.**                      |

### Technical Impact (for implementation, not part of this proposal)

- Add `host`/`port` to the `jupyter-browser-kernel` debugger `configurationAttributes` and resolve them in `DebugConfigProvider`, falling back to `cdpHost`/`cdpPort` settings.
- Move connection establishment/teardown into the DAP session lifecycle (launch → connect, restart → reconnect, terminate/disconnect → disconnect).
- Enforce single active connection; reject a second concurrent debug session with guidance.
- On a cell run with no active session, prompt the user to start a connection-bearing debug session (via `vscode.debug.startDebugging`) rather than booting the debugger silently; execute once the connection reaches `connected`.
- Add `onNotebook:jupyter-notebook` to `activationEvents` so the notebook controller is registered on notebook open after the implicit `onCommand` activation is removed.
- Remove `connect`/`disconnect`/`reconnect` command contributions and their handlers; preserve FR4 connection-state reporting through the debug lifecycle.
- Keep settings as fallback defaults only.

---

## 4. Recommended Approach

### Selected Path: Option 1 (Direct Adjustment — new Epic 11)

Add a post-MVP core epic that re-homes the connection lifecycle onto the debug session, configured through debug configurations, with settings retained as fallback defaults.

### Why this is the best path

- **Solves the trigger directly:** one action (play) connects and debugs; restart reconnects; stop disconnects.
- **Better configuration model:** debug configurations support multiple named, version-controlled connection profiles per project — something single-value settings cannot express — while the single active-connection constraint is preserved.
- **No rework of delivered value:** Epic 10's DAP adapter and Epic 1's transport state machine are reused; only the ownership/entry-point of the connection lifecycle moves.
- **Keeps the on-ramp:** settings-as-fallback means zero-config launch still works for new users.

### Decisions captured (from collaborative brainstorm)

- **Model A** (debug session owns the connection; execution rides on it) **+ settings-as-fallback**.
- One active connection at a time; second concurrent debug session rejected with guidance (v1).
- Legacy connect/disconnect/reconnect commands retired.

---

## 5. PRD MVP Impact and Action Plan

- **MVP impact:** None. FR40 is **Post-MVP Core**; MVP scope and journeys are unchanged.
- **Action plan:** Plan and sequence Epic 11 after Epic 10 (already done). Create stories 11.1–11.6 via the story workflow, then implement.
- **Dependencies/sequencing:** Epic 11 depends on Epic 1, Epic 2, and Epic 10.

---

## 6. Implementation Handoff

- **Scope classification:** Moderate–Major (backlog reorganization + planning-artifact extension; no MVP replan).
- **Route to:** Scrum Master / Product Owner for story creation and sprint sequencing, then Development for implementation.
- **Deliverables produced:** This proposal, the new Epic 11 file, PRD FR40 + changelog, epic-list entry, architecture subsection, and sprint-status backlog entries.
- **Success criteria:** Starting a `jupyter-browser-kernel` debug configuration connects and debugs in one action; restart reconnects; stop disconnects; cells run without a separate connect step; connect/disconnect/reconnect commands removed; settings act only as fallback defaults; DevTools coexistence (NFR8) preserved.

---
title: "Sprint Change Proposal: Cut Epic 5, Remove Execution History from Epic 4"
date: 2026-06-29
prepared_for: Sylvercode
status: Approved
change_scope: Minor (Documentation Only)
---

# Sprint Change Proposal: Cut Epic 5, Remove Execution History from Epic 4

**Prepared for:** Sylvercode  
**Date:** 2026-06-29  
**Status:** Approved by user  
**Change Scope:** MINOR (Documentation and planning artifacts only; no code changes)

---

## 1. Issue Summary

### Problem Statement

Post-implementation analysis of Epic 10 (Full VS Code Debugging Experience) reveals that Epic 5 (Present Complex Variables and Watches) and Epic 4's execution-history story create unnecessary scope overlap and out-of-ecosystem complexity:

1. **Epic 5 Watch Overlap:** Epic 5's stories (watched expressions, depth-limited projection, error isolation) describe debugger-style variable inspection workflows that are now provided natively by Epic 10's debugger surfaces.

2. **Execution History Misalignment:** Epic 4 Story 4.3 (session-scoped execution history) contradicts notebook ecosystem design principles. History tracking is fundamentally a version-control concern, not a kernel concern. Adding runtime history to the extension creates maintenance burden and introduces breaking-change risk if the notebook API changes.

### Discovery Context

- Epic 10 is complete and delivers full VS Code notebook-cell debugging with Variables, Call Stack, and Watch panes
- Brainstorm session decision (2026-06-29): Epic 5 should not remain a notebook epic; watches are debugger-surface-adjacent, not notebook-native
- User decision: Execution history is out of scope; keep Epic 4 focused on latest-result rendering

### Evidence

- Epic 10 Story 10.3 already surfaces "Stack Frames, Scopes, and Variables in VS Code"
- Epic 5 Stories 5.1-5.3 are functionally redundant with Epic 10's debugger integration
- No unique notebook value proposition remains in Epic 5 after removing history
- Notebook ecosystem relies on Git, not extension-managed history

---

## 2. Impact Analysis

### Epic Impact

| Epic                | Status    | Change                                                                                                    |
| ------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| **Epic 4**          | MVP       | Reduce scope: Drop Story 4.3 (execution history), keep Stories 4.1 & 4.2 (value rendering + type context) |
| **Epic 5**          | Post-MVP  | **CUT ENTIRELY** — Watches are now debugger-native (Epic 10)                                              |
| **Epics 1-3, 6-11** | No change | No dependencies on Epic 4 or 5; all other epics unaffected                                                |

### Artifact Conflicts and Updates Required

**PRD (Product Requirements Document):**

- ✅ FR10 (return execution values) — Keep, delivered by Epic 4
- ❌ FR17 (execution history) — **REMOVED** from scope (was MVP)
- ❌ FR24-FR26 (watches) — Already marked Post-MVP, now clarified as debugger-native

**Architecture Document:**

- Updated FR coverage: FR14-FR17 → FR14-FR16
- Removed "execution history" from core layer responsibilities
- Clarified watches are debugger-surface concerns (not kernel concerns)

**Requirements Inventory:**

- Removed FR17, FR24, FR25, FR26 entries

**UX Specification:**

- Updated Journey 5 (Post-MVP Debug in VS Code) to clarify watches come from debugger interface
- Updated Component Strategy Phase 2 to note: "watches are integrated with VS Code debugger, no separate notebook watch UI"

### MVP Scope Impact

✅ **No MVP impact** — All removed requirements (FR17, FR24-26) were either:

- Post-MVP features, or
- Intentionally cut by user decision (FR17 execution history)

**MVP still delivers:**

- Connection and session control (FR1-FR7)
- Notebook execution (FR8-FR13, FR38)
- Structured result contract (FR14-FR16)
- Intentional output capture (FR23)
- Manual reconnect (FR5)

### Technical/Code Impact

✅ **None** — No code changes required. All changes are planning artifacts only.

---

## 3. Recommended Approach

**Selected Path: Option 1 — Direct Adjustment** ✅

### Rationale

1. **Scope Alignment:** Removes functionally redundant work (Epic 5 watches already covered by Epic 10 debugger). Eliminates out-of-ecosystem concern (execution history not part of notebook ecosystem).

2. **Implementation Fit:** Epic 10 is complete and working. Epic 5 was not started. No rollback required; only documentation cleanup needed.

3. **Timeline:** Low effort — planning artifacts only, no code changes.

4. **Risk Profile:** Low risk because:
   - MVP scope is unaffected (FR1-16 all preserved)
   - No active stories are invalidated
   - Debugger watches are a superior substitute for notebook watches (richer, native to VS Code)
   - Execution history removal aligns with notebook design practices

5. **Long-term Sustainability:** Keeps the kernel focused on core browser execution contract, delegates observation concerns to VS Code debugger infrastructure. This boundary is cleaner and easier to maintain.

### Effort Estimate

- Planning artifact updates: ~30 minutes
- Epic/story file updates: ~1 hour
- No code changes or testing required

**Total: ~1.5 hours (documentation only)**

### Risk Assessment

- **Risk Level:** LOW
- **MVP Impact:** None
- **Active Story Disruption:** None
- **Scope Boundary:** Clean and defensible

### Timeline Impact

None — documentation updates only

---

## 4. Detailed Change Proposals

### PROPOSAL 1: Epic 4 Scope Reduction

**Artifact:** `docs/epics/epic-4-capture-intentional-values-basic.md`

**Change Type:** Story Removal

**Affected Story:**

- Story 4.3: Preserve Session-Scoped Execution History → **DELETE ENTIRE STORY**

**Rationale:** Execution history is not part of the notebook ecosystem. Notebook history is managed by version control, not extensions. Removing this simplifies Epic 4 to its core value: "Surface intentional execution values in structured notebook output."

**Updated Epic 4 Goal:**

```
OLD: "Surface intentional execution values in structured notebook output and preserve session-scoped history for comparison during iterative notebook workflows."

NEW: "Surface intentional execution values in structured notebook output."
```

**Updated Epic 4 Stories:**

```
REMAINING:
- Story 4.1: Return Execution Values to Notebook Output
- Story 4.2: Display Structured Value Output with Type Context

DELETED:
- Story 4.3: Preserve Session-Scoped Execution History [REMOVED]
```

**Impact:** Epic 4 remains MVP-viable and delivers core value. Stories 4.1 & 4.2 are sufficient for FR10 (return execution values).

---

### PROPOSAL 2: Epic 5 — Remove Entirely

**Artifact:** `docs/epics/epic-5-present-complex-variables-and-watches-post-mvp-core.md`

**Change Type:** Epic Deletion

**Rationale:**

- Story 5.1 (Create and Refresh Watched Expressions) → Provided by Epic 10 Story 10.3 (Surface Variables in VS Code)
- Story 5.2 (Depth-Limited Projection) → Provided by VS Code debugger native UI
- Story 5.3 (Isolate Watch Evaluation Failures) → Provided by debugger robustness

**Action:** Delete entire epic file and all references.

**Impact:** Simplifies post-MVP roadmap. Watch workflows now route through debugger-native surfaces (superior UX, maintained by VS Code platform).

---

### PROPOSAL 3: PRD — Remove FR17

**Artifact:** `docs/prd.md`

**Change Type:** Requirement Removal

**Section Affected:** Result Normalization and Output Contract

```markdown
OLD:

- FR16: The extension can capture output generated during cell execution and surface it as notebook output, distinguishable from unrelated browser console activity.
- FR17: The extension can preserve session-scoped execution history so a user can compare the result of each cell revision within a working session.

NEW:

- FR16: The extension can capture output generated during cell execution and surface it as notebook output, distinguishable from unrelated browser console activity.
```

**Rationale:** Execution history is not a kernel responsibility; it's a version-control concern. Removing FR17 simplifies requirements and aligns the product with notebook ecosystem principles.

---

### PROPOSAL 4: Architecture — Remove Execution History References

**Artifact:** `docs/architecture.md`

**Change Type:** Scope Clarification

**Updates:**

1. Line 50: Remove "execution history" from core layer responsibilities
2. Line 612: Remove "execution history" from MVP capabilities list
3. Line 618: Update FR coverage from "FR14-FR17" to "FR14-FR16"

**Rationale:** Clarifies that the core kernel is not responsible for execution history. History is a presentation concern (handled by notebooks/Git), not a transport or execution concern.

---

### PROPOSAL 5: Requirements Inventory — Remove FR17, FR24-26

**Artifact:** `docs/epics/requirements-inventory.md`

**Change Type:** Entry Deletion

```
REMOVED ENTRIES:
- FR17: Epic 4 - session-scoped value-history continuity
- FR24: Epic 5 - watched expressions and refresh behavior
- FR25: Epic 5 - depth-limited projection and nested drill-down
- FR26: Epic 5 - resilient watch refresh when one watch fails
```

**Rationale:** Requirements no longer in scope (FR17 removed by decision; FR24-26 now debugger-native via Epic 10).

---

### PROPOSAL 6: UX Spec — Clarify Debugger-Native Watches

**Artifact:** `docs/ux-spec/09-user-journey-flows.md` & `docs/ux-spec/10-component-strategy.md`

**Change Type:** Clarification Updates

**Journey 5 Update:**

```markdown
Step 4 OLD: "Inspect Variables, Watch, and Call Stack panes."
Step 4 NEW: "Inspect VS Code native debugger panes: Variables, Watch, and Call Stack."

Added note: "Watches are managed through the VS Code debugger interface; there is no separate notebook watch UI."
```

**Component Strategy Phase 2 Update:**

```markdown
OLD: "Richer watched-value rendering"
NEW: "Enhanced debugger-native watch rendering (watches are now integrated with VS Code debugger, no separate notebook watch UI)"
```

**Rationale:** Clarifies that watches are debugger-native features (Epic 10), not notebook-specific features. Removes any ambiguity about where watch functionality lives.

---

## 5. Implementation Handoff

**Change Scope Classification:** **MINOR** ✅

All changes are **documentation and planning artifact updates only**. No code changes required.

**Handoff Recipients:** Developer Agent

**Handoff Type:** Direct Implementation (no backlog reorganization or escalation needed)

### Implementation Tasks

| Task                                                        | Owner     | Effort | Notes                                   |
| ----------------------------------------------------------- | --------- | ------ | --------------------------------------- |
| Update Epic 4 file (remove Story 4.3)                       | Dev Agent | 15 min | Remove story from markdown, update goal |
| Delete Epic 5 file entirely                                 | Dev Agent | 5 min  | Delete epic markdown file               |
| Update PRD (remove FR17)                                    | Dev Agent | 10 min | Remove requirement line                 |
| Update Architecture (remove history refs)                   | Dev Agent | 10 min | 3 locations, straightforward deletions  |
| Update Requirements Inventory (remove FR17, FR24-26)        | Dev Agent | 10 min | 4 lines removed                         |
| Update UX Spec (Journey 5 & Phase 2)                        | Dev Agent | 15 min | 2 files, clarification language added   |
| Update epic-list.md and index.md (if they reference Epic 5) | Dev Agent | 10 min | Clean up cross-references               |

**Total Estimated Effort:** ~1.5 hours (documentation only)

### Success Criteria

✅ Epic 4 updated with Story 4.3 removed; goal clarified  
✅ Epic 5 deleted; all references cleaned up  
✅ PRD updated: FR17 removed, FR14-16 preserved  
✅ Architecture updated: history references removed  
✅ Requirements inventory cleaned: FR17, FR24-26 removed  
✅ UX spec clarified: debugger-native watches documented  
✅ All documentation internally consistent

### Verification Steps

After edits complete, verify:

- `grep -r "FR17" docs/` should return zero results
- `grep -r "FR24" docs/` should return zero results
- `grep -r "Epic 5" docs/ | grep -v "archive" | grep -v "change-proposal"` should return zero results
- `grep -r "execution history" docs/` should return zero results (except in archives)

---

## Summary

**Issue Addressed:** Epic 5 and execution history create out-of-scope complexity; they're now debugger-native or ecosystem-misaligned.

**Solution:** Cut Epic 5 entirely; remove Story 4.3 from Epic 4 (execution history). Update all planning artifacts for clarity.

**Change Scope:** MINOR (documentation only)

**Effort:** ~1.5 hours

**Risk:** LOW

**MVP Impact:** NONE

**Implementation:** Developer Agent direct assignment. No escalation needed.

---

**Approval:** ✅ User approved 2026-06-29  
**Status:** Ready for Developer Agent implementation

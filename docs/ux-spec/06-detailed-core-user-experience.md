# Detailed Core User Experience

### Defining Experience

The defining experience is rapid JavaScript notebook iteration against a live browser target with explicit run outcomes and low-friction recovery.

### User Mental Model

Users expect:

- each cell to be an executable unit,
- each execution to produce visible output,
- failures to include actionable diagnostics,
- readiness to be visible before they run.

For MVP trust, two signals matter:

1. Connection lifecycle state is clear (`disconnected`, `connecting`, `connected`, `error`).
2. Target eligibility diagnostics can explain why execution is or is not currently viable.

### Success Criteria

The interaction is successful when:

- users can execute JavaScript cells and inspect structured output inline,
- errors surface with message and stack (with source location when available),
- reruns remain fast and predictable,
- reconnect restores practical execution flow after disconnect or reload,
- intentional output remains distinguishable from unrelated browser console activity.

### Novel UX Patterns

MVP novelty is contract-level, not layout-level:

- normalized result envelope across success and failure,
- intentional output helper contract,
- deterministic reconnect and eligibility diagnostics language.

### Experience Mechanics

**1. Initiation**

- User opens a notebook and connects to a browser endpoint.
- Status reflects connection lifecycle and current readiness.

**2. Interaction**

- User writes or edits a JavaScript cell.
- User runs the cell.

**3. Feedback**

- Success: structured result appears inline.
- Failure: structured error appears inline with actionable details.
- Intentional output can be inspected without ambiguity.

**4. Completion**

- User validates behavior, edits, and reruns.
- User may keep forward and rollback cells adjacent for reversible experimentation.

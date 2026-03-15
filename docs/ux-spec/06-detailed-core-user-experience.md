# Detailed Core User Experience


### Defining Experience

The defining experience of foundry-devil-code-sight is rapid JavaScript macro iteration from a VS Code notebook against a live Foundry world. Users open a notebook, run code, see the result, adjust, and rerun with minimal friction. The product wins when this loop feels faster and more reliable than Foundry's native macro editor workflow.

### User Mental Model

Users approach this product with an established VS Code/Jupyter mental model:

- notebook cells are executable units
- each execution should produce immediate visible feedback
- errors should point to exact source location
- status indicators should communicate readiness before execution

Before trusting execution, users expect two readiness signals:

1. Connection is alive.
2. Module handshake is OK, meaning Foundry is alive and reachable in a valid tab context.

### Success Criteria

The core interaction is successful when:

- users can open a notebook with Foundry kernel and begin execution immediately
- each run returns visible value/output or explicit error
- errors include actionable location detail (line/column where available)
- users can rerun quickly without breaking iteration flow
- execution impact is visible in at least one trusted surface: Foundry state, notebook cell result, or intentional log output

### Novel UX Patterns

For V1, the experience should remain almost entirely within established VS Code/Jupyter interaction patterns to reduce learning cost and maximize trust:

- standard notebook run loop
- familiar status signaling
- familiar diagnostics style

Intentional novelty is deferred to V2:

- Foundry-specific quality-of-life workflows exposed through VS Code commands
- deeper domain shortcuts built on top of the trusted V1 foundation

### Experience Mechanics

**1. Initiation**

- User opens a notebook configured with Foundry kernel.
- If connection is already configured, session initializes automatically and readiness becomes visible.

**2. Interaction**

- User writes a JavaScript snippet in a cell.
- User executes the cell in the notebook run flow.

**3. Feedback**

- System returns value/output on success.
- On failure, system returns clear error diagnostics with location details.
- Readiness context (connection + handshake) remains legible to support trust.

**4. Completion**

- User observes visible impact from execution in one or more trusted surfaces:
  - Foundry world behavior/state
  - notebook cell result
  - intentional runtime log output
- User either iterates again or keeps the snippet as a validated macro step.

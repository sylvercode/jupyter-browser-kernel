# User Journey Flows


### Journey 1: Rapid Macro Iteration Loop

Goal: let a user move from idea to validated macro behavior with minimum cycle time and zero ambiguity about execution outcome.

```mermaid
flowchart TD
  A[Open notebook] --> B{Foundry status ready?}
  B -- No --> C[Use Connect or Reconnect command]
  C --> D{Connection established?}
  D -- No --> E[Show labeled error output plus prefixed log guidance]
  E --> C
  D -- Yes --> F[Write or edit JS cell]
  B -- Yes --> F
  F --> G[Run cell]
  G --> H{Execution outcome}
  H -- Success --> I[Show B2 output: Result label plus value]
  H -- Error --> J[Show B2 output: Error label and type plus message and line or column]
  J --> K[Edit cell]
  K --> G
  I --> L{Behavior in Foundry matches intent?}
  L -- No --> K
  L -- Yes --> M[Keep validated cell or continue iteration]
```

Progress and feedback model:

- Entry point: notebook open with Foundry kernel.
- Key decisions: run now vs reconnect first; keep result vs iterate.
- Success signal: labeled Result output and expected Foundry state change.
- Primary confusion risk: silent or no-op perception.
- Recovery: explicit Error envelope plus retry loop back to edit and run.

### Journey 2: Safe Experimentation and Reversal

Goal: enable risky mutations with immediate rollback confidence.

```mermaid
flowchart TD
  A[Draft Forward cell] --> B[Draft Rollback cell directly below]
  B --> C[Run Forward cell]
  C --> D{Forward result}
  D -- Error --> E[Show labeled error output plus line and column]
  E --> F[Patch Forward logic]
  F --> C
  D -- Success --> G[Inspect Foundry state plus prefixed logs]
  G --> H{Outcome acceptable?}
  H -- Yes --> I[Keep change and continue]
  H -- No --> J[Run Rollback cell]
  J --> K{Rollback successful?}
  K -- Yes --> L[State restored; iterate safely]
  K -- No --> M[Inspect outputs and logs, patch rollback]
  M --> J
```

Progress and feedback model:

- Entry point: known risky operation.
- Key decisions: keep forward change vs rollback.
- Success signal: explicit confirmation that state is restored or accepted.
- Primary confusion risk: partial rollback.
- Recovery: run rollback again after patching with value checks.

### Journey 3: Environment and Connection Management

Goal: restore working execution quickly after reload or restart, or module drift.

```mermaid
flowchart TD
  A[User sees not-ready status headline] --> B[Trigger Reconnect]
  B --> C{CDP reconnect succeeded?}
  C -- No --> D[Show reconnect failure context in output plus logs]
  D --> E[Adjust host, port, or target and retry]
  E --> B
  C -- Yes --> F[Run module handshake]
  F --> G{Handshake state}
  G -- OK --> H[Status headline equals Ready]
  G -- Missing --> I[Guide: install and enable companion module]
  G -- Legacy --> J[Guide: update companion module recommended]
  G -- Unsupported --> K[Guide: update companion module required]
  I --> L[User applies fix in Foundry settings]
  K --> L
  L --> B
  J --> M{Proceed now or update first?}
  M -- Update now --> L
  M -- Proceed with warning --> H
  H --> N[Run validation cell]
  N --> O{Validation successful?}
  O -- Yes --> P[Resume notebook workflow]
  O -- No --> D
```

Progress and feedback model:

- Entry point: disconnected or degraded status.
- Key decisions: retry config vs fix module state.
- Success signal: Ready status plus successful validation cell.
- Primary confusion risk: connection and module issues conflated.
- Recovery: explicit handshake-state guidance path before retry.

### Journey Patterns

Navigation patterns:

- Always return to the notebook cell as the primary action surface.
- Use command-triggered recovery for reconnect, then resume the same cell loop.

Decision patterns:

- Gate execution trust through visible readiness state before run.
- On each run, branch only into success-continue or error-edit-retry.

Feedback patterns:

- B2 cell envelope provides immediate semantic result or error framing.
- C2 prefixed logs provide chronological context for multi-step debugging.

### Flow Optimization Principles

- Minimize steps to value: keep run, edit, and rerun inside one notebook context.
- Reduce cognitive load: one clear status headline at a time (A2).
- Keep diagnostics actionable: label errors with type plus line and column before deep detail.
- Preserve reversible experimentation: encourage forward and rollback cell pairing.
- Favor recovery over dead ends: every failure branch returns to a concrete next action.

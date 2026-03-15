# UX Consistency Patterns


### Button Hierarchy

V1 uses a command-first, notebook-first interaction model, so traditional button hierarchies are intentionally minimal.

Primary actions:

- Run cell
- Reconnect

Secondary actions:

- Expand stack details
- Open output channel
- Open settings for host, port, and related connection configuration

Pattern rule:

- Promote only actions that keep users in the write-run-verify loop.
- Defer or demote actions that break momentum or force context switching.

### Feedback Patterns

Severity model is standardized:

- **Error**: blocking condition (execution failed, connection unavailable, required update)
- **Warning**: degraded but usable condition (legacy companion version)
- **Info**: neutral progress state (connecting, reconnect attempt, handshake running)
- **Success**: completed operation (execution success, reconnect success, validation pass)

Feedback delivery rules:

- **Inline first** in notebook and status context for immediate user understanding.
- **Output channel mirror** for diagnostics continuity and copy or search workflows.
- Inline message and output-channel mirror should share the same semantic meaning and state label.

Message style rules:

- First line is always high-signal and state-led.
- Error messages include actionable location detail when available.
- Warning messages should explain impact and next best action.
- Info messages should indicate active progress without alarm.

### Form Patterns

Form surfaces in scope:

- VS Code extension settings
- Foundry companion module settings (native Foundry settings UI)

Validation behavior:

- **Inline validation + output-channel mirror** for config-related errors.
- Inline validation is immediate and specific.
- Output-channel mirror includes prefixed diagnostic context for later troubleshooting.

Validation content rules:

- Identify the exact invalid field or state.
- Provide one clear corrective action.
- Avoid vague failure language.

Settings consistency rules:

- Keep technical labels explicit (host, port, version, handshake state).
- Preserve deterministic value formatting.
- Avoid introducing custom form paradigms that differ from host ecosystems.

### Navigation Patterns

Primary navigation model is loop-based and recovery-first:

1. Write or edit cell
2. Run cell
3. Inspect result
4. Iterate or recover

Reconnect recovery priority:

- On connection failure, first suggested action is always **Reconnect**.
- If reconnect fails repeatedly, then surface targeted settings adjustments.
- Return users to the same notebook loop as soon as readiness is restored.

Command behavior consistency:

- Reconnect is idempotent and safe to repeat.
- Recovery commands should never leave the user in an ambiguous state.
- Every failure branch must end with a concrete next action.

### Additional Patterns

#### Loading States

Status headline uses concise host-consistent wording:

- `Connecting`

If supported by the VS Code ecosystem or context, provide tooltip detail:

- `Connecting to Foundry...`

Loading pattern rules:

- Keep inline or loading language short.
- Use tooltip or detail text for additional context, not primary labels.
- Never present loading without a visible current state.

#### Empty States

For V1, stay aligned with standard Jupyter behavior and avoid adding decorative empty-state messaging.

Pattern rule:

- Prefer neutral or empty baseline over custom explanatory empty cards.
- Only introduce explicit empty guidance if a real usability gap appears in testing.

#### Error Detail Disclosure

- Stack details are collapsed by default.
- Users can expand on demand.
- Error line should be highlighted in cell code.
- When available, show both executing cell line and called-function source line.

#### Log Identity Pattern

Output channel entries use a fixed identity prefix:

- `FOUNDRY-DCS`

Consistency rule:

- Prefix remains fixed across sessions and messages for reliable scan and search behavior.

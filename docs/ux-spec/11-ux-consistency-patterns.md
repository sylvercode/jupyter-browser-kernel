# UX Consistency Patterns

### Action Hierarchy

Primary actions:

- Run cell
- Reconnect

Secondary actions:

- Expand stack details
- Open output channel
- Open connection settings

Rule: prioritize actions that preserve notebook iteration flow.

### Feedback Patterns

Severity model:

- **Error:** execution or session-blocking condition
- **Warning:** degraded but recoverable condition
- **Info:** progress or neutral lifecycle state
- **Success:** completed execution or recovery

Delivery model:

- Inline feedback first for immediate comprehension.
- Output-channel mirror for continuity and troubleshooting.

Message style:

- First line must be state-led and high-signal.
- Errors include actionable next steps.
- Warnings explain impact and mitigation.

### Form and Settings Patterns

Settings in scope:

- Browser endpoint configuration
- Session behavior options

Validation rules:

- Identify exact invalid field.
- Provide one concrete corrective action.
- Keep terminology deterministic and profile-agnostic in core artifacts.

### Navigation Patterns

Primary loop:

1. Write or edit
2. Run
3. Inspect
4. Iterate or recover

Recovery rules:

- Reconnect is the first recovery suggestion when disconnected.
- Reconnect should be idempotent and safe to repeat.
- Every failure branch must end in a clear next action.

### Additional Patterns

Loading state:

- Keep labels concise (`Connecting`).
- Use details in tooltips or logs, not headline text.

Error detail disclosure:

- Keep stack details collapsed by default.
- Expand on demand.

Log identity:

- Use fixed core prefix `JBK` for intentional output.

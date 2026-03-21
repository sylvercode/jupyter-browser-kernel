# Responsive Design & Accessibility

### Responsive Strategy

Scope remains desktop-first within VS Code workbench contexts.

In-scope:

- Standard desktop editor and panel layouts
- Narrow pane scenarios with split editors and resized outputs

Out-of-scope for MVP:

- Mobile-specific and tablet-specific UX

Principles:

- Lean on VS Code native reflow behavior.
- Keep output contracts readable under constrained widths.
- Preserve full write-run-inspect usability in compact layouts.

### Breakpoint Strategy

No custom breakpoint system for MVP.

- Use host layout behavior.
- Keep labels concise and truncation-resistant.
- Favor progressive disclosure over dense always-visible detail.

### Accessibility Strategy

- Reuse host-native controls and semantics.
- Maintain text labels for all critical states.
- Preserve keyboard-first paths for primary actions.
- Avoid color-only communication.

### Testing Strategy

Responsive checks:

- Validate normal desktop layout and one narrow-pane scenario.
- Confirm run, inspect, and reconnect remain usable.

Accessibility checks:

- Keyboard sanity pass for core actions.
- Verify text readability for state and error messaging.
- Verify theme compatibility through semantic coloring.

### Implementation Guidelines

- Avoid custom layout engines.
- Keep diagnostics concise and copy-friendly.
- Preserve command palette access for key actions.

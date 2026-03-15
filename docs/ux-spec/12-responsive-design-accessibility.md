# Responsive Design & Accessibility


### Responsive Strategy

Product scope is desktop-only.

In-scope:

- Standard desktop VS Code windows
- Narrow desktop workspace layouts (panel resizing, split editors, reduced horizontal space)

Out-of-scope for V1:

- Tablet-specific UX
- Mobile-specific UX

Responsive behavior principles:

- Prefer host-native reflow behavior from VS Code surfaces.
- Keep extension-specific content compact and robust under panel narrowing.
- Preserve the write-run-verify loop even when notebook and output panes are constrained.

### Breakpoint Strategy

No numeric breakpoints are defined in-product.

Strategy:

- Defer layout breakpoint mechanics to VS Code's native workbench and panel management.
- Design extension content contracts to remain legible in both standard and compact host layouts.
- Avoid custom media-query-driven layout systems for V1.

### Accessibility Strategy

Accessibility strategy follows host alignment:

- Match VS Code baseline accessibility behavior and interaction conventions.
- Do not introduce custom accessibility models that diverge from VS Code norms in V1.
- Keep semantic text labels for core states where already defined by component contracts.
- Treat additional accessibility hardening beyond host baseline as a future enhancement unless required by observed usability issues.

### Testing Strategy

Minimal V1 testing approach:

Responsive checks:

- Validate behavior in normal desktop layout and at least one narrow panel configuration.
- Confirm core loop remains usable with resized notebook and output areas.

Accessibility checks:

- Basic keyboard sanity pass for default actionable interactions.
- Confirm command-palette-first workflows remain available for primary actions.
- Verify that state labels and core messages remain text-readable in default themes.

Testing scope note:

- No full assistive-tech matrix in V1.
- Expand testing depth post-MVP if user feedback indicates accessibility gaps.

### Implementation Guidelines

Responsive implementation:

- Use VS Code-native containers and avoid custom layout engines.
- Keep output lines and status copy concise to reduce truncation risk in narrow panes.
- Prefer progressive disclosure (for example, collapsed details) to preserve readability.

Accessibility implementation:

- Reuse host-native controls and semantics wherever possible.
- Ensure minimal default keyboard operability for visible actions.
- Keep command equivalents available for major actions (run, reconnect, open output or settings).
- Avoid color-only signaling for critical run states where a text label already exists.

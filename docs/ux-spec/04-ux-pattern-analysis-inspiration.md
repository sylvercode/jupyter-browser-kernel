# UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**VS Code (host environment)**  
The extension should inherit familiar workbench interactions: status bar state, command palette actions, notebook output, and diagnostics conventions.

**Jupyter notebooks**  
Jupyter establishes the expected flow: executable cells, inline results, and repeatable rerun behavior.

**VS Code diagnostics patterns**  
Users trust diagnostics that clearly identify cause, location, and next action.

### Transferable UX Patterns

- Cell-output co-location for immediate comprehension.
- Ambient status-bar state for connection lifecycle clarity.
- Consistent severity language for errors and warnings.
- Intentional logging streams for chronological debugging context.

### Anti-Patterns to Avoid

- Silent runs without visible success or failure.
- Mixed high-noise logs that obscure intentional output.
- Modal interruptions for routine connection state changes.
- Vague errors without message, stack, or source location.

### Design Inspiration Strategy

**Adopt:** native VS Code and notebook conventions.  
**Adapt:** source anchoring patterns for notebook execution contexts.  
**Avoid:** profile-specific assumptions in core UX artifacts.

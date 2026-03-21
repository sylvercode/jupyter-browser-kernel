# Design System Foundation

### Design System Choice

MVP uses a single host-native design surface:

- VS Code extension surfaces (status bar, notebook output, output channel, command palette, settings).

Profile-specific surfaces, including a Foundry companion module UI, are post-MVP and should be documented in profile-scoped UX artifacts.

### Rationale for Selection

- Zero-learning-curve leverage from native VS Code conventions.
- Lower implementation risk by avoiding custom component frameworks.
- Strong alignment with accessibility and theming inherited from VS Code.

### Implementation Approach

**VS Code surfaces:**

- Notebook output for result and error rendering.
- Status bar for connection lifecycle visibility.
- Output channel for intentional runtime logs.
- Settings and commands for endpoint and reconnect control.

### Customization Strategy

- No custom design token system in MVP.
- Information architecture and message contracts are the primary UX differentiators.
- Profile-specific UI language must remain additive and isolated from core-kernel vocabulary.

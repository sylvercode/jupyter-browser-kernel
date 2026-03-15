# Design System Foundation


### Design System Choice

This product spans two distinct design environments, each with its own native design system:

**Surface 1 - VS Code extension**: VS Code native extension UX patterns (notebook output, status bar, output channels, command palette, inline diagnostics).

**Surface 2 - Foundry companion module**: Foundry VTT's native module settings panel UI within the Foundry application.

### Rationale for Selection

- VS Code surface: users are already inside VS Code; every native pattern is zero-learning-curve UX leverage. V1 defers custom webview UI entirely, using `OutputChannel` and notebook cell output as the primary surfaces.
- Foundry surface: the companion module's settings page lives inside Foundry's own FormApplication UI. Foundry has its own established design vocabulary (module settings panels, form inputs, dialogs). The companion module must look and feel like a native Foundry module, not a foreign design import.

### Implementation Approach

**VS Code surfaces:**

- Notebook cell output: VS Code notebook output MIME types for structured text, errors, and metadata display.
- Connection status: VS Code status bar item with legible state labels and ambient color cues.
- Error output: structured text in cell results with name, message, line, column, and stack.
- Intentional script logging: VS Code `OutputChannel` - familiar, unobtrusive, developer-native.
- Module handshake feedback: status bar tooltip or command output - no modal interruption.

**Foundry companion module surface:**

- A minimal settings page within Foundry's module settings panel: the only required UX here for V1.
- Settings should follow Foundry's standard module settings registration patterns (using `game.settings.register`) so they render natively within Foundry's existing settings UI.
- V1 scope for this surface is intentionally minimal: version display, enable/disable state, and any runtime configuration the module needs to expose to the Foundry side.
- This surface should never compete visually with Foundry's own UI - it must feel like a natural extension of it.

### Customization Strategy

- VS Code surface: no custom design tokens or component libraries for V1. Information design focus only - what data to show, in what order, at what detail level.
- Foundry surface: use Foundry's native `game.settings` UI conventions. No custom HTML templates beyond what Foundry's settings system already provides for V1. Any future companion module UI expansion (for example a dedicated module configuration panel) is post-MVP scope.

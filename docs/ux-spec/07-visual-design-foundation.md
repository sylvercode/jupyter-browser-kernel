# Visual Design Foundation


### Color System

No custom brand color palette is defined for V1. The extension should use native VS Code theme definitions and semantic state coloration so user personalization remains respected across themes.

**Status Color Semantics (token-first, no hardcoded colors):**

- Connected/ready: use VS Code success/active semantic colors (typically green or blue depending on theme).
- Connecting: use a lower-emphasis variant of ready state (or default VS Code intermediate/active state styling).
- Handshake unsupported: use VS Code warning semantic color (typically yellow/amber).
- Missing module or execution error: use VS Code error semantic color (typically red).
- Disconnected/inactive: use VS Code inactive/disabled semantic styling (grayed).

Color strategy principle: rely on VS Code semantic tokens and component states first, so all user theme customization is automatically honored.

### Typography System

Typography remains fully native VS Code. The extension should not introduce custom typefaces or custom typographic branding for V1.

Typography hierarchy should be expressed through structure and semantic formatting:

- notebook output headings for sectioning
- concise labels for status and diagnostics
- consistent monospace rendering for code-adjacent values and error details

This keeps cognitive load low and preserves immediate familiarity for developers.

### Spacing & Layout Foundation

Target density is **balanced**: neither compressed log-dump density nor overly spacious presentation.

Layout principles:

- keep execution result, status, and error context close to the originating cell
- preserve scannability with clear section boundaries
- avoid large visual containers or modal surfaces that break notebook flow
- maintain consistent spacing rhythm across output blocks and status annotations

For the companion module settings surface in Foundry:

- follow Foundry's default settings layout and spacing conventions
- keep the module UI minimal and information-first

### Accessibility Considerations

Accessibility baseline follows the user's active VS Code theme. The extension should preserve semantic status signaling (success/warning/error/inactive) and avoid hardcoded color dependencies that could reduce theme accessibility.

Given user-managed theming in VS Code:

- the extension should remain theme-compliant by default
- strong contrast needs are expected to be addressed through the user's chosen VS Code theme configuration
- semantic indicators should always include textual meaning (not color alone) where practical in output/status messaging

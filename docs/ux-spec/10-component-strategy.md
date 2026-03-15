# Component Strategy


### Design System Components

The product continues with a native-first component strategy:

- VS Code native surfaces for status, notebook output, and output channel.
- Foundry native module settings UI for companion configuration.
- No custom webview component library in V1.

Foundation components reused from host systems:

- VS Code status bar item.
- VS Code notebook cell output rendering.
- VS Code output channel text stream.
- Foundry module settings form controls (`game.settings.register`-backed UI).

Coverage outcome:
Most UX is delivered by content contracts inside native components, not by introducing custom visual containers.

### Custom Components

### Status Headline Contract (A2)

**Purpose:** Provide one authoritative readiness headline at a time in the status bar.  
**Usage:** Always visible during connected workflow; updates on connection and handshake transitions.  
**Anatomy:** icon + state label + optional companion version token.  
**States:**

- `Disconnected`
- `Connecting`
- `Module Missing`
- `Ready $(companionVersion)`
- `Legacy $(companionVersion)`
- `Unsupported $(companionVersion)`

**Variants:** none in V1 (single-line status headline only).  
**Accessibility:** textual state always present; color is supplemental only.  
**Content Guidelines:** keep wording short, deterministic, and mutually exclusive.  
**Interaction Behavior:** state refreshes on reconnect, handshake completion, and module state changes.

### Cell Output Envelope Contract (B2)

**Purpose:** Make every run outcome instantly readable without metadata overload.  
**Usage:** Render for every cell execution result.  
**Anatomy:**

- Success: semantic result label + primary value
- Error: semantic error label + type + message + location anchor
- Optional metadata: duration (if enabled in extension settings)

**States:**

- Success
- Error
- Error with expanded stack details
- Error with collapsed stack details (default)

**Variants:**

- Duration shown (setting enabled)
- Duration hidden (setting disabled)

**Accessibility:**

- Semantic labels on all outputs (`Result`, `Error`)
- Error locations represented as text, not color-only cues
- Stack disclosure has keyboard-focusable toggle semantics

**Content Guidelines:**

- Keep the first line high-signal: status and error type
- Keep line and column visible without expansion
- Include called-function source line when resolvable, alongside executing cell line

**Interaction Behavior:**

- Stack trace collapsed by default
- User can expand stack details on demand
- Error line is highlighted in cell code
- When available, display both the cell line and underlying called-function line reference

### Output Log Entry Contract (C2)

**Purpose:** Provide intentional, grep-friendly runtime breadcrumbs in output channel.  
**Usage:** For `$f.log()` and other intentional extension-scoped runtime messages.  
**Anatomy:** fixed prefix + timestamp + payload text or value.  
**Prefix:** `FOUNDRY-DCS` (fixed, non-configurable in V1).  
**States:** info baseline in V1; severity shaping can be layered later if needed.  
**Accessibility:** plain-text readable format, no color dependency.  
**Content Guidelines:**

- Keep each entry single-line when practical
- Preserve chronological ordering
- Avoid noisy diagnostic duplication already shown in cell output

**Interaction Behavior:** append-only stream per session; supports copy and search workflows.

### Component Implementation Strategy

Foundation-first approach:

- Use host-native components for rendering and interaction mechanics.
- Implement custom behavior as formatting and state contracts over those primitives.

Contract-first priorities:

1. Status headline state machine mapped to connection and companion handshake outcomes.
2. B2 cell envelope formatter with optional duration and default-collapsed stack details.
3. In-cell error line emphasis with dual-location support (cell line + called-function line when available).
4. Fixed-prefix log formatter (`FOUNDRY-DCS`) for intentional output channel entries.

Consistency rules:

- One authoritative status headline at a time.
- One semantic output envelope per run.
- One fixed log identity prefix across all sessions.

### Implementation Roadmap

Phase 1 - Core Components (MVP-critical):

- Status Headline Contract (A2)
- Cell Output Envelope Contract (B2 baseline: result or error labels, message, line and column)
- Fixed Log Prefix Contract (C2 with `FOUNDRY-DCS`)

Phase 2 - Diagnostic Depth (still within V1 boundaries if capacity allows):

- Optional duration controlled by extension setting
- Collapsible stack disclosure in cell output (default collapsed)
- In-cell error highlighting with robust anchor behavior

Phase 3 - Precision Enhancements:

- Called-function source line display alongside cell line where trace mapping allows
- Additional polish for multi-error readability and copy or paste diagnostics hygiene

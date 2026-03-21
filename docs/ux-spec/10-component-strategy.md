# Component Strategy

### Design System Components

MVP relies on host-native components and explicit content contracts.

Foundation components:

- VS Code status bar item
- VS Code notebook output renderer
- VS Code output channel
- VS Code settings and command palette actions

### Contract Components

### Status Contract

**Purpose:** show one authoritative session state headline.  
**States:** `Disconnected`, `Connecting`, `Connected`, `Error`.  
**Behavior:** updates on connect, reconnect, disconnect, and session failures.  
**Accessibility:** textual labels are required; color is supplemental.

### Cell Output Envelope Contract

**Purpose:** make each run outcome immediately interpretable.  
**Success envelope:** result label plus value payload.  
**Error envelope:** error label, type, message, stack, and source location when available.  
**Behavior:** render on every run; keep structure consistent across transports.

### Intentional Output Contract

**Purpose:** capture user-intended runtime output distinctly from ambient browser noise.  
**Surface:** output channel and notebook output associations.  
**Prefix:** `JBK` (core-kernel identity prefix).  
**Behavior:** append chronologically; optimize for scan and search.

### Component Implementation Strategy

1. Implement status state machine and reconnect actions.
2. Implement normalized output envelope formatter.
3. Implement intentional output formatter and tagging.
4. Add optional progressive disclosure for stack depth and metadata.

### Implementation Roadmap

Phase 1 (MVP core):

- Status contract
- Output envelope contract
- Intentional output contract

Phase 2 (post-MVP core enhancements):

- Richer watched-value rendering
- Deeper drill-down interactions

Phase 3 (post-MVP profile enhancements):

- Profile-specific eligibility states and guidance
- Profile-specific output conventions where needed

# Design Direction Decision

### Design Directions Explored

Decision areas evaluated for MVP:

- **Decision A (Status signaling):** multi-indicator vs single authoritative status item
- **Decision B (Cell output envelope):** minimal free-form output vs labeled semantic envelope
- **Decision C (Intentional log line format):** unprefixed logs vs prefixed identity logs

### Chosen Direction

- **A2:** single authoritative status item
- **B2:** labeled semantic output envelope
- **C2:** prefixed intentional log entries

### Design Rationale

- Single status reduces ambient noise while preserving readiness clarity.
- Labeled envelopes make success and failure classes immediately legible.
- Prefixed log entries improve scanability and copy-search workflows.

### Implementation Approach

- Status item reflects connection lifecycle state and links to recovery actions.
- Notebook output always returns a structured result or structured error.
- Intentional logs use a fixed core prefix for reliable filtering.

Guardrails:

- Keep all presentation inside native VS Code surfaces.
- Preserve textual meaning alongside semantic color.
- Keep core language profile-agnostic; defer profile wording to post-MVP profile docs.

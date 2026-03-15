# Design Direction Decision


### Design Directions Explored

Step 9 evaluated focused implementation decisions inside fixed VS Code surfaces rather than inventing alternative layout systems. Three decision areas were explored:

- **Decision A (Status bar signaling):** A1 two-pill model vs A2 combined single-pill model.
- **Decision B (Cell output envelope):** B1 minimal output vs B2 labeled semantic output vs B3 structured metadata-rich envelope.
- **Decision C (Output channel line format):** C1 timestamp + value vs C2 prefixed source label + timestamp + value.

### Chosen Direction

The approved Step 9 direction is:

- **A2**: single combined status pill
- **B2**: labeled semantic cell output envelope
- **C2**: prefixed output channel entries

### Design Rationale

- **A2 (single-pill status):** favors compactness and lower status-bar footprint. The extension communicates one authoritative readiness headline at a time, reducing peripheral visual noise.
- **B2 (labeled semantic envelope):** balances clarity and speed. Each run communicates success or failure instantly with explicit labels and concise location-aware error detail, without adding heavy metadata to routine iterations.
- **C2 (prefixed logs):** improves scanability when users move between channels or copy/paste output. Each entry carries explicit source identity without relying on surrounding panel context.

This combination intentionally prioritizes explicitness and repeatable diagnostics over minimalism.

### Implementation Approach

For V1 implementation, apply the direction as follows:

- **Status bar item:** render a single dynamic pill string representing current state (disconnected, connecting, ready, unsupported, missing), with semantic iconography and color aligned to VS Code status conventions.
- **Notebook cell output:** standardize a labeled semantic envelope for every run. On success, render a clear result label and value. On failure, render error label/type, message, and line/column (plus stack summary when available).
- **Output channel formatting:** prepend each intentional `$f.log()` line with a source label and timestamp to create stable, grep-friendly diagnostics during longer sessions.

Guardrails:

- Keep all presentation inside native VS Code surfaces.
- Preserve the companion module UI in Foundry's native settings surface only.
- Maintain textual meaning alongside semantic color cues for accessibility and theme compatibility.

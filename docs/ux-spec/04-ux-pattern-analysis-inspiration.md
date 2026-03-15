# UX Pattern Analysis & Inspiration


### Inspiring Products Analysis

**VS Code (environment)**  
Users already know and trust VS Code. The extension's greatest UX advantage is that it inherits the entire VS Code interaction vocabulary: keyboard shortcuts, the Problems panel, inline error markers, status bar conventions, and command palette patterns. Users do not need to learn a new tool shell — they need to learn one new extension in a familiar container. The integrated error UX (red underlines, line/column markers, Problems list) sets a high standard for how execution failures should be surfaced in cell output.

**Jupyter Notebooks**  
Jupyter defines the mental model users bring to this product: write a snippet, run it, see the result inline, iterate. The speed and simplicity of the Jupyter cell loop is the interaction baseline users expect. Immediate visible output per cell, the ability to rerun any cell independently, and clear separation between code and its result are all patterns to preserve faithfully.

**VS Code Debug and Diagnostics UX**  
Inline error markers and the Problems panel demonstrate that errors are most scannable when they pinpoint location (file, line, column) and are visually anchored to the source. As macros grow more complex, users need more than raw output — they need structured observation through logging and value watching to understand what is happening inside a running script.

### Transferable UX Patterns

- **Cell-output co-location (Jupyter)**: output renders directly beneath its originating cell — adopt this as the primary execution feedback surface.
- **Inline error anchoring (VS Code)**: errors should include line/column and, where feasible, surface near their origin — not only in a separate panel.
- **Status bar ambient state (VS Code)**: persistent, low-noise status indicators in a familiar location communicate connection state without interrupting the editing flow.
- **Problems panel severity model (VS Code)**: distinguish error severity (syntax vs. runtime) clearly using familiar VS Code conventions so users recognize the class of failure immediately.
- **Incremental output logging (VS Code Output Channel)**: intentional log output separated from noise is a proven pattern for longer-running operations — apply this to `$f.log()` output.

### Anti-Patterns to Avoid

- **Silent execution (Foundry native editor)**: execution that produces no visible feedback — success or failure — destroys trust immediately. Every execution must produce observable output.
- **Undifferentiated console noise**: mixing intentional script output with unrelated browser log noise forces users to hunt for signal — this is exactly the problem we replace.
- **Modal or intrusive status alerts**: pop-up connection warnings or modal dialogs break focus during active iteration — ambient, persistent status is preferred.
- **Opaque errors without location**: errors that only say "something failed" without message, line, or column force the same guesswork that Foundry's editor already imposes.

### Design Inspiration Strategy

**Adopt:**

- Jupyter's cell-run-output visual contract as the execution feedback model.
- VS Code's Problems panel severity vocabulary for classifying execution errors.
- VS Code's status bar conventions for ambient connection state.

**Adapt:**

- VS Code's inline error markers — apply the principle (errors anchor to their source) within notebook cell output, rather than the literal editor gutter marker implementation, scoped to MVP feasibility.
- Jupyter's rerun model — add the constraint that rerunning must not trip on already-declared variables, making iteration more reliable than a raw notebook.

**Avoid:**

- Any pattern that mirrors Foundry's native macro editor: no silent runs, no undifferentiated output, no missing error location data.

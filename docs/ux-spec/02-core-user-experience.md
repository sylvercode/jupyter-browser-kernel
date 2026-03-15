# Core User Experience


### Defining Experience

The core experience of foundry-devil-code-sight is a tight write-run-verify loop for JavaScript macros executed against a live Foundry session. Users should be able to write code, execute immediately, observe clear results, and iterate without workflow interruption. The value is sustained momentum: less context switching, less uncertainty, faster refinement.

### Platform Strategy

The product is designed for desktop VS Code workflows and optimized for keyboard-and-mouse interaction. The execution model assumes an active browser connection to Foundry, making connection observability a first-class UX requirement rather than a background diagnostic detail.

### Effortless Interactions

- Writing and executing code should feel immediate and repeatable.
- Connection state should be obvious at a glance so users know whether executions can reach Foundry.
- Re-running snippets should be friction-resistant, minimizing state-collision interruptions that make iteration feel brittle.
- Output should clearly indicate what happened after each run so users never confuse execution failure with no-op behavior.

### Critical Success Moments

- First proof moment: user executes a snippet and immediately sees clear, trustworthy evidence that Foundry received and ran it.
- Trust moment: user can rerun and refine the same snippet multiple times without confusing state-related breakage.
- Failure cliff: when a user runs code and sees no clear effect or feedback, the product is perceived as buggy and unusable.

### Experience Principles

- Make execution outcomes unmistakable.
- Make connection status continuously legible.
- Preserve iteration flow over ceremony.
- Design for rerun confidence, not one-shot execution.

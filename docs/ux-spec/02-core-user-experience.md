# Core User Experience

### Defining Experience

The core experience is a tight write-run-verify loop for JavaScript cells executed from VS Code notebooks against a live browser execution target.

Users should be able to:

- run quickly,
- interpret output immediately,
- edit and rerun without losing context.

### Platform Strategy

The UX is desktop-first and VS Code-native. It relies on notebook output, status bar signaling, command palette recovery, and output-channel diagnostics rather than custom webview UI.

### Effortless Interactions

- Execution should feel immediate and repeatable.
- Connection state should be visible at a glance.
- Errors should be explicit, structured, and source-aware.
- Intentional output should be distinguishable from ambient browser noise.

### Critical Success Moments

- First proof: user runs a cell and sees a clear structured result inline.
- Confidence loop: user reruns edited cells repeatedly without ambiguity.
- Recovery proof: reconnect restores an executable session quickly.

### Experience Principles

- Make run outcomes unmistakable.
- Keep state visible but low-noise.
- Prefer recovery paths over dead ends.
- Preserve profile boundaries in language and interaction design.

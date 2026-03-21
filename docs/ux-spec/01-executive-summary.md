# Executive Summary

`jupyter-browser-kernel` is a VS Code extension UX centered on one promise: a fast, trustworthy write-run-inspect loop for JavaScript notebook cells against a live browser target.

The UX objective for MVP is profile-agnostic core-kernel clarity. Users should always know:

- whether they are connected,
- what happened after a run,
- how to recover when execution fails.

Foundry VTT remains an important example profile, but it is post-MVP from a UX-scope perspective.

### Target Users

Primary users are developers and advanced scripters who iterate JavaScript against live browser applications and value deterministic feedback over ad-hoc console workflows.

Secondary users are profile-specific power users (including Foundry macro authors) who adopt the same core UX loop once profile layers are added.

### Core UX Challenges

- Preserve momentum during repeated reruns without forcing setup churn.
- Make success, error, and intentional output unmistakable in-cell.
- Keep connection and reconnect state continuously legible.
- Separate core-kernel behavior from profile-specific guidance so the product can expand cleanly.

### UX Opportunities

- Make structured output the product's trust anchor.
- Make reconnect and target-eligibility recovery feel operationally lightweight.
- Turn notebooks into durable execution history for safe experimentation.
- Keep profile integration additive, not disruptive to the core loop.

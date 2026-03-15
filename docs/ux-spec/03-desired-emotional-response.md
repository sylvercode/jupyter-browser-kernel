# Desired Emotional Response


### Primary Emotional Goals

The dominant emotion after successful execution should be satisfaction — the quiet, grounded feeling of a craftsperson whose tool did exactly what was expected. Not excitement or relief, but the stable confidence of control. The product earns loyalty by making this feeling repeatable, not occasional.

### Emotional Journey Mapping

- Discovery / first run: cautious curiosity transitioning to proof — users need one clean execution to begin trusting the tool.
- During active iteration: calm focus — the connection is legible, output is clear, there is no noise demanding attention.
- On error: informed and steady — errors are clinical (exact location, cause, and actionable detail) and reassuring (nothing outside the notebook is broken).
- Returning to the tool: readiness — the extension feels already staged, connection state is visible immediately, and the user can dive back in without re-orienting.

### Micro-Emotions

- Target: confidence, calm, satisfaction, trust
- Acceptable: focus, efficiency, readiness
- Avoid: irritation from workarounds, confusion about execution state, anxiety about breaking Foundry state, frustration from workflow slowdowns introduced by the tool itself

### Design Implications

- Satisfaction → output must be structured and readable enough that users can immediately see success or identify failure without decoding raw CDP responses.
- Calm → connection status should be continuously legible without demanding attention; a persistent ambient indicator rather than modal alerts.
- Both (clinical + reassuring) on errors → error output should always include name, message, line/column, and stack where available; framing should imply "here is what happened and you can fix it" not "something exploded."
- Readiness → on reconnect or session resume, status should resolve quickly and visibly, so users arrive at a known state, not an uncertain one.

### Emotional Design Principles

- Never make the tool the source of friction it was built to eliminate.
- Calm is a feature: ambient status visibility over intrusive alerts.
- Trust is built through consistency: the same execution produces the same class of feedback every time.
- Errors are tools, not failures: treat them as diagnostic data, not alarming interruptions.

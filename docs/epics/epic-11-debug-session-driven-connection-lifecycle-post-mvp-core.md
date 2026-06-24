# Epic 11: Debug-Session-Driven Connection Lifecycle (Post-MVP Core)

**Goal:** Make the VS Code debug session the primary surface for establishing, reconnecting, and ending the browser execution connection. Connection endpoints are defined as debug configurations (`launch.json`), the debug toolbar drives the lifecycle (start = connect, restart = reconnect, stop = disconnect), and the standalone connect/disconnect/reconnect commands are retired. Workspace settings remain only as fallback defaults so zero-config launch still works.

**Dependencies:** Epic 1, Epic 2, Epic 10

**Stories:**

## Story 11.1: Configure CDP Endpoint via Debug Configuration Attributes

As a developer,
I want to define the CDP host and port inside a VS Code debug configuration,
So that I can keep one or more named, version-controlled connection profiles per project instead of a single workspace setting.

**Acceptance Criteria:**

**Given** a `jupyter-browser-kernel` debug configuration in `launch.json`
**When** the configuration declares `host` and/or `port` attributes
**Then** those values are used to resolve the CDP endpoint for that session
**And** the debugger `configurationAttributes` and snippets expose `host` and `port` with documented defaults.

**Given** a debug configuration that omits `host` or `port`
**When** the configuration is resolved
**Then** the missing value falls back to the corresponding `jupyterBrowserKernel.cdpHost` / `jupyterBrowserKernel.cdpPort` setting default
**And** an endpoint that is invalid after fallback fails with a clear, actionable diagnostic naming the offending field.

## Story 11.2: Connect on Debug Launch

As a developer,
I want pressing play on a connection debug configuration to establish the browser connection,
So that I no longer need a separate connect step before debugging or executing cells.

**Acceptance Criteria:**

**Given** no active browser connection
**When** the user starts a `jupyter-browser-kernel` debug session
**Then** the extension connects to the resolved CDP endpoint and reports `connecting` → `connected` state
**And** connection failures surface as actionable debug-session startup diagnostics and end the session cleanly.

**Given** an already-active connection or debug session
**When** the user starts a second `jupyter-browser-kernel` debug session
**Then** the second start is rejected with guidance that a single active connection is supported
**And** the existing session and connection remain unaffected.

## Story 11.3: Reconnect on Debug Restart

As a developer,
I want the debug "restart" control to re-establish the browser connection,
So that recovering after a target reload is a single familiar action.

**Acceptance Criteria:**

**Given** an active `jupyter-browser-kernel` debug session
**When** the user restarts the debug session
**Then** the extension tears down the prior connection and re-establishes it against the same configured endpoint
**And** notebook-cell breakpoints are rebound after reconnection.

**Given** a target that is unavailable at restart time
**When** reconnection is attempted
**Then** the restart reports failure with actionable guidance
**And** the session ends in a deterministic state without leaking the prior connection.

## Story 11.4: Disconnect on Debug Stop

As a developer,
I want stopping the debug session to disconnect the browser connection,
So that ending work is one action and does not leave a dangling session.

**Acceptance Criteria:**

**Given** an active `jupyter-browser-kernel` debug session
**When** the user stops or terminates the session
**Then** the browser connection is disconnected and connection state returns to `disconnected`
**And** adapter and transport resources are disposed deterministically.

**Given** browser DevTools attached to the same target
**When** the debug session stops
**Then** DevTools coexistence is preserved and DevTools is not forcibly detached
**And** a subsequent debug start can reconnect without a VS Code reload.

## Story 11.5: Prompt to Start a Debug Session When Running a Cell Without One

As a developer,
I want a one-click prompt to start a connection-bearing debug session when I run a cell without one,
So that I can run cells through a single, predictable entry point without the debugger booting silently.

**Acceptance Criteria:**

**Given** a Jupyter notebook is opened with no active debug session and no contributed connect command
**When** the notebook loads
**Then** the extension activates and registers the Browser Kernel notebook controller via a notebook activation event (`onNotebook:jupyter-notebook`)
**And** the Browser Kernel is selectable as a kernel without first starting a debug session or invoking any command.

**Given** no active `jupyter-browser-kernel` debug session
**When** the user runs a browser-kernel notebook cell
**Then** the extension prompts the user to start a session (it does not silently auto-start the debugger)
**And** choosing Start launches the default or user-selected connection debug configuration via `vscode.debug.startDebugging` and runs the cell once the connection reaches `connected`
**And** declining the prompt leaves the cell un-run with clear guidance, and if no configuration can be resolved the prompt explains how to define one.

**Given** an active connection-bearing debug session
**When** the user runs a notebook cell
**Then** the cell executes against that session's connection without prompting or starting an additional session
**And** execution results remain consistent with the Epic 2 result contract.

## Story 11.6: Retire Connect/Disconnect/Reconnect Commands and Migrate State Reporting

As a developer,
I want the legacy connect/disconnect/reconnect commands removed in favor of the debug lifecycle,
So that there is a single, unambiguous way to manage the connection.

**Acceptance Criteria:**

**Given** the debug-driven lifecycle is in place
**When** the extension contributes its commands
**Then** `jupyterBrowserKernel.connect`, `jupyterBrowserKernel.disconnect`, and `jupyterBrowserKernel.reconnect` are removed
**And** connection-state reporting (FR4 states) remains available and is driven by the debug session lifecycle.

**Given** the connect command is removed (which also removes its implicit `onCommand` activation event)
**When** the extension manifest is built
**Then** `onNotebook:jupyter-notebook` is added to `activationEvents` so the notebook controller is still registered when a notebook is opened
**And** the extension no longer relies on a command invocation to activate.

**Given** existing users with `jupyterBrowserKernel.cdpHost` / `cdpPort` settings
**When** they upgrade
**Then** those settings continue to act as fallback defaults for debug configurations that omit `host`/`port`
**And** documentation explains the migration from commands to the debug lifecycle.

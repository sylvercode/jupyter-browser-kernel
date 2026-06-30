# Jupyter Browser Kernel

Jupyter Browser Kernel is a VS Code extension for running JavaScript notebook cells against a live browser session over CDP (Chrome DevTools Protocol).

It is designed for fast write-run-inspect loops when iterating on browser-hosted workflows.

## Current Status

Jupyter Browser Kernel is `1.0.0`.

Release-ready capabilities include:

- JavaScript cell execution in `.ipynb` notebooks through the Browser Kernel controller.
- Debug-session-driven browser connection lifecycle.
- Source-level debugging support in Browser Kernel debug sessions.
- Per-cell isolation mode controls (isolated vs global execution mode).
- Intentional cell log capture via `$cell.log(...)`.

This release provides a stable baseline for JavaScript notebook execution against live browser targets in VS Code.

## Requirements

- VS Code `^1.92.0`
- Node.js + npm (for building/testing)
- A Chromium-based browser started with a remote debugging port (for example Edge or Chrome)
- Jupyter notebook support in VS Code (`ms-toolsai.jupyter`)

## Quick Start (Using the Extension)

1. Start your browser with CDP enabled.

Option 1: Use the browser inspection pages:

- `edge://inspect/#remote-debugging`
- `chrome://inspect/#remote-debugging`

Option 2: Start the browser from VS Code using debug type `msedge` or `chrome`.

Option 3: Start the browser manually with a remote debugging port.

Edge (example):

```bash
msedge --remote-debugging-port=9222 --remote-allow-origins=* --no-first-run --no-default-browser-check
```

Chrome (example):

```bash
google-chrome --remote-debugging-port=9222 --remote-allow-origins=* --no-first-run --no-default-browser-check
```

2. Open a `.ipynb` notebook in VS Code.
3. Select the notebook kernel **Browser Kernel**.
4. Add or verify a debug configuration in `.vscode/launch.json`:

   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "type": "jupyter-browser-kernel",
         "request": "launch",
         "name": "Browser Kernel Debug",
         "host": "localhost",
         "port": 9222
       }
     ]
   }
   ```

5. Start the **Browser Kernel Debug** session from Run and Debug.
6. Run JavaScript notebook cells.

If no active Browser Kernel debug session exists when executing a cell, the extension prompts you to start one.

## Execution Modes

Cell execution supports two modes:

- Isolated mode (default):
  - Executes in an isolated async wrapper.
  - Variables declared in a cell stay in that cell run's own scope, so they do not clash across multiple reruns.
  - Supports `$cell.log(...)` intentional logs.
- Global mode:
  - Executes in the page global scope.
  - Does not inject the `$cell` bridge.

You can toggle mode from notebook cell actions:

- `Jupyter Browser Kernel: Toggle Cell Isolation`
- `Isolated mode`
- `Global mode`
- `Use Default Cell Isolation`

## Settings

The extension contributes these settings:

- `jupyterBrowserKernel.cdpHost` (default: `localhost`)
- `jupyterBrowserKernel.cdpPort` (default: `9222`)
- `jupyterBrowserKernel.watchAutoRefreshInterval` (default: `0`, disabled)
- `jupyterBrowserKernel.defaultCellIsolation` (`isolated` or `global`, default: `isolated`)

`cdpHost` and `cdpPort` are used as fallback defaults when omitted from a debug configuration.

## Developer Setup

```bash
npm install
npm run compile
```

Run in watch mode:

```bash
npm run watch
```

Lint:

```bash
npm run lint
```

Tests:

```bash
npm run test
npm run test:integration
npm run test:integration:cdp
```

Launch extension development host in VS Code:

- Press `F5`.

## Packaging

Build and package as VSIX:

```bash
npm run package:vsix
```

## Repository Structure

- `src/` extension source code
- `tests/` unit and integration tests
- `docs/` PRD, architecture, epics, and stories
- `spike/` technical spike findings

## Documentation

- Product requirements: `docs/prd.md`
- Architecture: `docs/architecture.md`
- Product brief: `docs/product-brief.md`
- Epic index: `docs/epics/index.md`

## License

MIT

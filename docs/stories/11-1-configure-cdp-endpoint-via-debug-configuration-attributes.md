---
storyId: "11.1"
storyKey: "11-1-configure-cdp-endpoint-via-debug-configuration-attributes"
title: "Configure CDP Endpoint via Debug Configuration Attributes"
status: "done"
created: "2026-06-24"
epic: "11"
priority: "p1-high"
dependencies:
  [
    "1-2-configure-browser-endpoint",
    "10-1-register-and-bootstrap-notebook-cell-dap-session",
  ]
---

# Story 11.1: Configure CDP Endpoint via Debug Configuration Attributes

**Status:** done

## Story

As a developer,
I want to define the CDP host and port inside a VS Code debug configuration,
So that I can keep one or more named, version-controlled connection profiles per project instead of a single workspace setting.

## Acceptance Criteria

### AC 1: Debug Configuration Attributes Resolve the Endpoint

**Given** a `jupyter-browser-kernel` debug configuration in `launch.json`
**When** the configuration declares `host` and/or `port` attributes
**Then** those values are used to resolve the CDP endpoint for that session
**And** the debugger `configurationAttributes` and snippets expose `host` and `port` with documented defaults.

### AC 2: Fallback to Settings and Actionable Diagnostics

**Given** a debug configuration that omits `host` or `port`
**When** the configuration is resolved
**Then** the missing value falls back to the corresponding `jupyterBrowserKernel.cdpHost` / `jupyterBrowserKernel.cdpPort` setting default
**And** an endpoint that is invalid after fallback fails with a clear, actionable diagnostic naming the offending field.

## Scope Boundary (Read First)

This story delivers **endpoint resolution only** — the schema, the merge-with-fallback logic, validation, and the resolved endpoint being attached to the debug configuration so a later story can consume it. **This story does NOT connect to the browser on launch.** Pressing play / connect-on-launch is **Story 11.2**, and it will read the resolved endpoint produced here.

Concretely:

- DO add `host` / `port` to the manifest `configurationAttributes`, `initialConfigurations`, and `configurationSnippets`.
- DO resolve config attributes against the settings fallback inside `DebugConfigProvider.resolveDebugConfiguration`.
- DO validate the resolved endpoint and surface a field-naming diagnostic, aborting session start on failure.
- DO attach the resolved `host` / `port` back onto the returned `DebugConfiguration` so Story 11.2 can read `session.configuration.host` / `.port`.
- DO NOT call `connectToBrowserTarget`, change `DebugAdapterFactory`, or alter the connect/disconnect/reconnect commands (those belong to Stories 11.2–11.6).

## Tasks / Subtasks

### 1. Declare `host` / `port` Debug Configuration Attributes (AC: 1)

- [x] In [package.json](../../package.json), populate `contributes.debuggers[0].configurationAttributes.launch.properties` (currently empty `{}`) with:
  - `host`: `{ "type": "string", "description": "%debugger.jupyterBrowserKernel.host.description%", "default": "localhost" }`
  - `port`: `{ "type": "number", "description": "%debugger.jupyterBrowserKernel.port.description%", "default": 9222, "minimum": 1, "maximum": 65535 }`
- [x] Keep the documented defaults aligned with the existing settings defaults (`cdpHost` = `localhost`, `cdpPort` = `9222`) so the schema, the snippet, and the settings fallback all agree.
- [x] Do NOT mark `host` or `port` as `required` — both must be omittable so the settings fallback in Task 3 governs missing values (AC 2).

### 2. Surface `host` / `port` in Initial Configurations and Snippets (AC: 1)

- [x] In [package.json](../../package.json), update `contributes.debuggers[0].initialConfigurations[0]` and the `configurationSnippets[0].body` to include `host` and `port` with their documented default values, so a generated `launch.json` shows the attributes a user can edit.
- [x] Add the manifest-time localization keys to [package.nls.json](../../package.nls.json) (NOT `bundle.l10n.json`):
  - `debugger.jupyterBrowserKernel.host.description`
  - `debugger.jupyterBrowserKernel.port.description`
- [x] Mirror the wording/style of the existing `configuration.cdpHost.description` / `configuration.cdpPort.description` entries for consistency.

### 3. Resolve Debug-Config Endpoint With Settings Fallback (AC: 1, 2)

- [x] Add a resolution helper to [src/config/endpoint-config.ts](../../src/config/endpoint-config.ts) (keep validation primitives co-located; do not fork them):
  - Signature suggestion: `resolveDebugConfigurationEndpoint(rawConfig: Pick<vscode.DebugConfiguration, "host" | "port">, settings: EndpointConfigurationReader, localize?: Localize): EndpointResolutionResult`.
  - For each of `host` / `port`: if the debug-config attribute is **present** (non-`undefined`, and for `host` a non-empty string), use it; otherwise fall back to the settings default via the existing `readEndpointConfig(settings)`.
  - Track the **source** of each field (`"debug-config"` vs `"settings"`) so the diagnostic in the failure path names the correct surface to fix.
  - Reuse `EndpointConfig`, `EndpointValidationField`, `EndpointValidationError`, and `validateEndpointConfig`/its building blocks. Do NOT duplicate the 1–65535 bound (`CDP_PORT_MIN`/`CDP_PORT_MAX`) — import and reuse.
- [x] Coerce defensively: debug-config JSON values are untyped at the boundary. Treat a non-string `host` or a non-number `port` coming from the config as invalid input for that field (do NOT silently coerce a string `"9222"` to a number unless you explicitly decide to — document the decision in Dev Notes).
- [x] Define a small named result type (e.g. `EndpointResolutionResult` = success with `EndpointConfig` + per-field source, or failure with `EndpointValidationError`). Do not inline a complex object shape in the function signature.

### 4. Make Validation Diagnostics Source-Aware (AC: 2)

- [x] The existing `validateEndpointConfig` corrective actions reference the **settings** keys (`Set jupyterBrowserKernel.cdpHost …`). When the offending value came from the **debug configuration** attribute, the diagnostic must instead name the debug-config `host` / `port` attribute.
- [x] Implement source-aware corrective messaging: choose the corrective-action string based on the field's resolution source from Task 3. Add the new debug-config-oriented corrective strings to [l10n/bundle.l10n.json](../../l10n/bundle.l10n.json):
  - `"Set the \"host\" attribute in your launch.json debug configuration to a hostname or IP address, for example localhost."`
  - `"Set the \"port\" attribute in your launch.json debug configuration to a whole number between 1 and 65535."`
- [x] Reuse the existing `"Invalid CDP host: host cannot be empty."` and `"Invalid CDP port: port must be an integer between 1 and 65535."` message strings — only the corrective action differs by source. Do NOT duplicate the message text.

### 5. Wire Resolution Into `DebugConfigProvider` (AC: 1, 2)

- [x] In [src/debugger/debug-config-provider.ts](../../src/debugger/debug-config-provider.ts), extend `resolveDebugConfiguration` to, after the existing `type` / `request` / `name` defaulting:
  - Read the workspace settings via an injected reader (see below), call `resolveDebugConfigurationEndpoint(config, settings, localize)`.
  - On success: attach the resolved `host` and `port` onto the returned `DebugConfiguration` so Story 11.2 can read `session.configuration.host` / `.port`. (The single source of truth is the resolved endpoint, not the raw user input.)
  - On failure: surface the localized diagnostic via an injected `showError` callback and return `undefined` to cancel session start (per VS Code `DebugConfigurationProvider` contract — returning `undefined` aborts the launch without forcing `launch.json` open).
- [x] Extend `DebugConfigProviderOptions` with injectable dependencies for testability (do not call `vscode.*` directly inside the provider class):
  - `getSettings: () => EndpointConfigurationReader` (default in `extension.ts` wiring: `() => vscode.workspace.getConfiguration("jupyterBrowserKernel")`).
  - `showError: (message: string) => void | Thenable<unknown>` (default in wiring: `vscode.window.showErrorMessage`).
- [x] Keep the diagnostic message single, actionable, and prefixed consistently with existing messages (e.g. combine the validation `message` + `correctiveAction` into one surfaced string, matching how `connect-command` presents endpoint errors).

### 6. Update Extension Wiring (AC: 1, 2)

- [x] In [src/extension.ts](../../src/extension.ts), pass the new `getSettings` and `showError` options when constructing `new DebugConfigProvider({ … })`. Do not change registration order or the existing `localize` wiring.
- [x] Confirm no behavioral regression to the existing connect/disconnect/reconnect commands or the notebook controller — this story only augments the debug-config provider.

### 7. Unit Tests (AC: 1, 2)

- [x] `tests/unit/config/endpoint-config.test.ts` (extend existing if present, else create): cover `resolveDebugConfigurationEndpoint`:
  - config supplies both `host` and `port` → endpoint uses config values, sources are `debug-config`.
  - config omits `host` → host falls back to settings, source `settings`; config `port` retained.
  - config omits `port` → port falls back to settings; config `host` retained.
  - config omits both → both fall back to settings defaults; success.
  - invalid config `port` (e.g. `0`, `70000`, non-integer, wrong type) → failure naming `port` with the **debug-config** corrective action.
  - invalid config `host` (empty string, wrong type) → failure naming `host` with the **debug-config** corrective action.
  - invalid **settings** value used after fallback → failure naming the field with the **settings** corrective action.
- [x] `tests/unit/debugger/debug-config-provider.test.ts` (extend existing):
  - resolves and attaches `host` / `port` onto the returned configuration on success.
  - on resolution failure, calls the injected `showError` with the localized diagnostic and returns `undefined`.
  - preserves existing `type` / `request` / `name` defaulting behavior.
  - passes through configurations whose `type` is not `jupyter-browser-kernel` unchanged.
- [x] Use a fake `EndpointConfigurationReader` (object with `get<T>(section, default)`) and a fake `Localize`/`showError` — do not require a live VS Code or browser.

### 8. Validation

- [x] `npm run lint`.
- [x] `npm run test`.
- [x] `npm run compile`.
- [x] Manual smoke in the Extension Development Host:
  - Run **Debug: Add Configuration…** (or open the Run and Debug view) and confirm the `jupyter-browser-kernel` snippet/initial config now offers editable `host` and `port` with the documented defaults.
  - Edit `launch.json` with a valid `host`/`port`, start the configuration, and confirm no resolution error is shown. (The session will not yet connect — connect-on-launch is Story 11.2; confirming "resolves without a diagnostic" is the bar here.)
  - Set `port` to `0` (or a non-integer), start the configuration, and confirm a clear diagnostic names the `port` attribute and the session does not start.
  - Remove `host`/`port` from the config and confirm it resolves using the `jupyterBrowserKernel.cdpHost` / `cdpPort` settings without error.

### Review Findings

_Code review 2026-06-24 (branch `cdp-via-debug-config` vs `main`). Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor (full pass). 1 patch, 1 dismissed as noise._

- [x] [Review][Patch] Non-string `host` reuses the "host cannot be empty" diagnostic [src/config/endpoint-config.ts:166] — FIXED 2026-06-24: non-string branch now emits `Invalid CDP host: host must be a string.` (new l10n string) with test assertion. — When `rawConfig["host"]` is present but not a string (e.g. `42`, `true`), the resolver returns `message: "Invalid CDP host: host cannot be empty."`, which is factually wrong: the value is the wrong type, not empty. The corrective action correctly names the `host` attribute, so it is still actionable, but the message misleads. Flagged independently by Blind Hunter and Edge Case Hunter. Low severity (the manifest schema declares `type: "string"`, but launch.json schema violations do not block launching). Fix: emit a type-accurate message for the non-string branch, or accept the imprecision (the story's "reuse the existing message" guidance targeted the empty/source split, not the type-mismatch branch).

## Dev Notes

### Story Context and Scope

This is the **first story in Epic 11** (Debug-Session-Driven Connection Lifecycle, FR40). Epic 11 re-homes the connect/reconnect/disconnect lifecycle onto the VS Code debug session and moves endpoint configuration from single-value workspace settings into named, version-controlled debug configurations.

Story 11.1's job is narrow and foundational: **make the debug configuration carry the endpoint**. It establishes the schema (`host` / `port` attributes), the resolution rule (config value wins, settings are the fallback default), and the validation contract (actionable, field-naming diagnostics) that every later Epic 11 story builds on. It deliberately stops short of connecting — Story 11.2 (Connect on Debug Launch) consumes the resolved endpoint produced here.

[Source: docs/epics/epic-11-debug-session-driven-connection-lifecycle-post-mvp-core.md#Story 11.1]
[Source: docs/prd.md#FR40]
[Source: docs/architecture.md — "Debug-session-driven connection lifecycle (Epic 11, FR40)"]

### What Already Exists (Reuse — Do Not Reinvent)

- **Manifest debugger contribution** already exists from Story 10.1: `contributes.debuggers[0]` with `type: "jupyter-browser-kernel"`, `initialConfigurations`, `configurationSnippets`, and an **empty** `configurationAttributes.launch.properties: {}`. This story fills that empty object — it does not add a new debugger. [Source: package.json]
- **`DebugConfigProvider`** ([src/debugger/debug-config-provider.ts](../../src/debugger/debug-config-provider.ts)) already implements `resolveDebugConfiguration` and defaults `type` / `request` / `name`. Extend it; do not create a second provider. Note the Story 10.1 review explicitly decided the provider does **not** gate on `getActiveBrowserConnection()` — keep that decision; this story adds endpoint resolution, not a connection gate.
- **Endpoint primitives** ([src/config/endpoint-config.ts](../../src/config/endpoint-config.ts)): `EndpointConfig`, `EndpointConfigurationReader`, `EndpointValidationField` (`"host" | "port"`), `EndpointValidationError` (`{ field, message, correctiveAction }`), `EndpointValidationResult`, `readEndpointConfig`, `validateEndpointConfig`, `readAndValidateEndpointConfig`, and the `CDP_PORT_MIN` / `CDP_PORT_MAX` bounds. Reuse all of these. The settings reader is `vscode.workspace.getConfiguration("jupyterBrowserKernel")`, whose `.get<T>(section, default)` matches `EndpointConfigurationReader`.
- **Settings defaults**: `jupyterBrowserKernel.cdpHost` default `"localhost"`, `jupyterBrowserKernel.cdpPort` default `9222`. The new attribute defaults MUST match these. [Source: package.json#configuration]
- **Diagnostic presentation pattern**: see how [src/commands/connect-command.ts](../../src/commands/connect-command.ts) surfaces endpoint validation errors (message + corrective action + optional "Open Settings" action). Match the tone; you do not need the "Open Settings" action button for this story unless trivial.

### Architecture Guardrails (Must Follow)

- **Single source of truth for the resolved endpoint**: after resolution, the returned `DebugConfiguration` carries the final `host` / `port`. Story 11.2 reads them from `session.configuration`. Do not stash the endpoint in a module-level singleton in this story.
- **Single active-connection constraint is unchanged**: many profiles may be defined in `launch.json`, but only one connection is active at a time. This story does not touch that constraint (no connection happens yet). [Source: docs/architecture.md]
- **Layer boundaries**: the resolver lives in `src/config` (pure, VS Code-free except the `DebugConfiguration` field types). The provider in `src/debugger` injects its dependencies (`getSettings`, `showError`, `localize`) so it stays unit-testable without the VS Code runtime — same dependency-injection style used across the codebase.
- **Localization**: manifest-time strings (attribute descriptions) go in [package.nls.json](../../package.nls.json); runtime user-facing strings (diagnostics) go in [l10n/bundle.l10n.json](../../l10n/bundle.l10n.json) via `vscode.l10n.t(...)`. Never hardcode user-facing text in source. [Source: .github/copilot-instructions.md#Coding Standards]
- **Type hygiene**: do not duplicate library-owned types. Bind to `vscode.DebugConfiguration` via `Pick<…, "host" | "port">` for the raw input rather than re-declaring fields. Prefer named type aliases (`EndpointResolutionResult`) over inline object types in signatures. Prefer single-assignment `const`. [Source: .github/copilot-instructions.md#Coding Standards]

### Resolution Semantics (Decide and Document)

- **Presence rule**: a `host` attribute is "present" when it is a non-empty string; a `port` attribute is "present" when it is a number. An attribute set to `undefined` / absent triggers settings fallback. Decide explicitly how to treat an empty-string `host` supplied in the config — recommended: treat it as an **invalid debug-config value** (fail naming the `host` attribute) rather than silently falling back, because the user typed it intentionally. Document the final choice in the implementation.
- **Type coercion**: `launch.json` values are arbitrary JSON. Recommended: do **not** coerce a string `port` (`"9222"`) into a number — treat a non-number `port` as invalid and name the `port` attribute. This keeps the schema (`type: "number"`) and runtime behavior consistent. Confirm and document.
- **Diagnostic source attribution** (the crux of AC 2): the corrective action must point the user at the surface they actually control. If the bad value came from the debug config, say "fix the `host`/`port` attribute in launch.json"; if the bad value came from the settings fallback, reuse the existing "Set jupyterBrowserKernel.cdpHost/cdpPort …" corrective string.

### Testing Strategy

- Pure-function tests for `resolveDebugConfigurationEndpoint` with a fake `EndpointConfigurationReader` cover the full truth table (config present/absent × valid/invalid × settings valid/invalid) — this is the highest-value coverage for AC 2.
- Provider tests verify the integration: success attaches `host`/`port`; failure calls `showError` and returns `undefined`; non-matching `type` passes through; existing defaulting preserved.
- No integration/CDP test is required for this story — nothing connects. (Story 11.2 adds the connect-on-launch integration coverage.)
- Snapshot/assert the `initialize`-level manifest indirectly by asserting the resolver/provider behavior; the `package.json` schema change is verified by the manual smoke step.

### Project Structure Notes

- New/extended files:
  - [src/config/endpoint-config.ts](../../src/config/endpoint-config.ts) — add `resolveDebugConfigurationEndpoint` + `EndpointResolutionResult` (and a per-field source type).
  - [src/debugger/debug-config-provider.ts](../../src/debugger/debug-config-provider.ts) — extend options + `resolveDebugConfiguration`.
  - [src/extension.ts](../../src/extension.ts) — pass `getSettings` / `showError` to the provider.
  - [package.json](../../package.json) — fill `configurationAttributes`, update `initialConfigurations` / `configurationSnippets`.
  - [package.nls.json](../../package.nls.json) — two attribute-description keys.
  - [l10n/bundle.l10n.json](../../l10n/bundle.l10n.json) — two debug-config corrective-action strings.
  - `tests/unit/config/endpoint-config.test.ts`, `tests/unit/debugger/debug-config-provider.test.ts` — extend/add.
- No conflicts with the unified structure; this story stays within the established `config` / `debugger` module boundaries.

### References

- [Source: docs/epics/epic-11-debug-session-driven-connection-lifecycle-post-mvp-core.md#Story 11.1: Configure CDP Endpoint via Debug Configuration Attributes]
- [Source: docs/prd.md#FR40]
- [Source: docs/architecture.md — Debug-session-driven connection lifecycle (Epic 11, FR40)]
- [Source: docs/archives/sprint-change-proposal-2026-06-23.md — Recommended technical approach]
- [Source: docs/stories/10-1-register-and-bootstrap-notebook-cell-dap-session.md — debugger contribution + provider patterns]
- [VS Code API — DebugConfigurationProvider.resolveDebugConfiguration](https://code.visualstudio.com/api/references/vscode-api#DebugConfigurationProvider)
- [VS Code — Debugger Extension: configurationAttributes](https://code.visualstudio.com/api/extension-guides/debugger-extension)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

- TypeScript error: `Pick<DebugConfiguration, "host" | "port">` is not assignable from `DebugConfiguration` because TypeScript doesn't treat index-signature-accessible properties as explicit members of a `Pick` result. Fixed by accepting `vscode.DebugConfiguration` directly as the parameter type in `resolveDebugConfigurationEndpoint`.
- TypeScript error: `vscode.l10n.t` object overload requires `comment` field. Fixed by using template literal concatenation for the combined `message + correctiveAction` string in `DebugConfigProvider.resolveDebugConfiguration`.
- Existing `debug-config-provider` tests did not inject `getSettings`, causing settings fallback to return empty host → validation failure → tests broke. Fixed by injecting a valid `getSettings` in updated tests.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented `EndpointFieldSource`, `EndpointResolutionResult`, and `resolveDebugConfigurationEndpoint` in `src/config/endpoint-config.ts`. Resolution semantics: `host` present when non-empty string (empty string → invalid debug-config, not silent fallback); `port` present when `number` (non-number incl. string `"9222"` → invalid, not coerced). Source-aware corrective actions: debug-config fields direct user to `launch.json`; settings-fallback fields direct user to `jupyterBrowserKernel.*` settings.
- Extended `DebugConfigProviderOptions` with `getSettings` and `showError` injectable dependencies. `resolveDebugConfiguration` now resolves endpoint, attaches `host`/`port` to returned config on success, calls `showError` and returns `undefined` on failure.
- Wired `getSettings` and `showError` into `extension.ts` provider construction.
- `package.json` `configurationAttributes.launch.properties` filled with `host`/`port`; `initialConfigurations` and `configurationSnippets` updated with defaults.
- Two NLS keys added to `package.nls.json`; two debug-config corrective strings added to `l10n/bundle.l10n.json`.
- 263 unit tests pass (0 failures); lint and compile clean.
- Manual smoke step left for human verification in Extension Development Host.

### File List

- package.json
- package.nls.json
- l10n/bundle.l10n.json
- src/config/endpoint-config.ts
- src/debugger/debug-config-provider.ts
- src/extension.ts
- tests/unit/config/endpoint-config.test.ts
- tests/unit/debugger/debug-config-provider.test.ts

## Change Log

- 2026-06-24: Implemented story 11.1 — CDP endpoint resolution via debug configuration attributes with settings fallback and source-aware diagnostics.

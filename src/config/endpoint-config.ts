import type * as vscode from "vscode";

export const CDP_PORT_MIN = 1;
export const CDP_PORT_MAX = 65535;

export type Localize = typeof vscode.l10n.t;

export type EndpointValidationField = "host" | "port";

export interface EndpointConfig {
  host: string;
  port: number;
}

export interface EndpointConfigurationReader {
  get<T>(section: string, defaultValue: T): T;
}

export interface EndpointValidationError {
  field: EndpointValidationField;
  message: string;
  correctiveAction: string;
}

export type EndpointValidationResult =
  | { ok: true; endpoint: EndpointConfig }
  | { ok: false; error: EndpointValidationError };

const defaultLocalize = ((
  messageOrOptions: string | { message: string },
): string =>
  typeof messageOrOptions === "string"
    ? messageOrOptions
    : messageOrOptions.message) as Localize;

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function readEndpointConfig(
  config: EndpointConfigurationReader,
): EndpointConfig {
  const rawHost = config.get<string>("cdpHost", "");
  const host = (typeof rawHost === "string" ? rawHost : "").trim();

  const rawPort = config.get<number>("cdpPort", Number.NaN);
  const port = typeof rawPort === "number" ? rawPort : Number.NaN;

  return {
    host,
    port,
  };
}

export function validateEndpointConfig(
  endpoint: EndpointConfig,
  localize: Localize = defaultLocalize,
): EndpointValidationResult {
  if (endpoint.host.trim().length === 0) {
    return {
      ok: false,
      error: {
        field: "host",
        message: localize("Invalid CDP host: host cannot be empty."),
        correctiveAction: localize(
          "Set jupyterBrowserKernel.cdpHost to a hostname or IP address, for example localhost.",
        ),
      },
    };
  }

  if (
    !Number.isInteger(endpoint.port) ||
    endpoint.port < CDP_PORT_MIN ||
    endpoint.port > CDP_PORT_MAX
  ) {
    return {
      ok: false,
      error: {
        field: "port",
        message: localize(
          "Invalid CDP port: port must be an integer between 1 and 65535.",
        ),
        correctiveAction: localize(
          "Set jupyterBrowserKernel.cdpPort to a whole number between 1 and 65535.",
        ),
      },
    };
  }

  return {
    ok: true,
    endpoint: {
      host: endpoint.host.trim(),
      port: endpoint.port,
    },
  };
}

export function readAndValidateEndpointConfig(
  config: EndpointConfigurationReader,
  localize?: Localize,
): EndpointValidationResult {
  return validateEndpointConfig(readEndpointConfig(config), localize);
}

export type EndpointFieldSource = "debug-config" | "settings";

export type EndpointResolutionResult =
  | {
      ok: true;
      endpoint: EndpointConfig;
      sources: Record<EndpointValidationField, EndpointFieldSource>;
    }
  | { ok: false; error: EndpointValidationError };

/**
 * Resolve the CDP endpoint for a debug configuration.
 *
 * Resolution semantics (documented):
 * - `host`: present when a non-empty string; empty string → invalid debug-config value
 *   (fail naming the attribute); `undefined` → settings fallback; any other type → invalid.
 * - `port`: present when a `number`; `undefined` → settings fallback; any other type
 *   (including a string such as `"9222"`) → invalid debug-config value. We do NOT coerce
 *   string ports to numbers so that the schema (`type: "number"`) and runtime behaviour agree.
 *
 * When a field's resolved value fails validation the corrective action names the surface the
 * user should fix: the debug configuration attribute or the workspace setting.
 */
export function resolveDebugConfigurationEndpoint(
  rawConfig: vscode.DebugConfiguration,
  settings: EndpointConfigurationReader,
  localize: Localize = defaultLocalize,
): EndpointResolutionResult {
  // --- host resolution ---
  const rawHost: unknown = rawConfig["host"];
  let resolvedHost: string;
  let hostSource: EndpointFieldSource;

  if (rawHost === undefined) {
    resolvedHost = readEndpointConfig(settings).host;
    hostSource = "settings";
  } else if (typeof rawHost === "string") {
    if (rawHost.length === 0) {
      return {
        ok: false,
        error: {
          field: "host",
          message: localize("Invalid CDP host: host cannot be empty."),
          correctiveAction: localize(
            'Set the "host" attribute in your launch.json debug configuration to a hostname or IP address, for example localhost.',
          ),
        },
      };
    }
    resolvedHost = rawHost.trim();
    hostSource = "debug-config";
  } else {
    return {
      ok: false,
      error: {
        field: "host",
        message: localize("Invalid CDP host: host must be a string."),
        correctiveAction: localize(
          'Set the "host" attribute in your launch.json debug configuration to a hostname or IP address, for example localhost.',
        ),
      },
    };
  }

  // --- port resolution ---
  const rawPort: unknown = rawConfig["port"];
  let resolvedPort: number;
  let portSource: EndpointFieldSource;

  if (rawPort === undefined) {
    resolvedPort = readEndpointConfig(settings).port;
    portSource = "settings";
  } else if (typeof rawPort === "number") {
    resolvedPort = rawPort;
    portSource = "debug-config";
  } else {
    return {
      ok: false,
      error: {
        field: "port",
        message: localize(
          "Invalid CDP port: port must be an integer between 1 and 65535.",
        ),
        correctiveAction: localize(
          'Set the "port" attribute in your launch.json debug configuration to a whole number between 1 and 65535.',
        ),
      },
    };
  }

  // --- validate merged endpoint with source-aware corrective actions ---
  const validation = validateEndpointConfig(
    { host: resolvedHost, port: resolvedPort },
    localize,
  );

  if (!validation.ok) {
    const { field, message } = validation.error;
    const source = field === "host" ? hostSource : portSource;
    const correctiveAction =
      source === "debug-config"
        ? localize(
            field === "host"
              ? 'Set the "host" attribute in your launch.json debug configuration to a hostname or IP address, for example localhost.'
              : 'Set the "port" attribute in your launch.json debug configuration to a whole number between 1 and 65535.',
          )
        : validation.error.correctiveAction;

    return { ok: false, error: { field, message, correctiveAction } };
  }

  return {
    ok: true,
    endpoint: validation.endpoint,
    sources: { host: hostSource, port: portSource },
  };
}

export function summarizeEndpointForDisplay(endpoint: EndpointConfig): string {
  const host = isLoopbackHost(endpoint.host)
    ? endpoint.host
    : "[redacted-host]";
  return `${host}:${endpoint.port}`;
}

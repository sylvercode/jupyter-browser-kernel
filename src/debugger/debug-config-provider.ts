import type * as vscode from "vscode";

import type {
  EndpointConfigurationReader,
  Localize,
} from "../config/endpoint-config";
import { resolveDebugConfigurationEndpoint } from "../config/endpoint-config";

export interface DebugConfigProviderOptions {
  localize?: Localize;
  getSettings?: () => EndpointConfigurationReader;
  showError?: (message: string) => void | Thenable<unknown>;
}

const defaultLocalize = ((messageOrOptions: string | { message: string }) =>
  typeof messageOrOptions === "string"
    ? messageOrOptions
    : messageOrOptions.message) as Localize;

export class DebugConfigProvider implements vscode.DebugConfigurationProvider {
  private readonly localize: Localize;
  private readonly getSettings: () => EndpointConfigurationReader;
  private readonly showError: (message: string) => void | Thenable<unknown>;

  public constructor(options: DebugConfigProviderOptions = {}) {
    this.localize = options.localize ?? defaultLocalize;
    this.getSettings =
      options.getSettings ?? (() => ({ get: <T>(_s: string, d: T) => d }));
    this.showError = options.showError ?? (() => undefined);
  }

  public resolveDebugConfiguration(
    _folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    if (config.type && config.type !== "jupyter-browser-kernel") {
      return config;
    }

    const resolvedConfig: vscode.DebugConfiguration = {
      ...config,
      type: "jupyter-browser-kernel",
      request:
        typeof config.request === "string" && config.request.length > 0
          ? config.request
          : "launch",
      name:
        typeof config.name === "string" && config.name.length > 0
          ? config.name
          : this.localize("Browser Kernel Debug"),
    };

    const resolution = resolveDebugConfigurationEndpoint(
      resolvedConfig,
      this.getSettings(),
      this.localize,
    );

    if (!resolution.ok) {
      const { message, correctiveAction } = resolution.error;
      void this.showError(`${message} ${correctiveAction}`);
      return undefined;
    }

    resolvedConfig.host = resolution.endpoint.host;
    resolvedConfig.port = resolution.endpoint.port;

    return resolvedConfig;
  }
}

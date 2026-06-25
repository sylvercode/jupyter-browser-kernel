import type * as vscode from "vscode";

import {
  connectToBrowserTarget,
  disconnectActiveBrowserConnection,
  getActiveBrowserConnection,
  type ActiveBrowserConnection,
} from "../transport/browser-connect";
import type { ConnectionStateStore } from "../transport/connection-state";
import type { ConnectToTargetOperation } from "../transport/connect-types";
import {
  readAndValidateEndpointConfig,
  validateEndpointConfig,
  type EndpointConfig,
  type EndpointConfigurationReader,
  type Localize,
} from "../config/endpoint-config";
import { createEnsureBrowserConnection } from "./connect-on-launch";
import {
  createDebugSessionManager,
  type DebugSessionManagerOptions,
} from "./debug-session-manager";
import {
  NotebookDebugAdapter,
  type NotebookDebugAdapterOptions,
} from "./notebook-dap-adapter";

export type GetActiveConnection = () => ActiveBrowserConnection | undefined;
type GetSettings = () => EndpointConfigurationReader;

type CreateSessionManager = (
  options: DebugSessionManagerOptions,
) => ReturnType<typeof createDebugSessionManager>;

type CreateNotebookDebugAdapter = (
  options: NotebookDebugAdapterOptions,
) => NotebookDebugAdapter;

type CreateInlineAdapterDescriptor = (
  adapter: NotebookDebugAdapter,
) => vscode.DebugAdapterDescriptor;

const defaultLocalize = ((
  messageOrOptions: string | { message: string },
  ...args: unknown[]
): string => {
  const template =
    typeof messageOrOptions === "string"
      ? messageOrOptions
      : messageOrOptions.message;

  let rendered = template;
  for (const [index, value] of args.entries()) {
    rendered = rendered.replace(`{${index}}`, String(value));
  }

  return rendered;
}) as Localize;

function resolveEndpointFromSessionConfiguration(
  session: vscode.DebugSession,
  getSettings: GetSettings,
  localize: Localize,
): EndpointConfig {
  const endpointFromSession = {
    host: session.configuration["host"],
    port: session.configuration["port"],
  };

  if (
    typeof endpointFromSession.host === "string" &&
    typeof endpointFromSession.port === "number"
  ) {
    const validatedFromSession = validateEndpointConfig(
      {
        host: endpointFromSession.host,
        port: endpointFromSession.port,
      },
      localize,
    );

    if (validatedFromSession.ok) {
      return validatedFromSession.endpoint;
    }
  }

  const fallback = readAndValidateEndpointConfig(getSettings(), localize);
  if (!fallback.ok) {
    throw new Error(
      localize(
        "{0} {1}",
        fallback.error.message,
        fallback.error.correctiveAction,
      ),
    );
  }

  return fallback.endpoint;
}

export interface DebugAdapterFactoryOptions {
  connectionStateStore: ConnectionStateStore;
  getActiveConnection?: GetActiveConnection;
  connectToTarget?: ConnectToTargetOperation;
  getSettings?: GetSettings;
  createSessionManager?: CreateSessionManager;
  createAdapter?: CreateNotebookDebugAdapter;
  createInlineAdapterDescriptor: CreateInlineAdapterDescriptor;
  localize?: Localize;
  logger: (message: string, error?: unknown) => void;
}

export class DebugAdapterFactory
  implements vscode.DebugAdapterDescriptorFactory
{
  private readonly getActiveConnection: GetActiveConnection;
  private readonly connectionStateStore: ConnectionStateStore;
  private readonly connectToTarget: ConnectToTargetOperation;
  private readonly getSettings: GetSettings;
  private readonly createSessionManager: CreateSessionManager;
  private readonly createAdapter: CreateNotebookDebugAdapter;
  private readonly createInlineAdapterDescriptor: CreateInlineAdapterDescriptor;
  private readonly localize: Localize;
  private readonly logger: (message: string, error?: unknown) => void;

  public constructor(options: DebugAdapterFactoryOptions) {
    this.connectionStateStore = options.connectionStateStore;
    this.getActiveConnection =
      options.getActiveConnection ?? getActiveBrowserConnection;
    this.connectToTarget =
      options.connectToTarget ??
      ((endpoint, localize, abortSignal) =>
        connectToBrowserTarget(endpoint, undefined, localize, abortSignal));
    this.getSettings =
      options.getSettings ??
      (() => ({ get: <T>(_section: string, defaultValue: T) => defaultValue }));
    this.createSessionManager =
      options.createSessionManager ?? createDebugSessionManager;
    this.createAdapter =
      options.createAdapter ??
      ((adapterOptions) => new NotebookDebugAdapter(adapterOptions));
    this.createInlineAdapterDescriptor = options.createInlineAdapterDescriptor;
    this.localize = options.localize ?? defaultLocalize;
    this.logger = options.logger;
  }

  public createDebugAdapterDescriptor(
    session: vscode.DebugSession,
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    const endpoint = resolveEndpointFromSessionConfiguration(
      session,
      this.getSettings,
      this.localize,
    );

    const ensureConnection = createEnsureBrowserConnection({
      endpoint,
      connectionStateStore: this.connectionStateStore,
      connectToTarget: this.connectToTarget,
      getActiveConnection: this.getActiveConnection,
      localize: this.localize,
    });

    const manager = this.createSessionManager({
      getDebuggerSession: () => this.getActiveConnection()?.debugger,
      logger: this.logger,
      localize: this.localize,
      ensureConnection,
      disconnectActiveConnection: disconnectActiveBrowserConnection,
    });

    const adapter = this.createAdapter({
      sessionManager: manager,
      localize: this.localize,
      logger: this.logger,
    });

    return this.createInlineAdapterDescriptor(adapter);
  }
}

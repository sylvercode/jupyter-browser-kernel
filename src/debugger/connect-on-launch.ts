import {
  summarizeEndpointForDisplay,
  type EndpointConfig,
  type Localize,
} from "../config/endpoint-config";
import { formatConnectFailureMessage } from "../transport/connect-diagnostics";
import {
  withConnectTransition,
  type ConnectionStateStore,
} from "../transport/connection-state";
import type { ConnectToTargetOperation } from "../transport/connect-types";
import type { ActiveBrowserConnection } from "../transport/browser-connect";

export interface EnsureBrowserConnectionOptions {
  endpoint: EndpointConfig;
  connectionStateStore: ConnectionStateStore;
  connectToTarget: ConnectToTargetOperation;
  getActiveConnection: () => ActiveBrowserConnection | undefined;
  localize: Localize;
}

export function createEnsureBrowserConnection({
  endpoint,
  connectionStateStore,
  connectToTarget,
  getActiveConnection,
  localize,
}: EnsureBrowserConnectionOptions): () => Promise<void> {
  return async (): Promise<void> => {
    if (getActiveConnection()) {
      throw new Error(
        localize(
          "A browser connection is already active. Stop the existing debug session before starting another - only one active connection is supported.",
        ),
      );
    }

    const connectResult = await withConnectTransition(
      connectionStateStore,
      (abortSignal) => connectToTarget(endpoint, localize, abortSignal),
      (result) => result.ok,
      () => undefined,
    );

    if (connectResult.ok) {
      connectionStateStore.setErrorContext(undefined);
      return;
    }

    const guidance = formatConnectFailureMessage(
      connectResult.failure,
      summarizeEndpointForDisplay(endpoint),
      localize,
    );

    connectionStateStore.setErrorContext({
      category: connectResult.failure.category,
      guidance,
    });

    throw new Error(guidance);
  };
}

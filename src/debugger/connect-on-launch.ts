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

    // In-flight guard: `withConnectTransition` sets the state to `connecting`
    // synchronously (before its first `await` yields), so a second debug launch
    // racing into `ensureConnection()` before the first connect completes will
    // observe `connecting` here and be rejected instead of clobbering the
    // in-progress connection (the transport closes any prior connection right
    // before assigning the new singleton).
    if (connectionStateStore.getState() === "connecting") {
      throw new Error(
        localize(
          "A browser connection is already being established. Wait for it to finish before starting another - only one active connection is supported.",
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

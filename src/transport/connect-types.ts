import type { EndpointConfig, Localize } from "../config/endpoint-config";

export type ConnectFailureCategory =
  | "target-mismatch"
  | "endpoint-connectivity"
  | "transport-failure";

export interface ConnectFailure {
  category: ConnectFailureCategory;
  message: string;
}

export interface ConnectedTargetSession {
  targetId: string;
  sessionId: string;
}

export type ConnectToTargetResult =
  | {
      ok: true;
      connectedTarget: ConnectedTargetSession;
      endpoint: EndpointConfig;
    }
  | {
      ok: false;
      failure: ConnectFailure;
      endpoint: EndpointConfig;
    };

export interface ConnectToTargetOperation {
  (endpoint: EndpointConfig, localize: Localize): Promise<ConnectToTargetResult>;
}

import type { EndpointConfig } from "../../../src/config/endpoint-config.js";
import { type ActiveBrowserConnection } from "../../../src/transport/browser-connect.js";

import { createFakeDebuggerSession } from "./browser-debugger-session-mock.js";

export interface ActiveBrowserConnectionMockOptions {
  targetId?: string;
  sessionId?: string;
  endpoint?: EndpointConfig;
}

export function createActiveBrowserConnectionMock(
  options: ActiveBrowserConnectionMockOptions = {},
): ActiveBrowserConnection {
  const endpoint: EndpointConfig = options.endpoint ?? {
    host: "localhost",
    port: 9222,
  };

  return {
    targetId: options.targetId ?? "target-1",
    sessionId: options.sessionId ?? "session-1",
    endpoint,
    debugger: createFakeDebuggerSession(),
    evaluate: async () => ({ result: { type: "undefined" } }),
    terminateExecution: async () => undefined,
    close: async () => undefined,
  };
}

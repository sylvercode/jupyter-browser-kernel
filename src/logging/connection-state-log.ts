import type {
  ConnectionErrorContext,
  ConnectionState,
} from "../transport/connection-state";

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

export function buildConnectionStateLogLine(
  state: ConnectionState,
  context: ConnectionErrorContext | undefined,
  endpointSummary: string,
  at: string = timestamp(),
): string {
  const labelByState: Record<ConnectionState, string> = {
    disconnected: "Disconnected",
    connecting: "Connecting",
    connected: "Connected",
    error: "Error",
  };

  const baseLine = `[${at}] Connection state: ${labelByState[state]} (endpoint: ${endpointSummary})`;

  if (state === "error" && context) {
    return `${baseLine} [${context.category}] ${context.guidance}`;
  }

  return baseLine;
}

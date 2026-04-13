import type {
  ConnectionErrorContext,
  ConnectionState,
} from "../transport/connection-state";
import { buildConnectionStateLogLine } from "./connection-state-log";

export interface ConnectionLogger {
  onConnectionStateChanged: (state: ConnectionState) => void;
  onErrorContextChanged: (context: ConnectionErrorContext | undefined) => void;
}

/**
 * Creates a logger that writes connection state transitions to an output channel.
 *
 * @param channel - Output channel to write log lines to.
 * @param getEndpointSummary - Called on each log line to get the current display-safe endpoint string.
 */
export function createConnectionLogger(
  channel: { appendLine: (value: string) => void },
  getEndpointSummary: () => string,
): ConnectionLogger {
  let currentErrorContext: ConnectionErrorContext | undefined;

  return {
    onConnectionStateChanged(state) {
      channel.appendLine(
        buildConnectionStateLogLine(
          state,
          currentErrorContext,
          getEndpointSummary(),
        ),
      );
    },
    onErrorContextChanged(context) {
      currentErrorContext = context;
      if (context) {
        channel.appendLine(
          buildConnectionStateLogLine("error", context, getEndpointSummary()),
        );
      }
    },
  };
}

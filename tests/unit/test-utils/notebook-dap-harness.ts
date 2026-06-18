import type { DebugProtocol } from "@vscode/debugprotocol";

import { NotebookDebugAdapter } from "../../../src/debugger/notebook-dap-adapter.js";
import type { DebugSessionManager } from "../../../src/debugger/debug-session-manager.js";

export interface AdapterHarness {
  adapter: NotebookDebugAdapter;
  sendRequest: (
    command: string,
    args?: unknown,
  ) => Promise<DebugProtocol.Response>;
  sentMessages: DebugProtocol.ProtocolMessage[];
}

export interface CreateAdapterHarnessOptions {
  maxPolls?: number;
}

export function createAdapterHarness(
  sessionManager: DebugSessionManager,
  options: CreateAdapterHarnessOptions = {},
): AdapterHarness {
  const adapter = new NotebookDebugAdapter({ sessionManager });
  const sentMessages: DebugProtocol.ProtocolMessage[] = [];

  adapter.onDidSendMessage((message) => {
    sentMessages.push(message as DebugProtocol.ProtocolMessage);
  });

  let sequence = 0;
  const maxPolls = options.maxPolls ?? 50;

  const sendRequest = async (
    command: string,
    args?: unknown,
  ): Promise<DebugProtocol.Response> => {
    sequence += 1;
    const requestSeq = sequence;

    const request: DebugProtocol.Request = {
      seq: requestSeq,
      type: "request",
      command,
      arguments: args as Record<string, unknown> | undefined,
    };

    adapter.handleMessage(request);

    for (let poll = 0; poll < maxPolls; poll += 1) {
      const response = sentMessages.find((message) => {
        if (message.type !== "response") {
          return false;
        }

        return (message as DebugProtocol.Response).request_seq === requestSeq;
      }) as DebugProtocol.Response | undefined;

      if (response) {
        return response;
      }

      await Promise.resolve();
    }

    throw new Error(`No response captured for ${command}`);
  };

  return {
    adapter,
    sendRequest,
    sentMessages,
  };
}

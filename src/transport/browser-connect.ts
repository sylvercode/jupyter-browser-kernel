import os from "node:os";
import CDP from "chrome-remote-interface";

import type { EndpointConfig, Localize } from "../config/endpoint-config";
import {
  getActiveProfile,
  selectTarget,
  type TargetProfile,
  type BrowserTargetInfo,
} from "../profile/target-profile";
import type { ConnectToTargetResult } from "./connect-types";

export interface ActiveBrowserConnection {
  targetId: string;
  sessionId: string;
  endpoint: EndpointConfig;
  close: () => Promise<void>;
}

let activeBrowserConnection: ActiveBrowserConnection | undefined;

const passthroughLocalize = ((input: string): string => input) as Localize;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

async function clearActiveBrowserConnection(): Promise<void> {
  if (!activeBrowserConnection) {
    return;
  }

  const current = activeBrowserConnection;
  activeBrowserConnection = undefined;
  await current.close();
}

export function getActiveBrowserConnection():
  | ActiveBrowserConnection
  | undefined {
  return activeBrowserConnection;
}

export async function disconnectActiveBrowserConnection(): Promise<void> {
  await clearActiveBrowserConnection();
}

function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host);
}

function normalizeEndpointHost(host: string): string {
  if (host === "localhost") {
    return "[::1]";
  }

  return host;
}

export function rewriteBrowserWebSocketUrl(
  browserWebSocketUrl: string,
  endpoint: EndpointConfig,
): string {
  const url = new URL(browserWebSocketUrl);
  const browserHost = url.hostname;

  if (isLoopbackHost(browserHost) && isLoopbackHost(endpoint.host)) {
    url.hostname = browserHost;
  } else {
    url.hostname = normalizeEndpointHost(endpoint.host);
  }

  url.port = String(endpoint.port);
  return url.toString();
}

export async function resolveBrowserWebSocketUrl(
  endpoint: EndpointConfig,
  localize: Localize = passthroughLocalize,
): Promise<string> {
  let payload: CDP.VersionResult;
  try {
    payload = await CDP.Version({
      host: normalizeEndpointHost(endpoint.host),
      port: endpoint.port,
      useHostName: true,
    });
  } catch (error) {
    throw new Error(
      localize({
        message: "CDP.Version failed: {0}",
        args: [getErrorMessage(error)],
        comment: ["{0} is the failure reason from CDP.Version."],
      }),
    );
  }

  const webSocketDebuggerUrl = payload.webSocketDebuggerUrl;

  if (
    typeof webSocketDebuggerUrl !== "string" ||
    webSocketDebuggerUrl.length === 0
  ) {
    throw new Error(
      localize("Missing browser-level webSocketDebuggerUrl in /json/version."),
    );
  }

  return rewriteBrowserWebSocketUrl(webSocketDebuggerUrl, endpoint);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }

  return String(error);
}

function createStepError(step: string, error: unknown): Error {
  return new Error(`${step}: ${getErrorMessage(error)}`);
}

function categorizeTransportFailure(
  error: unknown,
): "endpoint-connectivity" | "transport-failure" {
  const message = getErrorMessage(error);
  if (
    /(ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|timed out|HTTP 4|HTTP 5)/i.test(
      message,
    )
  ) {
    return "endpoint-connectivity";
  }

  return "transport-failure";
}

function shouldRetryTransportError(error: unknown): boolean {
  return /(ECONNRESET|timed out|socket hang up|Empty reply)/i.test(
    getErrorMessage(error),
  );
}

function runtimeContextSummary(): string {
  return `runtime=${process.platform} host=${os.hostname()}`;
}

async function safeClose(client: CDP.Client | undefined): Promise<void> {
  if (!client) {
    return;
  }

  try {
    await client.close();
  } catch {
    // Non-fatal cleanup error.
  }
}

async function verifyRuntimeProbe(
  client: CDP.Client,
  localize: Localize,
  sessionId: string,
): Promise<void> {
  let evaluationResult: unknown;

  try {
    evaluationResult = await client.send(
      "Runtime.evaluate",
      {
        expression: "1 + 1",
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId,
    );
  } catch (error) {
    throw new Error(
      localize({
        message: "Runtime probe command failed: {0}",
        args: [getErrorMessage(error)],
        comment: ["{0} is the CDP Runtime.evaluate failure message."],
      }),
    );
  }

  if (typeof evaluationResult !== "object" || evaluationResult === null) {
    throw new Error(localize("Runtime probe returned no result object."));
  }

  const details = evaluationResult as {
    result?: { value?: unknown };
    exceptionDetails?: unknown;
  };

  if (details.exceptionDetails) {
    throw new Error(localize("Runtime probe raised exception details."));
  }

  if (details.result?.value !== 2) {
    throw new Error(
      localize({
        message: "Runtime probe returned unexpected value: {0}",
        args: [String(details.result?.value)],
        comment: ["{0} is the value returned by Runtime.evaluate."],
      }),
    );
  }
}

async function connectViaBrowserTargetAttach(
  endpoint: EndpointConfig,
  profile: TargetProfile,
  localize: Localize,
): Promise<ConnectToTargetResult> {
  let client: CDP.Client | undefined;

  try {
    let browserWebSocketUrl = "";
    try {
      browserWebSocketUrl = await resolveBrowserWebSocketUrl(
        endpoint,
        localize,
      );
    } catch (error) {
      throw createStepError("resolveBrowserWebSocketUrl", error);
    }

    try {
      client = await CDP({
        target: browserWebSocketUrl,
        local: true,
      });
    } catch (error) {
      throw createStepError("browserWebSocketConnect", error);
    }

    let targetsResponse: { targetInfos?: BrowserTargetInfo[] };
    try {
      targetsResponse = await client.Target.getTargets();
    } catch (error) {
      throw createStepError("Target.getTargets", error);
    }

    const targetSelection = selectTarget(
      targetsResponse.targetInfos ?? [],
      profile,
      localize,
    );

    if (!targetSelection.ok) {
      return {
        ok: false,
        endpoint,
        failure: targetSelection.failure,
      };
    }

    let attachResult: { sessionId: string };
    try {
      attachResult = await client.Target.attachToTarget({
        targetId: targetSelection.target.targetId,
        flatten: true,
      });
    } catch (error) {
      throw createStepError("Target.attachToTarget", error);
    }

    try {
      await verifyRuntimeProbe(client, localize, attachResult.sessionId);
    } catch (error) {
      throw createStepError("Runtime.evaluate(probe)", error);
    }

    await clearActiveBrowserConnection();

    const retainedClient = client;
    activeBrowserConnection = {
      targetId: targetSelection.target.targetId,
      sessionId: attachResult.sessionId,
      endpoint,
      close: async () => {
        await safeClose(retainedClient);
      },
    };

    client = undefined;

    return {
      ok: true,
      endpoint,
      connectedTarget: {
        targetId: targetSelection.target.targetId,
        sessionId: attachResult.sessionId,
      },
    };
  } finally {
    await safeClose(client);
  }
}

export async function connectToBrowserTarget(
  endpoint: EndpointConfig,
  profile: TargetProfile = getActiveProfile(),
  localize: Localize = passthroughLocalize,
): Promise<ConnectToTargetResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await connectViaBrowserTargetAttach(endpoint, profile, localize);
    } catch (error) {
      lastError = error;
      if (!shouldRetryTransportError(error) || attempt === 1) {
        break;
      }
    }
  }

  const failureMessage = localize({
    message: "Browser attach failed: {0}.",
    args: [getErrorMessage(lastError)],
    comment: ["{0} is the browser-level attach failure message."],
  });

  return {
    ok: false,
    endpoint,
    failure: {
      category: categorizeTransportFailure(lastError),
      message: `${failureMessage} (${runtimeContextSummary()})`,
    },
  };
}

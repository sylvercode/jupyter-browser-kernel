import type * as vscode from "vscode";

import type { Localize } from "../config/endpoint-config";
import { getActiveBrowserConnection } from "../transport/browser-connect";
import {
  getCanonicalConnectionStateStore,
  onDidChangeConnectionState,
  type ConnectionStateStore,
} from "../transport/connection-state";

const BROWSER_KERNEL_DEBUG_TYPE = "jupyter-browser-kernel";
const CONNECTION_READY_TIMEOUT_MS = 15000;

export interface DebugSessionPreflightResult {
  ready: boolean;
}

export type EnsureSessionReadyForExecution =
  () => Promise<DebugSessionPreflightResult>;

export interface DebugLaunchCandidate {
  folder: vscode.WorkspaceFolder | undefined;
  configuration: vscode.DebugConfiguration;
}

export interface DebugLaunchQuickPickItem extends vscode.QuickPickItem {
  candidate: DebugLaunchCandidate;
}

export type DebugLaunchResolutionOutcome = "selected" | "none" | "cancelled";

export interface DebugLaunchResolution {
  outcome: DebugLaunchResolutionOutcome;
  candidate?: DebugLaunchCandidate;
}

interface WorkspaceConfigurationApi {
  workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;
  getConfiguration: typeof vscode.workspace.getConfiguration;
}

interface WindowPromptApi {
  showInformationMessage: typeof vscode.window.showInformationMessage;
  showWarningMessage: typeof vscode.window.showWarningMessage;
  showErrorMessage: typeof vscode.window.showErrorMessage;
  showQuickPick: typeof vscode.window.showQuickPick;
}

interface DebugLifecycleApi {
  activeDebugSession: typeof vscode.debug.activeDebugSession;
  startDebugging: typeof vscode.debug.startDebugging;
  onDidStartDebugSession: typeof vscode.debug.onDidStartDebugSession;
  onDidTerminateDebugSession: typeof vscode.debug.onDidTerminateDebugSession;
}

export interface ExecutionSessionPreflightApi {
  debug: DebugLifecycleApi;
  workspace: WorkspaceConfigurationApi;
  window: WindowPromptApi;
  localize: Localize;
  getActiveConnection?: typeof getActiveBrowserConnection;
  getConnectionStateStore?: () => ConnectionStateStore | undefined;
  subscribeConnectionState?: typeof onDidChangeConnectionState;
}

function isLaunchConfig(
  configuration: unknown,
): configuration is vscode.DebugConfiguration {
  if (!configuration || typeof configuration !== "object") {
    return false;
  }

  const typedConfiguration = configuration as {
    type?: unknown;
    request?: unknown;
  };

  return (
    typedConfiguration.type === BROWSER_KERNEL_DEBUG_TYPE &&
    typedConfiguration.request === "launch"
  );
}

function readLaunchConfigurations(
  workspace: WorkspaceConfigurationApi,
  folder: vscode.WorkspaceFolder | undefined,
): vscode.DebugConfiguration[] {
  const configuration =
    folder === undefined
      ? workspace.getConfiguration("launch")
      : workspace.getConfiguration("launch", folder.uri);

  const rawConfigurations = configuration.get<unknown>("configurations");
  if (!Array.isArray(rawConfigurations)) {
    return [];
  }

  return rawConfigurations.filter(isLaunchConfig);
}

function toStableSerialization(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => toStableSerialization(item)).join(",")}]`;
  }

  const typedValue = value as Record<string, unknown>;
  const keys = Object.keys(typedValue).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${toStableSerialization(typedValue[key])}`,
  );
  return `{${entries.join(",")}}`;
}

function toLaunchConfigurationKey(
  configuration: vscode.DebugConfiguration,
): string {
  return toStableSerialization(configuration);
}

function collectLaunchCandidates(
  workspace: WorkspaceConfigurationApi,
): DebugLaunchCandidate[] {
  const candidates: DebugLaunchCandidate[] = [];
  const folderConfigurationKeys = new Set<string>();

  for (const folder of workspace.workspaceFolders ?? []) {
    for (const configuration of readLaunchConfigurations(workspace, folder)) {
      candidates.push({ folder, configuration });
      folderConfigurationKeys.add(toLaunchConfigurationKey(configuration));
    }
  }

  for (const configuration of readLaunchConfigurations(workspace, undefined)) {
    const configurationKey = toLaunchConfigurationKey(configuration);
    if (folderConfigurationKeys.has(configurationKey)) {
      continue;
    }

    candidates.push({ folder: undefined, configuration });
  }

  return candidates;
}

function toCandidateLabel(
  candidate: DebugLaunchCandidate,
  localize: Localize,
): string {
  const configName =
    typeof candidate.configuration.name === "string" &&
    candidate.configuration.name.length > 0
      ? candidate.configuration.name
      : localize("Unnamed Browser Kernel launch configuration");

  if (!candidate.folder) {
    return configName;
  }

  return localize("{0} ({1})", configName, candidate.folder.name);
}

export async function resolveBrowserKernelLaunchConfiguration({
  workspace,
  localize,
  showQuickPick,
}: {
  workspace: WorkspaceConfigurationApi;
  localize: Localize;
  showQuickPick: (
    items: readonly DebugLaunchQuickPickItem[],
    options: vscode.QuickPickOptions,
  ) => Thenable<DebugLaunchQuickPickItem | undefined>;
}): Promise<DebugLaunchCandidate | undefined> {
  const result = await resolveBrowserKernelLaunchSelection({
    workspace,
    localize,
    showQuickPick,
  });
  return result.candidate;
}

export async function resolveBrowserKernelLaunchSelection({
  workspace,
  localize,
  showQuickPick,
}: {
  workspace: WorkspaceConfigurationApi;
  localize: Localize;
  showQuickPick: (
    items: readonly DebugLaunchQuickPickItem[],
    options: vscode.QuickPickOptions,
  ) => Thenable<DebugLaunchQuickPickItem | undefined>;
}): Promise<DebugLaunchResolution> {
  const candidates = collectLaunchCandidates(workspace);
  if (candidates.length === 0) {
    return { outcome: "none" };
  }

  if (candidates.length === 1) {
    return { outcome: "selected", candidate: candidates[0] };
  }

  const quickPickItems: DebugLaunchQuickPickItem[] = candidates.map(
    (candidate) => ({
      label: toCandidateLabel(candidate, localize),
      candidate,
    }),
  );

  const selection = await showQuickPick(quickPickItems, {
    placeHolder: localize("Select a Browser Kernel debug configuration"),
    ignoreFocusOut: true,
  });

  if (!selection) {
    return { outcome: "cancelled" };
  }

  return { outcome: "selected", candidate: selection.candidate };
}

function hasActiveBrowserKernelSession(debug: DebugLifecycleApi): boolean {
  return debug.activeDebugSession?.type === BROWSER_KERNEL_DEBUG_TYPE;
}

function hasConnectedTransport(
  getActiveConnection: () => ReturnType<typeof getActiveBrowserConnection>,
  getConnectionStateStore: () => ConnectionStateStore | undefined,
): boolean {
  const activeConnection = getActiveConnection();
  if (!activeConnection) {
    return false;
  }

  const stateStore = getConnectionStateStore();
  if (!stateStore) {
    return false;
  }

  return stateStore.getState() === "connected";
}

async function waitForConnectedTransport(
  api: ExecutionSessionPreflightApi,
): Promise<boolean> {
  const getActiveConnection =
    api.getActiveConnection ?? getActiveBrowserConnection;
  const getConnectionStateStore =
    api.getConnectionStateStore ?? getCanonicalConnectionStateStore;

  if (hasConnectedTransport(getActiveConnection, getConnectionStateStore)) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let connectionSubscription: { dispose: () => void } | undefined;
    let debugStartSubscription: { dispose: () => void } | undefined;
    let debugTerminateSubscription: { dispose: () => void } | undefined;

    const disposeSubscriptions = (): void => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      connectionSubscription?.dispose();
      debugStartSubscription?.dispose();
      debugTerminateSubscription?.dispose();
    };

    const finish = (ready: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      disposeSubscriptions();
      resolve(ready);
    };

    const maybeFinishReady = (): void => {
      if (hasConnectedTransport(getActiveConnection, getConnectionStateStore)) {
        finish(true);
      }
    };

    try {
      connectionSubscription = (
        api.subscribeConnectionState ?? onDidChangeConnectionState
      )((state) => {
        if (state === "connected") {
          maybeFinishReady();
        }

        if (
          (state === "disconnected" || state === "error") &&
          !hasActiveBrowserKernelSession(api.debug)
        ) {
          finish(false);
        }
      });

      debugStartSubscription = api.debug.onDidStartDebugSession((session) => {
        if (session.type !== BROWSER_KERNEL_DEBUG_TYPE) {
          return;
        }

        maybeFinishReady();
      });

      debugTerminateSubscription = api.debug.onDidTerminateDebugSession(
        (session) => {
          if (session.type !== BROWSER_KERNEL_DEBUG_TYPE) {
            return;
          }

          if (!hasActiveBrowserKernelSession(api.debug)) {
            finish(false);
          }
        },
      );

      timeoutHandle = setTimeout(() => {
        finish(false);
      }, CONNECTION_READY_TIMEOUT_MS);

      // If the session disappeared between the outer pre-check and subscription setup,
      // fail immediately instead of waiting for timeout.
      if (!hasActiveBrowserKernelSession(api.debug)) {
        finish(false);
        return;
      }

      maybeFinishReady();
    } catch {
      finish(false);
    }
  });
}

function getStartTarget(
  candidate: DebugLaunchCandidate,
): string | vscode.DebugConfiguration {
  if (
    typeof candidate.configuration.name === "string" &&
    candidate.configuration.name.length > 0
  ) {
    return candidate.configuration.name;
  }

  return candidate.configuration;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }

  return String(error);
}

export function createEnsureSessionReadyForExecution(
  api: ExecutionSessionPreflightApi,
): EnsureSessionReadyForExecution {
  const notify = (messageCall: () => Thenable<string | undefined>): void => {
    void Promise.resolve(messageCall()).catch(() => undefined);
  };

  let inFlight: Promise<DebugSessionPreflightResult> | undefined;

  const runPreflight = async (): Promise<DebugSessionPreflightResult> => {
    const getActiveConnection =
      api.getActiveConnection ?? getActiveBrowserConnection;
    const getConnectionStateStore =
      api.getConnectionStateStore ?? getCanonicalConnectionStateStore;

    if (hasConnectedTransport(getActiveConnection, getConnectionStateStore)) {
      return { ready: true };
    }

    if (hasActiveBrowserKernelSession(api.debug)) {
      let connected = false;
      try {
        connected = await waitForConnectedTransport(api);
      } catch {
        notify(() =>
          api.window.showWarningMessage(
            api.localize(
              "Unable to monitor Browser Kernel debug session readiness. Run the cell again.",
            ),
          ),
        );
        return { ready: false };
      }

      if (connected) {
        return { ready: true };
      }

      notify(() =>
        api.window.showWarningMessage(
          api.localize(
            "Browser Kernel debug session did not reach connected state. Wait for connection and run the cell again.",
          ),
        ),
      );
      return { ready: false };
    }

    const startAction = api.localize("Start");
    const cancelAction = api.localize("Cancel");
    const decision = await api.window.showInformationMessage(
      api.localize(
        "No active Browser Kernel debug session. Start one to run this cell?",
      ),
      startAction,
      cancelAction,
    );

    if (decision !== startAction) {
      notify(() =>
        api.window.showInformationMessage(
          api.localize(
            "Cell execution canceled. Start a Browser Kernel debug session to run notebook cells.",
          ),
        ),
      );
      return { ready: false };
    }

    const launchResolution = await resolveBrowserKernelLaunchSelection({
      workspace: api.workspace,
      localize: api.localize,
      showQuickPick: api.window.showQuickPick,
    });

    if (launchResolution.outcome === "cancelled") {
      notify(() =>
        api.window.showInformationMessage(
          api.localize(
            "Cell execution canceled. Start a Browser Kernel debug session to run notebook cells.",
          ),
        ),
      );
      return { ready: false };
    }

    if (!launchResolution.candidate) {
      notify(() =>
        api.window.showErrorMessage(
          api.localize(
            'No "jupyter-browser-kernel" launch configuration was found. Add one in launch.json and try again.',
          ),
        ),
      );
      return { ready: false };
    }

    let debugStarted: boolean;
    try {
      debugStarted = await api.debug.startDebugging(
        launchResolution.candidate.folder,
        getStartTarget(launchResolution.candidate),
      );
    } catch (error) {
      notify(() =>
        api.window.showErrorMessage(
          api.localize(
            "Failed to start Browser Kernel debug session: {0}",
            toErrorMessage(error),
          ),
        ),
      );
      return { ready: false };
    }

    if (!debugStarted) {
      notify(() =>
        api.window.showErrorMessage(
          api.localize(
            "Browser Kernel debug session did not start. Check your debug configuration and try again.",
          ),
        ),
      );
      return { ready: false };
    }

    let connected = false;
    try {
      connected = await waitForConnectedTransport(api);
    } catch {
      notify(() =>
        api.window.showWarningMessage(
          api.localize(
            "Unable to monitor Browser Kernel debug session readiness. Run the cell again.",
          ),
        ),
      );
      return { ready: false };
    }

    if (!connected) {
      notify(() =>
        api.window.showWarningMessage(
          api.localize(
            "Debug session started, but no active Browser connection became ready. Wait for Connected and run the cell again.",
          ),
        ),
      );
      return { ready: false };
    }

    return { ready: true };
  };

  return async () => {
    if (inFlight) {
      return inFlight;
    }

    inFlight = runPreflight().finally(() => {
      inFlight = undefined;
    });

    return inFlight;
  };
}

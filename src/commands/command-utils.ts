import type {
  EndpointValidationResult,
  Localize,
} from "../config/endpoint-config";
import type { ConnectFailureCategory } from "../transport/connect-types";

export interface SettingsPromptRuntime {
  localize: Localize;
  showErrorMessage: (
    message: string,
    action: string,
  ) => PromiseLike<string | undefined> | string | undefined;
  openSettings: (query: string) => PromiseLike<unknown> | void;
}

export async function showSettingsPrompt(
  runtime: SettingsPromptRuntime,
  message: string,
  settingsKey: "cdpHost" | "cdpPort",
): Promise<void> {
  const action = runtime.localize("Open Settings");

  let selection: string | undefined;
  try {
    selection = await runtime.showErrorMessage(message, action);
  } catch {
    return;
  }

  if (selection !== action) {
    return;
  }

  try {
    await runtime.openSettings(`jupyterBrowserKernel.${settingsKey}`);
  } catch {
    // non-fatal: settings pane failed to open, nothing further to do
  }
}

export function settingsKeyForEndpointFailure(
  validation: EndpointValidationResult,
): "cdpHost" | "cdpPort" {
  const settingsKeyByField: Record<string, "cdpHost" | "cdpPort"> = {
    host: "cdpHost",
    port: "cdpPort",
  };

  if (validation.ok) {
    return "cdpHost";
  }

  return settingsKeyByField[validation.error.field] ?? "cdpHost";
}

export function settingsKeyForConnectFailure(
  category: ConnectFailureCategory,
): "cdpHost" | "cdpPort" {
  return category === "endpoint-connectivity" ? "cdpPort" : "cdpHost";
}

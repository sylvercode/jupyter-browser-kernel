import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../../..");

function readJson(filePath: string): Record<string, unknown> {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content) as Record<string, unknown>;
}

test("package contributes connect/disconnect/reconnect commands with localized titles", () => {
  const packageJson = readJson(path.join(repoRoot, "package.json"));
  const contributes = packageJson.contributes as
    | { commands?: Array<{ command: string; title: string }> }
    | undefined;

  assert.ok(Array.isArray(contributes?.commands));

  const byId = new Map(
    contributes?.commands?.map((command) => [command.command, command.title]),
  );

  assert.equal(
    byId.get("jupyterBrowserKernel.connect"),
    "%command.connect.title%",
  );
  assert.equal(
    byId.get("jupyterBrowserKernel.disconnect"),
    "%command.disconnect.title%",
  );
  assert.equal(
    byId.get("jupyterBrowserKernel.reconnect"),
    "%command.reconnect.title%",
  );
});

test("localization bundles include new command and runtime strings", () => {
  const packageNls = readJson(path.join(repoRoot, "package.nls.json"));
  const l10nBundle = readJson(path.join(repoRoot, "l10n/bundle.l10n.json"));

  assert.equal(
    packageNls["command.disconnect.title"],
    "Jupyter Browser Kernel: Disconnect",
  );
  assert.equal(
    packageNls["command.reconnect.title"],
    "Jupyter Browser Kernel: Reconnect",
  );
  assert.equal(
    l10nBundle["Jupyter Browser Kernel: Disconnected from browser target."],
    "Jupyter Browser Kernel: Disconnected from browser target.",
  );
  assert.equal(
    l10nBundle["Jupyter Browser Kernel: Reconnected to target {0} at {1}."],
    "Jupyter Browser Kernel: Reconnected to target {0} at {1}.",
  );
});

test("extension activation registers connect, disconnect, and reconnect commands", () => {
  const extensionSource = fs.readFileSync(
    path.join(repoRoot, "src/extension.ts"),
    "utf8",
  );

  assert.match(extensionSource, /"jupyterBrowserKernel\.connect"/);
  assert.match(extensionSource, /"jupyterBrowserKernel\.disconnect"/);
  assert.match(extensionSource, /"jupyterBrowserKernel\.reconnect"/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../../..");

function readJson(filePath: string): Record<string, unknown> {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content) as Record<string, unknown>;
}

test("package contributes toggle cell isolation commands and not legacy connect/disconnect/reconnect commands", () => {
  const packageJson = readJson(path.join(repoRoot, "package.json"));
  const contributes = packageJson.contributes as
    | { commands?: Array<{ command: string; title: string }> }
    | undefined;

  assert.ok(Array.isArray(contributes?.commands));

  const byId = new Map(
    contributes?.commands?.map((command) => [command.command, command.title]),
  );

  // Assert legacy commands are NOT present
  assert.equal(byId.get("jupyterBrowserKernel.connect"), undefined);
  assert.equal(byId.get("jupyterBrowserKernel.disconnect"), undefined);
  assert.equal(byId.get("jupyterBrowserKernel.reconnect"), undefined);

  // Assert toggle isolation commands ARE present
  assert.equal(
    byId.get("jupyterBrowserKernel.toggleCellIsolation"),
    "%command.toggleCellIsolation.title%",
  );
});

test("package notebook isolation menu visibility requires Browser Kernel context key and code cells", () => {
  const packageJson = readJson(path.join(repoRoot, "package.json"));
  const contributes = packageJson.contributes as
    | {
        menus?: {
          "notebook/cell/title"?: Array<{ when?: string }>;
          "notebook/cell/context"?: Array<{ when?: string }>;
        };
      }
    | undefined;

  const titleWhenClauses = (contributes?.menus?.["notebook/cell/title"] ?? [])
    .map((entry) => entry.when)
    .filter((value): value is string => typeof value === "string");
  const contextWhenClauses = (
    contributes?.menus?.["notebook/cell/context"] ?? []
  )
    .map((entry) => entry.when)
    .filter((value): value is string => typeof value === "string");

  for (const whenClause of [...titleWhenClauses, ...contextWhenClauses]) {
    assert.match(whenClause, /notebookCellType\s*==\s*'code'/);
    assert.match(
      whenClause,
      /jupyterBrowserKernel\.activeNotebookUsesBrowserKernel/,
    );
  }
});

test("package contributes isolation actions to notebook cell menus", () => {
  const packageJson = readJson(path.join(repoRoot, "package.json"));
  const contributes = packageJson.contributes as
    | {
        menus?: {
          "notebook/cell/title"?: Array<{ command?: string }>;
          "notebook/cell/context"?: Array<{ command?: string }>;
        };
      }
    | undefined;

  const titleCommands = new Set(
    (contributes?.menus?.["notebook/cell/title"] ?? []).map(
      (entry) => entry.command,
    ),
  );
  const contextCommands = new Set(
    (contributes?.menus?.["notebook/cell/context"] ?? []).map(
      (entry) => entry.command,
    ),
  );

  assert.equal(
    titleCommands.has("jupyterBrowserKernel.toggleCellIsolation.isolate"),
    true,
  );
  assert.equal(
    titleCommands.has("jupyterBrowserKernel.toggleCellIsolation.share"),
    true,
  );
  assert.equal(
    contextCommands.has("jupyterBrowserKernel.toggleCellIsolation.isolate"),
    true,
  );
  assert.equal(
    contextCommands.has("jupyterBrowserKernel.toggleCellIsolation.share"),
    true,
  );
});

test("localization bundles include toggle cell isolation and runtime strings", () => {
  const packageNls = readJson(path.join(repoRoot, "package.nls.json"));
  const l10nBundle = readJson(path.join(repoRoot, "l10n/bundle.l10n.json"));

  // Legacy command strings should be removed
  assert.equal(packageNls["command.connect.title"], undefined);
  assert.equal(packageNls["command.disconnect.title"], undefined);
  assert.equal(packageNls["command.reconnect.title"], undefined);

  // Toggle isolation strings should still exist
  assert.equal(
    packageNls["command.toggleCellIsolation.title"],
    "Jupyter Browser Kernel: Toggle Cell Isolation",
  );
  assert.equal(
    packageNls["command.toggleCellIsolation.isolate.label"],
    "Isolate Cell",
  );
  assert.equal(
    packageNls["command.toggleCellIsolation.share.label"],
    "Share Cell State",
  );

  // Runtime strings should still exist
  assert.equal(
    l10nBundle["Jupyter Browser Kernel: Disconnected from browser target."],
    "Jupyter Browser Kernel: Disconnected from browser target.",
  );
  assert.equal(
    l10nBundle["Jupyter Browser Kernel: Reconnected to target {0} at {1}."],
    "Jupyter Browser Kernel: Reconnected to target {0} at {1}.",
  );
  assert.equal(l10nBundle["(isolated cell)"], "(isolated cell)");
});

test("extension activation registers isolation commands and debug wiring, not legacy connection commands", () => {
  const extensionSource = fs.readFileSync(
    path.join(repoRoot, "src/extension.ts"),
    "utf8",
  );

  // Legacy command registrations should NOT be present
  assert.equal(extensionSource.includes("jupyterBrowserKernel.connect"), false);
  assert.equal(
    extensionSource.includes("jupyterBrowserKernel.disconnect"),
    false,
  );
  assert.equal(
    extensionSource.includes("jupyterBrowserKernel.reconnect"),
    false,
  );

  // Toggle isolation command registration should be present
  assert.match(extensionSource, /registerToggleCellIsolationCommand/);

  // Debug and notebook wiring should be present
  assert.match(extensionSource, /onDidChangeSelectedNotebooks/);
  assert.match(
    extensionSource,
    /jupyterBrowserKernel\.activeNotebookUsesBrowserKernel/,
  );
  assert.match(extensionSource, /DebugAdapterFactory/);
  assert.match(extensionSource, /DebugConfigProvider/);
});

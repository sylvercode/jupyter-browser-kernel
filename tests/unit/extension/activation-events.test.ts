import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readPackageJson(): { activationEvents?: string[] } {
  const contents = readFileSync("package.json", "utf8");
  return JSON.parse(contents) as { activationEvents?: string[] };
}

test("activation events include notebook bootstrap and debug hooks", () => {
  const packageJson = readPackageJson();
  const activationEvents = packageJson.activationEvents ?? [];

  assert.ok(activationEvents.includes("onNotebook:jupyter-notebook"));
  assert.ok(activationEvents.includes("onDebug:jupyter-browser-kernel"));
});

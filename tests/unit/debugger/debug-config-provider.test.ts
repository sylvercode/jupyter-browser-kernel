import test from "node:test";
import assert from "node:assert/strict";
import type * as vscode from "vscode";

import { DebugConfigProvider } from "../../../src/debugger/debug-config-provider.js";
import { makeSettings } from "../test-utils/make-settings.js";

const validSettings = makeSettings("localhost", 9222);

test("resolveDebugConfiguration sets launch defaults", () => {
  const provider = new DebugConfigProvider({
    getSettings: () => validSettings,
  });

  const resolved = provider.resolveDebugConfiguration(undefined, {
    type: "jupyter-browser-kernel",
  } as vscode.DebugConfiguration) as vscode.DebugConfiguration;

  assert.equal(resolved?.type, "jupyter-browser-kernel");
  assert.equal(resolved?.request, "launch");
  assert.equal(resolved?.name, "Browser Kernel Debug");
});

test("resolveDebugConfiguration preserves provided request and name", () => {
  const provider = new DebugConfigProvider({
    getSettings: () => validSettings,
  });

  const resolved = provider.resolveDebugConfiguration(undefined, {
    type: "jupyter-browser-kernel",
    request: "attach",
    name: "Custom",
  } as vscode.DebugConfiguration) as vscode.DebugConfiguration;

  assert.equal(resolved?.request, "attach");
  assert.equal(resolved?.name, "Custom");
});

test("resolveDebugConfiguration does not reject when disconnected", () => {
  const provider = new DebugConfigProvider({
    getSettings: () => validSettings,
  });

  const resolved = provider.resolveDebugConfiguration(undefined, {
    type: "jupyter-browser-kernel",
  } as vscode.DebugConfiguration) as vscode.DebugConfiguration;

  assert.equal(resolved.type, "jupyter-browser-kernel");
  assert.equal(resolved.request, "launch");
  assert.equal(resolved.name, "Browser Kernel Debug");
});

test("resolveDebugConfiguration attaches resolved host and port to returned config", () => {
  const provider = new DebugConfigProvider({
    getSettings: () => validSettings,
  });

  const resolved = provider.resolveDebugConfiguration(undefined, {
    type: "jupyter-browser-kernel",
    host: "192.168.1.1",
    port: 9333,
  } as unknown as vscode.DebugConfiguration) as vscode.DebugConfiguration;

  assert.equal(resolved?.host, "192.168.1.1");
  assert.equal(resolved?.port, 9333);
});

test("resolveDebugConfiguration falls back to settings when host/port omitted", () => {
  const provider = new DebugConfigProvider({
    getSettings: () => makeSettings("127.0.0.1", 9300),
  });

  const resolved = provider.resolveDebugConfiguration(undefined, {
    type: "jupyter-browser-kernel",
  } as vscode.DebugConfiguration) as vscode.DebugConfiguration;

  assert.equal(resolved?.host, "127.0.0.1");
  assert.equal(resolved?.port, 9300);
});

test("resolveDebugConfiguration calls showError and returns undefined on resolution failure", () => {
  const errors: string[] = [];
  const provider = new DebugConfigProvider({
    getSettings: () => validSettings,
    showError: (msg) => {
      errors.push(msg);
    },
  });

  const resolved = provider.resolveDebugConfiguration(undefined, {
    type: "jupyter-browser-kernel",
    port: 0,
  } as unknown as vscode.DebugConfiguration);

  assert.equal(resolved, undefined);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /port/);
});

test("resolveDebugConfiguration error message names debug-config attribute when value comes from config", () => {
  const errors: string[] = [];
  const provider = new DebugConfigProvider({
    getSettings: () => validSettings,
    showError: (msg) => {
      errors.push(msg);
    },
  });

  provider.resolveDebugConfiguration(undefined, {
    type: "jupyter-browser-kernel",
    host: "",
  } as unknown as vscode.DebugConfiguration);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /launch\.json/);
  assert.match(errors[0], /"host"/);
});

test("resolveDebugConfiguration passes through config with different type unchanged", () => {
  const provider = new DebugConfigProvider({
    getSettings: () => validSettings,
  });

  const input = {
    type: "node",
    request: "launch",
    name: "Node",
  } as vscode.DebugConfiguration;
  const resolved = provider.resolveDebugConfiguration(undefined, input);

  assert.equal(resolved, input);
});

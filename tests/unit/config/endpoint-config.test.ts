import test from "node:test";
import assert from "node:assert/strict";

import {
  CDP_PORT_MAX,
  CDP_PORT_MIN,
  readEndpointConfig,
  resolveDebugConfigurationEndpoint,
  summarizeEndpointForDisplay,
  validateEndpointConfig,
} from "../../../src/config/endpoint-config";
import { makeSettings } from "../test-utils/make-settings";

test("validateEndpointConfig accepts valid host and port", () => {
  const result = validateEndpointConfig({ host: "localhost", port: 9222 });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.endpoint.host, "localhost");
    assert.equal(result.endpoint.port, 9222);
  }
});

test("validateEndpointConfig rejects empty host with field-specific corrective action", () => {
  const result = validateEndpointConfig({ host: "   ", port: 9222 });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.field, "host");
    assert.match(
      result.error.correctiveAction,
      /jupyterBrowserKernel\.cdpHost/,
    );
  }
});

test("validateEndpointConfig rejects non-integer and out-of-range port with field-specific corrective action", () => {
  const nonIntegerResult = validateEndpointConfig({
    host: "localhost",
    port: 9222.5,
  });
  const outOfRangeLowResult = validateEndpointConfig({
    host: "localhost",
    port: CDP_PORT_MIN - 1,
  });
  const outOfRangeHighResult = validateEndpointConfig({
    host: "localhost",
    port: CDP_PORT_MAX + 1,
  });

  for (const result of [
    nonIntegerResult,
    outOfRangeLowResult,
    outOfRangeHighResult,
  ]) {
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.field, "port");
      assert.match(
        result.error.correctiveAction,
        /jupyterBrowserKernel\.cdpPort/,
      );
    }
  }
});

test("readEndpointConfig normalizes host and port from configuration", () => {
  const config = {
    get<T>(section: string, defaultValue: T): T {
      if (section === "cdpHost") {
        return " 127.0.0.1 " as T;
      }

      if (section === "cdpPort") {
        return 9333 as T;
      }

      return defaultValue;
    },
  };

  const result = readEndpointConfig(config);

  assert.equal(result.host, "127.0.0.1");
  assert.equal(result.port, 9333);
});

test("readEndpointConfig does not apply endpoint defaults when settings are unset", () => {
  const config = {
    get<T>(_section: string, defaultValue: T): T {
      return defaultValue;
    },
  };

  const result = readEndpointConfig(config);

  assert.equal(result.host, "");
  assert.equal(Number.isNaN(result.port), true);
});

test("summarizeEndpointForDisplay shows loopback host as-is", () => {
  assert.equal(
    summarizeEndpointForDisplay({ host: "localhost", port: 9222 }),
    "localhost:9222",
  );
  assert.equal(
    summarizeEndpointForDisplay({ host: "127.0.0.1", port: 9222 }),
    "127.0.0.1:9222",
  );
  assert.equal(
    summarizeEndpointForDisplay({ host: "::1", port: 9222 }),
    "::1:9222",
  );
});

test("summarizeEndpointForDisplay redacts non-loopback host", () => {
  assert.equal(
    summarizeEndpointForDisplay({ host: "example.internal", port: 9222 }),
    "[redacted-host]:9222",
  );
});

test("readEndpointConfig treats non-string cdpHost as empty", () => {
  const config = {
    get<T>(section: string, defaultValue: T): T {
      if (section === "cdpHost") {
        return { nested: "value" } as unknown as T;
      }

      return defaultValue;
    },
  };

  const result = readEndpointConfig(config);

  assert.equal(result.host, "");
});

test("readEndpointConfig treats non-number cdpPort as NaN", () => {
  const config = {
    get<T>(section: string, defaultValue: T): T {
      if (section === "cdpPort") {
        return "9222" as unknown as T;
      }

      return defaultValue;
    },
  };

  const result = readEndpointConfig(config);

  assert.equal(Number.isNaN(result.port), true);
});

test("summarizeEndpointForDisplay preserves port in output", () => {
  assert.equal(
    summarizeEndpointForDisplay({ host: "localhost", port: 9333 }),
    "localhost:9333",
  );
  assert.equal(
    summarizeEndpointForDisplay({ host: "remote.host", port: 9333 }),
    "[redacted-host]:9333",
  );
});

// ---------------------------------------------------------------------------
// resolveDebugConfigurationEndpoint
// ---------------------------------------------------------------------------

const validSettings = makeSettings("localhost", 9222);

test("resolveDebugConfigurationEndpoint: both host and port from config → sources are debug-config", () => {
  const result = resolveDebugConfigurationEndpoint(
    {
      type: "t",
      request: "launch",
      name: "n",
      host: "192.168.1.1",
      port: 9333,
    },
    validSettings,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.endpoint.host, "192.168.1.1");
    assert.equal(result.endpoint.port, 9333);
    assert.equal(result.sources.host, "debug-config");
    assert.equal(result.sources.port, "debug-config");
  }
});

test("resolveDebugConfigurationEndpoint: omit host → falls back to settings, port stays debug-config", () => {
  const result = resolveDebugConfigurationEndpoint(
    { type: "t", request: "launch", name: "n", port: 9333 },
    validSettings,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.endpoint.host, "localhost");
    assert.equal(result.endpoint.port, 9333);
    assert.equal(result.sources.host, "settings");
    assert.equal(result.sources.port, "debug-config");
  }
});

test("resolveDebugConfigurationEndpoint: omit port → falls back to settings, host stays debug-config", () => {
  const result = resolveDebugConfigurationEndpoint(
    { type: "t", request: "launch", name: "n", host: "127.0.0.1" },
    validSettings,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.endpoint.host, "127.0.0.1");
    assert.equal(result.endpoint.port, 9222);
    assert.equal(result.sources.host, "debug-config");
    assert.equal(result.sources.port, "settings");
  }
});

test("resolveDebugConfigurationEndpoint: omit both → both fall back to settings", () => {
  const result = resolveDebugConfigurationEndpoint(
    { type: "t", request: "launch", name: "n" },
    validSettings,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.endpoint.host, "localhost");
    assert.equal(result.endpoint.port, 9222);
    assert.equal(result.sources.host, "settings");
    assert.equal(result.sources.port, "settings");
  }
});

test("resolveDebugConfigurationEndpoint: port 0 → failure naming port with debug-config corrective action", () => {
  const result = resolveDebugConfigurationEndpoint(
    { type: "t", request: "launch", name: "n", host: "localhost", port: 0 },
    validSettings,
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.field, "port");
    assert.match(result.error.correctiveAction, /launch\.json/);
    assert.match(result.error.correctiveAction, /"port"/);
  }
});

test("resolveDebugConfigurationEndpoint: port 70000 → failure naming port with debug-config corrective action", () => {
  const result = resolveDebugConfigurationEndpoint(
    { type: "t", request: "launch", name: "n", host: "localhost", port: 70000 },
    validSettings,
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.field, "port");
    assert.match(result.error.correctiveAction, /launch\.json/);
  }
});

test("resolveDebugConfigurationEndpoint: non-integer port → failure naming port with debug-config corrective action", () => {
  const result = resolveDebugConfigurationEndpoint(
    {
      type: "t",
      request: "launch",
      name: "n",
      host: "localhost",
      port: 9222.5,
    },
    validSettings,
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.field, "port");
    assert.match(result.error.correctiveAction, /launch\.json/);
  }
});

test("resolveDebugConfigurationEndpoint: port is a string (wrong type) → failure naming port with debug-config corrective action", () => {
  const result = resolveDebugConfigurationEndpoint(
    {
      type: "t",
      request: "launch",
      name: "n",
      host: "localhost",
      port: "9222" as unknown as number,
    },
    validSettings,
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.field, "port");
    assert.match(result.error.correctiveAction, /launch\.json/);
    assert.match(result.error.correctiveAction, /"port"/);
  }
});

test("resolveDebugConfigurationEndpoint: empty string host → failure naming host with debug-config corrective action", () => {
  const result = resolveDebugConfigurationEndpoint(
    { type: "t", request: "launch", name: "n", host: "", port: 9222 },
    validSettings,
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.field, "host");
    assert.match(result.error.correctiveAction, /launch\.json/);
    assert.match(result.error.correctiveAction, /"host"/);
  }
});

test("resolveDebugConfigurationEndpoint: host is non-string (wrong type) → failure naming host with debug-config corrective action", () => {
  const result = resolveDebugConfigurationEndpoint(
    {
      type: "t",
      request: "launch",
      name: "n",
      host: 42 as unknown as string,
      port: 9222,
    },
    validSettings,
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.field, "host");
    assert.equal(
      result.error.message,
      "Invalid CDP host: host must be a string.",
    );
    assert.match(result.error.correctiveAction, /launch\.json/);
  }
});

test("resolveDebugConfigurationEndpoint: invalid settings host after fallback → failure with settings corrective action", () => {
  const badHostSettings = makeSettings("", 9222);

  const result = resolveDebugConfigurationEndpoint(
    { type: "t", request: "launch", name: "n", port: 9222 },
    badHostSettings,
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.field, "host");
    assert.match(
      result.error.correctiveAction,
      /jupyterBrowserKernel\.cdpHost/,
    );
  }
});

test("resolveDebugConfigurationEndpoint: invalid settings port after fallback → failure with settings corrective action", () => {
  const badPortSettings = makeSettings("localhost", 0);

  const result = resolveDebugConfigurationEndpoint(
    { type: "t", request: "launch", name: "n", host: "localhost" },
    badPortSettings,
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.field, "port");
    assert.match(
      result.error.correctiveAction,
      /jupyterBrowserKernel\.cdpPort/,
    );
  }
});

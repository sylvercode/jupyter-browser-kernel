import test from "node:test";
import assert from "node:assert/strict";

import { summarizeEndpointForDisplay } from "../../../src/config/endpoint-config";
import { buildConnectionStateLogLine } from "../../../src/logging/connection-state-log";

test("buildConnectionStateLogLine emits timestamped state transitions", () => {
  const line = buildConnectionStateLogLine(
    "connected",
    undefined,
    "localhost:9222",
    "09:14:22",
  );

  assert.equal(
    line,
    "[09:14:22] Connection state: Connected (endpoint: localhost:9222)",
  );
});

test("buildConnectionStateLogLine includes category and guidance for error states", () => {
  const line = buildConnectionStateLogLine(
    "error",
    {
      category: "endpoint-connectivity",
      guidance: "Confirm remote debugging port and run Reconnect.",
    },
    "localhost:9222",
    "10:00:00",
  );

  assert.match(line, /^\[10:00:00\] Connection state: Error/);
  assert.match(line, /endpoint-connectivity/);
  assert.match(line, /Confirm remote debugging port/);
});

test("connection log lines can include redacted endpoint summaries", () => {
  const endpointSummary = summarizeEndpointForDisplay({
    host: "example.internal",
    port: 9222,
  });

  const line = buildConnectionStateLogLine(
    "disconnected",
    undefined,
    endpointSummary,
    "11:11:11",
  );

  assert.match(line, /endpoint: \[redacted-host\]:9222/);
});

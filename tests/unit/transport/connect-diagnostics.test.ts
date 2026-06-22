import test from "node:test";
import assert from "node:assert/strict";

import { formatConnectFailureMessage } from "../../../src/transport/connect-diagnostics";
import { createLocalizeMock } from "../test-utils/localize-mock.js";

const passthroughLocalize = createLocalizeMock();

test("formatConnectFailureMessage includes failure category and endpoint summary", () => {
  const message = formatConnectFailureMessage(
    {
      category: "endpoint-connectivity",
      message: "Connection refused.",
    },
    "localhost:9222",
    passthroughLocalize,
  );

  assert.match(message, /endpoint-connectivity/);
  assert.match(message, /localhost:9222/);
  assert.match(message, /Connection refused/);
  assert.match(message, /--remote-debugging-port/);
  assert.match(message, /localhost may point to the container/);
});

test("formatConnectFailureMessage includes target-mismatch actionable guidance", () => {
  const message = formatConnectFailureMessage(
    {
      category: "target-mismatch",
      message: "No valid browser target matched profile.",
    },
    "localhost:9222",
    passthroughLocalize,
  );

  assert.match(message, /target-mismatch/);
  assert.match(message, /Check browser tab selection/);
  assert.match(message, /Verify endpoint host\/port configuration/);
});

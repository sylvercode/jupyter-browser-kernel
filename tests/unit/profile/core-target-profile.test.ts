import test from "node:test";
import assert from "node:assert/strict";

import { coreTargetProfile } from "../../../src/profile/core-target-profile.js";

test("coreTargetProfile accepts page targets", () => {
  assert.equal(
    coreTargetProfile.isEligible({
      targetId: "a",
      type: "page",
      url: "https://example.test/anything",
    }),
    true,
  );
});

test("coreTargetProfile rejects non-page targets", () => {
  assert.equal(
    coreTargetProfile.isEligible({
      targetId: "a",
      type: "service_worker",
      url: "https://example.test/anything",
    }),
    false,
  );
});

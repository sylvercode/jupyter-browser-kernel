import test from "node:test";
import assert from "node:assert/strict";

import {
  getActiveProfile,
  selectTarget,
  type TargetProfile,
} from "../../../src/profile/target-profile.js";

test("selectTarget picks deterministic eligible target for a profile", () => {
  const profile: TargetProfile = {
    name: "test-profile",
    isEligible: (target) => target.type === "page",
    getMismatchMessage: (localize) => localize("mismatch"),
  };

  const selected = selectTarget(
    [
      {
        targetId: "3",
        type: "page",
        url: "https://example.test/z",
      },
      {
        targetId: "1",
        type: "page",
        url: "https://example.test/a",
      },
      {
        targetId: "2",
        type: "service_worker",
        url: "https://example.test/a",
      },
    ],
    profile,
    (input) => (typeof input === "string" ? input : input.message),
  );

  assert.equal(selected.ok, true);
  if (selected.ok) {
    assert.equal(selected.target.targetId, "1");
  }
});

test("selectTarget returns target-mismatch with profile mismatch message", () => {
  const profile: TargetProfile = {
    name: "test-profile",
    isEligible: () => false,
    getMismatchMessage: (localize) =>
      localize("No targets matched test profile."),
  };

  const selected = selectTarget(
    [
      {
        targetId: "1",
        type: "page",
        url: "https://example.test/a",
      },
    ],
    profile,
    (input) => (typeof input === "string" ? input : input.message),
  );

  assert.equal(selected.ok, false);
  if (!selected.ok) {
    assert.equal(selected.failure.category, "target-mismatch");
    assert.equal(selected.failure.message, "No targets matched test profile.");
  }
});

test("getActiveProfile returns core profile", () => {
  const profile = getActiveProfile();

  assert.equal(profile.name, "core");
});

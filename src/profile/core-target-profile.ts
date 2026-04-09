import type { BrowserTargetInfo, TargetProfile } from "./profile-types";

function isCoreEligibleTarget(target: BrowserTargetInfo): boolean {
  return target.type === "page";
}

export const coreTargetProfile: TargetProfile = {
  name: "core",
  isEligible: isCoreEligibleTarget,
  getMismatchMessage: (localize) =>
    localize(
      "No valid browser page target was found. Open the page you want to execute against and retry.",
    ),
};

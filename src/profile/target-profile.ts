import type { ConnectFailure } from "../transport/connect-types";
import type { Localize } from "../config/endpoint-config";
import { coreTargetProfile } from "./core-target-profile";
import type { BrowserTargetInfo, TargetProfile } from "./profile-types";

export type { BrowserTargetInfo, TargetProfile } from "./profile-types";

export type TargetSelection =
  | { ok: true; target: BrowserTargetInfo }
  | { ok: false; failure: ConnectFailure };

function selectDeterministicTarget(
  targets: BrowserTargetInfo[],
): BrowserTargetInfo {
  const sortedTargets = [...targets].sort((left, right) => {
    const leftUrl = left.url ?? "";
    const rightUrl = right.url ?? "";

    const urlCompare = leftUrl.localeCompare(rightUrl);
    if (urlCompare !== 0) {
      return urlCompare;
    }

    return left.targetId.localeCompare(right.targetId);
  });

  return sortedTargets[0];
}

export function selectTarget(
  targets: BrowserTargetInfo[],
  profile: TargetProfile,
  localize: Localize,
): TargetSelection {
  const eligibleTargets = targets.filter((target) =>
    profile.isEligible(target),
  );

  if (eligibleTargets.length === 0) {
    return {
      ok: false,
      failure: {
        category: "target-mismatch",
        message: profile.getMismatchMessage(localize),
      },
    };
  }

  return {
    ok: true,
    target: selectDeterministicTarget(eligibleTargets),
  };
}

export function getActiveProfile(): TargetProfile {
  return coreTargetProfile;
}

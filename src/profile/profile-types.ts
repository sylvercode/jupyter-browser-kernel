import type { Localize } from "../config/endpoint-config";

export interface BrowserTargetInfo {
  targetId: string;
  type?: string;
  url?: string;
  title?: string;
}

export interface TargetProfile {
  readonly name: string;
  isEligible: (target: BrowserTargetInfo) => boolean;
  getMismatchMessage: (localize: Localize) => string;
}

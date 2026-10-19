export interface LfaaProjectBuildInfo {
  currentVersion: string;
  publishedAt: string;
  releaseNotes: readonly string[];
  updateManifestUrl: string;
  feedUrl: string;
  releasePage: string;
}

declare const __LFAA_PROJECT_BUILD_INFO__: LfaaProjectBuildInfo;

export const lfaaProjectBuildInfo: LfaaProjectBuildInfo | null =
  typeof __LFAA_PROJECT_BUILD_INFO__ === "undefined" ? null : __LFAA_PROJECT_BUILD_INFO__;

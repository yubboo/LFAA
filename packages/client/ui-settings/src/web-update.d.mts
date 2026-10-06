export interface WebUpdateCheckResult {
  status: "available" | "up-to-date" | "disabled" | "error";
  currentVersion: string;
  latestVersion?: string;
  publishedAt?: string;
  releaseNotes?: readonly string[];
  mandatory?: boolean;
  minimumSupportedVersion?: string;
  releasePage?: string;
  message?: string;
}

export function inspectWebUpdateManifest(
  input: unknown,
  options: { currentVersion: string; expectedFeedUrl: string; expectedReleasePage: string }
): WebUpdateCheckResult;

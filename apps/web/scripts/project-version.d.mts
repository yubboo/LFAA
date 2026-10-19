interface ProjectPackageMetadata {
  version?: unknown;
  repository?: { url?: unknown };
}

interface ProjectReleaseManifestMetadata {
  version?: unknown;
  title?: unknown;
  publishedAt?: unknown;
  releaseNotes?: unknown;
}

export interface ProjectBuildMetadata {
  currentVersion: string;
  publishedAt: string;
  releaseNotes: readonly string[];
  updateManifestUrl: string;
  feedUrl: string;
  releasePage: string;
}

export function createProjectBuildMetadata(input: {
  projectPackage: ProjectPackageMetadata;
  webPackage: ProjectPackageMetadata;
  electronPackage: ProjectPackageMetadata;
  releaseManifest: ProjectReleaseManifestMetadata;
}): ProjectBuildMetadata;

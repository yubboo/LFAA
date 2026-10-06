interface ProjectPackageMetadata {
  version?: unknown;
  repository?: { url?: unknown };
}

export interface ProjectBuildMetadata {
  currentVersion: string;
  updateManifestUrl: string;
  feedUrl: string;
  releasePage: string;
}

export function createProjectBuildMetadata(input: {
  projectPackage: ProjectPackageMetadata;
  webPackage: ProjectPackageMetadata;
  electronPackage: ProjectPackageMetadata;
}): ProjectBuildMetadata;

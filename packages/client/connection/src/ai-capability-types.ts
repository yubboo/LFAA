import type { ApplicationId } from "lfaa-util-values/src/application-id.js";

export type CapabilityInstallKind = "plugin" | "skill" | "prompt" | "tool" | "mcp" | "minecraft-plugin" | "minecraft-mod";

export interface CapabilityInstallCatalogEntry {
  kind: CapabilityInstallKind;
  available: boolean;
  applicationIds: ApplicationId[];
  operations: string[];
  reason: string | null;
}

export interface ManagedPluginCandidate {
  owner: string;
  name: string;
  fullName: string;
  description: string;
  stars: number;
  license: string | null;
  defaultBranch: string;
  url: string;
  updatedAt: string;
  sourceType: "github";
  requiresInspection: true;
  warning: string;
}

export interface ManagedPluginInspection {
  id: string;
  name: string;
  version: string;
  description: string;
  compatibility: "lfaa-v1" | "dsh-v1" | "unsupported";
  runtimeEntry: string | null;
  capabilities: string[];
  applicationIds: ApplicationId[];
  reason: string | null;
  sourceType: "github" | "npm" | "local";
  sourceLocation: string;
  registryUrl: string | null;
  repository: { owner: string; name: string; fullName: string; description: string; stars: number; license: string | null; defaultBranch: string; url: string };
  requestedRef: string;
  resolvedRef: string;
  resolvedCommit: string;
  archiveSha256: string;
  requirements: {
    dshVersion: string | null;
    hostEntry: string | null;
    bundlePatch: string | string[] | null;
    clientEntry: string | null;
    clientPlatform: string | null;
    clientInject: string[];
    peerDependencies: Record<string, string>;
    packageDependencies: string[];
    declaredScripts: string[];
  };
  license: string | null;
  canEnable: boolean;
  runtimeReason: string | null;
}

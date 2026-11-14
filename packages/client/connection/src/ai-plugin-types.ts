import type { ApplicationId } from "lfaa-util-values/src/application-id.js";

export interface AiExtension {
  id: string;
  pluginId: string;
  kind: "agent" | "llm-provider" | "skill" | "prompt" | "expert" | "tool";
  name: string;
  version: string;
  description: string;
  /** Stable SkillRegistry key for skill entries; used by Settings to toggle the same capability. */
  skillId?: string;
  applicationIds?: ApplicationId[];
  toolPolicy?: { risk: "read" | "write" | "dangerous"; workspaceBound: boolean };
}

export interface AiRuntimeHookInfo {
  id: string;
  events: Array<"beforeInference" | "afterInference" | "requestRoute">;
}

export interface AiRuntimePlugin {
  id: string;
  name: string;
  enabled: boolean;
  disabled: boolean;
  required: boolean;
  profileDisabled: boolean;
  canToggle: boolean;
  canReload: boolean;
  state: string;
}

export interface ManagedPluginRecord {
  id: string;
  name: string;
  version: string;
  description: string;
  source: { kind?: "github" | "npm" | "local"; repository: string; requestedRef: string; commit: string; archiveSha256: string; license: string | null };
  compatibility: "lfaa-v1" | "dsh-v1" | "unsupported";
  runtimeEntry: string | null;
  capabilities: string[];
  applicationIds: ApplicationId[];
  state: "installed" | "enabled" | "incompatible";
  reason: string | null;
  installedAt: string;
  installedBy: string;
}

export interface ManagedPluginInstallProgress {
  stage: "resolving" | "source-verified" | "compatibility-checked" | "writing-files" | "committing-inventory" | "already-installed" | "installed";
  message: string;
  pluginId?: string;
  name?: string;
  version?: string;
  sourceType?: "github" | "npm" | "local";
  resolvedRef?: string;
  archiveSha256?: string;
  fileCount?: number;
  totalBytes?: number;
  state?: ManagedPluginRecord["state"];
}

/**
 * 可安装 AI 能力目录及来源检查的认证 Connection 端点。
 */
import { request } from "./http-client.js";
import type { CapabilityInstallCatalogEntry, ManagedPluginCandidate, ManagedPluginInspection } from "./ai-capability-types.js";



export interface AiSkillDirectoryEntry {
  id: string;
  name: string;
  description: string;
  kind: "skill";
  source: string;
  origin: string;
  enabled: boolean;
}


export function loadAiSkillDirectory(signal?: AbortSignal): Promise<{ skills: AiSkillDirectoryEntry[]; truncated: boolean }> {
  return request<{ skills: AiSkillDirectoryEntry[]; truncated: boolean }>("/ai/skills", { signal });
}


export function loadCapabilityInstallCatalog(): Promise<{ capabilities: CapabilityInstallCatalogEntry[] }> {
  return request("/capabilities/catalog");
}


export function searchManagedPlugins(query: string, signal?: AbortSignal): Promise<{ candidates: ManagedPluginCandidate[] }> {
  return request("/plugins/search", { method: "POST", body: JSON.stringify({ query }), ...(signal ? { signal } : {}) });
}


export function inspectManagedPlugin(source: string, ref?: string, signal?: AbortSignal, npmRegistry?: string): Promise<{ plugin: ManagedPluginInspection }> {
  return request("/plugins/inspect", { method: "POST", body: JSON.stringify({ repositoryUrl: source, ...(ref ? { ref } : {}), ...(npmRegistry ? { npmRegistry } : {}) }), ...(signal ? { signal } : {}) });
}

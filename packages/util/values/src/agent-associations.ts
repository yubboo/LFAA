/** 可选关联只保存引用，既不加载正文也不扩大执行权限。 */
import { APPLICATION_IDS, type ApplicationId } from "./application-id.js";

export interface AgentAssociations { applicationIds: ApplicationId[]; capabilityIds: string[] }
export function isAgentAssociations(value: unknown): value is AgentAssociations {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).every(key => key === "applicationIds" || key === "capabilityIds")
    && Array.isArray(item.applicationIds) && item.applicationIds.length <= APPLICATION_IDS.length
    && item.applicationIds.every(id => APPLICATION_IDS.includes(id as ApplicationId))
    && new Set(item.applicationIds).size === item.applicationIds.length
    && Array.isArray(item.capabilityIds) && item.capabilityIds.length <= 16
    && item.capabilityIds.every(id => typeof id === "string" && /^[A-Za-z0-9._:/-]{1,180}$/u.test(id))
    && new Set(item.capabilityIds).size === item.capabilityIds.length;
}

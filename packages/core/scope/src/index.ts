/**
 * 功能：为 Harness 能力提供统一的 App 与子 Agent 可见范围判断。
 * 作用：只约束哪些能力可呈现给当前模型，不代替服务端授权、参数校验或审批。
 * 关联文件：packages/core/agent、packages/core/tools、packages/core/agent-loop。
 */
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";

export interface AiCapabilityScope {
  applicationId: ApplicationId;
  /** 缺省表示使用当前 App 已登记的全部工具；空数组表示不暴露任何工具。 */
  allowedToolNames?: readonly string[];
}

export interface AiScopedCapability {
  applicationIds?: readonly ApplicationId[];
  name?: string;
}

/** 未声明 App 范围表示通用扩展；空范围不对任何 App 可见。 */
export function isApplicationInScope(
  applicationIds: readonly ApplicationId[] | undefined,
  applicationId: ApplicationId
): boolean {
  return applicationIds === undefined || applicationIds.includes(applicationId);
}

/** App 范围与可选的子 Agent 工具允许集取交集，保持输入顺序且不修改来源数组。 */
export function isAiCapabilityInScope(
  capability: AiScopedCapability,
  scope: AiCapabilityScope
): boolean {
  if (!isApplicationInScope(capability.applicationIds, scope.applicationId)) return false;
  if (scope.allowedToolNames === undefined) return true;
  return typeof capability.name === "string" && scope.allowedToolNames.includes(capability.name);
}

export function filterAiCapabilitiesInScope<T extends AiScopedCapability>(
  capabilities: readonly T[],
  scope: AiCapabilityScope
): T[] {
  return capabilities.filter((capability) => isAiCapabilityInScope(capability, scope));
}

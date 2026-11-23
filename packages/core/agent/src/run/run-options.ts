// 续跑复用的运行选项：延续用户上一轮选的模型、预算与权限模式，避免续跑悄悄退回默认值。
import type { StartAgentRunInput } from "../types";

export type RunOptionCache = Pick<
  StartAgentRunInput,
  "profileId" | "agentId" | "bindingId" | "reasoningEffort" | "permissionMode" | "maxSteps" | "autoExtendSteps" | "repeatToolThresholds"
>;

/** 只挑续跑需要的字段，避免把消息、附件等一次性输入带进下一轮。 */
export function pickRunOptions(input: StartAgentRunInput): RunOptionCache {
  return {
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
    ...(input.bindingId !== undefined ? { bindingId: input.bindingId } : {}),
    ...(input.reasoningEffort !== undefined ? { reasoningEffort: input.reasoningEffort } : {}),
    ...(input.permissionMode !== undefined ? { permissionMode: input.permissionMode } : {}),
    ...(input.maxSteps !== undefined ? { maxSteps: input.maxSteps } : {}),
    ...(input.autoExtendSteps !== undefined ? { autoExtendSteps: input.autoExtendSteps } : {}),
    ...(input.repeatToolThresholds !== undefined ? { repeatToolThresholds: input.repeatToolThresholds } : {}),
  };
}

/** 本次运行实际使用的 agent 与绑定：显式入参 > 会话设置 > 缺省（内置小鱼 + 默认绑定）。 */
export function resolveRunRouting(
  input: Pick<StartAgentRunInput, "agentId" | "bindingId">,
  session?: { agentId?: string; bindingOverrideId?: string } | null,
): { agentId?: string; bindingId?: string } {
  const agentId = input.agentId ?? session?.agentId;
  const bindingId = input.bindingId ?? session?.bindingOverrideId;
  return {
    ...(agentId ? { agentId } : {}),
    ...(bindingId ? { bindingId } : {}),
  };
}
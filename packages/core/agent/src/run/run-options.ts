// 续跑复用的运行选项：延续用户上一轮选的模型、预算与权限模式，避免续跑悄悄退回默认值。
import type { StartAgentRunInput } from "../types";

export type RunOptionCache = Pick<
  StartAgentRunInput,
  "profileId" | "reasoningEffort" | "permissionMode" | "maxSteps" | "autoExtendSteps" | "repeatToolThresholds"
>;

/** 只挑续跑需要的字段，避免把消息、附件等一次性输入带进下一轮。 */
export function pickRunOptions(input: StartAgentRunInput): RunOptionCache {
  return {
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    ...(input.reasoningEffort !== undefined ? { reasoningEffort: input.reasoningEffort } : {}),
    ...(input.permissionMode !== undefined ? { permissionMode: input.permissionMode } : {}),
    ...(input.maxSteps !== undefined ? { maxSteps: input.maxSteps } : {}),
    ...(input.autoExtendSteps !== undefined ? { autoExtendSteps: input.autoExtendSteps } : {}),
    ...(input.repeatToolThresholds !== undefined ? { repeatToolThresholds: input.repeatToolThresholds } : {}),
  };
}
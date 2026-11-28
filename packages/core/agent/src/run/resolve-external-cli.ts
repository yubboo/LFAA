// 解析角色绑定或直接指定的外部 CLI 执行器（cli:*），把自定义角色指令拼入请求上下文。
// 关联：packages/core/agent/src/index.ts；运行环境：Node Host。
import type { AgentProfileService } from "@lfaa/agent-profile";
import type { LlmService } from "@lfaa/llm";
import type { ChatSessionRecord } from "@lfaa/memory";
import type { StartAgentRunInput } from "../types";

/** 拒绝用生图/生视频/语音模型发起对话运行；外部 CLI（cli:*）与角色绑定直接放行。 */
export async function assertChatModelAvailable(
  input: StartAgentRunInput,
  session: ChatSessionRecord | null | undefined,
  llm: LlmService,
  agentProfile?: AgentProfileService,
): Promise<void> {
  if (input.profileId?.startsWith("cli:")) return;
  const bound = Boolean(agentProfile && (input.agentId ?? session?.agentId ?? input.bindingId ?? session?.bindingOverrideId));
  if (bound) return;
  const catalog = await llm.listPublicProfiles().catch(() => ({ activeProfileId: "", profiles: [] }));
  const profile = catalog.profiles.find((item) => item.id === (input.profileId ?? catalog.activeProfileId)) ?? catalog.profiles[0];
  const kind = profile?.availableModels?.find((model) => model.id === profile.model)?.modelKind;
  if (!kind || kind === "chat") return;
  const label = kind === "image" ? "生图" : kind === "video" ? "生视频" : "语音";
  throw new Error(`当前选中的是${label}模型，不能用于对话。请直接在输入框发送生成描述，或切换回对话模型后重试。`);
}

export async function resolveExternalCliInput(
  input: StartAgentRunInput,
  session: ChatSessionRecord | null,
  agentProfile?: AgentProfileService,
): Promise<StartAgentRunInput> {
  if (input.profileId) return input;
  const targetAgentId = input.agentId ?? session?.agentId;
  if (!targetAgentId) return input;
  if (targetAgentId.startsWith("cli:")) {
    return { ...input, profileId: targetAgentId };
  }
  const def = agentProfile ? await agentProfile.getAgent(targetAgentId).catch(() => undefined) : undefined;
  if (!def?.cliAgentId) return input;
  const prefixedMsg = def.instructions && input.userMessage
    ? `[角色指令]\n${def.instructions}\n\n[用户请求]\n${input.userMessage}`
    : input.userMessage;
  return {
    ...input,
    profileId: `cli:${def.cliAgentId}`,
    ...(prefixedMsg !== undefined ? { userMessage: prefixedMsg } : {}),
  };
}

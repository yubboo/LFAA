// @lfaa/agent 运行装配辅助：把「某个 agent 的工具策略」解析出来交给工具层。
// 单独成文件是为了让 agent/index.ts 保持在行数上限内，且解析逻辑可独立测试。
import type { Context } from "@deepseek-ai/cordis";
import type { AgentProfileService } from "@lfaa/agent-profile";

/** 返回一个解析器：未装配 agent 定义服务或没有策略时返回 undefined（表示不限制）。 */
export function createToolPolicyResolver(ctx: Context) {
  return async (agentId?: string) => {
    const profile = ctx.get("agentProfile") as AgentProfileService | undefined;
    if (!profile || !agentId) return undefined;
    return (await profile.getAgent(agentId))?.toolPolicy;
  };
}
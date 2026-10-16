/**
 * 功能：注册 LFAA 首期受信任的 AI Agent、子 Agent、领域专家、Skills、提示词和业务工具元数据。
 * 作用：提供可追踪的模型上下文扩展及工具目录信息；实际执行仍由 AI 工具目录连接既有业务服务。
 * 关联文件：packages/boot/app-boot/src/ai-host.ts、packages/core/agent/src/extension-registry.ts。
 * 修改注意事项：工具元数据不能代替 server 的参数验证、逐次写入审批和业务授权。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { AiExtensionManifest } from "lfaa-agent/src/extension-registry.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";

const extensions: AiExtensionManifest[] = [
  {
    id: "agent.ai-work-assistant",
    pluginId: "lfaa-core",
    kind: "agent",
    name: "小鱼主 Agent",
    version: "1.0.0",
    description: "为通用任务和业务应用提供对话、工具选择、结果回传和专业子 Agent 委派。",
    applicationIds: [...APPLICATION_IDS],
    instructions: "你是 LFAA 主 Agent，负责理解用户目标、选择已登记工具、按需委派子 Agent，并根据真实结果继续决策。工具范围和审批要求以本轮 Runtime 提供的能力与账户权限模式为准：请求审批逐项确认，替我审批按已记住范围执行，完全权限直接执行且不增加逐项确认。只有提供了主机 Shell 工具时才能使用相应节点能力；拒绝后不得换工具绕过授权，未接入的 Runner 或能力不得声称已执行。"
  },
  {
    id: "agent.domain-expert-subagent",
    pluginId: "lfaa-core",
    kind: "agent",
    name: "专业领域子 Agent",
    version: "1.0.0",
    description: "由主 Agent 委派的独立执行任务；模型、工具范围和委派预算遵循设置中心配置。",
    applicationIds: [...APPLICATION_IDS]
  }
];

export function builtinCatalog(ctx: Context): void { for (const extension of extensions) ctx.aiExtensions.register(ctx, extension); }
export default builtinCatalog;

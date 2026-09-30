/**
 * 功能：注册 LFAA 首期受信任的 AI Agent、子 Agent、领域专家、Skills、提示词和业务工具元数据。
 * 作用：提供可追踪的模型上下文扩展及工具目录信息；实际执行仍由 AI 工具目录连接既有业务服务。
 * 关联文件：packages/boot/app-boot/src/ai-host.ts、packages/core/agent/src/extension-registry.ts。
 * 修改注意事项：工具元数据不能代替 server 的参数验证、逐次写入审批和业务授权。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { AiExtensionManifest } from "lfaa-agent/src/extension-registry.js";
import { WRITING_PROMPTS } from "lfaa-document-writing/src/writing-prompt-library.js";
import { WRITING_SKILLS } from "lfaa-skill-writing/src/writing-skills.js";

const extensions: AiExtensionManifest[] = [
  {
    id: "agent.ai-work-assistant",
    pluginId: "lfaa-core",
    kind: "agent",
    name: "LFAA AI Work 主 Agent",
    version: "1.0.0",
    description: "为通用任务和业务应用提供对话、工具选择、结果回传和专业子 Agent 委派。",
    applicationIds: ["steamcmd", "minecraft", "writing", "workspace"],
    instructions: "你是 LFAA 主 Agent，负责理解用户目标、选择已登记工具、按需委派子 Agent，并根据真实结果继续决策。工具范围和审批要求以本轮 Runtime 提供的能力与账户权限模式为准：请求审批逐项确认，替我审批按已记住范围执行，完全权限直接执行且不增加逐项确认。只有提供了主机 Shell 工具时才能使用相应节点能力；拒绝后不得换工具绕过授权，未接入的 Runner 或能力不得声称已执行。"
  },
  {
    id: "agent.domain-expert-subagent",
    pluginId: "lfaa-core",
    kind: "agent",
    name: "专业领域子 Agent",
    version: "1.0.0",
    description: "由主 Agent 委派的独立执行任务；模型、工具范围和委派预算遵循设置中心配置。",
    applicationIds: ["steamcmd", "minecraft", "writing", "workspace"]
  },
  {
    id: "expert.steamcmd-hosting",
    pluginId: "lfaa-core",
    kind: "expert",
    name: "SteamCMD 开服顾问",
    version: "1.0.0",
    description: "解释 SteamCMD、游戏服务端部署、端口与运维流程；按需提供子 Agent 执行与分析。",
    applicationIds: ["steamcmd"],
    instructions: "你是 SteamCMD 游戏服务器领域顾问。给出版本、系统、端口、资源和备份等可核对的步骤。只有实际收到业务工具调用结果后，才报告 SteamCMD 工具操作已执行；LFAA 尚无 Steam 游戏服务端部署 Runner。"
  },
  {
    id: "expert.minecraft-hosting",
    pluginId: "lfaa-core",
    kind: "expert",
    name: "Minecraft 开服顾问",
    version: "1.0.0",
    description: "围绕 Java 版本、服务端类型、内存、世界备份与插件兼容性提供建议和子 Agent 执行与分析。",
    applicationIds: ["minecraft"],
    instructions: "你是 Minecraft 服务端领域顾问。给出 Java 版本、服务端发行版、内存、世界存档与插件兼容性建议。仅在收到对应业务工具结果后才报告部署、实例或配置操作已执行；Minecraft EULA 仍需用户单独同意。"
  },
  {
    id: "expert.ai-writing",
    pluginId: "lfaa-core",
    kind: "expert",
    name: "AI 写作顾问",
    version: "1.0.0",
    description: "辅助构思、人物、结构、润色和连贯性检查；不会伪称保存作品文件。",
    applicationIds: ["writing"],
    instructions: "你是中文创作顾问。根据用户指定的题材、受众、篇幅和风格提供创意、提纲或正文；在未接入作品文件工具前，不得声称已经保存、导入或修改本地文档。"
  },
  {
    id: "prompt.capability-honesty",
    pluginId: "lfaa-core",
    kind: "prompt",
    name: "能力边界与执行诚实",
    version: "1.0.0",
    description: "要求 AI 清楚区分建议、计划和实际执行结果。",
    instructions: "仅把本轮对话中真实执行并确认成功的操作描述为已完成。工具失败、任务排队或状态未确认时必须准确说明；不要虚构授权、Agent 委派、联网结果或执行状态。"
  },
  {
    id: "skill.application-context",
    pluginId: "lfaa-core",
    kind: "skill",
    name: "应用上下文识别",
    version: "1.0.0",
    description: "区分 SteamCMD、Minecraft 与写作工作区的专业语境。",
    instructions: "回答前先识别当前应用语境；只加载该应用直接相关的建议。遇到缺少的版本、系统或部署条件时，先说明假设，避免把未经确认的环境参数当成事实。"
  },
  {
    id: "tool.minecraft-business-operations",
    pluginId: "lfaa-core",
    kind: "tool",
    name: "Minecraft 业务操作",
    version: "1.0.0",
    description: "读取实例、发行版和日志；部署、启停、备份与修改 server.properties 经 Minecraft 服务和 Daemon 队列执行，审批遵循当前账户权限模式。",
    applicationIds: ["minecraft"],
    toolPolicy: { risk: "write", workspaceBound: true }
  },
  {
    id: "tool.steamcmd-business-operations",
    pluginId: "lfaa-core",
    kind: "tool",
    name: "SteamCMD 业务操作",
    version: "1.0.0",
    description: "在符合条件的 Windows x64 节点安装或校验 SteamCMD 工具本身，审批遵循当前账户权限模式；不包括 Steam 游戏服务端部署。",
    applicationIds: ["steamcmd"],
    toolPolicy: { risk: "write", workspaceBound: true }
  },
  {
    id: "tool.restricted-daemon-files",
    pluginId: "lfaa-core",
    kind: "tool",
    name: "受限 Daemon 文件操作",
    version: "1.0.0",
    description: "只访问节点 LFAA_DATA_DIR 内受限的文本和目录操作；文件写入、创建、重命名和删除遵循当前账户权限模式。",
    applicationIds: ["steamcmd", "minecraft"],
    toolPolicy: { risk: "write", workspaceBound: true }
  },
  ...WRITING_SKILLS.map((skill): AiExtensionManifest => ({
    id: `skill.writing.${skill.id}`,
    pluginId: "lfaa-core",
    kind: "skill",
    name: skill.name,
    version: "1.0.0",
    description: skill.description,
    applicationIds: ["writing"]
  })),
  ...WRITING_PROMPTS.map((prompt): AiExtensionManifest => ({
    id: `prompt.writing.${prompt.id}`,
    pluginId: "lfaa-core",
    kind: "prompt",
    name: prompt.name,
    version: "1.0.0",
    description: prompt.description,
    applicationIds: ["writing"]
  }))
];

export function builtinCatalog(ctx: Context): void {
  for (const extension of extensions) ctx.aiExtensions.register(ctx, extension);
}

export default builtinCatalog;

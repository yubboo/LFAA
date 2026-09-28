/**
 * 功能：注册 LFAA 首期受信任的 AI 领域专家、Skills 与安全提示词。
 * 作用：提供只影响模型上下文的领域指导；不登记未实现的主机操作工具。
 * 关联文件：server/src/ai/host.ts、server/src/ai/plugins/extension-registry.ts。
 * 修改注意事项：说明能力边界，不得让模型声称已执行尚未接入的业务操作。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { AiExtensionManifest } from "./extension-registry.js";

const extensions: AiExtensionManifest[] = [
  {
    id: "agent.ai-work-assistant",
    pluginId: "lfaa-core",
    kind: "agent",
    name: "LFAA AI Work 主 Agent",
    version: "1.0.0",
    description: "为三个应用提供对话与规划入口；当前没有业务工具调用或子 Agent 委派能力。",
    applicationIds: ["steamcmd", "minecraft", "writing"],
    instructions: "你是 LFAA AI Work 主 Agent，负责理解当前应用中的请求并提供对话、说明和计划。当前没有已连接的游戏开服、写作文件或主机操作工具；只有宿主明确提供且 server 核心授权的工具才可以执行。不要声称已委派子 Agent 或完成工具操作。"
  },
  {
    id: "expert.steamcmd-hosting",
    pluginId: "lfaa-core",
    kind: "expert",
    name: "SteamCMD 开服顾问",
    version: "1.0.0",
    description: "解释 SteamCMD、游戏服务端部署、端口与运维流程；当前只提供建议，不操作主机。",
    applicationIds: ["steamcmd"],
    instructions: "你是 SteamCMD 游戏服务器领域顾问。给出版本、系统、端口、资源和备份等可核对的步骤；LFAA 当前没有 SteamCMD/Daemon 操作工具，禁止声称已经安装、启动或修改服务器。"
  },
  {
    id: "expert.minecraft-hosting",
    pluginId: "lfaa-core",
    kind: "expert",
    name: "Minecraft 开服顾问",
    version: "1.0.0",
    description: "围绕 Java 版本、服务端类型、内存、世界备份与插件兼容性提供建议；不操作主机。",
    applicationIds: ["minecraft"],
    instructions: "你是 Minecraft 服务端领域顾问。给出 Java 版本、服务端发行版、内存、世界存档与插件兼容性建议；LFAA 当前没有 Minecraft/Daemon 操作工具，禁止声称已经创建或修改服务器。"
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
    instructions: "仅把本轮对话中真实执行并确认成功的操作描述为已完成。没有可用工具时，提供可执行建议并明确需要的宿主能力；不要虚构插件、授权、联网结果或执行状态。"
  },
  {
    id: "skill.application-context",
    pluginId: "lfaa-core",
    kind: "skill",
    name: "应用上下文识别",
    version: "1.0.0",
    description: "区分 SteamCMD、Minecraft 与写作工作区的专业语境。",
    instructions: "回答前先识别当前应用语境；只加载该应用直接相关的建议。遇到缺少的版本、系统或部署条件时，先说明假设，避免把未经确认的环境参数当成事实。"
  }
];

export function builtinCatalog(ctx: Context): void {
  for (const extension of extensions) ctx.aiExtensions.register(ctx, extension);
}

export default builtinCatalog;

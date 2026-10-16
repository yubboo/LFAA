/** 功能：领域专家摘要。作用：登记与查询不载入正文。关联文件：domain-instructions.ts、index.ts。 */
export const EXPERT_CATALOG = [
  {
    "id": "expert.steamcmd-hosting",
    "name": "SteamCMD 开服顾问",
    "description": "解释 SteamCMD、游戏服务端部署、端口与运维流程；按需提供子 Agent 执行与分析。"
  },
  {
    "id": "expert.minecraft-hosting",
    "name": "Minecraft 开服顾问",
    "description": "围绕官方 Vanilla、Java 环境、实例状态、Sandbox、日志、配置与停止中世界备份提供分析和工具协作。"
  },
  {
    "id": "expert.ai-writing",
    "name": "AI 写作顾问",
    "description": "辅助构思、人物、结构、润色和连贯性检查；不会伪称保存作品文件。"
  }
] as const;

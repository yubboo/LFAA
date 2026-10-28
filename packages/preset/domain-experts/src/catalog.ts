/** 功能：领域专家摘要。作用：登记与查询不载入正文。关联文件：domain-instructions.ts、index.ts。 */
export const EXPERT_CATALOG = [
  {
    "id": "expert.steamcmd-hosting",
    "name": "SteamCMD 开服顾问",
    "description": "解释 SteamCMD、游戏服务端部署、端口与运维流程；按需提供子 Agent 执行与分析。"
  },
  {
    "id": "expert.minecraft-hosting",
    "name": "Minecraft 应用维护员工",
    "description": "维护 LFAA Minecraft App 与 Minecraft 服务；按需开发、构建和验证 Minecraft Java 插件，并按真实工具结果处理节点和实例运维。"
  },
  {
    "id": "expert.ai-writing",
    "name": "AI 写作顾问",
    "description": "辅助构思、人物、结构、润色和连贯性检查；不会伪称保存作品文件。"
  },
  {
    "id": "expert.canvas-director",
    "name": "画布导演",
    "description": "在系统级无限画布上编排节点与连线：先读真实项目，再规划结构，调用真实画布工具执行，并回报真实结果与未接通能力。"
  }
] as const;

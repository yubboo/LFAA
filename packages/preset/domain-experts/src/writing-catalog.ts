/** 功能：写作角色元数据和稳定 ID 校验。作用：领域服务只消费元数据，正文按需加载。关联文件：writing-specialists.ts、Writing/service.ts。 */
export const WRITING_SPECIALISTS = [
  {
    "id": "writing-companion",
    "name": "创作顾问",
    "description": "讨论剧情、人物、设定和文案，按当前问题切换顾问角度。"
  },
  {
    "id": "outline-planner",
    "name": "大纲策划",
    "description": "关注故事因果、人物选择、阶段转折和可兑现的目标。"
  },
  {
    "id": "chapter-writer",
    "name": "章节写手",
    "description": "结合当前章节与作品设定推进场景动作、对白和节奏。"
  },
  {
    "id": "precision-editor",
    "name": "精准编辑",
    "description": "按指定范围润色或修改，尽量保留原意、事实和作者文风。"
  },
  {
    "id": "continuity-reviewer",
    "name": "连贯性审阅",
    "description": "检查前后因果、人物知情范围、时间地点和未兑现线索。"
  },
  {
    "id": "character-consultant",
    "name": "人物顾问",
    "description": "围绕人物动机、行动、关系张力、成长和对白提供建议。"
  }
] as const;
export type WritingSpecialistId = (typeof WRITING_SPECIALISTS)[number]["id"];
export function getWritingSpecialist(id: string) { return WRITING_SPECIALISTS.find(entry => entry.id === id) ?? null; }

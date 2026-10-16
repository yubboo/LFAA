/** 功能：写作 Skill 摘要。作用：Provider 不在目录阶段加载全文。关联文件：index.ts、writing-skills.ts。 */
export const WRITING_SKILL_CATALOG = [
  {
    "id": "outline-planning",
    "name": "大纲规划",
    "description": "把创作需求整理成有因果推进、人物选择和阶段转折的可执行大纲。"
  },
  {
    "id": "chapter-drafting",
    "name": "章节正文写作",
    "description": "结合当前作品大纲和章节上下文，续写可直接进入正文的内容。"
  },
  {
    "id": "precision-revision",
    "name": "精准润色与修改",
    "description": "按用户指定范围修改措辞或段落，尽量保留原意、叙事事实和个人文风。"
  },
  {
    "id": "continuity-review",
    "name": "大纲与正文连贯性审阅",
    "description": "对照本轮提供的作品大纲和章节正文，找出冲突、断点与待确认信息。"
  }
] as const;

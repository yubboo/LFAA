/**
 * 功能：writing 提示词摘要目录。
 * 作用：按职责登记能力，业务与权限继续归原 Owner，正文由模型按需加载。
 * 关联文件：index.ts、领域正文库。
 */
export const PROMPT_CATALOG = [
  {
    "id": "book-intro",
    "name": "作品简介",
    "description": "按已确认的题材、主角、视角与故事冲突生成或润色作品简介。"
  },
  {
    "id": "story-analysis",
    "name": "剧情分析",
    "description": "提取事件时间线、检查剧情因果并提出主线与支线建议。"
  },
  {
    "id": "reference-polish",
    "name": "大纲与设定润色",
    "description": "整理大纲、补足设定说明，或润色角色外貌、性格与背景。"
  },
  {
    "id": "naming",
    "name": "设定取名",
    "description": "为人物、地点、组织、功法、装备、怪物或道具起符合语境的名字。"
  },
  {
    "id": "writing-companion",
    "name": "妙笔写作顾问",
    "description": "提供剧情、人物、设定和文案四类顾问式创作建议。"
  },
  {
    "id": "cover-description",
    "name": "封面画面描述",
    "description": "把口语化构思整理成竖版书籍封面可用的画面描述。"
  },
  {
    "id": "book-planning",
    "name": "灵感、大纲与设定规划",
    "description": "从构思到整书大纲、卷章规划和世界设定，或按要求调整现有大纲。"
  },
  {
    "id": "rank-analysis",
    "name": "榜单趋势解读",
    "description": "根据用户提供的榜单数据和对照快照，总结变化与选题信号。"
  },
  {
    "id": "inspiration",
    "name": "灵感生成",
    "description": "生成能直接展开的单条网文故事灵感，并贴合当前作品语境。"
  },
  {
    "id": "competitor-breakdown",
    "name": "竞品章节拆解",
    "description": "从用户提供的章节或全书材料中分析钩子、节奏、结构与可迁移技巧。"
  },
  {
    "id": "selection-editing",
    "name": "选中文本处理",
    "description": "对当前选文进行润色、扩写、校对或执行用户指定的局部改写。"
  },
  {
    "id": "continuation",
    "name": "续写与短句补全",
    "description": "接续当前句子或场景下一拍，不重复上文、不跳出当前场景。"
  },
  {
    "id": "chapter-writing",
    "name": "逐章规划与正文写作",
    "description": "规划章纲、展开场景拍点、起草章节正文或按要求重写。"
  },
  {
    "id": "generic-writing",
    "name": "写作小任务",
    "description": "提炼章纲、拟章节/分卷名、润色分卷简介或展开章节细纲。"
  },
  {
    "id": "short-manuscript-analysis",
    "name": "短篇整篇拆解",
    "description": "按当前作品章节阅读短篇，分析结构、人物选择、因果、节奏和主题并给出可迁移技巧。"
  },
  {
    "id": "long-manuscript-analysis",
    "name": "长篇分段拆解",
    "description": "通过章节目录和有界正文读取分段分析长篇，记录覆盖范围并综合主线、人物、伏笔与节奏。"
  },
  {
    "id": "revision-analysis",
    "name": "章节修订分析",
    "description": "比较当前章节与历史修订，按差异证据分析修改目标、有效性和可复用的个人修订方法。"
  },
  {
    "id": "style-comparison",
    "name": "两篇文风比较",
    "description": "比较用户提供的参考文本与当前章节或作品资料样本，给出分维度相似度和证据。"
  }
] as const;

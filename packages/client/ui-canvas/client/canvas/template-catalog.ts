// 无限画布 5 大创作分类及多张子模板卡片预设，点击任一子模板一键生成多节点与连线图。
import type { CanvasEdge, CanvasNode } from "@lfaa/canvas/contract";

export interface CanvasSubTemplate {
  id: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  accent: "accent" | "violet" | "teal" | "orange" | "info";
  /** 构建预设节点与连线：返回可直接写入画布的 nodes 与 edges。 */
  build: (originX: number, originY: number) => { nodes: CanvasNode[]; edges: CanvasEdge[] };
}

export interface CanvasTemplateCategory {
  id: string;
  titleZh: string;
  titleEn: string;
  above: CanvasSubTemplate[];
  below: CanvasSubTemplate[];
}

/** 构造「文本输入 -> 生图 / 生视频」两段式或三段式基础节点流。 */
function buildPromptToMedia(
  originX: number,
  originY: number,
  promptText: string,
  targetKind: "image" | "video",
  branchSecond?: { kind: "image" | "video"; prompt: string },
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const promptId = crypto.randomUUID();
  const mainId = crypto.randomUUID();
  const nodes: CanvasNode[] = [
    { id: promptId, kind: "prompt", position: { x: originX, y: originY }, settings: { prompt: promptText } },
    {
      id: mainId,
      kind: targetKind,
      position: { x: originX + 360, y: branchSecond ? originY - 120 : originY },
      settings: targetKind === "video" ? { ratio: "16:9", resolution: "720p", duration: 5, mode: "reference" } : { ratio: "16:9" },
    },
  ];
  const edges: CanvasEdge[] = [
    { id: crypto.randomUUID(), source: promptId, sourcePort: "text", target: mainId, targetPort: "prompt" },
  ];
  if (branchSecond) {
    const secondId = crypto.randomUUID();
    nodes.push({
      id: secondId,
      kind: branchSecond.kind,
      position: { x: originX + 360, y: originY + 140 },
      settings: branchSecond.kind === "video"
        ? { ratio: "16:9", resolution: "720p", duration: 5, mode: "reference", prompt: branchSecond.prompt }
        : { ratio: "16:9", prompt: branchSecond.prompt },
    });
    edges.push({ id: crypto.randomUUID(), source: promptId, sourcePort: "text", target: secondId, targetPort: "prompt" });
  }
  return { nodes, edges };
}

/** 构造「文本 + 3D 预演 -> 生图/生视频」分镜工作流。 */
function buildStoryboardFlow(originX: number, originY: number, promptText: string): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const promptId = crypto.randomUUID();
  const previsId = crypto.randomUUID();
  const imageId = crypto.randomUUID();
  const nodes: CanvasNode[] = [
    { id: promptId, kind: "prompt", position: { x: originX, y: originY - 90 }, settings: { prompt: promptText } },
    { id: previsId, kind: "previs", position: { x: originX, y: originY + 170 }, settings: {} },
    { id: imageId, kind: "image", position: { x: originX + 380, y: originY + 20 }, settings: { ratio: "16:9" } },
  ];
  const edges: CanvasEdge[] = [
    { id: crypto.randomUUID(), source: promptId, sourcePort: "text", target: imageId, targetPort: "prompt" },
  ];
  return { nodes, edges };
}

export const CANVAS_TEMPLATE_CATEGORIES: CanvasTemplateCategory[] = [
  {
    id: "prompt-models",
    titleZh: "模型提示词",
    titleEn: "Model Prompts",
    above: [
      {
        id: "sd25-opt",
        titleZh: "SD2.5 提示词优化",
        titleEn: "SD2.5 Prompt Optimizer",
        summaryZh: "将自然语言需求规范为高质量出图提示词并并行生图。",
        summaryEn: "Convert ideas into structured image generation prompts.",
        accent: "accent",
        build: (x, y) => buildPromptToMedia(x, y, "电影级构图，柔焦逆光，细节丰富的写实光影画面", "image", { kind: "image", prompt: "特写镜头变体，浅景深氛围光" }),
      },
      {
        id: "h3-opt",
        titleZh: "H3 模型提示词优化",
        titleEn: "H3 Prompt Optimizer",
        summaryZh: "针对写实与风格化生图优化镜头语言、光影与材质描述。",
        summaryEn: "Optimize lighting, lens and material cues for H3.",
        accent: "violet",
        build: (x, y) => buildPromptToMedia(x, y, "广角电影画面，体积光穿透薄雾，高动态范围电影调色", "image"),
      },
    ],
    below: [
      {
        id: "wan3-ecom",
        titleZh: "Wan3 电商视频提示词",
        titleEn: "Wan3 E-commerce Video",
        summaryZh: "产品特写运镜 + 棚拍质感灯光，一键直出电商短片。",
        summaryEn: "Studio product showcase with smooth orbital camera.",
        accent: "orange",
        build: (x, y) => buildPromptToMedia(x, y, "高端玻璃瓶精华液静物棚拍，环绕缓慢推镜，微距水珠反光，柔和轮廓光", "video"),
      },
      {
        id: "wan3-drama",
        titleZh: "Wan3 文戏/情绪提示词",
        titleEn: "Wan3 Drama & Mood",
        summaryZh: "强化人物眼神、微表情与电影氛围灯光，适合叙事文戏。",
        summaryEn: "Expressive character performance with cinematic mood.",
        accent: "teal",
        build: (x, y) => buildPromptToMedia(x, y, "雨夜咖啡馆窗边双人中景，暖黄钨丝灯光映照脸庞，缓慢推进捕捉眼神变化", "video"),
      },
      {
        id: "wan3-comic",
        titleZh: "Wan3 漫剧提示词",
        titleEn: "Wan3 Anime Drama",
        summaryZh: "二次元赛璐璐光影与动态运镜，快速生成漫剧片段。",
        summaryEn: "Anime cel-shaded motion shots for episodic stories.",
        accent: "info",
        build: (x, y) => buildPromptToMedia(x, y, "精致二次元动画风格，星夜天台微风吹动发丝，镜头从背影缓缓环绕至正面", "video"),
      },
    ],
  },
  {
    id: "script-character",
    titleZh: "剧本和角色",
    titleEn: "Script & Character",
    above: [
      {
        id: "script-helper",
        titleZh: "剧本策划助手",
        titleEn: "Script Planner",
        summaryZh: "拆解故事大纲与关键镜头，直接串联生图与视频节点。",
        summaryEn: "Break down story beats into connected visual nodes.",
        accent: "orange",
        build: (x, y) => buildStoryboardFlow(x, y, "第一幕：黄昏废墟城市天台，主角回头望向远方亮起信号的灯塔"),
      },
      {
        id: "char-relation",
        titleZh: "人设和角色关系",
        titleEn: "Character & Relations",
        summaryZh: "建立主角与配角视觉设定，保持跨镜头外观一致。",
        summaryEn: "Define consistent character sheets across scenes.",
        accent: "teal",
        build: (x, y) => buildPromptToMedia(x, y, "双人角色概念设定图，冷暖对比服装配色，清晰面部与道具细节", "image", { kind: "image", prompt: "互动双人场景定妆照" }),
      },
    ],
    below: [
      {
        id: "char-sheet",
        titleZh: "专业角色设定板",
        titleEn: "Character Turnaround",
        summaryZh: "正面/侧面/背面三视图 + 表情差分，用于后续角色参考。",
        summaryEn: "Front/side/back turnaround sheet for reference.",
        accent: "accent",
        build: (x, y) => buildPromptToMedia(x, y, "专业角色三视图设定板，正面、侧面、背面全身站姿，中性灰背景，服装结构清晰", "image"),
      },
      {
        id: "story-illust",
        titleZh: "故事感角色插图",
        titleEn: "Narrative Illustration",
        summaryZh: "将角色融入强叙事环境光影，输出海报级关键帧。",
        summaryEn: "Place character in a rich narrative keyframe scene.",
        accent: "violet",
        build: (x, y) => buildPromptToMedia(x, y, "强故事感横版插画，角色立于光影交界处，前景虚化与大气透视", "image"),
      },
      {
        id: "mood-director",
        titleZh: "情绪表演导演",
        titleEn: "Performance Director",
        summaryZh: "聚焦特写微表情与运镜节奏，驱动生视频表现力。",
        summaryEn: "Close-up acting cues for expressive video generation.",
        accent: "info",
        build: (x, y) => buildPromptToMedia(x, y, "电影近景特写，人物神情由克制转为释然，浅景深手持微晃质感", "video"),
      },
    ],
  },
  {
    id: "commercial-ad",
    titleZh: "商业广告",
    titleEn: "Commercial Ads",
    above: [
      {
        id: "cinema-ad",
        titleZh: "电影及广告视听",
        titleEn: "Cinema Ad Visuals",
        summaryZh: "TVC 级构图与节奏分镜，适合品牌形象大片。",
        summaryEn: "TVC-grade cinematography and pacing workflow.",
        accent: "info",
        build: (x, y) => buildStoryboardFlow(x, y, "高端品牌形象广告，金色日出海岸线航拍缓缓降至人物背影"),
      },
    ],
    below: [
      {
        id: "ecom-showcase",
        titleZh: "Wan3 电商视频广告",
        titleEn: "Product Showcase Video",
        summaryZh: "商品精修视觉 + 动态镜头展示卖点与材质细节。",
        summaryEn: "Highlight product materials with dynamic camera moves.",
        accent: "orange",
        build: (x, y) => buildPromptToMedia(x, y, "极简黑金质感产品广告，丝绸光带掠过瓶身，高速微距慢动作", "video"),
      },
      {
        id: "transition-outfit",
        titleZh: "风扇转场换装",
        titleEn: "Transition Lookbook",
        summaryZh: "节奏感服装切换与光影转场，适合短视频带货。",
        summaryEn: "Snappy outfit transition shots for short-form ads.",
        accent: "accent",
        build: (x, y) => buildPromptToMedia(x, y, "时尚穿搭短视频，镜头快速推进转场完成风格切换，干净柔和棚拍光", "video"),
      },
    ],
  },
  {
    id: "game-fanart",
    titleZh: "游戏二创",
    titleEn: "Game Fanwork",
    above: [
      {
        id: "fanart-full",
        titleZh: "二创全流程分镜",
        titleEn: "Full Fanwork Pipeline",
        summaryZh: "从脚本设定、关键帧生图到动态视频一站式串联。",
        summaryEn: "End-to-end fanwork from concept to motion clip.",
        accent: "orange",
        build: (x, y) => buildStoryboardFlow(x, y, "奇幻庆典夜空灯笼漂浮，二次元角色仰望星空的史诗广角画面"),
      },
      {
        id: "chibi-style",
        titleZh: "Q版萌系角色形象",
        titleEn: "Chibi Character Sheet",
        summaryZh: "软萌三头身比例与治愈系色彩，快速出图与动效。",
        summaryEn: "Cute stylized chibi design with soft pastel lighting.",
        accent: "teal",
        build: (x, y) => buildPromptToMedia(x, y, "软萌 Q 版二次元角色，厚涂糖果色调，细腻毛绒与高光质感", "image"),
      },
    ],
    below: [
      {
        id: "char-in-scene",
        titleZh: "角色融入场景",
        titleEn: "Character in Scene",
        summaryZh: "保留角色特征的同时自然匹配樱花/雪夜等环境光。",
        summaryEn: "Blend character seamlessly into atmospheric scenes.",
        accent: "accent",
        build: (x, y) => buildPromptToMedia(x, y, "春日樱花飞舞的坡道，角色回眸微笑，逆光花瓣粒子与柔和景深", "image", { kind: "video", prompt: "花瓣随风飘落，发丝轻扬的 5 秒动态镜头" }),
      },
      {
        id: "fashion-editorial",
        titleZh: "二游角色时尚企划",
        titleEn: "Character Fashion Editorial",
        summaryZh: "现代潮流穿搭重构经典角色，杂志封面级视觉。",
        summaryEn: "Modern editorial fashion reinterpretation.",
        accent: "violet",
        build: (x, y) => buildPromptToMedia(x, y, "二次元角色现代高定潮流杂志封面，大胆排版构图与棚拍轮廓光", "image"),
      },
      {
        id: "dark-fairytale",
        titleZh: "二次元暗黑童话",
        titleEn: "Dark Fairytale",
        summaryZh: "哥特森林、冷雾月光与戏剧张力构图。",
        summaryEn: "Gothic moonlight forest with dramatic contrast.",
        accent: "info",
        build: (x, y) => buildPromptToMedia(x, y, "暗黑童话哥特森林，幽蓝月光与漂浮萤火，细腻华丽的礼服质感", "image"),
      },
    ],
  },
  {
    id: "original-creation",
    titleZh: "原创创作",
    titleEn: "Original Creation",
    above: [
      {
        id: "orig-short",
        titleZh: "原创短片分镜",
        titleEn: "Original Short Storyboard",
        summaryZh: "结合 3D 机位预演与多镜头生图，快速验证原创短片。",
        summaryEn: "Combine 3D camera blocking with keyframe renders.",
        accent: "accent",
        build: (x, y) => buildStoryboardFlow(x, y, "原创科幻短片开场：清晨雾中悬浮列车驶过海面高架桥"),
      },
      {
        id: "world-concept",
        titleZh: "世界观概念设定",
        titleEn: "Worldbuilding Concept",
        summaryZh: "构建宏大场景氛围与建筑地标，奠定视觉基调。",
        summaryEn: "Establish architectural landmarks and world mood.",
        accent: "teal",
        build: (x, y) => buildPromptToMedia(x, y, "原创东方赛博云海古城概念设定，层叠飞檐与霓虹云雾，史诗远景", "image"),
      },
    ],
    below: [
      {
        id: "orig-character",
        titleZh: "原创角色定妆",
        titleEn: "Original Character Look",
        summaryZh: "从零塑造原创主角形象、材质细节与光影气质。",
        summaryEn: "Design original protagonist look and styling.",
        accent: "violet",
        build: (x, y) => buildPromptToMedia(x, y, "原创主角半身定妆照，独特配饰与织物细节，电影柔光布光", "image"),
      },
      {
        id: "mood-film",
        titleZh: "情绪氛围短片",
        titleEn: "Atmospheric Short Clip",
        summaryZh: "光影、节奏与情绪流动兼具的原创视觉短片。",
        summaryEn: "Poetic visual short driven by light and motion.",
        accent: "orange",
        build: (x, y) => buildPromptToMedia(x, y, "夏日午后电车窗外掠过海面反光，柔和胶片颗粒，缓慢摇镜", "video"),
      },
    ],
  },
];

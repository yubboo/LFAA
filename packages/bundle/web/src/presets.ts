// @lfaa/bundle-web 模式预设：会话插件是从全局插件清单里挑出的子集，模式即该子集的命名组合。
/** 核心模块：应用启动必须存在，始终装配，不可由插件页单独安装。 */
export const CORE_MODULES: readonly string[] = [
  "@lfaa/sections",
  "@lfaa/workspace",
  "@lfaa/llm",
  "@lfaa/rules",
  "@lfaa/memory",
  "@lfaa/shell",
  "@lfaa/tools",
  "@lfaa/tool-todo",
  "@lfaa/tool-web",
  "@lfaa/skills",
  "@lfaa/plugins",
  "@lfaa/agent",
  "@lfaa/chat",
];

/** 可选模块：默认也装配，用户可按需停用。 */
export const OPTIONAL_MODULES: readonly string[] = [
  "@lfaa/browser",
  "@lfaa/jobs",
  "@lfaa/subagent",
];

/** 可选模式标识。 */
export type PresetId = "standard" | "ptc" | "minimal" | "creative";

/** 一个模式预设：名称、说明与它启用的会话插件。 */
export interface Preset {
  id: PresetId;
  name: Record<"zh" | "en", string>;
  description: Record<"zh" | "en", string>;
  /** 本模式启用的会话插件（必须来自全局清单）。 */
  sessionModules: readonly string[];
}

/** 全局清单：核心 + 可选，会话插件只能从这里挑。 */
export const GLOBAL_MODULES: readonly string[] = [...CORE_MODULES, ...OPTIONAL_MODULES];

/** 四个模式预设；顺序即界面展示顺序。 */
export const PRESETS: readonly Preset[] = [
  {
    id: "standard",
    name: { zh: "标准模式（默认）", en: "Standard (default)" },
    description: { zh: "通用对话所需的最小组合。", en: "The minimal set for general conversation." },
    sessionModules: [
      "@lfaa/agent", "@lfaa/tools", "@lfaa/llm", "@lfaa/rules",
      "@lfaa/memory", "@lfaa/skills", "@lfaa/browser", "@lfaa/jobs", "@lfaa/subagent",
    ],
  },
  {
    id: "ptc",
    name: { zh: "PTC 模式", en: "PTC" },
    description: { zh: "在标准模式上加入程序化工具调用与工作流。", en: "Standard plus programmatic tool calling and workflows." },
    sessionModules: ["@lfaa/agent", "@lfaa/tools", "@lfaa/llm", "@lfaa/rules", "@lfaa/memory", "@lfaa/skills"],
  },
  {
    id: "minimal",
    name: { zh: "极简模式", en: "Minimal" },
    description: { zh: "只保留模型与工具，适合快速问答。", en: "Only the model and tools, for quick questions." },
    sessionModules: ["@lfaa/llm", "@lfaa/tools"],
  },
  {
    id: "creative",
    name: { zh: "创造模式", en: "Creative" },
    description: { zh: "在标准模式上放开浏览器与后台任务。", en: "Standard plus the browser and background jobs." },
    sessionModules: [
      "@lfaa/agent", "@lfaa/tools", "@lfaa/llm", "@lfaa/rules",
      "@lfaa/memory", "@lfaa/skills", "@lfaa/browser", "@lfaa/jobs",
    ],
  },
];

/** 按 id 取预设；未知 id 回退到标准模式。 */
export function resolvePreset(id: string | undefined): Preset {
  return PRESETS.find((preset) => preset.id === id) ?? (PRESETS[0] as Preset);
}

/** 某个模块是否属于当前预设的会话插件。 */
export function isSessionModule(moduleName: string, preset: Preset): boolean {
  return preset.sessionModules.includes(moduleName);
}

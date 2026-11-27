// @lfaa/plugins 公开契约：定义插件清单、安装记录、运行状态与可安装目录条目，无 Node 或 DOM 依赖。

/** 插件运行生命周期状态。 */
export type PluginRunStatus = "disabled" | "enabling" | "running" | "disabling" | "error";

/** 插件清单描述（兼容版本、入口类型与声明的能力）。 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  entryType: "builtin-local" | "local-manifest";
  compatibleLfaa?: string;
  capabilities: {
    tools: string[];
    skills: string[];
    views: string[];
  };
}

/** 已安装插件的持久化记录与实时运行状态。 */
export interface PluginRecord {
  id: string;
  manifest: PluginManifest;
  /** Cordis Loader 使用的模块说明符（包名或 file: URL）。 */
  moduleName: string;
  /** 内置插件随应用发布，只能启停不可卸载；外部插件由用户安装。 */
  kind?: "builtin" | "external";
  source: "builtin-catalog" | "local";
  originPluginId?: string;
  enabled: boolean;
  status: PluginRunStatus;
  error?: string;
  installedAt: number;
  updatedAt: number;
}

/** 模式预设摘要：会话插件是该模式启用的模块子集。 */
export interface PresetSummary {
  id: string;
  name: string;
  description: string;
  modules: string[];
  nameEn: string;
  descriptionEn: string;
  unavailable?: boolean;
}

/** 双语文案：清单只需一次请求，界面按当前语言取用。 */
export interface LocalizedText {
  zh: string;
  en: string;
}

/** Loader 条目根 Fiber 的生命周期相位；null 表示没有存活的根 Fiber。 */
export type PluginFiberPhase = "pending" | "loading" | "active" | "failed" | "unloading" | null;

/** 插件清单里的一行：一条 Loader 条目，或一个由 bundle 静态装配的模块。 */
export interface PluginInventoryEntry {
  /** 稳定标识：Loader 条目用它自己的 id，静态装配模块用 `bundle:<短名>`。 */
  entryId: string;
  /** Loader 导入的模块说明符（包名或 file: URL）。 */
  moduleName: string;
  /** 显示元数据；包目录读不到 locale 时回落 package.json 并带 error。 */
  meta: {
    title: LocalizedText;
    description: LocalizedText;
    /** locale = 来自包内 locale/*.json；package = 回落到 package.json。 */
    source: "locale" | "package";
    error?: string;
  };
  /** 配置状态：Loader 的有效启用位（含被父组禁用）。 */
  enabled: boolean;
  /** 运行状态：根 Fiber 相位。 */
  fiberPhase: PluginFiberPhase;
  /** 启动失败时的诊断文本。 */
  diagnostic?: string;
  /** true 表示由 bundle 静态装配，P2 之前无法启停。 */
  provided: boolean;
  kind: "builtin" | "external";
  /** 清单展示顺序。 */
  order: number;
}

/** 只读插件清单快照：一次请求返回条目、模式预设与当前模式。 */
export interface PluginInventorySnapshot {
  profile: string;
  entries: PluginInventoryEntry[];
  presets: PresetSummary[];
  activePreset: string;
  /** 是否具备启停能力（静态装配阶段为 false）。 */
  managementAvailable: boolean;
}

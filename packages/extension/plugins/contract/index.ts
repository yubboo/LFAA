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

/** 可安装插件目录项。 */
export interface PluginCatalogItem {
  manifest: PluginManifest;
  installed: boolean;
  /** 安装时传给 Loader 的模块说明符。 */
  moduleName: string;
  /** 是否已由当前应用的 bundle 装配；此类能力不应再单独安装或启用。 */
  provided?: boolean;
  /** 内置插件只能启用/停用；外部插件可安装与卸载。 */
  kind?: "builtin" | "external";
}

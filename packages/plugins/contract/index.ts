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
  source: "builtin-catalog" | "local";
  originPluginId?: string;
  enabled: boolean;
  status: PluginRunStatus;
  error?: string;
  installedAt: number;
  updatedAt: number;
}

/** 可安装插件目录项。 */
export interface PluginCatalogItem {
  manifest: PluginManifest;
  installed: boolean;
}

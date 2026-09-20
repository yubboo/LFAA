/**
 * 模块：@lfaa/plugin-runtime
 * 作用：LFAA Plugin / Capability Registry 与插件 Profile 生命周期的运行时入口。
 * 负责：generation-based Registry、统一 Inspect/Install/Enable/Remove/Cancel Manager 契约。
 * 不负责：Tool 执行、权限决策、React UI、第三方代码直接加载、pnpm/文件系统具体实现。
 */
export { PluginRegistry, validatePluginManifest } from "./registry.ts";
export type { PluginRegistrySnapshot } from "./registry.ts";
export { InvalidPluginInstallSpecError, parsePluginInstallSpec } from "./install-spec.ts";
export type { ParsedPluginInstallSpec } from "./install-spec.ts";
export { PluginManager } from "./lifecycle.ts";
export type {
  InstalledPluginBundle,
  PluginInstallFailureKind,
  PluginInstallOutcome,
  PluginInstallProgress,
  PluginInstallSourceKind,
  PluginInspectProblem,
  PluginManagerSnapshot,
  PluginPackageHostPort,
  PluginSpecInspection,
} from "./lifecycle.ts";

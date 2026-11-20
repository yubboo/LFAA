// @lfaa/plugins Host 侧 Cordis 服务：管理插件安装、启停、卸载、二创与运行状态。
import { type Context, type Plugin, Service } from "@deepseek-ai/cordis";
import type { PluginCatalogItem, PluginManifest, PluginRecord, PresetSummary } from "../contract/index";
import { PluginManager, type PluginSkillRegistrar } from "./plugin-manager";

export * from "../contract/index";
export { createPluginsHttpHandler } from "./plugin-routes";

export interface PluginsPluginConfig {
  profile?: "web" | "desktop" | (string & {});
  profilesBaseDir?: string;
  storePath?: string;
  /** 当前应用 bundle 已装配的模块；这些能力不再允许单独安装或启用。 */
  providedModules?: readonly string[];
  /** 仓库根目录：二创复制包与依赖软链需要。 */
  repoRoot?: string;
  /** 模式预设（由 bundle 提供，避免插件包反向依赖 bundle）。 */
  presets?: ReadonlyArray<{
    id: string;
    name: Record<"zh" | "en", string>;
    description: Record<"zh" | "en", string>;
    sessionModules: readonly string[];
    unavailable?: boolean;
  }>;
}

/** Host 侧插件服务，挂载于 Cordis `plugins` 属性。 */
export class PluginsService extends Service {
  private readonly manager: PluginManager;

  constructor(ctx: Context, config: PluginsPluginConfig = {}) {
    super(ctx, "plugins");
    this.manager = new PluginManager(ctx, config);
  }

  protected stop(): void {
    void this.manager.disposeAll();
  }

  setSkillRegistrar(registrar: PluginSkillRegistrar | null): void {
    this.manager.setSkillRegistrar(registrar);
  }

  restoreEnabledPlugins(): Promise<void> {
    return this.manager.restoreEnabledPlugins();
  }

  listState(): Promise<{ profile: string; profileRoot: string; installed: PluginRecord[]; availableCatalog: PluginCatalogItem[]; presets: PresetSummary[]; activePreset: string }> {
    return this.manager.listState();
  }

  installPlugin(input: { moduleName?: string; catalogId?: string; manifest?: PluginManifest }): Promise<PluginRecord> {
    return this.manager.installPlugin(input);
  }

  /** 回填已装配模块（按模式挂载完成后调用）。 */
  setProvidedModules(modules: readonly string[]): void {
    this.manager.setProvided(modules);
  }

  /** 当前模式及其会话插件清单。 */
  getActivePreset(): Promise<{ id: string; modules: string[] }> {
    return this.manager.getActivePreset();
  }

  /** 解析新会话选择，校验后返回要持久化的能力组合。 */
  resolveSessionPreset(id?: string): Promise<{ sessionPreset: string; sessionModules: string[] }> {
    return this.manager.resolveSessionPreset(id);
  }

  /** 切换当前模式；返回新状态。 */
  setPreset(id: string): Promise<void> {
    return this.manager.setPreset(id);
  }

  /** 安装外部插件：npm 包名 / Git 地址 / 本地路径 / tarball。 */
  addExternal(spec: string, onLine?: (line: string) => void): Promise<PluginRecord> {
    return this.manager.addExternal(spec, onLine);
  }

  /** 内置插件一步启用（不存在安装语义）。 */
  enableBuiltin(moduleName: string): Promise<PluginRecord> {
    return this.manager.enableBuiltin(moduleName);
  }

  enablePlugin(id: string): Promise<PluginRecord> {
    return this.manager.enablePlugin(id);
  }

  disablePlugin(id: string): Promise<PluginRecord> {
    return this.manager.disablePlugin(id);
  }

  uninstallPlugin(id: string): Promise<boolean> {
    return this.manager.uninstallPlugin(id);
  }

  forkPlugin(id: string): Promise<PluginRecord> {
    return this.manager.forkPlugin(id);
  }

  updateManifest(id: string, patch: { name?: string; description?: string }): Promise<PluginRecord> {
    return this.manager.updateManifest(id, patch);
  }
}

/**
 * 插件服务入口。`inject` 必须声明在插件对象上：
 * Cordis 的服务可见性按 fiber 祖先链解析，Loader 与插件服务是兄弟 fiber，
 * 不声明注入时 `ctx.loader` 会抛「cannot get property without inject」。
 */
export const pluginsPlugin: Plugin.Object<PluginsPluginConfig> = {
  name: "@lfaa/plugins",
  inject: ["tools", "loader"],
  apply(context: Context, config: PluginsPluginConfig = {}) {
    new PluginsService(context, config);
  },
};

declare module "@deepseek-ai/cordis" {
  interface Context {
    plugins: PluginsService;
  }
}

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default pluginsPlugin;

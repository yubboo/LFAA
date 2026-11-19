// @lfaa/plugins Host 侧 Cordis 服务：管理插件安装、启停、卸载、二创与运行状态。
import { type Context, Service } from "@deepseek-ai/cordis";
import type { PluginCatalogItem, PluginManifest, PluginRecord } from "../contract/index";
import { PluginManager, type PluginSkillRegistrar } from "./plugin-manager";

export * from "../contract/index";
export { createPluginsHttpHandler } from "./plugin-routes";

export interface PluginsPluginConfig {
  profile?: "web" | "desktop" | (string & {});
  profilesBaseDir?: string;
  storePath?: string;
}

/** Host 侧插件服务，挂载于 Cordis `plugins` 属性。 */
export class PluginsService extends Service {
  static inject = ["tools"];

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

  listState(): Promise<{ profile: string; profileRoot: string; installed: PluginRecord[]; availableCatalog: PluginCatalogItem[] }> {
    return this.manager.listState();
  }

  installPlugin(input: { catalogId?: string; manifest?: PluginManifest }): Promise<PluginRecord> {
    return this.manager.installPlugin(input);
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

export function pluginsPlugin(context: Context, config: PluginsPluginConfig = {}): void {
  new PluginsService(context, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    plugins: PluginsService;
  }
}

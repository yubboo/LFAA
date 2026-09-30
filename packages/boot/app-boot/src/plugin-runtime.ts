/**
 * 功能：管理当前运行组合的 Cordis 插件生命周期。
 * 作用：读取全局启停配置，在当前进程热启停可选模块，并安全重建可重载模块的 Fiber。
 * 关联文件：index.ts、ai-host.ts、packages/api/settings-controller/src/index.ts、packages/client/ui-settings/src/SettingsPage.tsx。
 */
import type { Context } from "@deepseek-ai/cordis";
import { resolve } from "node:path";
import { JsonStorageBackend } from "lfaa-storage-json/src/index.js";
import { config } from "lfaa-launch-environment/src/config.js";

const FIBER_STATE = { PENDING: 0, LOADING: 1, ACTIVE: 2, FAILED: 3, DISPOSED: 4, UNLOADING: 5 } as const;
const PLUGIN_SETTINGS_VERSION = 1;

export interface PluginRuntimeDefinition {
  id: string;
  required: boolean;
  profileDisabled: boolean;
}

export interface PluginRuntimeSnapshot {
  id: string;
  name: string;
  enabled: boolean;
  disabled: boolean;
  required: boolean;
  profileDisabled: boolean;
  canToggle: boolean;
  canReload: boolean;
  state: string;
}

interface PersistedPluginSettings {
  version: 1;
  disabledPluginIds: string[];
}

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaPluginRuntime: PluginRuntimeManager }
}

export class PluginRuntimeError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "PluginRuntimeError";
  }
}

/** 管理员可改变可选模块的启停；必需模块与 Profile 固定停用项遵循装配合同。 */
export class PluginRuntimeManager {
  private readonly definitions = new Map<string, PluginRuntimeDefinition>();
  private readonly runtimeIds = new Map<string, string>();
  private busyPluginId: string | null = null;
  private readonly storage = new JsonStorageBackend(resolve(config.dataDirectory, "storages"));
  private disabledPluginIds: Set<string>;

  constructor(private readonly context: Context, definitions: readonly PluginRuntimeDefinition[]) {
    for (const definition of definitions) {
      if (!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(definition.id) || this.definitions.has(definition.id)) {
        throw new Error(`Cordis 插件 ID 重复或无效：${definition.id}`);
      }
      this.definitions.set(definition.id, definition);
    }
    this.disabledPluginIds = this.readSettings();
  }

  /** 读取 Profile 持久化覆盖；缺少配置时采用 Profile 默认启用状态。 */
  isDisabledAtStartup(pluginId: string): boolean {
    const definition = this.getDefinition(pluginId);
    return definition.profileDisabled || (!definition.required && this.disabledPluginIds.has(pluginId));
  }

  /** 将 Profile ID 关联到 Cordis Loader 生成的实际树节点 ID。 */
  registerEntry(pluginId: string, runtimeId: string): void {
    this.getDefinition(pluginId);
    if (this.runtimeIds.has(pluginId)) throw new Error(`Cordis 插件重复绑定：${pluginId}`);
    this.runtimeIds.set(pluginId, runtimeId);
  }

  list(): PluginRuntimeSnapshot[] {
    return [...this.definitions.values()].map((definition) => {
      const entry = this.resolveEntry(definition.id);
      const lifecycle = entry.fiber?.state;
      const state = lifecycle === FIBER_STATE.ACTIVE ? "ACTIVE"
        : lifecycle === FIBER_STATE.FAILED ? "FAILED"
          : lifecycle === FIBER_STATE.LOADING ? "LOADING"
            : lifecycle === FIBER_STATE.UNLOADING ? "UNLOADING"
              : lifecycle === FIBER_STATE.DISPOSED ? "DISPOSED" : "PENDING";
      return {
        id: definition.id,
        name: getPluginDisplayName(entry.options.name),
        enabled: !entry.disabled && lifecycle === FIBER_STATE.ACTIVE,
        disabled: entry.disabled,
        required: definition.required,
        profileDisabled: definition.profileDisabled,
        canToggle: !definition.required && !definition.profileDisabled,
        canReload: !definition.required && !definition.profileDisabled && !entry.disabled && lifecycle === FIBER_STATE.ACTIVE,
        state
      };
    });
  }

  async setEnabled(pluginId: string, enabled: boolean): Promise<void> {
    const definition = this.getDefinition(pluginId);
    if (definition.profileDisabled) throw new PluginRuntimeError("plugin_profile_disabled", "此模块由当前 Profile 固定停用。" );
    if (definition.required) throw new PluginRuntimeError("plugin_required", "此模块是运行组合必需能力，不能修改启用状态。" );

    await this.runExclusive(pluginId, async () => {
      const runtimeId = this.getRuntimeId(pluginId);
      const entry = this.context.loader.resolve(runtimeId);
      const previousDisabled = entry.disabled;
      if (!enabled && previousDisabled) return;
      if (enabled && !previousDisabled && entry.fiber?.state === FIBER_STATE.ACTIVE) return;
      try {
        // 已启用但 Fiber 失败/等待依赖时，先释放旧实例再重建一次，作为显式重试。
        if (enabled && !previousDisabled) {
          await this.context.loader.update(runtimeId, { disabled: true });
          await this.context.loader.await();
        }
        await this.context.loader.update(runtimeId, { disabled: !enabled });
        await this.context.loader.await();
        const current = this.context.loader.resolve(runtimeId);
        if (enabled && (!current.fiber || current.fiber.state !== FIBER_STATE.ACTIVE)) {
          throw new PluginRuntimeError("plugin_start_failed", "模块未进入运行状态；页面会刷新显示当前生命周期状态。" );
        }
        if (!enabled && !current.disabled) {
          throw new PluginRuntimeError("plugin_stop_failed", "模块仍处于启用状态；页面会刷新显示当前生命周期状态。" );
        }
        const nextDisabledIds = new Set(this.disabledPluginIds);
        if (enabled) nextDisabledIds.delete(pluginId);
        else nextDisabledIds.add(pluginId);
        this.storage.write("plugin-runtime", { version: PLUGIN_SETTINGS_VERSION, disabledPluginIds: [...nextDisabledIds].sort() } satisfies PersistedPluginSettings);
        this.disabledPluginIds = nextDisabledIds;
      } catch (error) {
        try {
          await this.context.loader.update(runtimeId, { disabled: previousDisabled });
          await this.context.loader.await();
        } catch { /* 回滚失败时保留 Cordis 的真实生命周期状态供管理员检查。 */ }
        if (error instanceof PluginRuntimeError) throw error;
        throw new PluginRuntimeError("plugin_runtime_action_failed", "模块启停失败；页面会刷新显示当前生命周期状态。" );
      }
    });
  }

  /** 重新创建可选模块实例；源码变更的真正模块热替换由 Cordis HMR watcher 负责。 */
  async reload(pluginId: string): Promise<void> {
    const definition = this.getDefinition(pluginId);
    if (definition.required || definition.profileDisabled) throw new PluginRuntimeError("plugin_reload_unavailable", "必需模块由开发环境的源码热重载管理；此处不支持手动中断。" );

    await this.runExclusive(pluginId, async () => {
      const runtimeId = this.getRuntimeId(pluginId);
      const entry = this.context.loader.resolve(runtimeId);
      if (entry.disabled || entry.fiber?.state !== FIBER_STATE.ACTIVE) {
        throw new PluginRuntimeError("plugin_reload_unavailable", "只有正在运行的可选模块可以重载。" );
      }
      try {
        await this.context.loader.update(runtimeId, { disabled: true });
        await this.context.loader.await();
        await this.context.loader.update(runtimeId, { disabled: false });
        await this.context.loader.await();
        const current = this.context.loader.resolve(runtimeId);
        if (current.disabled || current.fiber?.state !== FIBER_STATE.ACTIVE) {
          throw new PluginRuntimeError("plugin_reload_failed", "模块实例未进入运行状态；页面会刷新显示当前生命周期状态。" );
        }
      } catch (error) {
        const current = this.context.loader.resolve(runtimeId);
        if (current.disabled) {
          try {
            await this.context.loader.update(runtimeId, { disabled: false });
            await this.context.loader.await();
          } catch { /* 保留 Cordis 实际结果，并由列表显示当前状态。 */ }
        }
        if (error instanceof PluginRuntimeError) throw error;
        throw new PluginRuntimeError("plugin_reload_failed", "模块实例重建失败；页面会刷新显示当前生命周期状态。" );
      }
    });
  }

  private readSettings(): Set<string> {
    const saved = this.storage.read("plugin-runtime");
    if (saved === undefined) return new Set();
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) throw new Error("Cordis 插件运行配置损坏。" );
    const document = saved as Partial<PersistedPluginSettings>;
    if (document.version !== PLUGIN_SETTINGS_VERSION || !Array.isArray(document.disabledPluginIds)
      || document.disabledPluginIds.some((id) => typeof id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(id))) {
      throw new Error("Cordis 插件运行配置损坏或版本不支持。" );
    }
    return new Set(document.disabledPluginIds);
  }

  private getDefinition(pluginId: string): PluginRuntimeDefinition {
    const definition = this.definitions.get(pluginId);
    if (!definition) throw new PluginRuntimeError("plugin_not_found", "当前运行组合中没有此 Cordis 模块。" );
    return definition;
  }

  private getRuntimeId(pluginId: string): string {
    const runtimeId = this.runtimeIds.get(pluginId);
    if (!runtimeId) throw new PluginRuntimeError("plugin_not_ready", "Cordis 模块清单尚未就绪。" );
    return runtimeId;
  }

  private resolveEntry(pluginId: string) {
    return this.context.loader.resolve(this.getRuntimeId(pluginId));
  }

  private async runExclusive<T>(pluginId: string, action: () => Promise<T>): Promise<T> {
    if (this.busyPluginId) throw new PluginRuntimeError("plugin_action_in_progress", `模块“${this.busyPluginId}”正在执行生命周期操作，请稍后重试。`);
    this.busyPluginId = pluginId;
    try { return await action(); }
    finally { this.busyPluginId = null; }
  }
}

function getPluginDisplayName(entryName: string): string {
  const normalizedName = entryName.replaceAll("\\", "/");
  const packageMarker = normalizedName.lastIndexOf("/packages/");
  if (packageMarker >= 0) {
    const [domain, packageName] = normalizedName.slice(packageMarker + "/packages/".length).split("/");
    if (domain && packageName) return `${domain}/${packageName}`;
  }
  const moduleMarker = normalizedName.lastIndexOf("/node_modules/");
  if (moduleMarker >= 0) {
    const packageParts = normalizedName.slice(moduleMarker + "/node_modules/".length).split("/");
    if (packageParts[0]?.startsWith("@") && packageParts[1]) return `${packageParts[0]}/${packageParts[1]}`;
    if (packageParts[0]) return packageParts[0];
  }
  return normalizedName.startsWith("file:") || normalizedName.startsWith("/") || /^[a-z]:\//iu.test(normalizedName)
    ? "未命名宿主模块"
    : normalizedName;
}

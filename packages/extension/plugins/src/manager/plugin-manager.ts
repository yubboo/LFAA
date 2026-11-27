// @lfaa/plugins Host 侧插件生命周期管理器：基于 Cordis Loader 实现真实装载、卸载与 profile 持久化。
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import "@lfaa/tools";
import type { PluginInventorySnapshot, PluginManifest, PluginRecord, PluginRunStatus, PresetSummary } from "../../contract/index";
import { toRecordId } from "../catalog/record-id";
import type { PluginPresetDefinition } from "../catalog/preset-summary";
import { readPackageMeta } from "../catalog/package-meta";
import { buildInventory, type LoaderEntryLike } from "../inventory/plugin-inventory";
import { BuiltinStateStore } from "./builtin-state";
import { normalizeRecords } from "./record-hygiene";
import { PluginPresets } from "../catalog/plugin-presets";
import { PluginRecordStore } from "./plugin-records";
import { forkPluginPackage } from "./fork-plugin";
import { installExternalPlugin } from "./install-external";
import { ProfilePackages } from "./profile-packages";

/** 只读投影与启停共用的 Loader 条目：带稳定 id、模块名与 disabled 开关。 */
interface LoaderEntryHandle extends LoaderEntryLike {
  update(options: { disabled?: boolean | null }): Promise<void>;
}

/** Loader 的最小结构化契约：避免本包反向依赖内嵌 loader 的类型。 */
interface LoaderLike {
  create(options: { id: string; name: string }): Promise<unknown>;
  remove(id: string): void;
  await(): Promise<void>;
  store: Record<string, unknown>;
  /** 遍历条目树（含嵌套子树）。 */
  entries?(): Iterable<LoaderEntryHandle>;
}

export type PluginSkillRegistrar = (
  pluginId: string,
  skills: Array<{ id: string; name: string; description: string; content: string }>,
) => () => void;

function defaultProfilesBaseDir(): string {
  return join(homedir(), ".lfaa", "profiles");
}

/** Host 侧插件管理器，负责安装校验、串行状态切换与 Loader 条目管理。 */
export class PluginManager {
  private readonly ctx: Context;
  private readonly profile: string;
  private readonly profileRoot: string;
  private readonly storePath: string;
  private readonly errors = new Map<string, string>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private statuses = new Map<string, PluginRunStatus>();
  private skillRegistrar: PluginSkillRegistrar | null = null;

  private readonly provided: Set<string>;
  private readonly staticModules: readonly string[];
  private readonly repoRoot: string | null;
  private readonly loaderBaseUrl: string | null;
  private readonly presets: PluginPresets;
  private readonly packages: ProfilePackages;
  private readonly records: PluginRecordStore;
  private readonly builtinState: BuiltinStateStore;

  constructor(ctx: Context, options: {
    profile?: string;
    profilesBaseDir?: string;
    storePath?: string;
    providedModules?: readonly string[];
    /** 仍由 bundle 静态挂载的模块。 */
    staticModules?: readonly string[];
    presets?: readonly PluginPresetDefinition[];
    repoRoot?: string;
    /** Loader 解析基准文件：只读投影解析本仓包元数据用。 */
    loaderBaseUrl?: string;
  } = {}) {
    this.ctx = ctx;
    this.provided = new Set(options.providedModules ?? []);
    this.staticModules = [...(options.staticModules ?? [])];
    this.repoRoot = options.repoRoot ? resolve(options.repoRoot) : null;
    this.loaderBaseUrl = options.loaderBaseUrl ?? null;
    this.profile = options.profile?.trim() || "web";
    const baseDir = resolve(options.profilesBaseDir ?? defaultProfilesBaseDir());
    this.profileRoot = join(baseDir, this.profile);
    this.storePath = options.storePath ? resolve(options.storePath) : join(this.profileRoot, ".plugin-manager", "installed.json");
    this.packages = new ProfilePackages(this.profile, this.profileRoot, this.repoRoot);
    this.presets = new PluginPresets(this.profileRoot, options.presets ?? []);
    this.records = new PluginRecordStore(this.storePath, () => this.ensureProfileLayout(), (records) => this.packages.syncCordisYml(records));
    this.builtinState = new BuiltinStateStore(join(this.profileRoot, ".plugin-manager", "builtin-disabled.json"));
  }

  /** Host 侧的 Loader 服务；未装配时插件无法启停。 */
  private loader(): LoaderLike {
    const service = (this.ctx as unknown as { loader?: LoaderLike }).loader;
    if (!service) throw new Error("当前 Host 未装配 Cordis Loader，无法装载插件。");
    return service;
  }

  /** 按 DSH Profile 规范初始化 ~/.lfaa/profiles/<web|desktop>/ 目录骨架。 */
  async ensureProfileLayout(): Promise<void> {
    return this.packages.ensureLayout();
  }

  setSkillRegistrar(registrar: PluginSkillRegistrar | null): void {
    this.skillRegistrar = registrar;
  }

  private enqueue<T>(pluginId: string, task: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(pluginId) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(task);
    this.queues.set(pluginId, next);
    return next.finally(() => {
      if (this.queues.get(pluginId) === next) this.queues.delete(pluginId);
    });
  }

  private async readRecords(): Promise<PluginRecord[]> {
    // 包合并后旧 module 名需迁移；多个旧插件并入同一包时按 id 合并，启用状态取并集。
    const { records, changed } = normalizeRecords(await this.records.read());
    if (changed) await this.records.write(records);
    return records;
  }

  private async writeRecords(records: PluginRecord[]): Promise<void> {
    return this.records.write(records);
  }

  /** 以 Loader 实际条目为准判定运行状态，避免记录与运行时漂移。 */
  private hydrateRecord(record: PluginRecord): PluginRecord {
    const running = this.provided.has(record.moduleName) || this.loaderStatus(record.id);
    const error = this.errors.get(record.id);
    return {
      ...record,
      status: error ? "error" : running ? "running" : "disabled",
      ...(error ? { error } : {}),
    };
  }

  /** 只有拿到 fiber 才算真正装载成功；导入失败的条目会留在 store 里但没有 fiber。 */
  private loaderStatus(id: string): boolean {
    const service = (this.ctx as unknown as { loader?: LoaderLike }).loader;
    const entry = service?.store?.[id] as { fiber?: unknown } | undefined;
    return Boolean(entry?.fiber);
  }

  /** 条目是否存在于 Loader（含导入失败的条目），用于卸载时清理。 */
  private loaderHasEntry(id: string): boolean {
    const service = (this.ctx as unknown as { loader?: LoaderLike }).loader;
    return Boolean(service?.store?.[id]);
  }

  async restoreEnabledPlugins(): Promise<void> {
    await this.ensureProfileLayout();
    for (const record of await this.readRecords()) {
      if (!record.enabled) continue;
      await this.enablePlugin(record.id).catch(() => {});
    }
  }

  /** 读取当前模式；未设置或非法时回退到第一个预设。 */
  private async readPresetId(): Promise<string> {
    return this.presets.readActiveId();
  }

  /** 运行期回填当前宿主已装配的模块。 */
  setProvided(modules: readonly string[]): void {
    this.provided.clear();
    for (const moduleName of modules) this.provided.add(moduleName);
  }

  /** 读取新会话默认模式的标识及能力组合。 */
  async getActivePreset(): Promise<{ id: string; modules: string[] }> {
    return this.presets.getActive();
  }

  /** 全局默认仅用于新会话，已选择的组合由会话本身保存。 */
  async resolveSessionPreset(id?: string): Promise<{ sessionPreset: string; sessionModules: string[] }> {
    return this.presets.resolveSession(id);
  }

  /** 保存新会话默认模式；拒绝未知或不可用模式。 */
  async setPreset(id: string): Promise<void> {
    return this.presets.setActive(id);
  }

  async listState(): Promise<{    profile: string;
    profileRoot: string;
    installed: PluginRecord[];
    presets: PresetSummary[];
    activePreset: string;
  }> {
    await this.ensureProfileLayout();
    const records = await this.readRecords();
    const installed = records.map((record) => this.hydrateRecord(record));
    const activePreset = await this.presets.readActiveId();
    const presets = this.presets.summaries();
    return { profile: this.profile, profileRoot: this.profileRoot, installed, presets, activePreset };
  }

  /**
   * 只读清单：Loader 条目按根 Fiber 相位投影，静态装配模块按装配顺序补在前面。
   * 每次调用现读，避免出现第二份生命周期真相。
   */
  async readInventory(): Promise<PluginInventorySnapshot> {
    const loader = (this.ctx as unknown as { loader?: LoaderLike }).loader;
    const activePreset = await this.presets.readActiveId();
    return buildInventory({
      profile: this.profile,
      staticModules: this.staticModules,
      entries: loader?.entries ? loader.entries() : [],
      presets: this.presets.summaries(),
      activePreset,
      metaOf: (moduleName) => readPackageMeta(moduleName, {
        ...(this.loaderBaseUrl ? { baseUrl: this.loaderBaseUrl } : {}),
        profileRoot: this.profileRoot,
      }),
      managementAvailable: Boolean(loader),
    });
  }

  /** 找到某个模块对应的 Loader 条目；静态装配模块不在其中。 */
  private findLoaderEntry(moduleName: string): LoaderEntryHandle | null {
    const loader = this.loader();
    if (!loader.entries) return null;
    for (const entry of loader.entries()) {
      if (!entry.options.group && entry.options.name === moduleName) return entry;
    }
    return null;
  }

  /**
   * 启停一个内置插件：先写 profile 的停用清单，再让 Loader 立即装载或卸载。
   * 静态装配的模块没有 Loader 条目，只能提示不可启停。
   */
  async toggleBuiltin(moduleName: string, enabled: boolean): Promise<PluginInventorySnapshot> {
    if (!this.provided.has(moduleName)) throw new Error(`「${moduleName}」不是内置插件。`);
    const entry = this.findLoaderEntry(moduleName);
    if (!entry) throw new Error(`「${moduleName}」当前不是可启停的 Loader 条目。`);
    const disabled = await this.builtinState.read();
    if (enabled) disabled.delete(moduleName);
    else disabled.add(moduleName);
    await this.builtinState.write(disabled);
    await entry.update({ disabled: enabled ? null : true });
    await this.loader().await();
    return this.readInventory();
  }

  /** 启动时应用已保存的停用清单；只处理存在的 Loader 条目。 */
  async applyBuiltinDisabled(): Promise<void> {
    const disabled = await this.builtinState.read();
    if (disabled.size === 0) return;
    const loader = this.loader();
    for (const entry of loader.entries?.() ?? []) {
      if (!entry.options.group && disabled.has(entry.options.name)) await entry.update({ disabled: true });
    }
    await loader.await();
  }

  /** 安装：只登记，不装载；真正加载发生在启用时。 */
  async installPlugin(input: { moduleName?: string; manifest?: PluginManifest }): Promise<PluginRecord> {
    const moduleName = input.moduleName?.trim() ?? "";
    if (!moduleName) throw new Error("未指定要安装的插件包名。");
    if (this.provided.has(moduleName)) {
      throw new Error(`「${moduleName}」已由当前应用装配，无需单独安装。`);
    }

    const id = input.manifest?.id ?? toRecordId(moduleName);
    return this.enqueue(id, async () => {
      const records = await this.readRecords();
      const existing = records.find((record) => record.id === id);
      if (existing) return this.hydrateRecord(existing);

      // 描述来自包内 locale 元数据；读不到时回落到包名，安装流程不因缺元数据失败。
      const meta = readPackageMeta(moduleName, {
        ...(this.loaderBaseUrl ? { baseUrl: this.loaderBaseUrl } : {}),
        profileRoot: this.profileRoot,
      });
      const now = Date.now();
      const next: PluginRecord = {
        id,
        moduleName,
        manifest: input.manifest ?? {
          id,
          name: meta?.title.zh ?? moduleName,
          version: "0.1.0",
          description: meta?.description.zh || moduleName,
          entryType: "builtin-local",
          compatibleLfaa: ">=0.1.0",
          capabilities: { tools: [], skills: [], views: [] },
        },
        source: input.manifest ? "local" : "builtin-catalog",
        kind: moduleName.startsWith("@lfaa/") ? "builtin" as const : "external" as const,
        enabled: false,
        status: "disabled",
        installedAt: now,
        updatedAt: now,
      };
      await this.writeRecords([...records, next]);
      return this.hydrateRecord(next);
    });
  }

  /** 启用：把条目交给 Loader 真正装载。 */
  /**
   * 一步启用内置插件：内置包不存在「安装」概念，缺失记录时直接登记为已启用。
   * 已由 bundle 装配的内置项无需操作，直接返回其运行态。
   */
  async enableBuiltin(moduleName: string): Promise<PluginRecord> {
    const id = toRecordId(moduleName);
    const records = await this.readRecords();
    const existing = records.find((record) => record.id === id);
    if (!existing) {
      await this.installPlugin({ moduleName });
    }
    return this.enablePlugin(id);
  }

  async enablePlugin(id: string): Promise<PluginRecord> {
    return this.enqueue(id, async () => {
      const records = await this.readRecords();
      const target = records.find((record) => record.id === id);
      if (!target) throw new Error(`插件「${id}」尚未安装。`);

      if (this.provided.has(target.moduleName)) {
        throw new Error(`「${target.moduleName}」已由当前应用装配，不能重复启用。`);
      }
      this.statuses.set(id, "enabling");
      this.errors.delete(id);
      try {
        const loader = this.loader();
        if (!this.loaderHasEntry(id)) {
          await loader.create({ id, name: target.moduleName });
          await loader.await();
        }
        if (!this.loaderStatus(id)) {
          throw new Error(`插件「${id}」装载失败：模块 ${target.moduleName} 无法导入或未启动。`);
        }
        this.statuses.set(id, "running");
        const updated = records.map((record) =>
          record.id === id ? { ...record, enabled: true, status: "running" as const, updatedAt: Date.now() } : record,
        );
        await this.writeRecords(updated);
        return this.hydrateRecord(updated.find((record) => record.id === id)!);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.statuses.set(id, "error");
        this.errors.set(id, message);
        throw error;
      }
    });
  }

  /** 停用：从 Loader 移除条目并等待其资源释放。 */
  async disablePlugin(id: string): Promise<PluginRecord> {
    return this.enqueue(id, async () => {
      const records = await this.readRecords();
      const target = records.find((record) => record.id === id);
      if (!target) throw new Error(`插件「${id}」不存在。`);

      this.statuses.set(id, "disabling");
      const loader = this.loader();
      if (this.loaderHasEntry(id)) {
        loader.remove(id);
        await loader.await();
      }
      this.statuses.set(id, "disabled");
      this.errors.delete(id);
      const updated = records.map((record) =>
        record.id === id ? { ...record, enabled: false, status: "disabled" as const, updatedAt: Date.now() } : record,
      );
      await this.writeRecords(updated);
      return this.hydrateRecord(updated.find((record) => record.id === id)!);
    });
  }

  /** 安装外部插件：具体流程见 install-external.ts，这里只绑定记录存储与启用回调。 */
  async addExternal(input: string, onLine?: (line: string) => void): Promise<PluginRecord> {
    return installExternalPlugin({
      input,
      ...(onLine ? { onLine } : {}),
      packages: this.packages,
      readRecords: () => this.readRecords(),
      writeRecords: (records) => this.writeRecords(records),
      enablePlugin: (id) => this.enablePlugin(id),
    });
  }

  /** 卸载：先停用再从 profile 记录中删除。 */
  async uninstallPlugin(id: string): Promise<boolean> {
    return this.enqueue(id, async () => {
      const records = await this.readRecords();
      const target = records.find((record) => record.id === id);
      if (!target) return false;
      // 内置插件随应用发布，只能停用；彻底移除须删除仓库目录。
      if (target.kind === "builtin") {
        throw new Error(`「${target.manifest.name}」是内置插件，只能停用，不能卸载。`);
      }
      const loader = this.loader();
      if (this.loaderHasEntry(id)) {
        loader.remove(id);
        await loader.await();
      }
      this.statuses.delete(id);
      this.errors.delete(id);
      await this.writeRecords(records.filter((record) => record.id !== id));
      return true;
    });
  }

  /** 定位插件包目录：本仓包按清单名查找，本地插件按 file: URL 反查。 */
  private async locatePackage(moduleName: string): Promise<string> {
    return this.packages.locatePackage(moduleName);
  }

  /** 二创：把插件包复制到 profile/plugins/<新 id>，并建立依赖解析后登记为新记录。 */
  async forkPlugin(id: string): Promise<PluginRecord> {
    const records = await this.readRecords();
    const source = records.find((record) => record.id === id);
    if (!source) throw new Error(`找不到要二创的插件：${id}`);

    const forked = await forkPluginPackage({
      source,
      profileRoot: this.profileRoot,
      locatePackage: (moduleName) => this.locatePackage(moduleName),
      installProfileDependencies: (sourceDir) => this.packages.installProfileDependencies(sourceDir),
    });
    await this.writeRecords([...records, forked]);
    return this.hydrateRecord(forked);
  }

  /** 只改显示信息，不影响已装载的运行时条目。 */
  async updateManifest(id: string, patch: { name?: string; description?: string }): Promise<PluginRecord> {
    const records = await this.readRecords();
    const target = records.find((record) => record.id === id);
    if (!target) throw new Error(`找不到插件：${id}`);
    const updated = records.map((record) =>
      record.id === id
        ? {
            ...record,
            manifest: {
              ...record.manifest,
              ...(patch.name?.trim() ? { name: patch.name.trim() } : {}),
              ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
            },
            updatedAt: Date.now(),
          }
        : record,
    );
    await this.writeRecords(updated);
    return this.hydrateRecord(updated.find((record) => record.id === id)!);
  }

  async disposeAll(): Promise<void> {
    this.statuses.clear();
    this.errors.clear();
  }
}

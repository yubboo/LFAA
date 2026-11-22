// @lfaa/plugins Host 侧插件生命周期管理器：基于 Cordis Loader 实现真实装载、卸载与 profile 持久化。
import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Context } from "@deepseek-ai/cordis";
import "@lfaa/tools";
import type { PluginCatalogItem, PluginManifest, PluginRecord, PluginRunStatus, PresetSummary } from "../../contract/index";
import { parseInstallSpec as parseSpec } from "../catalog/install-spec";
import { buildCatalog, INSTALLABLE_PACKAGES, toRecordId, type PluginPresetDefinition } from "../catalog/plugin-catalog";
import { normalizeRecords } from "./record-hygiene";
import { PluginPresets } from "../catalog/plugin-presets";
import { PluginRecordStore } from "./plugin-records";
import { ProfilePackages } from "./profile-packages";

/** Loader 的最小结构化契约：避免本包反向依赖内嵌 loader 的类型。 */
interface LoaderLike {
  create(options: { id: string; name: string }): Promise<unknown>;
  remove(id: string): void;
  await(): Promise<void>;
  store: Record<string, unknown>;
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
  private readonly repoRoot: string | null;
  private readonly presets: PluginPresets;
  private readonly packages: ProfilePackages;
  private readonly records: PluginRecordStore;

  constructor(ctx: Context, options: {
    profile?: string;
    profilesBaseDir?: string;
    storePath?: string;
    providedModules?: readonly string[];
    presets?: readonly PluginPresetDefinition[];
    repoRoot?: string;
  } = {}) {
    this.ctx = ctx;
    this.provided = new Set(options.providedModules ?? []);
    this.repoRoot = options.repoRoot ? resolve(options.repoRoot) : null;
    this.profile = options.profile?.trim() || "web";
    const baseDir = resolve(options.profilesBaseDir ?? defaultProfilesBaseDir());
    this.profileRoot = join(baseDir, this.profile);
    this.storePath = options.storePath ? resolve(options.storePath) : join(this.profileRoot, ".plugin-manager", "installed.json");
    this.packages = new ProfilePackages(this.profile, this.profileRoot, this.repoRoot);
    this.presets = new PluginPresets(this.profileRoot, options.presets ?? []);
    this.records = new PluginRecordStore(this.storePath, () => this.ensureProfileLayout(), (records) => this.packages.syncCordisYml(records));
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
    availableCatalog: PluginCatalogItem[];
    presets: PresetSummary[];
    activePreset: string;
  }> {
    await this.ensureProfileLayout();
    const records = await this.readRecords();
    const installed = records.map((record) => this.hydrateRecord(record));
    const installedIds = new Set(records.map((record) => record.id));
    const availableCatalog = buildCatalog(this.provided, installedIds);
    const activePreset = await this.presets.readActiveId();
    const presets = this.presets.summaries();
    return { profile: this.profile, profileRoot: this.profileRoot, installed, availableCatalog, presets, activePreset };
  }

  /** 安装：只登记，不装载；真正加载发生在启用时。 */
  async installPlugin(input: { moduleName?: string; catalogId?: string; manifest?: PluginManifest }): Promise<PluginRecord> {
    const moduleName = input.moduleName
      ?? INSTALLABLE_PACKAGES.find((item) => item.moduleName === input.catalogId || toRecordId(item.moduleName) === input.catalogId)?.moduleName
      ?? "";
    if (!moduleName) throw new Error("未指定要安装的插件包名。");
    if (this.provided.has(moduleName)) {
      throw new Error(`「${moduleName}」已由当前应用装配，无需单独安装。`);
    }

    const id = input.manifest?.id ?? toRecordId(moduleName);
    return this.enqueue(id, async () => {
      const records = await this.readRecords();
      const existing = records.find((record) => record.id === id);
      if (existing) return this.hydrateRecord(existing);

      const catalogItem = INSTALLABLE_PACKAGES.find((item) => item.moduleName === moduleName);
      const now = Date.now();
      const next: PluginRecord = {
        id,
        moduleName,
        manifest: input.manifest ?? {
          id,
          name: catalogItem?.name ?? moduleName,
          version: "0.1.0",
          description: catalogItem?.description ?? "本地插件包。",
          entryType: "builtin-local",
          compatibleLfaa: ">=0.1.0",
          capabilities: { tools: [], skills: [], views: [] },
        },
        source: input.manifest ? "local" : "builtin-catalog",
        kind: INSTALLABLE_PACKAGES.some((item) => item.moduleName === moduleName) ? "builtin" as const : "external" as const,
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

  /** 卸载：先停用再从 profile 记录中删除。 */
  /** 执行一条 profile 内的 pnpm 命令并回传输出尾部，供安装/回滚共用。 */
  private async runPnpm(args: string[], onLine?: (line: string) => void): Promise<{ code: number; output: string }> {
    return this.packages.run(args, onLine);
  }

  /** 确保 profile 有一份可安装的 manifest 与 workspace 声明。 */
  private async ensureProfileManifest(): Promise<void> {
    return this.packages.ensureManifest();
  }

  /** 从 profile 依赖里找出刚落盘的包名：registry 用名字，其余按值匹配。 */
  private async resolveInstalledName(spec: string, fallbackName?: string): Promise<string> {
    return this.packages.resolveInstalledName(spec, fallbackName);
  }

  /** 读取已安装包在 profile 中的入口文件，返回 file: URL。 */
  private async resolvePackageEntry(name: string): Promise<string> {
    return this.packages.resolvePackageEntry(name);
  }
  /**
   * 安装外部插件：校验来源 → `pnpm add` → 识别包名 → 登记 → 自动启用。
   * 任一环节失败都回滚（pnpm remove + 删除记录），不留半装状态。
   */
  async addExternal(input: string, onLine?: (line: string) => void): Promise<PluginRecord> {
    const parsed = parseSpec(input);
    await this.ensureProfileManifest();
    const spec = parsed.spec;

    const install = await this.runPnpm(["add", spec], onLine);
    if (install.code !== 0) {
      throw new Error(`安装失败（退出码 ${install.code}）：${install.output.trim().slice(-400)}`);
    }

      const moduleName = await this.resolveInstalledName(spec, parsed.kind === "registry" ? parsed.name : undefined);
      // 外部包装在 profile 的 node_modules 里：记录绝对入口 URL，
      // 否则 Loader 会以应用目录为基准解析包名而找不到。
      const entryFile = await this.resolvePackageEntry(moduleName);
      const id = toRecordId(moduleName);

    try {
      const records = await this.readRecords();
      const existing = records.find((record) => record.id === id);
      const now = Date.now();
      const record: PluginRecord = existing ?? {
        id,
        moduleName: entryFile,
        manifest: {
          id,
          name: moduleName,
          version: "0.0.0",
          description: `外部插件：${parsed.spec}`,
          entryType: "local-manifest",
          capabilities: { tools: [], skills: [], views: [] },
        },
        source: "local",
        kind: "external",
        enabled: false,
        status: "disabled",
        installedAt: now,
        updatedAt: now,
      };
      if (!existing) await this.writeRecords([...records, record]);
      return await this.enablePlugin(id);
    } catch (error) {
      // 启用失败：卸载依赖并删除记录，避免半装。
      await this.runPnpm(["remove", moduleName]).catch(() => undefined);
      const left = await this.readRecords();
      await this.writeRecords(left.filter((record) => record.id !== id)).catch(() => undefined);
      throw error;
    }
  }

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

    const sourceDir = await this.locatePackage(source.moduleName);


    const newId = `${id}-copy-${randomUUID().slice(0, 4)}`;
    const targetDir = join(this.profileRoot, "plugins", newId);
    await mkdir(targetDir, { recursive: true });
    for (const part of ["lib", "src", "contract"]) {
      await cp(join(sourceDir, part), join(targetDir, part), { recursive: true, force: true }).catch(() => undefined);
    }
    // 副本必须换名：profile 把 plugins/* 当 workspace 成员，同名会造成包名冲突。
    try {
      const sourceManifest = JSON.parse(await readFile(join(sourceDir, "package.json"), "utf8")) as {
        name?: string;
        dependencies?: Record<string, string>;
      };
      const forkedName = `${sourceManifest.name ?? "plugin"}-fork-${newId.slice(-4)}`;
      // 副本只保留运行时字段：devDependencies/scripts 会把构建期依赖带进 profile 安装。
      const forkedManifest = {
        name: forkedName,
        version: "0.0.1",
        private: true,
        type: "module",
        main: "./lib/index.js",
        exports: { ".": { default: "./lib/index.js" } },
        dependencies: sourceManifest.dependencies ?? {},
      };
      await writeFile(join(targetDir, "package.json"), `${JSON.stringify(forkedManifest, null, 2)}\n`, "utf8");
    } catch {
      await cp(join(sourceDir, "package.json"), join(targetDir, "package.json")).catch(() => undefined);
    }

    // 依赖解析：写入 profile 级 manifest 并执行 pnpm install，
    // 让副本从 <profile>/node_modules 解析（不再依赖 Windows junction）。
    await this.packages.installProfileDependencies(sourceDir);
    const entryFile = join(targetDir, "lib", "index.js");

    // 依赖可达性探测：Windows 上 pnpm 的相对软链经 junction 后可能失效，
    // 与其留下一个启不动的副本，不如回滚并说明原因。
    try {
      await import(pathToFileURL(entryFile).href);
    } catch (error) {
      await rm(targetDir, { recursive: true, force: true }).catch(() => undefined);
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `二创副本已复制但依赖无法解析，已回滚：${detail}。`
        + "当前平台需要 profile 级依赖安装（pnpm install --dir <profile>）才能真正启用副本。",
      );
    }

    const now = Date.now();
    const forked: PluginRecord = {
      id: newId,
      moduleName: pathToFileURL(entryFile).href,
      manifest: {
        ...source.manifest,
        id: newId,
        name: `${source.manifest.name}（二创）`,
        description: `由 ${source.moduleName} 复制而来，可编辑 ${targetDir} 后启用。`,
      },
      source: "local",
      originPluginId: source.id,
      enabled: false,
      status: "disabled",
      installedAt: now,
      updatedAt: now,
    };
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

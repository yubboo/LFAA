// @lfaa/plugins Host 侧插件生命周期管理器：基于 Cordis Loader 实现真实装载、卸载与 profile 持久化。
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { cp, mkdir, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import type { Context } from "@deepseek-ai/cordis";
import "@lfaa/tools";
import type { PluginCatalogItem, PluginManifest, PluginRecord, PluginRunStatus } from "../contract/index";
import { parseInstallSpec as parseSpec } from "./install-spec";

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

interface StoredPluginsFile {
  records: PluginRecord[];
}

function defaultProfilesBaseDir(): string {
  return join(homedir(), ".lfaa", "profiles");
}

/** 可安装目录：本仓已具备默认导出的插件包，安装时直接按包名交给 Loader。 */
const INSTALLABLE_PACKAGES: ReadonlyArray<{ moduleName: string; name: string; description: string }> = [
  { moduleName: "@lfaa/tools", name: "工具注册表", description: "文件读写、检索与命令执行等内置工具。" },
  { moduleName: "@lfaa/tool-todo", name: "任务清单", description: "让 AI 创建和更新任务待办清单。" },
  { moduleName: "@lfaa/tool-web", name: "网页读取", description: "抓取公开网页并转成可读正文。" },
  { moduleName: "@lfaa/rules", name: "规则装配", description: "系统规则、项目规则与用户规则的提示词拼装。" },
  { moduleName: "@lfaa/llm", name: "模型接入", description: "多提供商大模型接入与流式推理。" },
  { moduleName: "@lfaa/memory", name: "记忆", description: "会话轨迹持久化与长期记忆检索。" },
  { moduleName: "@lfaa/subagent", name: "子智能体", description: "进程内子智能体与并发协作。" },
  { moduleName: "@lfaa/jobs", name: "后台任务", description: "会话隔离的后台命令与日志流。" },
  { moduleName: "@lfaa/browser", name: "内置浏览器", description: "本机 Edge/Chrome 驱动的浏览器工具。" },
  { moduleName: "@lfaa/agent", name: "Agent 循环", description: "Think → Act → Check 任务闭环。" },
  { moduleName: "@lfaa/shell", name: "Shell 运行时", description: "进程执行、取消与输出收集。" },
  { moduleName: "@lfaa/skills", name: "技能中心", description: "按需加载技能与 Git 安装。" },
  { moduleName: "@lfaa/plugins", name: "插件管理", description: "插件安装、启停与二创。" },
  { moduleName: "@lfaa/workspace", name: "工作区", description: "本地项目增删改与路径绑定。" },
  { moduleName: "@lfaa/sections", name: "自定义分区", description: "侧栏分区持久化与编辑。" },
  { moduleName: "@lfaa/chat", name: "聊天工作台", description: "会话、流式输出与工作台界面。" },
];

/** 把包名或路径规整成稳定的记录 id。 */
function toRecordId(moduleName: string): string {
  return moduleName
    .replace(/^@lfaa\//u, "")
    .replace(/[^a-z0-9-]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
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
  private readonly presets: ReadonlyArray<{ id: string; name: Record<"zh" | "en", string>; description: Record<"zh" | "en", string>; sessionModules: readonly string[] }>;

  constructor(ctx: Context, options: {
    profile?: string;
    profilesBaseDir?: string;
    storePath?: string;
    providedModules?: readonly string[];
    presets?: ReadonlyArray<{ id: string; name: Record<"zh" | "en", string>; description: Record<"zh" | "en", string>; sessionModules: readonly string[] }>;
    repoRoot?: string;
  } = {}) {
    this.ctx = ctx;
    this.provided = new Set(options.providedModules ?? []);
    this.repoRoot = options.repoRoot ? resolve(options.repoRoot) : null;
    this.presets = options.presets ?? [];
    this.profile = options.profile?.trim() || "web";
    const baseDir = resolve(options.profilesBaseDir ?? defaultProfilesBaseDir());
    this.profileRoot = join(baseDir, this.profile);
    this.storePath = options.storePath ? resolve(options.storePath) : join(this.profileRoot, ".plugin-manager", "installed.json");
  }

  /** Host 侧的 Loader 服务；未装配时插件无法启停。 */
  private loader(): LoaderLike {
    const service = (this.ctx as unknown as { loader?: LoaderLike }).loader;
    if (!service) throw new Error("当前 Host 未装配 Cordis Loader，无法装载插件。");
    return service;
  }

  /** 按 DSH Profile 规范初始化 ~/.lfaa/profiles/<web|desktop>/ 目录骨架。 */
  async ensureProfileLayout(): Promise<void> {
    await mkdir(join(this.profileRoot, ".plugin-manager"), { recursive: true });
    await mkdir(join(this.profileRoot, "node_modules"), { recursive: true });

    const ensureFile = async (fileName: string, content: string) => {
      const target = join(this.profileRoot, fileName);
      if (!existsSync(target)) await writeFile(target, content, "utf8");
    };

    await ensureFile(
      "package.json",
      JSON.stringify({ name: `@lfaa/profile-${this.profile}`, private: true, type: "module", dependencies: {} }, null, 2),
    );
    await ensureFile("pnpm-workspace.yaml", "packages:\n  - \"plugins/*\"\n");
    await ensureFile("cordis.yml", "plugins: {}\n");
    await ensureFile("cordis.patch.yml", "# 用户本地插件配置补丁\n");
    await ensureFile("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  }

  /** 把已启用记录同步进 cordis.yml，作为 profile 的可读快照。 */
  private async syncCordisYml(records: PluginRecord[]): Promise<void> {
    const lines = ["plugins:"];
    const enabled = records.filter((r) => r.enabled);
    if (enabled.length === 0) {
      lines.push("  {}");
    } else {
      for (const rec of enabled) {
        lines.push(`  ${rec.id}:`);
        lines.push(`    name: "${rec.moduleName}"`);
        lines.push(`    version: "${rec.manifest.version}"`);
      }
    }
    const target = join(this.profileRoot, "cordis.yml");
    await mkdir(this.profileRoot, { recursive: true });
    const tmp = `${target}.${randomUUID()}.tmp`;
    await writeFile(tmp, `${lines.join("\n")}\n`, "utf8");
    await rename(tmp, target);
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
    if (!existsSync(this.storePath)) return [];
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoredPluginsFile>;
      return Array.isArray(parsed.records) ? parsed.records : [];
    } catch {
      return [];
    }
  }

  private async writeRecords(records: PluginRecord[]): Promise<void> {
    await this.ensureProfileLayout();
    await mkdir(dirname(this.storePath), { recursive: true });
    const tmp = `${this.storePath}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify({ records }, null, 2), "utf8");
    await rename(tmp, this.storePath);
    await this.syncCordisYml(records);
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

  /** 预设状态文件：记录当前模式，供下次启动沿用。 */
  private presetPath(): string {
    return join(this.profileRoot, ".plugin-manager", "preset.json");
  }

  /** 读取当前模式；未设置或非法时回退到第一个预设。 */
  private async readPresetId(): Promise<string> {
    const fallback = this.presets[0]?.id ?? "standard";
    try {
      const raw = JSON.parse(await readFile(this.presetPath(), "utf8")) as { id?: string };
      return this.presets.some((preset) => preset.id === raw.id) ? (raw.id as string) : fallback;
    } catch {
      return fallback;
    }
  }

  /** 运行期回填"已装配"集合：bundle 按模式挂载完可选模块后调用。 */
  setProvided(modules: readonly string[]): void {
    this.provided.clear();
    for (const moduleName of modules) this.provided.add(moduleName);
  }

  /** 读取当前模式的 id 与其会话插件清单，供 bundle 决定装配范围。 */
  async getActivePreset(): Promise<{ id: string; modules: string[] }> {
    const id = await this.readPresetId();
    const preset = this.presets.find((item) => item.id === id);
    return { id, modules: preset ? [...preset.sessionModules] : [] };
  }

  /** 切换模式并持久化；未知模式直接拒绝。 */
  async setPreset(id: string): Promise<void> {
    if (!this.presets.some((preset) => preset.id === id)) {
      throw new Error(`未知模式：${id}`);
    }
    await mkdir(dirname(this.presetPath()), { recursive: true });
    await writeFile(this.presetPath(), `${JSON.stringify({ id }, null, 2)}\n`, "utf8");
  }

  async listState(): Promise<{    profile: string;
    profileRoot: string;
    installed: PluginRecord[];
    availableCatalog: PluginCatalogItem[];
    presets: Array<{ id: string; name: string; description: string; modules: string[] }>;
    activePreset: string;
  }> {
    await this.ensureProfileLayout();
    const records = await this.readRecords();
    const installed = records.map((record) => this.hydrateRecord(record));
    const installedIds = new Set(records.map((record) => record.id));
    const availableCatalog: PluginCatalogItem[] = INSTALLABLE_PACKAGES.map((item) => ({
      moduleName: item.moduleName,
      // 内置插件来自本仓 packages（bundle 清单）：只能启停，不存在安装/卸载。
      kind: "builtin" as const,
      provided: this.provided.has(item.moduleName),
      manifest: {
        id: toRecordId(item.moduleName),
        name: item.name,
        version: "0.1.0",
        description: item.description,
        entryType: "builtin-local",
        compatibleLfaa: ">=0.1.0",
        capabilities: { tools: [], skills: [], views: [] },
      },
      installed: installedIds.has(toRecordId(item.moduleName)),
    }));
    const activePreset = await this.readPresetId();
    const presets = this.presets.map((preset) => ({
      id: preset.id,
      name: preset.name.zh,
      description: preset.description.zh,
      modules: [...preset.sessionModules],
    }));
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
    // `--no-frozen-lockfile` 只对 install 有效；add/remove 会报未知选项。
    const lockFlag = args[0] === "install" ? ["--no-frozen-lockfile"] : [];
    // append-only 让 pnpm 输出退化为逐行日志，SSE 才能实时看到进展。
    const full = [...args, "--dir", this.profileRoot, "--prefer-offline", "--reporter=append-only", ...lockFlag];
    const shellArgs = full.map((arg) => (arg.includes(" ") ? `"${arg}"` : arg)).join(" ");
    const child = process.platform === "win32"
      ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `pnpm ${shellArgs}`], { cwd: this.profileRoot, stdio: ["ignore", "pipe", "pipe"] })
      : spawn("pnpm", full, { cwd: this.profileRoot, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    const code = await new Promise<number>((done) => child.on("close", (value) => done(value ?? 1)));
    return { code, output };
  }

  /** 确保 profile 有一份可安装的 manifest 与 workspace 声明。 */
  private async ensureProfileManifest(): Promise<void> {
    await this.ensureProfileLayout();
    const manifestPath = join(this.profileRoot, "package.json");
    if (!existsSync(manifestPath)) {
      await writeFile(manifestPath, `${JSON.stringify({ name: `@lfaa/profile-${this.profile}`, private: true, type: "module", dependencies: {} }, null, 2)}\n`, "utf8");
    }
    const workspacePath = join(this.profileRoot, "pnpm-workspace.yaml");
    if (!existsSync(workspacePath)) {
      await writeFile(workspacePath, "packages:\n  - \"plugins/*\"\n", "utf8");
    }
  }

  /** 从 profile 依赖里找出刚落盘的包名：registry 用名字，其余按值匹配。 */
  private async resolveInstalledName(spec: string, fallbackName?: string): Promise<string> {
    const raw = await readFile(join(this.profileRoot, "package.json"), "utf8");
    const manifest = JSON.parse(raw) as { dependencies?: Record<string, string> };
    const entries = Object.entries(manifest.dependencies ?? {});
    if (fallbackName) {
      const byName = entries.find(([name]) => name === fallbackName);
      if (byName) return byName[0];
    }
    const normalized = spec.replace(/^(?:file|link):/u, "").split("\\").join("/").toLowerCase();
    const hit = entries.find(([, value]) => {
      const recorded = value.replace(/^(?:file|link):/u, "").split("\\").join("/").toLowerCase();
      return recorded.includes(normalized) || normalized.includes(recorded) || value === spec;
    });
    if (!hit) throw new Error("安装完成但未能从 profile 依赖中识别出包名。");
    return hit[0];
  }

  /** 读取已安装包在 profile 中的入口文件，返回 file: URL。 */
  private async resolvePackageEntry(name: string): Promise<string> {
    const dir = join(this.profileRoot, "node_modules", name);
    const manifest = JSON.parse(await readFile(join(dir, "package.json"), "utf8")) as {
      main?: string;
      module?: string;
      exports?: Record<string, unknown> | string;
    };
    let entry = manifest.main ?? manifest.module ?? "index.js";
    const root = manifest.exports;
    if (root && typeof root === "object") {
      const dot = (root as Record<string, unknown>)["."];
      if (typeof dot === "string") entry = dot;
      else if (dot && typeof dot === "object") {
        const cond = dot as Record<string, unknown>;
        const candidate = cond.default ?? cond.import ?? cond.require;
        if (typeof candidate === "string") entry = candidate;
      }
    }
    return pathToFileURL(join(dir, entry)).href;
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

  /** 枚举仓库内的全部包：名称 → 绝对目录。 */
  private async repoPackages(): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    if (!this.repoRoot) return found;
    const walk = async (dir: string, depth: number): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === "node_modules") continue;
        const child = join(dir, entry.name);
        try {
          const manifest = JSON.parse(await readFile(join(child, "package.json"), "utf8")) as { name?: string };
          if (manifest.name) found.set(manifest.name, child);
        } catch {
          if (depth > 0) await walk(child, depth - 1);
        }
      }
    };
    await walk(join(this.repoRoot, "packages"), 1);
    await walk(join(this.repoRoot, "vendor"), 0);
    return found;
  }

  /**
   * profile 级依赖安装：把仓库包以 link: 写进 profile manifest，
   * 并带上副本包的第三方依赖，然后执行 pnpm install。
   * 这样副本的 lib/index.js 从 <profile>/node_modules 解析，不再依赖 junction。
   */
  private async installProfileDependencies(sourceDir: string): Promise<void> {
    const packages = await this.repoPackages();
    if (packages.size === 0) throw new Error("未找到仓库包，无法建立 profile 依赖解析。");

    const dependencies: Record<string, string> = {};
    for (const [name, dir] of packages) {
      dependencies[name] = `link:${relative(this.profileRoot, dir).split(sep).join("/")}`;
    }

    // 副本包的第三方依赖（非 @lfaa/*）交给 pnpm 安装。
    try {
      const sourceManifest = JSON.parse(await readFile(join(sourceDir, "package.json"), "utf8")) as {
        dependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
      };
      for (const [name, spec] of Object.entries({ ...(sourceManifest.dependencies ?? {}), ...(sourceManifest.peerDependencies ?? {}) })) {
        if (name.startsWith("@lfaa/") || name in dependencies) continue;
        if (spec.startsWith("workspace:")) continue;
        // 优先复用源包已经解析好的依赖目录（link:），避免 profile 安装时再联网。
        const resolved = await realpath(join(sourceDir, "node_modules", name)).catch(() => null);
        dependencies[name] = resolved ? `link:${resolved.split(sep).join("/")}` : spec;
      }
    } catch {
      // 读取失败时只保留仓库包链接。
    }

    const manifest = {
      name: `@lfaa/profile-${this.profile}`,
      private: true,
      type: "module",
      dependencies,
    };
    await mkdir(this.profileRoot, { recursive: true });
    await writeFile(join(this.profileRoot, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const args = ["install", "--dir", this.profileRoot, "--prefer-offline", "--no-frozen-lockfile"];
    // Node 20+ 禁止无 shell 直接 spawn .cmd；Windows 上经 cmd.exe 转发，POSIX 直接执行。
    const install = process.platform === "win32"
      ? spawn(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/s", "/c", `pnpm ${args.map((arg) => (arg.includes(" ") ? `"${arg}"` : arg)).join(" ")}`],
        { cwd: this.profileRoot, stdio: ["ignore", "pipe", "pipe"] },
      )
      : spawn("pnpm", args, { cwd: this.profileRoot, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    install.stdout.on("data", (chunk) => { output += String(chunk); });
    install.stderr.on("data", (chunk) => { output += String(chunk); });
    const code = await new Promise<number>((done) => install.on("close", (value) => done(value ?? 1)));
    if (code !== 0) {
      throw new Error(`profile 依赖安装失败（退出码 ${code}）：${output.trim().slice(-300)}`);
    }
  }

  /** 定位插件包目录：本仓包按清单名查找，本地插件按 file: URL 反查。 */
  private async locatePackage(moduleName: string): Promise<string> {
    if (moduleName.startsWith("file:")) return dirname(dirname(new URL(moduleName).pathname.replace(/^\//u, "")));
    if (!this.repoRoot) throw new Error("未配置仓库根目录，无法定位插件包。");
    const want = moduleName;
    const search = async (dir: string, depth: number): Promise<string | null> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return null;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === "node_modules") continue;
        const child = join(dir, entry.name);
        try {
          const manifest = JSON.parse(await readFile(join(child, "package.json"), "utf8")) as { name?: string };
          if (manifest.name === want) return child;
        } catch {
          if (depth > 0) {
            const hit = await search(child, depth - 1);
            if (hit) return hit;
          }
        }
      }
      return null;
    };
    const found = await search(join(this.repoRoot, "packages"), 1) ?? await search(join(this.repoRoot, "vendor"), 0);
    if (!found) throw new Error(`找不到插件包目录：${moduleName}`);
    return found;
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
    await this.installProfileDependencies(sourceDir);
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

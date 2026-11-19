// @lfaa/plugins Host 侧插件生命周期管理器：维护真实安装记录、Cordis 子实例启停、工具与技能贡献及二创。
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import "@lfaa/tools";
import type { PluginCatalogItem, PluginManifest, PluginRecord, PluginRunStatus } from "../contract/index";

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

// 首个真实本地插件：文本计数（贡献计数工具、使用说明技能与详情页）。
const TEXT_COUNTER_MANIFEST: PluginManifest = {
  id: "text-counter",
  name: "文本计数",
  version: "1.0.0",
  description: "统计文本字符数、词数、行数与中文字数，提供计数工具与使用说明技能。",
  entryType: "builtin-local",
  compatibleLfaa: ">=0.1.0",
  capabilities: {
    tools: ["count_text_stats"],
    skills: ["text-counter-guide"],
    views: ["ext:text-counter"],
  },
};

const BUILTIN_CATALOG: readonly PluginManifest[] = [TEXT_COUNTER_MANIFEST];

function countTextStats(text: string) {
  const chars = text.length;
  const nonSpaceChars = text.replace(/\s+/gu, "").length;
  const lines = text.length === 0 ? 0 : text.replace(/\r\n/gu, "\n").split("\n").length;
  const cjkChars = (text.match(/[\u4e00-\u9fff]/gu) ?? []).length;
  const words = text.trim() ? text.trim().split(/\s+/gu).length : 0;
  return { chars, nonSpaceChars, words, lines, cjkChars };
}

/** Host 侧插件管理器，负责安装校验、串行状态切换与 Cordis 子实例隔离装卸。 */
export class PluginManager {
  private readonly ctx: Context;
  private readonly profile: string;
  private readonly profileRoot: string;
  private readonly storePath: string;
  private readonly fibers = new Map<string, ReturnType<Context["plugin"]>>();
  private readonly statuses = new Map<string, PluginRunStatus>();
  private readonly errors = new Map<string, string>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private skillRegistrar: PluginSkillRegistrar | null = null;

  constructor(ctx: Context, options: { profile?: string; profilesBaseDir?: string; storePath?: string } = {}) {
    this.ctx = ctx;
    this.profile = options.profile?.trim() || "web";
    const baseDir = resolve(options.profilesBaseDir ?? defaultProfilesBaseDir());
    this.profileRoot = join(baseDir, this.profile);
    this.storePath = options.storePath ? resolve(options.storePath) : join(this.profileRoot, ".plugin-manager", "installed.json");
  }

  /** 按 DSH Profile 规范初始化 ~/.lfaa/profiles/<web|desktop>/ 目录骨架。 */
  async ensureProfileLayout(): Promise<void> {
    await mkdir(join(this.profileRoot, ".plugin-manager"), { recursive: true });
    await mkdir(join(this.profileRoot, "node_modules"), { recursive: true });

    const ensureFile = async (fileName: string, content: string) => {
      const target = join(this.profileRoot, fileName);
      if (!existsSync(target)) {
        await writeFile(target, content, "utf8");
      }
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

  private async syncCordisYml(records: PluginRecord[]): Promise<void> {
    const lines = ["plugins:"];
    const enabled = records.filter((r) => r.enabled);
    if (enabled.length === 0) {
      lines.push("  {}");
    } else {
      for (const rec of enabled) {
        lines.push(`  ${rec.id}:`);
        lines.push(`    version: "${rec.manifest.version}"`);
        lines.push(`    source: "${rec.source}"`);
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
      if (this.queues.get(pluginId) === next) {
        this.queues.delete(pluginId);
      }
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

  private hydrateRecord(record: PluginRecord): PluginRecord {
    const status = this.statuses.get(record.id) ?? (record.enabled ? "disabled" : "disabled");
    const err = this.errors.get(record.id);
    return {
      ...record,
      status,
      ...(err ? { error: err } : {}),
    };
  }

  async restoreEnabledPlugins(): Promise<void> {
    await this.ensureProfileLayout();
    const records = await this.readRecords();
    for (const rec of records) {
      if (rec.enabled) {
        await this.enablePlugin(rec.id).catch(() => {});
      }
    }
  }

  async listState(): Promise<{ profile: string; profileRoot: string; installed: PluginRecord[]; availableCatalog: PluginCatalogItem[] }> {
    await this.ensureProfileLayout();
    const records = await this.readRecords();
    const installed = records.map((r) => this.hydrateRecord(r));
    const installedIds = new Set(installed.map((r) => r.id));
    const availableCatalog: PluginCatalogItem[] = BUILTIN_CATALOG.map((manifest) => ({
      manifest,
      installed: installedIds.has(manifest.id),
    }));
    return { profile: this.profile, profileRoot: this.profileRoot, installed, availableCatalog };
  }

  async installPlugin(input: { catalogId?: string; manifest?: PluginManifest }): Promise<PluginRecord> {
    const manifest = input.manifest
      ?? BUILTIN_CATALOG.find((item) => item.id === input.catalogId);
    if (!manifest) {
      throw new Error("未找到要安装的插件清单。");
    }
    return this.enqueue(manifest.id, async () => {
      const records = await this.readRecords();
      const existing = records.find((r) => r.id === manifest.id);
      if (existing) {
        return this.hydrateRecord(existing);
      }
      const now = Date.now();
      const next: PluginRecord = {
        id: manifest.id,
        manifest,
        source: input.manifest ? "local" : "builtin-catalog",
        enabled: false,
        status: "disabled",
        installedAt: now,
        updatedAt: now,
      };
      await this.writeRecords([...records, next]);
      this.statuses.set(next.id, "disabled");
      return next;
    });
  }

  private mountPluginInstance(record: PluginRecord): ReturnType<Context["plugin"]> {
    const pluginId = record.id;
    const isTextCounter = pluginId === "text-counter" || record.originPluginId === "text-counter";
    const toolName = record.manifest.capabilities.tools[0] || `count_text_${pluginId.replace(/[^a-z0-9_]/giu, "_")}`;
    const skillId = record.manifest.capabilities.skills[0] || `${pluginId}-guide`;

    const fiber = this.ctx.plugin({
      inject: ["tools"],
      apply: (childCtx) => {
        const cleanups: Array<() => void> = [];
        if (isTextCounter) {
          cleanups.push(
            childCtx.tools.registerTool({
              name: toolName,
              title: `${record.manifest.name} · 文本统计`,
              description: "统计输入文本的字符数、非空字符数、词数、行数与中文字数。",
              permissionLevel: "read",
              parameters: {
                type: "object",
                properties: {
                  text: { type: "string", description: "要统计的文本内容" },
                },
                required: ["text"],
              },
              execute: async (args) => {
                const rawText = typeof args.text === "string" ? args.text : "";
                const stats = countTextStats(rawText);
                return {
                  ok: true,
                  output: JSON.stringify(stats, null, 2),
                  summary: `字符 ${stats.chars} / 词 ${stats.words} / 行 ${stats.lines} / 中文 ${stats.cjkChars}`,
                };
              },
            }),
          );
        }
        if (this.skillRegistrar) {
          cleanups.push(
            this.skillRegistrar(pluginId, [
              {
                id: skillId,
                name: `${record.manifest.name}指南`,
                description: record.manifest.description,
                content: `---\nname: ${record.manifest.name}指南\ndescription: ${record.manifest.description}\n---\n\n# ${record.manifest.name}\n\n当用户需要统计文本字数、行数或中文字数时，优先调用插件工具 \`${toolName}\` 返回精确统计结果。`,
              },
            ]),
          );
        }
        childCtx.effect(() => () => {
          for (const fn of cleanups.splice(0)) fn();
        });
      },
    });
    return fiber;
  }

  async enablePlugin(id: string): Promise<PluginRecord> {
    return this.enqueue(id, async () => {
      const records = await this.readRecords();
      const target = records.find((r) => r.id === id);
      if (!target) {
        throw new Error(`插件「${id}」尚未安装。`);
      }
      if (this.fibers.has(id)) {
        this.statuses.set(id, "running");
        return this.hydrateRecord({ ...target, enabled: true });
      }
      this.statuses.set(id, "enabling");
      this.errors.delete(id);
      try {
        const fiber = this.mountPluginInstance(target);
        await fiber;
        this.fibers.set(id, fiber);
        this.statuses.set(id, "running");
        const updated = records.map((r) =>
          r.id === id ? { ...r, enabled: true, status: "running" as const, updatedAt: Date.now() } : r,
        );
        await this.writeRecords(updated);
        return this.hydrateRecord(updated.find((r) => r.id === id)!);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.statuses.set(id, "error");
        this.errors.set(id, message);
        throw err;
      }
    });
  }

  async disablePlugin(id: string): Promise<PluginRecord> {
    return this.enqueue(id, async () => {
      const records = await this.readRecords();
      const target = records.find((r) => r.id === id);
      if (!target) {
        throw new Error(`插件「${id}」不存在。`);
      }
      this.statuses.set(id, "disabling");
      const fiber = this.fibers.get(id);
      this.fibers.delete(id);
      if (fiber) {
        await fiber.dispose().catch(() => {});
      }
      this.statuses.set(id, "disabled");
      this.errors.delete(id);
      const updated = records.map((r) =>
        r.id === id ? { ...r, enabled: false, status: "disabled" as const, updatedAt: Date.now() } : r,
      );
      await this.writeRecords(updated);
      return this.hydrateRecord(updated.find((r) => r.id === id)!);
    });
  }

  async uninstallPlugin(id: string): Promise<boolean> {
    return this.enqueue(id, async () => {
      const records = await this.readRecords();
      if (!records.some((r) => r.id === id)) return false;
      this.statuses.set(id, "disabling");
      const fiber = this.fibers.get(id);
      this.fibers.delete(id);
      if (fiber) {
        await fiber.dispose().catch(() => {});
      }
      this.statuses.delete(id);
      this.errors.delete(id);
      await this.writeRecords(records.filter((r) => r.id !== id));
      return true;
    });
  }

  async forkPlugin(id: string): Promise<PluginRecord> {
    const records = await this.readRecords();
    const source = records.find((r) => r.id === id);
    if (!source) {
      throw new Error(`找不到要二创的插件：${id}`);
    }
    const newId = `${source.id}-copy-${randomUUID().slice(0, 4)}`;
    const now = Date.now();
    const nextManifest: PluginManifest = {
      ...source.manifest,
      id: newId,
      name: `${source.manifest.name}（二创）`,
      entryType: "local-manifest",
      capabilities: {
        tools: source.manifest.capabilities.tools.map((t) => `${t}_${newId.slice(-4)}`),
        skills: source.manifest.capabilities.skills.map((s) => `${s}_${newId.slice(-4)}`),
        views: [`ext:${newId}`],
      },
    };
    const forked: PluginRecord = {
      id: newId,
      manifest: nextManifest,
      source: "local",
      originPluginId: source.id,
      enabled: false,
      status: "disabled",
      installedAt: now,
      updatedAt: now,
    };
    await this.writeRecords([...records, forked]);
    this.statuses.set(newId, "disabled");
    return forked;
  }

  async updateManifest(id: string, patch: { name?: string; description?: string }): Promise<PluginRecord> {
    const records = await this.readRecords();
    const target = records.find((r) => r.id === id);
    if (!target) {
      throw new Error(`找不到插件：${id}`);
    }
    const wasRunning = this.fibers.has(id);
    if (wasRunning) {
      await this.disablePlugin(id);
    }
    const latest = await this.readRecords();
    const updated = latest.map((r) =>
      r.id === id
        ? {
            ...r,
            manifest: {
              ...r.manifest,
              ...(patch.name?.trim() ? { name: patch.name.trim() } : {}),
              ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
            },
            updatedAt: Date.now(),
          }
        : r,
    );
    await this.writeRecords(updated);
    if (wasRunning) {
      return this.enablePlugin(id);
    }
    return this.hydrateRecord(updated.find((r) => r.id === id)!);
  }

  async disposeAll(): Promise<void> {
    for (const [id, fiber] of this.fibers.entries()) {
      this.fibers.delete(id);
      await fiber.dispose().catch(() => {});
    }
    this.statuses.clear();
  }
}

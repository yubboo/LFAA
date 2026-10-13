/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-skill-filesystem。
 *
 * 功能：本地文件系统 Skill Provider（ctx.skills 的一个实现）。
 * 作用：从项目根、自定义目录、用户目录扫描“目录束（<skill名>/SKILL.md）”与“扁平
 *       <skill名>.md”两种 Skill，解析 YAML frontmatter，按 cwd 敏感工作区产出候选；
 *       正文经 Node fs 直接读取（纯参考文本，不扩大权限、不走 Daemon）。
 * 关联文件：packages/skill/skill（注册表契约）、packages/skill/skill-office（内置 Provider）。
 *
 * LFAA 与蓝本差异（中文说明）：
 * 1. 蓝本读文件走 dsh-fs 抽象（ctx.fs）；LFAA 无该抽象，本包全程用 node:fs 直读，
 *    对应“正文是纯参考文本”的边界，不扩大目标/权限。
 * 2. 蓝本用 yaml 包解析 frontmatter；LFAA 按 store 现状改用 js-yaml@4.3.2。
 * 3. 蓝本的项目根是 <root>/.dsh/skills 与 <root>/.agents/skills；LFAA 既有约定为
 *    <root>/.lfaa/skills 与 <root>/.agents/skills（见 tool-skill 现有发现路径）。
 * 4. 用户目录取 ~/.lfaa/skills（本包定义，与 LFAA 数据目录命名一致），
 *    另保留 ~/.agents/skills 兼容共享 Agent 目录。
 * 5. 蓝本监听宿主写文件事件 fs/observed 做即时失效；LFAA 无该事件，失效完全靠
 *    chokidar 监听目录变更兜底；watch:false 时降级为每次 list 全量重扫。
 * 6. 蓝本依赖 dsh-home-paths 的 canonicalizeWatchPath；LFAA 用 node:fs realpath 等价实现。
 */

import { access, opendir, open, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";
import type { Context } from "@deepseek-ai/cordis";
import chokidar from "chokidar";
import type { FSWatcher } from "chokidar";
import yaml from "js-yaml";
import {
  BUNDLED_SKILL_RANK,
  isSkillName,
  type SkillCandidate,
  type SkillDefinition,
  type SkillInvocationPolicy,
  type SkillLookupOptions,
  type SkillProvider,
  type SkillProviderControl,
  type SkillProviderObservation,
  type SkillSource,
} from "lfaa-skill";

// source/rank 语义对齐蓝本：数值越小越优先（project 最高，bundled 最低）。
const PROJECT_LFAA_RANK = 100;
const PROJECT_AGENTS_RANK = 200;
const CUSTOM_RANK = 300;
const USER_LFAA_RANK = 400;
const USER_AGENTS_RANK = 500;
const DEFAULT_WATCH_STABILITY_THRESHOLD_MS = 200;
const DEFAULT_WATCH_POLL_INTERVAL_MS = 100;
const DEFAULT_WATCH_MAX_PROJECTS = 128;

/** Cordis 插件名。 */
export const name = "skill-filesystem";
/** 注册表 Provider 依赖。 */
export const inject = ["skills"];

/** 本地文件系统 Skill Provider 配置。 */
export interface Config {
  /** Provider 名；默认 filesystem。 */
  providerName?: string;
  /** 是否在自定义目录之外纳入项目根与用户根。 */
  includeDefaultRoots?: boolean;
  /** LFAA 配置根；默认取 ~/.lfaa。 */
  lfaaHome?: string;
  /** 共享 Agent 配置根；默认取 $LFAA_AGENTS_HOME 或 ~/.agents。 */
  agentsHome?: string;
  /** 追加的自定义 Skill 根目录，扫描顺序在项目根之后、用户根之前。 */
  customSkillDirs?: string[];
  /** 是否监听本地 Skill 根目录的目录变化。 */
  watch?: boolean;
  /** Chokidar 是否用轮询代替原生文件事件。 */
  watchUsePolling?: boolean;
  /** 变更条目需保持稳定多少毫秒后才被观察到。 */
  watchStabilityThresholdMs?: number;
  /** Chokidar 稳定判定/轮询探针间隔毫秒。 */
  watchPollIntervalMs?: number;
  /** 保留监听的不同项目根上限。 */
  watchMaxProjects?: number;
  /** 监听的符号链接是否跟随目标。 */
  watchFollowSymlinks?: boolean;
  /** 内置 Skill 根目录；包含默认根时默认取 $LFAA_BUNDLED_SKILL_DIR，否则不挂。 */
  bundledSkillDir?: string;
}

interface SkillRoot {
  path: string;
  source: SkillSource;
  rank: number;
  /** 用户根下跳过 .system 目录。 */
  skipSystem?: boolean;
  projectRoot?: string;
  /** 内置根经 Node fs 直读即可，不受宿主沙箱约束。 */
  trustedHost?: boolean;
}

interface SkillRootEntry {
  name: string;
  type: "directory" | "file" | "other";
  path: string;
}

interface SkillText {
  path: string;
  content: string;
}

interface ParsedSkill {
  name: string;
  description: string;
  whenToUse?: string;
  invocation: SkillInvocationPolicy;
  metadata?: Record<string, unknown>;
  path: string;
  content: string;
}

interface LocalLocator {
  path: string;
  directory: string;
}

interface ResolvedWatchConfig {
  enabled: boolean;
  usePolling: boolean;
  stabilityThresholdMs: number;
  pollIntervalMs: number;
  maxProjects: number;
  followSymlinks: boolean;
}

/** 在 ctx.skills 上注册本地文件系统 Skill Provider。 */
export function apply(ctx: Context, config: Config = {}): void {
  let provider!: FileSystemSkillProvider;
  ctx.skills.registerProvider((control) => {
    provider = new FileSystemSkillProvider(ctx, control, config);
    return provider;
  });
  ctx.effect(
    () => () => {
      void provider.dispose();
    },
    "skill-filesystem watcher",
  );
}

/** 把本地项目/用户 Skill 根映射进 ctx.skills 的 Provider。 */
export class FileSystemSkillProvider implements SkillProvider {
  readonly name: string;
  private readonly ctx: Context;
  private readonly includeDefaultRoots: boolean;
  private readonly lfaaHome: string;
  private readonly agentsHome: string;
  private readonly customSkillDirs: string[];
  private readonly watchManager: SkillWatchManager;
  private readonly bundledSkillDir: string | undefined;
  private disposal: Promise<void> | undefined;

  constructor(
    ctx: Context,
    control: SkillProviderControl,
    config: Config = {},
  ) {
    this.ctx = ctx;
    this.name = config.providerName ?? "filesystem";
    this.includeDefaultRoots = config.includeDefaultRoots ?? true;
    this.lfaaHome = config.lfaaHome ?? process.env.LFAA_HOME ?? join(homedir(), ".lfaa");
    this.agentsHome = config.agentsHome ?? process.env.LFAA_AGENTS_HOME ?? join(homedir(), ".agents");
    this.customSkillDirs = (config.customSkillDirs ?? []).map((root) => resolve(root));
    this.watchManager = new SkillWatchManager(ctx, control.invalidate, resolveWatchConfig(config));
    control.signal.addEventListener("abort", () => {
      void this.dispose();
    }, { once: true });
    // 环境内置根是默认根的一部分：隔离 Provider 只挂自己显式指定的根，
    // 否则每个隔离 Provider 都会以自己的 Provider 名重复发现应用内置 Skill。
    const bundledSkillDir = config.bundledSkillDir
      ?? (this.includeDefaultRoots ? process.env.LFAA_BUNDLED_SKILL_DIR : undefined);
    this.bundledSkillDir = bundledSkillDir === undefined ? undefined : resolve(bundledSkillDir);
  }

  /**
   * 发现某个 cwd 敏感工作区的本地 Skill 摘要。
   * @param options - cwd 选择要扫描的项目根。
   * @returns 带稳定根 rank 的候选；watcher 启动失败时以不完整 observation 返回可读候选。
   */
  async list(options: SkillLookupOptions): Promise<SkillCandidate[] | SkillProviderObservation> {
    if (options.allowHostFilesystem === false) return [];
    const roots = await this.roots(options.cwd, options.customSkillDirs);
    let complete = true;
    try {
      complete = await this.watchManager.observeRoots(roots);
    } catch (error) {
      if (this.disposal !== undefined) throw error;
      complete = false;
    }
    const candidates: SkillCandidate[] = [];
    for (const root of roots) {
      options.signal?.throwIfAborted();
      for (const skill of await discoverRoot(root, this.ctx, this.name, options.signal)) {
        candidates.push(skill);
      }
    }
    return complete ? candidates : { candidates, complete };
  }

  /**
   * 从候选的文件 locator 加载完整本地 Skill 正文。
   * @param candidate - 本 Provider 返回的 winner 候选。
   * @param options - signal 取消文件读取。
   * @returns 完整 Skill；文件消失时返回 undefined。
   */
  async get(candidate: SkillCandidate, options: SkillLookupOptions): Promise<SkillDefinition | undefined> {
    const locator = candidate.locator as LocalLocator;
    const parsed = await parseSkillFile(locator.path, this.ctx, options.signal);
    if (parsed === undefined) return undefined;
    return {
      name: parsed.name,
      description: parsed.description,
      ...parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {},
      invocation: parsed.invocation,
      source: candidate.source,
      provider: this.name,
      resourceBase: { kind: "directory", path: locator.directory },
      path: parsed.path,
      ...parsed.metadata !== undefined ? { metadata: parsed.metadata } : {},
      content: parsed.content,
    };
  }

  /**
   * 关闭所有宿主 watcher 并容纳迟到的文件系统回调。
   * @returns 所有 watcher 到达静止后兑现的共享 Promise。
   */
  dispose(): Promise<void> {
    this.disposal ??= this.watchManager.dispose();
    return this.disposal;
  }

  private async roots(cwd: string | undefined, accountRoots: readonly string[] = []): Promise<SkillRoot[]> {
    const roots: SkillRoot[] = [];
    if (this.includeDefaultRoots && cwd !== undefined) {
      const projectRoot = await findProjectRoot(resolve(cwd));
      roots.push(
        { path: join(projectRoot, ".lfaa/skills"), source: "project-lfaa", rank: PROJECT_LFAA_RANK, projectRoot },
        { path: join(projectRoot, ".agents/skills"), source: "project-agents", rank: PROJECT_AGENTS_RANK, projectRoot },
      );
    }
    roots.push(...this.customSkillDirs.map((path) => ({ path, source: "custom" as const, rank: CUSTOM_RANK })));
    roots.push(...accountRoots.slice(0, 16).map(path => ({ path: resolve(path), source: "custom" as const, rank: CUSTOM_RANK })));
    if (this.includeDefaultRoots) {
      roots.push(
        { path: join(this.lfaaHome, "skills"), source: "user-lfaa", rank: USER_LFAA_RANK, skipSystem: true },
        { path: join(this.agentsHome, "skills"), source: "user-agents", rank: USER_AGENTS_RANK },
      );
    }
    if (this.bundledSkillDir !== undefined) {
      roots.push({ path: this.bundledSkillDir, source: "bundled", rank: BUNDLED_SKILL_RANK, trustedHost: true });
    }
    return roots;
  }
}

type SkillWatchEvent = "add" | "addDir" | "change" | "unlink" | "unlinkDir";

interface RootWatchState {
  root: SkillRoot;
  watcher: FSWatcher | undefined;
  unhealthy: boolean;
  opening?: Promise<void>;
}

/** 拥有有界的宿主 watcher；发现与读取仍在 Node fs 上。 */
class SkillWatchManager {
  private readonly roots = new Map<string, RootWatchState>();
  private readonly projects = new Map<string, Set<string>>();
  private readonly lifecycle = new AbortController();
  private closing = false;
  private invalidationQueued = false;
  private readonly ctx: Context;
  private readonly invalidate: () => void;
  private readonly config: ResolvedWatchConfig;

  constructor(
    ctx: Context,
    invalidate: () => void,
    config: ResolvedWatchConfig,
  ) {
    this.ctx = ctx;
    this.invalidate = invalidate;
    this.config = config;
  }

  /** 观察一批根：项目根按项目分组引用计数，超上限驱逐最久未用的项目根。 */
  async observeRoots(roots: readonly SkillRoot[]): Promise<boolean> {
    if (this.closing || !this.config.enabled) return false;
    const projectRoots = new Map<string, SkillRoot[]>();
    for (const root of roots) {
      if (root.projectRoot === undefined) continue;
      const grouped = projectRoots.get(root.projectRoot) ?? [];
      grouped.push(root);
      projectRoots.set(root.projectRoot, grouped);
    }
    for (const [projectRoot, grouped] of projectRoots) {
      const paths = new Set(grouped.map((root) => root.path));
      this.projects.set(projectRoot, paths);
      for (const root of grouped) await this.retainRoot(root);
    }
    // 非项目根（自定义/用户/内置）直接保留。
    for (const root of roots) {
      if (root.projectRoot !== undefined) continue;
      await this.retainRoot(root);
    }
    let evictedProject = false;
    while (this.projects.size > this.config.maxProjects) {
      const oldest = this.projects.keys().next();
      if (oldest.done) break;
      const projectRoot = oldest.value;
      const paths = this.projects.get(projectRoot);
      this.projects.delete(projectRoot);
      if (paths !== undefined) {
        for (const path of paths) await this.releaseRoot(path);
      }
      evictedProject = true;
    }
    // 用户自定义根同样有界；被淘汰根的目录缓存随之失效。
    while (this.roots.size > this.config.maxProjects * 3) {
      const oldest = this.roots.keys().next();
      if (oldest.done) break;
      await this.releaseRoot(oldest.value);
      evictedProject = true;
    }
    if (evictedProject) this.invalidate();
    return roots.every(root => this.roots.get(root.path)?.unhealthy === false);
  }

  async dispose(): Promise<void> {
    this.closing = true;
    this.lifecycle.abort(new Error("skill-filesystem watcher disposed"));
    const states = [...this.roots.values()];
    this.roots.clear();
    this.projects.clear();
    await Promise.all(states.map(async (state) => {
      const watcher = state.watcher;
      state.watcher = undefined;
      if (watcher !== undefined) await closeWatcher(this.ctx, watcher);
    }));
  }

  private async retainRoot(root: SkillRoot): Promise<void> {
    let state = this.roots.get(root.path);
    if (state === undefined) {
      state = { root, watcher: undefined, unhealthy: true };
      this.roots.set(root.path, state);
    }
    this.roots.delete(root.path);
    this.roots.set(root.path, state);
    if (!this.config.enabled || this.closing) return;
    if (state.watcher !== undefined && !state.unhealthy) return;
    const retained = state;
    if (!state.opening) state.opening = this.openWatcher(state).finally(() => { delete retained.opening; });
    await state.opening;
  }

  private async releaseRoot(path: string): Promise<void> {
    const state = this.roots.get(path);
    if (state === undefined) return;
    this.roots.delete(path);
    const watcher = state.watcher;
    state.watcher = undefined;
    if (watcher !== undefined) await closeWatcher(this.ctx, watcher);
  }

  private async openWatcher(state: RootWatchState): Promise<void> {
    // watch 关闭时不启动任何 watcher：每次 list 全量重扫即为降级方案。
    if (this.closing || !this.config.enabled) return;
    const previous = state.watcher;
    state.watcher = undefined;
    if (previous !== undefined) await closeWatcher(this.ctx, previous);
    let watcher: FSWatcher | undefined;
    let stopWaiting = () => {};
    try {
      watcher = chokidar.watch(state.root.path, {
        // 持久监听：本 Provider 的 effect 在拆卸时显式关闭所有句柄。
        persistent: true,
        ignoreInitial: true,
        depth: 1,
        followSymlinks: this.config.followSymlinks,
        atomic: true,
        awaitWriteFinish: {
          stabilityThreshold: this.config.stabilityThresholdMs,
          pollInterval: this.config.pollIntervalMs,
        },
        usePolling: this.config.usePolling,
        interval: this.config.pollIntervalMs,
      });
      state.watcher = watcher;
      // tsconfig lib 停留在 ES2022，Promise.withResolvers 尚未入 lib，手写 deferred。
      let resolveReady: (value?: undefined) => void = () => {};
      let rejectReady: (reason?: unknown) => void = () => {};
      const readiness = new Promise<undefined>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
      });
      const abort = () => rejectReady(this.lifecycle.signal.reason);
      const timer = setTimeout(() => rejectReady(new Error("Skill watcher 初始化超时。")), 5000);
      this.lifecycle.signal.addEventListener("abort", abort, { once: true });
      stopWaiting = () => { clearTimeout(timer); this.lifecycle.signal.removeEventListener("abort", abort); };
      if (this.lifecycle.signal.aborted) abort();
      let ready = false;
      const onError = (error: unknown): void => {
        if (!ready) {
          rejectReady(error);
          return;
        }
        this.handleWatcherError(state, error);
      };
      watcher.on("error", onError);
      watcher.once("ready", () => {
        ready = true;
        resolveReady(undefined);
      });
      for (const event of ["add", "addDir", "change", "unlink", "unlinkDir"] as const) {
        watcher.on(event, (path: string) => {
          this.handleWatchEvent(state, event, path);
        });
      }
      await readiness;
      stopWaiting();
      if (this.closing) {
        await closeWatcher(this.ctx, watcher);
        return;
      }
      state.watcher = watcher;
      state.unhealthy = false;
    } catch (error) {
      stopWaiting();
      if (state.watcher === watcher) state.watcher = undefined;
      if (watcher) await closeWatcher(this.ctx, watcher);
      if (!this.closing) {
        state.unhealthy = true;
        this.ctx.logger.warn(`skill-filesystem: failed to watch ${state.root.path}: ${errorMessage(error)}`);
      }
      // watcher 启动失败不阻塞发现：本次 list 照常返回，下次发现再重试。
    }
  }

  private handleWatchEvent(state: RootWatchState, event: SkillWatchEvent, path: string): void {
    const target = resolve(path);
    if (this.closing || !isRelevantWatchEvent(state.root, event, target)) return;
    this.queueInvalidation();
  }

  private handleWatcherError(state: RootWatchState, error: unknown): void {
    if (this.closing) return;
    this.ctx.logger.warn(`skill-filesystem: watcher for ${state.root.path} failed: ${errorMessage(error)}`);
    state.unhealthy = true;
    this.queueInvalidation();
  }

  private queueInvalidation(): void {
    if (this.closing || this.invalidationQueued) return;
    this.invalidationQueued = true;
    queueMicrotask(() => {
      this.invalidationQueued = false;
      if (this.closing) return;
      this.invalidate();
    });
  }
}

async function closeWatcher(ctx: Context, watcher: FSWatcher): Promise<void> {
  try {
    await watcher.close();
  } catch (error) {
    ctx.logger.warn(`skill-filesystem: failed to close watcher: ${errorMessage(error)}`);
  }
}

function resolveWatchConfig(config: Config): ResolvedWatchConfig {
  const stabilityThresholdMs = config.watchStabilityThresholdMs ?? DEFAULT_WATCH_STABILITY_THRESHOLD_MS;
  const pollIntervalMs = config.watchPollIntervalMs ?? DEFAULT_WATCH_POLL_INTERVAL_MS;
  const maxProjects = config.watchMaxProjects ?? DEFAULT_WATCH_MAX_PROJECTS;
  assertPositiveInteger("watchStabilityThresholdMs", stabilityThresholdMs);
  assertPositiveInteger("watchPollIntervalMs", pollIntervalMs);
  assertPositiveInteger("watchMaxProjects", maxProjects);
  return {
    enabled: config.watch ?? true,
    usePolling: config.watchUsePolling ?? false,
    stabilityThresholdMs,
    pollIntervalMs,
    maxProjects,
    followSymlinks: config.watchFollowSymlinks ?? true,
  };
}

/** 判断某个 watcher 事件是否落在 Skill 根的相关层级内。 */
function isRelevantWatchEvent(root: SkillRoot, event: SkillWatchEvent, path: string): boolean {
  const segments = containedSegments(root.path, path);
  if (segments === undefined) return false;
  if (segments.length === 0) return event === "addDir" || event === "unlinkDir";
  if (root.skipSystem === true && segments[0] === ".system") return false;
  if (segments.length === 1) {
    if (event === "addDir" || event === "unlinkDir") return true;
    return segments[0]?.endsWith(".md") === true;
  }
  return segments.length === 2
    && segments[1] === "SKILL.md"
    && event !== "addDir"
    && event !== "unlinkDir";
}

function containedSegments(root: string, path: string): string[] | undefined {
  const child = relative(root, path);
  if (child.length === 0) return [];
  if (child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) return undefined;
  return child.split(sep);
}

function assertPositiveInteger(field: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`skill-filesystem: ${field} must be a positive integer`);
  }
}

function isAbsentPathError(error: unknown): boolean {
  return hasErrorCode(error, "ENOENT") || hasErrorCode(error, "ENOTDIR");
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === code;
}

/** 扫描单个根目录，产出该根下全部 Skill 候选。 */
async function discoverRoot(root: SkillRoot, ctx: Context, provider: string, signal?: AbortSignal): Promise<SkillCandidate[]> {
  const skills: SkillCandidate[] = [];
  const entries = await listSkillRootEntries(root, ctx, signal);
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (root.skipSystem === true && entry.name === ".system") continue;
    const locator = entry.type === "directory"
      ? { path: join(entry.path, "SKILL.md"), directory: entry.path }
      : entry.type === "file" && entry.name.endsWith(".md")
        ? { path: entry.path, directory: root.path }
        : undefined;
    if (locator === undefined) continue;
    signal?.throwIfAborted();
    const parsed = await parseSkillFile(locator.path, ctx, signal, true);
    if (parsed === undefined) continue;
    skills.push({
      name: parsed.name,
      description: parsed.description,
      ...parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {},
      invocation: parsed.invocation,
      provider,
      source: root.source,
      rank: root.rank,
      locator,
      resourceBase: { kind: "directory", path: locator.directory },
      path: parsed.path,
      ...parsed.metadata !== undefined ? { metadata: parsed.metadata } : {},
    });
  }
  return skills;
}

/** 目录摘要扫描有界，避免读取无关大目录并占满内存。 */
async function listSkillRootEntries(root: SkillRoot, ctx: Context, signal?: AbortSignal): Promise<SkillRootEntry[]> {
  const result: SkillRootEntry[] = [];
  try {
    const directory = await opendir(root.path);
    for await (const entry of directory) {
      signal?.throwIfAborted();
      if (result.length >= 512) { ctx.logger.warn(`skill-filesystem: root truncated at 512 entries: ${root.path}`); break; }
      const path = join(root.path, entry.name);
      const type = await nodeEntryKind(path, entry, ctx);
      result.push({ name: entry.name, type: type ?? "other", path });
    }
  } catch (error) {
    signal?.throwIfAborted();
    if (!isAbsentPathError(error)) ctx.logger.warn(`skill-filesystem: failed to list ${root.path}: ${errorMessage(error)}`);
  }
  return result;
}

async function parseSkillFile(
  path: string,
  ctx: Context,
  signal?: AbortSignal,
  metadataOnly = false,
): Promise<ParsedSkill | undefined> {
  const raw = await readSkillText(path, signal, metadataOnly);
  signal?.throwIfAborted();
  if (raw === undefined) return undefined;
  let parsed: { data: Record<string, unknown>; body: string } | undefined;
  try {
    parsed = parseFrontmatter(raw.content);
  } catch (error) {
    ctx.logger.warn(`skill file ${path} ignored: invalid YAML frontmatter: ${errorMessage(error)}`);
    return undefined;
  }
  if (parsed === undefined) {
    ctx.logger.warn(`skill file ${path} ignored: missing YAML frontmatter`);
    return undefined;
  }
  const name = stringField(parsed.data, "name");
  const description = stringField(parsed.data, "description");
  if (name === undefined || description === undefined) {
    ctx.logger.warn(`skill file ${path} ignored: frontmatter requires name and description`);
    return undefined;
  }
  if (!isSkillName(name)) {
    ctx.logger.warn(`skill file ${path} ignored: invalid skill name "${name}"`);
    return undefined;
  }
  let invocation: SkillInvocationPolicy;
  try {
    invocation = parseInvocationPolicy(parsed.data);
  } catch (error) {
    ctx.logger.warn(`skill file ${path} ignored: invalid invocation frontmatter: ${errorMessage(error)}`);
    return undefined;
  }
  return {
    name,
    description,
    ...optionalString(parsed.data, "whenToUse"),
    invocation,
    ...optionalMetadata(parsed.data),
    path: raw.path,
    content: parsed.body.trim(),
  };
}

/** 摘要只读前 16 KiB；正文最多 512 KiB，并拒绝设备/管道文件。 */
async function readSkillText(path: string, signal?: AbortSignal, metadataOnly = false): Promise<SkillText | undefined> {
  signal?.throwIfAborted();
  try {
    const resolvedPath = await realpath(path);
    const info = await stat(resolvedPath);
    if (!info.isFile() || info.size > 512 * 1024) return undefined;
    const handle = await open(resolvedPath, "r");
    try {
      const current = await handle.stat();
      if (!current.isFile() || current.size > 512 * 1024) return undefined;
      const buffer = Buffer.alloc(metadataOnly ? 16 * 1024 : 512 * 1024 + 1);
      let used = 0;
      while (used < buffer.length) {
        signal?.throwIfAborted();
        const { bytesRead } = await handle.read(buffer, used, buffer.length - used, used);
        if (!bytesRead) break;
        used += bytesRead;
      }
      if (!metadataOnly && used > 512 * 1024) return undefined;
      return { path: resolvedPath, content: buffer.subarray(0, used).toString("utf8") };
    } finally { await handle.close(); }
  } catch (error) {
    signal?.throwIfAborted();
    if (isAbsentPathError(error)) return undefined;
    throw error;
  }
}

async function nodeEntryKind(
  fullPath: string,
  entry: { isDirectory(): boolean; isFile(): boolean; isSymbolicLink(): boolean },
  ctx: Context,
): Promise<"directory" | "file" | undefined> {
  if (entry.isDirectory()) return "directory";
  if (entry.isFile()) return "file";
  // 非文件目录项（FIFO 等）是平台相关的，有意跳过。
  if (!entry.isSymbolicLink()) return undefined;
  try {
    const info = await stat(fullPath);
    if (info.isDirectory()) return "directory";
    if (info.isFile()) return "file";
    return undefined;
  } catch (error) {
    ctx.logger.warn(`skill entry ${fullPath} ignored: failed to follow symbolic link: ${errorMessage(error)}`);
    return undefined;
  }
}

/** 解析 Markdown 的 --- YAML frontmatter --- 头；无头时返回 undefined。 */
function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } | undefined {
  const firstLineEnd = raw.indexOf("\n");
  if (firstLineEnd < 0) return undefined;
  const firstLine = raw.slice(0, firstLineEnd).replace(/\r$/, "");
  if (firstLine !== "---") return undefined;
  const start = firstLineEnd + 1;
  const closing = findClosingFrontmatter(raw, start);
  if (closing === undefined) return undefined;
  const yamlText = raw.slice(start, closing.start);
  // LFAA 用 js-yaml 替代蓝本的 yaml 包；顶层必须是对象。
  const parsed: unknown = yaml.load(yamlText);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
  return { data: parsed as Record<string, unknown>, body: raw.slice(closing.bodyStart) };
}

function findClosingFrontmatter(raw: string, start: number): { start: number; bodyStart: number } | undefined {
  let lineStart = start;
  while (lineStart <= raw.length) {
    const nextNewline = raw.indexOf("\n", lineStart);
    const lineEnd = nextNewline < 0 ? raw.length : nextNewline;
    const line = raw.slice(lineStart, lineEnd).replace(/\r$/, "");
    if (line === "---") {
      return { start: lineStart, bodyStart: nextNewline < 0 ? raw.length : nextNewline + 1 };
    }
    if (nextNewline < 0) return undefined;
    lineStart = nextNewline + 1;
  }
}

/** 从 cwd 向上找含 .git 的项目根；找不到则返回 cwd 本身。 */
async function findProjectRoot(cwd: string): Promise<string> {
  let current = cwd;
  while (true) {
    if (await pathExists(join(current, ".git"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return cwd;
    current = parent;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    // 向文件系统根方向走时，候选路径缺失是预期情况。
    return false;
  }
}

function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalString(data: Record<string, unknown>, key: string): { [K in typeof key]?: string } {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? { [key]: value } : {};
}

/** 解析 frontmatter 的调用开关：默认模型/人工两侧都允许。 */
function parseInvocationPolicy(data: Record<string, unknown>): SkillInvocationPolicy {
  rejectLegacyInvocationKey(data, "disableModelInvocation", "disable-model-invocation");
  rejectLegacyInvocationKey(data, "modelInvocable", "disable-model-invocation");
  rejectLegacyInvocationKey(data, "userInvocable", "user-invocable");
  const disableModelInvocation = frontmatterBoolean(data, "disable-model-invocation");
  const userInvocable = frontmatterBoolean(data, "user-invocable");
  return {
    modelInvocable: disableModelInvocation !== true,
    userInvocable: userInvocable !== false,
  };
}

function rejectLegacyInvocationKey(data: Record<string, unknown>, legacy: string, canonical: string): void {
  if (Object.hasOwn(data, legacy)) {
    throw new Error(`frontmatter field "${legacy}" is unsupported; use "${canonical}"`);
  }
}

function frontmatterBoolean(data: Record<string, unknown>, key: string): boolean | undefined {
  if (!Object.hasOwn(data, key)) return undefined;
  const value = data[key];
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  if (typeof value === "string") {
    switch (value.toLowerCase()) {
      case "true":
      case "yes":
      case "on":
        return true;
      case "false":
      case "no":
      case "off":
        return false;
    }
  }
  throw new TypeError(`frontmatter field "${key}" must be a boolean`);
}

function optionalMetadata(data: Record<string, unknown>): { metadata?: Record<string, unknown> } {
  const value = data.metadata;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return { metadata: value as Record<string, unknown> };
  }
  return {};
}

function errorMessage(error: unknown): string {
  try {
    return String(error);
  } catch {
    return "[unrenderable thrown value]";
  }
}

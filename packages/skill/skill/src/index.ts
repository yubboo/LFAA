/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-skill。
 *
 * 功能：Agent Skill Provider 注册表服务（ctx.skills）。
 * 作用：本包只负责合并各 Provider 的 Skill 目录、按 rank 解析重名 Skill 的 winner、
 *       向消费方暴露排序后的摘要与按需加载的完整定义；具体 Skill 来自哪里
 *       （文件系统目录、内置 bundled、运行时注入）由各 Provider 插件决定。
 * 关联文件：packages/skill/skill-filesystem（本地目录 Provider）、
 *          packages/skill/skill-office / skill-badge（内置 Provider）、
 *          packages/skill/tool-skill（模型侧 skill 工具，后续分片接线）。
 *
 * LFAA 与蓝本差异（中文说明）：
 * 1. 蓝本依赖 dsh-scope 的 ScopedLayers/NamedEntries/scopeOf/scopeChainOf 实现“按 Agent
 *    preset 分层、就近层覆盖”的注册表；lfaa-scope 当前只有 App 可见范围判断，未导出这些符号，
 *    且本分片不允许 import 其他分片尚未落地的符号。故本包内置一个轻量“全局层”：所有 Provider
 *    与运行时 Skill 登记在同一张表里，重名按 rank 决定 winner（rank 相同按注册顺序）。
 *    SkillViewOptions.scope 字段保留为预留位，当前全局层忽略它；后续 scope 分片补齐分层存储后，
 *    再把本包替换回 ScopedLayers 实现。
 * 2. 蓝本通过 declare module dsh-llm 把 skill-invocation 注入消息登记进 MessageSourceMap；
 *    lfaa-llm 当前没有该映射接口，本包只导出 SkillInvocationSource 类型供后续接线使用。
 * 3. lfaa-util-values 未导出 assertNever，本包内自带等价实现。
 */

import { Context, Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import type Schema from "@deepseek-ai/schemastery";

/** Skill 名必须是 kebab-case 小写短横线格式。 */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_COLLECT_CACHE_ENTRIES = 128;
const MAX_COLLECT_ATTEMPTS = 2;
const RUNTIME_PROVIDER = "runtime";
const RUNTIME_RANK = 250;

/** 内置打包 Skill Provider 与 bundled 根目录使用的标准优先级 rank（数值越小越优先）。 */
export const BUNDLED_SKILL_RANK = 600;

/**
 * 判断字符串是否为合法的 kebab-case Skill 名。
 * @param name - 待校验的 Skill 名。
 * @returns 是否匹配公开 Skill 名文法。
 */
export function isSkillName(name: string): boolean {
  return SKILL_NAME.test(name);
}

/** 判断账户级 Skill 停用名单是否禁止模型发现或加载指定条目。 */
export function isSkillDisabled(name: string, disabledSkillNames: readonly string[] | undefined): boolean {
  return disabledSkillNames?.includes(name) ?? false;
}

/** Skill 来源桶；该值会进入给模型看的元数据，本身不代表优先级。 */
export type SkillSource =
  | "project-lfaa"
  | "project-agents"
  | "runtime"
  | "user-lfaa"
  | "user-agents"
  | "custom"
  | "bundled"
  | (string & {});

/** Provider 加载 Skill 正文时用于解析相对资源的基址。 */
export type SkillResourceBase =
  | { readonly kind: "directory"; readonly path: string }
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "opaque"; readonly description: string };

/** Skill 调用开关：分别控制模型侧目录与人工命令目录。 */
export interface SkillInvocationPolicy {
  /** 模型侧目录与加载器是否包含该 Skill。 */
  readonly modelInvocable: boolean;
  /** 人工命令目录与加载器是否包含该 Skill。 */
  readonly userInvocable: boolean;
}

/** ctx.skills.list() 返回的、与调用方无关的 Skill 摘要。 */
export interface SkillSummary {
  /** Provider 提供的指令文件绝对路径；虚拟 Skill 没有该字段。 */
  readonly path?: string;
  /** 寻址该 Skill 的 kebab-case 标识。 */
  readonly name: string;
  /** 给路由消费者看的简短描述。 */
  readonly description: string;
  /** 额外的路由指引。 */
  readonly whenToUse?: string;
  /** 已解析的模型/人工调用开关。 */
  readonly invocation: SkillInvocationPolicy;
  /** 产出该 winner 的发现来源。 */
  readonly source: SkillSource;
  /** 拥有该 Skill 正文的 Provider。 */
  readonly provider: string;
  /** Provider 指定的相对资源基址。 */
  readonly resourceBase?: SkillResourceBase;
}

/** Provider 目录条目：注册表用它合并并在后续按需加载 Skill。 */
export interface SkillCandidate extends SkillSummary {
  /** 重名 Skill 在 Provider 注册顺序之前先比 rank；rank 越小越优先。 */
  readonly rank: number;
  /** Provider 私有的不透明句柄，get() 时原样回传给该 Provider。 */
  readonly locator: unknown;
  /** 从 frontmatter 解析出的可选元数据对象。 */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** ctx.skills.get() 返回的完整 Skill 定义（含正文）。 */
export interface SkillDefinition extends SkillSummary {
  /** 剥离 Provider 专属元数据后的 Markdown 指令正文。 */
  readonly content: string;
  /** 从 frontmatter 解析出的可选元数据对象。 */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** ctx.skills.register() 接收的运行时 Skill 登记输入。 */
export type SkillRegistration = Omit<SkillDefinition, "invocation" | "provider"> & {
  /** 调用开关；省略时模型与人工两侧都允许。 */
  readonly invocation?: SkillInvocationPolicy;
  /** Provider 标签；省略时使用注册表自带的运行时 Provider。 */
  readonly provider?: string;
};

/** cwd 敏感且可中止的 Provider 工作所用的调用方上下文。 */
export interface SkillLookupOptions {
  /** 由账户设置提供，模型参数不能注入；缓存必须包含账户与根集合。 */
  readonly userId?: string;
  readonly customSkillDirs?: readonly string[];
  /** 远程控制端为 false，禁止读取控制端宿主文件。 */
  readonly allowHostFilesystem?: boolean;
  /** 当前查找选择的工作区。 */
  readonly cwd?: string | undefined;
  /** 中止当前调用方的发现或加载工作。 */
  readonly signal?: AbortSignal | undefined;
}

/**
 * 注册表读取选项：Provider 查找上下文加上观看范围。
 * LFAA 当前为全局单层，scope 字段仅为与 DSH 契约对齐而保留，传入后被忽略。
 */
export interface SkillViewOptions extends SkillLookupOptions {
  /** 观看范围（调用方 Agent）；LFAA 全局层忽略此字段，预留后续分层接线。 */
  readonly scope?: unknown;
}

/**
 * 判断 Skill 是否允许暴露给模型并被模型加载。
 * @param skill - 携带已解析调用开关的 Skill 元数据。
 */
export function isModelInvocable(skill: Pick<SkillSummary, "invocation">): boolean {
  return skill.invocation.modelInvocable;
}

/**
 * 判断 Skill 是否允许暴露给人工命令并被人工加载。
 * @param skill - 携带已解析调用开关的 Skill 元数据。
 */
export function isUserInvocable(skill: Pick<SkillSummary, "invocation">): boolean {
  return skill.invocation.userInvocable;
}

/**
 * 用户显式调用 Skill 时注入上下文消息的来源标记：
 * 用户原话走普通 user 消息，渲染后的 Skill 正文作为 instructions 形上下文注入。
 */
export interface SkillInvocationSource {
  readonly kind: "skill-invocation";
  /** 被调用的 Skill 名，注入边界处已校验为人工可调用。 */
  readonly name: string;
  /** 注入的 Skill 正文是给模型遵循的指令。 */
  readonly form: "instructions";
}

/**
 * 把一个已加载 Skill 渲染给模型。skill 工具结果与用户显式调用注入共用同一段输出，
 * 保证两条路径模型看到同一套 <skill_content> 结构；名字走转义属性，正文原样嵌入
 * （Skill 是本地可信内容，用户调用文本不进入这个包裹）。
 * @param skill - 名称、Provider、可选资源基址与正文。
 * @returns 完整的面向模型的 <skill_content> 块。
 */
export function renderSkillContent(skill: Pick<SkillDefinition, "name" | "provider" | "resourceBase" | "content">): string {
  const resourceHint = renderResourceHint(skill);
  return [
    `<skill_content name="${escapeAttr(skill.name)}">`,
    "<skill_resources>",
    ...resourceHint,
    "</skill_resources>",
    "",
    "<skill_instructions>",
    skill.content,
    "</skill_instructions>",
    "</skill_content>",
  ].join("\n");
}

function renderResourceHint(skill: Pick<SkillDefinition, "provider" | "resourceBase">): string[] {
  const base = skill.resourceBase;
  if (base === undefined) {
    return [
      `Resources for this skill are managed by provider "${escapeText(skill.provider)}".`,
      "Load referenced resources only as needed.",
    ];
  }
  switch (base.kind) {
    case "directory":
      return [
        `Base directory for this skill: ${escapeText(base.path)}`,
        "Resolve relative paths mentioned by this skill against the base directory before using them. Load referenced resources only as needed.",
      ];
    case "url":
      return [
        `Base URL for this skill: ${escapeText(base.url)}`,
        "Resolve relative URLs mentioned by this skill against the base URL before using them. Load referenced resources only as needed.",
      ];
    case "opaque":
      return [
        `Resources for this skill: ${escapeText(base.description)}`,
        "Load referenced resources only as needed.",
      ];
    default:
      // SkillResourceBase 是封闭联合；将来新增分支必须在此处编译失败。
      return assertNever(base, "SkillResourceBase.kind");
  }
}

function escapeAttr(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

/**
 * 转义嵌入 Skill 标记里的模型侧文本，防止 Provider 提供的文本开合框架标签。
 * @param value - 待嵌入的原始文本。
 * @returns 转义后的文本。
 */
export function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** 一次目录观察加上发现是否在稳定目录版本内完成的标记。 */
export interface SkillCatalogSnapshot {
  /** 本次观察收集到的、已排序的与调用开关无关的摘要。 */
  readonly skills: SkillSummary[];
  /** 每个已注册 Provider 都完成且期间目录版本未变化。 */
  readonly complete: boolean;
}

/** Provider 候选加上当前发现是否权威的标记。 */
export interface SkillProviderObservation {
  /** 当前 Provider 发现产出的候选。 */
  readonly candidates: readonly SkillCandidate[];
  /** 发现已完成、这些候选可缓存。 */
  readonly complete: boolean;
}

/** Skill 来源之一的 Provider 接口（本地目录、远程仓库等）。 */
export interface SkillProvider {
  /** ctx.skills 注册表内唯一的 Provider 名。 */
  readonly name: string;
  /**
   * 列出当前查找上下文可用的 Skill 候选。Provider 插件在 apply() 期间同步注册；
   * 远程初始化、鉴权与发现在本方法内 await。options.signal 中止时应尽快收尾。
   * @param options - cwd 选择工作区敏感 Skill，signal 取消工作。
   * @returns 候选完整数组简写，或发现未完成但已有可用候选时的显式 observation。
   */
  readonly list: (options: SkillLookupOptions) => Promise<readonly SkillCandidate[] | SkillProviderObservation>;
  /**
   * 为此前 list 过的候选加载完整 Skill 正文。
   * @param candidate - 本 Provider 此前返回的 winner 候选。
   * @param options - cwd 选择工作区敏感 Skill，signal 取消工作。
   * @returns 完整 Skill；文件已不可加载时返回 undefined。
   */
  readonly get: (candidate: SkillCandidate, options: SkillLookupOptions) => Promise<SkillDefinition | undefined>;
}

/** 借发给单个 Provider 的注册级生命周期与失效能力。 */
export interface SkillProviderControl {
  /** 注册失败或该 Provider 注册被销毁时中止。 */
  readonly signal: AbortSignal;
  /** 仅当该注册仍然存活时使已完成目录失效并通知消费方。 */
  readonly invalidate: () => void;
}

/** Skill 注册表配置。 */
export interface Config {
  /** 内存中保留的已完成 cwd/Provider 目录缓存条数上限。 */
  readonly collectCacheMaxEntries?: number;
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Skill Provider 注册表：合并目录、解析 winner、按需加载正文。 */
    skills: SkillRegistry;
  }

  interface Events {
    /**
     * Skill Provider、运行时注入或 Provider 目录可能已变化。
     * 这是一条未过滤的失效通知；消费方按自己的查找选项重新拉取目录。
     * 监听器失败被 containment，不能否决注册表变更。
     * @mode emit
     */
    "skills/change"(): void;
  }
}

interface IndexedCandidate {
  candidate: SkillCandidate;
  provider: SkillProvider;
  providerOrder: number;
  localOrder: number;
}

/** 一张全局层上保留的 Provider 注册。 */
interface RegisteredProvider {
  provider: SkillProvider;
  /** 服务级单调注册顺序，作为层内 rank 并列时的次序。 */
  order: number;
}

interface LayerCollectResult {
  entries: IndexedCandidate[];
  cacheable: boolean;
}

interface CollectResult {
  entries: Map<string, IndexedCandidate>;
  cacheable: boolean;
}

/**
 * Skill Provider 的分层注册表。
 *
 * LFAA 当前为全局单层（与 DSH 按 preset 分层的差异见文件头）：所有 Provider 与运行时
 * Skill 登记在同一张表里，收集时按 Provider 内返回顺序、再按注册顺序排序，
 * 同一名字的候选按 rank 最小者胜出。注册表对外暴露排序后的、与调用开关无关的摘要，
 * 并按需加载完整正文。
 */
export class SkillRegistry extends Service {
  static Config: Schema<Config> = z.object({
    collectCacheMaxEntries: z.number().default(DEFAULT_COLLECT_CACHE_ENTRIES),
  });

  private readonly collectCacheMaxEntries: number;
  /** 全局层：Provider 注册表（插入序）与运行时 Skill 表。 */
  private readonly providers = new Map<string, RegisteredProvider>();
  private readonly runtime = new Map<string, SkillDefinition>();
  private readonly collectCache = new Map<string, Map<string, IndexedCandidate>>();
  private revision = 0;
  private nextProviderOrder = 0;

  constructor(ctx: Context, config: Config = {}) {
    super(ctx, "skills");
    this.collectCacheMaxEntries = config.collectCacheMaxEntries ?? DEFAULT_COLLECT_CACHE_ENTRIES;
    assertPositiveInteger("collectCacheMaxEntries", this.collectCacheMaxEntries);
  }

  /**
   * 在插件 apply 期间同步注册一个同进程 Provider，登记进全局层。
   * 重名 Provider 与保留名会抛错；远程初始化属于 list()。Fiber 销毁时自动注销 Provider
   * 并失效目录缓存。
   * @param create - 接收本次注册生命周期/失效控制的同步工厂。
   * @returns Cordis effect 销毁函数：调用即注销该 Provider。
   */
  registerProvider(create: (control: SkillProviderControl) => SkillProvider): () => void {
    const lifecycle = new AbortController();
    let registration: { name: string } | undefined;
    let provider!: SkillProvider;
    const control: SkillProviderControl = {
      signal: lifecycle.signal,
      invalidate: () => {
        const active = registration;
        if (active !== undefined && this.providers.get(active.name)?.provider === provider) {
          this.invalidateCache();
        }
      },
    };
    try {
      provider = create(control);
      const name = provider.name;
      if (name === RUNTIME_PROVIDER) {
        throw new Error(`"${RUNTIME_PROVIDER}" is reserved for runtime skill registrations`);
      }
      if (this.providers.has(name)) {
        throw new Error(`a skill provider named "${name}" is already registered`);
      }
      const order = this.nextProviderOrder;
      this.nextProviderOrder += 1;
      this.providers.set(name, { provider, order });
      // 与 DSH 一致：Provider 表变更后失效已缓存目录，晚于首次 list 的注册也能被下一次 list 看到。
      this.invalidateCache();
      registration = { name };
      // cordis effect 语义：传入函数的返回值才是 Fiber 销毁时的 disposer；body 本身在注册时立即执行。
      this.ctx.effect(() => {
        return () => {
          registration = undefined;
          if (this.providers.get(name)?.provider === provider) {
            this.providers.delete(name);
          }
          lifecycle.abort(new Error(`skill provider "${name}" disposed`));
          this.invalidateCache();
        };
      }, "skills.registerProvider()");
      return () => {
        // 手动撤销：ctx.effect 已注册的销毁函数由 Fiber 统一管理，这里只触发注销。
        if (registration?.name === name) {
          this.providers.delete(name);
          registration = undefined;
          lifecycle.abort(new Error(`skill provider "${name}" disposed`));
          this.invalidateCache();
        }
      };
    } catch (error) {
      lifecycle.abort(error);
      throw error;
    }
  }

  /**
   * 登记一个只读运行时 Skill。项目条目优先于运行时条目，运行时条目优先于用户条目。
   * 同一全局层内重名运行时 Skill 先注册者胜；后注册者记警告并拿到空销毁函数，
   * 不能移除 winner。
   * @param skill - Skill 定义输入；省略的 invocation/provider 字段使用默认值。
   * @returns Cordis effect 销毁函数，保持复合拆卸顺序并失效缓存。
   */
  register(skill: SkillRegistration): () => void {
    validateRuntimeSkill(skill);
    if (this.runtime.has(skill.name)) {
      this.ctx.logger.warn(`runtime skill "${skill.name}" ignored because it is already registered`);
      return () => {};
    }
    const definition: SkillDefinition = {
      ...skill,
      invocation: skill.invocation ?? { modelInvocable: true, userInvocable: true },
      provider: skill.provider ?? RUNTIME_PROVIDER,
    };
    this.runtime.set(definition.name, definition);
    this.invalidateCache();
    return () => {
      if (this.runtime.get(definition.name) === definition) {
        this.runtime.delete(definition.name);
        this.invalidateCache();
      }
    };
  }

  /**
   * 列出某个工作区与调用开关无关的 Skill 摘要。消费方在自己的业务边界再施加模型/人工开关。
   * @param options - cwd 选择项目根，signal 取消发现。
   * @returns 全部排序后的 winner 摘要。
   */
  async list(options: SkillViewOptions = {}): Promise<SkillSummary[]> {
    return (await this.snapshot(options)).skills;
  }

  /**
   * 观察当前与调用开关无关的目录，以及发现是否在稳定版本内完成。
   * 未完成的观察永不缓存，消费方可保留上次良好状态并在下次请求边界重试。
   * @param options - cwd 选择项目根，signal 取消发现。
   * @returns 排序后的摘要加发现完成状态。
   */
  async snapshot(options: SkillViewOptions = {}): Promise<SkillCatalogSnapshot> {
    const collected = await this.collect(options);
    return {
      skills: [...collected.entries.values()]
        .map((entry) => toSummary(entry.candidate))
        .sort(compareSkillSummary),
      complete: collected.cacheable,
    };
  }

  /**
   * 加载并校验 winner 候选，把它的不透明 locator 回传给 Provider。
   * 选中后（含缓存命中）复查取消信号，并与加载竞速，防止不配合的 Provider 挂死调用方。
   * @param name - kebab-case Skill 名。
   * @param options - cwd 选择工作区敏感 Skill，signal 取消工作。
   * @returns 完整 Skill（含正文）；不存在时返回 undefined。
   */
  async get(name: string, options: SkillViewOptions = {}): Promise<SkillDefinition | undefined> {
    if (!isSkillName(name)) return undefined;
    const collected = await this.collect(options);
    throwIfAborted(options.signal);
    const match = collected.entries.get(name);
    if (match === undefined) return undefined;
    const definition = await waitWithAbort(
      match.provider.get(match.candidate, options),
      options.signal,
    );
    if (definition === undefined) return undefined;
    validateDefinition(definition);
    if (definition.name !== match.candidate.name) {
      this.invalidateEntry(match);
      return undefined;
    }
    return definition;
  }

  private async collect(options: SkillViewOptions): Promise<CollectResult> {
    throwIfAborted(options.signal);
    let attempt = 1;
    while (true) {
      const revision = this.revision;
      // 缓存键带 revision：任何 invalidate 都会换键，旧缓存自然失效。
      const key = this.collectCacheKey(options, revision);
      const cached = this.collectCache.get(key);
      if (cached !== undefined) return { entries: cached, cacheable: true };

      const result = await this.collectFresh(options);
      throwIfAborted(options.signal);
      if (revision !== this.revision) {
        if (attempt < MAX_COLLECT_ATTEMPTS) {
          attempt += 1;
          continue;
        }
        return { entries: result.entries, cacheable: false };
      }
      if (result.cacheable) {
        this.collectCache.set(key, result.entries);
        if (this.collectCache.size > this.collectCacheMaxEntries) {
          const oldest = this.collectCache.keys().next() as IteratorYieldResult<string>;
          this.collectCache.delete(oldest.value);
        }
      }
      return result;
    }
  }

  private async collectFresh(options: SkillViewOptions): Promise<CollectResult> {
    // LFAA 全局单层：直接收集全局层，合并同名为 winner。
    const collected = await this.collectLayer(options);
    const merged = new Map<string, IndexedCandidate>();
    for (const entry of collected.entries) merged.set(entry.candidate.name, entry);
    return { entries: merged, cacheable: collected.cacheable };
  }

  private async collectLayer(options: SkillLookupOptions): Promise<LayerCollectResult> {
    const collected = await this.listLayerCandidates(options);
    collected.entries.sort(compareIndexedCandidates);
    const seen = new Set<string>();
    const result: IndexedCandidate[] = [];
    for (const entry of collected.entries) {
      const skill = entry.candidate;
      if (seen.has(skill.name)) {
        this.ctx.logger.warn(`skill "${skill.name}" from ${skill.source} ignored because a higher-priority skill already exists`);
        continue;
      }
      seen.add(skill.name);
      result.push(entry);
    }
    return { entries: result, cacheable: collected.cacheable };
  }

  private async listLayerCandidates(options: SkillLookupOptions): Promise<LayerCollectResult> {
    throwIfAborted(options.signal);
    const candidates: IndexedCandidate[] = [];
    let cacheable = true;
    let runtimeOrder = 0;
    // 运行时 Skill 按名字排序后注入，固定 rank=250。
    for (const skill of [...this.runtime.values()].sort((a, b) => compareCodePoints(a.name, b.name))) {
      candidates.push({
        candidate: runtimeCandidate(skill),
        provider: RUNTIME_SKILL_PROVIDER,
        providerOrder: -1,
        localOrder: runtimeOrder,
      });
      runtimeOrder += 1;
    }
    for (const { provider, order } of [...this.providers.values()]) {
      let localOrder = 0;
      let output: unknown;
      try {
        output = await waitWithAbort(provider.list(options), options.signal);
      } catch (error) {
        if (options.signal?.aborted === true) throw toError(options.signal.reason);
        cacheable = false;
        this.ctx.logger.warn(`skill provider "${provider.name}" skipped: ${errorMessage(error)}`);
      }
      if (output === undefined) continue;
      const observation = normalizeProviderObservation(output, provider.name);
      if (!observation.complete) cacheable = false;
      for (const candidate of observation.candidates) {
        validateCandidate(candidate, provider.name);
        candidates.push({ candidate, provider, providerOrder: order, localOrder });
        localOrder += 1;
      }
    }
    return { entries: candidates, cacheable };
  }

  private invalidateCache(): void {
    this.revision += 1;
    this.collectCache.clear();
    this.notifyChange();
  }

  /** 加载到陈旧定义后失效；仅当产出该条目的确切 Provider 注册仍然存活时。 */
  private invalidateEntry(entry: IndexedCandidate): void {
    if (this.providers.get(entry.provider.name)?.provider === entry.provider) this.invalidateCache();
  }

  private collectCacheKey(options: SkillLookupOptions, revision: number): string {
    return JSON.stringify({ cwd: options.cwd, userId: options.userId, customSkillDirs: options.customSkillDirs, allowHostFilesystem: options.allowHostFilesystem, revision });
  }

  /** 通知目录观察者，但不让他们的刷新工作成为负担。 */
  private notifyChange(): void {
    for (const callback of this.ctx.events.dispatch("emit", ["skills/change"])) {
      try {
        const returned: unknown = callback();
        void Promise.resolve(returned).catch((error: unknown) => {
          this.ctx.logger.warn(`skills/change listener rejected: ${errorMessage(error)}`);
        });
      } catch (error) {
        this.ctx.logger.warn(`skills/change listener threw: ${errorMessage(error)}`);
      }
    }
  }
}

function normalizeProviderObservation(output: unknown, providerName: string): SkillProviderObservation {
  if (Array.isArray(output)) {
    return { candidates: output as readonly SkillCandidate[], complete: true };
  }
  if (output === null || typeof output !== "object") {
    throw invalidProviderObservation(providerName);
  }
  const observation = output as Partial<SkillProviderObservation>;
  if (!Array.isArray(observation.candidates) || typeof observation.complete !== "boolean") {
    throw invalidProviderObservation(providerName);
  }
  return observation as SkillProviderObservation;
}

function invalidProviderObservation(providerName: string): TypeError {
  return new TypeError(`skill provider "${providerName}" list() must return an array or { candidates, complete } observation`);
}

const RUNTIME_SKILL_PROVIDER: SkillProvider = {
  name: RUNTIME_PROVIDER,
  // 运行时 Skill 由注册表直接注入；这个 Provider 只负责 get()。
  list() {
    return Promise.resolve([]);
  },
  get(candidate) {
    return Promise.resolve(candidate.locator as SkillDefinition);
  },
};

function runtimeCandidate(skill: SkillDefinition): SkillCandidate {
  return {
    name: skill.name,
    description: skill.description,
    ...skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {},
    invocation: skill.invocation,
    source: skill.source,
    provider: skill.provider,
    ...skill.resourceBase !== undefined ? { resourceBase: skill.resourceBase } : {},
    rank: RUNTIME_RANK,
    locator: skill,
    ...skill.path !== undefined ? { path: skill.path } : {},
    ...skill.metadata !== undefined ? { metadata: skill.metadata } : {},
  };
}

function validateCandidate(candidate: SkillCandidate, providerName: string): void {
  if (typeof candidate.name !== "string") {
    throw new TypeError(`skill provider "${providerName}" returned a non-string skill name`);
  }
  if (!SKILL_NAME.test(candidate.name)) {
    throw new Error(`skill provider "${providerName}" returned invalid skill name "${candidate.name}"`);
  }
  if (typeof candidate.description !== "string") {
    throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string description`);
  }
  if (candidate.description.length === 0) {
    throw new Error(`skill provider "${providerName}" returned skill "${candidate.name}" without a description`);
  }
  validateInvocation(candidate.invocation, `skill provider "${providerName}" returned skill "${candidate.name}"`);
  if (candidate.whenToUse !== undefined && typeof candidate.whenToUse !== "string") {
    throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string whenToUse`);
  }
  if (typeof candidate.source !== "string") {
    throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string source`);
  }
  if (typeof candidate.rank !== "number" || !Number.isFinite(candidate.rank)) {
    throw new Error(`skill provider "${providerName}" returned skill "${candidate.name}" with an invalid rank`);
  }
  if (typeof candidate.provider !== "string") {
    throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string provider`);
  }
  if (candidate.provider !== providerName) {
    throw new Error(`skill provider "${providerName}" returned skill "${candidate.name}" for provider "${candidate.provider}"`);
  }
  if (candidate.path !== undefined && typeof candidate.path !== "string") {
    throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string path`);
  }
}

function validateRuntimeSkill(skill: SkillRegistration): void {
  if (!SKILL_NAME.test(skill.name)) throw new Error(`invalid skill name "${skill.name}"`);
  if (skill.description.length === 0) throw new Error(`skill "${skill.name}" requires a description`);
  validateInvocation(skill.invocation, `runtime skill "${skill.name}"`);
}

/** 校验从 Provider 控制的解析器或远程源加载出的定义。 */
function validateDefinition(skill: SkillDefinition): void {
  const name = skill.name;
  const description = skill.description;
  const whenToUse = skill.whenToUse;
  const invocation = skill.invocation;
  const source = skill.source;
  const provider = skill.provider;
  const content = skill.content;
  const path = skill.path;
  if (typeof name !== "string") throw new TypeError("loaded skill name must be a string");
  if (!SKILL_NAME.test(name)) throw new Error(`loaded skill has invalid name "${name}"`);
  if (typeof description !== "string") throw new TypeError(`loaded skill "${name}" description must be a string`);
  if (description.length === 0) throw new Error(`loaded skill "${name}" requires a description`);
  validateInvocation(invocation, `loaded skill "${name}"`);
  if (whenToUse !== undefined && typeof whenToUse !== "string") throw new TypeError(`loaded skill "${name}" whenToUse must be a string`);
  if (typeof source !== "string") throw new TypeError(`loaded skill "${name}" source must be a string`);
  if (typeof provider !== "string") throw new TypeError(`loaded skill "${name}" provider must be a string`);
  if (typeof content !== "string") throw new TypeError(`loaded skill "${name}" content must be a string`);
  if (path !== undefined && typeof path !== "string") throw new TypeError(`loaded skill "${name}" path must be a string`);
}

function toSummary(skill: SkillDefinition | SkillCandidate): SkillSummary {
  const { name, description, whenToUse, invocation, source, provider, resourceBase } = skill;
  return {
    name,
    ...skill.path === undefined ? {} : { path: skill.path },
    description,
    ...whenToUse !== undefined ? { whenToUse } : {},
    invocation,
    source,
    provider,
    ...resourceBase !== undefined ? { resourceBase } : {},
  };
}

function validateInvocation(invocation: unknown, subject: string): void {
  if (invocation === undefined) return;
  if (typeof invocation !== "object" || invocation === null || Array.isArray(invocation)) {
    throw new TypeError(`${subject} with a non-object invocation policy`);
  }
  const policy = invocation as Record<string, unknown>;
  if (typeof policy.modelInvocable !== "boolean") {
    throw new TypeError(`${subject} with a non-boolean invocation.modelInvocable`);
  }
  if (typeof policy.userInvocable !== "boolean") {
    throw new TypeError(`${subject} with a non-boolean invocation.userInvocable`);
  }
}

function compareSkillSummary(left: SkillSummary, right: SkillSummary): number {
  return compareCodePoints(left.name, right.name);
}

function compareCodePoints(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareIndexedCandidates(left: IndexedCandidate, right: IndexedCandidate): number {
  return left.candidate.rank - right.candidate.rank
    || left.providerOrder - right.providerOrder
    || left.localOrder - right.localOrder;
}

function assertPositiveInteger(name: string, value: number, minimum = 1): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`skill: ${name} must be an integer greater than or equal to ${minimum}`);
  }
}

/** lfaa-util-values 未导出 assertNever，本包自带：封闭联合不应到达默认分支。 */
function assertNever(value: never, field: string): never {
  throw new Error(`unexpected ${field}: ${JSON.stringify(value)}`);
}

function waitWithAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) return promise;
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const cleanup = (): void => {
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = (): void => {
      cleanup();
      reject(toError(signal.reason));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    void promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(toError(error));
      },
    );
  });
}

/** 对已经中止的查找抛出一个总 Error。 */
function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw toError(signal.reason);
}

/** 不依赖强制转换地规范化任意中止或 Provider 失败。 */
function toError(error: unknown): Error {
  try {
    if (error instanceof Error) return error;
  } catch {
    // 恶意代理可能在 instanceof 时抛错；落到总渲染。
  }
  return new Error(errorMessage(error));
}

/** 渲染任意 Provider 失败，不让强制转换逃逸 containment。 */
function errorMessage(error: unknown): string {
  try {
    return String(error);
  } catch {
    return "[unrenderable thrown value]";
  }
}

export default SkillRegistry;

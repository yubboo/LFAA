// @lfaa/agent-profile 契约：agent 定义、模型绑定与生效优先级所需的类型、常量与纯函数。
// 只放类型与不依赖文件系统的归一化逻辑，便于 Web 侧与测试直接复用。
import { randomUUID } from "node:crypto";

/** agent 的用途标记：assistant 偏个人助手（默认出现在首页单聊），worker 偏干活。 */
export type AgentKind = "assistant" | "worker";

/** agent 来源：内置、用户自建、外部导入。内置项不可删除。 */
export type AgentSource = "builtin" | "user" | "imported";

/** 路由策略：单目标、按序、轮流、用量最少优先。 */
export type BindingStrategy = "single" | "order" | "rotate" | "usage";

/** 目标失败后的处理：换下一个目标，或直接失败。 */
export type BindingOnError = "next" | "fail";

/** 绑定里的一个候选目标；解析时据此找模型配置与具体模型。 */
export interface BindingTarget {
  /** 必须指向已存在的模型配置（llm profile），真正校验发生在解析阶段。 */
  profileId: string;
  /** 缺省表示沿用该配置当前选中的模型。 */
  modelId?: string;
}

/** agent 可用的工具边界；语义由现有权限策略解释，这里只负责存。 */
export interface AgentToolPolicy {
  allow?: string[];
  deny?: string[];
}

/** 一个可添加、可复用的 agent 定义。 */
export interface AgentDefinition {
  id: string;
  name: string;
  kind: AgentKind;
  source: AgentSource;
  description?: string;
  /** 图标 key，复用 ui-icons 的命名。 */
  icon?: string;
  /** 追加到系统提示的指令；缺省表示不加任何内容，行为与改造前一致。 */
  instructions?: string;
  /** append 追加到既有系统提示之后（默认）；replace 作为显式替换，第一版界面不暴露。 */
  instructionsMode?: "append" | "replace";
  skillIds?: string[];
  toolPolicy?: AgentToolPolicy;
  /** 默认模型绑定 id；缺省回落到内置 default 绑定。 */
  bindingId?: string;
  /** 可选：绑定本机官方 CLI 代理 id（如 claude / codex / agy）；填写后优先走外部 CLI 执行。 */
  cliAgentId?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/** 模型绑定：targets 只有一项就是「单模型」，多项就是「路由组」，不区分两套结构。 */
export interface ModelBinding {
  id: string;
  name: string;
  strategy: BindingStrategy;
  /** 有序候选；inheritGlobal 为 true 时忽略本字段（内置 default 专用）。 */
  targets: BindingTarget[];
  onError: BindingOnError;
  /** 目标失败后在本次运行内的冷却时长，毫秒。 */
  cooldownMs?: number;
  /** 仅内置 default：跟随全局 activeProfileId，避免写死一个可能被删掉的配置 id。 */
  inheritGlobal?: boolean;
  builtin?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** 新建 agent 的入参；id 缺省时生成 UUID。 */
export interface AgentCreateInput {
  id?: string;
  name: string;
  kind?: AgentKind;
  description?: string;
  icon?: string;
  instructions?: string;
  instructionsMode?: "append" | "replace";
  skillIds?: string[];
  toolPolicy?: AgentToolPolicy;
  bindingId?: string;
  cliAgentId?: string;
  enabled?: boolean;
  source?: AgentSource;
}

/** 更新 agent 的入参；只覆盖出现的字段。 */
export interface AgentUpdateInput {
  name?: string;
  kind?: AgentKind;
  description?: string;
  icon?: string;
  instructions?: string;
  instructionsMode?: "append" | "replace";
  skillIds?: string[];
  toolPolicy?: AgentToolPolicy;
  bindingId?: string;
  cliAgentId?: string;
  enabled?: boolean;
}

/** 新建绑定的入参。 */
export interface BindingCreateInput {
  id?: string;
  name: string;
  strategy?: BindingStrategy;
  targets: BindingTarget[];
  onError?: BindingOnError;
  cooldownMs?: number;
}

/** 更新绑定的入参；只覆盖出现的字段。 */
export interface BindingUpdateInput {
  name?: string;
  strategy?: BindingStrategy;
  targets?: BindingTarget[];
  onError?: BindingOnError;
  cooldownMs?: number;
}

/** 导入导出用的快照：agent 与绑定的完整内容，内置项也在内。 */
export interface AgentProfileSnapshot {
  version: 1;
  exportedAt: number;
  agents: AgentDefinition[];
  bindings: ModelBinding[];
}

/** 内置 agent（小鱼）的固定 id：单聊默认对象，也是群聊的默认代理人。 */
export const BUILTIN_AGENT_ID = "xiaoyu";
/** 内置 agent 的显示名。 */
export const BUILTIN_AGENT_NAME = "小鱼";
/** 内置默认绑定的固定 id。 */
export const DEFAULT_BINDING_ID = "default";
/** 内置默认绑定的显示名。 */
export const DEFAULT_BINDING_NAME = "默认模型";

/** 名称长度上限，避免侧栏与选择器被撑破。 */
export const MAX_AGENT_NAME = 60;
/** 指令长度上限，防止把整份文件塞进配置。 */
export const MAX_INSTRUCTIONS = 20_000;
/** 单个绑定的目标数量上限。 */
export const MAX_BINDING_TARGETS = 8;

const AGENT_KINDS: readonly AgentKind[] = ["assistant", "worker"];
const AGENT_SOURCES: readonly AgentSource[] = ["builtin", "user", "imported"];
const BINDING_STRATEGIES: readonly BindingStrategy[] = ["single", "order", "rotate", "usage"];
const BINDING_ON_ERROR: readonly BindingOnError[] = ["next", "fail"];

/** 解析 agent 用途；非法值回落到 worker（干活优先，不冒充个人助手）。 */
export function normalizeAgentKind(raw: unknown): AgentKind {
  return typeof raw === "string" && (AGENT_KINDS as readonly string[]).includes(raw) ? raw as AgentKind : "worker";
}

/** 解析 agent 来源；非法值回落到 user。 */
export function normalizeAgentSource(raw: unknown): AgentSource {
  return typeof raw === "string" && (AGENT_SOURCES as readonly string[]).includes(raw) ? raw as AgentSource : "user";
}

/** 解析路由策略；非法值回落到 single。 */
export function normalizeBindingStrategy(raw: unknown): BindingStrategy {
  return typeof raw === "string" && (BINDING_STRATEGIES as readonly string[]).includes(raw)
    ? raw as BindingStrategy
    : "single";
}

/** 解析失败处理策略；非法值回落到 next（宁可换目标也不让用户白等）。 */
export function normalizeBindingOnError(raw: unknown): BindingOnError {
  return typeof raw === "string" && (BINDING_ON_ERROR as readonly string[]).includes(raw)
    ? raw as BindingOnError
    : "next";
}

/** 生成新 id；调用方可显式传入但必须通过格式校验。 */
export function createAgentId(): string {
  return randomUUID();
}

/** id 只允许小写字母、数字、下划线与连字符，且不能以符号开头。 */
export function isValidProfileId(id: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/u.test(id);
}

/** 归一化名称：去空白并截断到上限；空名称返回空串，由调用方决定是否报错。 */
export function normalizeName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, MAX_AGENT_NAME);
}

/** 归一化指令文本：去首尾空白并截断；空串视为未填。 */
export function normalizeInstructions(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, MAX_INSTRUCTIONS);
}

/** 归一化字符串数组：去空白、去重、丢弃非法项，保持输入顺序。 */
export function normalizeStringList(raw: unknown, limit = 64): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const value = item.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

/** 归一化绑定目标：丢弃没有 profileId 的项、去重、截断到上限。 */
export function normalizeTargets(raw: unknown): BindingTarget[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: BindingTarget[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as { profileId?: unknown; modelId?: unknown };
    const profileId = typeof record.profileId === "string" ? record.profileId.trim() : "";
    if (!profileId) continue;
    const modelId = typeof record.modelId === "string" ? record.modelId.trim() : "";
    const key = `${profileId}\u0000${modelId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(modelId ? { profileId, modelId } : { profileId });
    if (out.length >= MAX_BINDING_TARGETS) break;
  }
  return out;
}

/**
 * 解析本次运行应使用的绑定 id，优先级为：
 * 会话临时覆盖 > agent 自身绑定 > 内置 default。
 * 群聊里成员各自的绑定由调用方按成员逐个解析，不在此展开。
 */
export function resolveBindingIdFor(
  agent: Pick<AgentDefinition, "bindingId"> | undefined,
  overrideId?: string,
): string {
  const override = overrideId?.trim();
  if (override) return override;
  const own = agent?.bindingId?.trim();
  return own || DEFAULT_BINDING_ID;
}

/** 该绑定是否跟随全局 activeProfileId；只有内置 default 允许。 */
export function isInheritGlobal(binding: Pick<ModelBinding, "id" | "inheritGlobal"> | undefined): boolean {
  return Boolean(binding && binding.inheritGlobal && binding.id === DEFAULT_BINDING_ID);
}

/** 内置小鱼的初始定义：不带任何指令与工具边界，保证改造前后行为一致。 */
export function createBuiltinAgent(now = Date.now()): AgentDefinition {
  return {
    id: BUILTIN_AGENT_ID,
    name: BUILTIN_AGENT_NAME,
    kind: "assistant",
    source: "builtin",
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** 内置默认绑定：不写死 profileId，运行时跟随全局选中配置。 */
export function createDefaultBinding(now = Date.now()): ModelBinding {
  return {
    id: DEFAULT_BINDING_ID,
    name: DEFAULT_BINDING_NAME,
    strategy: "single",
    targets: [],
    onError: "fail",
    inheritGlobal: true,
    builtin: true,
    createdAt: now,
    updatedAt: now,
  };
}
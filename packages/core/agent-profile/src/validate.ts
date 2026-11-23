// @lfaa/agent-profile 入参校验：把「能被界面传进来的东西」挡在落盘之前，错误文案直接可展示。
// 只做结构与边界校验；profile 是否真实存在、模型是否可用属于解析阶段，不在这里强绑。
import {
  MAX_BINDING_TARGETS,
  MAX_INSTRUCTIONS,
  isValidProfileId,
  normalizeName,
  normalizeTargets,
  type BindingTarget,
} from "./types";

/** 校验 agent 名称：去空白后非空且不超上限，返回归一化后的名称。 */
export function requireAgentName(raw: unknown): string {
  const name = normalizeName(raw);
  if (!name) throw new Error("agent 名称不能为空。");
  return name;
}

/** 校验外部传入的 id 格式；不合法直接拒绝，避免生成出来打不开的引用。 */
export function requireAgentId(raw: string): string {
  const id = raw.trim();
  if (!isValidProfileId(id)) {
    throw new Error("agent id 只能包含小写字母、数字、下划线与连字符，且需以字母或数字开头。");
  }
  return id;
}

/** 校验指令长度；超限拒绝而不是静默截断，避免用户以为存进去了。 */
export function requireInstructions(raw: unknown): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") throw new Error("agent 指令必须是文本。");
  const text = raw.trim();
  if (text.length > MAX_INSTRUCTIONS) {
    throw new Error(`agent 指令过长（上限 ${MAX_INSTRUCTIONS} 字符）。`);
  }
  return text || undefined;
}

/**
 * 校验绑定目标：
 * 1. 目标数量在 1–MAX_BINDING_TARGETS 之间（内置 default 的「跟随全局」不走这里）；
 * 2. 必须有 profileId；
 * 3. 单目标策略（single）只允许一个目标——多目标请明确选 order / rotate / usage。
 */
export function requireTargets(raw: unknown, strategy: string): BindingTarget[] {
  const targets = normalizeTargets(raw);
  if (targets.length === 0) throw new Error("模型绑定至少需要一个目标。");
  if (targets.length > MAX_BINDING_TARGETS) {
    throw new Error(`模型绑定最多 ${MAX_BINDING_TARGETS} 个目标。`);
  }
  const dropped = Array.isArray(raw) ? raw.length - targets.length : 0;
  if (dropped > 0) throw new Error("模型绑定里有无效或重复的目标，请检查 profile 是否填写。");
  if (strategy === "single" && targets.length > 1) {
    throw new Error("单模型策略只能有一个目标；需要多个目标请选择按序、轮流或用量最少优先。");
  }
  return targets;
}

/** 校验冷却时长：0 表示显式清除冷却，正数毫秒需 ≤ 10 分钟，其余拒绝。 */
export function requireCooldown(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error("冷却时长必须是非负毫秒数。");
  if (value === 0) return 0;
  return Math.min(600_000, Math.floor(value));
}
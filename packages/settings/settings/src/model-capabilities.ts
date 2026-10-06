/**
 * 功能：校验 AI Provider 模型目录返回的思考力度能力。
 * 作用：保留有来源的模型级推理档位，过滤停用/未知档位，并提供账户参数校验所需的纯函数。
 * 关联文件：settings 服务保存模型目录，Agent Runtime 应用账户参数，客户端设置与模型卡片展示同一目录结果。
 */
export const PROVIDER_MODEL_CAPABILITY_SOURCE = "provider-model-catalog" as const;

const disabledEffortValues = new Set(["none", "off", "disabled"]);

export type AiModelThinkingControl =
  | { kind: "effort"; parameter: "reasoning_effort"; values: string[]; defaultValue?: string }
  | { kind: "toggle"; parameter: "thinking"; values: Array<"enabled" | "disabled">; defaultValue?: "enabled" | "disabled" }
  | { kind: "fixed"; value: string };

export interface AiModelCatalogEntry {
  id: string;
  name: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  thinking: AiModelThinkingControl | null;
  thinkingSource: typeof PROVIDER_MODEL_CAPABILITY_SOURCE | null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function effortValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string"
    && /^[a-z][a-z0-9_-]{0,31}$/u.test(item)
    && !disabledEffortValues.has(item)))];
}

/** 只读取 Provider 模型目录中明确返回的 effort.supported_levels，不根据模型名称推测能力。 */
export function normalizeProviderModelThinking(rawModel: Record<string, unknown>): AiModelThinkingControl | null {
  const effort = recordValue(rawModel.effort);
  if (!effort) return null;
  const values = effortValues(effort.supported_levels);
  if (!values.length) return null;
  const defaultValue = typeof effort.default_level === "string" && values.includes(effort.default_level)
    ? effort.default_level
    : undefined;
  return { kind: "effort", parameter: "reasoning_effort", values, ...(defaultValue ? { defaultValue } : {}) };
}

/** 读取账户目录中的受信元数据；兼容旧版 DeepSeek 目录，因为旧实现只从官方 effort 字段构造该能力。 */
export function normalizeStoredModelThinking(
  value: unknown,
  source: unknown,
  allowLegacyDeepSeekCatalog: boolean
): { thinking: AiModelThinkingControl | null; thinkingSource: typeof PROVIDER_MODEL_CAPABILITY_SOURCE | null } {
  const raw = recordValue(value);
  const trustedSource = source === PROVIDER_MODEL_CAPABILITY_SOURCE;
  const legacyDeepSeekSource = allowLegacyDeepSeekCatalog
    && raw?.kind === "effort"
    && raw.parameter === "reasoning_effort"
    && effortValues(raw.values).length > 0;
  if (!raw || (!trustedSource && !legacyDeepSeekSource)) return { thinking: null, thinkingSource: null };

  if (raw.kind === "effort" && raw.parameter === "reasoning_effort") {
    const values = effortValues(raw.values);
    if (!values.length) return { thinking: null, thinkingSource: null };
    const defaultValue = typeof raw.defaultValue === "string" && values.includes(raw.defaultValue) ? raw.defaultValue : undefined;
    return {
      thinking: { kind: "effort", parameter: "reasoning_effort", values, ...(defaultValue ? { defaultValue } : {}) },
      thinkingSource: PROVIDER_MODEL_CAPABILITY_SOURCE
    };
  }

  if (raw.kind === "toggle" && raw.parameter === "thinking" && Array.isArray(raw.values) && raw.values.includes("enabled")) {
    return {
      thinking: { kind: "toggle", parameter: "thinking", values: ["enabled"], defaultValue: "enabled" },
      thinkingSource: PROVIDER_MODEL_CAPABILITY_SOURCE
    };
  }

  if (raw.kind === "fixed" && (raw.value === "enabled" || typeof raw.value === "string"
    && /^[a-z][a-z0-9_-]{0,31}$/u.test(raw.value) && !disabledEffortValues.has(raw.value))) {
    return {
      thinking: { kind: "fixed", value: raw.value as string },
      thinkingSource: PROVIDER_MODEL_CAPABILITY_SOURCE
    };
  }

  return { thinking: null, thinkingSource: null };
}

export function selectableReasoningValues(control: AiModelThinkingControl | null): string[] {
  if (control?.kind === "effort") return effortValues(control.values);
  if (control?.kind === "toggle" && control.values.includes("enabled")) return ["enabled"];
  return [];
}

/** 新账户默认不覆盖 Provider 自己给出的实际思考默认值。 */
export function defaultReasoningMode(_control: AiModelThinkingControl | null): string {
  return "default";
}

/** 旧账户记录若保存了已移除或当前模型不支持的值，读取时恢复 Provider 默认行为。 */
export function normalizeAccountReasoningMode(control: AiModelThinkingControl | null, value: string): string {
  const options = selectableReasoningValues(control);
  if (!options.length || value === "default") return "default";
  return options.includes(value) ? value : "default";
}

export function isSelectableReasoningMode(control: AiModelThinkingControl | null, value: string): boolean {
  if (value === "default") return true;
  const options = selectableReasoningValues(control);
  return options.includes(value);
}

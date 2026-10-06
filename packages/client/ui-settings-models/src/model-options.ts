/**
 * 功能：把 Provider 模型目录中的真实能力映射为设置中心和 AI Work 共用的选项。
 * 作用：只有控制端标记为来源可信的模型能力才会显示，避免客户端按模型名称自行推测参数。
 * 关联文件：packages/settings/settings/src/model-capabilities.ts、SettingsPage.tsx、AiWorkChat.tsx。
 */
import { type AiModel } from "lfaa-client-connection/src/api.js";
export function reasoningModeLabel(value: string): string {
  const labels: Record<string, string> = {
    minimal: "轻量",
    low: "低",
    medium: "中",
    high: "高",
    xhigh: "超高",
    max: "最大",
    enabled: "启用思考"
  };
  return labels[value] ?? value;
}

/** 将真实 Provider 默认值与用户可选强度区分显示。 */
export function reasoningDefaultLabel(model: AiModel | undefined): string {
  const control = model?.thinking;
  if (control?.kind === "effort" && control.defaultValue) {
    return `跟随官方默认 · ${reasoningModeLabel(control.defaultValue)}`;
  }
  if (control?.kind === "toggle" && control.defaultValue === "enabled") return "跟随官方默认 · 启用思考";
  return "跟随 Provider 默认";
}

export function reasoningOptions(model: AiModel | undefined): Array<{ value: string; label: string }> {
  const control = model?.thinking;
  if (model?.thinkingSource !== "provider-model-catalog" || !control || control.kind === "fixed") return [];
  const values = control.kind === "effort"
    ? control.values.filter((value) => !["none", "disabled", "off"].includes(value))
    : control.values.filter((value) => value === "enabled");
  if (!values.length) return [];
  return [{ value: "default", label: reasoningDefaultLabel(model) }, ...values.map((value) => {
    const isDefault = value === control.defaultValue;
    return { value, label: isDefault ? `${reasoningModeLabel(value)} · 官方默认` : reasoningModeLabel(value) };
  })];
}

/** 新模型先遵循 Provider 默认；用户主动选档后才保存具体能力值。 */
export function defaultReasoningMode(_model: AiModel | undefined): string {
  return "default";
}

export function effectiveReasoningMode(model: AiModel | undefined, savedValue: string): string {
  const options = reasoningOptions(model);
  return options.some((option) => option.value === savedValue) ? savedValue : "default";
}

export function modelParameterSummary(model: AiModel | undefined): string {
  if (!model) return "";
  const details: string[] = [];
  if (model.contextWindow) details.push(`上下文 ${model.contextWindow.toLocaleString("zh-CN")} tokens`);
  if (model.maxOutputTokens) details.push(`官方单次输出上限 ${model.maxOutputTokens.toLocaleString("zh-CN")} tokens`);
  return details.length ? details.join(" · ") : "官方模型目录未提供上下文与输出上限元数据";
}

export function modelOptionLabel(providerId: string, model: AiModel): string {
  const modelId = providerId === "deepseek" && model.id === "deepseek-v4-pro"
    ? `${model.id}（当前请求路由至 DeepSeek-V4.1-Flash）`
    : model.id;
  return model.name === model.id ? modelId : `${model.name} · ${modelId}`;
}

export function fixedThinkingLabel(model: AiModel): string {
  if (model.thinkingSource !== "provider-model-catalog" || model.thinking?.kind !== "fixed") return "";
  return model.thinking.value === "enabled"
    ? "此模型的思考模式由 Provider 固定启用，不能调整力度。"
    : `此模型的思考力度由 Provider 固定为${reasoningModeLabel(model.thinking.value)}。`;
}

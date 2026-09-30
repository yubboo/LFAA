/** 功能：提供 lfaa-client-ui-settings-models 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { type AiModel } from "lfaa-client-connection/src/api.js";
export function reasoningModeLabel(value: string): string {
  const labels: Record<string, string> = {
    none: "关闭思考",
    minimal: "最少",
    low: "低",
    medium: "中",
    high: "高",
    xhigh: "超高",
    max: "最大",
    enabled: "启用思考",
    disabled: "关闭思考"
  };
  return labels[value] ?? value;
}

export function reasoningOptions(model: AiModel | undefined): Array<{ value: string; label: string }> {
  if (!model?.thinking || model.thinking.kind === "fixed") return [];
  const defaultLabel = model.thinking.defaultValue
    ? `跟随官方默认（${reasoningModeLabel(model.thinking.defaultValue)}）`
    : "跟随官方默认";
  return [
    { value: "default", label: defaultLabel },
    ...model.thinking.values.map((value) => ({ value, label: reasoningModeLabel(value) }))
  ];
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
  if (model.thinking?.kind !== "fixed") return "";
  if (model.thinking.value === "high") return "此型号由 Provider 固定为高思考力度。";
  return model.thinking.value === "disabled" ? "此型号固定关闭思考模式。" : "此型号始终启用思考模式，不能切换。";
}

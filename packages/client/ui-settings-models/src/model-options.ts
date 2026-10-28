/**
 * 功能：把 Provider 模型目录中的真实能力映射为设置中心和 AI Work 共用的选项。
 * 作用：只有控制端标记为来源可信的模型能力才会显示，避免客户端按模型名称自行推测参数。
 * 关联文件：packages/settings/settings/src/model-capabilities.ts、SettingsPage.tsx、AiWorkChat.tsx。
 */
import { type AiAccount, type AiModel } from "lfaa-client-connection/src/api.js";

export interface AiModelPickerEntry {
  account: AiAccount;
  model: AiModel;
}

/** 与 Settings Owner 的有效路由优先级一致：个人 Plan 覆盖系统默认。 */
export function effectiveAiAccount(accounts: AiAccount[]): AiAccount | undefined {
  return accounts.find((account) => account.scope === "user" && account.active)
    ?? accounts.find((account) => account.scope === "system" && account.active);
}

/** 仅汇总当前认证账户可见的已配置目录，并按当前有效账户优先展示。 */
export function aiModelPickerCatalog(accounts: AiAccount[]): AiModelPickerEntry[] {
  const activeAccount = effectiveAiAccount(accounts);
  return [...accounts]
    .sort((left, right) => Number(right.id === activeAccount?.id) - Number(left.id === activeAccount?.id))
    .flatMap((account) => {
      const planTier = account.options.planTier;
      const models = account.models
        .filter((model) => model.taskType === undefined || model.taskType === "chat")
        .filter((model) => !model.planTiers?.length || !planTier || planTier === "unknown" || model.planTiers.includes(planTier as NonNullable<AiModel["planTiers"]>[number]))
        .sort((left, right) => Number(right.id === account.modelId) - Number(left.id === account.modelId));
      return models.map((model) => ({ account, model }));
    });
}
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

/** 展示目录明确返回的模型能力，并明确标出目录没有提供的元数据。 */
export function modelCatalogCapabilitySummary(model: AiModel): string {
  const details = [modelParameterSummary(model)];
  details.push(model.taskType ? `模型用途 ${model.taskType}` : "模型用途目录未声明");
  details.push(model.inputModalities?.length ? `输入模态 ${model.inputModalities.join("、")}` : "输入模态目录未声明");

  const thinking = model.thinking;
  if (model.thinkingSource !== "provider-model-catalog" || !thinking) {
    details.push("思考参数目录未提供可验证能力");
  } else if (thinking.kind === "effort") {
    details.push(`思考参数 ${thinking.parameter}: ${thinking.values.join(" / ")}${thinking.defaultValue ? ` · 官方默认 ${thinking.defaultValue}` : ""}`);
  } else if (thinking.kind === "toggle") {
    details.push(`思考参数 ${thinking.parameter}: ${thinking.values.join(" / ")}${thinking.defaultValue ? ` · 官方默认 ${thinking.defaultValue}` : ""}`);
  } else {
    details.push(`固定思考参数 ${thinking.value}`);
  }

  if (model.catalogSource) details.push(`目录来源 ${model.catalogSource}`);
  if (model.catalogNote) details.push(model.catalogNote);
  return details.join(" · ");
}

export function modelOptionLabel(_providerId: string, model: AiModel): string {
  // Provider 目录的显示名和调用 ID 都是权威值；标签只做分隔，不改写二者。
  return model.name === model.id ? model.id : `${model.name} · ${model.id}`;
}

/** Provider 单独提供版本标记时原样显示，不把版本拼进模型名或调用 ID。 */
export function modelOptionVersionTag(model: AiModel): string | undefined {
  return model.versionTag;
}

/** 折叠后的模型按钮显示名称与目录版本标签，调用 ID 仍单独保留。 */
export function modelSelectorDisplayLabel(model: AiModel): string {
  const versionTag = modelOptionVersionTag(model);
  return versionTag ? `${model.name} ${versionTag}` : model.name;
}

export function fixedThinkingLabel(model: AiModel): string {
  if (model.thinkingSource !== "provider-model-catalog" || model.thinking?.kind !== "fixed") return "";
  return model.thinking.value === "enabled"
    ? "此模型的思考模式由 Provider 固定启用，不能调整力度。"
    : `此模型的思考力度由 Provider 固定为${reasoningModeLabel(model.thinking.value)}。`;
}

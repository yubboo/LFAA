/**
 * 移植参考：DeepSeek Harness dsh-llm-pi-ai（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：config.ts
 * 功能：豆包 Provider 的设置接入形状（账户/模型/参数）。
 * 作用：描述一个豆包账户在 settings 中需要的字段；实际持久化由 settings service 的通用账户模型完成。
 * 关联文件：packages/settings/settings/src/service.ts（doubao provider 条目）。
 */

/** 一个豆包账户的可选参数（options 键值，对应 settings AiProviderInput.options）。 */
export interface DoubaoAccountOptions {
  /** 预留：未来区域/版本等选项；当前 doubao 无区域选项。 */
  [key: string]: string;
}

/** 账户保存时需要的非秘密字段。 */
export interface DoubaoAccountConfig {
  providerId: "doubao";
  /** 账户展示名。 */
  displayName: string;
  /** 模型/推理接入点 ID。 */
  modelId: string;
  options: DoubaoAccountOptions;
}

/** 推理参数档位映射（LFAA reasoningMode → Ark 思考开关）。 */
export type DoubaoThinkingMode = "default" | "enabled" | "disabled";

/**
 * 把 LFAA 通用 reasoningMode 翻译为 Ark thinking 开关。
 * @param mode 用户选择的思考档位。
 */
export function resolveThinking(mode: string): { enabled?: boolean } {
  if (mode === "enabled" || mode === "high" || mode === "max") return { enabled: true };
  if (mode === "disabled" || mode === "off" || mode === "none") return { enabled: false };
  return {};
}

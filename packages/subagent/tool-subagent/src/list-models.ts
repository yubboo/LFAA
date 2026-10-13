/**
 * 功能：列出子代理可选模型目录。
 * 作用：给模型/控制层一个可用模型清单；实际目录来自 LFAA 设置中心的可用 Provider 账户（集成需要：从 settings 注入）。
 * 关联文件：model-selection.ts、model-selection-settings.ts。
 * 移植自 DeepSeek Harness tool-subagent/list-models（MIT License，commit 639ed01），按 LFAA settings 适配。
 */

/** 一个可选模型条目。 */
export interface ModelChoice {
  readonly id: string;
  readonly label: string;
  readonly provider: string;
}

/** 从外部注入的目录构建展示列表；注入方负责接入真实 settings。 */
export function listAvailableModels(catalog: readonly ModelChoice[]): ModelChoice[] {
  return [...catalog].sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));
}

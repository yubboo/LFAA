/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-agent。
 * LFAA 适配：DSH 用 dsh-invariants 服务注册；LFAA 导出可调用断言，供关键边界自检。
 *
 * 文件：invariant.ts
 * 功能：Agent 运行时的不变量校验——回合边界闭合、模型选择路由有效。
 */
import type { ModelSelection } from "./model-selection.js";

/** 断言模型选择同时具备 provider 与 model，二者缺一不可。 */
export function assertValidModelSelection(selection: ModelSelection | undefined): asserts selection is ModelSelection {
  if (selection === undefined) throw new Error("lfaa-agent: 尚未选定模型，无法发起请求。");
  if (!selection.provider || !selection.model) {
    throw new Error("lfaa-agent: 模型选择必须同时包含 provider 与 model。");
  }
}

/** 断言回合结束状态是已知取值。 */
export function assertKnownTurnEndStatus(status: string): void {
  if (!["complete", "interrupted", "error", "forked"].includes(status)) {
    throw new Error(`lfaa-agent: 未知的回合结束状态：${status}`);
  }
}

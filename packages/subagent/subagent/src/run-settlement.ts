/**
 * 功能：回合结算——把子代理终态结果归一化为稳定的对外结果。
 * 作用：统一 completed/aborted/error 的文本与诊断表达，供工具层直接回传模型。
 * 关联文件：types.ts、assistant-output.ts、archive-admission.ts。
 * 移植自 DeepSeek Harness subagent/run-settlement（MIT License，commit 639ed01），去掉 dsh-jobs JobOutcome，改为 LFAA 结果。
 */
import type { SubagentRunResult } from "./types.js";

/** 归一化后的结算结果。 */
export interface SettledOutcome {
  readonly ok: boolean;
  readonly stopReason: SubagentRunResult["stopReason"];
  readonly text: string;
  readonly detail?: string;
}

/** 把一次运行结果结算为对外视图。 */
export function settleRun(result: SubagentRunResult): SettledOutcome {
  if (result.stopReason === "completed") {
    return { ok: true, stopReason: result.stopReason, text: result.answer };
  }
  const detail = result.diagnostic === undefined
    ? result.stopReason
    : `${result.stopReason}; diagnostic: ${result.diagnostic}`;
  return { ok: false, stopReason: result.stopReason, text: result.answer, detail };
}

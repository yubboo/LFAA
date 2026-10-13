/**
 * 功能：续接（continuation）策略——一个子任务是否允许被追加后续消息。
 * 作用：根据描述与当前运行状态判断可续接性；一次性 CLI 运行终态后不可续接。
 * 关联文件：descriptor.ts、continuation-activation.ts、inbox.ts。
 * 移植自 DeepSeek Harness subagent/continuation（MIT License，commit 639ed01），按 LFAA 一次性运行适配。
 */
import type { SubagentDescriptor } from "./descriptor.js";
import { isTerminal } from "./lifecycle.js";
import type { SubagentRunHandle } from "./types.js";

/** 是否允许向该子任务续接一条消息。 */
export function canContinue(descriptor: SubagentDescriptor, run: SubagentRunHandle | undefined): boolean {
  // 只有声明为 continuable 的描述才可能续接；且必须已有一个已结束的运行作为接续点。
  if (descriptor.mode !== "continuable") return false;
  if (run === undefined) return false;
  return isTerminal(run.status);
}

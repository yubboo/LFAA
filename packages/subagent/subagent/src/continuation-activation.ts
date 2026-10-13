/**
 * 功能：续接激活条件——判断一次续接请求此刻是否应被激活执行。
 * 作用：区分"可续接"与"现在就激活"；活动运行仍在跑时，续接只能排队不能抢占。
 * 关联文件：continuation.ts、inbox.ts。
 */
import type { SubagentRunHandle } from "./types.js";

/** 续接激活结果。 */
export type ContinuationActivation =
  | { readonly active: true }
  | { readonly active: false; readonly reason: "no-prior-run" | "run-still-active" | "not-continuable" };

/** 判断续接此刻是否可激活。 */
export function evaluateContinuation(priorRun: SubagentRunHandle | undefined, continuable: boolean): ContinuationActivation {
  if (!continuable) return { active: false, reason: "not-continuable" };
  if (priorRun === undefined) return { active: false, reason: "no-prior-run" };
  if (priorRun.status === "running") return { active: false, reason: "run-still-active" };
  return { active: true };
}

/**
 * 功能：子代理注册表与 start/end 配对的不变量校验。
 * 作用：在派发与终态时校验驱动名/运行标识非空、start 与 end 身份一致，防止身份漂移。
 * 关联文件：manager.ts、error.ts。
 * 移植自 DeepSeek Harness subagent/invariant（MIT License，commit 639ed01），去掉 dsh-invariants 服务，改为可直接调用的纯校验函数。
 */
import { SubagentError } from "./error.js";

/** 校验一个已登记驱动的名字合法。 */
export function assertProviderName(name: string): void {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new SubagentError("子代理驱动名必须为非空字符串。", "invalid-arguments");
  }
}

/** start 时记录的最小身份，用于与 end 比对。 */
export interface RunStartIdentity {
  readonly runId: string;
  readonly driver: string;
}

/** 校验 start 身份完整。 */
export function assertRunStart(start: RunStartIdentity): void {
  if (!start.runId || !start.driver) {
    throw new SubagentError("subagent/start 的 runId 与 driver 必须非空。", "invalid-arguments");
  }
}

/** 校验 end 身份与 start 严格一致（驱动、运行标识均不得漂移）。 */
export function assertRunEndMatches(start: RunStartIdentity, end: RunStartIdentity): void {
  if (start.driver !== end.driver || start.runId !== end.runId) {
    throw new SubagentError(`subagent/end 身份与 start 不一致（runId=${end.runId}）。`, "invalid-arguments");
  }
}

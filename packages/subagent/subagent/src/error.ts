/**
 * 功能：子代理分片的类型化错误。
 * 作用：给驱动、结算与控制层一个带机器可读 code 的统一错误类型，便于上层归一化结果。
 * 关联文件：run-settlement.ts、out-of-process.ts、tool-subagent。
 * 移植自 DeepSeek Harness subagent（MIT License，commit 639ed01），按 LFAA 去掉 HarnessError 基类改为标准 Error。
 */

/** 子代理领域错误，带稳定 code。 */
export class SubagentError extends Error {
  constructor(
    message: string,
    readonly code: SubagentErrorCode,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "SubagentError";
  }
}

/** 稳定错误码，供结果归一与日志分类。 */
export type SubagentErrorCode =
  | "invalid-arguments"
  | "driver-unavailable"
  | "depth-exceeded"
  | "run-not-found"
  | "not-continuable"
  | "out-of-process-failed";

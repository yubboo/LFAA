/**
 * 移植参考：DeepSeek Harness dsh-llm-retry（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：executor.ts
 * 功能：通用、有界指数退避的 LLM 请求重试包装器。
 * 作用：把一次异步 LLM 操作包成「失败即按策略重试」的调用，供会话标题、压缩、记忆等短链调用复用。
 * 可重试判定（中文说明）：
 *   1) 抛出 LFAA AiRecoverableRequestError —— 这是 streamAiCompletion 明确标记「可恢复」的错误：
 *      已建立连接但未收到正文、读取流超时、或 429 限流。这类错误重试安全（请求尚未生效或本就是瞬态）。
 *   2) 普通 Error 且其 .code 命中策略 retryableCodes（RATE_LIMIT / SERVER / TIMEOUT / TRANSPORT / EMPTY_RESPONSE）。
 *   不可重试：4xx 鉴权失败（401/403/INVALID_CREDENTIAL）、上下文超限、额度耗尽、abort（用户主动取消）——
 *      这些重试无意义甚至会放大问题，直接抛出。
 * 适配说明：不依赖 DSH 的 agent/session/zod 事件系统，纯函数 + AbortSignal。
 * 关联文件：lfaa-llm completion.ts（AiRecoverableRequestError）、retry-policy.ts、error.ts。
 */
import { AiRecoverableRequestError } from "lfaa-llm/src/completion.js";
import {
  resolveRetryPolicy,
  localRetryDelayMs,
  type ResolvedRetryPolicy,
  type RetryPolicyConfig
} from "lfaa-llm/src/retry-policy.js";

/** 一次重试尝试的诊断信息。 */
export interface RetryAttemptInfo {
  /** 当前是第几次重试（1 起）；0 表示首次成功。 */
  retry: number;
  /** 本次失败原因。 */
  error: unknown;
  /** 退避等待毫秒（重试前）。 */
  delayMs: number;
}

/** 执行器选项。 */
export interface RetryExecutorOptions {
  /** Provider 重试策略；省略取普通默认（最多 5 次）。 */
  policy?: RetryPolicyConfig;
  /** 可选外部 AbortSignal；触发时停止重试并抛出 AbortError。 */
  signal?: AbortSignal;
  /** 注入 0..1 随机源（测试用）。 */
  random?: () => number;
  /** 每次重试前的回调（日志/观测）。 */
  onRetry?: (info: RetryAttemptInfo) => void;
}

/** 判断一个错误是否应按策略重试。 */
function isRetryable(error: unknown, policy: ResolvedRetryPolicy): boolean {
  // LFAA 可恢复语义：未收到正文/超时/限流，永远可重试（受 maxRetries 约束）。
  if (error instanceof AiRecoverableRequestError) return true;
  if (error instanceof Error) {
    // 用户主动取消 / abort：不重试。
    if (error.name === "AbortError") return false;
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") {
      if (policy.mode === "always") return true;
      return policy.retryableCodes.includes(code);
    }
  }
  return false;
}

/** 可取消的退避等待；返回 false 表示被中止。 */
function cancellableDelay(delayMs: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(true);
    }, delayMs);
    function onAbort(): void {
      clearTimeout(timer);
      resolve(false);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * 用有界指数退避重试包裹一次异步 LLM 操作。
 * @param operation 实际发起请求的函数（每次重试都会再次调用）。
 * @param options 策略/中止/回调。
 * @returns operation 首次成功的结果；耗尽重试后抛出最后一次错误。
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryExecutorOptions = {}
): Promise<T> {
  const policy = resolveRetryPolicy(options.policy ?? { mode: "normal" }, "retryPolicy");
  const random = options.random ?? Math.random;

  for (let attempt = 0; ; attempt++) {
    if (options.signal?.aborted) throw new Error("已取消");
    try {
      return await operation();
    } catch (error) {
      if (!isRetryable(error, policy)) throw error;
      // 普通策略：达到 maxRetries 后不再重试。
      if (policy.mode === "normal" && attempt >= policy.maxRetries) throw error;
      const retry = attempt + 1;
      const delayMs = localRetryDelayMs(policy, retry, random);
      options.onRetry?.({ retry, error, delayMs });
      const waited = await cancellableDelay(delayMs, options.signal);
      if (!waited) throw error instanceof Error ? error : new Error("重试已取消");
    }
  }
}

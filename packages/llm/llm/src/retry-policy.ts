/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-llm。
 * 文件：retry-policy.ts
 * 功能：Provider 请求重试策略的解析与有界指数退避计算。
 * 作用：llm-retry 按此策略决定重试次数、可重试码与退避延迟。
 * 适配说明：不使用 schemastery/zod，改为手写轻量校验；与 LFAA AiRecoverableRequestError 语义对齐。
 * 关联文件：error.ts、llm/llm-retry。
 */
import { DEFAULT_RETRYABLE_CODES } from "./error.js";

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 10_000;
const DEFAULT_JITTER_RATIO = 0.1;

/** 有界指数退避配置。 */
export interface BackoffConfig {
  /** 初始退避毫秒（默认 500）。 */
  initialDelayMs?: number;
  /** 退避上限毫秒（默认 10000）。 */
  maxDelayMs?: number;
  /** 围绕 1 的对称随机抖动比例（默认 0.1）。 */
  jitterRatio?: number;
}

/** 普通（按可重试码有界）重试策略。 */
export interface NormalRetryPolicyConfig {
  mode: "normal";
  /** 首次请求之后最多重试次数（默认 5）。 */
  maxRetries?: number;
  /** 可重试的稳定失败码。 */
  retryableCodes?: string[];
  backoff?: BackoffConfig;
}

/** 永不放弃的重试策略（直到成功/取消/释放）。 */
export interface AlwaysRetryPolicyConfig {
  mode: "always";
  backoff?: BackoffConfig;
}

/** Provider 自有重试策略配置。 */
export type RetryPolicyConfig = NormalRetryPolicyConfig | AlwaysRetryPolicyConfig;

/** 解析后的退避参数。 */
export interface ResolvedRetryBackoff {
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitterRatio: number;
}

/** 解析后的普通重试策略。 */
export interface ResolvedNormalRetryPolicy extends ResolvedRetryBackoff {
  readonly mode: "normal";
  readonly maxRetries: number;
  readonly retryableCodes: readonly string[];
}

/** 解析后的永不放弃策略。 */
export interface ResolvedAlwaysRetryPolicy extends ResolvedRetryBackoff {
  readonly mode: "always";
}

/** 不可变的解析后策略。 */
export type ResolvedRetryPolicy = ResolvedNormalRetryPolicy | ResolvedAlwaysRetryPolicy;

function resolveBackoff(config: BackoffConfig | undefined, path: string): ResolvedRetryBackoff {
  const initialDelayMs = config?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = config?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const jitterRatio = config?.jitterRatio ?? DEFAULT_JITTER_RATIO;
  if (!Number.isFinite(initialDelayMs) || initialDelayMs <= 0) throw new Error(`${path}.initialDelayMs 必须为正数`);
  if (!Number.isFinite(maxDelayMs) || maxDelayMs <= 0) throw new Error(`${path}.maxDelayMs 必须为正数`);
  if (initialDelayMs > maxDelayMs) throw new Error(`${path}.initialDelayMs 不能大于 maxDelayMs`);
  if (!Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 1) throw new Error(`${path}.jitterRatio 必须在 0 到 1 之间`);
  return Object.freeze({ initialDelayMs, maxDelayMs, jitterRatio });
}

/**
 * 校验、补默认值并冻结一个 Provider 重试策略。
 * @param config 可选配置；省略时取普通默认。
 * @param path 用于报错的配置路径。
 * @returns 不可变策略。
 */
export function resolveRetryPolicy(config: RetryPolicyConfig | undefined, path: string): ResolvedRetryPolicy {
  if (config === undefined) {
    return Object.freeze({
      mode: "normal",
      maxRetries: DEFAULT_MAX_RETRIES,
      retryableCodes: DEFAULT_RETRYABLE_CODES,
      ...resolveBackoff(undefined, `${path}.backoff`),
    });
  }
  if (config.mode === "normal") {
    const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    const retryableCodes = config.retryableCodes ?? [...DEFAULT_RETRYABLE_CODES];
    if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) throw new Error(`${path}.maxRetries 必须为非负整数`);
    if (retryableCodes.length === 0) throw new Error(`${path}.retryableCodes 不能为空`);
    return Object.freeze({
      mode: "normal",
      maxRetries,
      retryableCodes: Object.freeze([...retryableCodes]),
      ...resolveBackoff(config.backoff, `${path}.backoff`),
    });
  }
  if (config.mode === "always") {
    return Object.freeze({ mode: "always", ...resolveBackoff(config.backoff, `${path}.backoff`) });
  }
  throw new Error(`${path}.mode 必须是 "normal" 或 "always"`);
}

/**
 * 计算第 retry 次（从 1 起）本地退避延迟：有界指数 + 对称抖动。
 * @param policy 已解析策略。
 * @param retry 当前是第几次重试（1 起）。
 * @param random 0..1 随机源（测试可注入固定值）。
 */
export function localRetryDelayMs(policy: ResolvedRetryBackoff, retry: number, random: () => number = Math.random): number {
  const exponent = Math.min(retry - 1, 1024);
  const exponential = Math.min(policy.initialDelayMs * 2 ** exponent, policy.maxDelayMs);
  const jitter = 1 - policy.jitterRatio + 2 * policy.jitterRatio * random();
  return Math.min(exponential * jitter, policy.maxDelayMs);
}

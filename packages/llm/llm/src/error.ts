/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-llm。
 * 文件：error.ts
 * 功能：LLM 失败的稳定机器码分类与可恢复判定。
 * 作用：重试策略按 code（而非解析 message）路由；诊断信息按 cause 链渲染。
 * 关联文件：completion.ts 的 AiRecoverableRequestError、llm-retry、token-meter。
 */
import type { LlmFailure } from "./types.js";

/** 上下文窗口超限。 */
export const CONTEXT_WINDOW_EXCEEDED_CODE = "CONTEXT_WINDOW_EXCEEDED";
/** 账户额度/余额耗尽。 */
export const QUOTA_EXCEEDED_CODE = "QUOTA";
/** 正常结束但没有任何内容块（退化完成），可安全重试。 */
export const EMPTY_RESPONSE_CODE = "EMPTY_RESPONSE";
/** 密钥已提供但不可用（格式错误），不可重试。 */
export const INVALID_CREDENTIAL_CODE = "INVALID_CREDENTIAL";
/** 限流。 */
export const RATE_LIMIT_CODE = "RATE_LIMIT";
/** 传输层失败（网络/DNS/代理）。 */
export const TRANSPORT_CODE = "TRANSPORT";
/** 请求超时。 */
export const TIMEOUT_CODE = "TIMEOUT";
/** Provider 端 5xx。 */
export const SERVER_CODE = "SERVER";

/** 默认允许重试的失败码集合：与 LFAA AiRecoverableRequestError 语义对齐（未收到正文/超时/限流/服务端抖动）。 */
export const DEFAULT_RETRYABLE_CODES: readonly string[] = Object.freeze([
  EMPTY_RESPONSE_CODE,
  RATE_LIMIT_CODE,
  SERVER_CODE,
  TIMEOUT_CODE,
  TRANSPORT_CODE,
]);

/**
 * 识别 OpenAI 兼容 Provider 文案中的「上下文窗口超限」。
 * @param detail 汇总了 provider code/type/message 的单一字符串。
 * @returns 是否判定为上下文超限。
 */
export function isContextWindowExceededError(detail: string): boolean {
  return /context[\s_-](?:length|window)[\s_-]*(?:exceed|overflow|limit[\s_-]exceeded)/i.test(detail)
    || /\b(?:maximum|max)(?:\s+(?:allowed|supported))?\s+context\s+(?:length|window)\b/i.test(detail)
    || /\b(?:input|prompt|request)\s+(?:is\s+)?too\s+(?:long|large)\s+for\s+(?:this|the)\s+model\b/i.test(detail);
}

/**
 * 识别「账户额度耗尽」而非瞬时限流。
 * @param detail provider 错误文案。
 * @returns 仅当为终态额度/余额/信用/预算文案时 true。
 */
export function isQuotaExceededError(detail: string): boolean {
  return /\binsufficient[\s_-]+(?:quota|balance|credits?)\b/i.test(detail)
    || /\b(?:quota|usage[\s_-]+limit)[\s_-]+(?:exceeded|exhausted|reached)\b/i.test(detail)
    || /\b(?:balance|credits?)[\s_-]+(?:exhausted|depleted)\b/i.test(detail)
    || /\bout[\s_-]+of[\s_-]+(?:credits?|budget)\b/i.test(detail);
}

/**
 * 渲染被抛值及其完整 cause 链（含 AggregateError 成员），仅供诊断/日志，禁止据此路由。
 * @param value catch 到的任意值。
 * @returns 最外层 message 在前，cause 以 ": " 拼接（重复则跳过）。
 */
export function errorChain(value: unknown): string {
  const path = new Set<unknown>();
  const render = (current: unknown): string => {
    if (path.has(current)) return "<circular cause>";
    path.add(current);
    try {
      if (!(current instanceof Error)) return String(current);
      const message = current.message === "" ? current.name : current.message;
      const members = current instanceof AggregateError && current.errors.length > 0
        ? ` [${current.errors.map(render).join("; ")}]`
        : "";
      const causeText = current.cause === undefined || current.cause === null ? "" : render(current.cause);
      const cause = causeText === "" || causeText === message ? "" : `: ${causeText}`;
      return `${message}${members}${cause}`;
    } catch {
      return "<unrenderable value>";
    } finally {
      path.delete(current);
    }
  };
  return render(value);
}

/** 从任意被抛值提炼可序列化失败事实。 */
export function normalizeLlmFailure(value: unknown): LlmFailure {
  if (value instanceof Error) {
    const maybeCode = (value as { code?: unknown }).code;
    const code = typeof maybeCode === "string" && maybeCode.length > 0 ? maybeCode : "UNKNOWN";
    return Object.freeze({ message: value.message || "LLM 请求失败", code });
  }
  return Object.freeze({ message: errorChain(value), code: "UNKNOWN" });
}

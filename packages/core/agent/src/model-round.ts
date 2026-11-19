// Agent Host 模型轮次的超时与有限重试，保留已发出的正文和工具进度。
import type { LlmGenerateInput, LlmGenerateOutput, LlmService } from "@lfaa/llm";

export const modelRoundLimits = { idleMs: 45_000, totalMs: 180_000, reasoningChars: 64_000, reasoningMs: 55_000 };
type RoundLimits = Omit<typeof modelRoundLimits, "reasoningMs"> & { reasoningMs?: number };
type RoundInput = LlmGenerateInput & { onRetry?: (reason: "reasoning" | "network") => void };

class ReasoningLimitError extends Error {
  constructor() {
    super("模型长时间仅输出推理，未返回正文或工具请求。可更换模型后继续。");
  }
}

const retryableNetworkCodes = new Set([
  "EAI_AGAIN", "ECONNABORTED", "ECONNRESET", "EPIPE", "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET",
]);

// Node fetch 的连接错误只暴露错误码，避免将请求地址或凭据写入聊天记录。
function networkFailure(error: unknown): { code: string | undefined; retryable: boolean } | undefined {
  if (!(error instanceof TypeError) || !/^(?:fetch failed|terminated)$/u.test(error.message)) return;
  const cause: unknown = error.cause;
  const code = cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
    && /^[A-Z][A-Z0-9_]{1,60}$/u.test(cause.code) ? cause.code : undefined;
  return { code, retryable: !code || retryableNetworkCodes.has(code) };
}

/** 仅重试未发出正文或工具进度的当前请求，两次尝试共用同一轮时限。 */
export async function completeAgentRound(
  llm: Pick<LlmService, "complete">,
  { onRetry, ...input }: RoundInput,
  limits: RoundLimits = modelRoundLimits,
): Promise<LlmGenerateOutput> {
  const deadline = new AbortController();
  const signal = input.signal ? AbortSignal.any([input.signal, deadline.signal]) : deadline.signal;
  const timeout = setTimeout(() => deadline.abort(new Error("模型响应超过本轮时限。可重试或更换模型。")), limits.totalMs);
  let messages = input.messages;
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await runAttempt(llm, { ...input, messages }, signal, limits);
      } catch (error) {
        signal.throwIfAborted();
        if (!(error instanceof IncompleteModelRound)) throw error;
        const cause = error.cause;
        const network = networkFailure(cause);
        if (attempt === 0 && !error.progressed && (cause instanceof ReasoningLimitError || network?.retryable)) {
          if (cause instanceof ReasoningLimitError) {
            const hint = "上一次生成持续推理且没有推进。请基于已有工具结果，直接回复用户或发出下一项必要的工具调用。";
            const [first, ...rest] = messages;
            messages = first?.role === "system"
              ? [{ ...first, content: `${first.content}\n\n${hint}` }, ...rest]
              : [{ role: "system", content: hint }, ...messages];
          }
          onRetry?.(cause instanceof ReasoningLimitError ? "reasoning" : "network");
          continue;
        }
        if (network) {
          const code = network.code ? `（${network.code}）` : "";
          throw new Error(`模型连接失败或中途断开${code}。请检查网络或模型服务连通性后重试。`, { cause });
        }
        throw cause;
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

class IncompleteModelRound extends Error {
  constructor(cause: unknown, readonly progressed: boolean) {
    super("模型请求未完成", { cause });
  }
}

async function runAttempt(
  llm: Pick<LlmService, "complete">,
  input: LlmGenerateInput,
  roundSignal: AbortSignal,
  limits: RoundLimits,
): Promise<LlmGenerateOutput> {
  const deadline = new AbortController();
  const signal = AbortSignal.any([roundSignal, deadline.signal]);
  signal.throwIfAborted();
  let idle: ReturnType<typeof setTimeout> | undefined;
  let reasoningLimit: ReturnType<typeof setTimeout> | undefined;
  let thinkingTimeout: ReturnType<typeof setTimeout> | undefined;
  let reasoningChars = 0;
  let progressed = false;
  let onAbort: (() => void) | undefined;
  const touch = () => {
    clearTimeout(idle);
    idle = setTimeout(() => deadline.abort(new Error("模型响应中断，长时间未收到新的内容。可重试本轮。")), limits.idleMs);
  };
  const markProgress = () => {
    progressed = true;
    reasoningChars = 0;
    clearTimeout(reasoningLimit);
    reasoningLimit = undefined;
    clearTimeout(thinkingTimeout);
    thinkingTimeout = undefined;
  };
  touch();
  try {
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
    });
    const output = await Promise.race([
      cancelled,
      Promise.resolve().then(() => llm.complete({
        ...input, signal,
        onActivity: (progress) => {
          if (signal.aborted) return;
          touch();
          markProgress();
          input.onActivity?.(progress);
        },
        onDelta: (delta) => {
          if (signal.aborted) return;
          touch();
          if (delta.type === "reasoning") {
            if (delta.text && limits.reasoningMs !== undefined) {
              thinkingTimeout ??= setTimeout(() => deadline.abort(new ReasoningLimitError()), limits.reasoningMs);
            }
            reasoningChars += delta.text?.length ?? 0;
            if (reasoningChars > limits.reasoningChars) {
              // 同一网络块可同时携带推理、正文与工具事件，等当前批次派发后再决定是否停止。
              reasoningLimit ??= setTimeout(() => deadline.abort(new ReasoningLimitError()), 0);
              return;
            }
          } else if (delta.type === "text" ? Boolean(delta.text) : Boolean(delta.toolCallId && delta.toolName)) {
            markProgress();
          }
          input.onDelta?.(delta);
        },
      })),
    ]);
    if (reasoningLimit && !output.content.trim() && !output.toolCalls.length) throw new ReasoningLimitError();
    return output;
  } catch (error) {
    throw new IncompleteModelRound(error, progressed);
  } finally {
    clearTimeout(idle);
    clearTimeout(reasoningLimit);
    clearTimeout(thinkingTimeout);
    if (onAbort) signal.removeEventListener("abort", onAbort);
    if (!signal.aborted) deadline.abort();
  }
}

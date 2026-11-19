// 为智能体的一次模型请求设置真实进展、静默超时与持续推理上限。
import type { LlmGenerateInput, LlmGenerateOutput, LlmService } from "@lfaa/llm";

export const modelRoundLimits = { idleMs: 45_000, totalMs: 180_000, reasoningChars: 64_000 };

export async function completeAgentRound(
  llm: Pick<LlmService, "complete">,
  input: LlmGenerateInput,
  limits = modelRoundLimits,
): Promise<LlmGenerateOutput> {
  const deadline = new AbortController();
  const signal = input.signal ? AbortSignal.any([input.signal, deadline.signal]) : deadline.signal;
  signal.throwIfAborted();
  let idle: ReturnType<typeof setTimeout> | undefined;
  let reasoningChars = 0;
  let onAbort: (() => void) | undefined;
  const stop = (message: string) => deadline.abort(new Error(message));
  const touch = () => {
    clearTimeout(idle);
    idle = setTimeout(() => stop("模型响应中断，长时间未收到新的内容。可重试本轮。"), limits.idleMs);
  };
  const timeout = setTimeout(() => stop("模型响应超过本轮时限。可重试或降低推理强度。"), limits.totalMs);
  touch();
  try {
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
    });
    return await Promise.race([
      cancelled,
      llm.complete({
        ...input, signal,
        onActivity: () => {
          if (signal.aborted) return;
          touch();
          reasoningChars = 0;
          input.onActivity?.();
        },
        onDelta: (delta) => {
          if (signal.aborted) return;
          touch();
          reasoningChars = delta.type === "reasoning" ? reasoningChars + (delta.text?.length ?? 0) : 0;
          if (reasoningChars > limits.reasoningChars) {
            stop("模型长时间仅输出推理，未推进可见回复或工具操作。本轮已停止，可降低推理强度后重试。");
            return;
          }
          input.onDelta?.(delta);
        },
      }),
    ]);
  } finally {
    clearTimeout(idle);
    clearTimeout(timeout);
    if (onAbort) signal.removeEventListener("abort", onAbort);
    if (!signal.aborted) deadline.abort();
  }
}

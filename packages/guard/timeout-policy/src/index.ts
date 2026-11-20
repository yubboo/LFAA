// @lfaa/timeout-policy：为所有工具执行套一层统一超时，超时中止 signal 并返回可读失败结果。
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/tools";
import type { ToolExecutionContext, ToolExecutionResult } from "@lfaa/tools";

/** 默认超时：十分钟，覆盖大多数命令与抓取，仍能兜住挂死的调用。 */
export const DEFAULT_TIMEOUT_MS = 10 * 60_000;

/** 超时策略配置：可整体设置，也可按工具名覆盖。 */
export interface TimeoutPolicyConfig {
  defaultTimeoutMs?: number;
  byTool?: Record<string, number>;
}

/** 读一次调用实际生效的超时：按工具覆盖优先，非法值回落到默认。 */
export function resolveTimeoutMs(name: string, config: TimeoutPolicyConfig = {}): number {
  const candidates = [config.byTool?.[name], config.defaultTimeoutMs, DEFAULT_TIMEOUT_MS];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) return candidate;
  }
  return DEFAULT_TIMEOUT_MS;
}

/** 超时的统一结果：明确告诉模型是超时而不是工具失败，避免它反复重试同一调用。 */
export function timeoutResult(name: string, timeoutMs: number): ToolExecutionResult {
  const seconds = Math.max(1, Math.round(timeoutMs / 1000));
  return {
    ok: false,
    output: `工具 ${name} 执行超过 ${seconds} 秒，已中止本次等待。可以拆小任务、换更轻的命令，或改用后台任务重试。`,
    summary: `工具超时：${name}`,
    metadata: { timedOut: true, timeoutMs },
  };
}

class ToolTimeoutError extends Error {
  constructor(readonly toolName: string, readonly timeoutMs: number) {
    super(`工具 ${toolName} 超时（${timeoutMs}ms）`);
    this.name = "ToolTimeoutError";
  }
}

/**
 * 用超时包裹一次执行：给工具一个独立 AbortSignal，父级取消继续向下传递。
 * 超时只中止信号与本次等待；不响应 signal 的工具仍可能在后台继续，属已知边界。
 */
export async function runWithTimeout(
  next: (context?: ToolExecutionContext) => Promise<ToolExecutionResult>,
  info: { name: string; context: ToolExecutionContext },
  timeoutMs: number,
): Promise<ToolExecutionResult> {
  const parent = info.context.signal;
  if (parent.aborted) {
    return { ok: false, output: "本次执行已被取消。", summary: "已取消" };
  }
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parent.reason);
  parent.addEventListener("abort", abortFromParent, { once: true });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const execution = next({ ...info.context, signal: controller.signal });
    // 超时后败者仍会落定，挂一个空处理避免未捕获拒绝。
    execution.catch(() => undefined);
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort(new Error(`工具 ${info.name} 超时`));
        reject(new ToolTimeoutError(info.name, timeoutMs));
      }, timeoutMs);
    });
    return await Promise.race([execution, deadline]);
  } catch (error) {
    if (error instanceof ToolTimeoutError) return timeoutResult(error.toolName, error.timeoutMs);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    parent.removeEventListener("abort", abortFromParent);
  }
}

const timeoutPolicyCore: Plugin.Object<TimeoutPolicyConfig> = {
  name: "lfaa-timeout-policy",
  inject: ["tools"],
  apply(ctx, config) {
    const policy = config ?? {};
    ctx.effect(() => ctx.tools.useToolMiddleware({
      id: "@lfaa/timeout-policy",
      aroundExecute: (next, info) => runWithTimeout(next, info, resolveTimeoutMs(info.name, policy)),
    }));
  },
};

/** 供测试与自定义装配直接挂载。 */
export function timeoutPolicyPlugin(ctx: Context, config: TimeoutPolicyConfig = {}): void {
  ctx.effect(() => ctx.tools.useToolMiddleware({
    id: "@lfaa/timeout-policy",
    aroundExecute: (next, info) => runWithTimeout(next, info, resolveTimeoutMs(info.name, config)),
  }));
}

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default timeoutPolicyCore;
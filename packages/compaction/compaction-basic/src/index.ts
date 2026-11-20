// @lfaa/compaction-basic：把上下文压缩做成可替换服务，默认复用 @lfaa/context 的预算压缩。
import { Service } from "@deepseek-ai/cordis";
import type { Context, Plugin } from "@deepseek-ai/cordis";
import {
  compactConversation,
  DEFAULT_CONTEXT_BUDGET_CHARS,
  isContextOverflowError,
  type CompactResult,
} from "@lfaa/context";
import type { LlmMessage } from "@lfaa/llm";

/** 压缩参数：缺省项由配置补齐，调用方按本轮预算覆盖。 */
export interface CompactionOptions {
  budgetChars?: number;
  toolCapChars?: number;
  keepRecentRounds?: number;
}

/** 服务配置：默认预算、单条工具结果上限与保留轮次。 */
export interface CompactionConfig {
  budgetChars?: number;
  toolCapChars?: number;
  keepRecentRounds?: number;
}

/** 把可选参数与默认值合并成一次压缩的确定参数。 */
export function resolveCompactionOptions(
  config: CompactionConfig = {},
  options: CompactionOptions = {},
): { budgetChars: number; toolCapChars?: number; keepRecentRounds?: number } {
  const positive = (value: number | undefined, fallback: number) =>
    (typeof value === "number" && Number.isFinite(value) && value >= 4_000 ? Math.floor(value) : fallback);
  const pick = (value: number | undefined) =>
    (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined);
  const toolCapChars = pick(options.toolCapChars ?? config.toolCapChars);
  const keepRecentRounds = pick(options.keepRecentRounds ?? config.keepRecentRounds);
  return {
    budgetChars: positive(options.budgetChars ?? config.budgetChars, DEFAULT_CONTEXT_BUDGET_CHARS),
    ...(toolCapChars !== undefined ? { toolCapChars } : {}),
    ...(keepRecentRounds !== undefined ? { keepRecentRounds } : {}),
  };
}

/** 上下文压缩服务：Agent 运行时可替换的实现点。 */
export class CompactionService extends Service {
  private readonly config: CompactionConfig;
  private pendingForced = false;

  constructor(ctx: Context, config: CompactionConfig = {}) {
    super(ctx, "compaction");
    this.config = config;
  }

  /** 请求下一次压缩强制生效（供「立即压缩上下文」工具调用）；消费一次即清除。 */
  requestCompaction(): void {
    this.pendingForced = true;
  }

  /** 是否有待处理的强制压缩请求（诊断用，不消费）。 */
  get hasPendingRequest(): boolean {
    return this.pendingForced;
  }

  /** 按预算压缩一次运行的对话；未超预算时原样返回；有强制请求时按更小预算硬压一次。 */
  compact(messages: ReadonlyArray<LlmMessage>, options: CompactionOptions = {}): CompactResult {
    const forced = this.pendingForced;
    this.pendingForced = false;
    const resolved = resolveCompactionOptions(this.config, options);
    if (!forced) return compactConversation(messages, resolved);
    const forcedBudget = Math.min(resolved.budgetChars, FORCED_BUDGET_CHARS);
    return compactConversation(messages, {
      budgetChars: forcedBudget,
      toolCapChars: resolved.toolCapChars ?? 600,
      keepRecentRounds: 2,
    });
  }

  /** 供运行器判断是否需要强制压缩后重试。 */
  isOverflow(error: unknown): boolean {
    return isContextOverflowError(error);
  }
}

/** 强制压缩时使用的预算上限：比默认小一个量级，确保一次「立即压缩」能真压出效果。 */
const FORCED_BUDGET_CHARS = 4_000;

declare module "@deepseek-ai/cordis" {
  interface Context {
    compaction: CompactionService;
  }
}

const compactionCore: Plugin.Object<CompactionConfig> = {
  name: "lfaa-compaction-basic",
  apply(ctx, config) {
    new CompactionService(ctx, config ?? {});
  },
};

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default compactionCore;
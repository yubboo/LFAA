// @lfaa/tool-result-pruner：工具结果的常规精简。清噪声、按行/字符截断，保留首尾并标注省略量。
import type { Plugin } from "@deepseek-ai/cordis";
import "@lfaa/tools";
import type { ToolExecutionResult } from "@lfaa/tools";

/** 单个工具的精简上限；未指定时用全局默认。 */
export interface ToolPruneLimit {
  maxLines?: number;
  maxChars?: number;
}

/** 精简配置：全局默认 + 按工具覆盖。 */
export interface ToolResultPrunerConfig {
  maxLines?: number;
  maxChars?: number;
  byTool?: Record<string, ToolPruneLimit>;
  /** 是否清理噪声（ANSI、行尾空格、连续空行），默认开启。 */
  cleanupNoise?: boolean;
}

/** 默认上限：单次工具结果 1200 行 / 4 万字符（落盘阈值之下，二者互补）。 */
export const PRUNER_DEFAULTS = {
  maxLines: 1_200,
  maxChars: 40_000,
} as const;

/** 去掉颜色控制符、行尾空白与连续空行，减少无意义字符。 */
export function cleanNoise(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "")
    .split(/\r?\n/u)
    .map((line) => line.replace(/[ \t]+$/u, ""))
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n");
}

/** 按行数保留首尾，中间写明省略行数。 */
export function capLines(text: string, maxLines: number): string {
  if (maxLines <= 0) return text;
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  const headCount = Math.max(1, Math.floor(maxLines * 0.7));
  const tailCount = Math.max(1, maxLines - headCount);
  const omitted = lines.length - headCount - tailCount;
  return [
    ...lines.slice(0, headCount),
    `…（中间 ${omitted} 行已省略）…`,
    ...lines.slice(-tailCount),
  ].join("\n");
}

/** 按字符保留首尾，中间写明省略字符数。 */
export function capChars(text: string, maxChars: number): string {
  if (maxChars <= 0 || text.length <= maxChars) return text;
  const headCount = Math.max(1, Math.floor(maxChars * 0.7));
  const tailCount = Math.max(1, maxChars - headCount);
  const omitted = text.length - headCount - tailCount;
  return `${text.slice(0, headCount)}\n…（中间 ${omitted} 个字符已省略）…\n${text.slice(-tailCount)}`;
}

/** 解析单个工具实际生效的上限。 */
export function resolveLimit(
  toolName: string,
  config: ToolResultPrunerConfig = {},
): { maxLines: number; maxChars: number } {
  const perTool = config.byTool?.[toolName] ?? {};
  const positive = (value: number | undefined, fallback: number) =>
    (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback);
  return {
    maxLines: positive(perTool.maxLines ?? config.maxLines, PRUNER_DEFAULTS.maxLines),
    maxChars: positive(perTool.maxChars ?? config.maxChars, PRUNER_DEFAULTS.maxChars),
  };
}

/** 精简一条结果：只处理成功结果，失败原文保持不动，便于排查。 */
export function pruneResult(
  result: ToolExecutionResult,
  toolName: string,
  config: ToolResultPrunerConfig = {},
): ToolExecutionResult {
  if (!result.ok) return result;
  const { maxLines, maxChars } = resolveLimit(toolName, config);
  let output = result.output;
  if (config.cleanupNoise !== false) output = cleanNoise(output);
  output = capLines(output, maxLines);
  output = capChars(output, maxChars);
  if (output === result.output) return result;
  return {
    ...result,
    output,
    summary: `${result.summary}（输出已精简）`,
    metadata: { ...result.metadata, pruned: true, originalChars: result.output.length },
  };
}

const toolResultPrunerCore: Plugin.Object<ToolResultPrunerConfig> = {
  name: "lfaa-tool-result-pruner",
  inject: ["tools"],
  apply(ctx, config) {
    const policy = config ?? {};
    ctx.effect(() => ctx.tools.useToolMiddleware({
      id: "@lfaa/tool-result-pruner",
      afterExecute: (result, info) => pruneResult(result, info.name, policy),
    }));
  },
};

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default toolResultPrunerCore;
export { toolResultPrunerCore };
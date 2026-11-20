// @lfaa/spill-local：超长工具结果落到本机文件，只回首尾窗口与文件路径，避免上下文被撑爆。
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Plugin } from "@deepseek-ai/cordis";
import "@lfaa/tools";
import type { ToolExecutionResult } from "@lfaa/tools";

/** 默认阈值与窗口：超过 24k 字符落盘，回 4k 头部 + 2k 尾部。 */
export const SPILL_DEFAULTS = {
  maxChars: 24_000,
  headChars: 4_000,
  tailChars: 2_000,
} as const;

/** 落盘配置：目录、阈值与首尾窗口均可调，测试可指向临时目录。 */
export interface SpillLocalConfig {
  root?: string;
  maxChars?: number;
  headChars?: number;
  tailChars?: number;
}

/** 是否需要落盘：只按字符数判断，空结果不动。 */
export function shouldSpill(output: string, maxChars: number): boolean {
  return output.length > maxChars;
}

/** 生成回给模型的首尾窗口，中间写明省略了多少字符。 */
export function buildSpillWindow(text: string, headChars: number, tailChars: number): string {
  if (text.length <= headChars + tailChars) return text;
  const omitted = text.length - headChars - tailChars;
  return `${text.slice(0, headChars)}\n…（中间 ${omitted} 个字符已省略）…\n${text.slice(-tailChars)}`;
}

/** 文件名只保留安全字符，避免工具名注入路径。 */
export function spillFileName(toolName: string, at: number, suffix = randomUUID().slice(0, 8)): string {
  const safe = toolName.replace(/[^\w.-]+/gu, "-").replace(/^-+|-+$/gu, "") || "tool";
  return `${at}-${safe}-${suffix}.txt`;
}

/** 把结果改写成「窗口 + 落盘路径」，其余字段（ok/summary/fileChange）保持。 */
export function formatSpilledResult(
  result: ToolExecutionResult,
  input: { filePath: string; originalChars: number; window: string },
): ToolExecutionResult {
  return {
    ...result,
    output: `${input.window}\n\n[完整输出 ${input.originalChars} 字符已保存到 ${input.filePath}，需要时可用 read_file 分段读取]`,
    summary: `${result.summary}（输出已落盘）`,
    metadata: { ...result.metadata, spilled: true, spillPath: input.filePath, originalChars: input.originalChars },
  };
}

/** 把超长输出写到 root 下，返回改写后的结果。 */
export async function spillResult(
  result: ToolExecutionResult,
  input: { toolName: string; root: string; sessionId: string; at?: number; config?: SpillLocalConfig },
): Promise<ToolExecutionResult> {
  const config = input.config ?? {};
  const maxChars = config.maxChars ?? SPILL_DEFAULTS.maxChars;
  if (!shouldSpill(result.output, maxChars)) return result;
  const dir = join(input.root, input.sessionId);
  await mkdir(dir, { recursive: true });
  const at = input.at ?? Date.now();
  const filePath = join(dir, spillFileName(input.toolName, at));
  await writeFile(filePath, result.output, "utf8");
  return formatSpilledResult(result, {
    filePath,
    originalChars: result.output.length,
    window: buildSpillWindow(result.output, config.headChars ?? SPILL_DEFAULTS.headChars, config.tailChars ?? SPILL_DEFAULTS.tailChars),
  });
}

/** 默认落盘根目录：~/.lfaa/spills。 */
export function defaultSpillRoot(): string {
  return join(homedir(), ".lfaa", "spills");
}

const spillLocalCore: Plugin.Object<SpillLocalConfig> = {
  name: "lfaa-spill-local",
  inject: ["tools"],
  apply(ctx, config) {
    const root = config?.root ?? defaultSpillRoot();
    ctx.effect(() => ctx.tools.useToolMiddleware({
      id: "@lfaa/spill-local",
      afterExecute: (result, info) => spillResult(result, {
        toolName: info.name,
        root,
        sessionId: info.context.sessionId,
        ...(config ? { config } : {}),
      }),
    }));
  },
};

/** 供测试与自定义装配直接挂载。 */
export function spillLocalPlugin(ctx: import("@deepseek-ai/cordis").Context, config: SpillLocalConfig = {}): void {
  const root = config.root ?? defaultSpillRoot();
  ctx.effect(() => ctx.tools.useToolMiddleware({
    id: "@lfaa/spill-local",
    afterExecute: (result, info) => spillResult(result, { toolName: info.name, root, sessionId: info.context.sessionId, config }),
  }));
}

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default spillLocalCore;
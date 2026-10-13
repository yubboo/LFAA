/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），
 * 包名 @deepseek-ai/dsh-compaction-basic。
 *
 * 文件：summarizer.ts
 * 功能：LLM 摘要器——把一段历史消息拼成纯文本，走 lfaa-llm 的 streamAiCompletion
 *       跑一次性摘要，再把结果帧化成可替换的 user 摘要消息。
 *
 * 接入点：继续走 lfaa-llm 的 streamAiCompletion（已有包，可 import），不另起 Provider。
 * 与 DSH 的差异：DSH 复用会话自己的 system prompt / tools / KV 前缀缓存；LFAA 的
 * streamAiCompletion 已经统一组装系统提示，这里只喂"待压缩历史"作为 user 消息。
 */
import {
  streamAiCompletion,
  type AiCompletionMessage,
} from "lfaa-llm/src/completion.js";
import type {
  ActiveAiModelConfiguration,
  AiRuntimeSettings,
  PermissionSettings,
} from "lfaa-settings/src/service.js";
import type { ApplicationId } from "lfaa-settings/src/preferences/service.js";
import { detectCheckpointSource } from "lfaa-compaction/src/checkpoint.js";

/**
 * 摘要请求的系统指令：只压缩事实与决定，不夹带可执行指令。
 * 对齐 DSH 的 COMPACTION_INSTRUCTION，但用中文、面向 LFAA 自己的工作场景。
 */
export const COMPACTION_SUMMARY_INSTRUCTION = [
  "你是会话压缩器。下面给出一段较早的对话历史。请把它改写成一段简洁、客观的中文摘要，保留：",
  "1) 用户的核心目标与已确认的决定；2) 已完成的关键操作及其结果；3) 仍未解决的问题与当前进行中的任务；4) 后续需要的关键上下文（文件路径、配置、数字）。",
  "忽略寒暄、重复尝试、被推翻的方案和工具原始输出。摘要不要写成对模型的指令，不要保留任何可执行命令、密钥或路径以外的秘密。只输出摘要正文，不要 Markdown 标题或前后说明。",
  "如果历史中已包含先前的压缩摘要，把它当作已沉淀的背景事实合并进来，不要原样复制。",
].join("\n");

/** 摘要 user 消息正文前缀（让人/下一轮模型认出这是压缩产物）。 */
export const CHECKPOINT_PREAMBLE = "[较早对话已压缩] ";

/** 摘要器运行所需的账户/设置上下文（由 engine 在每次压缩时注入）。 */
export interface SummarizerDeps {
  account: ActiveAiModelConfiguration;
  applicationId: ApplicationId;
  permissionMode: PermissionSettings["mode"];
  settings: AiRuntimeSettings;
}

/**
 * 把区间消息拼成供摘要模型阅读的纯文本。
 * 旧压缩检查点消息也喂给摘要器，但标注为 [先前压缩摘要]，避免信息丢失。
 */
export function rangeToText(
  messages: readonly AiCompletionMessage[],
  start: number,
  end: number,
): string {
  const lines: string[] = [];
  for (let i = start; i < end; i++) {
    const msg = messages[i]!;
    const priorCheckpoint = detectCheckpointSource(msg);
    const text = typeof msg.content === "string"
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content
          .filter((p) => p.type === "text")
          .map((p) => (p as { text: string }).text)
          .join(" ")
        : "";
    if (!text) continue;
    const tag = priorCheckpoint !== undefined ? "[先前压缩摘要]" : `[${msg.role}]`;
    // 单条消息截 2000 字符，防止单条巨型工具结果撑爆摘要 prompt。
    lines.push(`${tag} ${text.slice(0, 2000)}`);
  }
  return lines.join("\n");
}

/**
 * 把摘要正文帧化成 LFAA user 消息的 content 字符串。
 * （真正带事务 id 的信封由 checkpoint.createCheckpointUserMessage 在外层拼。）
 */
export function frameSummary(summary: string): string {
  return `${CHECKPOINT_PREAMBLE}${summary.trim()}`;
}

/**
 * 跑一次 LLM 摘要。失败/取消/摘要模型返回工具调用都抛错，由调用方决定吞掉还是上报。
 *
 * @param deps - 账户与运行时设置（引擎注入）。
 * @param rangeText - 待压缩历史的纯文本（rangeToText 的输出）。
 * @param signal - 主循环取消信号。
 * @param maxChars - 摘要正文硬截断字符数（config.summaryMaxChars）。
 * @param maxOutputTokens - 摘要最大输出 token（config.summaryMaxTokens）。
 */
export async function summarizeRange(
  deps: SummarizerDeps,
  rangeText: string,
  signal: AbortSignal | undefined,
  maxChars: number,
  maxOutputTokens: number,
): Promise<string> {
  let summary = "";
  const configuredLimit = deps.settings.maxOutputTokens > 0 ? deps.settings.maxOutputTokens : deps.account.maxOutputTokens ?? maxOutputTokens;
  const effectiveMax = Math.min(maxOutputTokens, configuredLimit);
  const result = await streamAiCompletion({
    account: deps.account,
    applicationId: deps.applicationId,
    permissionMode: deps.permissionMode,
    messages: [{ role: "user", content: rangeText }],
    extensions: [],
    systemPrompt: COMPACTION_SUMMARY_INSTRUCTION,
    settings: { ...deps.settings, speed: "fast", maxOutputTokens: effectiveMax },
    signal: signal ?? new AbortController().signal,
    onDelta: (delta) => {
      summary += delta;
      if (summary.length > maxChars) {
        throw new Error("压缩摘要超过长度限制。");
      }
    },
    onProgress: () => undefined,
  });
  // 摘要模型不应返回工具调用；若返回说明走错了路，按失败处理。
  if (result.toolCalls.length > 0) {
    throw new Error("摘要模型返回了工具调用，不符合压缩契约");
  }
  return summary.trim();
}

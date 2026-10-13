/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），
 * 包名 @deepseek-ai/dsh-compaction。
 *
 * 文件：checkpoint.ts
 * 功能：压缩检查点（checkpoint）的构造与识别。每次压缩把一段历史替换成一条 user
 * 摘要消息，这条消息必须带可识别标记——否则下次再压缩时会把"上次的摘要"当成普通
 * 对话历史重新摘要，丢失事务边界，也无法做幂等判断。
 *
 * LFAA 适配说明：DSH 在 message.source 字段上挂结构化标记（MessageSource 联合类型
 * 的一支 'compact-checkpoint'）。LFAA 的 AiCompletionMessage 没有 source 字段
 * （OpenAI 兼容协议只有 role/content/tool_calls/tool_call_id），这里改用内容信封前缀
 * `<<compacted-checkpoint:compactionId>>`：在摘要 user 消息正文第一行嵌入事务 id，
 * 后续压缩时用 detectCheckpointSource 解析出来。能力面与 DSH 对齐：能认出、能铸造、
 * 能携带事务 id，只是载体从结构化字段退化为文本信封。
 */
import type { AiCompletionMessage } from "lfaa-llm/src/completion.js";
import type { CompactionId } from "./brand.js";

/** 检查点消息内容信封的起始标记。 */
const CHECKPOINT_PREFIX = "<<compacted-checkpoint:" as const;
/** 检查点信封 id 段的结束标记。 */
const CHECKPOINT_SUFFIX = ">>" as const;

/** 持久化消息上能识别出的检查点标记（LFAA 版：从内容信封解析得到）。 */
export interface CompactionCheckpointSource {
  readonly kind: "compact-checkpoint";
  /** 产生这条摘要的压缩事务 id。 */
  readonly compactionId: CompactionId;
  /** 触发本次压缩的用户命令 id（手动压缩时才有）。 */
  readonly sourceCommandId?: string;
}

/**
 * 铸造一个与某次压缩事务绑定的检查点标记。
 *
 * @param compactionId - 所属压缩事务 id（推荐 randomUUID）。
 * @param sourceCommandId - 手动压缩时触发它的命令 id，可选。
 */
export function compactCheckpointSource(
  compactionId: CompactionId,
  sourceCommandId?: string,
): CompactionCheckpointSource {
  return sourceCommandId === undefined
    ? { kind: "compact-checkpoint", compactionId }
    : { kind: "compact-checkpoint", compactionId, sourceCommandId };
}

/**
 * 把检查点标记包成一条 LFAA user 消息：正文第一行是信封头，之后是摘要正文。
 * 这样模型请求里看到的是一条带标记的 user 消息，而不是结构异常。
 */
export function createCheckpointUserMessage(
  summaryText: string,
  source: CompactionCheckpointSource,
): AiCompletionMessage {
  const header = `${CHECKPOINT_PREFIX}${source.compactionId}${CHECKPOINT_SUFFIX}`;
  return { role: "user", content: `${header}\n${summaryText}` };
}

/**
 * 解析一条消息是不是压缩检查点；是则返回它携带的事务标记。
 * 用于"再次压缩时认出旧检查点"——把旧摘要也喂给新摘要器但标注出来，避免信息丢失。
 */
export function detectCheckpointSource(
  message: AiCompletionMessage,
): CompactionCheckpointSource | undefined {
  if (message.role !== "user") return undefined;
  const text = typeof message.content === "string" ? message.content : "";
  if (!text.startsWith(CHECKPOINT_PREFIX)) return undefined;
  const end = text.indexOf(CHECKPOINT_SUFFIX);
  if (end < 0) return undefined;
  const compactionId = text.slice(CHECKPOINT_PREFIX.length, end);
  if (compactionId.length === 0) return undefined;
  return { kind: "compact-checkpoint", compactionId };
}

/**
 * DSH 同名谓词的 LFAA 版：类型守卫，判断一个未知值是不是结构化的检查点标记。
 * （注意：这个谓词针对的是 compactCheckpointSource 返回的对象本身，
 * 而不是 AiCompletionMessage；消息识别请用 detectCheckpointSource。）
 */
export function isCompactCheckpointSource(
  value: unknown,
): value is CompactionCheckpointSource {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.kind === "compact-checkpoint"
    && typeof record.compactionId === "string"
    && record.compactionId.length > 0;
}

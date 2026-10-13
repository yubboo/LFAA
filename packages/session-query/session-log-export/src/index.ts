/**
 * 文件：index.ts
 * 功能：会话日志导出——把一个会话的头与消息折叠成 NDJSON 文本。
 * 作用：供用户导出自己的对话记录；输出只含公开投影字段。
 * 边界：导出前经过投影闸门，丢弃 model_history/工具原始参数/输出，绝不含密钥、凭证或认证头。
 * 关联文件：session-projection、session-persistence。
 */
import type { Context } from "@deepseek-ai/cordis";
import { projectMessage, projectSessionHeader, type SessionHeaderView, type SessionMessageView } from "lfaa-session-projection";

/** 导出入参：会话头与有序消息行。 */
export interface SessionLogExportInput {
  readonly header: Record<string, unknown>;
  readonly messages: readonly Record<string, unknown>[];
}

/** 导出结果。 */
export interface SessionLogExportResult {
  readonly header: SessionHeaderView;
  readonly messages: readonly SessionMessageView[];
  /** 每行一个 JSON 对象的换行分隔文本。 */
  readonly ndjson: string;
}

/** 折叠并序列化为 NDJSON；调用方负责账户归属校验。 */
export function exportSessionLog(input: SessionLogExportInput): SessionLogExportResult {
  const header = projectSessionHeader(input.header);
  const messages = input.messages.map(row => projectMessage(row));
  const lines = [JSON.stringify({ kind: "session", ...header }), ...messages.map(message => JSON.stringify({ kind: "message", ...message }))];
  return { header, messages, ndjson: `${lines.join("\n")}\n` };
}

export const name = "lfaaSessionLogExport";
export function apply(ctx: Context): void {
  ctx.provide(name, exportSessionLog);
}

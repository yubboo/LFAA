// 本地会话全文搜索：匹配会话标题与消息正文，生成带上下文的片段；不建立额外索引，按需扫描本地记录。
import type { ChatSessionRecord } from "@lfaa/memory";

export interface ChatSearchResult {
  sessionId: string;
  sessionTitle: string;
  archived: boolean;
  projectId: string | null;
  /** 标题命中时缺省；消息命中时指向具体消息。 */
  messageId?: string;
  role?: "user" | "assistant";
  snippet: string;
  match: "title" | "message";
  updatedAt: number;
}

export interface ChatSearchResponse {
  results: ChatSearchResult[];
  truncated: boolean;
}

const SNIPPET_BEFORE = 42;
const SNIPPET_AFTER = 78;

/** 截取命中位置周围的单行片段，并补齐省略号。 */
function makeSnippet(text: string, index: number, queryLength: number): string {
  const flat = text.replace(/\s+/gu, " ").trim();
  if (!flat) return "";
  const start = Math.max(0, index - SNIPPET_BEFORE);
  const end = Math.min(flat.length, index + queryLength + SNIPPET_AFTER);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

/** 搜索会话标题与消息正文；结果按会话更新时间、会话内消息倒序排列。 */
export function searchSessionRecords(
  records: ChatSessionRecord[],
  rawQuery: string,
  options: { limit?: number; perSession?: number } = {},
): ChatSearchResponse {
  const query = rawQuery.trim().slice(0, 100);
  if (!query) return { results: [], truncated: false };
  const needle = query.toLowerCase();
  const limit = Math.max(1, options.limit ?? 20);
  const perSession = Math.max(1, options.perSession ?? 3);
  const sorted = [...records].sort((left, right) => right.updatedAt - left.updatedAt);
  const results: ChatSearchResult[] = [];
  let truncated = false;

  for (const session of sorted) {
    if (results.length >= limit) { truncated = true; break; }
    const titleIndex = session.title.toLowerCase().indexOf(needle);
    if (titleIndex >= 0) {
      results.push({
        sessionId: session.id,
        sessionTitle: session.title,
        archived: session.archived,
        projectId: session.projectId,
        snippet: session.title,
        match: "title",
        updatedAt: session.updatedAt,
      });
    }
    let messageHits = 0;
    for (let index = session.messages.length - 1; index >= 0; index -= 1) {
      if (messageHits >= perSession || results.length >= limit) break;
      const message = session.messages[index];
      if (!message || typeof message.content !== "string") continue;
      const flat = message.content.replace(/\s+/gu, " ").trim();
      if (!flat) continue;
      const hitIndex = flat.toLowerCase().indexOf(needle);
      if (hitIndex < 0) continue;
      results.push({
        sessionId: session.id,
        sessionTitle: session.title,
        archived: session.archived,
        projectId: session.projectId,
        messageId: message.id,
        role: message.role,
        snippet: makeSnippet(flat, hitIndex, query.length),
        match: "message",
        updatedAt: session.updatedAt,
      });
      messageHits += 1;
    }
    if (messageHits >= perSession && session.messages.length > 0) {
      // 同一会话还有未展示的命中，整体结果标记为截断；继续收集其它会话。
      truncated = true;
    }
  }

  return { results: results.slice(0, limit), truncated };
}
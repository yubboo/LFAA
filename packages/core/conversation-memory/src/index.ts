/**
 * 文件：index.ts
 * 作用：保存、约束并清除账户隔离的 AI Work 对话记忆。
 * 不负责：Provider 调用、记忆启用设置、聊天历史或知识库资料。
 */
import { database } from "lfaa-storage-sqlite/src/database.js";

export const CONVERSATION_MEMORY_MAX_ITEMS = 16;
export const CONVERSATION_MEMORY_MAX_ITEM_CHARS = 240;
export const CONVERSATION_MEMORY_MAX_TOTAL_CHARS = 2400;

export interface ConversationMemorySnapshot {
  memories: string[];
  revision: number;
}

export interface ConversationMemorySettings {
  memoryEnabled: boolean;
  memoryFromToolChats: boolean;
}

interface ConversationMemoryRow {
  memories_json: string;
  revision: number;
}

function isSafeMemoryText(value: string): boolean {
  return value.length > 0
    && !/(?:-----BEGIN [A-Z ]+PRIVATE KEY-----|\b(?:api[ _-]?key|private[ _-]?key|password|passwd|secret|token|access[ _-]?token|bearer)\b|\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{16,}|AKIA[A-Z0-9]{16})\b|(?:密码|口令|密钥|令牌|访问令牌)\s*[:：=]|(?<!\d)1[3-9]\d{9}(?!\d)|(?<!\d)\d{17}[0-9Xx](?!\d)|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/iu.test(value);
}

/** 整理请求出本机前过滤可识别的凭据与高风险个人标识符；此规则不能识别所有敏感表达。 */
export function redactConversationMemorySource(value: string): string {
  return value
    .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/giu, "[私钥已过滤]")
    .replace(/((?:api[ _-]?key|private[ _-]?key|password|passwd|secret|access[ _-]?token|token|bearer|密码|口令|密钥|访问令牌|令牌)\s*[:：=]\s*)[^\s,;，；]+/giu, "$1[敏感内容已过滤]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/giu, "Bearer [敏感内容已过滤]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{16,}|AKIA[A-Z0-9]{16})\b/gu, "[疑似访问凭据已过滤]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, "[邮箱已过滤]")
    .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/gu, "[手机号已过滤]")
    .replace(/(?<!\d)\d{17}[0-9Xx](?!\d)/gu, "[身份证号已过滤]");
}

/** 设置中心的手动编辑入口使用严格校验，避免危险内容被静默丢弃后误清空整份记忆。 */
export function validateConversationMemoriesInput(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > CONVERSATION_MEMORY_MAX_ITEMS) return null;
  const memories: string[] = [];
  const seen = new Set<string>();
  let totalChars = 0;
  for (const candidate of value) {
    if (typeof candidate !== "string") return null;
    const normalized = candidate.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim();
    const key = normalized.toLocaleLowerCase("zh-CN");
    if (!isSafeMemoryText(normalized) || normalized.length > CONVERSATION_MEMORY_MAX_ITEM_CHARS || seen.has(key)
      || totalChars + normalized.length > CONVERSATION_MEMORY_MAX_TOTAL_CHARS) return null;
    seen.add(key);
    memories.push(normalized);
    totalChars += normalized.length;
  }
  return memories;
}

/** 规范模型输出或数据库快照，并限制每项与总记忆大小。 */
export function normalizeConversationMemories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const memories: string[] = [];
  const seen = new Set<string>();
  let totalChars = 0;
  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, CONVERSATION_MEMORY_MAX_ITEM_CHARS);
    const key = normalized.toLocaleLowerCase("zh-CN");
    if (!isSafeMemoryText(normalized) || seen.has(key) || totalChars + normalized.length > CONVERSATION_MEMORY_MAX_TOTAL_CHARS) continue;
    seen.add(key);
    memories.push(normalized);
    totalChars += normalized.length;
    if (memories.length >= CONVERSATION_MEMORY_MAX_ITEMS) break;
  }
  return memories;
}

/** 工具轮次还需满足用户单独启用的第二个开关。 */
export function isConversationMemoryGenerationAllowed(settings: ConversationMemorySettings, toolCallCount: number): boolean {
  return settings.memoryEnabled && Number.isInteger(toolCallCount) && toolCallCount >= 0
    && (toolCallCount === 0 || settings.memoryFromToolChats);
}

/** 仅接收 Provider 返回的 JSON 记忆列表；畸形输出不改写现有资料。 */
export function parseConversationMemoryOutput(output: string): string[] | null {
  const trimmed = output.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const memories = (parsed as Record<string, unknown>).memories;
    if (!Array.isArray(memories)) return null;
    return normalizeConversationMemories(memories);
  } catch {
    return null;
  }
}

function readConversationMemoryRow(userId: string): ConversationMemoryRow | undefined {
  return database.prepare("SELECT memories_json, revision FROM conversation_memories WHERE user_id = ?").get(userId) as ConversationMemoryRow | undefined;
}

export function getConversationMemorySnapshot(userId: string): ConversationMemorySnapshot {
  const row = readConversationMemoryRow(userId);
  if (!row) return { memories: [], revision: 0 };
  try {
    return { memories: normalizeConversationMemories(JSON.parse(row.memories_json) as unknown), revision: row.revision };
  } catch {
    return { memories: [], revision: row.revision };
  }
}

function sameMemories(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((memory, index) => memory === right[index]);
}

/** 只有调用方读取的 revision 仍是当前值时才替换，旧整理请求不能覆盖更新或删除。 */
export function replaceConversationMemories(userId: string, value: unknown, expectedRevision: number): boolean {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return false;
  const memories = normalizeConversationMemories(value);
  const current = getConversationMemorySnapshot(userId);
  if (current.revision !== expectedRevision) return false;
  if (sameMemories(current.memories, memories)) return true;
  const encoded = JSON.stringify(memories);
  if (expectedRevision === 0) {
    return database.prepare(`
      INSERT INTO conversation_memories (user_id, memories_json, revision)
      VALUES (?, ?, 1)
      ON CONFLICT(user_id) DO UPDATE SET
        memories_json = excluded.memories_json,
        revision = conversation_memories.revision + 1,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE conversation_memories.revision = 0
    `).run(userId, encoded).changes === 1;
  }
  return database.prepare(`
    UPDATE conversation_memories
    SET memories_json = ?, revision = revision + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE user_id = ? AND revision = ?
  `).run(encoded, userId, expectedRevision).changes === 1;
}

/** 清空内容并递增 revision；空行是并发删除墓碑，不包含记忆正文。 */
export function clearConversationMemories(userId: string): void {
  database.prepare(`
    INSERT INTO conversation_memories (user_id, memories_json, revision)
    VALUES (?, '[]', 1)
    ON CONFLICT(user_id) DO UPDATE SET
      memories_json = '[]',
      revision = conversation_memories.revision + 1,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `).run(userId);
}

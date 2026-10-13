/**
 * 文件：codec.ts
 * 功能：会话日志物理信封的内容摘要与哈希链校验原语。
 * 作用：把 persistence.ts 内联的摘要算法提升为协议层共享函数，迁移链与校验方可复用同一判定。
 * 边界：仅做完整性计算，不触碰密钥；摘要输入永远是去 checksum 后的事件内容。
 * 关联文件：types.ts、session-persistence-jsonl/src/persistence.ts。
 */
import { createHash } from "node:crypto";
import { encode } from "lfaa-storage-json/src/index.js";
import type { SessionCommit, SessionLogEvent } from "./types.js";

/** 计算某段内容的 sha256 摘要（与磁盘写入口径一致：先 JSON 编码再取字节）。 */
export function digestContent(content: unknown): string {
  return createHash("sha256").update(encode(content)).digest("hex");
}

/** 去掉信封里的 checksum 字段，得到参与摘要的内容体。 */
export function eventContent(event: SessionLogEvent): Omit<SessionLogEvent, "checksum"> {
  const { checksum: _checksum, ...content } = event;
  return content;
}

/**
 * 校验单条日志事件相对于上一事件的连续性与完整性。
 * @param event 待校验事件
 * @param previousChecksum 上一事件的 checksum（首事件传空串）
 * @param expectedSequence 期望序号（首事件为 1）
 * @returns 是否通过
 */
export function verifyLogEventLink(event: SessionLogEvent, previousChecksum: string, expectedSequence: number): boolean {
  if (event.format !== 1 || typeof event.sessionId !== "string" || typeof event.transaction !== "string" || !Array.isArray(event.changes)) return false;
  if (event.sequence !== expectedSequence || event.previous !== previousChecksum) return false;
  return event.checksum === digestContent(eventContent(event));
}

/**
 * 依据一次提交与上一事件状态，构造下一条物理事件（迁移链重写日志时使用）。
 * 不写盘；调用方负责事务锁与文件替换。
 */
export function buildNextLogEvent(commit: SessionCommit, previous: { sequence: number; checksum: string }): SessionLogEvent {
  const content = { format: 1 as const, sessionId: commit.sessionId, transaction: commit.transaction, changes: commit.changes, sequence: previous.sequence + 1, previous: previous.checksum };
  return { ...content, checksum: digestContent(content) };
}

/** 空链起点：首事件之前的序号与摘要。 */
export const EMPTY_LOG_HEAD = { sequence: 0, checksum: "" } as const;

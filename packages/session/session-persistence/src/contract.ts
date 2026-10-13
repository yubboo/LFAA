/**
 * 文件：contract.ts
 * 功能：会话持久化后端协议（读写 / 列出 / 删除）。
 * 作用：把现有 session-persistence-jsonl 的 SessionRepository 抽象成稳定接口，
 *      让投影、统计、标题、查询等消费方依赖协议而非具体 JSONL 实现。
 * 对齐方式：现有 jsonl 仓库以 `satisfies SessionPersistenceBackend` 做结构性对齐（增量、保持导出兼容）。
 * 边界：协议只暴露受控投影方法；原始模型请求、工具参数/输出与密钥不经过本接口外泄。
 * 关联文件：errors.ts、session-persistence-jsonl/src/repository.ts。
 */
import type { SessionChange, SessionTable } from "lfaa-session-format";

/** 消息页单条结果。message/feedback 与 jsonl 现实一致，均允许为 null（删除占位）。 */
export interface SessionMessagePageItem {
  readonly message: Record<string, unknown> | null;
  readonly feedback?: Record<string, unknown> | null;
}

/** 消息分页游标。 */
export interface SessionMessageCursor {
  readonly createdAt: string;
  readonly order: number;
}

/** 持久化后端协议：结构性描述 SessionRepository 的公共能力。 */
export interface SessionPersistenceBackend {
  /** 校验仓库处于可写/可读状态；失败即抛错。 */
  assertReady(): void;
  /** 原子提交一组变更（内部走事务锁与 fsync）。签名与现有 jsonl 仓库保持一致。 */
  commit(sessionId: string, changes: SessionChange[]): void;
  /** 读取一条记录；不存在返回 undefined。 */
  get(table: SessionTable, id: string): unknown;
  /** 跨会话遍历某张表（带谓词与字段投影）。 */
  all(table: SessionTable, predicate?: (record: Record<string, unknown>) => boolean, fields?: readonly string[]): unknown[];
  /** 读取单个会话某张表的记录。 */
  allForSession(table: SessionTable, sessionId: string, fields?: readonly string[]): unknown[];
  /** 列出某账户、某归档态的会话头（轻量投影，最多 200 条）。 */
  listHeaders(userId: string, archived: boolean, appId?: string): unknown[];
  /** 单会话消息页（最近页起，经完整哈希链校验）。 */
  readMessagePage(sessionId: string, before: SessionMessageCursor | undefined, limit: number): Promise<{ items: SessionMessagePageItem[]; hasMore: boolean }>;
  /** 单会话结构化事件页（after 游标，投影函数过滤字段）。 */
  readEventPage(sessionId: string, after: number, limit: number, project: (event: Record<string, unknown>) => Record<string, unknown> | null, signal?: AbortSignal): Promise<{ items: Record<string, unknown>[]; hasMore: boolean }>;
  /** 重写单会话日志（如脱敏），返回被重写的事务数。 */
  rewriteSession(sessionId: string, transform: (commit: { sessionId: string; transaction: string; changes: SessionChange[] }) => { sessionId: string; transaction: string; changes: SessionChange[] }): number;
  /** 删除某账户的全部会话并通知监听方。 */
  removeUser(userId: string): void;
  /** 订阅会话被删除事件。 */
  onSessionsRemoved(listener: (sessionIds: readonly string[]) => void): () => void;
  /** 会话最新计划模式（轻量事件投影）。 */
  planMode(sessionId: string): boolean;
  /** 诊断缓存工作量（不含正文/路径）。 */
  cacheStats(): { sessions: number; bytes: number };
  /** 释放写锁与句柄。 */
  close(): void;
}

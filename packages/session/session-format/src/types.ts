/**
 * 文件：types.ts
 * 功能：把 LFAA 现有 session-persistence-jsonl 的落盘格式协议化为显式 schema。
 * 作用：定义格式版本、物理 JSONL 事件信封、逻辑表与会话头/消息/用量/事件记录的权威形状。
 * 边界：会话数据是用户数据；本层只做形状与校验，绝不写入密钥、凭证或认证头。
 * 关联文件：session-persistence-jsonl/src/persistence.ts（同一格式的磁盘实现）、
 *          session-format-catalog/src/index.ts（版本目录与迁移判定）。
 * 移植说明：类型骨架参考 DeepSeek Harness session-format（MIT，commit 639ed015397290b3745d163aafe02ffee4aa3f84），
 *          但按 LFAA 真实的「四表变更 + 哈希链事件信封」裁剪，不复用 DSH 的流式 codec/stage 框架。
 */

/** 当前落盘格式版本号。与 persistence.ts 物理事件里的 `format` 字段一致。 */
export const SESSION_FORMAT_VERSION = 1 as const;

/** 逻辑表名：会话头、消息、Provider 用量与结构化执行事件共用同一条受控追加日志。 */
export type SessionTable = "ai_sessions" | "ai_messages" | "ai_usage" | "session_events";

/** 全部逻辑表，供校验与遍历使用。 */
export const SESSION_TABLES: readonly SessionTable[] = ["ai_sessions", "ai_messages", "ai_usage", "session_events"];

/** 单条逻辑变更：把一张表的一条记录改写成新值（null/undefined 表示删除）。 */
export interface SessionChange {
  readonly table: SessionTable;
  readonly key: string;
  readonly value: Record<string, unknown> | null;
}

/** 一次原子提交：同一会话内的一组变更，用唯一事务 ID 幂等去重。 */
export interface SessionCommit {
  readonly sessionId: string;
  readonly transaction: string;
  readonly changes: readonly SessionChange[];
}

/**
 * 物理 JSONL 事件信封（events.jsonl 的每一行）。
 * sequence 从 1 递增；previous 指向前一事件内容摘要；checksum 是本事件内容摘要，构成防篡改哈希链。
 */
export interface SessionLogEvent extends SessionCommit {
  readonly format: typeof SESSION_FORMAT_VERSION;
  readonly sessionId: string;
  readonly sequence: number;
  readonly previous: string;
  readonly checksum: string;
}

/** 会话头记录（ai_sessions）的权威形状。字段名与磁盘 snake_case 保持一致。 */
export interface SessionHeaderRecord {
  readonly id: string;
  readonly user_id: string;
  readonly app_id: string;
  readonly title: string;
  /** 0=正常，1=归档。 */
  readonly archived: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly workspace_project_id?: string | null;
  readonly workspace_node_id?: string | null;
  readonly workspace_directory?: string | null;
  readonly workspace_title?: string | null;
  /** 最近一次提交事务 ID，仅由持久化层写入；不参与业务语义。 */
  readonly _revision?: string;
  /** 落盘格式版本（出现在物理信封的是顶层 format；头记录也可携带以便迁移识别）。 */
  readonly format?: number;
}

/** 消息记录（ai_messages）的权威形状。 */
export interface SessionMessageRecord {
  readonly id: string;
  readonly session_id: string;
  /** 同一会话内的稳定排序号，配合 created_at 做分页游标。 */
  readonly _order: number;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly status: "complete" | "queued" | "streaming" | "interrupted" | "error";
  readonly created_at: string;
  /** 活动轨迹 JSON 字符串；展示层解析，存储层不解释。 */
  readonly activity_json: string;
  readonly run_id?: string;
  readonly kernel_run_id?: string;
  /** 受保护的模型历史（含工具原始参数/输出），不进展示 API。 */
  readonly model_history?: unknown;
}

/** Provider 用量记录（ai_usage）的权威形状。只记录真实返回的 token 数，不估算费用。 */
export interface SessionUsageRecord {
  readonly id: string;
  readonly user_id: string;
  readonly session_id: string;
  readonly message_id: string;
  readonly provider_id: string;
  readonly model_id: string;
  readonly prompt_tokens: number | null;
  readonly completion_tokens: number | null;
  readonly created_at: string;
}

/** 结构化执行事件记录（session_events）的权威形状。 */
export interface SessionEventRecord {
  readonly id: string;
  readonly session_id: string;
  /** 会话内单调递增序号，事件页以此做 after 游标。 */
  readonly seq: number;
  readonly type: string;
  readonly time: string;
  readonly data: Record<string, unknown>;
  readonly user_id?: string;
  readonly app_id?: string;
}

/** 已登记的可见执行事件类型词表（诊断/轨迹允许公开的子集）。 */
export const VISIBLE_SESSION_EVENT_TYPES = new Set<string>([
  "session/created", "session/title", "session/project", "session/archived", "session/plan-mode", "session/side-chat",
  "turn/start", "turn/end", "user/message", "assistant/message", "step/start", "step/end",
  "tool/call", "tool/result", "usage/record"
]);

/** 判定一个值是否为纯 JSON 标量（用于落盘边界的无损性检查）。 */
export function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(isJsonValue);
  return false;
}

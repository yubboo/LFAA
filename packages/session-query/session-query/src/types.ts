/**
 * 文件：types.ts
 * 功能：会话查询引擎的请求/结果类型与抽象接口。
 * 作用：定义跨会话标题检索、单会话消息全文检索与事件读取的统一契约；具体存储由 session-query-sqlite 提供。
 * 边界：查询只作用于已投影的公开文本（标题、用户/助手可见正文）；模型请求、工具原始参数/输出与凭证不进索引。
 * 关联文件：session-query-sqlite、tool-session-query、session-persistence。
 * 移植说明：概念参考 DSH session-query 的 search/trace 划分，按 LFAA 四表行结构裁剪。
 */

/** 一条会话标题检索命中。 */
export interface SessionQueryHit {
  readonly sessionId: string;
  readonly title: string;
  readonly updatedAt: string;
}

/** 一条消息全文检索命中（带截取片段）。 */
export interface SessionMessageHit {
  readonly sessionId: string;
  readonly messageId: string;
  readonly role: "user" | "assistant";
  readonly snippet: string;
}

/** 跨会话标题检索请求。 */
export interface SessionSearchRequest {
  readonly userId: string;
  readonly query?: string;
  readonly appId?: string;
  readonly limit?: number;
}

/** 单会话消息检索请求。 */
export interface SessionMessageSearchRequest {
  readonly sessionId: string;
  readonly query: string;
  readonly limit?: number;
}

/** 会话查询引擎抽象接口（由 sqlite 实现）。 */
export interface SessionQueryEngine {
  /** 把一个会话头投影写入/更新索引。 */
  indexHeader(header: Record<string, unknown>): void;
  /** 把一条消息投影写入索引。 */
  indexMessage(message: Record<string, unknown>): void;
  /** 删除某会话的全部索引内容。 */
  removeSession(sessionId: string): void;
  /** 跨会话标题检索。 */
  searchSessions(request: SessionSearchRequest): SessionQueryHit[];
  /** 单会话消息全文检索。 */
  searchMessages(request: SessionMessageSearchRequest): SessionMessageHit[];
  /** 关闭底层句柄。 */
  close(): void;
}

/**
 * 文件：errors.ts
 * 功能：持久化层共享错误类型。
 * 作用：让任何后端实现（当前是 JSONL）以同一组错误向调用方表达「未找到 / 损坏 / 格式不支持 / 已失败」。
 * 边界：错误消息只暴露会话 ID 与诊断要点，不回显正文、账户密钥或主机路径。
 * 关联文件：contract.ts、session-persistence-jsonl。
 */

/** 持久化操作的基类错误。 */
export class SessionPersistenceError extends Error {
  constructor(message: string) { super(message); this.name = "SessionPersistenceError"; }
}

/** 会话或记录不存在。 */
export class SessionPersistenceNotFoundError extends SessionPersistenceError {
  constructor(sessionId: string) { super(`会话不存在：${sessionId}。`); this.name = "SessionPersistenceNotFoundError"; }
}

/** 日志哈希链或事务校验失败，且已把仓库标记为不可继续写。 */
export class SessionPersistenceCorruptionError extends SessionPersistenceError {
  constructor(detail: string) { super(`会话日志完整性校验失败：${detail}`); this.name = "SessionPersistenceCorruptionError"; }
}

/** 落盘格式版本不被当前构建理解（可能由更新的 harness 写入）。 */
export class SessionFormatUnsupportedError extends SessionPersistenceError {
  constructor(version: number) { super(`会话格式 v${version} 不被当前版本支持。`); this.name = "SessionFormatUnsupportedError"; }
}

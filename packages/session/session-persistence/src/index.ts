/**
 * 文件：index.ts
 * 功能：登记持久化协议描述服务，并对外导出后端契约与共享错误。
 * 作用：消费方（投影/统计/查询）从这里拿到 SessionPersistenceBackend 类型；
 *      具体后端实例由 session-persistence-jsonl 以 lfaaSessionPersistence 提供。
 * 关联文件：contract.ts、errors.ts、session-persistence-jsonl。
 */
import type { Context } from "@deepseek-ai/cordis";

export * from "./contract.js";
export * from "./errors.js";

/** 协议描述：仅声明本构建支持的操作面，不承载任何用户数据。 */
export interface SessionPersistenceContract {
  readonly operations: readonly string[];
}

export const name = "lfaaSessionPersistenceContract";
export function apply(ctx: Context): void {
  const contract: SessionPersistenceContract = {
    operations: ["commit", "get", "all", "allForSession", "listHeaders", "readMessagePage", "readEventPage", "rewriteSession", "removeUser", "onSessionsRemoved", "planMode", "close"]
  };
  ctx.provide(name, contract);
}

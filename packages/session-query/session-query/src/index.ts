/**
 * 文件：index.ts
 * 功能：登记会话查询引擎协议服务，并导出查询类型。
 * 作用：控制器/工具面向本包的抽象接口编程，存储实现可替换（当前为 node:sqlite）。
 * 关联文件：types.ts、session-query-sqlite、tool-session-query。
 */
import type { Context } from "@deepseek-ai/cordis";

export * from "./types.js";

/** 引擎描述服务（不持数据）。 */
export interface SessionQueryDescriptor {
  readonly backend: string;
}

export const name = "lfaaSessionQuery";
export function apply(ctx: Context): void {
  ctx.provide(name, { backend: "node:sqlite" } satisfies SessionQueryDescriptor);
}

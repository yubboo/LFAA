/**
 * 文件：index.ts
 * 功能：登记会话格式协议服务 lfaaSessionFormat，并对外暴露格式原语。
 * 作用：让持久化、投影、查询等包以同一套版本号与校验函数对齐 LFAA 落盘格式。
 * 关联文件：types.ts、codec.ts、session-format-catalog。
 */
import type { Context } from "@deepseek-ai/cordis";
import { SESSION_FORMAT_VERSION, SESSION_TABLES } from "./types.js";

export * from "./types.js";
export * from "./codec.js";

/** 会话格式服务：当前版本号与表名清单（供运行期自省，不携带任何用户数据）。 */
export interface SessionFormatService {
  readonly currentVersion: number;
  readonly tables: readonly string[];
}

export const name = "lfaaSessionFormat";
export function apply(ctx: Context): void {
  const service: SessionFormatService = { currentVersion: SESSION_FORMAT_VERSION, tables: SESSION_TABLES };
  ctx.provide(name, service);
}

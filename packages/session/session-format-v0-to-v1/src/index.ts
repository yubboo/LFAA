/**
 * 文件：index.ts
 * 功能：v0 → v1 格式迁移边。
 * 作用：把「旧 SQLite 表（无 format 字段）」的会话头规范化为 v1 信封逻辑头。
 * 裁剪说明：DSH 的 v0→v1 迁移处理的是其历史 JSON 行格式；LFAA 的真实 v0 是 repository.ts 里被退役的
 *          旧 SQLite 表（ai_sessions/ai_messages/ai_usage，无 format 字段）。真正的表→JSONL 搬移已在
 *          session-persistence-jsonl 的 migrate() 完成；本包只承担「头记录补 format:1 + 字段归一」这一段纯函数。
 * 边界：不读写磁盘、不碰密钥；输入是已校验的行记录。
 * 关联文件：session-format、session-persistence-jsonl/src/repository.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import { SESSION_FORMAT_VERSION } from "lfaa-session-format";

/** 判断一行是否像尚未标记版本的旧 v0 头记录。 */
export function isLegacyV0Header(row: Record<string, unknown>): boolean {
  return typeof row.id === "string" && typeof row.title === "string" && row.format === undefined;
}

/** 把旧头归一为 v1：补 format 字段、把 archived 归一为 0|1，其余字段原样保留。 */
export function migrateV0HeaderToV1(row: Record<string, unknown>): Record<string, unknown> {
  const archived = Number(row.archived);
  return {
    ...row,
    archived: archived === 1 ? 1 : 0,
    format: SESSION_FORMAT_VERSION
  };
}

export const name = "lfaaSessionFormatV0ToV1";
export function apply(ctx: Context): void {
  ctx.provide(name, { fromVersion: 0, toVersion: SESSION_FORMAT_VERSION, migrateHeader: migrateV0HeaderToV1 });
}

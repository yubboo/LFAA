/**
 * 文件：index.ts
 * 功能：v3 → v4 迁移边（前向，占位语义明确）。
 * 裁剪说明：v3/v4 的物理形状在 LFAA 均未定义；本边提供描述与能力探测，目标写入器落地前恒不可迁移。
 *          DSH 该边处理大量历史语法收敛，LFAA 无对应历史数据，故只保留稳定的边骨架，避免无效移植。
 * 边界：纯判定，不读写磁盘。
 * 关联文件：session-format-v2-to-v3、session-format-catalog。
 */
import type { Context } from "@deepseek-ai/cordis";

export const V4_WRITER_AVAILABLE = false;

export function canMigrateV3ToV4(): boolean {
  return V4_WRITER_AVAILABLE;
}

export const name = "lfaaSessionFormatV3ToV4";
export function apply(ctx: Context): void {
  ctx.provide(name, { fromVersion: 3, toVersion: 4, available: V4_WRITER_AVAILABLE });
}

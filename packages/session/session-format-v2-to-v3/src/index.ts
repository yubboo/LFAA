/**
 * 文件：index.ts
 * 功能：v2 → v3 迁移边（前向，占位语义明确）。
 * 裁剪说明：v2/v3 的物理形状在 LFAA 均未定义；本边提供描述与能力探测，目标写入器落地前恒不可迁移，
 *          不凭空捏造字段。等 v2→v3 真实差异确定后在此补迁移逻辑。
 * 边界：纯判定，不读写磁盘。
 * 关联文件：session-format-v1-to-v2、session-format-catalog。
 */
import type { Context } from "@deepseek-ai/cordis";

export const V3_WRITER_AVAILABLE = false;

export function canMigrateV2ToV3(): boolean {
  return V3_WRITER_AVAILABLE;
}

export const name = "lfaaSessionFormatV2ToV3";
export function apply(ctx: Context): void {
  ctx.provide(name, { fromVersion: 2, toVersion: 3, available: V3_WRITER_AVAILABLE });
}

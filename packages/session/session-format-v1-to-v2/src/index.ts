/**
 * 文件：index.ts
 * 功能：v1 → v2 迁移边（前向，占位语义明确）。
 * 裁剪说明：LFAA 当前只有 v1 落盘格式，尚未定义 v2 的物理形状与写入器。因此本边先提供「边描述 + 能力探测」，
 *          在 v2 写入器落地前对任何输入返回不可迁移，避免凭空捏造格式。待 v2 发布时在此补 migrateHeader/migrateChanges。
 * 边界：纯判定，不读写磁盘。
 * 关联文件：session-format-catalog。
 */
import type { Context } from "@deepseek-ai/cordis";

/** 当前是否具备 v2 写入能力（v2 未发布恒为 false）。 */
export const V2_WRITER_AVAILABLE = false;

/** 迁移能力探测：v2 未定义前一律拒绝。 */
export function canMigrateV1ToV2(): boolean {
  return V2_WRITER_AVAILABLE;
}

export const name = "lfaaSessionFormatV1ToV2";
export function apply(ctx: Context): void {
  ctx.provide(name, { fromVersion: 1, toVersion: 2, available: V2_WRITER_AVAILABLE });
}

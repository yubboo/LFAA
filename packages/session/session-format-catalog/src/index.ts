/**
 * 文件：index.ts
 * 功能：装配会话格式目录（当前版本 + 历史版本分类）。
 * 作用：读取一个头记录的版本号，判定它是当前格式、需要迁移、还是不被支持/损坏。
 * 裁剪说明：DSH 的目录内嵌了 v0..v4 的全套物理 codec 与流式迁移 stage；LFAA 现有落盘格式即为 v1，
 *          没有更早的磁盘数据，也尚未发布 v2+。因此本目录只承担「版本分类与迁移判定」这一稳定职责，
 *          具体相邻迁移由 session-format-v*-to-v* 包提供并在运行期按版本跨度挂接（见迁移链包）。
 * 边界：不读写用户会话内容，仅依据版本号做路由判定。
 * 关联文件：session-format、session-format-v0-to-v1 等迁移包。
 */
import type { Context } from "@deepseek-ai/cordis";
import { SESSION_FORMAT_VERSION } from "lfaa-session-format";

/** 头记录版本读取结果：当前 / 需要迁移 / 不支持 / 损坏。 */
export type SessionHeaderReadResult =
  | { readonly status: "current"; readonly storedVersion: number; readonly targetVersion: number }
  | { readonly status: "migration-required"; readonly storedVersion: number; readonly targetVersion: number }
  | { readonly status: "unsupported"; readonly storedVersion: number; readonly targetVersion: number; readonly reason: string };

/** 版本目录：把物理版本号翻译成可执行动作。 */
export interface SessionFormatCatalog {
  readonly currentVersion: number;
  /** 已被本构建理解并可直接读取的版本号集合。 */
  readonly supportedVersions: readonly number[];
  /** 只依据头记录的版本号分类，不读取事件正文。 */
  readHeader(storedVersion: unknown): SessionHeaderReadResult;
}

export function createSessionFormatCatalog(): SessionFormatCatalog {
  // LFAA 当前只有 v1 一种落盘格式；higher 版本属于「未来写入、需前向迁移」。
  const supported = [SESSION_FORMAT_VERSION];
  return {
    currentVersion: SESSION_FORMAT_VERSION,
    supportedVersions: supported,
    readHeader(storedVersion: unknown): SessionHeaderReadResult {
      const target = SESSION_FORMAT_VERSION;
      if (typeof storedVersion !== "number" || !Number.isInteger(storedVersion)) {
        return { status: "unsupported", storedVersion: NaN, targetVersion: target, reason: "会话头缺少合法的格式版本号。" };
      }
      if (storedVersion === target) return { status: "current", storedVersion, targetVersion: target };
      if (storedVersion > target) {
        // 由更新的 harness 写入：必须经迁移链降到当前版本，本目录不擅自解释。
        return { status: "migration-required", storedVersion, targetVersion: target };
      }
      // LFAA 从未发布低于 v1 的磁盘格式；出现更低版本号视为来源不明，拒绝解读。
      return { status: "unsupported", storedVersion, targetVersion: target, reason: `不支持的历史格式版本 v${storedVersion}。` };
    }
  };
}

export const name = "lfaaSessionFormatCatalog";
export function apply(ctx: Context): void {
  ctx.provide(name, createSessionFormatCatalog());
}

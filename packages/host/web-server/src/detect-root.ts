// @lfaa/web-server：从起始目录向上定位 LFAA 工程根目录，供开发模式回退使用。
// 生产安装包没有 pnpm-workspace.yaml/.git，必须由调用方显式传入用户工作根，不能依赖本函数。
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** 向上查找含 `pnpm-workspace.yaml` 或 `.git` 的目录；找不到时按旧行为回退两步。 */
export function detectProjectRoot(startDir: string): string {
  let cursor = resolve(startDir);
  for (let index = 0; index < 8; index += 1) {
    if (existsSync(resolve(cursor, "pnpm-workspace.yaml")) || existsSync(resolve(cursor, ".git"))) {
      return cursor;
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return resolve(startDir, "../..");
}
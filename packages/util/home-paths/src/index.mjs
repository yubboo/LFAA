/**
 * 功能：定位开发或桌面运行根目录。
 * 作用：消除迁移与编译目录深度对数据位置的影响。
 * 关联文件：配置模块、Daemon 和桌面打包脚本。
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
export function findRepositoryRoot(moduleUrl) {
  let current = dirname(fileURLToPath(moduleUrl));
  while (true) {
    if (existsSync(resolve(current, "scripts", "resolve-data-directory.mjs"))) return current;
    const parent = dirname(current);
    if (parent === current) throw new Error("无法定位 LFAA 运行根目录。");
    current = parent;
  }
}

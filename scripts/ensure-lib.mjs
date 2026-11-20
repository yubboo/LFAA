// 开发启动前产物自检：关键包 lib 缺失时自动重建，避免“tsbuildinfo 还在但产物没了”导致的启动失败。
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

/** 开发期必须存在的产物：vendor loader 被应用直接 import，缺失必然启动失败。 */
const REQUIRED = [
  "vendor/loader/lib/index.js",
  "packages/core/tools/lib/index.js",
  "packages/bundle/web/lib/index.js",
  "packages/host/web-server/lib/index.js",
];

const missing = REQUIRED.filter((relativePath) => !existsSync(join(ROOT, relativePath)));
if (missing.length === 0) process.exit(0);

console.log(`检测到 ${missing.length} 个产物缺失，先重建：${missing.join("、")}`);

// 产物被删但 tsbuildinfo 仍在时，tsc -b 会误判“已最新”，必须一并清掉。
for (const relativePath of missing) {
  const libDir = join(ROOT, relativePath.split("/").slice(0, -2).join("/"), "lib");
  rmSync(join(libDir, "tsconfig.tsbuildinfo"), { force: true });
  rmSync(join(libDir, "types", "tsconfig.tsbuildinfo"), { force: true });
}

// 直接复用完整构建脚本：它先清空各包 lib 再编译打包，避免增量状态造成“以为重建了”。
const build = spawnSync(process.execPath, [join(ROOT, "scripts", "build.mjs")], { cwd: ROOT, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const stillMissing = REQUIRED.filter((relativePath) => !existsSync(join(ROOT, relativePath)));
if (stillMissing.length > 0) {
  console.error(`重建后仍缺少产物：${stillMissing.join("、")}`);
  process.exit(1);
}

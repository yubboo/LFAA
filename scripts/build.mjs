// 构建入口：清空 lib → tsc -b 产出 lib/types → tsdown 打包出 lib 入口 → 构建 Web 产物。
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PACKAGES_DIR = join(ROOT, "packages");
const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc");

/** 枚举真实包目录（与 tsconfig / tsdown 生成器保持同一规则）。 */
function discoverPackages() {
  const found = [];
  for (const group of readdirSync(PACKAGES_DIR)) {
    const groupDir = join(PACKAGES_DIR, group);
    if (!statSync(groupDir).isDirectory()) continue;
    if (existsSync(join(groupDir, "package.json"))) {
      found.push(groupDir);
      continue;
    }
    for (const child of readdirSync(groupDir)) {
      const childDir = join(groupDir, child);
      if (existsSync(join(childDir, "package.json"))) found.push(childDir);
    }
  }
  const vendorDir = join(ROOT, "vendor");
  if (existsSync(vendorDir)) {
    for (const child of readdirSync(vendorDir)) {
      const childDir = join(vendorDir, child);
      if (existsSync(join(childDir, "package.json"))) found.push(childDir);
    }
  }
  return found;
}

/** 删除各包 lib 与 tsbuildinfo，避免增量缓存掩盖类型错误。 */
function cleanLib(packages) {
  let removed = 0;
  for (const pkgDir of packages) {
    const lib = join(pkgDir, "lib");
    if (existsSync(lib)) {
      rmSync(lib, { recursive: true, force: true });
      removed += 1;
    }
  }
  console.log(`清理 ${removed} 个已有 lib 目录`);
}

function run(command, args, label, options = {}) {
  console.log(`\n▸ ${label}`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", ...options });
  if (result.error) {
    console.error(`✖ ${label} 启动失败：${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`✖ ${label} 失败（退出码 ${result.status ?? "未知"}）`);
    process.exit(result.status ?? 1);
  }
}

/** 校验每个包都产出 lib/index.js 与类型入口。 */
function verify(packages) {
  const missing = [];
  for (const pkgDir of packages) {
    const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8").replace(/^\uFEFF/u, ""));
    const main = join(pkgDir, manifest.main ?? "lib/index.js");
    const types = join(pkgDir, manifest.types ?? "lib/types/index.d.ts");
    if (!existsSync(main) || !existsSync(types)) {
      missing.push(`${relative(ROOT, pkgDir).split(sep).join("/")}（main=${existsSync(main)} types=${existsSync(types)}）`);
    }
  }
  if (missing.length > 0) {
    console.error("✖ 以下包缺少产物：");
    for (const item of missing) console.error(`  · ${item}`);
    process.exit(1);
  }
  console.log(`\n✔ ${packages.length} 个包均产出 lib/index.js 与 lib/types 类型入口`);
}

function main() {
  const packages = discoverPackages();
  cleanLib(packages);
  run(process.execPath, [TSC, "-b", "tsconfig.host.json"], "编译 workspace（tsc -b → lib/types）");
  run(process.execPath, [join(ROOT, "node_modules", "tsdown", "dist", "run.mjs")], "打包公开入口（tsdown → lib）");
  verify(packages);
  run(
    process.execPath,
    [join(ROOT, "apps", "web", "node_modules", "vite", "bin", "vite.js"), "build"],
    "构建 Web 产物（vite）",
    { cwd: join(ROOT, "apps", "web") },
  );
}

main();



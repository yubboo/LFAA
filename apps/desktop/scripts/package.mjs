// 桌面安装包构建：全量构建 → 生成 staging（真实文件、无符号链接）→ electron-builder 出 NSIS 安装包。
// 与 DSH 一致：桌面端的构建/打包脚本、配置、资源都在 apps/desktop 内，根目录只做转发。
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const APP_DIR = resolve(import.meta.dirname, "..");
const ROOT = resolve(APP_DIR, "..", "..");
const HOST_APP_DIR = join(ROOT, "apps", "desktop-host");
const HOST_ENTRY = join(HOST_APP_DIR, "lib", "index.js");
const BUILD_ROOT = join(APP_DIR, ".desktop-build");
const STAGE_APP_DIR = join(BUILD_ROOT, "app");
const STAGE_HOST_DIR = join(STAGE_APP_DIR, "desktop-host");
const RELEASE_DIR = join(ROOT, "build");
const RESOURCE_ICON = join(APP_DIR, "resources", "icon.ico");
const TSDOWN = join(ROOT, "node_modules", "tsdown", "dist", "run.mjs");
const BUILDER_CONFIG = join(APP_DIR, "electron-builder.config.mjs");
const dirOnly = process.argv.includes("--dir");
const zipOnly = process.argv.includes("--zip");

/** 构建期依赖：生产运行与 Cordis 动态装载都不需要，裁掉可显著缩小安装包。 */
const BUILD_ONLY = new Set(["vite", "esbuild", "rollup", "typescript", "tsx", "tsdown", "electron", "electron-builder"]);

/**
 * 只在渲染进程用到的依赖：宿主 lib 从不 import react/react-dom/@tabler（已核对），
 * 它们由 apps/web 的前端构建打包进 web/，不该出现在安装包的 host node_modules 里。
 * 其中 @tabler 单独就有 1.8 万个文件，是安装慢的主要来源。
 */
const HOST_UNNEEDED = new Set(["react", "react-dom", "scheduler", "@tabler/icons-react", "@tabler/icons"]);

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

/** 递归检查目录中是否还有符号链接/联接；staging 不允许出现。 */
function findSymlinks(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const info = lstatSync(full, { throwIfNoEntry: false });
    if (!info) continue;
    // 必须用 lstat：stat 会跟随链接，反而看不出链接本身。
    if (info.isSymbolicLink()) {
      found.push(full);
      continue;
    }
    if (info.isDirectory()) findSymlinks(full, found);
  }
  return found;
}

/** 从已解析入口文件向上找到所属包的根目录（含 package.json）。 */
function findPackageRoot(entryFile, specifier) {
  let dir = dirname(entryFile);
  for (let depth = 0; depth < 12; depth += 1) {
    const manifestPath = join(dir, "package.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/u, ""));
      if (manifest.name === specifier) return { dir, manifest };
      return { dir, manifest };
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`无法定位依赖包根目录：${specifier}`);
}

/** 从宿主应用的生产依赖出发收集闭包：从每个包自己的目录按包名解析，兼容 pnpm 的链接布局。 */
function collectPackages() {
  const packages = new Map();
  const appRequire = createRequire(join(HOST_APP_DIR, "package.json"));
  const entry = appRequire.resolve("@lfaa/web-server");
  packages.set("@lfaa/web-server", { dir: findPackageRoot(entry, "@lfaa/web-server").dir });

  // 反复补齐，直到没有新包：只跟随 dependencies / optionalDependencies / peerDependencies。
  let changed = true;
  while (changed) {
    changed = false;
    for (const [, packageEntry] of [...packages]) {
      const manifestPath = join(packageEntry.dir, "package.json");
      if (!existsSync(manifestPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/u, ""));
      const requireFrom = createRequire(pathToFileURL(manifestPath));
      const names = [
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.optionalDependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
      ];
      for (const dependency of names) {
        if (BUILD_ONLY.has(dependency) || HOST_UNNEEDED.has(dependency) || packages.has(dependency)) continue;
        try {
          const entryFile = requireFrom.resolve(dependency);
          packages.set(dependency, { dir: findPackageRoot(entryFile, dependency).dir });
          changed = true;
        } catch {
          // 可选依赖缺失或仅声明 peer 而未安装：交给 staging 自检暴露，不在这里静默假设。
        }
      }
    }
  }
  return packages;
}

/** 复制包内容：工作区包只保留运行期 JS，第三方包裁掉类型、源码、文档与测试。 */
function copyPackage(sourceDir, targetDir, runtimeOnly) {
  cpSync(sourceDir, targetDir, {
    recursive: true,
    dereference: true,
    filter: (source) => {
      const name = basename(source);
      if (resolve(source) === resolve(sourceDir)) return true;
      if (name === "node_modules" || name === ".git" || name === ".cache") return false;
      const normalized = source.replace(/\\/gu, "/");
      const isDirectory = lstatSync(source, { throwIfNoEntry: false })?.isDirectory() ?? false;
      if (runtimeOnly) {
        // @lfaa/*：入口只有 package.json 与 lib 下的 JS（类型声明、sourcemap、src/client 都不需要）。
        const inLib = /(?:^|\/)lib(?:\/|$)/u.test(normalized);
        if (isDirectory) return inLib && name !== "types";
        if (inLib) {
          return (/\.(?:js|json|cjs|mjs)$/u.test(name) && !/\.d\.ts$/u.test(name))
            || (/\/lib\/builtin-skills\//u.test(normalized) && name.endsWith(".md"));
        }
        return name === "package.json";
      }
      // 第三方包：去掉类型声明、sourcemap、文档、测试与构建配置。
      if (/^LICEN[CS]E/u.test(name) || name === "NOTICE" || name === "notice") return true;
      if (name.endsWith(".d.ts") || name.endsWith(".d.mts") || name.endsWith(".map")) return false;
      if (/\.(?:tsx?|flow|coffee)$/u.test(name)) return false;
      if (name.endsWith(".md") && !/^readme/iu.test(name)) return false;
      if (/^(?:test|tests|__tests__|docs?|examples?|benchmarks?|coverage|\.github|\.vscode)$/u.test(name)) return false;
      return true;
    },
  });
}

function writeAppManifest(dependencies) {
  const desktopManifest = JSON.parse(readFileSync(join(APP_DIR, "package.json"), "utf8").replace(/^\uFEFF/u, ""));
  writeFileSync(
    join(STAGE_APP_DIR, "package.json"),
    `${JSON.stringify({
      name: "lfaa-desktop",
      productName: "LFAA",
      // 版本以 apps/desktop/package.json 为唯一来源，避免安装包版本写死。
      version: desktopManifest.version ?? "0.1.0",
      private: true,
      author: "LFAA",
      type: "module",
      main: "dist/main.js",
      description: "LFAA desktop runtime",
      dependencies,
    }, null, 2)}\n`,
    "utf8",
  );
}

/**
 * 把 staging 内清单的 `workspace:*` 改写成真实版本号：
 * electron-builder 遍历依赖树时不认得 workspace 协议，安装包会因此漏拷依赖。
 */
function rewriteWorkspaceProtocols(packages, versions) {
  for (const name of packages.keys()) {
    const manifestPath = join(STAGE_APP_DIR, "node_modules", ...name.split("/"), "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/u, ""));
    let changed = false;
    for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
      for (const [dependency, spec] of Object.entries(manifest[field] ?? {})) {
        // 已裁剪的依赖不能在清单里继续声明，否则 electron-builder 会判定缺包。
        if (BUILD_ONLY.has(dependency) || HOST_UNNEEDED.has(dependency)) {
          delete manifest[field][dependency];
          changed = true;
          continue;
        }
        if (typeof spec !== "string" || !spec.startsWith("workspace:")) continue;
        manifest[field][dependency] = versions.get(dependency) ?? "0.1.0";
        changed = true;
      }
    }
    if (changed) writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
}

function main() {
  // 1. 全量构建包 lib 与 Web 产物；2. 构建宿主与主进程入口。
  run(process.execPath, [join(ROOT, "scripts", "build.mjs")], "全量构建（包 lib + Web 产物）");
  run(process.execPath, [TSDOWN], "构建桌面主进程（tsdown）", { cwd: APP_DIR });
  run(process.execPath, [TSDOWN], "构建桌面宿主（tsdown）", { cwd: HOST_APP_DIR });
  if (!existsSync(RESOURCE_ICON)) {
    run(process.execPath, [join(APP_DIR, "scripts", "make-icon.mjs")], "生成桌面图标");
  }

  // 3. 生成 staging：dist + web + 宿主体 + 自包含 node_modules。
  rmSync(BUILD_ROOT, { recursive: true, force: true });
  mkdirSync(join(STAGE_APP_DIR, "node_modules"), { recursive: true });
  mkdirSync(STAGE_HOST_DIR, { recursive: true });
  cpSync(join(APP_DIR, "dist"), join(STAGE_APP_DIR, "dist"), { recursive: true });
  cpSync(join(ROOT, "apps", "web", "dist"), join(STAGE_APP_DIR, "web"), { recursive: true });
  // 宿主入口与依赖同在 app 根：desktop-host/index.js 解析时能向上找到 app/node_modules。
  cpSync(HOST_ENTRY, join(STAGE_HOST_DIR, "index.js"));

  const packages = collectPackages();
  console.log(`\n▸ 收集生产依赖：${packages.size} 个包`);
  const versions = new Map();
  for (const [name, entry] of packages) {
    const manifestPath = join(entry.dir, "package.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/u, ""));
      versions.set(name, manifest.version ?? "0.1.0");
    }
    const target = join(STAGE_APP_DIR, "node_modules", ...name.split("/"));
    mkdirSync(dirname(target), { recursive: true });
    copyPackage(entry.dir, target, name.startsWith("@lfaa/"));
  }
  // electron-builder 按清单里的 dependencies 遍历并复制 node_modules；
  // 这里写入扁平化的完整依赖清单，避免它因为「没有依赖」而跳过整个 node_modules。
  rewriteWorkspaceProtocols(packages, versions);
  writeAppManifest(Object.fromEntries(versions));

  // 4. 自检：不允许符号链接；不允许构建期依赖混入；宿主要能在 staging 内解析依赖。
  if (!existsSync(join(STAGE_HOST_DIR, "index.js"))) {
    console.error("✖ staging 缺少 desktop-host/index.js，宿主进程无法启动。");
    process.exit(1);
  }
  const links = findSymlinks(join(STAGE_APP_DIR, "node_modules"));
  if (links.length > 0) {
    console.error(`✖ staging 内仍有 ${links.length} 个符号链接/联接，安装包会依赖仓库路径：`);
    for (const link of links.slice(0, 10)) console.error(`  · ${relative(ROOT, link)}`);
    process.exit(1);
  }
  if (existsSync(join(STAGE_APP_DIR, "node_modules", "vite"))) {
    console.error("✖ staging 混入了 vite（构建期依赖），请检查 BUILD_ONLY 裁剪。");
    process.exit(1);
  }
  run(process.execPath, ["--input-type=module", "-e", "await import('@lfaa/web-server'); console.log('staging 依赖自检通过');"], "staging 依赖自检", { cwd: STAGE_APP_DIR });

  // 5. 打包前清理旧产物目录，避免残缺安装包或历史缓存残留。
  rmSync(RELEASE_DIR, { recursive: true, force: true });
  const builderCli = join(APP_DIR, "node_modules", "electron-builder", "cli.js");
  if (!existsSync(builderCli)) {
    console.error("✖ 缺少 electron-builder，请先在仓库根执行 pnpm install。");
    process.exit(1);
  }
  const builderArgs = [builderCli, "--config", BUILDER_CONFIG, "--publish", "never"];
  if (dirOnly) {
    builderArgs.push("--dir");
  } else if (zipOnly) {
    builderArgs.push("--win", "zip");
  }
  const label = dirOnly
    ? "electron-builder（仅目录）"
    : zipOnly
      ? "electron-builder（免安装 zip）"
      : "electron-builder（NSIS + 免安装 zip）";
  run(process.execPath, builderArgs, label, { cwd: APP_DIR });

  const artifacts = existsSync(RELEASE_DIR)
    ? readdirSync(RELEASE_DIR, { withFileTypes: true }).map((entry) => entry.name)
    : [];
  console.log(`\n✔ 完成：${relative(ROOT, RELEASE_DIR) || "."}`);
  for (const artifact of artifacts) console.log(`  · ${artifact}`);
}

main();
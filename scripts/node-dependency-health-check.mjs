/**
 * 文件：node-dependency-health-check.mjs
 * 作用：从各 workspace 的真实 importer 位置验证外部 Node 依赖是否可以被当前项目实际解析。
 * 负责：扫描 workspace package.json、检查直接依赖 manifest、精确版本和 Node resolve 结果。
 * 不负责：安装/更新依赖、修改 pnpm Store、执行网络请求、替代 node-pty 原生加载检查。
 * 状态归属：只读取当前项目目录；不读取 .lfaa/state 作为健康真相。
 * 对外接口：node scripts/node-dependency-health-check.mjs [--project-root <path>] [--json]
 * 关联文件：scripts/windows/lfaa-setup.ps1、test/node-dependency-health.test.mjs。
 * 修改注意事项：必须保持只读；依赖缓存或 package.json 存在不能代替真实 resolve。
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const EXACT_VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const SECTIONS = ["dependencies", "devDependencies", "optionalDependencies"];

function parseArgs(argv) {
  let projectRoot = process.cwd();
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--json") json = true;
    else if (argv[i] === "--project-root") {
      i += 1;
      if (!argv[i]) throw new Error("--project-root 缺少路径");
      projectRoot = path.resolve(argv[i]);
    }
  }
  return { projectRoot, json };
}

function listPackageFiles(projectRoot) {
  const files = [];
  const rootPackage = path.join(projectRoot, "package.json");
  if (fs.existsSync(rootPackage)) files.push(rootPackage);

  for (const top of ["apps", "packages"]) {
    const topDir = path.join(projectRoot, top);
    if (!fs.existsSync(topDir)) continue;
    for (const entry of fs.readdirSync(topDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifest = path.join(topDir, entry.name, "package.json");
      if (fs.existsSync(manifest)) files.push(manifest);
    }
  }
  return files.sort();
}

function dependencyDir(importerDir, name) {
  return path.join(importerDir, "node_modules", ...name.split("/"));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function checkNodeDependencyHealth(projectRoot) {
  const issues = [];
  const packages = listPackageFiles(projectRoot);
  let checked = 0;
  let resolved = 0;

  for (const manifestFile of packages) {
    let manifest;
    try {
      manifest = readJson(manifestFile);
    } catch (error) {
      issues.push(`${path.relative(projectRoot, manifestFile)}: package.json 无法读取：${error.message}`);
      continue;
    }

    const importerDir = path.dirname(manifestFile);
    const importerName = path.relative(projectRoot, manifestFile).replaceAll(path.sep, "/") || "package.json";
    const requireFromImporter = createRequire(manifestFile);

    for (const section of SECTIONS) {
      const block = manifest[section];
      if (!block || typeof block !== "object") continue;

      for (const [name, specifier] of Object.entries(block)) {
        const expected = String(specifier);
        if (expected.startsWith("workspace:")) continue;
        checked += 1;

        const directDir = dependencyDir(importerDir, name);
        const dependencyManifest = path.join(directDir, "package.json");
        if (!fs.existsSync(dependencyManifest)) {
          if (section !== "optionalDependencies") issues.push(`${importerName}: 缺少 ${name} 的 package.json`);
          continue;
        }

        let installed;
        try {
          installed = readJson(dependencyManifest);
        } catch (error) {
          issues.push(`${importerName}: ${name} package.json 无法读取：${error.message}`);
          continue;
        }

        if (EXACT_VERSION_RE.test(expected) && String(installed.version) !== expected) {
          issues.push(`${importerName}: ${name} 需要 ${expected}，当前 ${installed.version ?? "未知"}`);
        }

        // @types/* 是纯类型包，通常没有可执行 JS 入口；manifest/版本检查足以证明其直接链接存在。
        if (name.startsWith("@types/")) {
          resolved += 1;
          continue;
        }

        try {
          const entry = requireFromImporter.resolve(name);
          if (!fs.existsSync(entry)) {
            issues.push(`${importerName}: ${name} 解析到不存在的入口 ${entry}`);
            continue;
          }
          // realpath 能发现损坏/悬空链接；仅 package.json 还在不能让本检查通过。
          fs.realpathSync(entry);
          if (name === "node-pty") {
            const pty = requireFromImporter(name);
            if (!pty || typeof pty.spawn !== "function") {
              issues.push(`${importerName}: node-pty 已解析，但 pty.spawn 不可用`);
              continue;
            }
          }
          resolved += 1;
        } catch (error) {
          if (section !== "optionalDependencies") {
            issues.push(`${importerName}: ${name} 无法从当前 workspace 真实解析：${error.code ?? error.message}`);
          }
        }
      }
    }
  }

  return {
    complete: issues.length === 0,
    workspacePackages: packages.length,
    checked,
    resolved,
    issues,
  };
}

function main() {
  const { projectRoot, json } = parseArgs(process.argv.slice(2));
  const result = checkNodeDependencyHealth(projectRoot);
  if (json) console.log(JSON.stringify(result));
  else if (result.complete) console.log(`Node 依赖真实解析通过：${result.checked} 项声明。`);
  else {
    console.error("Node 依赖真实解析失败：");
    for (const issue of result.issues) console.error(`- ${issue}`);
  }
  process.exitCode = result.complete ? 0 : 1;
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) main();

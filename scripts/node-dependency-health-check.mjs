/**
 * 文件：node-dependency-health-check.mjs
 * 作用：从 pnpm-workspace.yaml 声明的全部 workspace importer 验证 Node 依赖是否真实安装、可解析，并检查 lockfile importer 覆盖。
 * 负责：workspace 发现、直接依赖链接、workspace 链接、外部依赖版本与 Node resolve、node-pty 原生加载、pnpm-lock importer/specifier 覆盖。
 * 不负责：安装/更新依赖、修改 pnpm Store、执行网络请求。
 * 状态归属：只读取当前项目目录；不读取依赖状态缓存作为健康真相。
 * 对外接口：node scripts/node-dependency-health-check.mjs [--project-root <path>] [--json]
 * 关联文件：pnpm-workspace.yaml、pnpm-lock.yaml、scripts/windows/lfaa-setup.ps1、test/node-dependency-health.test.mjs。
 * 修改注意事项：workspace 拓扑必须以 pnpm-workspace.yaml 为准；新增 capability family 后不能退回固定一层 packages/* 扫描。
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const EXACT_VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const INSTALL_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

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

function normalizePosix(value) {
  return value.replaceAll(path.sep, "/").replace(/^\.\//, "").replace(/\/$/, "");
}

function readWorkspacePatterns(projectRoot) {
  const workspaceFile = path.join(projectRoot, "pnpm-workspace.yaml");
  if (!fs.existsSync(workspaceFile)) return [];
  const lines = fs.readFileSync(workspaceFile, "utf8").split(/\r?\n/u);
  const patterns = [];
  let inPackages = false;
  for (const line of lines) {
    if (/^packages\s*:\s*$/u.test(line.trim())) {
      inPackages = true;
      continue;
    }
    if (inPackages && /^\S[^:]*\s*:/u.test(line)) break;
    if (!inPackages) continue;
    const match = line.match(/^\s*-\s*["']?([^"']+?)["']?\s*$/u);
    if (match) patterns.push(normalizePosix(match[1].trim()));
  }
  return patterns;
}

function walkGlobSegments(baseDir, segments, index, output) {
  if (index >= segments.length) {
    const manifest = path.join(baseDir, "package.json");
    if (fs.existsSync(manifest)) output.add(path.resolve(manifest));
    return;
  }

  const segment = segments[index];
  if (segment === "**") {
    walkGlobSegments(baseDir, segments, index + 1, output);
    if (!fs.existsSync(baseDir)) return;
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walkGlobSegments(path.join(baseDir, entry.name), segments, index, output);
    }
    return;
  }

  if (segment === "*") {
    if (!fs.existsSync(baseDir)) return;
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walkGlobSegments(path.join(baseDir, entry.name), segments, index + 1, output);
    }
    return;
  }

  if (segment.includes("*")) {
    const matcher = new RegExp(`^${segment.replace(/[.+?^${}()|[\]\\]/gu, "\\$&").replaceAll("*", ".*")}$`, "u");
    if (!fs.existsSync(baseDir)) return;
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !matcher.test(entry.name)) continue;
      walkGlobSegments(path.join(baseDir, entry.name), segments, index + 1, output);
    }
    return;
  }

  walkGlobSegments(path.join(baseDir, segment), segments, index + 1, output);
}

export function listWorkspacePackageFiles(projectRoot) {
  const files = new Set();
  const rootPackage = path.join(projectRoot, "package.json");
  if (fs.existsSync(rootPackage)) files.add(path.resolve(rootPackage));

  for (const pattern of readWorkspacePatterns(projectRoot)) {
    const clean = pattern.replace(/\/package\.json$/u, "");
    const segments = clean.split("/").filter(Boolean);
    walkGlobSegments(projectRoot, segments, 0, files);
  }
  return [...files].sort();
}

function dependencyDir(importerDir, name) {
  return path.join(importerDir, "node_modules", ...name.split("/"));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function unquoteYaml(value) {
  const trimmed = String(value ?? "").trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  return trimmed;
}

function parseLockImporters(projectRoot) {
  const lockFile = path.join(projectRoot, "pnpm-lock.yaml");
  if (!fs.existsSync(lockFile)) return { exists: false, importers: new Map() };

  const importers = new Map();
  let inImporters = false;
  let importer = null;
  let section = null;
  let dependency = null;

  for (const line of fs.readFileSync(lockFile, "utf8").split(/\r?\n/u)) {
    if (!inImporters) {
      if (line === "importers:") inImporters = true;
      continue;
    }
    if (/^\S/u.test(line) && line !== "importers:") break;

    let match = line.match(/^  (\S.*?):(?:\s*\{\})?\s*$/u);
    if (match) {
      importer = unquoteYaml(match[1]);
      section = null;
      dependency = null;
      if (!importers.has(importer)) importers.set(importer, new Map());
      continue;
    }
    match = line.match(/^    (dependencies|devDependencies|optionalDependencies|peerDependencies):(?:\s*\{\})?\s*$/u);
    if (match) {
      section = match[1];
      dependency = null;
      continue;
    }
    match = line.match(/^      (\S.*?):(?:\s*\{\})?\s*$/u);
    if (match && importer && section) {
      dependency = unquoteYaml(match[1]);
      continue;
    }
    match = line.match(/^        specifier:\s*(.+?)\s*$/u);
    if (match && importer && section && dependency) {
      importers.get(importer).set(`${section}|${dependency}`, unquoteYaml(match[1]));
    }
  }
  return { exists: true, importers };
}

function lockSectionCandidates(section) {
  // pnpm autoInstallPeers 会把 peer dependency 作为 importer dependency 记录。
  return section === "peerDependencies" ? ["peerDependencies", "dependencies"] : [section];
}

function checkLockCoverage(projectRoot, manifests) {
  const parsed = parseLockImporters(projectRoot);
  const issues = [];
  if (!parsed.exists) return { complete: false, issues: ["pnpm-lock.yaml 不存在"] };

  for (const manifestFile of manifests) {
    const manifest = readJson(manifestFile);
    const importerDir = path.dirname(manifestFile);
    const importerKey = importerDir === projectRoot ? "." : normalizePosix(path.relative(projectRoot, importerDir));
    const locked = parsed.importers.get(importerKey);
    if (!locked) {
      issues.push(`${importerKey}: pnpm-lock.yaml 缺少 importer`);
      continue;
    }

    for (const section of INSTALL_SECTIONS) {
      const block = manifest[section];
      if (!block || typeof block !== "object") continue;
      for (const [name, specifier] of Object.entries(block)) {
        const expected = String(specifier);
        let actual = null;
        for (const lockSection of lockSectionCandidates(section)) {
          const value = locked.get(`${lockSection}|${name}`);
          if (value != null) {
            actual = value;
            break;
          }
        }
        if (actual == null) {
          issues.push(`${importerKey}: lockfile 缺少 ${section}.${name}`);
          continue;
        }
        if (actual !== expected) {
          issues.push(`${importerKey}: ${name} lockfile specifier=${actual}，package.json=${expected}`);
        }
      }
    }
  }
  return { complete: issues.length === 0, issues };
}

export function checkNodeDependencyHealth(projectRoot) {
  const issues = [];
  const manifests = listWorkspacePackageFiles(projectRoot);
  const workspacePackages = new Map();

  for (const manifestFile of manifests) {
    try {
      const manifest = readJson(manifestFile);
      if (manifest.name) workspacePackages.set(String(manifest.name), path.dirname(manifestFile));
    } catch (error) {
      issues.push(`${path.relative(projectRoot, manifestFile)}: package.json 无法读取：${error.message}`);
    }
  }

  let checked = 0;
  let resolved = 0;
  let workspaceChecked = 0;
  let workspaceResolved = 0;
  let externalChecked = 0;
  let externalResolved = 0;

  for (const manifestFile of manifests) {
    let manifest;
    try {
      manifest = readJson(manifestFile);
    } catch {
      continue;
    }

    const importerDir = path.dirname(manifestFile);
    const importerName = normalizePosix(path.relative(projectRoot, manifestFile)) || "package.json";
    const requireFromImporter = createRequire(manifestFile);

    for (const section of INSTALL_SECTIONS) {
      const block = manifest[section];
      if (!block || typeof block !== "object") continue;

      for (const [name, specifier] of Object.entries(block)) {
        const expected = String(specifier);
        const isWorkspace = expected.startsWith("workspace:");
        const optional = section === "optionalDependencies";
        checked += 1;
        if (isWorkspace) workspaceChecked += 1;
        else externalChecked += 1;

        const directDir = dependencyDir(importerDir, name);
        const dependencyManifest = path.join(directDir, "package.json");
        if (!fs.existsSync(dependencyManifest)) {
          if (!optional) issues.push(`${importerName}: 缺少 ${name} 的直接 node_modules 链接`);
          continue;
        }

        let installed;
        try {
          installed = readJson(dependencyManifest);
        } catch (error) {
          issues.push(`${importerName}: ${name} package.json 无法读取：${error.message}`);
          continue;
        }

        if (String(installed.name ?? "") !== name) {
          issues.push(`${importerName}: ${name} 直接链接指向错误包 ${installed.name ?? "未知"}`);
          continue;
        }

        if (isWorkspace) {
          const target = workspacePackages.get(name);
          if (!target) {
            issues.push(`${importerName}: ${name} 声明为 workspace:*，但当前 workspace 中不存在该包`);
            continue;
          }
          try {
            const actual = fs.realpathSync(directDir);
            const expectedTarget = fs.realpathSync(target);
            if (path.normalize(actual) !== path.normalize(expectedTarget)) {
              issues.push(`${importerName}: ${name} workspace 链接目标错误：${actual}`);
              continue;
            }
          } catch (error) {
            issues.push(`${importerName}: ${name} workspace 链接不可用：${error.code ?? error.message}`);
            continue;
          }
          workspaceResolved += 1;
          resolved += 1;
          continue;
        }

        if (EXACT_VERSION_RE.test(expected) && String(installed.version) !== expected) {
          issues.push(`${importerName}: ${name} 需要 ${expected}，当前 ${installed.version ?? "未知"}`);
          continue;
        }

        if (name.startsWith("@types/")) {
          externalResolved += 1;
          resolved += 1;
          continue;
        }

        try {
          const entry = requireFromImporter.resolve(name);
          if (!fs.existsSync(entry)) {
            issues.push(`${importerName}: ${name} 解析到不存在的入口 ${entry}`);
            continue;
          }
          fs.realpathSync(entry);
          if (name === "node-pty") {
            const pty = requireFromImporter(name);
            if (!pty || typeof pty.spawn !== "function") {
              issues.push(`${importerName}: node-pty 已解析，但 pty.spawn 不可用`);
              continue;
            }
          }
          externalResolved += 1;
          resolved += 1;
        } catch (error) {
          if (!optional) issues.push(`${importerName}: ${name} 无法从当前 workspace 真实解析：${error.code ?? error.message}`);
        }
      }
    }
  }

  const runtimeIssues = [...issues];
  const lock = checkLockCoverage(projectRoot, manifests);
  const allIssues = [...runtimeIssues, ...lock.issues];

  return {
    complete: allIssues.length === 0,
    runtimeComplete: runtimeIssues.length === 0,
    runtimeIssues,
    workspacePackages: manifests.length,
    checked,
    resolved,
    workspaceChecked,
    workspaceResolved,
    externalChecked,
    externalResolved,
    lockComplete: lock.complete,
    lockIssues: lock.issues,
    issues: allIssues,
  };
}

function main() {
  const { projectRoot, json } = parseArgs(process.argv.slice(2));
  const result = checkNodeDependencyHealth(projectRoot);
  if (json) console.log(JSON.stringify(result));
  else if (result.complete) {
    console.log(`Node 依赖真实解析通过：workspace ${result.workspaceResolved}/${result.workspaceChecked}，外部 ${result.externalResolved}/${result.externalChecked}。`);
  } else {
    console.error("Node 依赖真实解析失败：");
    for (const issue of result.issues) console.error(`- ${issue}`);
  }
  process.exitCode = result.complete ? 0 : 1;
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) main();

// 仓库依赖状态预检与安全增量安装脚本：在 Node 环境中核对 workspace/lockfile，避免破坏性重建。
// 缺依赖时只补装缺失的包（复用 pnpm store），并自愈被删掉的依赖链接；失败原因转成可读提示。
import { spawn } from "node:child_process";
// 计算 lockfile 摘要，用于比对仓库与已安装目录中的副本。
import { createHash } from "node:crypto";
// 快速判断 package 依赖链接是否存在，并在安装前清理中断残留临时目录。
import { existsSync, readdirSync, rmSync } from "node:fs";
// 读取工作区清单、lockfile 和 pnpm 状态文件。
import { readFile, readdir, stat } from "node:fs/promises";
// 解析工作区相对路径并生成跨平台路径标识。
import { relative, resolve, sep } from "node:path";
// 从当前脚本地址定位仓库根目录。
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const rootManifestPath = resolve(repositoryRoot, "package.json");
const lockfilePath = resolve(repositoryRoot, "pnpm-lock.yaml");
const installedLockfilePath = resolve(repositoryRoot, "node_modules/.pnpm/lock.yaml");
const modulesMetadataPath = resolve(repositoryRoot, "node_modules/.modules.yaml");
const workspaceStatePath = resolve(repositoryRoot, "node_modules/.pnpm-workspace-state-v1.json");
const workspaceFile = resolve(repositoryRoot, "pnpm-workspace.yaml");
const dependencySections = ["dependencies", "devDependencies", "optionalDependencies"];

// 读取并解析 JSON 文件，供 package 清单和 pnpm 状态复用。
// 某些编辑器/PowerShell 写回清单时会带上 UTF-8 BOM，JSON.parse 会直接抛错并让启动前预检失败，这里统一剥掉。
async function readJson(path) {
  const text = await readFile(path, "utf8");
  return JSON.parse(text.replace(/^\uFEFF/u, ""));
}

// 判断路径是否可访问；目录扫描时用于识别 package.json。
async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// 按 workspace 目录深度收集项目；一级显式包与分组下的二级包都可登记。
export async function collectPackages(parent, depth, root = repositoryRoot, output = []) {
  const folder = resolve(root, parent);
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const childPath = resolve(folder, entry.name);
    const relativePath = relative(root, childPath).split(sep).join("/");
    if (await fileExists(resolve(childPath, "package.json"))) {
      output.push(relativePath);
    } else if (depth > 1) {
      await collectPackages(relativePath, depth - 1, root, output);
    }
  }
  return output;
}

// 解析 pnpm-workspace.yaml 的 packages 列表，避免预检目录与真实工作区脱节。
async function readWorkspacePatterns() {
  let raw;
  try {
    raw = await readFile(workspaceFile, "utf8");
  } catch {
    return [];
  }
  const patterns = [];
  let inPackages = false;
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!line.startsWith(" ") && !line.startsWith("-")) {
      inPackages = trimmed === "packages:";
      continue;
    }
    if (!inPackages) continue;
    const match = /^-\s*["']?([^"']+?)["']?\s*$/u.exec(trimmed);
    if (match) patterns.push(match[1]);
  }
  return patterns;
}

// 展开单个 workspace 模式：`*` 匹配任意单层目录，末层必须包含 package.json。
async function expandWorkspacePattern(segments, current, root, output) {
  if (segments.length === 0) {
    if (await fileExists(resolve(current, "package.json"))) {
      output.push(relative(root, current).split(sep).join("/"));
    }
    return;
  }
  const [head, ...rest] = segments;
  if (head === "*") {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === "node_modules") continue;
      await expandWorkspacePattern(rest, resolve(current, entry.name), root, output);
    }
    return;
  }
  await expandWorkspacePattern(rest, resolve(current, head), root, output);
}

/** 按 workspace 配置枚举全部项目；配置缺失时回退到历史目录约定。 */
export async function collectWorkspaceProjects() {
  const output = [];
  for (const pattern of await readWorkspacePatterns()) {
    if (pattern.startsWith("!")) continue;
    await expandWorkspacePattern(pattern.split("/"), repositoryRoot, repositoryRoot, output);
  }
  if (output.length > 0) return [...new Set(output)];
  const appPaths = await collectPackages("apps", 1);
  const packagePaths = await collectPackages("packages", 2);
  return [...appPaths, ...packagePaths];
}

// 去掉 lockfile 键和值外围的 YAML 引号，并还原转义引号。
function parseYamlScalar(value) {
  const scalar = value.trim();
  if (scalar.startsWith("'") && scalar.endsWith("'")) {
    return scalar.slice(1, -1).replaceAll("''", "'");
  }
  if (scalar.startsWith('"') && scalar.endsWith('"')) {
    try {
      return JSON.parse(scalar);
    } catch {
      return scalar.slice(1, -1);
    }
  }
  return scalar;
}

// 只解析 lockfile 的 importer 依赖声明，供逐 package 对照清单使用。
function parseLockImporters(lockfile) {
  const importers = new Map();
  const lines = lockfile.split(/\r?\n/u);
  let inImporters = false;
  let currentProject;
  let currentSection;
  let currentDependency;

  for (const line of lines) {
    if (!inImporters) {
      if (line.trim() === "importers:") inImporters = true;
      continue;
    }
    if (line.length > 0 && !line.startsWith(" ")) break;

    const projectMatch = line.match(/^  ([^ ].*):(?:\s+\{\})?\s*$/u);
    if (projectMatch) {
      currentProject = parseYamlScalar(projectMatch[1]);
      currentSection = undefined;
      currentDependency = undefined;
      importers.set(currentProject, new Map());
      continue;
    }

    const sectionMatch = line.match(/^    (dependencies|devDependencies|optionalDependencies):\s*$/u);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      currentDependency = undefined;
      continue;
    }

    const dependencyMatch = line.match(/^      ([^ ].*):\s*$/u);
    if (dependencyMatch && currentProject && currentSection) {
      currentDependency = parseYamlScalar(dependencyMatch[1]);
      continue;
    }

    const specifierMatch = line.match(/^        specifier:\s*(.+?)\s*$/u);
    if (specifierMatch && currentProject && currentSection && currentDependency) {
      importers.get(currentProject).set(`${currentSection}\0${currentDependency}`, parseYamlScalar(specifierMatch[1]));
      currentDependency = undefined;
    }
  }

  return importers;
}

// 生成内容摘要，避免把较大的 lockfile 逐字段比较。
function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

// pnpm 会把 CRLF 仓库 lockfile 规范化为 LF 虚拟副本；摘要前统一换行。
function normalizeLockfile(value) {
  return value.replaceAll("\r\n", "\n");
}

// 判断两份 lockfile 是否只有平台换行差异，供预检与回归测试共用。
export function lockfilesMatch(repositoryLockfile, installedLockfile) {
  return digest(normalizeLockfile(repositoryLockfile)) === digest(normalizeLockfile(installedLockfile));
}

// 将路径分隔符统一，并在 Windows 上消除大小写差异。
function normalizedPath(path) {
  const normalized = resolve(path).replaceAll("\\", "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

// 检查某个 package 的直接依赖链接是否已经安装。
function dependencyLinkExists(packageFolder, dependencyName) {
  const dependencyPath = resolve(packageFolder, "node_modules", ...dependencyName.split("/"));
  return existsSync(dependencyPath);
}

// 综合核对依赖声明、lockfile、链接和 workspace 登记，决定是否需要安装。
async function inspectInstallState() {
  // 首次运行（全新克隆）还没有 node_modules：直接给可读原因，避免后面读 pnpm 状态文件时抛 ENOENT。
  if (!existsSync(resolve(repositoryRoot, "node_modules"))) {
    return { ready: false, firstRun: true, reason: "本机还没有安装依赖" };
  }
  const rootManifest = await readJson(rootManifestPath);
  const workspaceProjects = await collectWorkspaceProjects();
  const projectPaths = [".", ...workspaceProjects];
  const projectRecords = [];
  // 记录缺链接的工程：pnpm 认为「已是最新」时不会补建被删掉的链接，需要安装前先清掉对应 node_modules。
  const brokenLinks = [];
  const importers = parseLockImporters(await readFile(lockfilePath, "utf8"));

  for (const projectPath of projectPaths) {
    const folder = projectPath === "." ? repositoryRoot : resolve(repositoryRoot, projectPath);
    const manifest = await readJson(resolve(folder, "package.json"));
    const lockDependencies = importers.get(projectPath);

    if (!lockDependencies) return { ready: false, reason: `pnpm-lock.yaml 缺少工作区入口 ${projectPath}` };

    const missingLinks = [];

    for (const section of dependencySections) {
      // 声明项 = 该 section 的依赖 + 非可选 peer；peer 会被 pnpm 记入同一 section，
      // 因此只校验「声明项都被锁文件覆盖」，多出的可选 peer 不视为不一致。
      const declared = section === "dependencies"
        ? {
          ...(manifest.dependencies ?? {}),
          ...Object.fromEntries(Object.entries(manifest.peerDependencies ?? {}).filter(([name]) => manifest.peerDependenciesMeta?.[name]?.optional !== true)),
        }
        : manifest[section] ?? {};
      const locked = [...lockDependencies.entries()]
        .filter(([key]) => key.startsWith(`${section}\0`))
        .map(([key, specifier]) => [key.slice(section.length + 1), specifier]);

      const lockedNames = new Set(locked.map(([name]) => name));
      const missing = Object.keys(declared).filter((name) => !lockedNames.has(name));
      if (missing.length > 0) {
        return { ready: false, reason: `${projectPath} 的 ${section} 缺少 ${missing.join("、")}` };
      }

      // lockfile 已更新但链接未落盘时也要补装；正常就绪路径不会触碰 node_modules。
      for (const [dependencyName, specifier] of Object.entries(declared)) {
        if (lockDependencies.get(`${section}\0${dependencyName}`) !== specifier) {
          return { ready: false, reason: `${projectPath} 新增或更新了依赖 ${dependencyName}` };
        }
        if (section !== "optionalDependencies" && !dependencyLinkExists(folder, dependencyName)) {
          missingLinks.push(dependencyName);
        }
      }
    }

    if (missingLinks.length > 0) {
      brokenLinks.push({ path: projectPath, folder, names: missingLinks });
    }
    projectRecords.push({ path: projectPath, name: manifest.name, version: manifest.version });
  }

  // 链接缺失优先于后面的状态比对处理：安装阶段会先清掉对应 node_modules 再让 pnpm 重建。
  if (brokenLinks.length > 0) {
    const summary = brokenLinks.map((item) => `${item.path} 缺少依赖链接 ${item.names.join("、")}`).join("；");
    return { ready: false, reason: summary, brokenLinks };
  }

  // 比较安装时复制的 lockfile，可识别切换分支或新增依赖后尚未同步的安装目录。
  const rootLock = await readFile(lockfilePath);
  const installedLock = await readFile(installedLockfilePath).catch(() => undefined);
  if (!installedLock || !lockfilesMatch(rootLock.toString("utf8"), installedLock.toString("utf8"))) {
    return { ready: false, reason: "已安装依赖与 pnpm-lock.yaml 不一致" };
  }
  const modulesText = await readFile(modulesMetadataPath, "utf8").catch(() => "");
  if (!modulesText) return { ready: false, reason: "pnpm 安装状态文件缺失" };
  let modulesMetadata;
  try { modulesMetadata = JSON.parse(modulesText); } catch { return { ready: false, reason: "pnpm 安装状态文件无法读取" }; }
  if (modulesMetadata.packageManager && modulesMetadata.packageManager !== rootManifest.packageManager) {
    return { ready: false, reason: "当前 pnpm 版本与安装状态记录不一致" };
  }
  let workspaceState;
  try { workspaceState = await readJson(workspaceStatePath); } catch { return { ready: false, reason: "pnpm 工作区安装状态文件缺失或无效" }; }
  const installedProjects = workspaceState.projects ?? {};
  if (Object.keys(installedProjects).length !== projectRecords.length) {
    return { ready: false, reason: "当前已安装的工作区项目数量与仓库不一致" };
  }
  // 允许整个仓库目录或盘符迁移后复用原安装状态，避免仅因路径变化触发全量重装。
  const installedRootKey = Object.keys(installedProjects).find((entry) => {
    const record = installedProjects[entry];
    return record?.name === rootManifest.name && record?.version === rootManifest.version;
  });
  const recordedRoot = installedRootKey ? normalizedPath(installedRootKey) : normalizedPath(repositoryRoot);
  for (const project of projectRecords) {
    const expectedPath = project.path === "." ? recordedRoot : `${recordedRoot}/${project.path}`;
    const stateKey = Object.keys(installedProjects).find((entry) => normalizedPath(entry) === expectedPath);
    const installedProject = stateKey ? installedProjects[stateKey] : undefined;
    if (installedProject?.name !== project.name || installedProject?.version !== project.version) {
      return { ready: false, reason: `pnpm 尚未登记工作区项目 ${project.path}` };
    }
  }

  return { ready: true, reason: "" };
}

// 清理上次中断残留在 .pnpm 包目录中的 *_tmp_* 临时文件夹（最多深入 scope 一层）。
function cleanTempEntries(dir, depth) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = resolve(dir, entry.name);
    if (entry.name.includes("_tmp_")) rmSync(full, { recursive: true, force: true });
    else if (depth > 0 && entry.name.startsWith("@")) cleanTempEntries(full, depth - 1);
  }
}

function cleanStaleTempDirs() {
  const virtualStore = resolve(repositoryRoot, "node_modules/.pnpm");
  if (!existsSync(virtualStore)) return;
  for (const pkg of readdirSync(virtualStore, { withFileTypes: true })) {
    if (pkg.isDirectory()) cleanTempEntries(resolve(virtualStore, pkg.name, "node_modules"), 1);
  }
}

// 以无 TTY 子进程流式执行 pnpm；Windows 下显式经 cmd.exe 调用避免 DEP0190。
function invokePnpm(pnpmArgs) {
  const pnpmEntrypoint = process.env.npm_execpath;
  const isWindowsCmd = !pnpmEntrypoint && process.platform === "win32";
  const command = pnpmEntrypoint ? process.execPath : isWindowsCmd ? (process.env.ComSpec || "cmd.exe") : "pnpm";
  const commandArgs = pnpmEntrypoint ? [pnpmEntrypoint, ...pnpmArgs] : isWindowsCmd ? ["/d", "/s", "/c", "pnpm.cmd", ...pnpmArgs] : pnpmArgs;
  return new Promise((resolvePromise) => {
    let output = "";
    const child = spawn(command, commandArgs, { cwd: repositoryRoot, env: { ...process.env, CI: "false" }, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => { process.stdout.write(chunk); output += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { process.stderr.write(chunk); output += chunk.toString("utf8"); });
    child.on("error", (error) => resolvePromise({ status: null, error, output }));
    child.on("close", (status) => resolvePromise({ status, error: null, output }));
  });
}

// 增量安装：pnpm 自带的内容寻址 store 只会下载本地缓存里没有的包，已下载的包直接复用，
// 所以这里不先跑一轮 --offline 试探（首装时那一轮必然失败，还会留下半成品目录），一次装到位。
// brokenLinks 来自预检：pnpm 11 认为安装状态「已是最新」时不会补建被删掉的链接（实测 --force 也不会），
// 因此先把缺链接的工程 node_modules 清掉，让 pnpm 在这次安装里重建链接；根工程缺链接则整体重建。
async function runPnpmInstall(firstRun, brokenLinks = []) {
  const rootBroken = brokenLinks.some((item) => item.path === ".");
  const projectBroken = brokenLinks.filter((item) => item.path !== ".");
  if (rootBroken) {
    console.info("根工程的依赖链接缺失，正在整体重建 node_modules（复用本地缓存，不会重新下载已缓存的包）……");
    rmSync(resolve(repositoryRoot, "node_modules"), { recursive: true, force: true });
  } else if (projectBroken.length > 0) {
    const names = projectBroken.map((item) => item.path).join("、");
    console.info(`检测到 ${names} 缺少依赖链接，正在清掉对应 node_modules 让 pnpm 重建（不会重新下载已缓存的包）……`);
  }
  for (const item of projectBroken) {
    rmSync(resolve(item.folder, "node_modules"), { recursive: true, force: true });
  }

  cleanStaleTempDirs();
  console.info(firstRun
    ? "首次运行：开始安装全部依赖（已下载过的包会直接复用本地缓存）……"
    : "检测到依赖有变化：开始增量安装（只下载本地缓存里还没有的包）……");
  const result = await invokePnpm(["install", "--prefer-offline"]);

  if (result.error) {
    console.error(`无法启动 pnpm install：${result.error.message}`);
    if (result.error.code === "ENOENT") {
      console.error("本机似乎没有安装 pnpm。请先安装 Node.js，再执行 npm install -g pnpm，然后重新选择菜单 2。");
    }
    return result.error.code === "ENOENT" ? 127 : 1;
  }
  if (result.status !== 0) {
    if (result.output.includes("ABORTED_REMOVE_MODULES_DIR_NO_TTY")) {
      console.error("pnpm 需要重建 node_modules，但自动流程没有交互确认。请先运行菜单 1（pnpm install）确认一次，再回到菜单 2。");
    } else {
      console.error("依赖安装失败，请检查网络或代理后重试；也可以先运行菜单 1（pnpm install）完成安装，再回到菜单 2。");
    }
    return result.status ?? 1;
  }
  return 0;
}

// 执行预检；需要补装时安装并复查，全部通过后才允许菜单启动 Web。
async function main() {
  let state;
  try {
    state = await inspectInstallState();
  } catch (error) {
    state = { ready: false, reason: error instanceof Error ? error.message : String(error) };
  }

  if (state.ready) {
    console.info("依赖已安装且与工作区一致，跳过安装。");
    return;
  }

  if (process.argv.includes("--check-only")) {
    console.error(`依赖尚未就绪：${state.reason}`);
    process.exitCode = 2;
    return;
  }

  console.info(`依赖检查发现需要处理的项目：${state.reason}`);
  let exitCode = await runPnpmInstall(state.firstRun === true, state.brokenLinks);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
    return;
  }

  let installedState = await inspectInstallState();
  // 首轮安装可能被新增依赖/锁文件变动先行处理，链接仍缺时按工程重建后再装一次。
  if (!installedState.ready && installedState.brokenLinks?.length) {
    console.info(`安装后仍有 ${installedState.brokenLinks.length} 个工程缺少依赖链接，正在重建后重试……`);
    exitCode = await runPnpmInstall(false, installedState.brokenLinks);
    if (exitCode !== 0) {
      process.exitCode = exitCode;
      return;
    }
    installedState = await inspectInstallState();
  }
  if (!installedState.ready) {
    console.error(`安装后依赖状态仍不完整：${installedState.reason}`);
    process.exitCode = 1;
    return;
  }
  console.info("缺失或新增的依赖已安装完成。");
}

// 捕获预检入口未处理的异常并转换为失败退出码。
// 仅直接执行脚本时启动预检，允许测试导入纯比较函数。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("依赖状态检查失败：", error);
    process.exitCode = 1;
  });
}

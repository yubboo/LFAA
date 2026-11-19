// 仓库依赖状态预检与安全增量安装脚本：在 Node 环境中核对 workspace/lockfile，避免破坏性重建。
// 提供异步流式启动 pnpm 安装子进程的能力，并支持超时/错误诊断。
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
const dependencySections = ["dependencies", "devDependencies", "optionalDependencies"];

// 读取并解析 JSON 文件，供 package 清单和 pnpm 状态复用。
async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
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
  const rootManifest = await readJson(rootManifestPath);
  const appPaths = await collectPackages("apps", 1);
  const packagePaths = await collectPackages("packages", 2);
  const projectPaths = [".", ...appPaths, ...packagePaths];
  const projectRecords = [];
  const importers = parseLockImporters(await readFile(lockfilePath, "utf8"));

  for (const projectPath of projectPaths) {
    const folder = projectPath === "." ? repositoryRoot : resolve(repositoryRoot, projectPath);
    const manifest = await readJson(resolve(folder, "package.json"));
    const lockDependencies = importers.get(projectPath);

    if (!lockDependencies) return { ready: false, reason: `pnpm-lock.yaml 缺少工作区入口 ${projectPath}` };

    for (const section of dependencySections) {
      const declared = section === "dependencies"
        ? {
          ...(manifest.dependencies ?? {}),
          ...Object.fromEntries(Object.entries(manifest.peerDependencies ?? {}).filter(([name]) => manifest.peerDependenciesMeta?.[name]?.optional !== true)),
        }
        : manifest[section] ?? {};
      const locked = [...lockDependencies.entries()]
        .filter(([key]) => key.startsWith(`${section}\0`))
        .map(([key, specifier]) => [key.slice(section.length + 1), specifier]);

      if (locked.length !== Object.keys(declared).length) {
        return { ready: false, reason: `${projectPath} 的 ${section} 与 pnpm-lock.yaml 不一致` };
      }

      // lockfile 已更新但链接未落盘时也要补装；正常就绪路径不会触碰 node_modules。
      for (const [dependencyName, specifier] of Object.entries(declared)) {
        if (lockDependencies.get(`${section}\0${dependencyName}`) !== specifier) {
          return { ready: false, reason: `${projectPath} 新增或更新了依赖 ${dependencyName}` };
        }
        if (section !== "optionalDependencies" && !dependencyLinkExists(folder, dependencyName)) {
          return { ready: false, reason: `${projectPath} 缺少依赖链接 ${dependencyName}` };
        }
      }
    }

    projectRecords.push({ path: projectPath, name: manifest.name, version: manifest.version });
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

// 优先纯离线复用本地 store 缓存，仅当本地缺少新依赖时才联网下载缺失包。
async function runPnpmInstall() {
  cleanStaleTempDirs();
  console.info("检测到依赖未安装或有变化，优先复用本地缓存增量安装（--offline）……");
  let result = await invokePnpm(["install", "--offline"]);

  if (!result.error && result.status !== 0) {
    const missingOfflineCache = /ERR_PNPM_NO_OFFLINE|not found in local store|NO_OFFLINE_/iu.test(result.output);
    const abortedPurge = result.output.includes("ABORTED_REMOVE_MODULES_DIR_NO_TTY");
    if (missingOfflineCache && !abortedPurge) {
      console.info("本地缓存缺少新增依赖，转为 --prefer-offline 仅下载缺失包……");
      result = await invokePnpm(["install", "--prefer-offline"]);
    }
  }

  if (result.error) {
    console.error(`无法启动 pnpm install：${result.error.message}`);
    return result.error.code === "ENOENT" ? 127 : 1;
  }
  if (result.status !== 0) {
    console.error("依赖增量安装失败；安装流程未提供交互确认，pnpm 需要重建 node_modules 时会安全中止。请先运行菜单 1 或手动执行 pnpm install 确认后再启动。");
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
  const exitCode = await runPnpmInstall();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
    return;
  }

  const installedState = await inspectInstallState();
  if (!installedState.ready) {
    console.error(`安装后依赖状态仍不完整：${installedState.reason}`);
    process.exitCode = 1;
    return;
  }
  console.info("新增或缺失的依赖已安装完成。");
}

// 捕获预检入口未处理的异常并转换为失败退出码。
// 仅直接执行脚本时启动预检，允许测试导入纯比较函数。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("依赖状态检查失败：", error);
    process.exitCode = 1;
  });
}

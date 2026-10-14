/**
 * 功能：运行本机 Windows x64 Daemon，并执行 Minecraft、Java、文件管理与 AI 主机命令任务。
 * 作用：轮询控制端已授权的节点业务任务；Wallpaper Engine 和 DSH Bundle 属于 Harness 插件宿主，不属于游戏 Daemon。
 * 关联文件：packages/host/daemon/src/local-daemon.ts、packages/jobs/jobs/src/ai-host-tasks.ts、packages/jobs/jobs/src/minecraft-queue.ts、packages/fs/fs/src/queue.ts、packages/games/minecraft/src/service.ts、packages/games/steamcmd/src/service.ts、apps/daemon/package.json。
 */
import {createRuntimeExecutor} from "lfaa-runtime-environment/src/executor.mjs";
import {fetchRuntimeResource} from "lfaa-runtime-environment/src/network.mjs";
import {promoteSteamcmdInstallation,initializeSteamcmd} from "./steamcmd-installation.mjs";
import { createManagedFileService } from "lfaa-fs/src/managed-files.mjs";
import { protectedDataDirectories } from "lfaa-home-paths/src/reserved-data-paths.mjs";
import { randomUUID, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { startCommand, waitForMinecraftReady, isVanillaReadyLine, terminateProcessTree } from "./process-control.mjs";
import { provisionMinecraftCore, startNativeMinecraftServer, isMinecraftCoreReadyLine, downloadCoreArtifact } from "./minecraft-provisioner.mjs";
import { validateDaemonConnection } from "./connection-config.mjs";
import { createDaemonTaskLanes } from "./task-lanes.mjs";
import { startTerminalChannel } from "./terminal-channel.mjs";
import { stopManagedProcess } from "./managed-process-shutdown.mjs";
import { installEasyTierRuntime, readInstalledEasyTierVersion, validateEasyTierInstallRequest } from "./easytier-runtime.mjs";
import { EASYTIER_RUNTIME_RELEASE } from "lfaa-game-connectivity/src/easytier-release.mjs";
import { closeSync, createReadStream, createWriteStream, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { access, copyFile, lstat, mkdir, opendir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep, win32 } from "node:path";
import { findRepositoryRoot } from "lfaa-home-paths/src/index.mjs";
import { promisify } from "node:util";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { inflateRawSync } from "node:zlib";
import { resolveDataDirectory } from "lfaa-home-paths/src/resolve-data-directory.mjs";
import { protectPrivateDirectory } from "lfaa-home-paths/src/private-directory.mjs";

const repositoryRoot = findRepositoryRoot(import.meta.url);
const environmentFile = resolve(repositoryRoot, ".env");
if (typeof process.loadEnvFile === "function") {
  try { process.loadEnvFile(environmentFile); } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const configuredDataDirectory = process.env.LFAA_DATA_DIR?.trim() || "";
const dataDirectory = resolveDataDirectory(repositoryRoot, configuredDataDirectory);
const credentialsDirectory = resolve(dataDirectory, "credentials");
let minecraftDirectoryRelative = "games/minecraft";
let minecraftDirectory = resolve(dataDirectory, "games", "minecraft");
const knownMinecraftDirectories = new Set([minecraftDirectoryRelative]);
const defaultSteamcmdSettings = { installMode: "online", steamcmdDirectory: "lib/steamcmd", gameDirectory: "games/steamcmd" };
// 文件任务单独领取但仍与安装运维共用维护槽；每秒一次将交互等待压至一个心跳间隔以下。
const fileTaskPollIntervalMilliseconds = 1000;
const javaDirectory = resolve(dataDirectory, "environments", "Java");
const customJavaPathsPath = resolve(javaDirectory, "custom-paths.json");
const backupDirectory = resolve(dataDirectory, "backups", "minecraft");
const downloadDirectory = resolve(dataDirectory, "cache", "minecraft-downloads");
const sandboxMetadataDirectory = resolve(dataDirectory, "environments", "sandbox", "minecraft");
const sandboxHostPath = resolve(repositoryRoot, "dist", "apps", "daemon", "target", "x86_64-pc-windows-msvc", "release", "lfaa-sandbox-host.exe");
const tokenPath = resolve(credentialsDirectory, "daemon-token");
const nodeIdPath = resolve(credentialsDirectory, "daemon-node-id");
const lockPath = resolve(credentialsDirectory, "daemon.lock");
const serverPort = Number(process.env.SERVER_PORT || 3000);
const serverHost = process.env.SERVER_HOST?.trim() || "127.0.0.1";
const connectionPath = resolve(credentialsDirectory, "daemon-connection.json");
// 节点连接配置保存在凭据目录，不能由模型的普通文件/设置工具改写。
const remoteConnection = (() => {
  try {
    let parsed;
    try { parsed = JSON.parse(readFileSync(connectionPath, "utf8")); } catch (error) { if (error?.code === "ENOENT") return null; throw new Error("节点连接文件无法读取或不是有效 JSON。"); }
    return validateDaemonConnection(parsed);
  } catch (error) { if (error?.code === "ENOENT") return null; throw error; }
})();
const apiBase = remoteConnection?.controlPlaneUrl ?? `http://${serverHost}:${serverPort}/api`;
// 节点版本以当前包清单为准，避免发布时遗漏业务文件中的重复版本常量。
const daemonVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const sandboxBackendId = "windows-appcontainer-v1";
const sandboxCapability = "app-sandbox-windows-appcontainer-v1";
const javaRuntimeSelectionCapability = "minecraft-java-runtime-selection-v1";
const sandboxReadyPrefix = "\u001eLFAA_SANDBOX_READY:";
const execFileAsync = promisify(execFile);
let nodeId = "";
const activeServers = new Map();
// 目录按用户填写的实例名称保存；此映射让进程和任务仍按稳定 UUID 定位实例。
const minecraftInstanceDirectories = new Map();
const activeTasks = new Set();
const minecraftTaskControllers=new Map();
let taskLanes;
const activeCommands = new Map();
const logBuffers = new Map();
let shuttingDown = false;
let pollingController;
let runLoopPromise;
let fileTaskLoopPromise;
let terminalChannel;
let daemonToken = "";
let lockNonce = "";
let sandboxBackendAvailable = false;
let easyTierRuntimeVersion = null;
let nextEasyTierRuntimeProbeAt = 0;
let lastEasyTierRuntimeProbeError = "";
let controlPlaneReady = false;
let lastControlPlaneError = "";
let steamcmdSettings = { ...defaultSteamcmdSettings };

// Daemon 启动和关闭由 Cordis Fiber 管理；导入模块不登记节点或启动轮询。
export async function apply(ctx) {
  if (process.platform !== "win32" || process.arch !== "x64") throw new Error("LFAA Daemon 当前只支持 Windows x64。");
  if (runLoopPromise && !shuttingDown) throw new Error("本进程已经装配了 Daemon 执行插件。");
  protectPrivateDirectory(credentialsDirectory);
  shuttingDown = false;
  controlPlaneReady = false;
  lastControlPlaneError = "";
  pollingController = new AbortController();
  taskLanes = createDaemonTaskLanes({ activeTaskIds: activeTasks, onError: error => process.stderr.write(`节点任务收尾失败：${safeMessage(error)}\n`) });
  nodeId = remoteConnection?.nodeId ?? await loadOrCreateNodeId();
  ctx.effect(() => () => shutdown("Harness 卸载"));
  const onExit = () => releaseDaemonLock();
  process.once("exit", onExit);
  ctx.effect(() => () => { process.off("exit", onExit); });
  await initialize();
}

async function initialize() {
  for (const directory of [credentialsDirectory, minecraftDirectory, javaDirectory, backupDirectory, downloadDirectory, sandboxMetadataDirectory]) {
    await mkdir(directory, { recursive: true });
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("LFAA Daemon 数据目录不能是符号链接或非目录路径。");
  }
  // 菜单可能在节点已运行时再次启动；复用现有进程，避免 Daemon 重复启动让并行开发服务一起退出。
  if (!acquireDaemonLock()) { if (process.connected) process.disconnect(); return; }
  await rebuildMinecraftInstanceDirectoryIndex();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      daemonToken = remoteConnection?.token ?? (await readFile(tokenPath, "utf8")).trim();
      break;
    } catch (error) {
      if (error?.code !== "ENOENT" || attempt === 29) throw error;
      await delay(1000);
    }
  }
  if (daemonToken.length < 32) throw new Error("本机 Daemon 通信密钥无效。");
  sandboxBackendAvailable = await detectSandboxBackend();
  await refreshEasyTierRuntimeVersion(true);
  if (!sandboxBackendAvailable) process.stderr.write("Windows AppContainer Host 不可用；原生 Minecraft 可按账户设置执行，AppContainer 实例不可启动。\n");
  process.stdout.write(`LFAA 本机 Daemon 已启动（${nodeId.slice(0, 8)}）。\n`);
  runLoopPromise = runLoop();
  fileTaskLoopPromise = runFileTaskPoller();
  terminalChannel = startTerminalChannel({ apiBase, nodeId, readToken, signal: pollingController.signal, onError: message => process.stderr.write(`节点终端连接暂不可用：${message}\n`) });
}

async function detectSandboxBackend() {
  try {
    const { stdout } = await execFileAsync(sandboxHostPath, ["--probe"], { cwd: repositoryRoot, windowsHide: true, timeout: 5000, maxBuffer: 16 * 1024 });
    const result = JSON.parse(stdout.trim());
    return result?.backend === sandboxBackendId
      && result?.protocolVersion === 1
      && Array.isArray(result?.networkCapabilities)
      && result.networkCapabilities.includes("internetClientServer")
      && result.networkCapabilities.includes("privateNetworkClientServer");
  } catch {
    return false;
  }
}

function getSandboxMetadataPath(instanceId) {
  return resolve(sandboxMetadataDirectory, `${requireInstanceId(instanceId)}.json`);
}

async function readSandboxMetadata(instanceId) {
  try {
    const path = getSandboxMetadataPath(instanceId);
    await assertSafeFileTarget(path, false);
    const value = JSON.parse(await readFile(path, "utf8"));
    if (value?.backend !== sandboxBackendId || value?.appId !== "minecraft" || value?.instanceId !== instanceId) return null;
    if (value.version === 2 && typeof value.javaRootPath === "string") return value;
    if (value.version === 1 && typeof value.javaRootName === "string" && basename(value.javaRootName) === value.javaRootName) {
      return { ...value, javaRootPath: resolve(javaDirectory, value.javaRootName) };
    }
    return null;
  } catch {
    return null;
  }
}

async function prepareMinecraftSandbox(instanceId, instanceName, java, memoryMb, taskId, instanceDirectory) {
  if (!sandboxBackendAvailable) throw new Error("Windows AppContainer Sandbox Host 不可用，已拒绝启动 Minecraft Java。");
  if (!java?.root || !java.executable) throw new Error("所选 Java 运行环境缺少有效路径。");
  await mkdir(javaDirectory, { recursive: true });
  await mkdir(sandboxMetadataDirectory, { recursive: true });
  const javaRootName = basename(java.root);
  const existing = await readSandboxMetadata(instanceId);
  const previousJavaRoot = existing?.javaRootPath && !sameWindowsPath(existing.javaRootPath, java.root)
    ? existing.javaRootPath
    : null;

  let output;
  try {
    const args = [
      "--prepare", "--data-root", dataDirectory, "--instance-storage", minecraftStorageDirectoryForInstance(instanceDirectory), "--instance-id", instanceId, "--instance-name", instanceName,
      "--java", java.executable, "--java-root", java.root, "--memory-mb", String(memoryMb)
    ];
    if (previousJavaRoot && await fileExists(previousJavaRoot)) args.push("--previous-java-root", previousJavaRoot);
    output = await execFileAsync(sandboxHostPath, args, { cwd: repositoryRoot, windowsHide: true, timeout: 120_000, maxBuffer: 32 * 1024 });
  } catch (error) {
    const detail = String(error?.stderr || "").trim();
    throw new Error(detail || "Windows 无法为 Minecraft 实例准备独立 AppContainer 权限。");
  }
  let result;
  try { result = JSON.parse(output.stdout.trim()); }
  catch { throw new Error("Windows AppContainer Sandbox Host 返回了无效准备状态。"); }
  if (result?.backend !== sandboxBackendId || result?.appId !== "minecraft" || result?.instanceId !== instanceId) {
    throw new Error("Windows AppContainer Sandbox Host 未确认实例隔离准备。");
  }
  if (existing?.version === 2 && sameWindowsPath(existing.javaRootPath, java.root)) return existing;

  const metadata = {
    version: 2,
    backend: sandboxBackendId,
    appId: "minecraft",
    instanceId,
    javaRootName,
    javaRootPath: java.root,
    preparedAt: new Date().toISOString()
  };
  const destination = getSandboxMetadataPath(instanceId);
  const temporary = resolve(sandboxMetadataDirectory, `.${instanceId}.${taskId}.${randomUUID()}.tmp`);
  await assertSafeFileTarget(temporary);
  await writeFile(temporary, JSON.stringify(metadata), { encoding: "utf8", flag: "wx" });
  await assertSafeFileTarget(destination);
  await rename(temporary, destination);
  return metadata;
}

async function loadOrCreateNodeId() {
  try {
    const stored = (await readFile(nodeIdPath, "utf8")).trim();
    if (/^[0-9a-f-]{36}$/iu.test(stored)) return stored;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await mkdir(credentialsDirectory, { recursive: true });
  const created = randomUUID();
  try {
    await writeFile(nodeIdPath, `${created}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    return created;
  } catch (error) {
    if (error?.code === "EEXIST") return (await readFile(nodeIdPath, "utf8")).trim();
    throw error;
  }
}

function acquireDaemonLock() {
  lockNonce = randomUUID();
  const contents = `${process.pid}\n${lockNonce}\n`;
  const createLock = () => {
    const descriptor = openSync(lockPath, "wx", 0o600);
    try { writeFileSync(descriptor, contents); }
    finally { closeSync(descriptor); }
  };
  try { createLock(); return true; }
  catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }

  let existing;
  try { existing = readFileSync(lockPath, "utf8"); }
  catch (error) { if (error?.code === "ENOENT") { createLock(); return true; } throw error; }
  const pid = Number(existing.split(/\r?\n/u)[0]);
  if (Number.isInteger(pid) && pid > 0 && isProcessRunning(pid)) {
    process.stdout.write(`本机 Daemon 已由进程 ${pid} 运行，复用现有节点；未启动重复进程。\n`);
    return false;
  }
  if (readFileSync(lockPath, "utf8") !== existing) throw new Error("本机 Daemon 锁状态刚刚变化，请检查是否已有进程启动。");
  try { unlinkSync(lockPath); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  try { createLock(); }
  catch (error) {
    if (error?.code === "EEXIST") {
      process.stdout.write("本机 Daemon 已由其他启动进程接管，复用现有节点；未启动重复进程。\n");
      return false;
    }
    throw error;
  }
  return true;
}

function releaseDaemonLock() {
  if (!lockNonce) return;
  try {
    const lock = readFileSync(lockPath, "utf8").split(/\r?\n/u);
    if (lock[1] === lockNonce) unlinkSync(lockPath);
  } catch { /* 进程退出时不覆盖锁文件错误。 */ }
}

async function readToken() {
  const token = remoteConnection?.token ?? (await readFile(tokenPath, "utf8")).trim();
  if (token.length < 32) throw new Error("本机 Daemon 通信密钥无效。");
  daemonToken = token;
  return token;
}

async function apiRequest(path, options = {}) {
  options.signal?.throwIfAborted();
  await readToken();
  options.signal?.throwIfAborted();
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    // 节点结果可能含私有文件输出，不能跟随重定向把请求正文发给其他地址或降级到 HTTP。
    redirect: "error",
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeout ?? 15_000)]) : AbortSignal.timeout(options.timeout ?? 15_000),
    headers: {
      authorization: `Bearer ${daemonToken}`,
      "content-type": "application/json",
      ...options.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `控制端请求失败（${response.status}）。`);
  }
  if (response.status === 204) return null;
  return await response.json();
}

async function runLoop() {
  // 只取消心跳与领取轮询；现有任务的完成/故障回报仍经过正常认证和校验。
  const pollRequest = (path, options = {}) => apiRequest(path, { ...options, signal: pollingController.signal });
  while (!shuttingDown) {
    if (!controlPlaneReady) {
      try {
        await pollRequest("/health");
        if (shuttingDown) break;
        controlPlaneReady = true;
        if (lastControlPlaneError) process.stdout.write("Daemon 已连接控制端，开始处理心跳与任务。\n");
        lastControlPlaneError = "";
      } catch (error) {
        if (shuttingDown) break;
        const message = safeMessage(error);
        if (message !== lastControlPlaneError) process.stderr.write(`Daemon 正在等待控制端就绪：${message}\n`);
        lastControlPlaneError = message;
        await delay(5000, pollingController.signal);
        continue;
      }
    }

    try {
      // Java 探测可能启动多个进程；后台刷新，不能阻塞节点心跳与正在执行的任务续租。
      const javaRuntimes = cachedJavaRuntimes;
      if (!javaDiscoveryPending && Date.now() >= javaDiscoveryRefreshAt) {
        javaDiscoveryPending = discoverJavaRuntimes().then(value => { cachedJavaRuntimes = value; })
          .catch(error => { process.stderr.write(`Java 环境刷新失败：${safeMessage(error)}\n`); })
          .finally(() => { javaDiscoveryPending = null; javaDiscoveryRefreshAt = Date.now() + 60_000; });
      }
      await refreshEasyTierRuntimeVersion();
      const capabilities = ["minecraft-vanilla", "minecraft-native-v1", "minecraft-multicore-v1", "minecraft-instance-archive-v1", "java-environment-manager-v1", "runtime-environment-v1", javaRuntimeSelectionCapability, "node-filesystem-v1", "node-filesystem-v2", "node-filesystem-directory-size-v1", "agent-shell-v1", "project-files-v1", "git-workspace-v1", EASYTIER_RUNTIME_RELEASE.installCapability, ...(easyTierRuntimeVersion === EASYTIER_RUNTIME_RELEASE.version ? [EASYTIER_RUNTIME_RELEASE.runtimeCapability] : []), ...(sandboxBackendAvailable ? [sandboxCapability] : [])];
      if (await steamcmdExecutableReady(steamcmdSettings.steamcmdDirectory)) capabilities.push("steamcmd-ready-v1");
      const heartbeat = await pollRequest("/daemon/heartbeat", {
        method: "POST",
        body: JSON.stringify({
          id: nodeId,
          displayName: remoteConnection?.displayName ?? process.env.COMPUTERNAME ?? "本机节点",
          platform: process.platform,
          architecture: process.arch,
          version: daemonVersion,
          dataRoot: dataDirectory,
          capabilities,
          javaRuntimes,
          activeTaskIds: [...activeTasks],
          instances: await scanMinecraftInstances()
        })
      });
      if (shuttingDown) break;
      for (const id of heartbeat?.cancelTaskIds ?? []) { const command = activeCommands.get(id); if (command) void command.cancel(); }
      for(const id of heartbeat?.cancelMinecraftTaskIds??[])minecraftTaskControllers.get(id)?.abort(new DOMException("用户取消 Minecraft 任务。","AbortError"));
      if (heartbeat?.steamcmdSettings) steamcmdSettings = validateSteamcmdSettings(heartbeat.steamcmdSettings);
      if (heartbeat?.minecraftStorageSettings) await applyMinecraftStorageSettings(heartbeat.minecraftStorageSettings);
      if (heartbeat?.runtimeStorageSettings && JSON.stringify(heartbeat.runtimeStorageSettings)!==JSON.stringify(runtimeStorage)) {
        runtimeStorage=heartbeat.runtimeStorageSettings;
        javaManager=createRuntimeExecutor({dataDirectory,repositoryRoot,storage:runtimeStorage,activeServers,postTaskProgress}).manager;
        javaDiscoveryRefreshAt=0;
      }

      await taskLanes.poll({
        claim: async path => (await pollRequest(path, { method: "POST", body: JSON.stringify({ nodeId }) })).task,
        maintenance: [
          { path: "/daemon/runtime/tasks/claim", execute: executeRuntimeTask },
          { path: "/daemon/tasks/claim", execute: executeTask },
          { path: "/daemon/steamcmd/tasks/claim", execute: executeSteamcmdTask },
          { path: "/connectivity/daemon/easytier/install/claim", execute: executeConnectivityInstallTask }
        ],
        shell: { path: "/daemon/ai/host-tasks/claim", execute: executeAiHostTask }
      });
    } catch (error) {
      controlPlaneReady = false;
      const message = safeMessage(error);
      if (!shuttingDown && message !== lastControlPlaneError) process.stderr.write(`Daemon 与控制端通信暂不可用：${message}\n`);
      lastControlPlaneError = message;
    }
    await delay(5000, pollingController.signal);
  }
}

async function runFileTaskPoller() {
  const pollRequest = (path, options = {}) => apiRequest(path, { ...options, signal: pollingController.signal });
  let lastFileTaskPollError = "";
  while (!shuttingDown) {
    if (controlPlaneReady) {
      try {
        await taskLanes.pollFile({
          claim: async path => (await pollRequest(path, { method: "POST", body: JSON.stringify({ nodeId }) })).task,
          queue: { path: "/daemon/files/tasks/claim", execute: executeNodeFileTask }
        });
        lastFileTaskPollError = "";
      } catch (error) {
        const message = safeMessage(error);
        if (!shuttingDown && message !== lastFileTaskPollError) process.stderr.write(`Daemon 文件任务领取暂不可用：${message}\n`);
        lastFileTaskPollError = message;
      }
    }
    await delay(fileTaskPollIntervalMilliseconds, pollingController.signal);
  }
}

async function rebuildMinecraftInstanceDirectoryIndex() {
  for (const storageDirectory of knownMinecraftDirectories) {
    const root = await getExistingMinecraftStorageRoot(storageDirectory);
    if (!root) continue;
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const directory = resolve(root, entry.name);
      let instanceId;
      try { instanceId = await readMinecraftInstanceId(directory, entry.name); }
      catch { continue; }
      if (!instanceId) continue;
      const previousDirectory = minecraftInstanceDirectories.get(instanceId);
      if (previousDirectory && previousDirectory !== directory) throw new Error("Minecraft 实例 ID 对应了多个数据目录，Daemon 已停止启动以保护实例数据。");
      minecraftInstanceDirectories.set(instanceId, directory);
    }
  }
}

function validateMinecraftStorageDirectory(value) {
  if (typeof value !== "string" || value.length > 2048 || /[\r\n\u0000]/u.test(value)) throw new Error("Minecraft 实例目录无效。");
  const absolute = win32.isAbsolute(value);
  if (absolute && value.split(/[\\/]/u).includes("..")) throw new Error("Minecraft 实例目录不能包含父目录跳转。");
  if (!absolute && (value.includes("\\") || value.startsWith("/") || /^[a-z]:/iu.test(value))) throw new Error("Minecraft 实例目录必须是数据根目录内的相对路径或磁盘绝对路径。");
  const normalized = absolute ? win32.normalize(value) : value;
  const volumeRoot = absolute ? win32.parse(normalized).root : "";
  if (absolute && (!/^[a-z]:\\$/iu.test(volumeRoot) || normalized.length <= volumeRoot.length)) throw new Error("Minecraft 实例根目录必须是磁盘内的普通文件夹。");
  const segments = absolute ? win32.relative(volumeRoot, normalized).split("\\") : value.split("/");
  if (segments.length < 1 || segments.length > 32 || segments.some((segment) =>
    segment.length === 0 || segment.length > 120 || segment === "." || segment === ".."
    || /[<>:"|?*\u0000-\u001f]/u.test(segment) || /[ .]$/u.test(segment)
    || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(segment)
  ) || !absolute && protectedDataDirectories.includes(segments[0]?.toLocaleLowerCase() ?? "")) {
    throw new Error("Minecraft 实例目录包含不受支持的路径片段。");
  }
  if (absolute) {
    const dataRelative = win32.relative(win32.resolve(dataDirectory), normalized);
    const insideData = dataRelative === "" || dataRelative !== ".." && !dataRelative.startsWith(`..${win32.sep}`) && !win32.isAbsolute(dataRelative);
    if (insideData && protectedDataDirectories.includes(dataRelative.split(win32.sep)[0]?.toLocaleLowerCase() ?? "")) throw new Error("Minecraft 实例目录不能放在凭据、数据库、配置或会话目录中。");
    return normalized;
  }
  return segments.join("/");
}

function getMinecraftStorageRoot(storageDirectory) {
  const validated = validateMinecraftStorageDirectory(storageDirectory);
  if (win32.isAbsolute(validated)) return win32.resolve(validated);
  const root = resolve(dataDirectory, ...validated.split("/"));
  const rel = relative(dataDirectory, root);
  if (!rel || rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) throw new Error("Minecraft 实例根目录越过 LFAA 数据根目录。");
  return root;
}

async function ensureStorageDirectory(root) {
  const target = win32.resolve(root);
  const volumeRoot = win32.parse(target).root;
  if (!/^[a-z]:\\$/iu.test(volumeRoot) || target === volumeRoot) throw new Error("存储目录必须位于可用磁盘的普通文件夹中。");
  let current = volumeRoot;
  for (const segment of win32.relative(volumeRoot, target).split(win32.sep).filter(Boolean)) {
    current = resolve(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Minecraft 存储目录不能是符号链接或非目录路径。");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await mkdir(current);
    }
  }
  return target;
}

async function getExistingMinecraftStorageRoot(storageDirectory) {
  const root = getMinecraftStorageRoot(storageDirectory);
  const volumeRoot = win32.parse(root).root;
  let current = volumeRoot;
  for (const segment of win32.relative(volumeRoot, root).split(win32.sep).filter(Boolean)) {
    current = resolve(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Minecraft 存储目录不能是符号链接或非目录路径。");
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }
  return root;
}

// 心跳接收当前目录及所有已记录路径；只创建当前默认目录，历史实例仍按原根目录扫描。
async function applyMinecraftStorageSettings(settings) {
  const currentDirectory = validateMinecraftStorageDirectory(settings.instanceDirectory);
  const listedDirectories = Array.isArray(settings.knownDirectories) ? settings.knownDirectories : [];
  const directories = new Set([currentDirectory, "games/minecraft"]);
  for (const item of listedDirectories) directories.add(validateMinecraftStorageDirectory(item));
  knownMinecraftDirectories.clear();
  for (const item of directories) knownMinecraftDirectories.add(item);
  minecraftDirectoryRelative = currentDirectory;
  minecraftDirectory = await ensureStorageDirectory(getMinecraftStorageRoot(currentDirectory));
  await rebuildMinecraftInstanceDirectoryIndex();
}

async function readMinecraftInstanceId(directory, fallbackDirectoryName = "") {
  // 新目录从安装标记或实例元数据读取 UUID；旧版 UUID 目录则继续按目录名识别。
  for (const filename of ["daemon-installing.json", "lfaa-instance.json", "lfaa-provision.json"]) {
    try {
      const value = JSON.parse(await readSafeFile(resolve(directory, filename), "utf8"));
      if (typeof value?.instanceId === "string" && /^[0-9a-f-]{36}$/iu.test(value.instanceId)) return value.instanceId;
    } catch (error) {
      if (error?.code !== "ENOENT") continue;
    }
  }
  return /^[0-9a-f-]{36}$/iu.test(fallbackDirectoryName) ? fallbackDirectoryName : null;
}

async function scanMinecraftInstances() {
  const result = [];
  const reportedIds = new Set();
  for (const storageDirectory of knownMinecraftDirectories) {
    const root = await getExistingMinecraftStorageRoot(storageDirectory);
    if (!root) continue;
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const directory = resolve(root, entry.name);
      let instanceId;
      try { instanceId = await readMinecraftInstanceId(directory, entry.name); }
      catch { continue; }
      if (!instanceId || reportedIds.has(instanceId)) continue;
      reportedIds.add(instanceId);
      minecraftInstanceDirectories.set(instanceId, directory);
      const markerPath = resolve(directory, "daemon-process.json");
      const installingPath = resolve(directory, "daemon-installing.json");
      const instanceMetadata = await readInstanceMetadata(directory).catch(() => null);
      const launchPath = instanceMetadata?.launch?.path;
      const jarExists = typeof launchPath === "string" && !isAbsolute(launchPath) && !launchPath.split(/[\\/]/u).includes("..")
        ? await safeFileExists(resolve(directory, launchPath)) : await safeFileExists(resolve(directory, "server.jar"));
      if (await safeFileExists(installingPath)) {
      try {
        const installMarker = JSON.parse(await readSafeFile(installingPath, "utf8"));
        if (typeof installMarker.taskId !== "string") throw new Error("安装任务标记无效。");
        if (installMarker.instanceId && installMarker.instanceId !== instanceId) throw new Error("安装任务标记中的实例 ID 无效。");
        if (activeTasks.has(installMarker.taskId)) {
          result.push({ id: instanceId, state: "installing", sandboxStatus: sandboxBackendAvailable ? "unprepared" : "unsupported" });
          continue;
        }
        await rm(installingPath, { force: true });
        result.push({ id: instanceId, state: "unknown", sandboxStatus: "unknown" });
        continue;
      } catch {
        result.push({ id: instanceId, state: "unknown", sandboxStatus: "unknown" });
        continue;
      }
      }
      if (!jarExists) continue;
      const currentProcess = activeServers.get(instanceId);
      if (currentProcess && !currentProcess.child.killed && currentProcess.child.exitCode === null) {
        result.push({ id: instanceId, state: currentProcess.serverReady ? "running" : "starting", sandboxStatus: currentProcess.executionMode === "native" ? "unsupported" : currentProcess.sandboxReady ? "running" : "unknown" });
        continue;
      }
      if (await safeFileExists(markerPath)) {
      try {
        const processInfo = JSON.parse(await readSafeFile(markerPath, "utf8"));
        if (Number.isInteger(processInfo.pid) && isProcessRunning(processInfo.pid)) {
          result.push({ id: instanceId, state: "unknown", sandboxStatus: "unknown" });
          continue;
        }
        await rm(markerPath, { force: true });
      } catch {
        result.push({ id: instanceId, state: "unknown", sandboxStatus: "unknown" });
        continue;
      }
      }
      const prepared = await readSandboxMetadata(instanceId);
      result.push({
        id: instanceId,
        state: "stopped",
        sandboxStatus: instanceMetadata?.executionMode === "native" || !sandboxBackendAvailable ? "unsupported" : prepared ? "prepared" : "unprepared"
      });
    }
  }
  return result;
}

function isProcessRunning(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === "EPERM"; }
}

async function executeTask(task) {
  const controller=new AbortController();minecraftTaskControllers.set(task.id,controller);
  let operationCompleted=false;
  try {
    await postTaskProgress(task.id, 5, "正在检查任务输入和目标实例。");
    let result = {};
    switch (task.kind) {
      case "install":
        if (task.payload?.operation === "provision") result = await provisionMinecraftCore(task, {
          signal:controller.signal,fetchResource:fetchRuntimeResource,cacheDirectory:runtimeStorage.downloadCacheDirectory,
          createDirectory: createSafeInstanceDirectory, java: (major, runtimeId, progress) => createRuntimeExecutor({dataDirectory,repositoryRoot,storage:runtimeStorage,signal:controller.signal,activeServers}).manager.resolveMinecraftJavaRuntime(major, runtimeId, progress, task.payload.downloadTimeoutSeconds), progress: postTaskProgress,
          start: startMinecraftInstance, phpDirectory: resolve(dataDirectory, "environments", "php", "pocketmine"),
          assertSafeDirectory: ensureManagedDirectory, assertSafeFileTarget, safeFileExists, readSafeFile, isProcessRunning, findExecutable, expandZip,
          installerLog: (installTask) => {
            const offsets = { stdout: 0, stderr: 0 };
            return (value) => { for (const stream of ["stdout", "stderr"]) { const text = value[stream].slice(offsets[stream]); offsets[stream] = value[stream].length; if (text) bufferLogs(installTask.instanceId, installTask.id, stream, text.split(/\r?\n/u)); } };
          }
        });
        else if (task.payload?.operation === "deploy") result = await installMinecraftDeployment(task);
        else if (task.payload?.operation === "register") result = await registerMinecraftInstance(task);
        else result = await installMinecraftInstance(task);
        break;
      case "start": result = await startMinecraftInstance(task); break;
      case "stop": result = await stopMinecraftInstance(task); break;
      case "restart": {
        const stopped = await stopMinecraftInstance(task);
        if (stopped.forced) throw new Error("上次停服被强制终止，未自动启动；请核查存档后手动启动。");
        result = await startMinecraftInstance(task); break;
      }
      case "console": {
        const runtime = activeServers.get(requireInstanceId(task.instanceId));
        const command = task.payload?.command;
        if (!runtime?.serverReady || typeof command !== "string" || !command.trim() || command.length > 1024 || /[\u0000-\u001f\u007f]/u.test(command)) throw new Error("实例控制台不可用或命令无效。");
        await new Promise((resolve, reject) => runtime.child.stdin.write(`${command}\n`, error => error ? reject(error) : resolve()));
        result = { delivered: true, verified: false, note: "命令已写入服务器标准输入；效果须读取后续日志验证。" }; break;
      }
      case "properties": result = await applyMinecraftProperties(task); break;
      case "backup": result = await backupMinecraftWorld(task); break;
      case "delete": result = await archiveMinecraftInstance(task); break;
      case "java-install": result = await executeJavaEnvironmentTask(task); break;
      default: throw new Error("Daemon 拒绝执行未登记的任务类型。");
    }
    operationCompleted=true;
    await flushMinecraftTaskLogs(task.id);
    await apiRequest(`/daemon/tasks/${task.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ nodeId, succeeded: true, message: result.forced ? "实例已强制结束；未确认存档完整性，请先核查日志和世界文件。" : "Minecraft 任务已完成。", result })
    });
  } catch (error) {
    const message = (operationCompleted?`节点已执行操作，但控制端未确认结果：${safeMessage(error)}`:safeMessage(error)).slice(0,240);
    await sendSystemLog(task.instanceId, task.id, `任务失败：${message}`).catch(() => undefined);
    await flushMinecraftTaskLogs(task.id);
    await apiRequest(`/daemon/tasks/${task.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ nodeId, succeeded: false, message, result: operationCompleted?{outcome:"unknown"}:controller.signal.aborted?{outcome:"cancelled"}:{} })
    }).catch(() => undefined);
  } finally {minecraftTaskControllers.delete(task.id);}
}

async function executeNodeFileTask(task) {
  try {
    const result = await performNodeFileOperation(task.operation, task.payload ?? {});
    await apiRequest(`/daemon/files/tasks/${task.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ nodeId, succeeded: true, message: "文件操作已完成。", result })
    });
  } catch (error) {
    await apiRequest(`/daemon/files/tasks/${task.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ nodeId, succeeded: false, message: safeMessage(error), result: {} })
    }).catch(() => undefined);
  }
}

const aiHostOutputLimitBytes = 1024 * 1024;

async function executeAiHostTask(task) {
  let latest, sequence = 0, dirty = false, sending = Promise.resolve(), flushing = false;
  let command;
  const flush = async () => {
    if (!dirty || !latest || flushing) return;
    flushing = true;
    dirty = false;
    const snapshot = latest, currentSequence = ++sequence;
    sending = apiRequest(`/daemon/ai/host-tasks/${task.id}/output`, {
      method: 'POST', body: JSON.stringify({ nodeId, sequence: currentSequence, result: snapshot })
    });
    try { await sending; } finally { flushing = false; }
  };
  // 运行输出分批回传；网络失败不会重放已执行命令。
  const outputTimer = setInterval(() => { void flush().catch(() => { dirty = true; }); }, 750);
  try {
    const shell = task.shell;
    const executable = shell === 'project-files' ? process.execPath : shell === 'powershell' ? 'powershell.exe' : shell === 'bash' || shell === 'zsh' ? shell : process.env.ComSpec || 'cmd.exe';
    const args = shell === 'project-files' ? [fileURLToPath(new URL('./project-files.mjs', import.meta.url))]
      : shell === 'powershell' ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [Console]::OutputEncoding; & { ${task.command}\n }`]
      : shell === 'bash' || shell === 'zsh' ? ['-lc', task.command] : ['/d', '/s', '/c', task.command];
    // 控制面和模型秘密不继承给命令进程；本机执行仍具有节点 OS 账户的原生权限。
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/(?:TOKEN|SECRET|PASSWORD|API_KEY|COOKIE|AUTHORIZATION)/iu.test(key)));
    if (shell === 'project-files') env.LFAA_DAEMON_DATA_ROOT = dataDirectory;
    command = startCommand({ executable, args, cwd: task.workingDirectory || repositoryRoot,
      env, input: shell === 'project-files' ? task.command : undefined, timeoutSeconds: task.timeoutSeconds,
      onOutput: value => { latest = value; dirty = true; }, outputLimitBytes: aiHostOutputLimitBytes });
    activeCommands.set(task.id, command);
    const result = await command.done;
    latest = result; dirty = true;
    clearInterval(outputTimer);
    await sending.catch(() => {});
    await flush().catch(() => {});
    const succeeded = result.exitCode === 0 && !result.timedOut && !result.cancelled;
    await apiRequest(`/daemon/ai/host-tasks/${task.id}/complete`, { method: 'POST', body: JSON.stringify({ nodeId, succeeded,
      message: result.cancelled ? '节点已确认任务进程退出；已产生的文件或外部副作用不会撤销。' : result.timedOut ? '命令超时，进程已退出。' : succeeded ? '命令执行完成。' : '命令执行失败，请检查输出。', result }) });
  } catch (error) {
    const message = safeMessage(error);
    if (command) { await command.cancel(); await command.done; }
    await apiRequest(`/daemon/ai/host-tasks/${task.id}/complete`, { method: 'POST', body: JSON.stringify({ nodeId, succeeded: false,
      message: `命令启动或回传失败：${message.slice(0, 180)}`, result: latest ?? { stdout: '', stderr: message, exitCode: null, timedOut: false, outputTruncated: false } }) }).catch(() => {});
  } finally { clearInterval(outputTimer); activeCommands.delete(task.id); }
}

async function executeConnectivityInstallTask(task) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);
  timeout.unref?.();
  activeCommands.set(task.id, { cancel: async () => controller.abort() });
  let succeeded = false;
  let version;
  try {
    validateEasyTierInstallRequest({ operation: "install-easytier-runtime", version: task.version });
    const installed = await installEasyTierRuntime({
      dataDirectory,
      ensureManagedDirectory,
      downloadAndVerify: (url, destinationPath, integrity, signal) => downloadAndVerify(url, destinationPath, integrity, signal),
      expandArchive: expandZip,
      probeVersion: probeEasyTierVersion,
      signal: controller.signal,
      id: task.id
    });
    easyTierRuntimeVersion = installed.version;
    nextEasyTierRuntimeProbeAt = Date.now() + 60_000;
    version = installed.version;
    succeeded = true;
  } catch {
    succeeded = false;
  }
  clearTimeout(timeout);
  activeCommands.delete(task.id);
  try {
    await apiRequest(`/connectivity/daemon/easytier/install/${task.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ nodeId, succeeded, ...(succeeded ? { version } : {}) })
    });
  } catch {
    // 回报失败后任务会在控制面截止时间后标记为结果未知，不会自动重放安装操作。
  } finally {
    activeCommands.delete(task.id);
  }
}

async function refreshEasyTierRuntimeVersion(force = false) {
  if (!force && Date.now() < nextEasyTierRuntimeProbeAt) return;
  nextEasyTierRuntimeProbeAt = Date.now() + 60_000;
  try {
    easyTierRuntimeVersion = await readInstalledEasyTierVersion({ dataDirectory, probeVersion: probeEasyTierVersion });
  } catch (error) {
    easyTierRuntimeVersion = null;
    const message = safeMessage(error);
    if (!lastEasyTierRuntimeProbeError || lastEasyTierRuntimeProbeError !== message) process.stderr.write(`EasyTier 运行包状态核验失败：${message}\n`);
    lastEasyTierRuntimeProbeError = message;
    return;
  }
  lastEasyTierRuntimeProbeError = "";
}

async function probeEasyTierVersion(executable) {
  const result = await captureProcess(executable, ["--version"], 10_000);
  const output = `${result.stdout}\n${result.stderr}`;
  const match = /\beasytier-core\s+v?(\d+\.\d+\.\d+)\b/iu.exec(output) ?? /\bv?(\d+\.\d+\.\d+)\b/u.exec(output);
  return match?.[1] ?? "";
}

async function executeSteamcmdTask(task) {
  try {
    const result = task.kind === "install" ? await installSteamcmd(task) : await verifySteamcmd(task);
    await apiRequest(`/daemon/steamcmd/tasks/${task.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ nodeId, succeeded: true, message: result.verified ? "SteamCMD 已就绪，游戏存储目录已准备。" : "SteamCMD 校验完成。", result })
    });
  } catch (error) {
    await apiRequest(`/daemon/steamcmd/tasks/${task.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ nodeId, succeeded: false, message: safeMessage(error), result: { verified: false } })
    }).catch(() => undefined);
  }
}

async function postSteamcmdProgress(taskId, progress, message) {
  await apiRequest(`/daemon/steamcmd/tasks/${taskId}/progress`, {
    method: "POST",
    body: JSON.stringify({ nodeId, progress, message })
  });
}

function validateSteamcmdSettings(value) {
  if (!value || !["online", "manual"].includes(value.installMode)) throw new Error("控制端返回的 SteamCMD 安装设置无效。");
  const toolDirectory = resolveManagedFilePath(value.steamcmdDirectory);
  const gameDirectory = resolveSteamcmdGameDirectory(value.gameDirectory);
  if (pathsOverlap(toolDirectory, gameDirectory)) {
    throw new Error("SteamCMD 工具目录和游戏存储目录不能相同或互相包含。");
  }
  return { installMode: value.installMode, steamcmdDirectory: value.steamcmdDirectory, gameDirectory: value.gameDirectory };
}

function resolveSteamcmdGameDirectory(value) {
  const validated = validateMinecraftStorageDirectory(value);
  return win32.isAbsolute(validated) ? win32.resolve(validated) : resolveManagedFilePath(validated);
}

function pathsOverlap(left, right) {
  const normalizedLeft = win32.resolve(left).toLocaleLowerCase("en-US");
  const normalizedRight = win32.resolve(right).toLocaleLowerCase("en-US");
  const leftToRight = win32.relative(normalizedLeft, normalizedRight);
  const rightToLeft = win32.relative(normalizedRight, normalizedLeft);
  const within = value => value === "" || value !== ".." && !value.startsWith(`..${win32.sep}`) && !win32.isAbsolute(value);
  return within(leftToRight) || within(rightToLeft);
}

async function steamcmdExecutableReady(relativeDirectory) {
  try {
    const directory = resolveManagedFilePath(relativeDirectory);
    const executable = resolve(directory, "steamcmd.exe");
    const info = await assertManagedPathIsSafe(executable);
    return Boolean(info?.isFile());
  } catch {
    return false;
  }
}

async function installSteamcmd(task) {
  const settings = validateSteamcmdSettings(task.payload ?? {});
  if (settings.installMode !== "online") throw new Error("当前 SteamCMD 设置为手动指定，不能执行在线安装。");
  const toolDirectory = resolveManagedFilePath(settings.steamcmdDirectory);
  const gameDirectory = resolveSteamcmdGameDirectory(settings.gameDirectory);
  await postSteamcmdProgress(task.id, 12, "正在准备 SteamCMD 和游戏存储目录。");
  await ensureManagedDirectory(toolDirectory);
  await ensureStorageDirectory(gameDirectory);

  const existingExecutable = resolve(toolDirectory, "steamcmd.exe");
  const existingInfo = await assertManagedPathIsSafe(existingExecutable, true);
  if (!existingInfo) {
    await postSteamcmdProgress(task.id, 28, "正在从 Valve 官方 CDN 下载 SteamCMD。");
    const downloadDirectory = resolve(dataDirectory, "cache", "steamcmd-downloads");
    await ensureManagedDirectory(downloadDirectory);
    const archivePath = resolve(downloadDirectory, `${task.id}.zip`);
    const stagingDirectory = resolve(downloadDirectory, `${task.id}.staging`);
    const archive = await fetchRuntimeResource("https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip", {
      redirect: "error",
      signal: AbortSignal.timeout(120_000)
    });
    if (!archive.ok) {await archive.body?.cancel();throw new Error(`SteamCMD 官方下载失败（HTTP ${archive.status}）。`);}
    const contentLength = Number(archive.headers.get("content-length") ?? 0);
    if (contentLength > 64 * 1024 * 1024) {await archive.body?.cancel();throw new Error("SteamCMD 安装包超过安全下载大小限制。");}
    const archiveBytes = new Uint8Array(await archive.arrayBuffer());
    if (archiveBytes.byteLength < 1024 || archiveBytes.byteLength > 64 * 1024 * 1024) throw new Error("SteamCMD 安装包大小无效。");
    if(contentLength>0&&archiveBytes.byteLength!==contentLength)throw new Error("SteamCMD 官方安装包下载不完整。");
    await writeFile(archivePath, archiveBytes, { flag: "wx" });
    try {
      await rm(stagingDirectory, { recursive: true, force: true });
      await ensureManagedDirectory(stagingDirectory);
      await postSteamcmdProgress(task.id, 48, "下载完成，正在安全解压安装包。");
      await execFileAsync("powershell.exe", [
        "-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
        "$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath $env:LFAA_STEAMCMD_ARCHIVE -DestinationPath $env:LFAA_STEAMCMD_DESTINATION -Force"
      ], {
        cwd: repositoryRoot,
        windowsHide: true,
        timeout: 120_000,
        maxBuffer: 256 * 1024,
        env: { ...process.env, LFAA_STEAMCMD_ARCHIVE: archivePath, LFAA_STEAMCMD_DESTINATION: stagingDirectory }
      });
      const stagedExecutable = resolve(stagingDirectory, "steamcmd.exe");
      const stagedInfo = await assertManagedPathIsSafe(stagedExecutable);
      if (!stagedInfo?.isFile()) throw new Error("Valve 安装包中没有找到 steamcmd.exe。");
      await promoteSteamcmdInstallation(stagingDirectory,toolDirectory,assertManagedPathIsSafe);
    } finally {
      await rm(archivePath, { force: true }).catch(() => undefined);
      await rm(stagingDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  } else if (!existingInfo.isFile()) {
    throw new Error("SteamCMD 目标路径不是普通文件。");
  }

  await postSteamcmdProgress(task.id, 76, "正在启动 SteamCMD 并完成首次自更新。");
  const executable = resolve(toolDirectory, "steamcmd.exe");
  const versionLine = await initializeSteamcmd(executable,{cwd:toolDirectory,windowsHide:true,timeout:10*60_000,maxBuffer:2*1024*1024},()=>postSteamcmdProgress(task.id,86,"检测到 SteamCMD 客户端自更新，正在继续核验版本。"));
  await postSteamcmdProgress(task.id, 94, "SteamCMD 已启动，正在确认可执行文件和游戏目录。");
  if (!await steamcmdExecutableReady(settings.steamcmdDirectory)) throw new Error("SteamCMD 首次启动后未能通过文件检查。");
  return {
    steamcmdDirectory: settings.steamcmdDirectory,
    gameDirectory: settings.gameDirectory,
    ...(versionLine ? { version: versionLine.trim().slice(0, 120) } : {}),
    verified: true
  };
}

async function verifySteamcmd(task) {
  const settings = validateSteamcmdSettings(task.payload ?? {});
  const toolDirectory = resolveManagedFilePath(settings.steamcmdDirectory);
  const gameDirectory = resolveSteamcmdGameDirectory(settings.gameDirectory);
  await postSteamcmdProgress(task.id, 35, "正在检查 SteamCMD 文件并准备游戏存储目录。");
  await ensureStorageDirectory(gameDirectory);
  const executable = resolve(toolDirectory, "steamcmd.exe");
  let executableInfo;
  try { executableInfo = await assertManagedPathIsSafe(executable, true); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  if (!executableInfo?.isFile()) throw new Error("所选目录中没有 steamcmd.exe；请确认路径或选择在线安装。");
  const versionLine = await initializeSteamcmd(executable,{cwd:toolDirectory,windowsHide:true,timeout:10*60_000,maxBuffer:2*1024*1024},()=>postSteamcmdProgress(task.id,86,"检测到 SteamCMD 客户端自更新，正在继续核验版本。"));
  if (!await steamcmdExecutableReady(settings.steamcmdDirectory)) throw new Error("SteamCMD 校验后未能通过文件检查。");
  return {
    steamcmdDirectory: settings.steamcmdDirectory,
    gameDirectory: settings.gameDirectory,
    ...(versionLine ? { version: versionLine.trim().slice(0, 120) } : {}),
    verified: true
  };
}

const nodeFileService = createManagedFileService({root: dataDirectory, protectedDirectories: protectedDataDirectories, assertCanMutate: assertNoActiveInstanceAffected});
export async function performNodeFileOperation(operation, payload) { return nodeFileService.operate(operation, payload); }
function resolveManagedFilePath(value, allowRoot = false) { return nodeFileService.resolvePath(value, allowRoot); }
async function ensureManagedDirectory(directory) { return nodeFileService.ensureDirectory(directory); }
async function assertManagedPathIsSafe(path, allowMissing = false) { return nodeFileService.assertPath(path, allowMissing); }

function assertNoActiveInstanceAffected(path) {
  for (const instanceId of activeServers.keys()) {
    const instanceDirectory = getInstanceDirectory(instanceId);
    const targetInsideInstance = relative(instanceDirectory, path);
    const instanceInsideTarget = relative(path, instanceDirectory);
    const targetIsInside = targetInsideInstance === "" || !targetInsideInstance.startsWith(`..${sep}`) && targetInsideInstance !== ".." && !isAbsolute(targetInsideInstance);
    const instanceIsInside = instanceInsideTarget === "" || !instanceInsideTarget.startsWith(`..${sep}`) && instanceInsideTarget !== ".." && !isAbsolute(instanceInsideTarget);
    if (targetIsInside || instanceIsInside) throw new Error("Minecraft 实例正在运行；请先停止实例，再修改、移动或删除相关文件。");
  }
}

async function installMinecraftInstance(task) {
  const instanceId = requireInstanceId(task.instanceId);
  const payload = task.payload ?? {};
  const instanceName = requireMinecraftInstanceName(payload.instanceName ?? instanceId);
  if (payload.eulaAccepted !== true) throw new Error("没有记录 Minecraft EULA 的明确同意状态，已停止安装。");
  const releaseId = requireReleaseId(payload.releaseId);
  const javaMajor = requireMajor(payload.javaMajor);
  const serverUrl = String(payload.serverUrl || "");
  const expectedSha1 = String(payload.serverSha1 || "").toLowerCase();
  const expectedSize = Number(payload.serverSize);
  const memoryMb = requireMemory(payload.memoryMb);
  assertHttpsHost(serverUrl, "piston-data.mojang.com");
  if (!/^[a-f0-9]{40}$/u.test(expectedSha1) || !Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > 512 * 1024 * 1024) {
    throw new Error("Minecraft 官方服务端摘要或文件大小无效。");
  }

  const instanceDirectory = await createSafeInstanceDirectory(instanceId, instanceName, payload.storageDirectory ?? minecraftDirectoryRelative);
  const installMarker = resolve(instanceDirectory, "daemon-installing.json");
  await assertSafeFileTarget(installMarker);
  await writeFile(installMarker, JSON.stringify({ taskId: task.id, instanceId, instanceName, releaseId }), { encoding: "utf8", flag: "w" });
  try {
    const existingMetadata = await readInstanceMetadata(instanceDirectory);
    if (existingMetadata && existingMetadata.releaseId !== releaseId) throw new Error("此实例目录已经安装了另一个 Minecraft 版本，拒绝覆盖。");
    const javaRuntimeId = typeof payload.javaRuntimeId === "string" ? payload.javaRuntimeId : null;
    const java = await resolveMinecraftJavaRuntime(javaMajor, javaRuntimeId, (progress, message) => postTaskProgress(task.id, progress, message), task.payload.downloadTimeoutSeconds);
    await prepareMinecraftSandbox(instanceId, instanceName, java, memoryMb, task.id, instanceDirectory);

    await postTaskProgress(task.id, 50, `正在下载官方 Minecraft ${releaseId} Vanilla 服务端。`);
    const jarPath = resolve(instanceDirectory, "server.jar");
    if (await safeFileExists(jarPath)) {
      const actual = await hashFile(jarPath, "sha1");
      if (actual !== expectedSha1) throw new Error("实例目录已有不同内容的 server.jar，拒绝覆盖。");
    } else {
      const temporaryJar = resolve(instanceDirectory, `.server-${task.id}.download`);
      await downloadAndVerify(serverUrl, temporaryJar, { algorithm: "sha1", digest: expectedSha1, size: expectedSize, maxBytes: 512 * 1024 * 1024 });
      await rename(temporaryJar, jarPath);
    }

    const eulaPath = resolve(instanceDirectory, "eula.txt");
    const metadataPath = resolve(instanceDirectory, "lfaa-instance.json");
    await assertSafeFileTarget(eulaPath);
    await assertSafeFileTarget(metadataPath);
    await writeFile(eulaPath, "# 由用户在 LFAA 创建流程中明确同意 Minecraft EULA 后写入。\neula=true\n", "utf8");
    await writeFile(metadataPath, JSON.stringify({ instanceId, instanceName, releaseId, javaMajor, javaRuntimeId, memoryMb }, null, 2), "utf8");
    await appendInstanceLog(instanceId, task.id, "system", `已校验并安装 Minecraft ${releaseId} 官方 Vanilla 服务端。`);
    return { artifactName: "server.jar", javaMajor };
  } finally {
    await rm(installMarker, { force: true });
  }
}

async function installMinecraftDeployment(task) {
  const deploymentId = requireMinecraftDeploymentId(task.deploymentId ?? task.payload?.deploymentId);
  const payload = task.payload ?? {};
  const name = requireMinecraftInstanceName(payload.deploymentName);
  if (payload.serverType !== "vanilla") throw new Error("当前只支持部署官方 Vanilla 服务端。");
  const releaseId = requireReleaseId(payload.releaseId);
  const serverUrl = String(payload.serverUrl || "");
  const expectedSha1 = String(payload.serverSha1 || "").toLowerCase();
  const expectedSize = Number(payload.serverSize);
  assertHttpsHost(serverUrl, "piston-data.mojang.com");
  if (!/^[a-f0-9]{40}$/u.test(expectedSha1) || !Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > 512 * 1024 * 1024) {
    throw new Error("Minecraft 官方服务端摘要或文件大小无效。");
  }

  const storageDirectory = validateMinecraftStorageDirectory(payload.storageDirectory ?? minecraftDirectoryRelative);
  await ensureStorageDirectory(getMinecraftStorageRoot(storageDirectory));
  const directory = getNamedInstanceDirectory(name, storageDirectory);
  await mkdir(directory, { recursive: true });
  const directoryInfo = await lstat(directory);
  if (directoryInfo.isSymbolicLink() || !directoryInfo.isDirectory()) throw new Error("Minecraft 部署目录不能是符号链接或非目录路径。");
  const deploymentMetadataPath = resolve(directory, "lfaa-deployment.json");
  const deployMarkerPath = resolve(directory, "daemon-deploying.json");
  const existingMetadata = await readDeploymentMetadata(directory);
  if (existingMetadata && existingMetadata.deploymentId !== deploymentId) throw new Error("部署目录已经属于其他下载记录，拒绝覆盖。");
  if (!existingMetadata) {
    const entries = await readdir(directory);
    const markerExists = await safeFileExists(deployMarkerPath);
    if (entries.length && !markerExists) throw new Error("部署目录已有其他内容，拒绝覆盖。");
    if (markerExists) {
      const marker = JSON.parse(await readSafeFile(deployMarkerPath, "utf8"));
      if (marker.deploymentId !== deploymentId) throw new Error("部署目录正在由其他下载任务使用。");
    }
  }
  await assertSafeFileTarget(deployMarkerPath);
  await writeFile(deployMarkerPath, JSON.stringify({ taskId: task.id, deploymentId, deploymentName: name }), "utf8");
  const jarPath = resolve(directory, "server.jar");
  const temporaryJar = resolve(directory, `.server-${task.id}.download`);
  try {
    if (await safeFileExists(jarPath)) {
      const actual = await hashFile(jarPath, "sha1");
      if (actual !== expectedSha1) throw new Error("部署目录已有不同内容的 server.jar，拒绝覆盖。");
    } else {
      await postTaskProgress(task.id, 10, `正在从 Mojang 官方源下载 Minecraft ${releaseId} Vanilla 服务端。`);
      await assertSafeFileTarget(temporaryJar);
      await downloadAndVerify(serverUrl, temporaryJar, { algorithm: "sha1", digest: expectedSha1, size: expectedSize, maxBytes: 512 * 1024 * 1024 });
      await rename(temporaryJar, jarPath);
    }
    await assertSafeFileTarget(deploymentMetadataPath);
    await writeFile(deploymentMetadataPath, JSON.stringify({
      deploymentId,
      name,
      serverType: "vanilla",
      releaseId,
      javaMajor: requireMajor(payload.javaMajor),
      artifactName: "server.jar",
      downloadedAt: new Date().toISOString()
    }, null, 2), "utf8");
    return { artifactName: "server.jar", serverType: "vanilla", releaseId };
  } finally {
    await rm(temporaryJar, { force: true });
    await rm(deployMarkerPath, { force: true });
  }
}

async function registerMinecraftInstance(task) {
  const instanceId = requireInstanceId(task.instanceId);
  const deploymentId = requireMinecraftDeploymentId(task.deploymentId ?? task.payload?.deploymentId);
  const payload = task.payload ?? {};
  const name = requireMinecraftInstanceName(payload.instanceName);
  const releaseId = requireReleaseId(payload.releaseId);
  const javaMajor = requireMajor(payload.javaMajor);
  const memoryMb = requireMemory(payload.memoryMb);
  if (payload.eulaAccepted !== true) throw new Error("没有记录 Minecraft EULA 的明确同意状态，已停止创建实例。");
  const storageDirectory = validateMinecraftStorageDirectory(payload.storageDirectory ?? minecraftDirectoryRelative);
  const safeStorageRoot = await getExistingMinecraftStorageRoot(storageDirectory);
  if (!safeStorageRoot) throw new Error("Minecraft 已部署文件根目录不存在，请先重新下载官方服务端。");
  const directory = getNamedInstanceDirectory(name, storageDirectory);
  const directoryInfo = await lstat(directory);
  if (directoryInfo.isSymbolicLink() || !directoryInfo.isDirectory()) throw new Error("Minecraft 部署目录不能是符号链接或非目录路径。");
  const deployment = await readDeploymentMetadata(directory);
  const currentMetadata = await readInstanceMetadata(directory);
  if (currentMetadata && currentMetadata.instanceId !== instanceId) throw new Error("已部署目录已经关联到其他 Minecraft 实例。");
  if (!currentMetadata && (deployment?.deploymentId !== deploymentId || deployment.releaseId !== releaseId)) {
    throw new Error("找不到与此实例相符的已完成服务端部署。");
  }
  const jarPath = resolve(directory, "server.jar");
  if (!(await safeFileExists(jarPath))) throw new Error("已部署目录缺少 server.jar，请重新部署官方文件。");

  const installMarker = resolve(directory, "daemon-installing.json");
  await assertSafeFileTarget(installMarker);
  await writeFile(installMarker, JSON.stringify({ taskId: task.id, instanceId, instanceName: name }), "utf8");
  minecraftInstanceDirectories.set(instanceId, directory);
  try {
    const javaRuntimeId = typeof payload.javaRuntimeId === "string" ? payload.javaRuntimeId : null;
    const java = await resolveMinecraftJavaRuntime(javaMajor, javaRuntimeId, (progress, message) => postTaskProgress(task.id, progress, message), task.payload.downloadTimeoutSeconds);
    if (payload.executionMode !== "native") await prepareMinecraftSandbox(instanceId, name, java, memoryMb, task.id, directory);
    await assertSafeFileTarget(resolve(directory, "eula.txt"));
    await assertSafeFileTarget(resolve(directory, "lfaa-instance.json"));
    await writeFile(resolve(directory, "eula.txt"), "# 由用户在创建 Minecraft 实例时明确同意 EULA 后写入。\neula=true\n", "utf8");
    await writeFile(resolve(directory, "lfaa-instance.json"), JSON.stringify({
      instanceId,
      instanceName: name,
      releaseId,
      javaMajor,
      javaRuntimeId,
      memoryMb,
      deploymentId,
      executionMode: payload.executionMode ?? "appcontainer",
      coreType: "Vanilla",
      launch: { kind: "jar", path: "server.jar" }
    }, null, 2), "utf8");
    await appendInstanceLog(instanceId, task.id, "system", `已将 Minecraft ${releaseId} 官方 Vanilla 部署注册为实例。`);
    return { deploymentId, releaseId, javaMajor };
  } finally {
    await rm(installMarker, { force: true });
  }
}

async function startMinecraftInstance(task) {
  if (shuttingDown) throw new Error("节点正在关闭，不再启动实例。");
  const readyTimeout = Number(task.payload?.readyTimeoutSeconds);
  const stopTimeoutSeconds = Number(task.payload?.stopTimeoutSeconds);
  if (!Number.isInteger(readyTimeout) || readyTimeout < 10 || readyTimeout > 900 || !Number.isInteger(stopTimeoutSeconds) || stopTimeoutSeconds < 5 || stopTimeoutSeconds > 300) throw new Error("任务缺少有效的就绪/安全停服等待配置，请重新提交启动任务。");
  const instanceId = requireInstanceId(task.instanceId);
  const instanceDirectory = await requireSafeInstanceDirectory(instanceId);
  const metadata = await readInstanceMetadata(instanceDirectory);
  if (!metadata) throw new Error("找不到已安装的 Minecraft 实例元数据。");
  if ((task.payload?.executionMode ?? metadata.executionMode) === "native") return await startNativeMinecraftServer(task, metadata, instanceDirectory, {
    signal:minecraftTaskControllers.get(task.id)?.signal,
    activeServers, safeFileExists, readSafeFile, isProcessRunning, assertSafeFileTarget, java: (major, runtimeId, progress) => resolveMinecraftJavaRuntime(major, runtimeId, progress, task.payload.downloadTimeoutSeconds),
    phpDirectory: resolve(dataDirectory, "environments", "php", "pocketmine"), progress: postTaskProgress,
    attachOutput: attachServerOutput, waitForExit: waitForChildExit
  });
  const instanceName = requireMinecraftInstanceName(task.payload?.instanceName ?? metadata.instanceName ?? basename(instanceDirectory));
  const javaMajor = requireMajor(task.payload?.javaMajor ?? metadata.javaMajor);
  const javaRuntimeId = Object.hasOwn(task.payload ?? {}, "javaRuntimeId")
    ? (typeof task.payload.javaRuntimeId === "string" ? task.payload.javaRuntimeId : null)
    : (typeof metadata.javaRuntimeId === "string" ? metadata.javaRuntimeId : null);
  const java = await resolveMinecraftJavaRuntime(javaMajor, javaRuntimeId, (progress, message) => postTaskProgress(task.id, progress, message), task.payload.downloadTimeoutSeconds);
  if (!(await safeFileExists(resolve(instanceDirectory, "server.jar")))) throw new Error("实例目录缺少 server.jar，请重新安装或恢复官方文件。");
  if (!(await safeFileExists(resolve(instanceDirectory, "eula.txt")))) throw new Error("实例缺少 EULA 同意记录。");
  if (activeServers.has(instanceId)) throw new Error("Minecraft 实例已由本机 Daemon 管理为运行状态。");
  if (!sandboxBackendAvailable) throw new Error("Windows AppContainer Sandbox Host 不可用，已拒绝启动 Minecraft Java。");
  await prepareMinecraftSandbox(instanceId, instanceName, java, metadata.memoryMb, task.id, instanceDirectory);
  if (metadata.javaRuntimeId !== javaRuntimeId) {
    await assertSafeFileTarget(resolve(instanceDirectory, "lfaa-instance.json"));
    await writeFile(resolve(instanceDirectory, "lfaa-instance.json"), JSON.stringify({ ...metadata, javaRuntimeId }, null, 2), "utf8");
  }

  const readinessToken = randomUUID();
  const child = spawn(sandboxHostPath, [
    "--launch", "--data-root", dataDirectory, "--instance-storage", minecraftStorageDirectoryForInstance(instanceDirectory), "--instance-id", instanceId, "--instance-name", instanceName,
    "--java", java.executable, "--java-root", java.root,
    "--memory-mb", String(metadata.memoryMb), "--readiness-token", readinessToken
  ], {
    cwd: repositoryRoot,
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const record = { child, javaMajor, javaRuntimeId, stopTimeoutSeconds, startedAt: Date.now(), taskId: task.id, sandboxReady: false, serverReady: false, sandboxBackend: sandboxBackendId };
  child.stdin.on("error", () => { void appendInstanceLog(instanceId, task.id, "system", "Minecraft 控制台输入通道发生错误；发送任务以实际回报为准。"); });
  activeServers.set(instanceId, record);
  attachServerOutput(instanceId, child, task.id, {
    readinessToken,
    onSandboxReady: () => { record.sandboxReady = true; record.onReady?.(); },
    onServerReady: () => { record.serverReady = true; record.onReady?.(); }
  });

  try { await waitForMinecraftReady(child, record, readyTimeout); }
  catch (error) { child.kill(); await waitForChildExit(child, 10_000); throw error; }
  const processMarker = resolve(instanceDirectory, "daemon-process.json");
  await assertSafeFileTarget(processMarker);
  await writeFile(processMarker, JSON.stringify({ pid: child.pid, javaMajor, startedAt: new Date().toISOString(), appId: "minecraft", sandboxBackend: sandboxBackendId }), "utf8");
  await appendInstanceLog(instanceId, task.id, "system", `Minecraft ${metadata.releaseId} 已启动，使用 Java ${javaMajor}。`);
  return { javaMajor, processStarted: true, serverReady: true, externallyReachable: null, evidence: "Vanilla 服务就绪日志与 AppContainer 启动握手" };
}

async function stopMinecraftInstance(task) {
  const instanceId = requireInstanceId(task.instanceId);
  const running = activeServers.get(instanceId);
  const instanceDirectory = await requireSafeInstanceDirectory(instanceId);
  if (!running) {
    if (await safeFileExists(resolve(instanceDirectory, "daemon-process.json"))) {
      throw new Error("Daemon 重启后无法恢复此进程的控制台通道；当前状态不确定，为保护世界存档未强制结束进程。");
    }
    throw new Error("本机 Daemon 未管理此 Minecraft 进程，未执行停止操作。");
  }
  const child = running.child;
  if (child.exitCode !== null || child.killed) throw new Error("Minecraft 进程已经退出。");
  const stopTimeout = Number(task.payload?.stopTimeoutSeconds);
  if (!Number.isInteger(stopTimeout) || stopTimeout < 5 || stopTimeout > 300) throw new Error("任务缺少有效的安全停服等待配置。");
  await new Promise((resolveWrite, rejectWrite) => child.stdin.write(running.coreType === "BungeeCord" ? "end\n" : "stop\n", error => error ? rejectWrite(error) : resolveWrite()));
  await postTaskProgress(task.id, 35, "已发送 Minecraft 安全停止命令，等待世界保存和进程退出。");
  const stopped = await waitForChildExit(child, stopTimeout * 1000);
  if (!stopped) {
    await terminateProcessTree(child);
    if (!(await waitForChildExit(child, 10_000))) throw new Error("Minecraft 进程未能在安全停止或终止请求后退出。");
    await sendSystemLog(instanceId, task.id, `Minecraft 未在 ${stopTimeout} 秒内响应安全停止，Daemon 已结束本实例进程；存档完整性未确认。`);
  }
  await rm(resolve(instanceDirectory, "daemon-process.json"), { force: true });
  await appendInstanceLog(instanceId, task.id, "system", "Minecraft 实例已停止。");
  return { stopped: true, forced: !stopped, exitCode: child.exitCode, worldSaveConfirmed: null };
}

async function applyMinecraftProperties(task) {
  const instanceId = requireInstanceId(task.instanceId);
  const instanceDirectory = await requireSafeInstanceDirectory(instanceId);
  if (activeServers.has(instanceId)) throw new Error("只能在 Minecraft 实例停止时修改 server.properties。");
  const properties = validateProperties(task.payload?.properties);
  const propertyPath = resolve(instanceDirectory, "server.properties");
  const current = await safeFileExists(propertyPath) ? parseProperties(await readSafeFile(propertyPath, "utf8")) : new Map();
  const entries = mapPropertyValues(properties);
  for (const [key, value] of Object.entries(entries)) current.set(key, String(value));
  const content = [...current.entries()].map(([key, value]) => `${key}=${value}`).join("\n") + "\n";
  const temporaryPath = resolve(instanceDirectory, `.server-properties-${task.id}.tmp`);
  await assertSafeFileTarget(propertyPath);
  await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
  await rename(temporaryPath, propertyPath);
  await appendInstanceLog(instanceId, task.id, "system", "已写入通过白名单校验的 server.properties 字段。");
  return {};
}

async function backupMinecraftWorld(task) {
  const instanceId = requireInstanceId(task.instanceId);
  const instanceDirectory = await requireSafeInstanceDirectory(instanceId);
  if (activeServers.has(instanceId)) throw new Error("世界备份只允许在实例停止时执行。");
  const propertiesPath = resolve(instanceDirectory, "server.properties");
  const properties = await safeFileExists(propertiesPath) ? parseProperties(await readSafeFile(propertiesPath, "utf8")) : new Map();
  const levelName = String(properties.get("level-name") || "world");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(levelName) || levelName.includes("..")) throw new Error("世界目录名称无法通过安全校验。");
  const metadata = await readInstanceMetadata(instanceDirectory);
  const worlds = ["Nukkit", "PocketMine"].includes(metadata?.coreType) ? ["worlds"] : [levelName, `${levelName}_nether`, `${levelName}_the_end`];
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const backupName = `${timestamp}-${randomUUID()}`;
  const instanceBackupRoot = resolve(backupDirectory, instanceId);
  const backupRoot = resolve(backupDirectory, instanceId, backupName);
  await mkdir(instanceBackupRoot, { recursive: true });
  const instanceBackupInfo = await lstat(instanceBackupRoot);
  if (instanceBackupInfo.isSymbolicLink() || !instanceBackupInfo.isDirectory()) throw new Error("Minecraft 备份路径不能是符号链接或非目录路径。");
  await mkdir(backupRoot);
  const backupInfo = await lstat(backupRoot);
  if (backupInfo.isSymbolicLink() || !backupInfo.isDirectory()) throw new Error("Minecraft 备份目标不能是符号链接或非目录路径。");
  let copied = 0;
  try {
    for (const world of worlds) {
      const source = resolve(instanceDirectory, world);
      if (await fileExists(source)) copied += await copySafeTree(source, resolve(backupRoot, world));
    }
    if (copied === 0) throw new Error("实例中没有找到可备份的世界目录。");
  } catch (error) {
    await rm(backupRoot, { recursive: true, force: true });
    throw error;
  }
  await appendInstanceLog(instanceId, task.id, "system", `世界备份已创建：${backupName}（${copied} 个文件）。`);
  return { backupName };
}

let runtimeStorage={runtimeDirectory:resolve(dataDirectory,"environments"),downloadCacheDirectory:resolve(dataDirectory,"cache"),temporaryDirectory:resolve(dataDirectory,"tmp")};
let javaManager=createRuntimeExecutor({dataDirectory,repositoryRoot,storage:runtimeStorage,activeServers,postTaskProgress}).manager;
const installTemurinRuntime=(...args)=>javaManager.installTemurinRuntime(...args);
const executeJavaEnvironmentTask=(...args)=>javaManager.executeJavaEnvironmentTask(...args);
const discoverJavaRuntimes=(...args)=>javaManager.discoverJavaRuntimes(...args);
const resolveMinecraftJavaRuntime=(...args)=>javaManager.resolveMinecraftJavaRuntime(...args);
const readJavaVersion=(...args)=>javaManager.readJavaVersion(...args);
let cachedJavaRuntimes=[],javaDiscoveryPending=null,javaDiscoveryRefreshAt=0;

async function executeRuntimeTask(task) {
  const controller=new AbortController();
  const shutdown=()=>controller.abort(new DOMException("节点正在卸载。","AbortError"));
  pollingController.signal.addEventListener("abort",shutdown,{once:true});
  let renewing=false;
  const renew=setInterval(async()=>{if(renewing)return;renewing=true;try{const state=await apiRequest(`/daemon/runtime/tasks/${task.id}/renew`,{method:"POST",body:JSON.stringify({nodeId})});if(state.cancelRequested)controller.abort(new DOMException("用户取消环境任务。","AbortError"));}catch(error){controller.abort(error);}finally{renewing=false;}},3000);
  try {
    const executor=createRuntimeExecutor({dataDirectory,repositoryRoot,storage:task.payload.storage,signal:controller.signal,activeServers});
    const result=await executor.execute(task.operation,task.payload,(progress,message)=>apiRequest(`/daemon/runtime/tasks/${task.id}/progress`,{method:"POST",body:JSON.stringify({nodeId,progress,message})}));
    controller.signal.throwIfAborted();
    await apiRequest(`/daemon/runtime/tasks/${task.id}/complete`,{method:"POST",body:JSON.stringify({nodeId,status:"succeeded",message:"节点环境操作已完成并取得实际结果。",result})});javaDiscoveryRefreshAt=0;
  }catch(error){await apiRequest(`/daemon/runtime/tasks/${task.id}/complete`,{method:"POST",body:JSON.stringify({nodeId,status:controller.signal.aborted?"cancelled":"failed",message:safeMessage(error).slice(0,1000),result:{}})});}
  finally{clearInterval(renew);pollingController.signal.removeEventListener("abort",shutdown);}
}

async function expandZip(archivePath, destinationPath) {
  // 解压前逐个核对归一化路径，拒绝 ZIP 路径逃逸和符号链接；只操作节点受管理目标。
  await ensureManagedDirectory(destinationPath);
  const script = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; $root=[IO.Path]::GetFullPath($env:LFAA_DESTINATION_PATH).TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar; $zip=[IO.Compression.ZipFile]::OpenRead($env:LFAA_ARCHIVE_PATH); try { foreach($entry in $zip.Entries) { $path=[IO.Path]::GetFullPath([IO.Path]::Combine($root,$entry.FullName)); if(-not $path.StartsWith($root,[StringComparison]::OrdinalIgnoreCase) -or (($entry.ExternalAttributes -shr 16) -band 61440) -eq 40960) { throw 'ZIP entry rejected' } } } finally { $zip.Dispose() }; Expand-Archive -LiteralPath $env:LFAA_ARCHIVE_PATH -DestinationPath $env:LFAA_DESTINATION_PATH -Force";
  await captureProcess("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], 180_000, {
    ...process.env,
    LFAA_ARCHIVE_PATH: archivePath,
    LFAA_DESTINATION_PATH: destinationPath
  });
}

async function downloadAndVerify(url, destinationPath, { algorithm, digest, size, maxBytes }, operationSignal) {
  const allowedHost = algorithm === "sha1" ? "piston-data.mojang.com" : "github.com";
  assertHttpsHost(url, allowedHost);
  const signal = operationSignal ? AbortSignal.any([operationSignal, AbortSignal.timeout(30 * 60 * 1000)]) : AbortSignal.timeout(30 * 60 * 1000);
  const response = await fetchRuntimeResource(url, {
    signal,
    redirect: algorithm === "sha1" ? "error" : "follow"
  });
  if (!response.ok || !response.body) throw new Error(`官方文件下载失败（${response.status}）。`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxBytes) throw new Error("下载文件超过允许大小。");
  const hash = createHash(algorithm);
  let received = 0;
  const verifier = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > maxBytes) return callback(new Error("下载文件超过允许大小。"));
      hash.update(chunk);
      callback(null, chunk);
    }
  });
  await mkdir(dirname(destinationPath), { recursive: true });
  try {
    await pipeline(response.body, verifier, createWriteStream(destinationPath, { flags: "wx" }), { signal });
    if (Number.isSafeInteger(size) && received !== size) throw new Error("下载文件大小与官方元数据不一致。");
    if (hash.digest("hex") !== digest) throw new Error("下载文件摘要与官方校验值不一致，文件已拒绝使用。");
  } catch (error) {
    await rm(destinationPath, { force: true });
    throw error;
  }
}

async function hashFile(path, algorithm) {
  await assertSafeFileTarget(path, false);
  const hash = createHash(algorithm);
  await new Promise((resolveHash, rejectHash) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", rejectHash);
    stream.once("end", resolveHash);
  });
  return hash.digest("hex");
}

async function readInstanceMetadata(instanceDirectory) {
  try { return JSON.parse(await readSafeFile(resolve(instanceDirectory, "lfaa-instance.json"), "utf8")); }
  catch (error) {
    if (error?.code === "ENOENT") return null;
    if (error instanceof SyntaxError) throw new Error("实例元数据 lfaa-instance.json 不是有效 JSON；文件存在但内容损坏。请核对内容与实例登记参数后修复，不要重复下载或创建其他实例。", { cause: error });
    throw error;
  }
}

async function readDeploymentMetadata(deploymentDirectory) {
  try { return JSON.parse(await readSafeFile(resolve(deploymentDirectory, "lfaa-deployment.json"), "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

async function createSafeInstanceDirectory(instanceId, instanceName, storageDirectory = minecraftDirectoryRelative) {
  const id = requireInstanceId(instanceId);
  await ensureStorageDirectory(getMinecraftStorageRoot(storageDirectory));
  const directory = getNamedInstanceDirectory(instanceName, storageDirectory);
  try {
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Minecraft 实例目录不能是符号链接或非目录路径。");
    const existingId = await readMinecraftInstanceId(directory, instanceName);
    if (existingId && existingId !== id) throw new Error("同名 Minecraft 实例目录已属于其他实例，拒绝覆盖。");
    if (!existingId && (await readdir(directory)).length > 0) throw new Error("同名目录已有内容且不属于当前 Minecraft 实例，拒绝覆盖。");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await mkdir(directory);
  }
  minecraftInstanceDirectories.set(id, directory);
  return await requireSafeInstanceDirectory(instanceId);
}

async function archiveMinecraftInstance(task) {
  const id=requireInstanceId(task.instanceId);
  if(activeServers.has(id))throw new Error("实例仍有受管进程，请先安全停止。");
  await getExistingMinecraftStorageRoot(task.payload?.storageDirectory);
  const directory=minecraftInstanceDirectories.get(id)??getNamedInstanceDirectory(task.payload?.instanceName,task.payload?.storageDirectory);
  const info=await lstat(directory).catch(error=>{if(error.code==="ENOENT")return null;throw error;});
  if(!info)return {archived:true,note:"节点已核实登记目录不存在，仅移除失效登记；没有删除磁盘文件。"};
  if(!info.isDirectory()||info.isSymbolicLink())throw new Error("实例目标不是安全的普通目录。");
  await ensureManagedDirectory(directory);
  const metadataPath=resolve(directory,"lfaa-instance.json");
  if(await safeFileExists(metadataPath)){
    const raw=await readSafeFile(metadataPath,"utf8");
    let metadata;try{metadata=JSON.parse(raw);}catch{/* 损坏的元数据随整个已登记目录归档，不能据此启动或执行。 */}
    if(metadata?.instanceId&&metadata.instanceId!==id)throw new Error("实例目录身份不匹配，拒绝归档。");
  }
  const markerPath=resolve(directory,"daemon-process.json");
  if(await safeFileExists(markerPath)) {
    const marker=JSON.parse(await readSafeFile(markerPath,"utf8"));
    if(!Number.isInteger(marker.pid)||isProcessRunning(marker.pid))throw new Error("实例进程尚未确认退出，拒绝归档。");
  }
  if(await safeFileExists(resolve(directory,"daemon-installing.json")))throw new Error("实例仍有安装标记，请先核对任务。");
  const archiveRoot=resolve(backupDirectory,"deleted-instances");
  await ensureStorageDirectory(archiveRoot);
  const backupName=`${id}-${task.id}`;
  const destination=resolve(archiveRoot,backupName);
  if(await lstat(destination).catch(error=>{if(error.code==="ENOENT")return null;throw error;}))throw new Error("归档目录已存在，未覆盖。");
  await postTaskProgress(task.id,60,"正在把完整实例目录安全移入备份归档。");
  await rename(directory,destination);
  minecraftInstanceDirectories.delete(id);
  await rm(resolve(sandboxMetadataDirectory,`${id}.json`),{force:true});
  return {archived:true,backupName};
}

async function requireSafeInstanceDirectory(instanceId) {
  const directory = getInstanceDirectory(instanceId);
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Minecraft 实例目录不能是符号链接或非目录路径。");
  return directory;
}

async function assertSafeFileTarget(path, allowMissing = true) {
  let info;
  try { info = await lstat(path); }
  catch (error) {
    if (allowMissing && error?.code === "ENOENT") return false;
    throw error;
  }
  if (info.isSymbolicLink() || !info.isFile() || info.nlink > 1) throw new Error("Minecraft 实例文件不能是符号链接、硬链接或特殊文件。");
  return true;
}

async function safeFileExists(path) {
  return await assertSafeFileTarget(path, true);
}

async function readSafeFile(path, encoding) {
  await assertSafeFileTarget(path, false);
  return await readFile(path, encoding);
}

async function findExecutable(root, fileName) {
  const rootInfo = await lstat(root).catch(() => null);
  if (!rootInfo?.isDirectory() || rootInfo.isSymbolicLink()) return null;
  const pending = [{ directory: root, depth: 0 }];
  while (pending.length) {
    const current = pending.pop();
    if (!current || current.depth > 8) continue;
    const entries = await readdir(current.directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const path = resolve(current.directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isFile() && entry.name.toLocaleLowerCase() === fileName.toLocaleLowerCase()) return path;
      if (entry.isDirectory()) pending.push({ directory: path, depth: current.depth + 1 });
    }
  }
  return null;
}

function parseProperties(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) continue;
    const delimiter = trimmed.indexOf("=");
    if (delimiter < 1) continue;
    map.set(trimmed.slice(0, delimiter), trimmed.slice(delimiter + 1));
  }
  return map;
}

function validateProperties(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("服务器配置输入格式无效。");
  const allowed = new Set(["motd", "difficulty", "gamemode", "maxPlayers", "serverPort", "onlineMode", "pvp", "whiteList", "viewDistance", "simulationDistance", "levelName", "levelSeed"]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error("Daemon 拒绝写入未登记的服务器配置字段。");
  if (value.motd !== undefined && (typeof value.motd !== "string" || value.motd.length > 120 || /[\r\n\u0000]/u.test(value.motd))) throw new Error("MOTD 格式无效。");
  if (value.levelName !== undefined && (typeof value.levelName !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(value.levelName) || value.levelName.includes(".."))) throw new Error("世界目录名无效。");
  if (value.levelSeed !== undefined && (typeof value.levelSeed !== "string" || value.levelSeed.length > 80 || /[\r\n\u0000]/u.test(value.levelSeed))) throw new Error("世界种子格式无效。");
  if (value.difficulty !== undefined && !["peaceful", "easy", "normal", "hard"].includes(value.difficulty)) throw new Error("游戏难度不受支持。");
  if (value.gamemode !== undefined && !["survival", "creative", "adventure", "spectator"].includes(value.gamemode)) throw new Error("游戏模式不受支持。");
  for (const [key, minimum, maximum] of [["maxPlayers", 1, 200], ["serverPort", 1024, 65535], ["viewDistance", 2, 32], ["simulationDistance", 2, 32]]) {
    if (value[key] !== undefined && (!Number.isInteger(value[key]) || value[key] < minimum || value[key] > maximum)) throw new Error(`配置字段 ${key} 超出允许范围。`);
  }
  for (const key of ["onlineMode", "pvp", "whiteList"]) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") throw new Error(`配置字段 ${key} 必须为布尔值。`);
  }
  return value;
}

function mapPropertyValues(properties) {
  const names = {
    motd: "motd", difficulty: "difficulty", gamemode: "gamemode", maxPlayers: "max-players", serverPort: "server-port",
    onlineMode: "online-mode", pvp: "pvp", whiteList: "white-list", viewDistance: "view-distance",
    simulationDistance: "simulation-distance", levelName: "level-name", levelSeed: "level-seed"
  };
  return Object.fromEntries(Object.entries(properties).map(([key, value]) => [names[key], typeof value === "boolean" ? String(value) : String(value)]));
}

async function copySafeTree(source, destination) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error("世界目录中存在符号链接，已停止备份以避免复制数据根目录之外的文件。");
  if (!info.isDirectory()) throw new Error("世界存档目录无效。");
  await mkdir(destination, { recursive: true });
  let count = 0;
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourcePath = resolve(source, entry.name);
    const destinationPath = resolve(destination, entry.name);
    const childInfo = await lstat(sourcePath);
    if (childInfo.isSymbolicLink()) throw new Error("世界目录中存在符号链接，已停止备份以避免复制数据根目录之外的文件。");
    if (entry.isDirectory()) count += await copySafeTree(sourcePath, destinationPath);
    else if (entry.isFile() && childInfo.nlink <= 1) { await copyFile(sourcePath, destinationPath, constants.COPYFILE_EXCL); count += 1; }
    else if (entry.isFile()) throw new Error("世界目录包含指向目录之外的硬链接文件。");
    else throw new Error("世界目录包含不支持的文件类型。");
    if (count > 2_000_000) throw new Error("世界备份文件数量超过允许上限。");
  }
  return count;
}

function attachServerOutput(instanceId, child, taskId, options = {}) {
  for (const [streamName, stream] of [["stdout", child.stdout], ["stderr", child.stderr]]) {
    let rest = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      rest += chunk;
      const lines = rest.split(/\r?\n/u);
      rest = lines.pop() || "";
      const logLines = lines.filter((line) => {
        options.onFailureLine?.(redactLogLine(line));
        if (options.coreType ? isMinecraftCoreReadyLine(options.coreType, line) : isVanillaReadyLine(line)) options.onServerReady?.();
        if (options.readinessToken && line === `${sandboxReadyPrefix}${options.readinessToken}\u001e`) {
          options.onSandboxReady?.();
          return false;
        }
        return true;
      });
      if (logLines.length) bufferLogs(instanceId, taskId, streamName, logLines);
      while (rest.length > 4096) {
        bufferLogs(instanceId, taskId, streamName, [rest.slice(0, 4096)]);
        rest = rest.slice(4096);
      }
    });
    stream.on("end", () => {
      if (!rest) return;
      if (options.readinessToken && rest === `${sandboxReadyPrefix}${options.readinessToken}\u001e`) options.onSandboxReady?.();
      else bufferLogs(instanceId, taskId, streamName, [rest]);
    });
  }
  child.once("error", () => {
    void appendInstanceLog(instanceId, taskId, "system", "Minecraft 进程发生启动或运行错误。").catch(() => {});
  });
  child.once("exit", (code) => {
    activeServers.delete(instanceId);
    void rm(resolve(getInstanceDirectory(instanceId), "daemon-process.json"), { force: true }).catch(() => {
      void appendInstanceLog(instanceId, taskId, "system", "进程已退出，但运行标记清理失败；下次启动将重新核实标记中的进程。").catch(() => {});
    });
    void appendInstanceLog(instanceId, taskId, "system", `Minecraft 进程已退出（退出码 ${code ?? "未知"}）。`).catch(() => {});
  });
}

function bufferLogs(instanceId, taskId, stream, lines) {
  const key = `${instanceId}:${taskId}:${stream}`;
  const buffer = logBuffers.get(key) || { instanceId, taskId, stream, lines: [], timer: null, flushing: false };
  for (const line of lines) {
    const trimmed = redactLogLine(line);
    if (trimmed) buffer.lines.push(trimmed.slice(0, 4096));
  }
  if (buffer.lines.length > 200) buffer.lines.splice(0, buffer.lines.length - 200);
  if (!buffer.timer) {
    buffer.timer = setTimeout(() => { void flushLogs(key); }, 750);
  }
  logBuffers.set(key, buffer);
}

async function flushLogs(key) {
  const buffer = logBuffers.get(key);
  if (!buffer || buffer.lines.length === 0) { logBuffers.delete(key); return; }
  if (buffer.flushing) return buffer.pending?.catch(() => {});
  const instanceId = buffer.instanceId;
  buffer.flushing = true;
  const lines = buffer.lines.splice(0, 200);
  clearTimeout(buffer.timer);
  buffer.timer = null;
  try {
    buffer.pending = apiRequest(`/daemon/tasks/${buffer.taskId}/logs`, {
      method: "POST",
      body: JSON.stringify({ nodeId, instanceId, taskId: buffer.taskId, stream: buffer.stream, lines })
    });
    await buffer.pending;
  } catch {
    buffer.flushing = false;
    buffer.lines.unshift(...lines);
    if (buffer.lines.length > 200) buffer.lines.splice(0, buffer.lines.length - 200);
    buffer.timer = setTimeout(() => { void flushLogs(key); }, 3000);
    return;
  }
  buffer.flushing = false;
  if (buffer.lines.length) {
    buffer.timer = setTimeout(() => { void flushLogs(key); }, 250);
  } else logBuffers.delete(key);
}

/** 先交付末尾错误输出再完成任务，避免页面拿到失败状态时诊断日志仍留在计时缓冲。 */
async function flushMinecraftTaskLogs(taskId) {
  for (const [key, buffer] of logBuffers) {
    if (buffer.taskId !== taskId) continue;
    await buffer.pending?.catch(() => {});
    await flushLogs(key);
  }
}

function redactLogLine(line) {
  const dataPrefix = dataDirectory.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return String(line)
    .replace(new RegExp(dataPrefix, "giu"), "[LFAA 数据目录]")
    .replace(/(?:Bearer\s+)[A-Za-z0-9._~-]{24,}/giu, "Bearer [已隐藏]")
    .replace(/(token|password|secret)\s*[=:]\s*[^\s,;]+/giu, "$1=[已隐藏]");
}

async function appendInstanceLog(instanceId, taskId, stream, line) {
  await apiRequest(`/daemon/tasks/${taskId}/logs`, {
    method: "POST",
    body: JSON.stringify({ nodeId, instanceId, taskId, stream, lines: [redactLogLine(line)] })
  });
}

async function sendSystemLog(instanceId, taskId, line) {
  if (!instanceId) return;
  await appendInstanceLog(instanceId, taskId, "system", line);
}

async function postTaskProgress(taskId, progress, message) {
  await apiRequest(`/daemon/tasks/${taskId}/progress`, { method: "POST", body: JSON.stringify({ nodeId, progress, message }) });
}

function assertHttpsHost(value, hostname) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== hostname || url.username || url.password) {
    throw new Error("下载地址未通过官方 HTTPS 来源校验。");
  }
}

function getInstanceDirectory(instanceId) {
  const id = requireInstanceId(instanceId);
  const path = minecraftInstanceDirectories.get(id) || resolve(minecraftDirectory, id);
  const withinKnownRoot = [...knownMinecraftDirectories].some((storageDirectory) => {
    const root = getMinecraftStorageRoot(storageDirectory);
    const rel = relative(root, path);
    return rel === "" || !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel);
  });
  if (!withinKnownRoot) throw new Error("实例路径越过已登记的 Minecraft 存储目录。");
  return path;
}

function getNamedInstanceDirectory(instanceName, storageDirectory = minecraftDirectoryRelative) {
  const name = requireMinecraftInstanceName(instanceName);
  const validatedStorageDirectory = validateMinecraftStorageDirectory(storageDirectory);
  if (!knownMinecraftDirectories.has(validatedStorageDirectory)) throw new Error("Minecraft 任务引用了未由控制端登记的存储目录。");
  const root = getMinecraftStorageRoot(validatedStorageDirectory);
  const path = resolve(root, name);
  const rel = relative(root, path);
  if (rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) throw new Error("实例名称导致路径越过 Minecraft 存储目录。");
  return path;
}

function minecraftStorageDirectoryForInstance(instanceDirectory) {
  const actualRoot = win32.resolve(dirname(instanceDirectory));
  for (const storageDirectory of knownMinecraftDirectories) {
    if (win32.resolve(getMinecraftStorageRoot(storageDirectory)).toLocaleLowerCase("en-US") === actualRoot.toLocaleLowerCase("en-US")) return storageDirectory;
  }
  throw new Error("Minecraft 实例不在控制端登记的存储目录中。");
}

function requireInstanceId(value) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/iu.test(value)) throw new Error("Minecraft 实例 ID 格式无效。");
  return value;
}

function requireMinecraftDeploymentId(value) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/iu.test(value)) throw new Error("Minecraft 部署 ID 格式无效。");
  return value;
}

function requireMinecraftInstanceName(value) {
  if (typeof value !== "string" || !/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(value) || [...value].length > 48
    || /[ .]$/u.test(value) || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(value)) {
    throw new Error("Minecraft 实例名称不适合作为 Windows 目录名。");
  }
  return value;
}

function requireReleaseId(value) {
  if (typeof value !== "string" || !/^[0-9A-Za-z.-]{1,64}$/u.test(value)) throw new Error("Minecraft 版本号格式无效。");
  return value;
}

function requireMajor(value) {
  if (!Number.isInteger(value) || value < 8 || value > 40) throw new Error("Java 主版本号无效。");
  return value;
}

function requireMemory(value) {
  if (!Number.isInteger(value) || value < 1024 || value > 32768) throw new Error("Minecraft 内存配置超出允许范围。");
  return value;
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : "未知错误";
  return redactLogLine(message).slice(0, 220);
}

async function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return await new Promise((resolveExit) => {
    const timer = setTimeout(() => finish(false), timeoutMs);
    const onExit = () => finish(true);
    const finish = (value) => {
      clearTimeout(timer);
      child.off("exit", onExit);
      resolveExit(value);
    };
    child.once("exit", onExit);
  });
}

function captureProcess(command, args, timeoutMs, env = process.env) {
  return new Promise((resolveCapture, rejectCapture) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { child.kill(); rejectCapture(new Error("本机辅助命令执行超时。")); }, timeoutMs);
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-16_000); });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-16_000); });
    child.once("error", (error) => { clearTimeout(timer); rejectCapture(error); });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0 || (command.toLocaleLowerCase().endsWith("java.exe") && code === 1)) resolveCapture({ stdout, stderr });
      else rejectCapture(new Error("本机辅助命令执行失败。"));
    });
  });
}

async function fileExists(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}

function delay(milliseconds, signal) {
  return new Promise((resolveDelay) => {
    if (signal?.aborted) { resolveDelay(); return; }
    const finish = () => { clearTimeout(timer); signal?.removeEventListener("abort", finish); resolveDelay(); };
    const timer = setTimeout(finish, milliseconds);
    signal?.addEventListener("abort", finish, { once: true });
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  taskLanes?.stop();
  // Fiber 关闭时立即终止轮询请求和等待，避免退出后继续领取任务或打印等待状态。
  pollingController?.abort();
  await terminalChannel?.done;
  terminalChannel = undefined;
  await Promise.all([runLoopPromise, fileTaskLoopPromise]);
  runLoopPromise = undefined;
  fileTaskLoopPromise = undefined;
  await Promise.all([...activeCommands.values()].map(async command => { await command.cancel(); await command.done; }));
  await taskLanes?.drain();
  process.stdout.write(`本机 Daemon 正在关闭（${signal}），请求安全停止受管实例。\n`);
  const stops = [...activeServers.entries()].map(async ([instanceId, runtime]) => {
    const graceful = await stopManagedProcess({
      child: runtime.child, command: runtime.coreType === "BungeeCord" ? "end\n" : "stop\n",
      timeoutMilliseconds: runtime.stopTimeoutSeconds * 1000,
      waitForExit: waitForChildExit, terminate: terminateProcessTree
    });
    if (graceful) await rm(resolve(getInstanceDirectory(instanceId), "daemon-process.json"), { force: true });
    else process.stderr.write("实例停服等待或输入失败，已确认强制结束；保留状态标记供启动后复核。\n");
  });
  const results = await Promise.allSettled(stops);
  if (results.some(result => result.status === "rejected")) {
    process.exitCode = 1;
    process.stderr.write("部分受管实例未能确认安全退出；不返回正常停机，状态标记保留。\n");
  }
  for (const buffer of logBuffers.values()) if (buffer.timer) clearTimeout(buffer.timer);
  releaseDaemonLock();
}

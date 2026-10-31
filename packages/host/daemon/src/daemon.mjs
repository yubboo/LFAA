/**
 * 功能：运行本机 Windows x64 Daemon，并执行 Minecraft、Java、文件管理与 AI 主机命令任务。
 * 作用：轮询控制端已授权的节点业务任务；Wallpaper Engine 和 DSH Bundle 属于 Harness 插件宿主，不属于游戏 Daemon。
 * 关联文件：packages/host/daemon/src/local-daemon.ts、packages/jobs/jobs/src/ai-host-tasks.ts、packages/jobs/jobs/src/minecraft-queue.ts、packages/fs/fs/src/queue.ts、packages/games/minecraft/src/service.ts、packages/games/steamcmd/src/service.ts、apps/daemon/package.json。
 */
import {createRuntimeExecutor} from "lfaa-runtime-environment/src/executor.mjs";
import {fetchRuntimeResource} from "lfaa-runtime-environment/src/network.mjs";
import {promoteSteamcmdInstallation,initializeSteamcmd,removeSteamcmdInstallation} from "./steamcmd-installation.mjs";
import { initializeGameBackupDirectories } from "./minecraft-backup-storage.mjs";
import { commitMinecraftPropertyFile } from "./minecraft-properties-file.mjs";
import { capturePaperTpsOutput, readMinecraftServerTelemetry } from "./minecraft-server-telemetry.mjs";
import { createSystemResourceTelemetrySampler } from "./system-resource-telemetry.mjs";
import { assertSteamcmdDstClusterFiles as verifySteamcmdDstClusterFiles, buildSteamcmdDstLaunchArguments } from "./steamcmd-dst.mjs";
import { createManagedFileService } from "lfaa-fs/src/managed-files.mjs";
import { protectedDataDirectories } from "lfaa-home-paths/src/reserved-data-paths.mjs";
import { assertInstanceFileMutation, assertGameMetadataMutable, createInstanceFileService } from "lfaa-fs/src/instance-files.mjs";
import { randomUUID, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { startCommand, waitForMinecraftReady, isVanillaReadyLine, terminateProcessTree } from "./process-control.mjs";
import { WINDOWS_APP_CONTAINER_PROVIDER_ID, WindowsAclSandboxProvider } from "lfaa-sandbox-windows-acl";
import { assertSandboxResult } from "lfaa-sandbox";
import { createSandboxExecutionPolicy } from "lfaa-sandbox-policy";
import { withSandboxResult } from "lfaa-shell";
import { provisionMinecraftCore, startNativeMinecraftServer, isMinecraftCoreReadyLine, downloadCoreArtifact } from "./minecraft-provisioner.mjs";
import { validateDaemonConnection } from "./connection-config.mjs";
import { createDaemonTaskLanes } from "./task-lanes.mjs";
import { startTerminalChannel } from "./terminal-channel.mjs";
import { spawnNativeTerminal } from "lfaa-subprocess-local/src/pty.js";
import { createTerminalOutputReplayBuffer } from "./terminal-process-adapter.mjs";
import { stopManagedProcess } from "./managed-process-shutdown.mjs";
import { installEasyTierRuntime, readInstalledEasyTierVersion, validateEasyTierInstallRequest } from "./easytier-runtime.mjs";
import { EASYTIER_RUNTIME_RELEASE } from "lfaa-game-connectivity/src/easytier-release.mjs";
import { maximumNodeFileTransferBytes } from "lfaa-util-values/src/file-transfer-contract.mjs";
import { buildMinecraftJvmArguments, defaultMinecraftInitialHeapMb } from "lfaa-util-values/src/minecraft-jvm-contract.mjs";
import { isSensitiveMinecraftPropertyKey, MINECRAFT_PROPERTY_KEY_PATTERN, MINECRAFT_PROPERTY_VALUE_LIMIT, MINECRAFT_PROPERTIES_ENTRY_LIMIT, MINECRAFT_PROPERTIES_TOTAL_LIMIT, validateMinecraftPropertyChanges } from "lfaa-util-values/src/minecraft-property-contract.mjs";
import { closeSync, createReadStream, createWriteStream, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { access, copyFile, lstat, mkdir, opendir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep, win32 } from "node:path";
import { findRepositoryRoot } from "lfaa-home-paths/src/index.mjs";
import { promisify } from "node:util";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { inflateRawSync } from "node:zlib";
import { resolveDataDirectory, resolveHomeDirectory } from "lfaa-home-paths/src/resolve-data-directory.mjs";
import { protectPrivateDirectory } from "lfaa-home-paths/src/private-directory.mjs";
import { ensureDataDirectories, ensureHomeDirectories } from "lfaa-home-paths/src/data-layout.mjs";

const repositoryRoot = findRepositoryRoot(import.meta.url);
const environmentFile = resolve(repositoryRoot, ".env");
const dataDirectoryAtProcessStart = process.env.LFAA_DATA_DIR?.trim() || "";
if (typeof process.loadEnvFile === "function") {
  try { process.loadEnvFile(environmentFile); } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const configuredDataDirectory = process.env.LFAA_DATA_DIR?.trim() || "";
const homeDirectory = resolveHomeDirectory(repositoryRoot, process.env.LFAA_HOME?.trim() || "");
const dataDirectoryWasManaged = process.env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER === "1" || process.env.LFAA_DATA_DIR_MANAGED_BY_DESKTOP === "1";
const dataDirectoryIsExplicit = process.env.LFAA_DATA_DIR_CONFIGURED === "1"
  || Boolean(dataDirectoryAtProcessStart && !dataDirectoryWasManaged)
  || Boolean(!dataDirectoryAtProcessStart && configuredDataDirectory && !dataDirectoryWasManaged);
const dataDirectory = resolveDataDirectory(repositoryRoot, configuredDataDirectory, {
  lfaaHome: homeDirectory,
  useStoredDataDirectory: !dataDirectoryIsExplicit
});
const credentialsDirectory = resolve(homeDirectory, "credentials");
const steamcmdServerStateDirectory = resolve(credentialsDirectory, "steamcmd-servers");
let minecraftDirectoryRelative = "games/minecraft";
let minecraftDirectory = resolve(dataDirectory, "games", "minecraft");
const knownMinecraftDirectories = new Set([minecraftDirectoryRelative]);
const defaultSteamcmdSettings = { installMode: "online", steamcmdDirectory: "lib/steamcmd", gameDirectory: "games/steamcmd" };
// 文件任务单独领取但仍与安装运维共用维护槽；每秒一次将交互等待压至一个心跳间隔以下。
const fileTaskPollIntervalMilliseconds = 1000;
const javaDirectory = resolve(dataDirectory, "environments", "Java");
const customJavaPathsPath = resolve(javaDirectory, "custom-paths.json");
let backupDirectory = resolve(dataDirectory, "backups", "minecraft");
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
const serverPropertiesFileCapability = "minecraft-server-properties-file-v1";
const sandboxReadyPrefix = "\u001eLFAA_SANDBOX_READY:";
const execFileAsync = promisify(execFile);
async function validateMinecraftJavaArguments(executable, arguments_, javaMajor, signal) {
  try {
    await execFileAsync(executable, [...arguments_, "-version"], {
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 16 * 1024,
      signal
    });
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error;
    const detail = String(error?.stderr || error?.stdout || "").trim().split(/\r?\n/u).slice(-2).join(" ").slice(0, 280);
    throw new Error(`目标 Java ${javaMajor} 不接受当前 JVM 参数，服务端尚未启动。${detail ? ` ${detail}` : ""}`);
  }
}
let nodeId = "";
const activeServers = new Map();
const pendingMinecraftConsoleSubscribers = new Map();
const activeSteamcmdServers = new Map();
let knownSteamcmdServerIds = [];
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
const agentShellSandboxProvider = new WindowsAclSandboxProvider();
let easyTierRuntimeVersion = null;
let nextEasyTierRuntimeProbeAt = 0;
let lastEasyTierRuntimeProbeError = "";
let controlPlaneReady = false;
let lastControlPlaneError = "";
let steamcmdSettings = { ...defaultSteamcmdSettings };
const systemResourceSampler = createSystemResourceTelemetrySampler();

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
  ensureHomeDirectories(homeDirectory);
  ensureDataDirectories(dataDirectory);
  for (const directory of [minecraftDirectory, javaDirectory, downloadDirectory, sandboxMetadataDirectory]) {
    await mkdir(directory, { recursive: true });
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("LFAA Daemon 数据目录不能是符号链接或非目录路径。");
  }
  // 菜单可能在节点已运行时再次启动；复用现有进程，避免 Daemon 重复启动让并行开发服务一起退出。
  if (!acquireDaemonLock()) { if (process.connected) process.disconnect(); return; }
  systemResourceSampler.start();
  const backupDirectories = await initializeGameBackupDirectories(dataDirectory);
  backupDirectory = backupDirectories.minecraftBackupDirectory;
  if (backupDirectories.legacyMigration?.kind === "removed-empty-legacy-directory") {
    process.stdout.write("已移除空的遗留 Minecraft 备份目录；游戏目录未发生数据删除。\n");
  } else if (backupDirectories.legacyMigration?.kind === "moved-legacy-backup-directory") {
    process.stdout.write(`已保留并迁移遗留 Minecraft 备份目录：${backupDirectories.legacyMigration.targetDirectory}\n`);
  }
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
  terminalChannel = startTerminalChannel({ apiBase, nodeId, readToken, signal: pollingController.signal, attachMinecraftConsole: attachManagedMinecraftConsole, onError: message => process.stderr.write(`节点终端连接暂不可用：${message}\n`) });
}

async function detectSandboxBackend() {
  try {
    const { stdout } = await execFileAsync(sandboxHostPath, ["--probe"], { cwd: repositoryRoot, windowsHide: true, timeout: 5000, maxBuffer: 16 * 1024 });
    const result = JSON.parse(stdout.trim());
    return result?.backend === sandboxBackendId
      && result?.protocolVersion === 2
      && result?.interactiveConsole === true
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
      "--java", java.executable, "--java-root", java.root, "--memory-mb", String(memoryMb), "--console-columns", "120", "--console-rows", "30"
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

async function apiRequestBytes(path, timeout = 30_000) {
  await readToken();
  const response = await fetch(`${apiBase}${path}`, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(timeout),
    headers: { authorization: `Bearer ${daemonToken}` }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `控制端请求失败（${response.status}）。`);
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumNodeFileTransferBytes) throw new Error("控制端返回的文件超过 3 MiB 传输上限。");
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumNodeFileTransferBytes) {
        await reader.cancel();
        throw new Error("控制端返回的文件超过 3 MiB 传输上限。");
      }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}

async function runLoop() {
  // 只取消心跳与领取轮询；现有任务的完成/故障回报仍经过正常认证和校验。
  // 领取/心跳请求给控制端更长的响应预算：它可能正忙于会话写入或大附件解析，15 秒会误判成"通信不可用"。
  const pollRequest = (path, options = {}) => apiRequest(path, { ...options, signal: pollingController.signal, timeout: options.timeout ?? 30_000 });
  while (!shuttingDown) {
    if (!controlPlaneReady) {
      try {
        await pollRequest("/health");
        if (shuttingDown) break;
        controlPlaneReady = true;
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
      const capabilities = ["minecraft-vanilla", "minecraft-native-v1", "minecraft-multicore-v1", "minecraft-interactive-console-v1", "minecraft-instance-archive-v1", serverPropertiesFileCapability, "java-environment-manager-v1", "runtime-environment-v1", javaRuntimeSelectionCapability, "node-filesystem-v1", "node-filesystem-v2", "node-filesystem-instance-v1", "node-filesystem-game-storage-v1", "node-filesystem-binary-transfer-v1", "agent-shell-v1", "project-files-v1", EASYTIER_RUNTIME_RELEASE.installCapability, ...(easyTierRuntimeVersion === EASYTIER_RUNTIME_RELEASE.version ? [EASYTIER_RUNTIME_RELEASE.runtimeCapability] : []), ...(sandboxBackendAvailable ? [sandboxCapability] : []), ...(systemResourceSampler.isAvailable() ? ["node-system-resource-telemetry-v1"] : [])];
      if (await steamcmdExecutableReady(steamcmdSettings.steamcmdDirectory)) capabilities.push("steamcmd-ready-v1");
      const systemResources = systemResourceSampler.getLatest();
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
          ...(systemResources ? { systemResources } : {}),
          activeTaskIds: [...activeTasks],
          instances: await scanMinecraftInstances(),
          steamcmdServers: await getSteamcmdServerHeartbeat()
        })
      });
      if (shuttingDown) break;
      if (lastControlPlaneError) process.stdout.write("Daemon 已连接控制端，开始处理心跳与任务。\n");
      lastControlPlaneError = "";
      knownSteamcmdServerIds = Array.isArray(heartbeat?.steamcmdServers)
        ? heartbeat.steamcmdServers.map(item => item?.id).filter(id => typeof id === "string" && /^[0-9a-f-]{36}$/iu.test(id)).slice(0, 500) : [];
      for (const id of heartbeat?.cancelTaskIds ?? []) {
        const command = activeCommands.get(id);
        if (command) void command.cancel();
      }
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
  // 领取/心跳请求给控制端更长的响应预算：它可能正忙于会话写入或大附件解析，15 秒会误判成"通信不可用"。
  const pollRequest = (path, options = {}) => apiRequest(path, { ...options, signal: pollingController.signal, timeout: options.timeout ?? 30_000 });
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
  if (!/^[a-z]:\\$/iu.test(volumeRoot) || target === volumeRoot) throw new Error("游戏存储目录必须位于可用磁盘的普通文件夹中。");
  let current = volumeRoot;
  for (const segment of win32.relative(volumeRoot, target).split(win32.sep).filter(Boolean)) {
    current = resolve(current, segment);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      try { await mkdir(current); } catch (createError) { if (createError?.code !== "EEXIST") throw createError; }
      info = await lstat(current);
    }
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("游戏存储目录不能是符号链接或非目录路径。");
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
  if (typeof settings.backupDirectory === "string") {
    const configuredBackupDirectory = validateMinecraftStorageDirectory(settings.backupDirectory);
    backupDirectory = await ensureStorageDirectory(getMinecraftStorageRoot(configuredBackupDirectory));
  }
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
        const state = currentProcess.serverReady ? "running" : "starting";
        const telemetry = state === "running" ? readMinecraftServerTelemetry(currentProcess) : null;
        result.push({
          id: instanceId,
          state,
          sandboxStatus: currentProcess.executionMode === "native" ? "unsupported" : currentProcess.sandboxReady ? "running" : "unknown",
          ...(telemetry ? { telemetry } : {})
        });
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
        if (!runtime?.serverReady || typeof runtime.writeConsoleInput !== "function" || typeof command !== "string" || !command.trim() || command.length > 1024 || /[\u0000-\u001f\u007f]/u.test(command)) throw new Error("实例控制台不可用或命令无效。");
        runtime.lastInteractiveInputAt = Date.now();
        await runtime.writeConsoleInput(`${command}\r`);
        result = { delivered: true, verified: false, note: "命令已写入服务器标准输入；效果须读取后续日志验证。" }; break;
      }
      case "properties-read": result = await readMinecraftProperties(task); break;
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
    const payload = { ...(task.payload ?? {}) };
    if (task.operation === "upload") {
      payload.bytes = await apiRequestBytes(`/daemon/files/tasks/${task.id}/input?nodeId=${encodeURIComponent(nodeId)}`);
      delete payload.transferId;
    }
    const result = await performNodeFileOperation(task.operation, payload);
    if (typeof result?.dataBase64 === "string" && ["download", "preview"].includes(task.operation)) {
      const bytes = Buffer.from(result.dataBase64, "base64");
      if (bytes.length > maximumNodeFileTransferBytes) throw new Error("目标节点文件超过 3 MiB 传输上限。");
      const transfer = await apiRequest(`/daemon/files/tasks/${task.id}/transfer?nodeId=${encodeURIComponent(nodeId)}&name=${encodeURIComponent(String(result.name ?? "download"))}`, {
        method: "PUT",
        headers: { "content-type": "application/octet-stream" },
        body: bytes
      });
      delete result.dataBase64;
      result.transferId = transfer.transferId;
      result.name = transfer.name;
      result.size = transfer.size;
      result.sha256 = transfer.sha256;
    }
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

function stripAgentSandboxControls(text, token) {
  if (!token) return text;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const complete = new RegExp(`\\u001eLFAA_AGENT_SANDBOX_(?:READY:${escaped}|RESULT:${escaped}:(?:read-only|workspace-write):\\d+)\\u001e\\r?\\n?`, "gu");
  const cleaned = text.replace(complete, "");
  const markerStart = cleaned.lastIndexOf("\u001eLFAA_AGENT_SANDBOX_");
  if (markerStart >= 0 && cleaned.indexOf("\u001e", markerStart + 1) < 0) return cleaned.slice(0, markerStart);
  return cleaned;
}

async function verifyAiHostSandboxResult(raw, confined, timeoutSeconds) {
  const execution = {
    status: "completed",
    exitCode: raw.exitCode,
    signal: null,
    sandbox: undefined,
    done: Promise.resolve(),
    readOutput: () => ({ delta: "", lossy: false }),
    kill: () => false,
    result: async () => ({
      exitCode: raw.exitCode,
      signal: null,
      timedOut: raw.timedOut,
      aborted: raw.cancelled,
      timeoutMs: timeoutSeconds * 1000,
      stdout: { text: raw.stdout, truncated: raw.outputTruncated },
      stderr: { text: raw.stderr, truncated: raw.outputTruncated }
    })
  };
  const verified = await withSandboxResult(execution, confined).result();
  return {
    stdout: verified.stdout.text,
    stderr: verified.stderr.text,
    exitCode: verified.exitCode,
    timedOut: verified.timedOut,
    outputTruncated: verified.stdout.truncated || verified.stderr.truncated,
    cancelled: verified.aborted,
    sandbox: verified.sandbox
  };
}

async function executeAiHostTask(task) {
  let latest, sequence = 0, dirty = false, sending = Promise.resolve(), flushing = false;
  let command, confined;
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
    const sandboxMode = task.sandboxMode ?? "danger-full-access";
    const executable = shell === 'project-files' ? process.execPath : shell === 'powershell' ? 'powershell.exe' : shell === 'bash' || shell === 'zsh' ? shell : process.env.ComSpec || 'cmd.exe';
    const args = shell === 'project-files' ? [fileURLToPath(new URL('../../project-files/src/project-files.mjs', import.meta.url))]
      : shell === 'powershell' ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [Console]::OutputEncoding; & { ${task.command}\n }`]
      : shell === 'bash' || shell === 'zsh' ? ['-lc', task.command] : ['/d', '/s', '/c', task.command];
    // 控制面和模型秘密不继承给命令进程；本机执行仍具有节点 OS 账户的原生权限。
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/(?:TOKEN|SECRET|PASSWORD|API_KEY|COOKIE|AUTHORIZATION)/iu.test(key)));
    if (shell === 'project-files') env.LFAA_DAEMON_DATA_ROOT = dataDirectory;
    if (shell !== 'project-files') {
      const requestedArgv = [executable, ...args];
      if (sandboxMode === "danger-full-access") {
        confined = { argv: requestedArgv, effectiveMode: sandboxMode, enforcement: "none", providerId: "direct-node" };
      } else {
        if (!sandboxBackendAvailable || process.platform !== "win32" || process.arch !== "x64") {
          throw new Error("目标节点 Windows x64 AppContainer Provider 当前不可用；已拒绝受限命令。");
        }
        const policy = createSandboxExecutionPolicy({
          mode: sandboxMode,
          platform: "win32",
          target: { kind: "node", nodeId },
          workspaceRoot: task.workspaceRoot,
          workingDirectory: task.workingDirectory
        });
        confined = assertSandboxResult(requestedArgv, policy, await agentShellSandboxProvider.confine(requestedArgv, policy));
      }
    }
    const launchArgv = confined?.argv ?? [executable, ...args];
    command = startCommand({ executable: launchArgv[0], args: launchArgv.slice(1), cwd: task.workingDirectory || repositoryRoot,
      env, input: shell === 'project-files' ? task.command : undefined, timeoutSeconds: task.timeoutSeconds,
      ...(confined?.requestStop ? { requestStop: confined.requestStop } : {}),
      onOutput: value => {
        latest = confined ? {
          ...value,
          stdout: stripAgentSandboxControls(value.stdout, confined.verificationToken),
          stderr: stripAgentSandboxControls(value.stderr, confined.verificationToken),
          sandbox: { mode: confined.effectiveMode, enforcement: confined.enforcement, denied: false, providerId: confined.providerId, hostVerified: false }
        } : value;
        dirty = true;
      }, outputLimitBytes: aiHostOutputLimitBytes });
    activeCommands.set(task.id, command);
    const rawResult = await command.done;
    const result = confined ? await verifyAiHostSandboxResult(rawResult, confined, task.timeoutSeconds) : rawResult;
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
    const failedSandbox = task.shell !== 'project-files' && task.sandboxMode && task.sandboxMode !== 'danger-full-access'
      ? { mode: task.sandboxMode, enforcement: 'none', denied: true, providerId: WINDOWS_APP_CONTAINER_PROVIDER_ID, hostVerified: false, runnerFailed: true }
      : undefined;
    await apiRequest(`/daemon/ai/host-tasks/${task.id}/complete`, { method: 'POST', body: JSON.stringify({ nodeId, succeeded: false,
      message: `命令启动或回传失败：${message.slice(0, 180)}`, result: latest ?? { stdout: '', stderr: message, exitCode: null, timedOut: false, outputTruncated: false, ...(failedSandbox ? { sandbox: failedSandbox } : {}) } }) }).catch(() => {});
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
    const result = task.kind === "install" ? await installSteamcmd(task)
      : task.kind === "verify" ? await verifySteamcmd(task)
        : task.kind === "uninstall" ? await uninstallSteamcmd(task)
        : task.kind === "install-server" || task.kind === "update-server" ? await installSteamcmdServer(task)
          : task.kind === "start-server" ? await startSteamcmdServer(task)
            : task.kind === "stop-server" ? await stopSteamcmdServer(task)
              : (() => { throw new Error("SteamCMD 任务类型无效。"); })();
    await apiRequest(`/daemon/steamcmd/tasks/${task.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ nodeId, succeeded: true, message: result.uninstalled ? (result.removed ? "SteamCMD 工具目录已完整卸载，游戏目录和服务器文件已保留。" : "SteamCMD 工具目录不存在，已确认无需卸载。") : result.verified ? "SteamCMD 已就绪，游戏存储目录已准备。"
        : result.installed ? `${task.payload?.server?.name ?? "Steam 专用服务端"} 已安装或更新。`
          : result.processStarted ? `${task.payload?.server?.name ?? "游戏服务器"} 进程已启动，真实游戏就绪状态仍需服务器自身确认。`
            : result.stopped ? `${task.payload?.server?.name ?? "游戏服务器"} 进程已停止${result.forced ? "；强制结束，存档完整性未确认" : ""}。`
              : "SteamCMD 校验完成。", result })
    });
  } catch (error) {
    await apiRequest(`/daemon/steamcmd/tasks/${task.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ nodeId, succeeded: false, message: safeMessage(error), result: { verified: false, installed: false, processStarted: false, stopped: false } })
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

async function uninstallSteamcmd(task) {
  const settings=validateSteamcmdSettings(task.payload??{});
  const toolDirectory=resolveManagedFilePath(settings.steamcmdDirectory);
  const gameDirectory=resolveSteamcmdGameDirectory(settings.gameDirectory);
  if(pathsOverlap(toolDirectory,gameDirectory))throw new Error("SteamCMD 工具目录与游戏目录冲突，拒绝卸载。");
  if(activeSteamcmdServers.size)throw new Error("此节点仍有 Steam 游戏服务器由 Daemon 管理为运行状态，不能卸载 SteamCMD。");
  await postSteamcmdProgress(task.id,35,"正在核对 SteamCMD 工具目录和游戏服务器状态。");
  const removed=await removeSteamcmdInstallation(toolDirectory,assertManagedPathIsSafe);
  await postSteamcmdProgress(task.id,92,removed?"SteamCMD 工具目录已删除，正在确认目录状态。":"SteamCMD 工具目录不存在，正在确认无需卸载。");
  return {steamcmdDirectory:settings.steamcmdDirectory,gameDirectory:settings.gameDirectory,removed,uninstalled:true};
}

function validateSteamcmdServerTask(task) {
  const value = task?.payload?.server;
  if (!value || typeof value !== "object" || value.nodeId !== nodeId || !/^[0-9a-f-]{36}$/iu.test(value.id ?? "")
    || typeof value.name !== "string" || !value.name.trim() || value.name.length > 80
    || !Number.isSafeInteger(value.toolAppId) || value.toolAppId < 1 || value.toolAppId > 2_147_483_647
    || value.eulaAccepted !== true) throw new Error("控制端返回的 Steam 专用服务端配置无效，或没有记录许可同意。");
  const installDirectory = validateMinecraftStorageDirectory(value.installDirectory);
  if (win32.isAbsolute(installDirectory)) throw new Error("Steam 服务端安装目录必须位于当前游戏存储目录内。");
  const executablePath = value.executablePath === "" ? "" : validateMinecraftStorageDirectory(value.executablePath);
  if (executablePath && (win32.isAbsolute(executablePath) || !executablePath.toLocaleLowerCase().endsWith(".exe"))) throw new Error("Steam 服务端启动文件必须是安装目录中的 .exe 程序。");
  const launchArguments = value.launchArguments ?? [];
  if (!Array.isArray(launchArguments) || launchArguments.length > 64 || launchArguments.some(argument => typeof argument !== "string" || argument.length > 1024 || /[\r\n\u0000]/u.test(argument))) {
    throw new Error("Steam 服务端启动参数无效。");
  }
  if (launchArguments.some(argument => /(?:pass(?:word)?|passwd|token|secret|api[-_]?key|auth[-_]?key|rcon)/iu.test(argument))) throw new Error("Steam 服务端参数不能包含密码、令牌或密钥。");
  if (typeof value.stopCommand !== "string" || value.stopCommand.length > 120 || /[\r\n\u0000-\u001f\u007f]/u.test(value.stopCommand)) throw new Error("Steam 服务端控制台停服指令无效。");
  if (!Number.isSafeInteger(value.stopTimeoutSeconds) || value.stopTimeoutSeconds < 5 || value.stopTimeoutSeconds > 300) throw new Error("Steam 服务端停服等待时间无效。");
  const dstClusterId = value.dstClusterId ?? null;
  const dstClusterName = value.dstClusterName ?? null;
  const dstShard = value.dstShard ?? null;
  if (dstClusterId !== null && (!/^[0-9a-f-]{36}$/iu.test(dstClusterId) || typeof dstClusterName !== "string"
    || !/^[A-Za-z0-9_-]{1,32}$/u.test(dstClusterName) || !["Master", "Caves"].includes(dstShard))) {
    throw new Error("饥荒集群 ID、名称或分片配置无效。");
  }
  if (dstClusterId === null && (dstClusterName !== null || dstShard !== null)) throw new Error("普通 Steam 服务端不能携带不完整的饥荒集群设置。");
  return { ...value, installDirectory, executablePath, launchArguments };
}

function resolveSteamcmdServerDirectory(settings, server) {
  const gameDirectory = resolveSteamcmdGameDirectory(settings.gameDirectory);
  const directory = win32.resolve(gameDirectory, ...server.installDirectory.split("/"));
  const relativeDirectory = win32.relative(gameDirectory, directory);
  if (!relativeDirectory || relativeDirectory === ".." || relativeDirectory.startsWith(`..${win32.sep}`) || win32.isAbsolute(relativeDirectory)) {
    throw new Error("Steam 服务端安装目录越过已配置的游戏目录。");
  }
  return { gameDirectory, directory };
}

function resolveSteamcmdDstDataDirectory(settings, server) {
  if (!server.dstClusterId) return null;
  const gameDirectory = resolveSteamcmdGameDirectory(settings.gameDirectory);
  const directory = win32.resolve(gameDirectory, "dst-clusters", server.dstClusterId);
  const relativeDirectory = win32.relative(gameDirectory, directory);
  if (!relativeDirectory || relativeDirectory === ".." || relativeDirectory.startsWith(`..${win32.sep}`) || win32.isAbsolute(relativeDirectory)) {
    throw new Error("饥荒集群数据目录越过已配置的游戏存储目录。");
  }
  return directory;
}

function resolveSteamcmdDstClusterConfigurationDirectory(settings, server) {
  const root = resolveSteamcmdDstDataDirectory(settings, server);
  if (!root) return null;
  return win32.resolve(root, "DoNotStarveTogether", server.dstClusterName);
}

async function assertSteamcmdServerPathSafe(target, allowMissing = false) {
  const absolute = win32.resolve(target);
  const volumeRoot = win32.parse(absolute).root;
  if (!/^[a-z]:\\$/iu.test(volumeRoot)) throw new Error("Steam 服务端目标必须位于 Windows 数据磁盘中。");
  let current = volumeRoot;
  const segments = win32.relative(volumeRoot, absolute).split(win32.sep).filter(Boolean);
  for (let index = 0; index < segments.length; index++) {
    current = resolve(current, segments[index]);
    let info;
    try { info = await lstat(current); }
    catch (error) { if (error?.code === "ENOENT" && allowMissing) return null; throw error; }
    if (info.isSymbolicLink() || info.nlink > 1 || index < segments.length - 1 && !info.isDirectory()) {
      throw new Error("Steam 服务端路径包含链接或非普通目录，已拒绝操作。");
    }
    if (index === segments.length - 1) return info;
  }
  return null;
}

function steamcmdServerMarkerPath(serverId) {
  if (!/^[0-9a-f-]{36}$/iu.test(serverId)) throw new Error("Steam 服务端 ID 无效。");
  return resolve(steamcmdServerStateDirectory, `${serverId}.json`);
}

async function readSteamcmdServerMarker(serverId) {
  const markerPath = steamcmdServerMarkerPath(serverId);
  let info;
  try { info = await lstat(markerPath); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
  if (info.isSymbolicLink() || !info.isFile() || info.nlink > 1) throw new Error("Steam 服务端进程标记文件无效。");
  const marker = JSON.parse(await readFile(markerPath, "utf8"));
  if (!Number.isSafeInteger(marker.pid) || marker.pid < 1 || typeof marker.executable !== "string") throw new Error("Steam 服务端进程标记内容无效。");
  if (marker.dstClusterId !== undefined && marker.dstClusterId !== null
    && (!/^[0-9a-f-]{36}$/iu.test(marker.dstClusterId) || typeof marker.serverDataDirectory !== "string")) throw new Error("饥荒集群进程标记内容无效。");
  return { ...marker, markerPath };
}

async function getSteamcmdServerHeartbeat() {
  const states = [];
  for (const id of knownSteamcmdServerIds) {
    const active = activeSteamcmdServers.get(id);
    if (active && Number.isSafeInteger(active.child.pid) && active.child.exitCode === null && active.child.signalCode === null && isProcessRunning(active.child.pid)) {
      states.push({ id, status: "running", processId: active.child.pid });
      continue;
    }
    let status = "stopped";
    try {
      const marker = await readSteamcmdServerMarker(id);
      if (marker && isProcessRunning(marker.pid)) status = "unknown";
      else if (marker) await rm(marker.markerPath, { force: true });
    } catch { status = "unknown"; }
    states.push({ id, status, processId: null });
  }
  return states;
}

async function assertSteamcmdServerNotRunning(serverId) {
  if (activeSteamcmdServers.has(serverId)) throw new Error("游戏服务器当前由本机 Daemon 管理为运行状态，请先停止后再安装或修改。");
  const marker = await readSteamcmdServerMarker(serverId);
  if (!marker) return;
  if (isProcessRunning(marker.pid)) throw new Error("Daemon 重启后发现服务端进程仍在运行，但当前没有控制台管道；请在目标设备确认停止后重试。");
  await rm(marker.markerPath, { force: true });
}

async function assertSteamcmdDstClusterNotRunning(server) {
  if (!server.dstClusterId) return;
  for (const runtime of activeSteamcmdServers.values()) {
    if (runtime.dstClusterId === server.dstClusterId) throw new Error("Master 或 Caves 分片仍由本机 Daemon 管理为运行状态，请先停止后再更新共享服务端文件。");
  }
  for (const id of knownSteamcmdServerIds) {
    if (id === server.id) continue;
    const marker = await readSteamcmdServerMarker(id);
    if (!marker || marker.dstClusterId !== server.dstClusterId) continue;
    if (isProcessRunning(marker.pid)) throw new Error("Daemon 重启后发现该饥荒集群仍有分片进程运行，但没有可恢复的控制台；请在目标设备确认停止后再更新。");
    await rm(marker.markerPath, { force: true });
  }
}

async function prepareSteamcmdDstClusterDirectories(settings, server) {
  const root = resolveSteamcmdDstDataDirectory(settings, server);
  const configurationDirectory = resolveSteamcmdDstClusterConfigurationDirectory(settings, server);
  if (!root || !configurationDirectory) return;
  for (const directory of [root, configurationDirectory, win32.resolve(configurationDirectory, "Master"), win32.resolve(configurationDirectory, "Caves")]) {
    await ensureStorageDirectory(directory);
    await assertSteamcmdServerPathSafe(directory);
  }
}

async function assertSteamcmdDstClusterFiles(settings, server) {
  if (!server.dstClusterId) return null;
  const configurationDirectory = resolveSteamcmdDstClusterConfigurationDirectory(settings, server);
  if (!configurationDirectory) throw new Error("饥荒集群配置目录无效。");
  const dataDirectory = resolveSteamcmdDstDataDirectory(settings, server);
  await verifySteamcmdDstClusterFiles(configurationDirectory, server.dstShard, assertSteamcmdServerPathSafe);
  return dataDirectory;
}

async function installSteamcmdServer(task) {
  const settings = validateSteamcmdSettings(task.payload ?? {});
  const server = validateSteamcmdServerTask(task);
  await assertSteamcmdServerNotRunning(server.id);
  await assertSteamcmdDstClusterNotRunning(server);
  const steamcmdDirectory = resolveManagedFilePath(settings.steamcmdDirectory);
  const steamcmdExecutable = resolve(steamcmdDirectory, "steamcmd.exe");
  const steamcmdInfo = await assertManagedPathIsSafe(steamcmdExecutable);
  if (!steamcmdInfo?.isFile()) throw new Error("目标设备尚未安装并验证 SteamCMD，请先到游戏库的运行环境中安装。");
  const { directory } = resolveSteamcmdServerDirectory(settings, server);
  await postSteamcmdProgress(task.id, 12, `正在准备 ${server.name} 的专用服务端目录。`);
  await ensureStorageDirectory(directory);
  await assertSteamcmdServerPathSafe(directory);
  await postSteamcmdProgress(task.id, 28, `正在通过 SteamCMD 安装 Tool AppID ${server.toolAppId}。`);
  const args = ["+force_install_dir", directory, "+login", "anonymous", "+app_update", String(server.toolAppId), "validate", "+quit"];
  let output;
  try {
    output = await execFileAsync(steamcmdExecutable, args, { cwd: steamcmdDirectory, windowsHide: true, timeout: 60 * 60_000, maxBuffer: 4 * 1024 * 1024 });
  } catch (error) {
    const details = [error?.stdout, error?.stderr].filter(value => typeof value === "string" && value).join("\n").slice(-1200);
    throw new Error(details ? `SteamCMD 服务端安装失败：${details}` : `SteamCMD 服务端安装失败（${safeMessage(error)}）。`);
  }
  const transcript = `${output.stdout ?? ""}\n${output.stderr ?? ""}`;
  const escapedAppId = String(server.toolAppId).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  if (!new RegExp(`App\\s+['\"]?${escapedAppId}['\"]?\\s+(?:fully installed|is up to date)`, "iu").test(transcript)) {
    throw new Error(`SteamCMD 没有确认 Tool AppID ${server.toolAppId} 已完整安装；请检查该 AppID 是否为已发布、允许当前账户下载的专用服务端。`);
  }
  await prepareSteamcmdDstClusterDirectories(settings, server);
  await postSteamcmdProgress(task.id, 95, `${server.name} 的 Steam 专用服务端文件已完成校验。`);
  return { installed: true, toolAppId: server.toolAppId, installDirectory: server.installDirectory };
}

async function startSteamcmdServer(task) {
  const settings = validateSteamcmdSettings(task.payload ?? {});
  const server = validateSteamcmdServerTask(task);
  if (!server.executablePath || !server.stopCommand) throw new Error("启动配置不完整；请填写服务端 .exe 与控制台停服指令。");
  await assertSteamcmdServerNotRunning(server.id);
  const { directory } = resolveSteamcmdServerDirectory(settings, server);
  const serverDataDirectory = await assertSteamcmdDstClusterFiles(settings, server);
  const executable = win32.resolve(directory, ...server.executablePath.split("/"));
  const relativeExecutable = win32.relative(directory, executable);
  if (!relativeExecutable || relativeExecutable === ".." || relativeExecutable.startsWith(`..${win32.sep}`) || win32.isAbsolute(relativeExecutable)) throw new Error("Steam 服务端启动文件越过安装目录。");
  const executableInfo = await assertSteamcmdServerPathSafe(executable);
  if (!executableInfo?.isFile() || !executable.toLocaleLowerCase().endsWith(".exe")) throw new Error("没有在已安装目录中找到配置的服务端 .exe 文件。");
  await postSteamcmdProgress(task.id, 20, `正在启动 ${server.name} 服务端进程。`);
  const launchArguments = server.dstClusterId
    ? buildSteamcmdDstLaunchArguments(serverDataDirectory, server.dstClusterName, server.dstShard)
    : server.launchArguments;
  const child = spawn(executable, launchArguments, { cwd: directory, shell: false, windowsHide: true, stdio: ["pipe", "ignore", "ignore"] });
  await new Promise((resolveStarted, rejectStarted) => {
    const onError = error => { child.off("spawn", onSpawn); rejectStarted(error); };
    const onSpawn = () => { child.off("error", onError); resolveStarted(); };
    child.once("error", onError); child.once("spawn", onSpawn);
  });
  if (!Number.isSafeInteger(child.pid)) { await terminateProcessTree(child); throw new Error("服务端进程没有返回有效的进程编号。"); }
  await mkdir(steamcmdServerStateDirectory, { recursive: true });
  const markerPath = steamcmdServerMarkerPath(server.id);
  try {
    await writeFile(markerPath, JSON.stringify({ pid: child.pid, executable, startedAt: new Date().toISOString(),
      ...(server.dstClusterId ? { dstClusterId: server.dstClusterId, serverDataDirectory } : {}) }), { encoding: "utf8", flag: "wx" });
  } catch (error) {
    await terminateProcessTree(child);
    await waitForChildExit(child, 10_000);
    throw new Error(`无法安全记录服务端进程状态：${safeMessage(error)}`);
  }
  const record = { child, serverId: server.id, serverDirectory: directory, serverDataDirectory, dstClusterId: server.dstClusterId,
    stopCommand: server.stopCommand, stopTimeoutSeconds: server.stopTimeoutSeconds, startedAt: Date.now() };
  activeSteamcmdServers.set(server.id, record);
  child.once("exit", () => {
    activeSteamcmdServers.delete(server.id);
    void rm(markerPath, { force: true }).catch(() => {});
  });
  await delay(500);
  if (child.exitCode !== null || child.signalCode !== null) throw new Error(`服务端进程启动后立即退出（退出码 ${child.exitCode ?? "未知"}）；未确认游戏就绪。`);
  return { processStarted: true, processId: child.pid };
}

async function stopSteamcmdServer(task) {
  const server = validateSteamcmdServerTask(task);
  const record = activeSteamcmdServers.get(server.id);
  if (!record || record.child.exitCode !== null || record.child.signalCode !== null) throw new Error("本机 Daemon 未持有此 Steam 服务端的运行控制台；运行状态未确认，未发送停止操作。");
  await postSteamcmdProgress(task.id, 20, `正在向 ${server.name} 发送配置的安全停服指令。`);
  try { await new Promise((resolveWrite, rejectWrite) => record.child.stdin.write(`${server.stopCommand}\n`, error => error ? rejectWrite(error) : resolveWrite())); }
  catch (error) { throw new Error(`服务端停服指令发送失败：${safeMessage(error)}`); }
  const graceful = await waitForChildExit(record.child, server.stopTimeoutSeconds * 1000);
  if (graceful) return { stopped: true, forced: false, processId: record.child.pid };
  await postSteamcmdProgress(task.id, 75, "服务端未在配置的等待时间内退出，正在结束进程树；未确认游戏存档完整性。");
  await terminateProcessTree(record.child);
  if (!await waitForChildExit(record.child, 10_000)) throw new Error("服务端进程在安全停服指令和进程树终止请求后仍未退出。");
  return { stopped: true, forced: true, processId: record.child.pid };
}

function assertNodeFileReadable(path) {
  const rel = relative(dataDirectory, path);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return;
  const parts = rel.split(sep).map(part => part.toLowerCase());
  if (protectedDataDirectories.includes(parts[0]) || parts[0] === 'plugins') throw new Error('账户或旧插件私有数据由对应 Owner 管理。');
}
const nodeFileService = createManagedFileService({root: dataDirectory, protectedDirectories: protectedDataDirectories,
  assertCanRead: assertNodeFileReadable, assertCanMutate: assertNoActiveInstanceAffected});
export async function performNodeFileOperation(operation, payload) {
  if (payload.gameStorageKind !== undefined) {
    if(payload.gameStorageKind==='steamcmd-runtime') {
      if(!['list','search','directory-size','preview','read','download'].includes(operation))throw new Error('SteamCMD 工具目录在文件管理中只允许查看。');
      const root=resolveManagedFilePath(steamcmdSettings.steamcmdDirectory);
      try {
        return await createManagedFileService({root,mutationRoot:dataDirectory,assertCanRead:assertNodeFileReadable,assertCanMutate:()=>{throw new Error('SteamCMD 工具目录在文件管理中只允许查看。');}}).operate(operation,payload);
      } catch(error) {
        if(operation==='list'&&payload.path===''&&error?.code==='ENOENT') {
          const configuredPath = win32.isAbsolute(steamcmdSettings.steamcmdDirectory)
            ? steamcmdSettings.steamcmdDirectory
            : `data\\${steamcmdSettings.steamcmdDirectory.replace(/[\\/]+/gu, "\\")}`;
          throw new Error(`SteamCMD 工具目录不存在：${configuredPath}。请在“游戏库 → 运行环境 → SteamCMD”检查此实际目录或重新下载安装；文件管理不会自动创建该目录。`);
        }
        throw error;
      }
    }
    const root = payload.gameStorageKind === 'minecraft' ? getMinecraftStorageRoot(minecraftDirectoryRelative)
      : payload.gameStorageKind === 'steamcmd' ? resolveSteamcmdGameDirectory(steamcmdSettings.gameDirectory) : null;
    if (!root) throw new Error('节点游戏存储来源无效。');
    await ensureStorageDirectory(root);
    return createManagedFileService({ root, mutationRoot: dataDirectory, recycleNamespace: payload.recycleNamespace ?? '', assertCanRead: assertNodeFileReadable, assertCanMutate: assertNoActiveInstanceAffected }).operate(operation, payload);
  }
  if (payload.minecraftInstanceId !== undefined) {
    const id = requireInstanceId(payload.minecraftInstanceId);
    // 只允许当前节点已核验索引，不能以猜测的 UUID 路径或来自浏览器的根目录代替。
    if (!minecraftInstanceDirectories.has(id)) throw new Error('此节点尚未核验游戏实例目录，请等待节点状态对账。');
    const root = getInstanceDirectory(id);
    return createInstanceFileService({ root, mutationRoot: dataDirectory, isStopped: () => !activeServers.has(id), recycleNamespace: payload.recycleNamespace ?? '', assertCanRead: assertNodeFileReadable, assertCanMutate: assertNoActiveInstanceAffected }).operate(operation, payload);
  }
  if (payload.recycleNamespace) return createManagedFileService({ root: dataDirectory, protectedDirectories: protectedDataDirectories, recycleNamespace: payload.recycleNamespace,
    assertCanRead: assertNodeFileReadable,
    assertCanMutate: assertNoActiveInstanceAffected }).operate(operation, payload);
  return nodeFileService.operate(operation, payload);
}
function resolveManagedFilePath(value, allowRoot = false) { return nodeFileService.resolvePath(value, allowRoot); }
async function ensureManagedDirectory(directory) { return nodeFileService.ensureDirectory(directory); }
async function assertManagedPathIsSafe(path, allowMissing = false) { return nodeFileService.assertPath(path, allowMissing); }

async function assertNoActiveInstanceAffected(path) {
  assertGameMetadataMutable(path);
  assertNodeFileReadable(path);
  const plugins = resolve(dataDirectory, 'plugins');
  const pluginRelative = relative(plugins, path), ancestorRelative = relative(path, plugins);
  if (!pluginRelative || pluginRelative !== '..' && !pluginRelative.startsWith(`..${sep}`) && !isAbsolute(pluginRelative)
    || !ancestorRelative || ancestorRelative !== '..' && !ancestorRelative.startsWith(`..${sep}`) && !isAbsolute(ancestorRelative)) throw new Error('扩展插件目录由插件生命周期管理，不能通过普通文件操作修改。');
  for (const [id, directory] of minecraftInstanceDirectories) await assertInstanceFileMutation(path, directory, !activeServers.has(id));
  for (const instanceId of activeServers.keys()) {
    const instanceDirectory = getInstanceDirectory(instanceId);
    const targetInsideInstance = relative(instanceDirectory, path);
    const instanceInsideTarget = relative(path, instanceDirectory);
    const targetIsInside = targetInsideInstance === "" || !targetInsideInstance.startsWith(`..${sep}`) && targetInsideInstance !== ".." && !isAbsolute(targetInsideInstance);
    const instanceIsInside = instanceInsideTarget === "" || !instanceInsideTarget.startsWith(`..${sep}`) && instanceInsideTarget !== ".." && !isAbsolute(instanceInsideTarget);
    if (targetIsInside || instanceIsInside) throw new Error("Minecraft 实例正在运行；请先停止实例，再修改、移动或删除相关文件。");
  }
  for (const runtime of activeSteamcmdServers.values()) {
    for (const protectedDirectory of [runtime.serverDirectory, runtime.serverDataDirectory].filter(Boolean)) {
      const targetInsideServer = win32.relative(protectedDirectory, win32.resolve(path));
      const serverInsideTarget = win32.relative(win32.resolve(path), protectedDirectory);
      const targetIsInside = targetInsideServer === "" || targetInsideServer !== ".." && !targetInsideServer.startsWith(`..${win32.sep}`) && !win32.isAbsolute(targetInsideServer);
      const serverIsInside = serverInsideTarget === "" || serverInsideTarget !== ".." && !serverInsideTarget.startsWith(`..${win32.sep}`) && !win32.isAbsolute(serverInsideTarget);
      if (targetIsInside || serverIsInside) throw new Error("Steam 游戏服务器或饥荒集群数据正在使用；请先停止相关分片，再修改或删除文件。");
    }
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
      initialHeapMb: Number(payload.initialHeapMb ?? defaultMinecraftInitialHeapMb(memoryMb, payload.executionMode ?? "appcontainer")),
      jvmArguments: Array.isArray(payload.jvmArguments) ? payload.jvmArguments : [],
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
  const instanceId = requireInstanceId(task.instanceId);
  try { return await startMinecraftInstanceInternal(task); }
  catch (error) {
    if (!activeServers.has(instanceId)) {
      const pending = pendingMinecraftConsoleSubscribers.get(instanceId);
      if (pending) {
        for (const subscriber of pending.values()) subscriber.onExit(null, "Minecraft 实例启动失败，控制台会话已结束。");
        pendingMinecraftConsoleSubscribers.delete(instanceId);
      }
    }
    throw error;
  }
}

async function startMinecraftInstanceInternal(task) {
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
    activeServers, safeFileExists, readSafeFile, isProcessRunning, assertSafeFileTarget, spawnTerminal: spawnNativeTerminal, java: (major, runtimeId, progress) => resolveMinecraftJavaRuntime(major, runtimeId, progress, task.payload.downloadTimeoutSeconds),
    validateJavaArguments: (executable, args, major) => validateMinecraftJavaArguments(executable, args, major, minecraftTaskControllers.get(task.id)?.signal),
    phpDirectory: resolve(dataDirectory, "environments", "php", "pocketmine"), progress: postTaskProgress,
    attachOutput: attachServerOutput, initializeConsoleSubscribers: adoptPendingMinecraftConsoleSubscribers, waitForExit: waitForChildExit
  });
  const instanceName = requireMinecraftInstanceName(task.payload?.instanceName ?? metadata.instanceName ?? basename(instanceDirectory));
  const launchMetadata = {
    ...metadata,
    memoryMb: task.payload?.memoryMb ?? metadata.memoryMb,
    initialHeapMb: task.payload?.initialHeapMb ?? metadata.initialHeapMb ?? defaultMinecraftInitialHeapMb(Number(task.payload?.memoryMb ?? metadata.memoryMb), task.payload?.executionMode ?? metadata.executionMode ?? "appcontainer"),
    jvmArguments: task.payload?.jvmArguments ?? metadata.jvmArguments ?? []
  };
  const javaMajor = requireMajor(task.payload?.javaMajor ?? metadata.javaMajor);
  const javaRuntimeId = Object.hasOwn(task.payload ?? {}, "javaRuntimeId")
    ? (typeof task.payload.javaRuntimeId === "string" ? task.payload.javaRuntimeId : null)
    : (typeof metadata.javaRuntimeId === "string" ? metadata.javaRuntimeId : null);
  const java = await resolveMinecraftJavaRuntime(javaMajor, javaRuntimeId, (progress, message) => postTaskProgress(task.id, progress, message), task.payload.downloadTimeoutSeconds);
  if (!(await safeFileExists(resolve(instanceDirectory, "server.jar")))) throw new Error("实例目录缺少 server.jar，请重新安装或恢复官方文件。");
  if (!(await safeFileExists(resolve(instanceDirectory, "eula.txt")))) throw new Error("实例缺少 EULA 同意记录。");
  if (activeServers.has(instanceId)) throw new Error("Minecraft 实例已由本机 Daemon 管理为运行状态。");
  if (!sandboxBackendAvailable) throw new Error("Windows AppContainer Sandbox Host 不可用，已拒绝启动 Minecraft Java。");
  const jvmArguments = buildMinecraftJvmArguments({
    memoryMb: Number(launchMetadata.memoryMb),
    initialHeapMb: Number(launchMetadata.initialHeapMb),
    jvmArguments: launchMetadata.jvmArguments
  }, { javaMajor, coreType: metadata.coreType ?? "Vanilla" });
  await validateMinecraftJavaArguments(java.executable, jvmArguments, javaMajor, minecraftTaskControllers.get(task.id)?.signal);
  await prepareMinecraftSandbox(instanceId, instanceName, java, launchMetadata.memoryMb, task.id, instanceDirectory);
  const savedRuntimeMetadata = { ...launchMetadata, javaMajor, javaRuntimeId, executionMode: "appcontainer" };
  if (metadata.javaRuntimeId !== javaRuntimeId || metadata.memoryMb !== launchMetadata.memoryMb || metadata.initialHeapMb !== launchMetadata.initialHeapMb || JSON.stringify(metadata.jvmArguments ?? []) !== JSON.stringify(launchMetadata.jvmArguments)) {
    await assertSafeFileTarget(resolve(instanceDirectory, "lfaa-instance.json"));
    await writeFile(resolve(instanceDirectory, "lfaa-instance.json"), JSON.stringify(savedRuntimeMetadata, null, 2), "utf8");
  }

  const propertiesPath = resolve(instanceDirectory, "server.properties");
  const serverProperties = await safeFileExists(propertiesPath) ? parseProperties(await readSafeFile(propertiesPath, "utf8")) : new Map();
  const configuredPort = Number(serverProperties.get("server-port") ?? metadata.properties?.serverPort);
  const serverPort = Number.isInteger(configuredPort) && configuredPort >= 1 && configuredPort <= 65_535 ? configuredPort : null;
  const readinessToken = randomUUID();
  const child = spawn(sandboxHostPath, [
    "--launch", "--data-root", dataDirectory, "--instance-storage", minecraftStorageDirectoryForInstance(instanceDirectory), "--instance-id", instanceId, "--instance-name", instanceName,
    "--java", java.executable, "--java-root", java.root, "--console-columns", "120", "--console-rows", "30",
    "--java-major", String(javaMajor), "--memory-mb", String(launchMetadata.memoryMb), "--initial-heap-mb", String(launchMetadata.initialHeapMb),
    ...launchMetadata.jvmArguments.flatMap(argument => ["--jvm-arg", argument]), "--readiness-token", readinessToken
  ], {
    cwd: repositoryRoot,
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const writeSandboxFrame = frame => new Promise((resolveWrite, rejectWrite) => child.stdin.write(frame, error => error ? rejectWrite(error) : resolveWrite()));
  const record = { child, javaMajor, javaRuntimeId, stopTimeoutSeconds, startedAt: Date.now(), taskId: task.id, sandboxReady: false, serverReady: false, coreType: metadata.coreType ?? "Vanilla", serverPort, sandboxBackend: sandboxBackendId, consoleSubscribers: new Map(),
    writeConsoleInput: data => writeSandboxFrame(encodeSandboxConsoleFrame(1, Buffer.from(data, "utf8"))),
    resizeConsole: (columns, rows) => writeSandboxFrame(encodeSandboxConsoleFrame(2, encodeConsoleResize(columns, rows))) };
  child.stdin.on("error", () => { void appendInstanceLog(instanceId, task.id, "system", "Minecraft 控制台输入通道发生错误；发送任务以实际回报为准。"); });
  adoptPendingMinecraftConsoleSubscribers(instanceId, record);
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
  await running.writeConsoleInput(running.coreType === "BungeeCord" ? "end\r" : "stop\r");
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
  const metadata = await readInstanceMetadata(instanceDirectory);
  const releaseId = getMinecraftReleaseForProperties(metadata, task.payload?.releaseId);
  const propertyPath = resolve(instanceDirectory, "server.properties");
  const currentSnapshot = await readMinecraftPropertiesFile(instanceDirectory, releaseId);
  const current = currentSnapshot.properties;
  const fileChanges = task.payload?.fileProperties;
  let entries;
  if (fileChanges && typeof fileChanges === "object" && !Array.isArray(fileChanges)) {
    const knownKeys = new Set(current.keys());
    entries = new Map(Object.entries(validateMinecraftPropertyChanges(fileChanges, knownKeys, releaseId)));
  } else {
    entries = new Map(Object.entries(mapPropertyValues(validateProperties(task.payload?.properties, releaseId))));
  }
  const temporaryPath = resolve(instanceDirectory, `.server-properties-${task.id}.tmp`);
  await commitMinecraftPropertyFile({
    propertyPath,
    temporaryPath,
    properties: current,
    sourceText: currentSnapshot.sourceText,
    changes: Object.fromEntries(entries),
    assertSafeTarget: assertSafeFileTarget
  });
  const synced = await readMinecraftPropertiesFile(instanceDirectory, releaseId);
  await appendInstanceLog(instanceId, task.id, "system", "已写入校验通过的 server.properties 属性并重新读取真实文件。");
  return { serverProperties: synced.serverProperties, fileSnapshot: synced.fileSnapshot };
}

async function readMinecraftProperties(task) {
  const instanceId = requireInstanceId(task.instanceId);
  const instanceDirectory = await requireSafeInstanceDirectory(instanceId);
  const metadata = await readInstanceMetadata(instanceDirectory);
  if (!metadata || metadata.instanceId !== instanceId) throw new Error("实例元数据缺失或身份不匹配，未读取 server.properties。");
  if (["BungeeCord", "Velocity", "Nukkit", "PocketMine"].includes(metadata.coreType)) throw new Error("此核心不使用受支持的 server.properties 配置格式。");
  await postTaskProgress(task.id, 35, "正在安全读取节点上的 server.properties 文件。");
  const synced = await readMinecraftPropertiesFile(instanceDirectory, metadata.releaseId);
  await appendInstanceLog(instanceId, task.id, "system", `已从节点读取并脱敏 server.properties（${synced.fileSnapshot.entries.length} 项）。`);
  return { serverProperties: synced.serverProperties, fileSnapshot: synced.fileSnapshot };
}

async function readMinecraftPropertiesFile(instanceDirectory, releaseId) {
  const propertyPath = resolve(instanceDirectory, "server.properties");
  if (!(await safeFileExists(propertyPath))) throw new Error("实例中还没有 server.properties 文件；请先完成一次服务器启动后再读取配置。");
  const info = await lstat(propertyPath);
  if (info.size > 64 * 1024) throw new Error("server.properties 超过 64 KiB 安全读取上限，未返回部分配置。");
  const text = await readSafeFile(propertyPath, "utf8");
  if (Buffer.byteLength(text, "utf8") > 64 * 1024) throw new Error("server.properties 超过 64 KiB 安全读取上限，未返回部分配置。");
  const properties = parseProperties(text);
  if (properties.size > MINECRAFT_PROPERTIES_ENTRY_LIMIT) throw new Error("server.properties 超过 256 项安全读取上限，未返回部分配置。");
  const entries = [];
  let totalCharacters = 0;
  for (const [key, value] of properties) {
    if (!MINECRAFT_PROPERTY_KEY_PATTERN.test(key) || value.length > MINECRAFT_PROPERTY_VALUE_LIMIT || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw new Error("server.properties 包含不受支持或超出单项上限的字段。");
    totalCharacters += key.length + value.length;
    if (totalCharacters > MINECRAFT_PROPERTIES_TOTAL_LIMIT) throw new Error("server.properties 的字段总量超过安全上限。");
    const sensitive = isSensitiveMinecraftPropertyKey(key);
    entries.push({ key, value: sensitive ? null : value, sensitive });
  }

  const normalized = {};
  const names = {
    motd: "motd", difficulty: "difficulty", gamemode: "gamemode", "max-players": "maxPlayers", "server-port": "serverPort",
    "online-mode": "onlineMode", pvp: "pvp", "white-list": "whiteList", "view-distance": "viewDistance",
    "simulation-distance": "simulationDistance", "level-name": "levelName", "level-seed": "levelSeed"
  };
  for (const [propertyName, field] of Object.entries(names)) {
    const raw = properties.get(propertyName);
    if (raw === undefined) continue;
    const converted = parseMinecraftEditableProperty(field, raw);
    if (converted === undefined) continue;
    if (field === "simulationDistance" && !supportsMinecraftSimulationDistance(releaseId)) continue;
    normalized[field] = converted;
  }
  return {
    properties,
    sourceText: text,
    serverProperties: normalized,
    fileSnapshot: { source: "node", observedAt: new Date().toISOString(), entries }
  };
}

function parseMinecraftEditableProperty(field, raw) {
  if (field === "motd") return raw.length <= 120 && !/[\r\n\u0000]/u.test(raw) ? raw : undefined;
  if (field === "levelName") return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(raw) && !raw.includes("..") ? raw : undefined;
  if (field === "levelSeed") return raw.length <= 80 && !/[\r\n\u0000]/u.test(raw) ? raw : undefined;
  if (field === "difficulty") return ["peaceful", "easy", "normal", "hard"].includes(raw) ? raw : undefined;
  if (field === "gamemode") return ["survival", "creative", "adventure", "spectator"].includes(raw) ? raw : undefined;
  if (["maxPlayers", "serverPort", "viewDistance", "simulationDistance"].includes(field)) {
    if (!/^-?\d+$/u.test(raw)) return undefined;
    const number = Number(raw);
    const [minimum, maximum] = field === "serverPort" ? [1024, 65535] : field === "maxPlayers" ? [1, 200] : [2, 32];
    return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : undefined;
  }
  if (["onlineMode", "pvp", "whiteList"].includes(field)) return raw === "true" ? true : raw === "false" ? false : undefined;
  return undefined;
}

function supportsMinecraftSimulationDistance(releaseId) {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?(?:$|[-+])/u.exec(String(releaseId ?? ""));
  if (!match) return false;
  const [, major, minor] = match;
  return Number(major) > 1 || Number(major) === 1 && Number(minor) >= 18;
}

function getMinecraftReleaseForProperties(metadata, fallback) {
  const releaseId = typeof metadata?.releaseId === "string" ? metadata.releaseId : typeof fallback === "string" ? fallback : "";
  if (metadata?.releaseId && fallback && metadata.releaseId !== fallback) throw new Error("任务版本与实例元数据不一致，拒绝修改服务器配置。");
  return releaseId;
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

function validateProperties(value, releaseId) {
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
  if (value.simulationDistance !== undefined && !supportsMinecraftSimulationDistance(releaseId)) throw new Error("当前 Minecraft 版本不支持修改 simulation-distance。");
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
      const runtime = activeServers.get(instanceId);
      const terminalChunk = streamName === "stdout" && options.readinessToken
        ? chunk.replace(`${sandboxReadyPrefix}${options.readinessToken}\u001e`, "")
        : chunk;
      if (terminalChunk && runtime) {
        runtime.consoleOutputReplay ??= createTerminalOutputReplayBuffer();
        runtime.consoleOutputReplay.append(terminalChunk);
        if (runtime.consoleSubscribers instanceof Map) {
          for (const subscriber of runtime.consoleSubscribers.values()) subscriber.onOutput(terminalChunk);
        }
      }
      rest += chunk;
      const lines = rest.split(/\r?\n/u);
      rest = lines.pop() || "";
      if (streamName === "stdout") {
        const runtime = activeServers.get(instanceId);
        for (const line of lines) capturePaperTpsOutput(runtime, line);
      }
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
    const runtime = activeServers.get(instanceId);
    if (runtime?.consoleSubscribers instanceof Map) {
      for (const subscriber of runtime.consoleSubscribers.values()) subscriber.onExit(code);
      runtime.consoleSubscribers.clear();
    }
    runtime?.consoleOutputReplay?.clear();
    activeServers.delete(instanceId);
    void rm(resolve(getInstanceDirectory(instanceId), "daemon-process.json"), { force: true }).catch(() => {
      void appendInstanceLog(instanceId, taskId, "system", "进程已退出，但运行标记清理失败；下次启动将重新核实标记中的进程。").catch(() => {});
    });
    void appendInstanceLog(instanceId, taskId, "system", `Minecraft 进程已退出（退出码 ${code ?? "未知"}）。`).catch(() => {});
  });
}

function attachManagedMinecraftConsole(instanceId, terminalId, callbacks) {
  const id = requireInstanceId(instanceId);
  const runtime = activeServers.get(id);
  if (runtime && (typeof runtime.writeConsoleInput !== "function" || typeof runtime.resizeConsole !== "function")) throw new Error("Minecraft 实例没有可用的交互式 PTY 控制台；请确认节点支持交互式控制台。");
  const pending = pendingMinecraftConsoleSubscribers.get(id);
  if ((runtime?.consoleSubscribers?.size ?? 0) || pending?.size) throw new Error("此 Minecraft 实例已经连接了一个交互式终端会话。");
  const onOutput = data => callbacks.onOutput(data);
  const onExit = (code, message) => callbacks.onExit(code, message);
  const subscriber = { onOutput, onExit };
  if (runtime) {
    if (!(runtime.consoleSubscribers instanceof Map)) runtime.consoleSubscribers = new Map();
    runtime.consoleSubscribers.set(terminalId, subscriber);
  } else {
    const subscribers = pending ?? new Map();
    subscribers.set(terminalId, subscriber);
    pendingMinecraftConsoleSubscribers.set(id, subscribers);
  }
  const recentOutput = runtime?.consoleOutputReplay?.snapshot();
  if (recentOutput) onOutput(recentOutput);
  return {
    writeStdin(data) {
      const current = activeServers.get(id);
      if (!current?.serverReady || typeof current.writeConsoleInput !== "function") throw new Error("Minecraft 服务端尚未就绪，当前不能发送游戏命令。");
      const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (!bytes.length || bytes.length > 16 * 1024) throw new Error("Minecraft 控制台输入长度无效。");
      current.lastInteractiveInputAt = Date.now();
      return current.writeConsoleInput(bytes.toString("utf8"));
    },
    resize(columns, rows) {
      if (!Number.isInteger(columns) || columns < 2 || columns > 500 || !Number.isInteger(rows) || rows < 2 || rows > 200) throw new Error("Minecraft 终端尺寸无效。");
      const current = activeServers.get(id);
      if (!current?.serverReady || typeof current.resizeConsole !== "function") return;
      return current.resizeConsole(columns, rows);
    },
    detach() {
      const active = activeServers.get(id);
      if (active?.consoleSubscribers?.get(terminalId) === subscriber) active.consoleSubscribers.delete(terminalId);
      const waiting = pendingMinecraftConsoleSubscribers.get(id);
      if (waiting?.get(terminalId) === subscriber) {
        waiting.delete(terminalId);
        if (!waiting.size) pendingMinecraftConsoleSubscribers.delete(id);
      }
    }
  };
}

function adoptPendingMinecraftConsoleSubscribers(instanceId, runtime) {
  const id = requireInstanceId(instanceId);
  const pending = pendingMinecraftConsoleSubscribers.get(id);
  if (!pending?.size) return;
  runtime.consoleSubscribers ??= new Map();
  for (const [terminalId, subscriber] of pending) runtime.consoleSubscribers.set(terminalId, subscriber);
  pendingMinecraftConsoleSubscribers.delete(id);
}

function encodeSandboxConsoleFrame(opcode, payload) {
  if (!Buffer.isBuffer(payload) || payload.length > 16 * 1024) throw new Error("Minecraft PTY 帧数据超过允许大小。");
  const header = Buffer.alloc(13);
  header.write("LFAATTY1", 0, "ascii");
  header[8] = opcode;
  header.writeUInt32LE(payload.length, 9);
  return Buffer.concat([header, payload]);
}

function encodeConsoleResize(columns, rows) {
  if (!Number.isInteger(columns) || columns < 2 || columns > 500 || !Number.isInteger(rows) || rows < 2 || rows > 200) throw new Error("Minecraft 终端尺寸无效。");
  const payload = Buffer.alloc(8);
  payload.writeUInt32LE(columns, 0);
  payload.writeUInt32LE(rows, 4);
  return payload;
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
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, "")
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/gu, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "")
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
  systemResourceSampler.stop();
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
      child: runtime.child, command: runtime.coreType === "BungeeCord" ? "end\r" : "stop\r",
      writeCommand: data => runtime.writeConsoleInput(data),
      timeoutMilliseconds: runtime.stopTimeoutSeconds * 1000,
      waitForExit: waitForChildExit, terminate: terminateProcessTree
    });
    if (graceful) await rm(resolve(getInstanceDirectory(instanceId), "daemon-process.json"), { force: true });
    else process.stderr.write("实例停服等待或输入失败，已确认强制结束；保留状态标记供启动后复核。\n");
  });
  const steamStops = [...activeSteamcmdServers.values()].map(async runtime => {
    if (runtime.child.exitCode !== null || runtime.child.signalCode !== null) return;
    try { await new Promise((resolveWrite, rejectWrite) => runtime.child.stdin.write(`${runtime.stopCommand}\n`, error => error ? rejectWrite(error) : resolveWrite())); }
    catch { /* 继续等待真实退出；超时后由进程树终止收尾。 */ }
    if (!await waitForChildExit(runtime.child, runtime.stopTimeoutSeconds * 1000)) {
      await terminateProcessTree(runtime.child);
      if (!await waitForChildExit(runtime.child, 10_000)) throw new Error("Steam 服务端在 Daemon 停机时仍未确认退出。");
    }
  });
  const results = await Promise.allSettled([...stops, ...steamStops]);
  if (results.some(result => result.status === "rejected")) {
    process.exitCode = 1;
    process.stderr.write("部分受管实例未能确认安全退出；不返回正常停机，状态标记保留。\n");
  }
  for (const buffer of logBuffers.values()) if (buffer.timer) clearTimeout(buffer.timer);
  releaseDaemonLock();
}

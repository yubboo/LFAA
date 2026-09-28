/**
 * 功能：运行本机 Windows x64 Daemon，并执行受限的 Minecraft Vanilla 节点任务。
 * 作用：轮询控制端任务、维护真实 Java/实例状态、校验官方下载并管理 Minecraft 服务进程。
 * 关联文件：server/src/modules/nodes/local-daemon.ts、server/src/modules/tasks/minecraft-queue.ts、server/src/modules/games/minecraft/service.ts、daemon/package.json。
 */
import { randomUUID, createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { closeSync, createReadStream, createWriteStream, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { access, copyFile, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const environmentFile = resolve(repositoryRoot, ".env");
if (typeof process.loadEnvFile === "function") {
  try { process.loadEnvFile(environmentFile); } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const configuredDataDirectory = process.env.LFAA_DATA_DIR?.trim() || "data";
const dataDirectory = isAbsolute(configuredDataDirectory) ? configuredDataDirectory : resolve(repositoryRoot, configuredDataDirectory);
const credentialsDirectory = resolve(dataDirectory, "credentials");
const minecraftDirectory = resolve(dataDirectory, "games", "minecraft");
const javaDirectory = resolve(dataDirectory, "environments", "java");
const backupDirectory = resolve(dataDirectory, "backups", "minecraft");
const downloadDirectory = resolve(dataDirectory, "cache", "minecraft-downloads");
const sandboxMetadataDirectory = resolve(dataDirectory, "environments", "sandbox", "minecraft");
const sandboxHostPath = resolve(repositoryRoot, "dist", "daemon", "target", "x86_64-pc-windows-msvc", "release", "lfaa-sandbox-host.exe");
const tokenPath = resolve(credentialsDirectory, "daemon-token");
const nodeIdPath = resolve(credentialsDirectory, "daemon-node-id");
const lockPath = resolve(credentialsDirectory, "daemon.lock");
const serverPort = Number(process.env.SERVER_PORT || 3000);
const apiBase = `http://127.0.0.1:${serverPort}/api`;
const daemonVersion = "0.1.1";
const sandboxBackendId = "windows-appcontainer-v1";
const sandboxCapability = "app-sandbox-windows-appcontainer-v1";
const sandboxReadyPrefix = "\u001eLFAA_SANDBOX_READY:";
const execFileAsync = promisify(execFile);
const nodeId = await loadOrCreateNodeId();
const activeServers = new Map();
const activeTasks = new Set();
const logBuffers = new Map();
let shuttingDown = false;
let daemonToken = "";
let lockNonce = "";
let sandboxBackendAvailable = false;

if (process.platform !== "win32" || process.arch !== "x64") {
  process.stderr.write("Minecraft Daemon 当前只支持 Windows x64。\n");
  process.exitCode = 1;
} else {
  await initialize();
}

async function initialize() {
  for (const directory of [credentialsDirectory, minecraftDirectory, javaDirectory, backupDirectory, downloadDirectory, sandboxMetadataDirectory]) {
    await mkdir(directory, { recursive: true });
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("LFAA Daemon 数据目录不能是符号链接或非目录路径。");
  }
  acquireDaemonLock();
  process.once("exit", releaseDaemonLock);
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      daemonToken = (await readFile(tokenPath, "utf8")).trim();
      break;
    } catch (error) {
      if (error?.code !== "ENOENT" || attempt === 29) throw error;
      await delay(1000);
    }
  }
  if (daemonToken.length < 32) throw new Error("本机 Daemon 通信密钥无效。");
  sandboxBackendAvailable = await detectSandboxBackend();
  if (!sandboxBackendAvailable) process.stderr.write("Windows AppContainer Sandbox Host 不可用；Minecraft 实例启动将被拒绝，其他已登记任务仍可处理。\n");
  process.stdout.write(`LFAA 本机 Daemon 已启动（${nodeId.slice(0, 8)}）。\n`);
  void runLoop();
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
    return value?.version === 1 && value?.backend === sandboxBackendId
      && value?.appId === "minecraft" && value?.instanceId === instanceId
      && typeof value?.javaRootName === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}

async function prepareMinecraftSandbox(instanceId, java, memoryMb, taskId) {
  if (!sandboxBackendAvailable) throw new Error("Windows AppContainer Sandbox Host 不可用，已拒绝启动 Minecraft Java。");
  if (!java?.managed || !java.root || !java.executable) throw new Error("Minecraft AppContainer 只允许使用 LFAA 管理的 Java 运行环境。");
  const javaRootName = basename(java.root);
  const existing = await readSandboxMetadata(instanceId);

  let output;
  try {
    output = await execFileAsync(sandboxHostPath, [
      "--prepare", "--data-root", dataDirectory, "--instance-id", instanceId,
      "--java", java.executable, "--java-root", java.root, "--memory-mb", String(memoryMb)
    ], { cwd: repositoryRoot, windowsHide: true, timeout: 120_000, maxBuffer: 32 * 1024 });
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
  if (existing?.javaRootName === javaRootName) return existing;

  const metadata = {
    version: 1,
    backend: sandboxBackendId,
    appId: "minecraft",
    instanceId,
    javaRootName,
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
  try { createLock(); return; }
  catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }

  let existing;
  try { existing = readFileSync(lockPath, "utf8"); }
  catch (error) { if (error?.code === "ENOENT") { createLock(); return; } throw error; }
  const pid = Number(existing.split(/\r?\n/u)[0]);
  if (Number.isInteger(pid) && pid > 0 && isProcessRunning(pid)) throw new Error("同一 LFAA 数据目录下已有本机 Daemon 在运行。");
  if (readFileSync(lockPath, "utf8") !== existing) throw new Error("本机 Daemon 锁状态刚刚变化，请检查是否已有进程启动。");
  try { unlinkSync(lockPath); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  try { createLock(); }
  catch (error) {
    if (error?.code === "EEXIST") throw new Error("同一 LFAA 数据目录下已有本机 Daemon 在运行。");
    throw error;
  }
}

function releaseDaemonLock() {
  if (!lockNonce) return;
  try {
    const lock = readFileSync(lockPath, "utf8").split(/\r?\n/u);
    if (lock[1] === lockNonce) unlinkSync(lockPath);
  } catch { /* 进程退出时不覆盖锁文件错误。 */ }
}

async function readToken() {
  const token = (await readFile(tokenPath, "utf8")).trim();
  if (token.length < 32) throw new Error("本机 Daemon 通信密钥无效。");
  daemonToken = token;
  return token;
}

async function apiRequest(path, options = {}) {
  await readToken();
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    signal: AbortSignal.timeout(options.timeout ?? 15_000),
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
  while (!shuttingDown) {
    try {
      const javaRuntimes = await discoverJavaRuntimes();
      await apiRequest("/daemon/heartbeat", {
        method: "POST",
        body: JSON.stringify({
          id: nodeId,
          displayName: process.env.COMPUTERNAME || "本机 Windows 节点",
          platform: process.platform,
          architecture: process.arch,
          version: daemonVersion,
          capabilities: ["minecraft-vanilla", ...(sandboxBackendAvailable ? [sandboxCapability] : [])],
          javaRuntimes,
          activeTaskIds: [...activeTasks],
          instances: await scanMinecraftInstances()
        })
      });

      if (activeTasks.size === 0) {
        const { task } = await apiRequest("/daemon/tasks/claim", { method: "POST", body: JSON.stringify({ nodeId }) });
        if (task) {
          activeTasks.add(task.id);
          void executeTask(task).finally(() => activeTasks.delete(task.id));
        }
      }
    } catch (error) {
      if (!shuttingDown) process.stderr.write(`Daemon 与控制端通信暂不可用：${safeMessage(error)}\n`);
    }
    await delay(5000);
  }
}

async function scanMinecraftInstances() {
  const result = [];
  const entries = await readdir(minecraftDirectory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[0-9a-f-]{36}$/iu.test(entry.name)) continue;
    const instanceId = entry.name;
    const directory = resolve(minecraftDirectory, instanceId);
    const markerPath = resolve(directory, "daemon-process.json");
    const installingPath = resolve(directory, "daemon-installing.json");
    const jarExists = await safeFileExists(resolve(directory, "server.jar"));
    if (await safeFileExists(installingPath)) {
      try {
        const installMarker = JSON.parse(await readSafeFile(installingPath, "utf8"));
        if (typeof installMarker.taskId !== "string") throw new Error("安装任务标记无效。");
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
      result.push({ id: instanceId, state: "running", sandboxStatus: currentProcess.sandboxReady ? "running" : "unknown" });
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
      sandboxStatus: !sandboxBackendAvailable ? "unsupported" : prepared ? "prepared" : "unprepared"
    });
  }
  return result;
}

function isProcessRunning(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === "EPERM"; }
}

async function executeTask(task) {
  try {
    await postTaskProgress(task.id, 5, "正在检查任务输入和目标实例。");
    let result = {};
    switch (task.kind) {
      case "install": result = await installMinecraftInstance(task); break;
      case "start": result = await startMinecraftInstance(task); break;
      case "stop": result = await stopMinecraftInstance(task); break;
      case "properties": result = await applyMinecraftProperties(task); break;
      case "backup": result = await backupMinecraftWorld(task); break;
      case "java-install": result = await installTemurinRuntime(task.payload?.javaMajor, (progress, message) => postTaskProgress(task.id, progress, message)); break;
      default: throw new Error("Daemon 拒绝执行未登记的任务类型。");
    }
    await apiRequest(`/daemon/tasks/${task.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ nodeId, succeeded: true, message: "Minecraft 任务已完成。", result })
    });
  } catch (error) {
    const message = safeMessage(error);
    await sendSystemLog(task.instanceId, task.id, `任务失败：${message}`).catch(() => undefined);
    await apiRequest(`/daemon/tasks/${task.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ nodeId, succeeded: false, message, result: {} })
    }).catch(() => undefined);
  }
}

async function installMinecraftInstance(task) {
  const instanceId = requireInstanceId(task.instanceId);
  const payload = task.payload ?? {};
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

  const instanceDirectory = await createSafeInstanceDirectory(instanceId);
  const installMarker = resolve(instanceDirectory, "daemon-installing.json");
  await assertSafeFileTarget(installMarker);
  await writeFile(installMarker, JSON.stringify({ taskId: task.id, releaseId }), { encoding: "utf8", flag: "w" });
  try {
    const existingMetadata = await readInstanceMetadata(instanceDirectory);
    if (existingMetadata && existingMetadata.releaseId !== releaseId) throw new Error("此实例目录已经安装了另一个 Minecraft 版本，拒绝覆盖。");
    let java = await findJavaRuntime(javaMajor, true);
    if (!java) {
      await postTaskProgress(task.id, 12, `未找到 Java ${javaMajor}，正在准备受管理的 Temurin JRE。`);
      await installTemurinRuntime(javaMajor, (progress, message) => postTaskProgress(task.id, progress, message));
      java = await findJavaRuntime(javaMajor, true);
    }
    if (!java) throw new Error(`没有找到可用于 AppContainer 的受管理 Java ${javaMajor} JRE。`);
    await prepareMinecraftSandbox(instanceId, java, memoryMb, task.id);

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
    await writeFile(metadataPath, JSON.stringify({ instanceId, releaseId, javaMajor, memoryMb }, null, 2), "utf8");
    await appendInstanceLog(instanceId, task.id, "system", `已校验并安装 Minecraft ${releaseId} 官方 Vanilla 服务端。`);
    return { artifactName: "server.jar", javaMajor };
  } finally {
    await rm(installMarker, { force: true });
  }
}

async function startMinecraftInstance(task) {
  const instanceId = requireInstanceId(task.instanceId);
  const instanceDirectory = await requireSafeInstanceDirectory(instanceId);
  const metadata = await readInstanceMetadata(instanceDirectory);
  if (!metadata) throw new Error("找不到已安装的 Minecraft 实例元数据。");
  const javaMajor = requireMajor(task.payload?.javaMajor ?? metadata.javaMajor);
  const java = await findJavaRuntime(javaMajor, true);
  if (!java) throw new Error(`没有找到可用于 AppContainer 的受管理 Java ${javaMajor}；请先安装对应 Temurin JRE。`);
  if (!(await safeFileExists(resolve(instanceDirectory, "server.jar")))) throw new Error("实例目录缺少 server.jar，请重新安装或恢复官方文件。");
  if (!(await safeFileExists(resolve(instanceDirectory, "eula.txt")))) throw new Error("实例缺少 EULA 同意记录。");
  if (activeServers.has(instanceId)) throw new Error("Minecraft 实例已由本机 Daemon 管理为运行状态。");
  if (!sandboxBackendAvailable) throw new Error("Windows AppContainer Sandbox Host 不可用，已拒绝启动 Minecraft Java。");
  await prepareMinecraftSandbox(instanceId, java, metadata.memoryMb, task.id);

  const readinessToken = randomUUID();
  const child = spawn(sandboxHostPath, [
    "--launch", "--data-root", dataDirectory, "--instance-id", instanceId,
    "--java", java.executable, "--java-root", java.root,
    "--memory-mb", String(metadata.memoryMb), "--readiness-token", readinessToken
  ], {
    cwd: repositoryRoot,
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const record = { child, javaMajor, startedAt: Date.now(), taskId: task.id, sandboxReady: false, sandboxBackend: sandboxBackendId };
  activeServers.set(instanceId, record);
  attachServerOutput(instanceId, child, task.id, {
    readinessToken,
    onSandboxReady: () => { record.sandboxReady = true; record.onSandboxReady?.(); }
  });

  await new Promise((resolveStarted, rejectStarted) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("error", onError);
      child.off("exit", onExit);
      if (error) {
        activeServers.delete(instanceId);
        if (child.exitCode === null && child.signalCode === null && !child.killed) child.kill();
        rejectStarted(error);
      } else resolveStarted();
    };
    const timer = setTimeout(() => finish(new Error("Minecraft AppContainer 启动确认超时。")), 20_000);
    const onError = () => finish(new Error("无法启动 Minecraft AppContainer Sandbox Host。"));
    const onExit = (code) => finish(new Error(`Minecraft AppContainer 在启动确认前退出（退出码 ${code ?? "未知"}）。`));
    record.onSandboxReady = () => finish();
    child.once("error", onError);
    child.once("exit", onExit);
  });
  const processMarker = resolve(instanceDirectory, "daemon-process.json");
  await assertSafeFileTarget(processMarker);
  await writeFile(processMarker, JSON.stringify({ pid: child.pid, javaMajor, startedAt: new Date().toISOString(), appId: "minecraft", sandboxBackend: sandboxBackendId }), "utf8");
  await appendInstanceLog(instanceId, task.id, "system", `Minecraft ${metadata.releaseId} 已启动，使用 Java ${javaMajor}。`);
  return { javaMajor };
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
  child.stdin.write("stop\n");
  await postTaskProgress(task.id, 35, "已发送 Minecraft 安全停止命令，等待世界保存和进程退出。");
  const stopped = await waitForChildExit(child, 30_000);
  if (!stopped) {
    child.kill();
    if (!(await waitForChildExit(child, 10_000))) throw new Error("Minecraft 进程未能在安全停止或终止请求后退出。");
    await sendSystemLog(instanceId, task.id, "Minecraft 未在 30 秒内响应安全停止，Daemon 已结束本实例进程。");
  }
  await rm(resolve(instanceDirectory, "daemon-process.json"), { force: true });
  await appendInstanceLog(instanceId, task.id, "system", "Minecraft 实例已停止。");
  return {};
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
  const worlds = [levelName, `${levelName}_nether`, `${levelName}_the_end`];
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

async function installTemurinRuntime(majorInput, reportProgress) {
  const major = requireMajor(majorInput);
  const existing = await findJavaRuntime(major, true);
  if (existing?.managed) return { javaMajor: major, runtimeVendor: "Eclipse Temurin" };
  const metadataUrl = `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse`;
  assertHttpsHost(metadataUrl, "api.adoptium.net");
  const metadataResponse = await fetch(metadataUrl, { signal: AbortSignal.timeout(30_000), redirect: "error" });
  if (!metadataResponse.ok) throw new Error(`Adoptium 没有提供 Java ${major} Windows x64 JRE（${metadataResponse.status}）。`);
  const assets = await metadataResponse.json();
  const binary = assets?.[0]?.binary?.package;
  const downloadUrl = String(binary?.link || "");
  const expectedSha256 = String(binary?.checksum || "").toLowerCase();
  const archiveName = String(binary?.name || "");
  if (!downloadUrl || !/^[a-f0-9]{64}$/u.test(expectedSha256) || !/^[A-Za-z0-9._-]+\.zip$/u.test(archiveName)) {
    throw new Error("Adoptium 返回的 JRE 工件或 SHA-256 信息无效。");
  }
  assertHttpsHost(downloadUrl, "github.com");
  const archivePath = resolve(downloadDirectory, archiveName);
  if (!(await fileExists(archivePath)) || await hashFile(archivePath, "sha256").catch(() => "") !== expectedSha256) {
    await rm(archivePath, { force: true });
    await reportProgress?.(32, `正在下载并校验 Temurin Java ${major} JRE。`);
    await downloadAndVerify(downloadUrl, archivePath, { algorithm: "sha256", digest: expectedSha256, maxBytes: 1_000_000_000 });
  }

  const extractionDirectory = resolve(javaDirectory, `.install-${major}-${randomUUID()}`);
  await mkdir(extractionDirectory, { recursive: true });
  let finalDirectory = "";
  try {
    await reportProgress?.(72, `正在解压 Temurin Java ${major} JRE 到 LFAA 运行环境目录。`);
    await expandZip(archivePath, extractionDirectory);
    const executable = await findExecutable(extractionDirectory, "java.exe");
    if (!executable) throw new Error("Temurin JRE 解压内容中没有 java.exe。");
    finalDirectory = resolve(javaDirectory, `temurin-${major}-${Date.now()}-${randomUUID().slice(0, 8)}`);
    await rename(extractionDirectory, finalDirectory);
    const finalExecutable = resolve(finalDirectory, relative(extractionDirectory, executable));
    const version = await readJavaVersion(finalExecutable);
    if (version.major !== major) throw new Error(`安装后的 Java 主版本为 ${version.major}，预期为 ${major}。`);
    await rm(archivePath, { force: true });
    await reportProgress?.(96, `Temurin Java ${major} 已安装并通过版本核对。`);
    return { javaMajor: major, runtimeVendor: version.vendor || "Eclipse Temurin" };
  } catch (error) {
    await rm(extractionDirectory, { recursive: true, force: true });
    if (finalDirectory) await rm(finalDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function discoverJavaRuntimes() {
  const runtimes = new Map();
  const managedEntries = await readdir(javaDirectory, { withFileTypes: true }).catch(() => []);
  for (const entry of managedEntries) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
    const executable = await findExecutable(resolve(javaDirectory, entry.name), "java.exe");
    if (!executable) continue;
    const version = await readJavaVersion(executable).catch(() => null);
    if (!version) continue;
    const runtimeId = `temurin-${version.major}`;
    runtimes.set(runtimeId, { runtimeId, major: version.major, vendor: version.vendor || "Eclipse Temurin", managed: true });
  }
  const pathEntries = (process.env.PATH || "").split(";").filter(Boolean);
  for (const pathEntry of pathEntries) {
    const executable = resolve(pathEntry.replace(/^"|"$/gu, ""), "java.exe");
    if (!(await fileExists(executable))) continue;
    const version = await readJavaVersion(executable).catch(() => null);
    if (!version) continue;
    const runtimeId = `system-${version.major}`;
    if (!runtimes.has(runtimeId)) runtimes.set(runtimeId, { runtimeId, major: version.major, vendor: version.vendor || "Java Runtime", managed: false });
  }
  return [...runtimes.values()].slice(0, 32);
}

async function findJavaRuntime(major, managedOnly = false) {
  const runtimes = [];
  const entries = await readdir(javaDirectory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
    const root = resolve(javaDirectory, entry.name);
    const executable = await findExecutable(root, "java.exe");
    if (executable) runtimes.push({ executable, managed: true, root });
  }
  if (!managedOnly) {
    for (const pathEntry of (process.env.PATH || "").split(";").filter(Boolean)) {
      const executable = resolve(pathEntry.replace(/^"|"$/gu, ""), "java.exe");
      if (await fileExists(executable)) runtimes.push({ executable, managed: false, root: null });
    }
  }
  for (const runtime of runtimes) {
    const version = await readJavaVersion(runtime.executable).catch(() => null);
    if (version?.major === major) return { ...runtime, ...version };
  }
  return null;
}

async function readJavaVersion(executable) {
  const output = await captureProcess(executable, ["-version"], 10_000);
  const text = `${output.stdout}\n${output.stderr}`;
  const versionMatch = /version\s+"(?:1\.)?(\d+)/iu.exec(text);
  if (!versionMatch) throw new Error("无法识别 Java 版本输出。");
  const vendor = /Temurin|OpenJDK|Java\(TM\)|Oracle/iu.exec(text)?.[0] || "Java Runtime";
  return { major: Number(versionMatch[1]), vendor };
}

async function expandZip(archivePath, destinationPath) {
  const script = "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath $env:LFAA_ARCHIVE_PATH -DestinationPath $env:LFAA_DESTINATION_PATH -Force";
  await captureProcess("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], 180_000, {
    ...process.env,
    LFAA_ARCHIVE_PATH: archivePath,
    LFAA_DESTINATION_PATH: destinationPath
  });
}

async function downloadAndVerify(url, destinationPath, { algorithm, digest, size, maxBytes }) {
  const allowedHost = algorithm === "sha1" ? "piston-data.mojang.com" : "github.com";
  assertHttpsHost(url, allowedHost);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30 * 60 * 1000),
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
    await pipeline(response.body, verifier, createWriteStream(destinationPath, { flags: "wx" }));
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
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

async function createSafeInstanceDirectory(instanceId) {
  const directory = getInstanceDirectory(instanceId);
  await mkdir(directory, { recursive: true });
  return await requireSafeInstanceDirectory(instanceId);
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
    void appendInstanceLog(instanceId, taskId, "system", "Minecraft Java 进程发生启动或运行错误。");
  });
  child.once("exit", (code) => {
    activeServers.delete(instanceId);
    void rm(resolve(getInstanceDirectory(instanceId), "daemon-process.json"), { force: true });
    void appendInstanceLog(instanceId, taskId, "system", `Minecraft 进程已退出（退出码 ${code ?? "未知"}）。`);
  });
}

function bufferLogs(instanceId, taskId, stream, lines) {
  const buffer = logBuffers.get(instanceId) || { taskId, stream, lines: [], timer: null };
  for (const line of lines) {
    const trimmed = redactLogLine(line);
    if (trimmed) buffer.lines.push(trimmed.slice(0, 4096));
  }
  if (buffer.lines.length > 200) buffer.lines.splice(0, buffer.lines.length - 200);
  if (!buffer.timer) {
    buffer.timer = setTimeout(() => { void flushLogs(instanceId); }, 750);
  }
  logBuffers.set(instanceId, buffer);
}

async function flushLogs(instanceId) {
  const buffer = logBuffers.get(instanceId);
  if (!buffer || buffer.lines.length === 0) { logBuffers.delete(instanceId); return; }
  const lines = buffer.lines.splice(0, 200);
  clearTimeout(buffer.timer);
  buffer.timer = null;
  try {
    await apiRequest(`/daemon/tasks/${buffer.taskId}/logs`, {
      method: "POST",
      body: JSON.stringify({ nodeId, instanceId, taskId: buffer.taskId, stream: buffer.stream, lines })
    });
  } catch {
    buffer.lines.unshift(...lines);
    if (buffer.lines.length > 200) buffer.lines.splice(0, buffer.lines.length - 200);
    buffer.timer = setTimeout(() => { void flushLogs(instanceId); }, 3000);
    return;
  }
  if (buffer.lines.length) {
    buffer.timer = setTimeout(() => { void flushLogs(instanceId); }, 250);
  } else logBuffers.delete(instanceId);
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
  const path = resolve(minecraftDirectory, id);
  const rel = relative(minecraftDirectory, path);
  if (rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) throw new Error("实例路径越过 Minecraft 数据根目录。");
  return path;
}

function requireInstanceId(value) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/iu.test(value)) throw new Error("Minecraft 实例 ID 格式无效。");
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

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write(`本机 Daemon 正在关闭（${signal}），请求安全停止受管实例。\n`);
  const stops = [...activeServers.entries()].map(async ([instanceId, runtime]) => {
    try {
      runtime.child.stdin.write("stop\n");
      const stopped = await waitForChildExit(runtime.child, 20_000);
      if (!stopped) runtime.child.kill();
      if (stopped) await rm(resolve(getInstanceDirectory(instanceId), "daemon-process.json"), { force: true });
    } catch { /* 关闭阶段保留进程状态标记供下次启动后复核。 */ }
  });
  await Promise.all(stops);
  for (const buffer of logBuffers.values()) if (buffer.timer) clearTimeout(buffer.timer);
  releaseDaemonLock();
}

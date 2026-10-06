/**
 * 功能：执行真实多核心安装、启动参数与就绪识别。
 * 作用：按所选工件协议安装 Java/PHP 核心，处理加载器、代理配置、校验与端口；原生进程不宣称 OS 隔离。
 * 关联文件：daemon.mjs 提供数据路径、Java、日志与持久进程管理；core-sources.ts 提供可信工件；process-control.mjs 管理进程树。
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, isAbsolute, resolve } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createServer, createConnection } from "node:net";
import { spawn } from "node:child_process";
import { createSocket } from "node:dgram";
import { startCommand, terminateProcessTree } from "./process-control.mjs";

const artifactHosts = new Set(["download.fastmirror.net", "mohistmc-build.cn-sy1.rains3.com", "maven.minecraftforge.net", "maven.neoforged.net", "github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"]);
export function validateCoreArtifactDownload(artifact) {
  const url = new URL(artifact?.url);
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443" || !artifactHosts.has(url.hostname)) throw new Error("核心工件来源未通过 HTTPS 白名单校验。");
  if (!["sha1", "sha256"].includes(artifact.algorithm) || !new RegExp(`^[a-f0-9]{${artifact.algorithm === "sha1" ? 40 : 64}}$`, "iu").test(artifact.digest)) throw new Error("核心工件缺少有效摘要。");
  return url;
}
/** 每次跳转重新校验 HTTPS 来源；摘要与体积均确认后才将下载文件提升为可执行工件。 */
export async function downloadCoreArtifact(artifact, destination, timeoutSeconds, progress) {
  validateCoreArtifactDownload(artifact);
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 30 || timeoutSeconds > 7200) throw new Error("缺少有效的下载时限配置。");
  const signal = AbortSignal.timeout(timeoutSeconds * 1000);
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await downloadCoreArtifactAttempt(artifact, destination, signal, timeoutSeconds, progress, attempt); }
    catch (error) {
      // 只重试同一摘要的只读工件下载，复用总时限；安装/配置/进程任务绝不在此重放。
      const cause = error.cause ?? error;
      if (signal.aborted) throw new Error(`工件下载超过已配置的 ${timeoutSeconds} 秒时限，未完成文件已清理。`, { cause: error });
      if (attempt === 1 && cause.name === "TypeError") throw new Error(`工件下载连接中断（${new URL(artifact.url).hostname}），请检查网络后恢复任务。`, { cause: error });
      if (attempt === 1 || cause.name !== "TypeError") throw error;
    }
  }
}
async function downloadCoreArtifactAttempt(artifact, destination, signal, timeoutSeconds, progress, attempt) {
  let url = validateCoreArtifactDownload(artifact);
  let response;
  for (let i = 0; i < 6; i++) {
    response = await fetch(url, { redirect: "manual", signal, ...(attempt === 1 ? { headers: { Connection: "close" } } : {}) });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location || i === 5) throw new Error("核心下载跳转无效或过多。");
    url = validateCoreArtifactDownload({ ...artifact, url: new URL(location, url).href });
  }
  if (!response?.ok || !response.body) throw new Error(`核心下载失败（${response?.status ?? "未知"}）。`);
  const maximum = 1024 * 1024 * 1024, total = Number(response.headers.get("content-length") ?? 0);
  if (total > maximum) { await response.body.cancel(); throw new Error("核心工件超过 1 GiB 安全上限。"); }
  const hash = createHash(artifact.algorithm);
  let bytes = 0, last = 0, reporting = Promise.resolve();
  const verifier = new Transform({ transform(chunk, _encoding, done) {
    bytes += chunk.length;
    if (bytes > maximum) return done(new Error("核心工件超过 1 GiB 安全上限。"));
    hash.update(chunk);
    if (Date.now() - last > 1500) { last = Date.now(); const current = bytes; reporting = reporting.then(() => progress?.(current, total)); reporting.catch(() => {}); }
    done(null, chunk);
  } });
  await mkdir(dirname(destination), { recursive: true });
  // 先独占创建，失败时不删除其他任务或用户已经存在的文件。
  const file = await open(destination, "wx");
  try {
    await pipeline(response.body, verifier, file.createWriteStream());
    await reporting;
    if (bytes === 0 || total > 0 && bytes !== total || hash.digest("hex") !== artifact.digest.toLowerCase()) throw new Error("核心工件的体积或摘要与来源不符，已拒绝使用。");
  } catch (error) {
    await file.close().catch(() => {}); await rm(destination, { force: true });
    if (signal.aborted) throw new Error(`工件下载超过已配置的 ${timeoutSeconds} 秒时限（${url.hostname}），未完成文件已清理。`, { cause: error });
    if (error?.message === "terminated" || error?.name === "TypeError") throw new Error(`工件下载连接中断（${url.hostname}），未完成文件已清理；请检查网络后恢复任务。`, { cause: error });
    throw error;
  }
  return bytes;
}
async function hashFile(path, algorithm) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink > 1) throw new Error("核心文件不能是链接或特殊文件。");
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
async function installArtifact(artifact, path, task, report) {
  const exists = await lstat(path).catch(e => { if (e.code !== "ENOENT") throw e; return null; });
  if (exists) {
    if (await hashFile(path, artifact.algorithm) !== artifact.digest.toLowerCase()) throw new Error("目录已有不同内容的核心工件，拒绝覆盖。");
    return;
  }
  const temporary = `${path}.${task.id}.download`;
  try {
    await downloadCoreArtifact(artifact, temporary, task.payload.downloadTimeoutSeconds, (bytes, total) => report(35, `正在下载：${Math.round(bytes / 1024 / 1024)} MiB${total > 0 ? ` / ${Math.round(total / 1024 / 1024)} MiB` : ""}。`));
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}
/** 环境变量按必要系统字段复制，不向游戏/安装器注入 Daemon 凭据和模型密钥。 */
export function minecraftNativeEnvironment(directory, runtime) {
  const env = {};
  for (const key of ["SystemRoot", "WINDIR", "ComSpec", "SystemDrive", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE"]) if (process.env[key]) env[key] = process.env[key];
  env.TEMP = env.TMP = join(directory, "tmp");
  env.PATH = [dirname(runtime.executable), process.env.SystemRoot && join(process.env.SystemRoot, "System32")].filter(Boolean).join(process.platform === "win32" ? ";" : ":");
  if (runtime.kind !== "php") env.JAVA_HOME = runtime.root;
  return env;
}
async function installer(java, path, directory, timeout, log) {
  const operation = startCommand({ executable: java.executable, args: ["-jar", path, "--installServer"], cwd: directory, env: minecraftNativeEnvironment(directory, java), timeoutSeconds: timeout, onOutput: value => log(value) });
  const result = await operation.done;
  if (result.timedOut || result.exitCode !== 0) throw new Error(`加载器安装失败${result.timedOut ? "（超时）" : `（退出码 ${result.exitCode}）`}；请查看安装日志。`);
}
async function findFiles(directory, predicate, depth = 0) {
  if (depth > 12) return [];
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("加载器输出中存在链接，拒绝使用。");
    if (entry.isDirectory()) result.push(...await findFiles(path, predicate, depth + 1));
    else if (entry.isFile() && predicate(entry.name)) result.push(path);
  }
  return result;
}
async function forgeLaunch(directory) {
  const library = join(directory, "libraries");
  const args = await findFiles(library, name => name === "win_args.txt").catch(e => { if (e.code !== "ENOENT") throw e; return []; });
  if (args.length === 1) return { kind: "argfile", path: relative(directory, args[0]).replaceAll("\\", "/") };
  const jars = (await readdir(directory)).filter(name => /^(?:forge|minecraftforge)-.*\.jar$/u.test(name) && !name.includes("installer"));
  if (args.length === 0 && jars.length === 1) return { kind: "jar", path: jars[0] };
  throw new Error("加载器未生成唯一可验证的启动入口，拒绝猜测或执行生成的 Shell 脚本。");
}
export function isMinecraftCoreReadyLine(core, line) {
  if (core === "Velocity") return /Done \([\d.,]+s\)!/u.test(line);
  if (core === "BungeeCord") return /Listening on (?:\/|\[|0\.0\.0\.0|127\.0\.0\.1)/u.test(line);
  if (core === "PocketMine") return /Done \([\d.,]+s\)!|Server started|For help, type ["']?help/u.test(line);
  if (core === "Nukkit") return /(?:Done|完成) \([\d.,]+s\)[!！]/u.test(line);
  return /\bDone \([\d.,]+s\)!/u.test(line);
}
/** 只从实例内经过验证的持久启动合同生成参数数组，绝不运行用户拼接的命令行。 */
export function buildMinecraftNativeArguments(metadata) {
  const launch = metadata.launch;
  if (!launch || typeof launch.path !== "string" || isAbsolute(launch.path) || launch.path.split(/[\\/]/u).includes("..") || /[:\u0000-\u001f]/u.test(launch.path)) throw new Error("实例启动入口无效。");
  if (launch.kind === "php") return [launch.path, "--no-wizard", "--disable-ansi"];
  const memory = Number(metadata.memoryMb);
  if (!Number.isInteger(memory) || memory < 1024 || memory > 32768) throw new Error("实例内存配置无效。");
  const jvm = ["-Dfile.encoding=UTF-8", "-Dsun.stdout.encoding=UTF-8", "-Dsun.stderr.encoding=UTF-8", `-Xms${Math.min(memory, 1024)}M`, `-Xmx${memory}M`];
  if (metadata.coreType === "Nukkit") {
    const locale = metadata.language === "system" || !metadata.language ? Intl.DateTimeFormat().resolvedOptions().locale : metadata.language;
    return [...jvm, "-jar", launch.path, "--language", locale.startsWith("zh") ? "chs" : "eng"];
  }
  if (launch.kind === "argfile") return [...jvm, `@${launch.path}`, "nogui"];
  if (launch.kind !== "jar") throw new Error("实例启动协议未登记。");
  return [...jvm, "-jar", launch.path, ...(["BungeeCord", "Velocity"].includes(metadata.coreType) ? [] : ["nogui"])];
}
export async function assertMinecraftPortAvailable(port, udp = false) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("服务端口配置无效。");
  await new Promise((resolvePromise, reject) => {
    const listener = udp ? createSocket("udp4") : createServer();
    listener.once("error", error => { try { listener.close(); } catch {} reject(new Error(`端口 ${port} 无法使用（${error.code}）。`)); });
    const ready = () => listener.close(resolvePromise);
    udp ? listener.bind(port, "0.0.0.0", ready) : listener.listen(port, "0.0.0.0", ready);
  });
}
/** 原生进程只等待核心就绪，不伪造 AppContainer 握手。 */
export function waitForNativeMinecraftReady(child, record, seconds) {
  return new Promise((resolvePromise, reject) => {
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true; clearTimeout(timer); child.off("error", onError); child.off("exit", onExit); record.onReady = undefined;
      error ? reject(error) : resolvePromise();
    };
    const onError = error => finish(error);
    const onExit = code => finish(new Error(record.startupError ? `核心启动失败：${record.startupError}（退出码 ${code ?? "未知"}），请查看实例日志。` : `核心在就绪前退出（退出码 ${code ?? "未知"}），请查看实例日志。`));
    const timer = setTimeout(() => finish(new Error("核心服务就绪超时，请查看安装/启动日志。")), seconds * 1000);
    record.onReady = () => { if (record.serverReady) finish(); };
    child.once("error", onError); child.once("exit", onExit);
    if (child.exitCode !== null || child.signalCode !== null) onExit(child.exitCode); else record.onReady();
  });
}
export async function startNativeMinecraftServer(task, stored, directory, host) {
  const id = task.instanceId;
  if (host.activeServers.has(id)) throw new Error("实例已在本节点运行，拒绝重复启动。");
  const marker = join(directory, "daemon-process.json");
  if (await host.safeFileExists(marker)) {
    const old = JSON.parse(await host.readSafeFile(marker, "utf8"));
    if (Number.isInteger(old.pid) && host.isProcessRunning(old.pid)) throw new Error("发现上次 Daemon 的存活进程，控制通道未知，拒绝重复启动。");
    await rm(marker);
  }
  const javaRuntimeId = Object.hasOwn(task.payload ?? {}, "javaRuntimeId") ? task.payload.javaRuntimeId : stored.javaRuntimeId ?? null;
  const metadata = { ...stored, executionMode: "native", coreType: stored.coreType ?? "Vanilla", launch: stored.launch ?? { kind: "jar", path: "server.jar" }, javaRuntimeId };
  if (!(await host.readSafeFile(join(directory, "eula.txt"), "utf8")).split(/\r?\n/u).some(line => /^eula\s*=\s*true\s*$/u.test(line))) throw new Error("实例未记录有效 EULA 同意。");
  const properties = await host.readSafeFile(join(directory, "server.properties"), "utf8").catch(error => { if (error.code !== "ENOENT") throw error; return ""; });
  let port = Number(properties.match(/^server-port\s*=\s*(\d+)\s*$/mu)?.[1] ?? metadata.properties?.serverPort ?? task.payload?.serverPort);
  if (metadata.coreType === "Velocity") port = Number((await host.readSafeFile(join(directory, "velocity.toml"), "utf8")).match(/^bind\s*=\s*"[^"\n]*:(\d+)"/mu)?.[1]);
  if (metadata.coreType === "BungeeCord") port = Number((await host.readSafeFile(join(directory, "config.yml"), "utf8")).match(/^\s*-?\s*host:\s*[^\n]*:(\d+)\s*$/mu)?.[1]);
  const udp = ["Nukkit", "PocketMine"].includes(metadata.coreType);
  await mkdir(join(directory, "tmp"), { recursive: true });
  let runtime;
  if (metadata.launch.kind === "php") {
    const php = metadata.phpRuntime;
    if (!php || typeof php.executable !== "string" || !php.executable.startsWith(resolve(host.phpDirectory) + (process.platform === "win32" ? "\\" : "/"))) throw new Error("PHP 运行环境不属于节点受管理目录。");
    await host.assertSafeFileTarget(php.executable, false); runtime = php;
  } else runtime = await host.java(metadata.javaMajor, javaRuntimeId, (p, text) => host.progress(task.id, Math.min(80, p), text));
  // 环境下载/扫描可能耗时；靠近实际启动再次核实端口，避免使用环境准备前的过期观测。
  await assertMinecraftPortAvailable(port, udp);
  const args = buildMinecraftNativeArguments(metadata);
  await host.assertSafeFileTarget(resolve(directory, metadata.launch.path), false);
  const timeout = Number(task.payload?.readyTimeoutSeconds), stopTimeoutSeconds = Number(task.payload?.stopTimeoutSeconds);
  if (!Number.isInteger(timeout) || timeout < 10 || timeout > 900 || !Number.isInteger(stopTimeoutSeconds) || stopTimeoutSeconds < 5 || stopTimeoutSeconds > 300) throw new Error("任务缺少有效就绪/停服配置。");
  const installTimeout = Number(task.payload?.installTimeoutSeconds);
  if (task.payload?.operation === "provision" && (!Number.isInteger(installTimeout) || installTimeout < 30 || installTimeout > 7200)) throw new Error("自动部署缺少安装时限配置。");
  await host.assertSafeFileTarget(join(directory, "lfaa-instance.json"));
  await writeFile(join(directory, "lfaa-instance.json"), JSON.stringify(metadata, null, 2));
  const child = spawn(runtime.executable, args, { cwd: directory, env: minecraftNativeEnvironment(directory, runtime), shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const record = { child, javaMajor: metadata.javaMajor, javaRuntimeId, stopTimeoutSeconds, startedAt: Date.now(), taskId: task.id, sandboxReady: false, serverReady: false, executionMode: "native", coreType: metadata.coreType };
  host.activeServers.set(id, record);
  child.stdin.on("error", () => {});
  host.attachOutput(id, child, task.id, { coreType: metadata.coreType, onFailureLine: line => { if (!record.serverReady && /Caused by:|^(?:Exception in thread|Error:|Fatal error:)/u.test(line)) record.startupError = line.replace(/^\s*Caused by:\s*/u, "").slice(0, 160); }, onServerReady: () => { record.serverReady = true; record.onReady?.(); } });
  // PID 立即持久化；控制端/Daemon 中断时可发现未知进程，不等待就绪后才记录。
  const waiting = waitForNativeMinecraftReady(child, record, task.payload?.operation === "provision" ? Math.max(timeout, installTimeout) : timeout);
  waiting.catch(() => {});
  try {
    if (Number.isInteger(child.pid)) await writeFile(marker, JSON.stringify({ pid: child.pid, instanceId: id, executionMode: "native", startedAt: new Date().toISOString() }), { flag: "wx" });
    await waiting;
    if (!udp) await new Promise((resolvePromise, reject) => { const socket = createConnection({ host: "127.0.0.1", port }); socket.setTimeout(5000); socket.once("connect", () => { socket.destroy(); resolvePromise(); }); socket.once("error", error => { socket.destroy(); reject(error); }); socket.once("timeout", () => { socket.destroy(); reject(new Error("核心就绪日志后无法连接本机监听端口。")); }); });
  } catch (error) { await terminateProcessTree(child); await host.waitForExit(child, 10_000); throw error; }
  await host.progress(task.id, 98, `${metadata.coreType} 已报告服务就绪；公网连接尚未测量。`);
  return { processStarted: true, serverReady: true, locallyListening: udp ? null : true, externallyReachable: null, serverPort: port, executionMode: "native", evidence: `${metadata.coreType} 真实就绪日志${udp ? "" : "与本机端口连接"}`, javaMajor: metadata.javaMajor };
}
/** 恢复时只接受与本次配置逐字相同的普通文件，不覆盖用户修改或链接。 */
export async function writeMinecraftOwnedConfiguration(path, content, resume = false) {
  const info = await lstat(path).catch(error => { if (error.code !== "ENOENT") throw error; return null; });
  if (info) {
    if (!resume || !info.isFile() || info.isSymbolicLink() || info.nlink > 1 || await readFile(path, "utf8") !== content) throw new Error("配置文件已有不同内容或不属于本次恢复，拒绝覆盖。");
    return;
  }
  await writeFile(path, content, { flag: "wx" });
}
function coreArtifactPath(artifact) {
  return artifact.launchKind === "php" ? "PocketMine-MP.phar" : artifact.launchKind === "forge" ? "installer.jar" : ["sponge-forge", "sponge-neo"].includes(artifact.launchKind) ? "mods/sponge.jar" : "server.jar";
}
async function writeCoreConfiguration(core, directory, payload) {
  const port = payload.properties?.serverPort;
  if (!Number.isInteger(port)) throw new Error("任务缺少端口配置。");
  if (core === "Velocity") {
    const backend = payload.proxyBackend;
    if (!backend || !/^127\.0\.0\.1:\d{4,5}$/u.test(backend.address)) throw new Error("代理缺少已验证的后端实例。");
    // 保持代理端正版验证；不偷偷修改后端安全配置。转发方式须按实际后端配置继续管理。
    await writeMinecraftOwnedConfiguration(join(directory, "velocity.toml"), `config-version = "2.7"\nbind = "0.0.0.0:${port}"\nonline-mode = true\nplayer-info-forwarding-mode = "none"\n[servers]\nbackend = "${backend.address}"\ntry = ["backend"]\n[forced-hosts]\n`, payload.resume);
  } else if (core === "BungeeCord") {
    const backend = payload.proxyBackend;
    if (!backend || !/^127\.0\.0\.1:\d{4,5}$/u.test(backend.address)) throw new Error("代理缺少已验证的后端实例。");
    await writeMinecraftOwnedConfiguration(join(directory, "config.yml"), `online_mode: true\nip_forward: false\nservers:\n  backend:\n    address: ${backend.address}\n    restricted: false\nlisteners:\n- host: 0.0.0.0:${port}\n  priorities: [backend]\n  query_enabled: false\n  force_default_server: true\n`, payload.resume);
  } else {
    await writeMinecraftOwnedConfiguration(join(directory, "server.properties"), `server-port=${port}\n${core === "PocketMine" || core === "Nukkit" ? "" : "online-mode=true\n"}`, payload.resume);
  }
}
export async function provisionMinecraftCore(task, host) {
  const payload = task.payload, artifact = payload?.artifact;
  if (!artifact || payload.eulaAccepted !== true || payload.executionMode !== "native") throw new Error("自动开服任务缺少可信工件、EULA 或执行边界。");
  validateCoreArtifactDownload(artifact);
  if (!["jar", "forge", "sponge-forge", "sponge-neo", "php"].includes(artifact.launchKind)) throw new Error("核心安装协议未登记。");
  const report = (progress, message) => host.progress(task.id, progress, message);
  const directory = await host.createDirectory(task.instanceId, payload.instanceName, payload.storageDirectory);
  const ownershipPath = join(directory, "lfaa-provision.json");
  const ownership = { instanceId: task.instanceId, deploymentId: task.deploymentId, digest: artifact.digest, core: artifact.core, version: artifact.version, build: artifact.build };
  if ((await readdir(directory)).length) {
    if (payload.resume !== true) throw new Error("自动部署目录已有内容，拒绝覆盖或自动重放；请核查已有文件。");
    await host.assertSafeFileTarget(ownershipPath, false);
    const previous = JSON.parse(await readFile(ownershipPath, "utf8"));
    if (JSON.stringify(previous) !== JSON.stringify(ownership)) throw new Error("恢复目录不属于本次部署或工件已改变，拒绝覆盖。");
    const processPath = join(directory, "daemon-process.json");
    if (await host.safeFileExists(processPath)) {
      const marker = JSON.parse(await host.readSafeFile(processPath, "utf8"));
      if (!Number.isInteger(marker.pid) || host.isProcessRunning(marker.pid)) throw new Error("目录存在未确认的进程标记，请先核查真实进程，不能重复安装。");
      await rm(processPath);
    }
    const instancePath = join(directory, "lfaa-instance.json");
    if (await host.safeFileExists(instancePath)) {
      const saved = JSON.parse(await host.readSafeFile(instancePath, "utf8"));
      if (saved.instanceId !== task.instanceId || saved.deploymentId !== task.deploymentId || saved.coreType !== artifact.core || saved.coreBuild !== artifact.build || saved.executionMode !== "native") throw new Error("恢复实例元数据与部署不符。");
      if (await hashFile(join(directory, coreArtifactPath(artifact)), artifact.algorithm) !== artifact.digest.toLowerCase()) throw new Error("已有核心工件摘要改变，拒绝恢复。");
      return host.start(task);
    }
  } else await writeFile(ownershipPath, JSON.stringify(ownership), { flag: "wx" });
  const marker = join(directory, "daemon-installing.json");
  await writeFile(marker, JSON.stringify({ taskId: task.id, instanceId: task.instanceId, instanceName: payload.instanceName }), { flag: "wx" });
  try {
    await mkdir(join(directory, "tmp"), { recursive: true });
    await report(10, `正在准备 ${artifact.launchKind === "php" ? "PocketMine PHP" : `Java ${artifact.javaMajor}`} 运行环境。`);
    let runtime;
    if (artifact.launchKind === "php") {
      if (!artifact.phpArtifact) throw new Error("PocketMine 缺少官方 Windows PHP 工件。");
      const phpRoot = resolve(host.phpDirectory, artifact.phpArtifact.digest);
      await host.assertSafeDirectory(phpRoot);
      const archive = join(phpRoot, "php.zip");
      await installArtifact(artifact.phpArtifact, archive, task, report);
      const php = await host.findExecutable(phpRoot, "php.exe");
      if (!php) await host.expandZip(archive, phpRoot);
      const executable = await host.findExecutable(phpRoot, "php.exe");
      if (!executable) throw new Error("PocketMine PHP 工件未包含 php.exe。");
      const probe = startCommand({ executable, args: ["-m"], cwd: directory, env: minecraftNativeEnvironment(directory, { executable, kind: "php" }), timeoutSeconds: payload.installTimeoutSeconds });
      const checked = await probe.done;
      if (checked.exitCode !== 0 || !/pmmpthread/iu.test(checked.stdout)) throw new Error("PHP 未通过 PocketMine 扩展校验。");
      runtime = { executable, root: phpRoot, kind: "php" };
    } else runtime = await host.java(artifact.javaMajor, payload.javaRuntimeId ?? null, (p, message) => report(Math.min(30, p), message));
    await report(35, `正在下载并校验 ${artifact.core} ${artifact.version} / ${artifact.build}。`);
    const isSponge = ["sponge-forge", "sponge-neo"].includes(artifact.launchKind);
    if (isSponge) await mkdir(join(directory, "mods"), { recursive: true });
    const name = coreArtifactPath(artifact);
    await installArtifact(artifact, join(directory, name), task, report);
    let launch = { kind: artifact.launchKind === "php" ? "php" : "jar", path: name };
    if (artifact.launchKind === "forge" || isSponge) {
      await report(55, "正在安装加载器和依赖库，真实安装输出可在实例日志查看。");
      let installerPath = join(directory, "installer.jar");
      if (isSponge) { if (!artifact.loaderArtifact) throw new Error("Sponge 缺少匹配加载器。"); await installArtifact(artifact.loaderArtifact, installerPath, task, report); }
      await installer(runtime, installerPath, directory, payload.installTimeoutSeconds, host.installerLog(task));
      launch = await forgeLaunch(directory);
    }
    await report(75, "正在写入 EULA、端口和实例启动配置。");
    await writeMinecraftOwnedConfiguration(join(directory, "eula.txt"), "# 用户已在 LFAA 开服表单明确同意。\neula=true\n", payload.resume);
    await writeCoreConfiguration(artifact.core, directory, payload);
    const metadata = { instanceId: task.instanceId, instanceName: payload.instanceName, releaseId: artifact.version, javaMajor: artifact.javaMajor, javaRuntimeId: payload.javaRuntimeId ?? null, memoryMb: payload.memoryMb, coreType: artifact.core, coreBuild: artifact.build, executionMode: "native", deploymentId: task.deploymentId, launch, phpRuntime: artifact.launchKind === "php" ? runtime : undefined, properties: payload.properties, language: payload.language };
    await writeMinecraftOwnedConfiguration(join(directory, "lfaa-deployment.json"), JSON.stringify({ deploymentId: task.deploymentId, name: payload.instanceName, releaseId: artifact.version, serverType: artifact.core, coreBuild: artifact.build, artifactName: name, javaMajor: artifact.javaMajor }), payload.resume);
    // 最后提交启动元数据；缺少此文件代表配置阶段尚未完成。
    await writeMinecraftOwnedConfiguration(join(directory, "lfaa-instance.json"), JSON.stringify(metadata, null, 2), payload.resume);
    await rm(marker);
    await report(85, "正在启动并等待核心报告服务就绪。");
    const result = await host.start(task);
    if (result.serverReady !== true) throw new Error("核心启动未提供服务就绪证据。");
    return { ...result, coreType: artifact.core, coreBuild: artifact.build, executionMode: "native", properties: payload.properties };
  } finally { await rm(marker, { force: true }); }
}

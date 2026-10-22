/** 功能：回归桌面服务 IPC 停机。作用：使用独立 Node 子进程证明请求到达后才退出，并覆盖超时和异常。关联文件：src/service-shutdown.mjs、src/main.mjs。 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once, EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requestServiceShutdown } from "../src/service-shutdown.mjs";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, "../../..");
const cliDirectory = join(repositoryRoot, "apps", "cli");
const temporaryRoot = join(repositoryRoot, "dist", ".tmp");

async function reserveLoopbackPort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const { port } = address;
  await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  return port;
}

async function waitForControlPlane(child, port, readLogs) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`隔离 Control Plane 提前退出：${readLogs()}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(500) });
      const health = await response.json();
      if (response.ok && health?.status === "ok" && health?.service === "lfaa-server") return;
    } catch {
      // Control Plane 正在加载隔离配置与 Owner 时暂时无法连接。
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
  }
  throw new Error(`等待隔离 Control Plane 健康检查超时：${readLogs()}`);
}

async function assertPortCanBeRebound(port) {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListen);
  });
  await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
}

test("真实 Node 服务接收 Harness IPC 并完成收尾后，桌面才确认退出", async () => {
  const child = spawn(process.execPath, ["-e", `process.on('message', message => {
    if (message.type === 'lfaa-shutdown') setTimeout(() => { process.disconnect(); process.exitCode = 0; }, 30);
  }); process.send('ready');`], { windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"] });
  try {
    await once(child, "message");
    assert.equal(await requestServiceShutdown(child, 5_000), true);
    assert.equal(child.exitCode, 0);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill(); }
});

test("超时、断开的 IPC 和非零退出不触发强杀，不报告安全停机", async () => {
  const child = Object.assign(new EventEmitter(), { connected: true, exitCode: null, signalCode: null, send() {}, kill() { throw new Error("不得强杀"); } });
  assert.equal(await requestServiceShutdown(child, 5), false);
  assert.equal(child.listenerCount("exit"), 0); assert.equal(child.listenerCount("error"), 0);
  child.connected = false; assert.equal(await requestServiceShutdown(child, 5), false);
  child.exitCode = 1; assert.equal(await requestServiceShutdown(child, 5), false);
  child.exitCode = 0; assert.equal(await requestServiceShutdown(child, 5), true);
});

test("桌面 shutdown IPC 等待真实隔离 Control Plane 释放并退出", { timeout: 90_000 }, async () => {
  let home;
  let data;
  let child;
  let exit;
  let logs = "";
  const appendLog = chunk => { logs = `${logs}${String(chunk)}`.slice(-16_000); };
  let port;

  try {
    await mkdir(temporaryRoot, { recursive: true });
    home = await mkdtemp(join(temporaryRoot, "lfaa-desktop-shutdown-home-"));
    data = await mkdtemp(join(temporaryRoot, "lfaa-desktop-shutdown-data-"));
    port = await reserveLoopbackPort();
    const environment = {
      ...process.env,
      NODE_ENV: "test",
      LFAA_HOME: home,
      LFAA_HARNESS_HOME: home,
      LFAA_DATA_DIR: data,
      LFAA_DATA_DIR_CONFIGURED: "1",
      JWT_SECRET: "",
      LOG_LEVEL: "error",
      SERVER_HOST: "127.0.0.1",
      SERVER_PORT: String(port)
    };
    delete environment.LFAA_DATA_DIR_MANAGED_BY_DESKTOP;
    delete environment.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER;
    child = spawn(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "src/index.ts", "web"], {
      cwd: cliDirectory,
      env: environment,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe", "ipc"]
    });
    child.stdout.setEncoding("utf8").on("data", appendLog);
    child.stderr.setEncoding("utf8").on("data", appendLog);
    exit = once(child, "exit").then(([code, signal]) => ({ code, signal }), error => ({ error }));
    await once(child, "spawn");
    await waitForControlPlane(child, port, () => logs);
    assert.equal(await requestServiceShutdown(child, 30_000), true, logs);
    const outcome = await exit;
    assert.equal(outcome.error, undefined, logs);
    assert.equal(outcome.code, 0, logs);
    assert.equal(outcome.signal, null);
    await assertPortCanBeRebound(port);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const graceful = await requestServiceShutdown(child, 1_000).catch(() => false);
      if (!graceful && child.exitCode === null && child.signalCode === null) child.kill();
      if (exit) await Promise.race([exit, new Promise(resolveDelay => setTimeout(resolveDelay, 5_000))]);
    }
    if (home) {
      if (dirname(resolve(home)) !== temporaryRoot) throw new Error("拒绝清理测试根以外的 Home 路径。");
      await rm(home, { recursive: true, force: true });
    }
    if (data) {
      if (dirname(resolve(data)) !== temporaryRoot) throw new Error("拒绝清理测试根以外的 Data 路径。");
      await rm(data, { recursive: true, force: true });
    }
  }
});

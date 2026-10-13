/**
 * 功能：验收正式编译后的 Web 启动入口。
 * 作用：独立端口/数据目录启动真实 CLI，无本机 Daemon；核验健康、前端、认证和新增设置后正常退出。
 * 关联文件：apps/cli/bin/lfaa.mjs、build-harness.mjs、runtime-build-state.mjs；先执行 pnpm run build。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
test("正式编译 Web 入口健康、前端、认证与新增设置可用并正常退出", { timeout: 60000 }, async () => {
  assert.ok(existsSync(join(root, "dist/apps/control-plane/index.js")), "先运行 pnpm run build");
  const temporaryRoot = resolve(root, "dist/.tmp");
  mkdirSync(temporaryRoot, { recursive: true });
  const directory = mkdtempSync(join(temporaryRoot, "lfaa-compiled-web-"));
  const inside = relative(temporaryRoot, directory);
  assert.ok(inside && inside !== ".." && !inside.startsWith(`..${sep}`), "隔离目录必须在当前仓库 dist/.tmp 内");
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [join(root, "apps/cli/bin/lfaa.mjs"), "web", "--no-local-daemon"], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: { ...process.env, NODE_ENV: "production", LFAA_DATA_DIR: join(directory, "data"), LFAA_HOME: join(directory, "home"), SERVER_HOST: "127.0.0.1", SERVER_PORT: String(port), LFAA_LOCAL_MODE: "true", JWT_SECRET: "compiled-fixture-only-not-a-user-secret-20261009" }
  });
  let output = "", exited = false;
  child.stdout.on("data", bytes => { output = (output + bytes.toString()).slice(-32768); });
  child.stderr.on("data", bytes => { output = (output + bytes.toString()).slice(-32768); });
  const exit = once(child, "exit").then(([code, signal]) => { exited = true; return { code, signal }; });
  try {
    let healthy = false;
    for (let attempt = 0; attempt < 200 && !exited; attempt++) {
      try { healthy = (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) })).ok; } catch { /* 独立服务仍在启动。 */ }
      if (healthy) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(healthy, `编译后的 Web 未就绪：${output}`);
    if (process.platform === "win32") assert.match(output, /本机 Windows 电脑操控适配器已登记 9 项工具/u);
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<html/u);
    assert.equal((await fetch(`${base}/api/settings`)).status, 401);
    const setup = await fetch(`${base}/api/auth/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "compiled-fixture", password: "Compiled-fixture-password-93!" }) });
    assert.equal(setup.status, 201);
    const cookie = setup.headers.get("set-cookie").split(";")[0];
    const response = await fetch(`${base}/api/settings`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    const { settings } = await response.json();
    assert.equal(settings.aiRuntime.requestRetries, 1);
    assert.equal(settings.aiRuntime.retryDelaySeconds, 1);
    assert.equal(settings.computerControl.enabled, false);
    assert.equal(settings.aiRuntime.maxModelRequests, 0);
    assert.equal(settings.aiRuntime.maxToolCalls, 0);
    assert.equal(settings.aiRuntime.autoCompaction, true);
    assert.equal(settings.aiRuntime.contextWindowTokens, 32768);
    assert.deepEqual(settings.plugins.skillDirectories, []);
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
    const skillDirectories = [join(directory, "skills")];
    const savedPlugins = await fetch(`${base}/api/settings/plugins`, { method: "PUT", headers, body: JSON.stringify({ ...settings.plugins, skillDirectories }) });
    assert.equal(savedPlugins.status, 200);
    const savedRuntime = await fetch(`${base}/api/settings/ai-runtime`, { method: "PUT", headers, body: JSON.stringify({ ...settings.aiRuntime, autoCompaction: false, contextWindowTokens: 16384 }) });
    assert.equal(savedRuntime.status, 200);
    const persisted = (await (await fetch(`${base}/api/settings`, { headers })).json()).settings;
    assert.deepEqual(persisted.plugins.skillDirectories, skillDirectories);
    assert.equal(persisted.aiRuntime.autoCompaction, false);
    assert.equal(persisted.aiRuntime.contextWindowTokens, 16384);
    child.send({ type: "lfaa-shutdown" });
    let shutdownTimer;
    let stopped;
    try {
      stopped = await Promise.race([exit, new Promise((_, reject) => { shutdownTimer = setTimeout(() => reject(new Error("独立 Web 未正常退出")), 10000); shutdownTimer.unref(); })]);
    } finally { clearTimeout(shutdownTimer); }
    assert.equal(stopped.code, 0, output);
  } finally {
    if (!exited) { child.kill(); await exit; }
    rmSync(directory, { recursive: true, force: true });
  }
});

/**
 * 功能：回归源码 Web 启动时 Canvas 读取业务 Data 根的真实入口。
 * 作用：在隔离 Home 且未设置 LFAA_DATA_DIR 的情况下启动源码 CLI、创建隔离账户与画布，再确认首页列表可读。
 * 关联文件：apps/cli/bin/lfaa.mjs、packages/canvas/canvas、api-canvas-controller；输出仅写根 dist/.tmp。
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

test("源码 Web CLI 未显式设置 LFAA_DATA_DIR 时仍可读取并创建真实画布项目", { timeout: 90000 }, async () => {
  assert.ok(existsSync(join(root, "dist/apps/control-plane/packages/boot/app-boot/src/index.js")), "先运行 pnpm run build:control-plane");
  assert.ok(existsSync(join(root, "dist/apps/web/index.html")), "先运行 pnpm run build:web");
  const temporaryRoot = resolve(root, "dist/.tmp");
  mkdirSync(temporaryRoot, { recursive: true });
  const directory = mkdtempSync(join(temporaryRoot, "lfaa-source-canvas-data-"));
  const inside = relative(temporaryRoot, directory);
  assert.ok(inside && inside !== ".." && !inside.startsWith(`..${sep}`), "隔离目录必须在当前仓库 dist/.tmp 内");

  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((resolveClose, reject) => reservation.close(error => error ? reject(error) : resolveClose()));
  const base = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    NODE_ENV: "production",
    LFAA_HOME: join(directory, "home"),
    SERVER_HOST: "127.0.0.1",
    SERVER_PORT: String(port),
    LFAA_LOCAL_MODE: "true",
    JWT_SECRET: "source-canvas-fixture-secret-not-a-user-secret-20261025"
  };
  delete env.LFAA_DATA_DIR;
  delete env.LFAA_DATA_DIR_CONFIGURED;
  delete env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER;
  delete env.LFAA_DATA_DIR_MANAGED_BY_DESKTOP;

  const child = spawn(process.execPath, [
    "--import", "tsx/esm",
    "--import", "./apps/cli/register-package-loader.mjs",
    "./apps/cli/src/bin.ts", "web", "--no-local-daemon"
  ], {
    cwd: root,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    env
  });
  let output = "";
  let exited = false;
  child.stdout.on("data", bytes => { output = (output + bytes.toString()).slice(-32768); });
  child.stderr.on("data", bytes => { output = (output + bytes.toString()).slice(-32768); });
  const exit = once(child, "exit").then(([code, signal]) => { exited = true; return { code, signal }; });

  try {
    let healthy = false;
    for (let attempt = 0; attempt < 300 && !exited; attempt += 1) {
      try { healthy = (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) })).ok; }
      catch { /* 隔离服务仍在启动。 */ }
      if (healthy) break;
      await new Promise(resolveWait => setTimeout(resolveWait, 100));
    }
    assert.ok(healthy, `源码 Web 未就绪：${output}`);

    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "123456" })
    });
    assert.equal(login.status, 200, await login.text());
    const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
    assert.ok(cookie, "隔离默认管理员登录应返回本地会话 Cookie");
    const headers = { Cookie: cookie, "Content-Type": "application/json" };

    const created = await fetch(`${base}/api/apps/workspace/canvas/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "源码启动画布回归" })
    });
    assert.equal(created.status, 201, await created.clone().text());
    const { project } = await created.json();
    assert.equal(project.applicationId, "workspace");

    const listed = await fetch(`${base}/api/canvas/projects`, { headers: { Cookie: cookie } });
    assert.equal(listed.status, 200, await listed.clone().text());
    const body = await listed.json();
    assert.equal(body.projects.length, 1);
    assert.equal(body.projects[0].id, project.id);
    assert.equal(body.projects[0].title, "源码启动画布回归");

    child.send({ type: "lfaa-shutdown" });
    let shutdownTimer;
    let stopped;
    try {
      stopped = await Promise.race([
        exit,
        new Promise((_, reject) => { shutdownTimer = setTimeout(() => reject(new Error("隔离源码 Web 未正常退出")), 10000); shutdownTimer.unref(); })
      ]);
    } finally { clearTimeout(shutdownTimer); }
    assert.equal(stopped.code, 0, output);
  } finally {
    if (!exited) { child.kill(); await exit; }
    rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  }
});

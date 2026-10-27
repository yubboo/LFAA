/** 功能：回归 Minecraft 管理页的本机快速路径。作用：普通管理页不请求外部目录，部署目录按账户缓存并可手动刷新。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceSource = readFileSync(new URL("../../../packages/client/ui-minecraft/src/MinecraftWorkspace.tsx", import.meta.url), "utf8");
const deploymentSource = readFileSync(new URL("../../../packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx", import.meta.url), "utf8");

test("Minecraft 再次进入按账户先恢复最近完整快照", () => {
  assert.match(workspaceSource, /const snapshotKey = `\$\{userId\}\\u001f\$\{role\}`/u);
  assert.match(workspaceSource, /minecraftWorkspaceSnapshots\.get\(snapshotKey\)/u);
  assert.match(workspaceSource, /useState\(\(\) => cachedSnapshot === null\)/u);
  assert.match(workspaceSource, /minecraftWorkspaceSnapshots\.set\(snapshotKey,/u);
  assert.match(workspaceSource, /<MinecraftWorkspaceView key=\{`\$\{props\.userId\}\\u001f\$\{props\.role\}`\}/u);
  assert.match(workspaceSource, /MINECRAFT_SNAPSHOT_FRESHNESS_MS = 30_000/u);
  assert.match(workspaceSource, /createReadPoller\(readSnapshot, \(\) => realtimeStatusRef\.current === "connected"/u);
  assert.match(workspaceSource, /initialSnapshotReadScheduled\.current = initialDelayMs === 0/u);
  assert.match(workspaceSource, /snapshotAgeMs >= MINECRAFT_SNAPSHOT_FRESHNESS_MS/u);
  assert.match(workspaceSource, /lastSnapshotReadAt\.current = Date\.now\(\)/u);
  assert.match(workspaceSource, /const criticalRequests = Promise\.allSettled\(\[overviewRequest, nodesRequest, instancesRequest\]\)/u);
  assert.match(workspaceSource, /MINECRAFT_LOG_RECONCILE_INTERVAL_MS = 20_000/u);
  assert.doesNotMatch(workspaceSource, /loadMinecraftReleases\(/u, "普通总览不能请求 Mojang 官方目录");
  assert.match(deploymentSource, /coreCatalogCache\.get\(userId\)/u);
  assert.match(deploymentSource, /coreCatalogCache\.set\(userId,value\)/u);
  assert.match(deploymentSource, /coreBuildCache\.get\(cacheKey\)/u);
  assert.match(deploymentSource, /coreBuildCache\.set\(cacheKey,value\)/u);
  assert.match(deploymentSource, /step<1\|\|!nodeId/u, "运行环境和核心要求应等用户进入部署配置步骤后再核对");
  assert.match(deploymentSource, /provisionMinecraftServer\(/u, "真实服务器文件仍只由显式部署提交下载");
});

test("Minecraft 概览不等待 Mojang 目录，最新版本未知时返回 null", { timeout: 30_000 }, async t => {
  const temporaryParent = resolve(dirname(fileURLToPath(import.meta.url)), "../../../dist/.tmp");
  mkdirSync(temporaryParent, { recursive: true });
  const data = mkdtempSync(join(temporaryParent, "lfaa-minecraft-overview-"));
  process.env.LFAA_DATA_DIR = data;
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "";
  process.env.LFAA_HARNESS_HOME = "";
  process.env.LFAA_LOCAL_MODE = "true";
  process.env.SERVER_HOST = "127.0.0.1";
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  process.env.SERVER_PORT = String(reservation.address().port);
  await new Promise(resolveClose => reservation.close(resolveClose));

  const { boot } = await import("lfaa-app-boot/src/index.js");
  const context = await boot(["--profile", "web"]);
  const base = `http://127.0.0.1:${process.env.SERVER_PORT}/api`;
  const baseOrigin = new URL(base).origin;
  try {
    const setup = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "123456" })
    });
    assert.equal(setup.status, 200);
    const headers = { Cookie: setup.headers.get("set-cookie").split(";")[0] };

    const originalFetch = globalThis.fetch;
    let externalRequests = 0;
    globalThis.fetch = (input, init) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      if (url.origin === baseOrigin) return originalFetch(input, init);
      if (url.protocol === "https:") externalRequests += 1;
      throw new Error(`概览读取不应请求外部来源：${url.origin}`);
    };
    let response;
    const startedAt = performance.now();
    try {
      response = await fetch(`${base}/minecraft/overview`, { headers });
    } finally {
      globalThis.fetch = originalFetch;
    }
    const durationMs = Math.round(performance.now() - startedAt);

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.overview.latestRelease, null, "真实版本目录尚未加载时应明确表示未知");
    assert.equal(externalRequests, 0, "本机概览不能同步触发 Mojang 目录请求");
    t.diagnostic(`认证后的本机概览在 ${durationMs} ms 返回，外部 HTTPS 请求 ${externalRequests} 次。`);
  } finally {
    await context.fiber.dispose();
    if (dirname(data) !== temporaryParent) throw new Error("拒绝清理测试根以外的路径。");
    rmSync(data, { recursive: true, force: true });
  }
});

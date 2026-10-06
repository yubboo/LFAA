/**
 * 功能：回归验证生产前端的 HTTP 缓存、图标、页面回退与日志级别。
 * 作用：使用根 dist/.tmp 中的合成静态夹具和真实 HTTP 服务，防止重复下载及资源请求误返回 HTML。
 * 关联文件：packages/host/webserver/src/http-delivery.ts、server.ts、apps/web/index.html、apps/web/public/favicon.svg。
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { dirname, basename, join, resolve } from "node:path";
import test from "node:test";
import express from "express";
import { requestLogLevel, serveFrontend } from "lfaa-host-webserver/src/http-delivery.js";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const temporaryParent = resolve(repositoryRoot, "dist/.tmp");
mkdirSync(temporaryParent, { recursive: true });
const frontendDirectory = mkdtempSync(join(temporaryParent, "http-delivery-"));
mkdirSync(join(frontendDirectory, "assets"));
mkdirSync(join(frontendDirectory, "images"));
// 固定文件名与内容仅是隔离测试夹具，不进入产品发布目录。
writeFileSync(join(frontendDirectory, "index.html"), '<!doctype html><title>测试入口</title>');
writeFileSync(join(frontendDirectory, "assets/index-RB-F2s6N.js"), 'console.log("测试夹具");');
writeFileSync(join(frontendDirectory, "assets/render-BZ6UBXiy.css"), 'body { margin: 0; }');
writeFileSync(join(frontendDirectory, "images/background.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>');
writeFileSync(join(frontendDirectory, "favicon.svg"), readFileSync(join(repositoryRoot, "apps/web/public/favicon.svg")));

const app = express();
app.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
app.get("/api/private", (_request, response) => response.json({ value: "隔离夹具" }));
serveFrontend(app, frontendDirectory, html => `${html}<script>window.__DSH_BOOT__={};</script>`);
app.use((_request, response) => response.status(404).json({ error: "not_found" }));
const server = createServer(app);
await new Promise((ready, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", ready); });
const baseUrl = `http://127.0.0.1:${server.address().port}`;

test.after(async () => {
  await new Promise((done) => server.close(done));
  assert.equal(dirname(resolve(frontendDirectory)), temporaryParent);
  assert.ok(basename(frontendDirectory).startsWith("http-delivery-"));
  rmSync(frontendDirectory, { recursive: true, force: true });
});

test("内容哈希 JS/CSS 可长期复用，带 ETag 的请求返回无正文 304", async () => {
  for (const path of ["/assets/index-RB-F2s6N.js", "/assets/render-BZ6UBXiy.css"]) {
    const initial = await fetch(`${baseUrl}${path}`);
    assert.equal(initial.status, 200);
    assert.equal(initial.headers.get("cache-control"), "public, max-age=31536000, immutable");
    const etag = initial.headers.get("etag");
    assert.ok(etag);
    await initial.text();
    // Node fetch 默认给条件请求补 no-cache，强制服务端发送完整正文；显式使用浏览器缓存过期后的校验语义。
    const revalidated = await fetch(`${baseUrl}${path}`, { headers: { "if-none-match": etag, "cache-control": "max-age=0" } });
    assert.equal(revalidated.status, 304);
    assert.equal(await revalidated.text(), "");
  }
});

test("入口、无哈希图片和图标可校验更新，私有 API 继续禁止缓存", async () => {
  for (const path of ["/", "/settings", "/apps/minecraft/normal", "/index.html", "/images/background.svg", "/favicon.svg"]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "public, no-cache");
    await response.text();
  }
  const response = await fetch(`${baseUrl}/api/private`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  await response.text();
  const injectedRoot = await fetch(`${baseUrl}/`);
  assert.match(await injectedRoot.text(), /window\.__DSH_BOOT__=\{\}/u);
  const injectedIndex = await fetch(`${baseUrl}/index.html`);
  assert.match(await injectedIndex.text(), /window\.__DSH_BOOT__=\{\}/u);
});

test("运行期间替换构建入口后，新页面读取当前哈希资源清单", async () => {
  const replacement = '<!doctype html><title>新构建入口</title><script type="module" src="/assets/index-current.js"></script>';
  writeFileSync(join(frontendDirectory, "index.html"), replacement);
  const response = await fetch(`${baseUrl}/apps/minecraft/normal`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, no-cache");
  const body = await response.text();
  assert.match(body, /新构建入口/u);
  assert.match(body, /\/assets\/index-current\.js/u);
  assert.match(body, /window\.__DSH_BOOT__=\{\}/u);
});

test("显式图标和默认图标地址都不会返回 HTML", async () => {
  const icon = await fetch(`${baseUrl}/favicon.svg`);
  assert.match(icon.headers.get("content-type"), /image\/svg\+xml/u);
  assert.match(await icon.text(), /<svg/u);
  const legacy = await fetch(`${baseUrl}/favicon.ico`, { redirect: "manual" });
  assert.equal(legacy.status, 308);
  assert.equal(legacy.headers.get("location"), "/favicon.svg");
  assert.match(readFileSync(join(repositoryRoot, "apps/web/index.html"), "utf8"), /rel="icon"[^>]+href="\/favicon.svg"/u);
});

test("缺失静态资源和保留路径返回真实 404，即使客户端接受 HTML", async () => {
  for (const path of ["/assets/missing.js", "/images/missing", "/backgrounds/missing.jpg", "/missing.svg", "/api/missing", "/socket.io/missing"]) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { accept: "text/html" } });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { error: "not_found" });
  }
});

test("读取明细使用 debug，写入保留 info，所有失败保持可见", () => {
  assert.equal(requestLogLevel("GET", "/assets/index-RB-F2s6N.js", 200), "debug");
  assert.equal(requestLogLevel("GET", "/api/settings", 200), "debug");
  assert.equal(requestLogLevel("POST", "/api/daemon/tasks/claim", 204), "debug");
  for (const path of ["/api/daemon/heartbeat", "/api/daemon/tasks/claim", "/api/daemon/files/tasks/claim", "/api/daemon/steamcmd/tasks/claim", "/api/daemon/ai/host-tasks/claim"]) {
    assert.equal(requestLogLevel("POST", path, 200), "debug", path);
    assert.equal(requestLogLevel("POST", path, 401), "warn", path);
    assert.equal(requestLogLevel("POST", path, 500), "error", path);
  }
  assert.equal(requestLogLevel("PUT", "/api/preferences", 200), "info");
  assert.equal(requestLogLevel("POST", "/api/auth/login", 401), "warn");
  assert.equal(requestLogLevel("GET", "/api/health", 500), "error");
});

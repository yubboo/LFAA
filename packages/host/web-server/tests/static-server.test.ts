// 验证生产静态托管的关键边界：令牌注入、MIME 与缓存、目录穿越、SPA 回退、Range 与只读方法限制。
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { startStaticServer, type StaticServer } from "../src/static-server";

const TOKEN = "test-token-0123456789";
const INDEX_HTML = "<!doctype html><html><head><title>LFAA</title></head><body><div id=\"root\"></div></body></html>";
const SCRIPT_BODY = "console.log(1);\n";

let webRoot = "";
let server: StaticServer;
/** 记录网关被调用的次数，用来确认 /api 请求确实进入网关而不是静态回退。 */
let gatewayCalls = 0;

interface TestResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

/** 用原生 http 发请求：fetch 会规范化 `..`，无法验证穿越防护。 */
function request(path: string, init: { method?: string; headers?: Record<string, string> } = {}): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: "127.0.0.1", port: server.port, path, method: init.method ?? "GET", headers: init.headers ?? {} },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

before(async () => {
  webRoot = await mkdtemp(join(tmpdir(), "lfaa-static-"));
  await mkdir(join(webRoot, "assets"), { recursive: true });
  await writeFile(join(webRoot, "index.html"), INDEX_HTML, "utf8");
  await writeFile(join(webRoot, "assets", "app.js"), SCRIPT_BODY, "utf8");
  await writeFile(join(webRoot, "favicon.svg"), "<svg/>", "utf8");
  server = await startStaticServer({
    webRoot,
    token: TOKEN,
    port: 0,
    gateway: {
      handle: async (req, res) => {
        gatewayCalls += 1;
        if (req.url === "/api/echo") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: true }));
          return true;
        }
        return false;
      },
    },
  });
});

after(async () => {
  await server?.stop();
  if (webRoot) await rm(webRoot, { recursive: true, force: true });
});

test("页面入口注入一次性令牌并禁用缓存", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  assert.match(String(response.headers["content-type"]), /text\/html/u);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.match(response.body, new RegExp(`<meta name="lfaa-api-token" content="${TOKEN}" />`, "u"));
});

test("assets 使用正确 MIME 与长缓存", async () => {
  const response = await request("/assets/app.js");
  assert.equal(response.status, 200);
  assert.match(String(response.headers["content-type"]), /text\/javascript/u);
  assert.match(String(response.headers["cache-control"]), /immutable/u);
  assert.equal(response.body, SCRIPT_BODY);
});

test("目录穿越与非法编码都被拒绝", async () => {
  const escaped = await request("/../package.json");
  assert.equal(escaped.status, 400);
  assert.equal(escaped.body, "请求路径不合法。");

  const encoded = await request("/%2e%2e/package.json");
  assert.equal(encoded.status, 400);
});

test("页面请求回退到 index.html，缺失静态文件仍是 404", async () => {
  const page = await request("/workspace/abc", { headers: { accept: "text/html" } });
  assert.equal(page.status, 200);
  assert.match(page.body, /lfaa-api-token/u);

  const asset = await request("/missing.js", { headers: { accept: "*/*" } });
  assert.equal(asset.status, 404);
});

test("Range 请求返回 206 与正确片段", async () => {
  const response = await request("/assets/app.js", { headers: { range: "bytes=0-3" } });
  assert.equal(response.status, 206);
  assert.equal(response.headers["content-range"], `bytes 0-3/${SCRIPT_BODY.length}`);
  assert.equal(response.body, "cons");
});

test("HEAD 不返回响应体，非 GET/HEAD 返回 405", async () => {
  const head = await request("/assets/app.js", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");

  const post = await request("/assets/app.js", { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, "GET, HEAD");
});

test("接口请求先鉴权，命中网关，未命中返回 JSON 404 而不是 HTML", async () => {
  const unauthorized = await request("/api/echo");
  assert.equal(unauthorized.status, 401);
  assert.match(String(unauthorized.headers["content-type"]), /application\/json/u);

  const allowed = await request("/api/echo", { headers: { "x-lfaa-token": TOKEN } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body, JSON.stringify({ ok: true }));

  const beforeCalls = gatewayCalls;
  const missing = await request("/api/unknown", { headers: { "x-lfaa-token": TOKEN } });
  assert.equal(missing.status, 404);
  assert.match(String(missing.headers["content-type"]), /application\/json/u);
  assert.equal(gatewayCalls, beforeCalls + 1);
});
// 验证 HTTP 抓取实现的协议校验、体积截断与真实请求路径。
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { assertHttpUrl, createHttpWebProvider, readCappedText } from "../src/index";

test("只允许 http/https，拒绝本机文件协议", () => {
  assert.equal(assertHttpUrl("https://example.com/a").hostname, "example.com");
  assert.throws(() => assertHttpUrl("file:///C:/Windows/win.ini"), /只支持 http\/https/u);
  assert.throws(() => assertHttpUrl("ftp://example.com/a"), /只支持 http\/https/u);
});

test("超出字节上限的响应被截断而不是失败", async () => {
  const response = new Response("0123456789");
  const capped = await readCappedText(response, 4);
  assert.equal(capped.text, "0123");
  assert.equal(capped.truncated, true);

  const intact = await readCappedText(new Response("abc"), 16);
  assert.equal(intact.text, "abc");
  assert.equal(intact.truncated, false);
});

test("对本地 HTTP 服务真实抓取，返回状态、正文与最终地址", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/big") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("x".repeat(64));
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<p>你好</p>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const provider = createHttpWebProvider({ maxBytes: 32 });
    const small = await provider.fetchText({ url: `http://127.0.0.1:${port}/` });
    assert.equal(small.status, 200);
    assert.match(small.contentType, /text\/html/u);
    assert.match(small.text, /你好/u);
    assert.equal(small.truncated, false);

    const big = await provider.fetchText({ url: `http://127.0.0.1:${port}/big` });
    assert.equal(big.truncated, true);
    assert.equal(big.text.length, 32);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
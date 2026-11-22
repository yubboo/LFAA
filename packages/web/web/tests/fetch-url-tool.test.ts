// 验证网页工具的安全校验与正文抽取：协议限制、内网拦截、HTML 转文本。
import assert from "node:assert/strict";
import test from "node:test";
import { extractTitle, htmlToText, validateUrl } from "../src/tool/fetch-url-tool";

test("只允许 http/https", () => {
  assert.ok("error" in validateUrl("file:///etc/passwd"));
  assert.ok("error" in validateUrl("javascript:alert(1)"));
  assert.ok("url" in validateUrl("https://example.com/doc"));
});

test("拦截本机与内网地址", () => {
  for (const url of ["http://localhost:5173", "http://127.0.0.1", "http://10.0.0.5", "http://192.168.1.1", "http://169.254.169.254/latest/meta-data"]) {
    assert.ok("error" in validateUrl(url), url);
  }
});

test("HTML 转纯文本与标题提取", () => {
  const html = "<html><head><title>文档</title><style>b{}</style></head><body><h1>标题</h1><p>正文段落</p><script>evil()</script></body></html>";
  const text = htmlToText(html);
  assert.ok(text.includes("正文段落"));
  assert.ok(!text.includes("evil()"));
  assert.ok(!text.includes("<p>"));
  assert.equal(extractTitle(html), "文档");
});
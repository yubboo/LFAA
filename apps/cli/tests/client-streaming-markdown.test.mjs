/**
 * 功能：回归 AI Work 流式 Markdown 的块缓存与真实渲染结构。
 * 作用：验证生成中的正文使用完成态相同的 Markdown 解析，并只更新当前增长块。
 * 关联文件：packages/client/ui-chat/src/AiMarkdown.tsx、streaming-markdown.ts。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createStreamingMarkdownCache, extendStreamingMarkdownCache } from "../../../packages/client/ui-chat/src/streaming-markdown.ts";

test("生成中的正文直接使用与完成态相同的 Markdown 块结构", () => {
  const markup = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
    import { createRequire } from 'node:module';
    const require=createRequire(${JSON.stringify(new URL("../../web/package.json", import.meta.url).href)});
    const {createElement}=require('react');const {renderToStaticMarkup}=require('react-dom/server');
    const {AiStreamingMarkdown}=await import(${JSON.stringify(new URL("../../../packages/client/ui-chat/src/AiMarkdown.tsx", import.meta.url).href)});
    console.log(renderToStaticMarkup(createElement(AiStreamingMarkdown,{content:"第一段内容。\\n\\n## 正在生成\\n\\n- 普通项目\\n- **强调项目**\\n\\n> 真实引用\\n\\n| 项目 | 状态 |\\n| --- | --- |\\n| 回复 | 生成中 |\\n\\n\`\`\`ts\\nconst ready = true;\\n"})));
  `], { cwd: fileURLToPath(new URL("..", import.meta.url)), env: { ...process.env, TSX_TSCONFIG_PATH: fileURLToPath(new URL("../../../tsconfig.client.json", import.meta.url)) }, encoding: "utf8" }).trim();

  assert.match(markup, /<p><span>第一段内容。<\/span><\/p>/u);
  assert.match(markup, /<h2>正在生成<\/h2>/u);
  assert.match(markup, /<ul>[\s\S]*?<strong>强调项目<\/strong>[\s\S]*?<\/ul>/u);
  assert.match(markup, /<blockquote>[\s\S]*?真实引用[\s\S]*?<\/blockquote>/u);
  assert.match(markup, /<table>[\s\S]*?<td>生成中<\/td>[\s\S]*?<\/table>/u);
  assert.match(markup, /<pre[^>]*><code data-language="ts">const ready = true;/u);
  assert.doesNotMatch(markup, /ai-work-chat__streaming-text/u);
});

test("流式 Markdown 只更新当前正文块并复用已完成的 Markdown 块", () => {
  const firstContent = ["第一段内容。", ...Array.from({ length: 33 }, (_, index) => `段落 ${index}`), "", "当前段落"].join("\n\n");
  const first = extendStreamingMarkdownCache(createStreamingMarkdownCache(), firstContent);
  const firstChunk = first.chunks[0];
  const next = extendStreamingMarkdownCache(first, firstContent + " 延续");

  assert.deepEqual(first.chunks.map(chunk => chunk.length), [32, 2]);
  assert.strictEqual(next.chunks[0], firstChunk, "已闭合 Markdown 块的缓存身份保持稳定");
  assert.equal(next.pendingBlockLines.join("\n") + next.pendingLine, "当前段落 延续");
  assert.equal(next.contentLength, firstContent.length + " 延续".length);
});

test("流式 Markdown 保留跨批次 CRLF 与围栏代码内部空行", () => {
  const firstContent = "\r\n说明\r\n\r\n```ts\r\nconst first = 1\r";
  const first = extendStreamingMarkdownCache(createStreamingMarkdownCache(), firstContent);
  const next = extendStreamingMarkdownCache(first, firstContent + "\n\r\nconst second = 2\r\n```\r\n\r\nready");

  assert.deepEqual(next.chunks.flat().map(block => block.content), ["说明", "```ts\nconst first = 1\n\nconst second = 2\n```"]);
  assert.equal(next.pendingLine, "ready");
  assert.deepEqual(next.pendingBlockLines, []);
  assert.equal(next.inCodeFence, false);
});

test("上游流式快照缩短时会清空旧缓存并重新开始", () => {
  const previous = extendStreamingMarkdownCache(createStreamingMarkdownCache(), "first line\nold tail");
  const reset = extendStreamingMarkdownCache(previous, "new");

  assert.equal(reset.contentLength, "new".length);
  assert.equal(reset.blockCount, 0);
  assert.equal(reset.pendingLine, "new");
  assert.deepEqual(reset.chunks, []);
});

test("段落之间的空行提交稳定块，当前段落仍随流持续增长", () => {
  const cache = extendStreamingMarkdownCache(createStreamingMarkdownCache(), "第一段\n\n第二段\n仍在生成");

  assert.equal(cache.chunks[0][0].content, "第一段");
  assert.equal(cache.pendingBlockLines.join("\n"), "第二段");
  assert.equal(cache.pendingLine, "仍在生成");
});

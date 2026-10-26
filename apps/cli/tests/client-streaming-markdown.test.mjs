import assert from "node:assert/strict";
import test from "node:test";
import { createStreamingMarkdownCache, extendStreamingMarkdownCache } from "../../../packages/client/ui-chat/src/streaming-markdown.ts";

test("流式 Markdown 只追加新文本并复用已完成的行块", () => {
  const firstContent = `${Array.from({ length: 65 }, (_, index) => `line ${index}`).join("\n")}\nactive`;
  const first = extendStreamingMarkdownCache(createStreamingMarkdownCache(), firstContent);
  const firstChunk = first.chunks[0];
  const next = extendStreamingMarkdownCache(first, `${firstContent} line`);

  assert.deepEqual(first.chunks.map(chunk => chunk.length), [64, 1]);
  assert.strictEqual(next.chunks[0], firstChunk, "closed line chunks must keep their identity across appends");
  assert.equal(next.pendingLine, "active line");
  assert.equal(next.contentLength, firstContent.length + " line".length);
});

test("流式 Markdown 保留跨批次 CRLF、代码围栏和正文开头空行语义", () => {
  const firstContent = "\r\n```ts\r\nconst value = 1\r";
  const first = extendStreamingMarkdownCache(createStreamingMarkdownCache(), firstContent);
  const next = extendStreamingMarkdownCache(first, firstContent + "\n```\r\nready");

  assert.deepEqual(next.chunks.flat().map(line => [line.text, line.literal]), [
    ["```ts", true],
    ["const value = 1", true],
    ["```", true]
  ]);
  assert.equal(next.pendingLine, "ready");
  assert.equal(next.inCodeFence, false);
});

test("较短的上游快照会清空旧缓存并重新开始", () => {
  const previous = extendStreamingMarkdownCache(createStreamingMarkdownCache(), "old line\nold tail");
  const reset = extendStreamingMarkdownCache(previous, "new");

  assert.equal(reset.contentLength, 3);
  assert.equal(reset.lineCount, 0);
  assert.equal(reset.pendingLine, "new");
  assert.deepEqual(reset.chunks, []);
});

test("同一增量跨多行时，当前行仍会识别行内 Markdown", () => {
  const cache = extendStreamingMarkdownCache(createStreamingMarkdownCache(), "plain line\n**bold**");

  assert.equal(cache.chunks[0][0].text, "plain line");
  assert.equal(cache.chunks[0][0].literal, false);
  assert.equal(cache.pendingLine, "**bold**");
  assert.equal(cache.pendingMayContainInlineSyntax, true);
});

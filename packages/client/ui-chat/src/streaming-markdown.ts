/**
 * 功能：增量整理 AI Work 流式 Markdown 块。
 * 作用：将已结束的正文块提交为稳定缓存，只让当前增长块继续更新。
 * 关联文件：packages/client/ui-chat/src/AiMarkdown.tsx 复用正式 Markdown 渲染器显示这些块。
 */
export interface StreamingMarkdownBlock {
  index: number;
  content: string;
}

export interface StreamingMarkdownCache {
  contentLength: number;
  pendingLine: string;
  pendingBlockLines: string[];
  skipNextLineFeed: boolean;
  inCodeFence: boolean;
  blockCount: number;
  chunks: StreamingMarkdownBlock[][];
}

const STREAMING_BLOCK_CHUNK_SIZE = 32;

export function createStreamingMarkdownCache(): StreamingMarkdownCache {
  return { contentLength: 0, pendingLine: "", pendingBlockLines: [], skipNextLineFeed: false, inCodeFence: false, blockCount: 0, chunks: [] };
}

function appendStreamingBlock(cache: StreamingMarkdownCache): void {
  if (!cache.pendingBlockLines.length) return;
  const block: StreamingMarkdownBlock = { index: cache.blockCount++, content: cache.pendingBlockLines.join("\n") };
  cache.pendingBlockLines = [];
  const lastChunk = cache.chunks.at(-1);
  if (lastChunk && lastChunk.length < STREAMING_BLOCK_CHUNK_SIZE) {
    cache.chunks[cache.chunks.length - 1] = [...lastChunk, block];
  } else cache.chunks.push([block]);
}

function appendStreamingLine(cache: StreamingMarkdownCache): void {
  const text = cache.pendingLine;
  cache.pendingLine = "";
  if (!text.trim() && !cache.inCodeFence) {
    appendStreamingBlock(cache);
    return;
  }
  cache.pendingBlockLines.push(text);
  if (/^\s*```/.test(text)) cache.inCodeFence = !cache.inCodeFence;
}

function appendStreamingText(cache: StreamingMarkdownCache, content: string): void {
  const appended = content.slice(cache.contentLength);
  cache.contentLength = content.length;
  let start = 0;
  if (cache.skipNextLineFeed) {
    cache.skipNextLineFeed = false;
    if (appended.startsWith("\n")) start = 1;
  }
  for (let index = start; index < appended.length; index += 1) {
    const character = appended[index];
    if (character !== "\n" && character !== "\r") continue;
    cache.pendingLine += appended.slice(start, index);
    appendStreamingLine(cache);
    if (character === "\r") {
      if (appended[index + 1] === "\n") index += 1;
      else if (index === appended.length - 1) cache.skipNextLineFeed = true;
    }
    start = index + 1;
  }
  cache.pendingLine += appended.slice(start);
}

/**
 * 只接受同一条流式消息的追加快照；内容缩短时重建缓存。
 */
export function extendStreamingMarkdownCache(previous: StreamingMarkdownCache, content: string): StreamingMarkdownCache {
  const base = content.length < previous.contentLength ? createStreamingMarkdownCache() : previous;
  const cache = { ...base, pendingBlockLines: [...base.pendingBlockLines], chunks: [...base.chunks] };
  appendStreamingText(cache, content);
  return cache;
}

/**
 * 功能：增量整理 AI Work 流式 Markdown 行。
 * 作用：只解析新到达的字符，并按固定大小复用已闭合行，避免每个流式增量重新扫描全文。
 */
export interface StreamingLine {
  index: number;
  text: string;
  literal: boolean;
}

export interface StreamingMarkdownCache {
  contentLength: number;
  pendingLine: string;
  pendingMayContainInlineSyntax: boolean;
  skipNextLineFeed: boolean;
  started: boolean;
  inCodeFence: boolean;
  lineCount: number;
  chunks: StreamingLine[][];
}

const STREAMING_LINE_CHUNK_SIZE = 64;

export function createStreamingMarkdownCache(): StreamingMarkdownCache {
  return { contentLength: 0, pendingLine: "", pendingMayContainInlineSyntax: false, skipNextLineFeed: false, started: false, inCodeFence: false, lineCount: 0, chunks: [] };
}

function appendStreamingLine(cache: StreamingMarkdownCache): void {
  const text = cache.pendingLine;
  cache.pendingLine = "";
  cache.pendingMayContainInlineSyntax = false;
  // 与原流式渲染一致：只跳过正文开头的空白行，后续空行仍保留。
  if (!cache.started && !text.trim()) return;
  cache.started = true;
  const fence = /^\s*```/.test(text);
  const line: StreamingLine = { index: cache.lineCount++, text, literal: cache.inCodeFence || fence };
  if (fence) cache.inCodeFence = !cache.inCodeFence;
  const lastChunk = cache.chunks.at(-1);
  if (lastChunk && lastChunk.length < STREAMING_LINE_CHUNK_SIZE) {
    cache.chunks[cache.chunks.length - 1] = [...lastChunk, line];
  } else cache.chunks.push([line]);
}

function appendStreamingText(cache: StreamingMarkdownCache, content: string): void {
  const appended = content.slice(cache.contentLength);
  cache.contentLength = content.length;
  const appendPendingText = (text: string) => {
    cache.pendingLine += text;
    if (!cache.pendingMayContainInlineSyntax && /[\[`*_~]/.test(text)) cache.pendingMayContainInlineSyntax = true;
  };
  let start = 0;
  if (cache.skipNextLineFeed) {
    cache.skipNextLineFeed = false;
    if (appended.startsWith("\n")) start = 1;
  }
  for (let index = start; index < appended.length; index += 1) {
    const character = appended[index];
    if (character !== "\n" && character !== "\r") continue;
    appendPendingText(appended.slice(start, index));
    appendStreamingLine(cache);
    if (character === "\r") {
      if (appended[index + 1] === "\n") index += 1;
      else if (index === appended.length - 1) cache.skipNextLineFeed = true;
    }
    start = index + 1;
  }
  appendPendingText(appended.slice(start));
}

/**
 * 只支持同一条流式消息的追加内容；完成/中断后渲染器卸载，新消息按 key 创建新缓存。
 * 缩短内容视为上游重置并重建缓存；追加流的前缀与消息 ID 由调用方保证稳定。
 */
export function extendStreamingMarkdownCache(previous: StreamingMarkdownCache, content: string): StreamingMarkdownCache {
  const base = content.length < previous.contentLength ? createStreamingMarkdownCache() : previous;
  const cache = { ...base, chunks: [...base.chunks] };
  appendStreamingText(cache, content);
  return cache;
}

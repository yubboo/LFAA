/**
 * Bilibili public video input Owner: metadata, public captions, sampled storyboard sheets,
 * bounded audio retrieval and Ark Agent Plan transcription. No cookies or disk artifacts.
 */
import type { Context } from "@deepseek-ai/cordis";
import { resolvePublicAddresses } from "lfaa-web-fetch-http/src/network.js";
import { gunzipSync, gzipSync } from "node:zlib";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import WebSocket from "ws";

export const name = "lfaaBilibiliVideo";
export const inject: string[] = [];
const API_HOST = "api.bilibili.com";
const ARK_ASR_URL = "wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_nostream";
export const BILIBILI_MAX_DURATION_SECONDS = 60 * 60;
export const BILIBILI_MAX_AUDIO_BYTES = 96 * 1024 * 1024;
const API_MAX_BYTES = 2 * 1024 * 1024;
const CAPTION_MAX_BYTES = 4 * 1024 * 1024;
const STORYBOARD_MAX_BYTES = 4 * 1024 * 1024;
const MAX_ASR_TRANSCRIPT_CHARS = 24_000;

type JsonRecord = Record<string, unknown>;
export interface BilibiliVideoReference { bvid: string; page: number }
export interface BilibiliCaption { language: string; text: string; segments: Array<{ startSeconds: number; text: string }> }
export interface BilibiliVideoInfo {
  bvid: string; cid: number; page: number; pageCount: number; durationSeconds: number;
  title: string; uploader: string; description: string; canonicalUrl: string; captions: BilibiliCaption[];
}
export interface BilibiliStoryboard { sheetIndex: number; sheetCount: number; mimeType: "image/jpeg"; dataBase64: string; width: number; height: number; timestamps: number[] }
export interface BilibiliTranscript { bvid: string; durationSeconds: number; text: string; utterances: Array<{ startSeconds: number; endSeconds: number; text: string }>; truncated: boolean }
export interface BilibiliVideoService {
  parseUrl(input: string): BilibiliVideoReference;
  readInfo(input: string, signal: AbortSignal): Promise<BilibiliVideoInfo>;
  readStoryboard(input: string, sheetIndex: number, signal: AbortSignal): Promise<BilibiliStoryboard>;
  transcribe(input: string, apiKey: string, userId: string, signal: AbortSignal, onProgress: (detail: string) => void): Promise<BilibiliTranscript>;
}

export function parseBilibiliVideoUrl(input: string): BilibiliVideoReference {
  if (input.length > 2048) throw new Error("Bilibili URL 超过 2048 字符。");
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("请输入完整的 Bilibili 视频链接。"); }
  const rawAuthority = /^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/iu.exec(input)?.[1] ?? "";
  const hostAndPort = rawAuthority.slice(rawAuthority.lastIndexOf("@") + 1);
  if (url.protocol !== "https:" || !["www.bilibili.com", "bilibili.com", "m.bilibili.com"].includes(url.hostname.toLowerCase())
    || url.username || url.password || url.port || hostAndPort.includes(":") || url.hash) throw new Error("只支持 https://www.bilibili.com/video/BV… 公开链接。");
  const match = /^\/video\/(BV[0-9A-Za-z]{10})\/?$/u.exec(url.pathname);
  if (!match) throw new Error("只支持 Bilibili BV 视频链接，不跟随短链或其他站点跳转。");
  const rawPage = url.searchParams.get("p");
  const page = rawPage === null ? 1 : Number(rawPage);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000) throw new Error("视频分 P 编号必须是 1 到 1000 的整数。");
  return { bvid: match[1]!, page };
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}
function safeText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ").slice(0, max) : "";
}
function isAllowedHost(hostname: string, suffixes: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return suffixes.some(suffix => host === suffix || host.endsWith(`.${suffix}`));
}
function allowedHttpsUrl(input: string, hostPolicy: (hostname: string) => boolean): URL {
  if (input.length > 8192) throw new Error("Bilibili 返回的资源地址超过长度上限。");
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Bilibili 返回了无效的资源地址。"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || !hostPolicy(url.hostname)) throw new Error("Bilibili 返回的资源地址不在允许的公开主机范围。");
  return url;
}

async function readCapped(response: Response, maxBytes: number, signal: AbortSignal): Promise<Buffer> {
  if (!response.ok) throw new Error(`Bilibili 资源请求失败（HTTP ${response.status}）。`);
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error(`Bilibili 返回内容超过 ${maxBytes} 字节上限。`);
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error(`Bilibili 返回内容超过 ${maxBytes} 字节上限。`);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), size);
}

async function fetchPublic(
  input: string,
  hostPolicy: (hostname: string) => boolean,
  maxBytes: number,
  signal: AbortSignal,
  options: { accept: string; referer?: string; json?: boolean; timeoutMs?: number }
): Promise<{ url: URL; bytes: Buffer; contentType: string }> {
  let url = allowedHttpsUrl(input, hostPolicy);
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 30_000);
  const requestSignal = AbortSignal.any([signal, timeout]);
  for (let redirects = 0; redirects <= 2; redirects += 1) {
    requestSignal.throwIfAborted();
    await resolvePublicAddresses(url.hostname, requestSignal);
    const response = await fetch(url, { method: "GET", redirect: "manual", signal: requestSignal, headers: {
      accept: options.accept,
      "user-agent": "Mozilla/5.0 (compatible; LFAA video reader)",
      ...(options.referer ? { referer: options.referer } : {})
    } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === 2) throw new Error("公开视频资源重定向次数超过上限。");
      const location = response.headers.get("location");
      if (!location) throw new Error("公开视频资源重定向缺少目标地址。");
      url = allowedHttpsUrl(new URL(location, url).toString(), hostPolicy);
      await response.body?.cancel().catch(() => undefined);
      continue;
    }
    const bytes = await readCapped(response, maxBytes, requestSignal);
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    if (options.json && !["application/json", "text/json", "text/plain"].includes(contentType)) throw new Error("Bilibili API 返回了非 JSON 内容。");
    return { url, bytes, contentType };
  }
  throw new Error("公开视频资源请求未完成。");
}

async function fetchBilibiliJson(url: URL, signal: AbortSignal, maxBytes = API_MAX_BYTES): Promise<JsonRecord> {
  const result = await fetchPublic(url.toString(), hostname => hostname === API_HOST, maxBytes, signal,
    { accept: "application/json", referer: "https://www.bilibili.com/", json: true });
  let parsed: unknown;
  try { parsed = JSON.parse(result.bytes.toString("utf8")) as unknown; } catch { throw new Error("Bilibili API 返回的 JSON 无法解析。"); }
  const root = asRecord(parsed);
  if (!root || root.code !== 0 || !asRecord(root.data)) {
    const message = root ? safeText(root.message, 160) : "响应结构无效";
    throw new Error(`Bilibili API 未返回公开视频数据：${message || "未知错误"}。`);
  }
  return root.data as JsonRecord;
}

function apiUrl(path: string, reference: BilibiliVideoReference, cid?: number): URL {
  const url = new URL(path, "https://api.bilibili.com");
  url.searchParams.set("bvid", reference.bvid);
  if (cid !== undefined) url.searchParams.set("cid", String(cid));
  return url;
}

async function videoMetadata(input: string, signal: AbortSignal): Promise<{ reference: BilibiliVideoReference; info: Omit<BilibiliVideoInfo, "captions"> }> {
  const reference = parseBilibiliVideoUrl(input);
  const data = await fetchBilibiliJson(apiUrl("/x/web-interface/view", reference), signal);
  const pages = Array.isArray(data.pages) ? data.pages.flatMap(item => asRecord(item) ? [asRecord(item)!] : []) : [];
  const pageEntry = pages[reference.page - 1] ?? (reference.page === 1 ? data : null);
  const cid = Number(pageEntry?.cid ?? data.cid);
  const durationSeconds = Number(pageEntry?.duration ?? data.duration);
  if (!Number.isSafeInteger(cid) || cid <= 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error("Bilibili 视频分 P 或时长信息无效。");
  if (reference.page > Math.max(1, pages.length)) throw new Error(`视频只有 ${pages.length} 个分 P，没有第 ${reference.page} P。`);
  const title = safeText(pageEntry?.part || data.title, 300);
  return { reference, info: {
    bvid: reference.bvid, cid, page: reference.page, pageCount: Math.max(1, pages.length), durationSeconds,
    title, uploader: safeText(asRecord(data.owner)?.name, 120), description: safeText(data.desc, 4000),
    canonicalUrl: `https://www.bilibili.com/video/${reference.bvid}/?p=${reference.page}`
  } };
}

async function readCaptions(reference: BilibiliVideoReference, cid: number, signal: AbortSignal): Promise<BilibiliCaption[]> {
  const player = await fetchBilibiliJson(apiUrl("/x/player/v2", reference, cid), signal);
  const subtitle = asRecord(player.subtitle);
  const rawSubtitles = subtitle?.subtitles;
  const subtitles = Array.isArray(rawSubtitles) ? rawSubtitles.slice(0, 4) : [];
  const captions: BilibiliCaption[] = [];
  let remainingGlobal = 24_000;
  for (const raw of subtitles) {
    signal.throwIfAborted();
    const item = asRecord(raw);
    const rawUrl = typeof item?.subtitle_url === "string" ? item.subtitle_url : "";
    if (!rawUrl) continue;
    const url = new URL(rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl);
    const result = await fetchPublic(url.toString(), host => isAllowedHost(host, ["hdslb.com", "bilibili.com"]), CAPTION_MAX_BYTES, signal,
      { accept: "application/json", referer: "https://www.bilibili.com/", json: true });
    let parsed: unknown;
    try { parsed = JSON.parse(result.bytes.toString("utf8")) as unknown; } catch { continue; }
    const body = asRecord(parsed)?.body;
    if (!Array.isArray(body)) continue;
    const segments: BilibiliCaption["segments"] = [];
    let remaining = remainingGlobal;
    for (const rawSegment of body.slice(0, 2000)) {
      const segment = asRecord(rawSegment);
      const text = safeText(segment?.content, Math.min(500, remaining));
      const startSeconds = Number(segment?.from);
      if (!text.trim() || !Number.isFinite(startSeconds) || startSeconds < 0 || remaining <= 0) continue;
      segments.push({ startSeconds, text });
      remaining -= text.length;
    }
    if (segments.length) {
      const caption: BilibiliCaption = { language: safeText(item?.lan_doc || item?.lan, 80) || "公开字幕", text: segments.map(segment => `[${formatTime(segment.startSeconds)}] ${segment.text}`).join("\n"), segments };
      captions.push(caption);
      remainingGlobal = Math.max(0, remainingGlobal - caption.text.length);
    }
  }
  return captions;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function mapStoryboardTimestamps(index: unknown): number[] {
  if (!Array.isArray(index)) return [];
  return index.slice(0, 200).map(value => Number(value)).filter(value => Number.isFinite(value) && value >= 0);
}

export function readJpegDimensions(data: Buffer): { width: number; height: number } {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) throw new Error("Storyboard 不是有效 JPEG 图像。");
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  const scanLimit = Math.min(data.length, 64 * 1024);
  while (offset < scanLimit) {
    if (data[offset] !== 0xff) { offset += 1; continue; }
    while (offset < scanLimit && data[offset] === 0xff) offset += 1;
    if (offset >= scanLimit) break;
    const marker = data[offset++]!;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > scanLimit) break;
    const segmentLength = data.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > scanLimit) throw new Error("Storyboard JPEG 标记长度无效。");
    if (startOfFrame.has(marker)) {
      if (segmentLength < 8) throw new Error("Storyboard JPEG 尺寸段无效。");
      const height = data.readUInt16BE(offset + 3);
      const width = data.readUInt16BE(offset + 5);
      if (width <= 0 || height <= 0) throw new Error("Storyboard JPEG 尺寸无效。");
      return { width, height };
    }
    offset += segmentLength;
  }
  throw new Error("Storyboard JPEG 缺少可读取的尺寸信息。");
}

function splitPcm(data: Buffer, size: number): Buffer[] {
  const chunks: Buffer[] = [];
  const evenLength = data.length - data.length % 2;
  for (let offset = 0; offset < evenLength; offset += size) chunks.push(data.subarray(offset, Math.min(evenLength, offset + size)));
  return chunks;
}

function requestPacket(messageType: number, flags: number, sequence: number, payload: Buffer, compressed: boolean): Buffer {
  const encoded = compressed ? gzipSync(payload) : payload;
  const header = Buffer.from([0x11, (messageType << 4) | flags, compressed ? 0x01 : 0x10, 0x00]);
  const sequenceBytes = Buffer.alloc(4); sequenceBytes.writeInt32BE(flags & 0x02 ? -Math.abs(sequence) : sequence);
  const lengthBytes = Buffer.alloc(4); lengthBytes.writeUInt32BE(encoded.length);
  return Buffer.concat([header, sequenceBytes, lengthBytes, encoded]);
}

export function parseArkAsrResponse(raw: Buffer): { code: number; isLast: boolean; payload: JsonRecord | null } {
  if (raw.length < 4) throw new Error("语音识别服务返回了过短的协议帧。");
  const headerWords = raw[0]! & 0x0f;
  const messageType = raw[1]! >> 4;
  const flags = raw[1]! & 0x0f;
  const serialization = raw[2]! >> 4;
  const compression = raw[2]! & 0x0f;
  let offset = headerWords * 4;
  if (offset > raw.length) throw new Error("语音识别服务返回了无效的协议头。");
  if (flags & 0x01) offset += 4;
  const isLast = Boolean(flags & 0x02);
  if (flags & 0x04) offset += 4;
  let code = 0;
  if (messageType === 0x0f) {
    if (offset + 8 > raw.length) throw new Error("语音识别服务错误帧格式无效。");
    code = raw.readInt32BE(offset); offset += 8;
  } else if (messageType === 0x09) {
    if (offset + 4 > raw.length) throw new Error("语音识别服务响应帧格式无效。");
    offset += 4;
  } else return { code, isLast, payload: null };
  let payload = raw.subarray(offset);
  if (payload.length > 2 * 1024 * 1024) throw new Error("语音识别服务响应超过 2 MiB 上限。");
  if (compression === 1) payload = gunzipSync(payload, { maxOutputLength: 4 * 1024 * 1024 });
  if (!payload.length || serialization !== 1) return { code, isLast, payload: null };
  let value: unknown;
  try { value = JSON.parse(payload.toString("utf8")) as unknown; } catch { throw new Error("语音识别服务返回了无效 JSON。"); }
  return { code, isLast, payload: asRecord(value) };
}

function ffmpegPcm(audio: Buffer, signal: AbortSignal): AsyncGenerator<Buffer> {
  return (async function* (): AsyncGenerator<Buffer> {
    signal.throwIfAborted();
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-protocol_whitelist", "pipe", "-probesize", "8388608", "-analyzeduration", "10000000", "-i", "pipe:0", "-vn", "-ac", "1", "-ar", "16000", "-acodec", "pcm_s16le", "-f", "s16le", "pipe:1"], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", chunk => { if (stderr.length < 4000) stderr += String(chunk).slice(0, 4000 - stderr.length); });
    const abort = (): void => { child.kill("SIGKILL"); };
    signal.addEventListener("abort", abort, { once: true });
    const close = new Promise<{ code: number | null; error?: Error }>(resolve => {
      child.once("error", error => resolve({ code: null, error }));
      child.once("close", code => resolve({ code }));
    });
    child.stdin.once("error", () => undefined);
    child.stdin.end(audio);
    let emitted = 0;
    try {
      for await (const chunk of child.stdout) {
        signal.throwIfAborted();
        emitted += chunk.length;
        if (emitted > 2 * 60 * 60 * 16_000 * 2) throw new Error("转换后的音频超过 2 小时采样上限。");
        yield Buffer.from(chunk);
      }
      const result = await close;
      if (result.error?.message.includes("ENOENT")) throw new Error("当前环境没有找到 ffmpeg；请安装 FFmpeg 并确保 ffmpeg 命令位于 PATH，再重试语音识别。");
      if (result.error) throw new Error("无法启动 FFmpeg 音频解码器。");
      if (result.code !== 0) throw new Error(`FFmpeg 无法解码 Bilibili 音轨：${safeText(stderr, 400)}。`);
      if (emitted === 0) throw new Error("FFmpeg 没有解出可识别的音频数据。");
    } finally {
      signal.removeEventListener("abort", abort);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  })();
}

interface ArkResponseQueue { next(signal: AbortSignal): Promise<Buffer>; fail(error: Error): void }
function responseQueue(socket: WebSocket): ArkResponseQueue {
  const maxPendingResponses = 16;
  const pending: Buffer[] = [];
  const waiters: Array<{ resolve: (value: Buffer) => void; reject: (error: Error) => void }> = [];
  let failure: Error | null = null;
  socket.on("message", data => {
    const value = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(value);
    else if (pending.length < maxPendingResponses) pending.push(value);
    else {
      failure = new Error("语音识别服务发送响应过快，超过缓冲上限。");
      socket.close();
      while (waiters.length) waiters.shift()!.reject(failure);
    }
  });
  socket.on("error", error => { failure = error; while (waiters.length) waiters.shift()!.reject(error); });
  socket.on("close", () => { if (!failure) failure = new Error("语音识别连接提前关闭。"); while (waiters.length) waiters.shift()!.reject(failure); });
  return {
    fail(error) { failure = error; while (waiters.length) waiters.shift()!.reject(error); },
    next(signal) {
      signal.throwIfAborted();
      const queued = pending.shift(); if (queued) return Promise.resolve(queued);
      if (failure) return Promise.reject(failure);
      return new Promise((resolve, reject) => {
        let waiter: { resolve: (value: Buffer) => void; reject: (error: Error) => void };
        const abort = (): void => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new DOMException("语音识别已取消。", "AbortError"));
        };
        waiter = {
          resolve: value => { signal.removeEventListener("abort", abort); resolve(value); },
          reject: error => { signal.removeEventListener("abort", abort); reject(error); }
        };
        waiters.push(waiter);
        signal.addEventListener("abort", abort, { once: true });
      });
    }
  };
}

function sendSocket(socket: WebSocket, packet: Buffer): Promise<void> {
  return new Promise((resolve, reject) => socket.send(packet, error => error ? reject(error) : resolve()));
}

async function transcribePcm(pcm: AsyncGenerator<Buffer>, apiKey: string, userId: string, signal: AbortSignal): Promise<JsonRecord> {
  const requestId = randomUUID();
  const socket = new WebSocket(ARK_ASR_URL, {
    headers: { "X-Api-Key": apiKey, "X-Api-Resource-Id": "volc.seedasr.sauc.duration", "X-Api-Request-Id": requestId, "X-Api-Connect-Id": requestId, "X-Api-Sequence": "-1" },
    handshakeTimeout: 20_000, maxPayload: 4 * 1024 * 1024
  });
  const queue = responseQueue(socket);
  const abort = (): void => { socket.close(); queue.fail(new DOMException("语音识别已取消。", "AbortError")); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    await new Promise<void>((resolve, reject) => {
      const onOpen = (): void => { cleanup(); resolve(); };
      const onError = (error: Error): void => { cleanup(); reject(error); };
      const onAbort = (): void => { cleanup(); reject(new DOMException("语音识别已取消。", "AbortError")); };
      const cleanup = (): void => { socket.off("open", onOpen); socket.off("error", onError); signal.removeEventListener("abort", onAbort); };
      socket.once("open", onOpen); socket.once("error", onError); signal.addEventListener("abort", onAbort, { once: true });
    });
    signal.throwIfAborted();
    const identity = createHash("sha256").update(userId, "utf8").digest("hex").slice(0, 24);
    const fullRequest = Buffer.from(JSON.stringify({
      user: { uid: identity }, audio: { format: "wav", codec: "raw", rate: 16000, bits: 16, channel: 1 },
      request: { model_name: "bigmodel", enable_itn: true, enable_punc: true, enable_ddc: true, show_utterances: true, enable_nonstream: true }
    }), "utf8");
    await sendSocket(socket, requestPacket(1, 1, 1, fullRequest, true));
    const started = parseArkAsrResponse(await queue.next(signal));
    if (started.code !== 0) throw new Error(`Ark Agent Plan 语音识别连接错误码 ${started.code}。`);
    const responseMonitor = (async (): Promise<JsonRecord> => {
      for (;;) {
        const response = parseArkAsrResponse(await queue.next(signal));
        if (response.code !== 0) throw new Error(`Ark Agent Plan 语音识别返回错误码 ${response.code}。`);
        if (response.isLast && response.payload) return response.payload;
      }
    })();
    let responseError: unknown;
    void responseMonitor.catch(error => { responseError = error; socket.close(); });
    let sequence = 2;
    let tail = Buffer.alloc(0);
    let pendingChunk: Buffer | null = null;
    for await (const rawChunk of pcm) {
      signal.throwIfAborted();
      const combined = tail.length ? Buffer.concat([tail, rawChunk]) : rawChunk;
      const chunks = splitPcm(combined, 32 * 1024);
      const sentLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
      tail = combined.subarray(sentLength);
      for (const chunk of chunks) {
        signal.throwIfAborted();
        if (responseError) throw responseError;
        if (pendingChunk) {
          await sendSocket(socket, requestPacket(2, 1, sequence++, pendingChunk, true));
        }
        pendingChunk = chunk;
      }
    }
    if (tail.length % 2) tail = tail.subarray(0, tail.length - 1);
    if (tail.length) pendingChunk = pendingChunk ? Buffer.concat([pendingChunk, tail]) : tail;
    if (!pendingChunk) throw new Error("没有可发送的语音采样数据。");
    if (responseError) throw responseError;
    await sendSocket(socket, requestPacket(2, 3, sequence, pendingChunk, true));
    return await responseMonitor;
  } finally {
    signal.removeEventListener("abort", abort);
    socket.close();
  }
}

function normalizeTranscript(payload: JsonRecord, bvid: string, durationSeconds: number): BilibiliTranscript {
  const result = asRecord(payload.result);
  if (!result) throw new Error("语音识别结束，但服务商没有返回识别文本。");
  const rawText = safeText(result.text, MAX_ASR_TRANSCRIPT_CHARS + 1);
  const rawUtterances = Array.isArray(result.utterances) ? result.utterances : [];
  const utterances = rawUtterances.slice(0, 600).flatMap(value => {
    const item = asRecord(value);
    const text = safeText(item?.text, 500);
    const start = Number(item?.start_time);
    const end = Number(item?.end_time);
    return text && Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start
      ? [{ startSeconds: start / 1000, endSeconds: end / 1000, text }] : [];
  });
  const text = rawText.slice(0, MAX_ASR_TRANSCRIPT_CHARS) || utterances.map(item => item.text).join("\n").slice(0, MAX_ASR_TRANSCRIPT_CHARS);
  if (!text.trim()) throw new Error("语音识别没有返回可用文本。");
  return { bvid, durationSeconds, text, utterances, truncated: rawText.length > MAX_ASR_TRANSCRIPT_CHARS || rawUtterances.length > 600 };
}

export function createBilibiliVideoService(): BilibiliVideoService {
  return {
    parseUrl: parseBilibiliVideoUrl,
    async readInfo(input, signal) {
      const { reference, info } = await videoMetadata(input, signal);
      return { ...info, captions: await readCaptions(reference, info.cid, signal) };
    },
    async readStoryboard(input, sheetIndex, signal) {
      const { reference, info } = await videoMetadata(input, signal);
      const storyboardUrl = apiUrl("/x/player/videoshot", reference, info.cid);
      storyboardUrl.searchParams.set("index", "1"); storyboardUrl.searchParams.set("json", "1");
      const data = await fetchBilibiliJson(storyboardUrl, signal);
      const imageUrls = Array.isArray(data.image) ? data.image.slice(0, 2) : [];
      const totalSheets = imageUrls.length;
      if (sheetIndex < 0 || !Number.isInteger(sheetIndex) || sheetIndex >= totalSheets) throw new Error(`该视频返回 ${totalSheets} 张画面索引图。`);
      const rawUrl = imageUrls[sheetIndex];
      if (typeof rawUrl !== "string") throw new Error("Bilibili 画面索引图地址无效。");
      const url = rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl;
      const image = await fetchPublic(url, hostname => isAllowedHost(hostname, ["hdslb.com"]), STORYBOARD_MAX_BYTES, signal,
        { accept: "image/jpeg", referer: "https://www.bilibili.com/" });
      if (image.contentType !== "image/jpeg" || image.bytes.length < 4 || image.bytes[0] !== 0xff || image.bytes[1] !== 0xd8) throw new Error("Bilibili Storyboard 不是有效 JPEG 图像。");
      const x = Number(data.img_x_len); const y = Number(data.img_y_len);
      const tileWidth = Number(data.img_x_size); const tileHeight = Number(data.img_y_size);
      const dimensions = readJpegDimensions(image.bytes);
      if (![x, y, tileWidth, tileHeight].every(Number.isSafeInteger) || x <= 0 || y <= 0 || x * y > 200 || tileWidth <= 0 || tileHeight <= 0
        || tileWidth * x > 8192 || tileHeight * y > 8192 || tileWidth * x * tileHeight * y > 40_000_000
        || dimensions.width !== tileWidth * x || dimensions.height !== tileHeight * y) throw new Error("Bilibili Storyboard 尺寸超出允许范围或与图像不匹配。");
      const tileCount = Number.isInteger(x) && Number.isInteger(y) && x > 0 && y > 0 ? Math.min(x * y, 200) : 100;
      const timestamps = mapStoryboardTimestamps(data.index).slice(sheetIndex * tileCount, (sheetIndex + 1) * tileCount);
      return { sheetIndex, sheetCount: totalSheets, mimeType: "image/jpeg", dataBase64: image.bytes.toString("base64"), width: tileWidth * x, height: tileHeight * y, timestamps };
    },
    async transcribe(input, apiKey, userId, signal, onProgress) {
      if (!apiKey.trim()) throw new Error("设置中心没有可用的 Ark Agent Plan 语音识别密钥。");
      const { reference, info } = await videoMetadata(input, signal);
      if (info.durationSeconds > BILIBILI_MAX_DURATION_SECONDS) throw new Error(`视频时长超过 ${BILIBILI_MAX_DURATION_SECONDS / 60} 分钟语音识别上限。`);
      const playUrl = apiUrl("/x/player/playurl", reference, info.cid);
      playUrl.searchParams.set("qn", "16"); playUrl.searchParams.set("fnval", "16"); playUrl.searchParams.set("fourk", "0");
      onProgress("正在读取 Bilibili 公开音轨；音频不会写入磁盘。");
      const data = await fetchBilibiliJson(playUrl, signal);
      const dash = asRecord(data.dash);
      const rawAudioOptions = dash?.audio;
      const audioOptions = Array.isArray(rawAudioOptions) ? rawAudioOptions.flatMap(value => asRecord(value) ? [asRecord(value)!] : []) : [];
      if (!audioOptions.length) throw new Error("Bilibili 没有为此公开视频提供可读取的音轨。");
      const audioOption = audioOptions.sort((a, b) => Number(a.bandwidth ?? Number.MAX_SAFE_INTEGER) - Number(b.bandwidth ?? Number.MAX_SAFE_INTEGER))[0]!;
      const audioUrl = typeof audioOption.baseUrl === "string" ? audioOption.baseUrl : typeof audioOption.base_url === "string" ? audioOption.base_url : "";
      if (!audioUrl) throw new Error("Bilibili 播放信息缺少音轨地址。");
      const downloaded = await fetchPublic(audioUrl, hostname => isAllowedHost(hostname, ["bilivideo.cn", "bilivideo.com"]), BILIBILI_MAX_AUDIO_BYTES, signal,
        { accept: "audio/mp4,application/octet-stream;q=0.9,*/*;q=0.1", referer: "https://www.bilibili.com/", timeoutMs: 180_000 });
      if (downloaded.bytes.length < 12 || downloaded.bytes.toString("ascii", 4, 8) !== "ftyp") throw new Error("Bilibili 音轨不是受支持的 MP4/M4S 音频容器。");
      onProgress("音轨已在内存中取得，正在用系统 FFmpeg 转成 16 kHz 单声道 PCM。");
      const timeout = AbortSignal.timeout(10 * 60_000);
      const taskSignal = AbortSignal.any([signal, timeout]);
      const pcm = ffmpegPcm(downloaded.bytes, taskSignal);
      const iterator = pcm[Symbol.asyncIterator]();
      const first = await iterator.next();
      if (first.done) throw new Error("FFmpeg 没有产生音频采样。");
      onProgress("正在将音频发送到所选 Ark Agent Plan 语音模型；这可能消耗套餐额度。");
      async function* withFirst(): AsyncGenerator<Buffer> { yield first.value; for (;;) { const next = await iterator.next(); if (next.done) break; yield next.value; } }
      const response = await transcribePcm(withFirst(), apiKey, userId, taskSignal);
      return normalizeTranscript(response, reference.bvid, info.durationSeconds);
    }
  };
}

declare module "@deepseek-ai/cordis" { interface Context { lfaaBilibiliVideo: BilibiliVideoService } }
export function apply(ctx: Context): void { ctx.provide(name, createBilibiliVideoService()); }

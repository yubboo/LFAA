/** 功能：调用火山方舟异步视频任务 API。作用：由 LLM Provider Owner 承担协议、响应边界与生成文件下载。 */

import type { GeneratedImageMimeType } from "./image-generation.js";

const ARK_VIDEO_API = "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks";
const MAX_TASK_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_PROVIDER_VIDEO_BYTES = 128 * 1024 * 1024;
const ALLOWED_VIDEO_HOST = "ark-content-generation-cn-beijing.tos-cn-beijing.volces.com";

export type ArkVideoTaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired";
export interface ArkVideoTask {
  id: string;
  status: ArkVideoTaskStatus;
  model?: string;
  videoUrl?: string;
  error?: string;
}
export interface ArkVideoReferenceImage { bytes: Buffer; mimeType: GeneratedImageMimeType }

function fail(message: string): never { throw new Error(message); }

async function readJson(response: Response): Promise<unknown> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_TASK_RESPONSE_BYTES) return fail("火山方舟任务响应超过大小限制。");
  if (!response.body) return fail("火山方舟没有返回任务响应内容。");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_TASK_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        return fail("火山方舟任务响应超过大小限制。");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { return fail("火山方舟返回了无法识别的任务响应。"); }
}

function responseError(status: number): string {
  if (status === 401 || status === 403) return "火山方舟认证失败，请检查设置中心保存的账户密钥和模型权限。";
  if (status === 402) return "火山方舟账户额度或余额不足，请检查计划和可用额度。";
  if (status === 429) return "火山方舟当前限流或并发任务已满，请稍后重试。";
  if (status === 400 || status === 404) return "火山方舟拒绝了请求；请检查所选模型是否开通，以及参考图和生成参数是否受支持。";
  return `火山方舟视频任务请求失败（HTTP ${status}）。`;
}

function normalizeTask(value: unknown): ArkVideoTask {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("火山方舟没有返回有效任务对象。");
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : "";
  const status = raw.status;
  if (!id || id.length > 256 || !["queued", "running", "succeeded", "failed", "cancelled", "expired"].includes(String(status))) {
    return fail("火山方舟返回的任务 ID 或状态无效。");
  }
  const content = raw.content && typeof raw.content === "object" && !Array.isArray(raw.content) ? raw.content as Record<string, unknown> : undefined;
  const videoUrl = typeof content?.video_url === "string" ? content.video_url : undefined;
  const errorObject = raw.error && typeof raw.error === "object" && !Array.isArray(raw.error) ? raw.error as Record<string, unknown> : undefined;
  const providerError = typeof errorObject?.message === "string" ? errorObject.message.slice(0, 800) : undefined;
  return {
    id,
    status: status as ArkVideoTaskStatus,
    ...(typeof raw.model === "string" && raw.model.length <= 160 ? { model: raw.model } : {}),
    ...(videoUrl && videoUrl.length <= 2_048 ? { videoUrl } : {}),
    ...(providerError ? { error: providerError } : {})
  };
}

function createAbort(timeoutMs: number, signal?: AbortSignal): { controller: AbortController; timer: ReturnType<typeof setTimeout>; unlink: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  return { controller, timer, unlink: () => signal?.removeEventListener("abort", abort) };
}

async function taskRequest(url: string, apiKey: string, timeoutMs: number, signal: AbortSignal | undefined, init: RequestInit): Promise<unknown> {
  const abort = createAbort(timeoutMs, signal);
  try {
    if (signal?.aborted) throw new DOMException("AI 视频任务已停止。", "AbortError");
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
        signal: abort.controller.signal
      });
    } catch (error) {
      if (signal?.aborted) throw new DOMException("AI 视频任务已停止。", "AbortError");
      if (abort.controller.signal.aborted) return fail("火山方舟视频任务请求超时；服务商是否已受理需按账户任务记录核实。没有登记虚假成功状态。");
      return fail(error instanceof Error && error.name === "TypeError" ? "无法连接火山方舟，请检查网络和服务商状态。" : "火山方舟视频任务请求未能完成。请核查服务商任务记录后再重试。");
    }
    const payload = await readJson(response);
    if (!response.ok) return fail(responseError(response.status));
    return payload;
  } finally {
    clearTimeout(abort.timer);
    abort.unlink();
  }
}

export async function createArkVideoTask(input: {
  modelId: string;
  apiKey: string;
  prompt: string;
  referenceImages: ArkVideoReferenceImage[];
  durationSeconds: number;
  ratio: string;
  resolution: string;
  generateAudio: boolean;
  watermark: boolean;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<ArkVideoTask> {
  if (!input.modelId.trim() || input.modelId.length > 160) return fail("视频模型 ID 无效。");
  if (!input.apiKey.trim() || input.apiKey.length > 4096) return fail("设置中心的火山方舟账户密钥不可用。");
  if (!input.prompt.trim() || input.prompt.length > 5_000) return fail("视频提示词为空或超过 5000 字符。");
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 1 || input.durationSeconds > 15) return fail("视频时长必须在 1 到 15 秒之间。");
  if (!Array.isArray(input.referenceImages) || input.referenceImages.length > 9
    || input.referenceImages.some(image => !image || !Buffer.isBuffer(image.bytes) || image.bytes.length === 0 || image.bytes.length > 3 * 1024 * 1024
      || !["image/png", "image/jpeg", "image/webp"].includes(image.mimeType))) return fail("视频最多使用 9 张 3 MiB 以内的 PNG、JPEG 或 WebP 参考图。");
  const content: Array<Record<string, unknown>> = [{ type: "text", text: input.prompt.trim() }];
  for (const image of input.referenceImages) {
    content.push({ type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.bytes.toString("base64")}` }, role: "reference_image" });
  }
  const payload = await taskRequest(ARK_VIDEO_API, input.apiKey, input.timeoutMs, input.signal, {
    method: "POST",
    body: JSON.stringify({
      model: input.modelId,
      content,
      duration: input.durationSeconds,
      ratio: input.ratio,
      resolution: input.resolution,
      generate_audio: input.generateAudio,
      watermark: input.watermark
    })
  });
  return normalizeTask(payload);
}

export async function getArkVideoTask(input: { taskId: string; apiKey: string; timeoutMs: number; signal?: AbortSignal }): Promise<ArkVideoTask> {
  if (!input.taskId || input.taskId.length > 256) return fail("火山方舟任务 ID 无效。");
  const payload = await taskRequest(`${ARK_VIDEO_API}/${encodeURIComponent(input.taskId)}`, input.apiKey, input.timeoutMs, input.signal, { method: "GET" });
  return normalizeTask(payload);
}

export async function cancelArkVideoTask(input: { taskId: string; apiKey: string; timeoutMs: number; signal?: AbortSignal }): Promise<void> {
  if (!input.taskId || input.taskId.length > 256) return fail("火山方舟任务 ID 无效。");
  await taskRequest(`${ARK_VIDEO_API}/${encodeURIComponent(input.taskId)}`, input.apiKey, input.timeoutMs, input.signal, { method: "DELETE" });
}

export async function downloadArkVideo(urlValue: string, timeoutMs: number, signal?: AbortSignal): Promise<Buffer> {
  let url: URL;
  try { url = new URL(urlValue); } catch { return fail("火山方舟返回的视频地址无效；没有下载外部文件。"); }
  if (url.protocol !== "https:" || url.hostname !== ALLOWED_VIDEO_HOST || url.username || url.password || url.port || url.hash) {
    return fail("火山方舟视频地址不在当前官方对象存储范围内；拒绝下载。");
  }
  const abort = createAbort(timeoutMs, signal);
  try {
    let response: Response;
    try { response = await fetch(url, { method: "GET", redirect: "error", signal: abort.controller.signal }); }
    catch (error) {
      if (signal?.aborted) throw new DOMException("AI 视频下载已停止。", "AbortError");
      if (abort.controller.signal.aborted) return fail("下载火山方舟视频超时；项目文件尚未登记成片。");
      return fail("无法从火山方舟官方对象存储下载生成视频；项目文件尚未登记成片。");
    }
    if (!response.ok) return fail(`下载火山方舟视频失败（HTTP ${response.status}）；项目文件尚未登记成片。`);
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLocaleLowerCase("en-US");
    if (contentType !== "video/mp4" || !response.body) return fail("火山方舟返回的视频格式不是 MP4；项目文件尚未登记成片。");
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_VIDEO_BYTES) return fail("火山方舟视频超过 128 MiB 单片上限；项目文件尚未登记成片。");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    let prefix = Buffer.alloc(0);
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_PROVIDER_VIDEO_BYTES) {
          await reader.cancel().catch(() => undefined);
          return fail("火山方舟视频超过 128 MiB 单片上限；项目文件尚未登记成片。");
        }
        if (prefix.length < 16) prefix = Buffer.concat([prefix, Buffer.from(value.subarray(0, 16 - prefix.length))]);
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    if (total < 16 || prefix.toString("ascii", 4, 8) !== "ftyp") return fail("下载内容不是有效 MP4 视频；项目文件尚未登记成片。");
    return Buffer.concat(chunks, total);
  } finally {
    clearTimeout(abort.timer);
    abort.unlink();
  }
}

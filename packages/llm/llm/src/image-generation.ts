/** 功能：调用已登记 Provider 的官方图片生成接口。作用：将图像 API 协议和响应边界留在 LLM Owner。 */
import { ARK_OPENAI_BASE_URL, ARK_PLAN_PROVIDERS } from "lfaa-util-values/src/ark-provider.js";

export type ImageGenerationProvider = "openai" | "doubao" | "ark-agent-plan";
export type GeneratedImageMimeType = "image/png" | "image/jpeg" | "image/webp";

export interface GeneratedProviderImage {
  bytes: Buffer;
  mimeType: GeneratedImageMimeType;
}

export interface ProviderReferenceImage {
  bytes: Buffer;
  mimeType: GeneratedImageMimeType;
}

const PROVIDER_IMAGE_ENDPOINTS: Record<ImageGenerationProvider, string> = {
  openai: "https://api.openai.com/v1/images/generations",
  doubao: `${ARK_OPENAI_BASE_URL}/images/generations`,
  "ark-agent-plan": ARK_PLAN_PROVIDERS.agent.imageGenerationsUrl
};
const OPENAI_IMAGE_EDIT_ENDPOINT = "https://api.openai.com/v1/images/edits";
const MAX_PROVIDER_RESPONSE_BYTES = 24 * 1024 * 1024;
const MAX_GENERATED_IMAGE_BYTES = 16 * 1024 * 1024;

function fail(message: string): never { throw new Error(message); }

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
    return fail("图像服务商响应超过大小限制。请检查模型输出设置后重试。");
  }
  if (!response.body) return fail("图像服务商没有返回响应内容。");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PROVIDER_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        return fail("图像服务商响应超过大小限制。请检查模型输出设置后重试。");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { return fail("图像服务商返回了无法识别的响应格式。"); }
}

function readImagePayload(value: unknown): GeneratedProviderImage {
  if (typeof value !== "string" || value.length > Math.ceil(MAX_GENERATED_IMAGE_BYTES * 4 / 3) + 8
    || value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    return fail("图像服务商没有返回有效的 Base64 图片。");
  }
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.length > MAX_GENERATED_IMAGE_BYTES || bytes.toString("base64") !== value) {
    return fail("生成图片为空、超过单图大小限制或编码无效。");
  }
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { bytes, mimeType: "image/png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { bytes, mimeType: "image/jpeg" };
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return { bytes, mimeType: "image/webp" };
  return fail("生成结果不是受支持的 PNG、JPEG 或 WebP 图片。");
}

function readFailureMessage(status: number): string {
  if (status === 401 || status === 403) return "图像服务商认证失败，请检查设置中心保存的账户密钥和模型权限。";
  if (status === 402) return "图像服务商返回额度或余额不足，请检查账户计划和可用额度。";
  if (status === 429) return "图像服务商当前限流或额度不足，请稍后重试并检查账户用量。";
  if (status === 400 || status === 404) return "图像服务商拒绝了模型请求，请检查所选模型是否支持图片生成以及提示词是否有效。";
  return `图像服务商请求失败（HTTP ${status}）。`;
}

/** 只向固定官方端点发送用户选择的模型与提示词；不读取任意 URL 或自动切换模型。 */
export async function generateProviderImage(input: {
  providerId: ImageGenerationProvider;
  modelId: string;
  apiKey: string;
  prompt: string;
  referenceImages?: ProviderReferenceImage[];
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<GeneratedProviderImage> {
  if (!Object.hasOwn(PROVIDER_IMAGE_ENDPOINTS, input.providerId)) return fail("当前图像服务商不在允许范围内。");
  if (typeof input.modelId !== "string" || !input.modelId.trim() || input.modelId.length > 160) return fail("图片模型 ID 无效。");
  if (typeof input.apiKey !== "string" || !input.apiKey.trim() || input.apiKey.length > 4096) return fail("设置中心的图像模型账户密钥不可用。");
  if (typeof input.prompt !== "string" || !input.prompt.trim() || input.prompt.length > 1_000) return fail("请在镜头的画面与动作中填写不超过 1000 字符的出图提示词。");
  const referenceImages = input.referenceImages ?? [];
  if (!Array.isArray(referenceImages) || referenceImages.length > 9
    || referenceImages.some(image => !image || !Buffer.isBuffer(image.bytes) || image.bytes.length === 0 || image.bytes.length > 3 * 1024 * 1024
      || !["image/png", "image/jpeg", "image/webp"].includes(image.mimeType))) return fail("图像参考最多 9 张，每张必须是 3 MiB 以内的 PNG、JPEG 或 WebP 文件。");
  if (referenceImages.reduce((total, image) => total + image.bytes.length, 0) > 27 * 1024 * 1024) return fail("图像参考合计超过 27 MiB 上限。");
  if (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 10_000 || input.timeoutMs > 300_000) return fail("图片模型请求时限无效。");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  const abortFromCaller = () => controller.abort();
  input.signal?.addEventListener("abort", abortFromCaller, { once: true });
  try {
    if (input.signal?.aborted) throw new DOMException("Agent 已停止图片生成。", "AbortError");
    const requestBody = input.providerId === "doubao" || input.providerId === "ark-agent-plan"
      ? { model: input.modelId, prompt: input.prompt.trim(), response_format: "b64_json", ...(referenceImages.length ? { image: referenceImages.map(image => `data:${image.mimeType};base64,${image.bytes.toString("base64")}`) } : {}) }
      : { model: input.modelId, prompt: input.prompt.trim(), n: 1 };
    let body: string | FormData;
    let headers: Record<string, string>;
    if (input.providerId === "openai" && referenceImages.length) {
      const form = new FormData();
      form.append("model", input.modelId);
      form.append("prompt", input.prompt.trim());
      form.append("n", "1");
      referenceImages.forEach((image, index) => {
        const extension = image.mimeType === "image/png" ? "png" : image.mimeType === "image/jpeg" ? "jpg" : "webp";
        form.append("image[]", new Blob([Uint8Array.from(image.bytes)], { type: image.mimeType }), `reference-${index + 1}.${extension}`);
      });
      body = form;
      headers = { Authorization: `Bearer ${input.apiKey}`, Accept: "application/json" };
    } else {
      body = JSON.stringify(requestBody);
      headers = { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json", Accept: "application/json" };
    }
    let response: Response;
    try {
      response = await fetch(input.providerId === "openai" && referenceImages.length ? OPENAI_IMAGE_EDIT_ENDPOINT : PROVIDER_IMAGE_ENDPOINTS[input.providerId], {
        method: "POST",
        headers,
        body,
        signal: controller.signal
      });
    } catch (error) {
      if (input.signal?.aborted) throw new DOMException("Agent 已停止图片生成。", "AbortError");
      if (controller.signal.aborted) return fail("图片生成等待超时；检查模型耗时设置后重试。服务商是否已计费需以账户记录为准。");
      return fail(error instanceof Error && error.name === "TypeError" ? "无法连接图像服务商，请检查网络和服务商状态。" : "图像生成请求未能完成。服务商是否已计费需以账户记录为准。");
    }
    let payload: unknown;
    try { payload = await readBoundedJson(response); }
    catch (error) {
      if (input.signal?.aborted) throw new DOMException("Agent 已停止图片生成。", "AbortError");
      if (controller.signal.aborted) return fail("图片生成等待超时；检查模型耗时设置后重试。服务商是否已计费需以账户记录为准。");
      throw error;
    }
    if (input.signal?.aborted) throw new DOMException("Agent 已停止图片生成。", "AbortError");
    if (!response.ok) return fail(readFailureMessage(response.status));
    if (typeof payload !== "object" || payload === null || !Array.isArray((payload as Record<string, unknown>).data)) {
      return fail("图像服务商没有返回图片数据。");
    }
    const first = (payload as { data: unknown[] }).data[0];
    if (typeof first !== "object" || first === null) return fail("图像服务商没有返回图片数据。");
    return readImagePayload((first as Record<string, unknown>).b64_json);
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener("abort", abortFromCaller);
  }
}

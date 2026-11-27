// 媒体生成（生图）适配：把套餐里的图像模型调用到厂商图片接口，统一返回 base64/URL 与错误信息。
// - 阿里云百炼/Token Plan：原生同步接口 /api/v1/services/aigc/multimodal-generation/generation
// - 火山方舟：Agent Plan 与普通方舟使用各自的 API 前缀
// - 其他 OpenAI 兼容端点：/images/generations
import { readFile } from "node:fs/promises";
import { ARK_PLAN_BASE_URLS, getArkPlanKind } from "../ark-plan";
import { selectVideoProfile } from "./media-models";
import { buildVideoTaskBody, parseVideoTask, parseVideoTaskResult } from "./media-video";
export { selectImageProfile, selectVideoProfile } from "./media-models";
export { buildVideoTaskBody, parseVideoTask, parseVideoTaskResult } from "./media-video";
import type { LlmProfile } from "../types";

/** 一次生图的入参。 */
export interface MediaImageInput {
  prompt: string;
  /** 风格预设：cinematic / photo / illustration / anime / 3d / watercolor。 */
  style?: string;
  /** 参考图（图生图/编辑）：本地绝对路径或 http(s) URL，最多 3 张。 */
  referenceImages?: string[];
  /** 多参考组合使用原始构图描述，编辑则沿用聊天媒体的主体保护提示。 */
  referenceMode?: "compose";
  size?: string;
  n?: number;
  seed?: number;
  watermark?: boolean;
  negativePrompt?: string;
  modelId?: string;
  profileId?: string;
}

/** 一次生视频的入参。 */
export interface MediaVideoInput {
  prompt: string;
  /** 仅经授权的本地素材转换出 Data URL，由图生视频适配器消费。 */
  visualInputs?: Array<{ role: "first_frame" | "last_frame" | "reference_image" | "reference_video"; url: string }>;
  duration?: number;
  resolution?: string;
  ratio?: string;
  seed?: number;
  watermark?: boolean;
  negativePrompt?: string;
  modelId?: string;
  profileId?: string;
  /** 轮询等待上限（毫秒），默认 240s；超时返回 taskId 供后续查询。 */
  waitMs?: number;
}

/** 生视频结果。 */
export interface MediaVideoResult {
  model: string;
  /** 实际使用的模型配置；跨套餐生成时用它向用户说明，避免误以为用了当前聊天套餐。 */
  profileId?: string;
  profileName?: string;
  taskId: string;
  status: "SUCCEEDED" | "PENDING" | "RUNNING" | "FAILED" | "CANCELED" | "UNKNOWN";
  videoUrl?: string;
  elapsedMs: number;
  message?: string;
}

/** 生图结果：图片以 base64 返回，URL 结果由调用方按需下载。 */
export interface MediaImageResult {
  model: string;
  profileId?: string;
  images: Array<{ b64?: string; url?: string; mime: string }>;
  elapsedMs: number;
}

/** 生图接口风格：阿里云原生多模态、火山方舟、OpenAI 兼容。 */
export type ImageEndpointStyle = "dashscope-multimodal" | "ark" | "compatible";

/** 生图风格预设：把风格名展开成提示词后缀，让模型更稳定地呈现对应质感。 */
export const IMAGE_STYLE_PROMPTS: Record<string, string> = {
  cinematic: "电影感、宽银幕构图、电影级光影与调色",
  photo: "真实摄影、自然光、细腻质感、浅景深",
  illustration: "精细插画、扁平色块、柔和配色",
  anime: "日系动画风格、干净线条、明亮色彩",
  "3d": "3D 渲染、柔和体积光、细腻材质",
  watercolor: "水彩画质感、自然晕染、纸张纹理",
};

/** 解析风格预设为提示词后缀；未知风格返回空串。 */
export function resolveImageStylePrompt(style?: string): string {
  const key = style?.trim().toLowerCase() ?? "";
  return IMAGE_STYLE_PROMPTS[key] ?? "";
}

/** Agent Plan 需要保留套餐路径，即使聊天使用 Anthropic 兼容入口。 */
function resolveArkMediaBase(parsed: URL): string {
  return getArkPlanKind(`${parsed.origin}${parsed.pathname}`) === "agent"
    ? ARK_PLAN_BASE_URLS.agent
    : `${parsed.origin}/api/v3`;
}

/** 解析生图端点与接口风格。 */
export function resolveImageEndpoint(baseUrl: string): { url: string; style: ImageEndpointStyle } {
  const trimmed = baseUrl.trim().replace(/\/+$/u, "");
  const parsed = new URL(trimmed);
  if (parsed.hostname.includes("volces.com")) {
    return { url: `${resolveArkMediaBase(parsed)}/images/generations`, style: "ark" };
  }
  // 百炼/Token Plan 的 workspace 域名形如 <workspace>.cn-beijing.maas.aliyuncs.com
  if (parsed.hostname.includes("aliyuncs.com")) {
    return { url: `${parsed.origin}/api/v1/services/aigc/multimodal-generation/generation`, style: "dashscope-multimodal" };
  }
  return { url: `${trimmed}/images/generations`, style: "compatible" };
}

/** 把 1024x1024 / 1024×1024 统一成百炼要求的 1024*1024；无法识别时返回 undefined。 */
export function normalizeImageSize(size: string | undefined): string | undefined {
  const raw = size?.trim();
  if (!raw) return undefined;
  const match = /^(\d{3,5})\s*[xX×*]\s*(\d{3,5})$/u.exec(raw);
  return match ? `${match[1]}*${match[2]}` : undefined;
}

/** 参考图文件扩展名对应 MIME。 */
function imageMimeOf(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
}

/** 把常见的外观反馈展开为清晰可执行的改动，避免模型只做轻微润色。 */
function clarifyImageEditGoals(prompt: string): string[] {
  const goals: string[] = [];
  if (/(?:苗条|瘦一些|更瘦|变瘦|模特身材|模特身形|纤细|高挑)/u.test(prompt)) {
    goals.push("人物身形明显调整为高挑、纤细、匀称的时装模特比例，收窄腰腹轮廓并让四肢线条修长自然");
  }
  if (/(?:太丑|漂亮一些|更漂亮|好看一些|更好看|更精致|精致一些)/u.test(prompt)) {
    goals.push("在保持同一人物身份和可辨识面部特征的基础上，明显提升面部与整体造型的精致度和上镜感，保留自然真实质感");
  }
  return goals;
}

/** 有参考图时先明确用户要求与具体变化，再约束主体身份和其余画面。 */
function buildImageEditPrompt(prompt: string): string {
  const requested = prompt.trim();
  const goals = clarifyImageEditGoals(requested);
  const clarified = goals.length ? `\n【具体变化目标】${goals.join("；")}。` : "";
  return `基于参考图进行图片编辑。【本次修改要求，必须执行】${requested}。${clarified}【执行标准】以上指定变化必须清晰可见，不能忽略、弱化为轻微变化，也不能只改纹理和光影。保持原图为同一个主体并保留可辨识的身份特征，只调整修改要求涉及的部分。发型、服装、姿势、背景、光线和构图等未被要求修改的内容尽量保持原样，不要替换主体或擅自改变其他内容。`;
}

/** Wan 2.7 不支持 prompt_extend，其余已兼容模型沿用平台扩写默认值。 */
function imagePromptExtension(model: string): Record<string, true> {
  return /^wan2\.7-image(?:-pro)?$/iu.test(model) ? {} : { prompt_extend: true };
}

/** 把参考图（本地路径/URL/data URL）转成多模态接口的 image 内容。 */
export async function buildReferenceImageContent(referenceImages: readonly string[]): Promise<Array<{ image: string }>> {
  const picked = referenceImages.map((item) => item.trim()).filter(Boolean).slice(0, 3);
  const contents: Array<{ image: string }> = [];
  for (const item of picked) {
    if (/^https?:\/\//iu.test(item) || item.startsWith("data:image/")) {
      contents.push({ image: item });
      continue;
    }
    const bytes = await readFile(item).catch(() => null);
    if (!bytes) throw new Error(`参考图读取失败：${item}`);
    if (bytes.byteLength > 10 * 1024 * 1024) throw new Error(`参考图超过 10MB：${item}`);
    contents.push({ image: `data:${imageMimeOf(item)};base64,${bytes.toString("base64")}` });
  }
  return contents;
}

/** 组装图生图/编辑请求体：百炼多模态 messages[image..., text]。 */
export function buildEditImageRequestBody(
  profile: LlmProfile,
  input: MediaImageInput,
  images: ReadonlyArray<{ image: string }>,
): Record<string, unknown> {
  const model = input.modelId?.trim() || profile.model;
  const stylePrompt = resolveImageStylePrompt(input.style);
  const prompt = `${buildImageEditPrompt(input.prompt)}${stylePrompt ? `，风格：${stylePrompt}` : ""}`;
  const parameters: Record<string, unknown> = { n: Math.max(1, Math.min(input.n ?? 1, 6)), ...imagePromptExtension(model) };
  const size = normalizeImageSize(input.size);
  if (size) parameters.size = size;
  if (typeof input.seed === "number") parameters.seed = Math.floor(input.seed);
  if (typeof input.watermark === "boolean") parameters.watermark = input.watermark;
  if (input.negativePrompt?.trim()) parameters.negative_prompt = input.negativePrompt.trim();
  return {
    model,
    input: { messages: [{ role: "user", content: [...images, { text: prompt }] }] },
    parameters,
  };
}

/** 组装生图请求体：按接口风格生成不同字段结构。 */
export function buildImageRequestBody(
  profile: LlmProfile,
  input: MediaImageInput,
  style: ImageEndpointStyle = "compatible",
): Record<string, unknown> {
  const model = input.modelId?.trim() || profile.model;
  const stylePrompt = resolveImageStylePrompt(input.style);
  const prompt = `${input.prompt.trim()}${stylePrompt ? `，风格：${stylePrompt}` : ""}`;
  const n = Math.max(1, Math.min(input.n ?? 1, 6));
  if (style === "dashscope-multimodal") {
    const parameters: Record<string, unknown> = { n, ...imagePromptExtension(model) };
    const size = normalizeImageSize(input.size);
    if (size) parameters.size = size;
    if (typeof input.seed === "number") parameters.seed = Math.floor(input.seed);
    if (typeof input.watermark === "boolean") parameters.watermark = input.watermark;
    if (input.negativePrompt?.trim()) parameters.negative_prompt = input.negativePrompt.trim();
    return { model, input: { messages: [{ role: "user", content: [{ text: prompt }] }] }, parameters };
  }
  if (style === "ark") {
    // 方舟生图默认带「AI 生成」水印：默认关闭，由应用自己的设置决定是否展示水印。
    return { model, prompt, ...(input.size?.trim() ? { size: input.size.trim() } : {}),
      watermark: input.watermark ?? false };
  }
  const body: Record<string, unknown> = { model, prompt, n };
  if (input.size?.trim()) body.size = input.size.trim();
  if (typeof input.seed === "number") body.seed = Math.floor(input.seed);
  if (typeof input.watermark === "boolean") body.watermark = input.watermark;
  if (input.negativePrompt?.trim()) body.negative_prompt = input.negativePrompt.trim();
  return body;
}

/** 兼容解析：百炼 output.choices[].message.content[].image、OpenAI data[].b64_json/url、images[]。 */
export function parseImageResponse(payload: unknown): MediaImageResult["images"] {
  const record = (payload ?? {}) as Record<string, unknown>;
  const images: MediaImageResult["images"] = [];
  const output = (record.output ?? {}) as Record<string, unknown>;
  const choices = Array.isArray(output.choices) ? output.choices : [];
  for (const choice of choices) {
    const message = ((choice ?? {}) as Record<string, unknown>).message as Record<string, unknown> | undefined;
    const content = Array.isArray(message?.content) ? message.content : [];
    for (const part of content) {
      const entry = (part ?? {}) as Record<string, unknown>;
      if (typeof entry.image === "string") images.push({ url: entry.image, mime: "image/png" });
    }
  }
  const data = Array.isArray(record.data) ? record.data : Array.isArray(record.images) ? record.images : [];
  for (const item of data.slice(0, 6)) {
    const entry = (item ?? {}) as Record<string, unknown>;
    const b64 = typeof entry.b64_json === "string" ? entry.b64_json
      : typeof entry.image === "string" ? entry.image
        : typeof entry.b64 === "string" ? entry.b64 : undefined;
    const url = typeof entry.url === "string" ? entry.url : undefined;
    if (b64 && b64.startsWith("http")) images.push({ url: b64, mime: "image/png" });
    else if (b64) images.push({ b64, mime: "image/png" });
    else if (url) images.push({ url, mime: "image/png" });
  }
  return images;
}

/** 生成一张图片；失败时抛出带厂商原因的 Error，便于工具层转成可读提示。 */
export async function generateMediaImage(profile: LlmProfile, input: MediaImageInput): Promise<MediaImageResult> {
  const started = Date.now();
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("生图提示词不能为空。");
  const apiKey = profile.apiKey.trim();
  if (!apiKey) throw new Error(`模型配置「${profile.name}」尚未设置 API Key，无法生成图片。`);
  const endpoint = resolveImageEndpoint(profile.baseUrl);
  const referenceImages = input.referenceImages?.filter((item) => item.trim()) ?? [];
  const referenceContent = referenceImages.length > 0 ? await buildReferenceImageContent(referenceImages) : [];
  const run = async (body: Record<string, unknown>) => fetch(endpoint.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (referenceContent.length === 0 && referenceImages.length > 0) throw new Error("参考图无法读取，请重新选择图片。");
  if (referenceContent.length > 0 && endpoint.style === "compatible") {
    throw new Error("当前接口未配置参考图生成，请选择支持参考图的生图模型。");
  }
  const requestInput = referenceContent.length > 0 && input.referenceMode !== "compose" ? { ...input, prompt: buildImageEditPrompt(prompt) } : input;
  const body = endpoint.style === "dashscope-multimodal" && referenceContent.length
    ? buildEditImageRequestBody(profile, input, referenceContent)
    : buildImageRequestBody(profile, requestInput, endpoint.style);
  if (endpoint.style === "ark" && referenceContent.length > 0) {
    const images = referenceContent.flatMap((item) => "image" in item ? [item.image] : []);
    body.image = images.length === 1 ? images[0] : images;
  }
  const response = await run(body);
  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`生图失败（${response.status}）：${text.slice(0, 300) || response.statusText}`);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error("生图接口返回了无法解析的内容。");
  }
  const images = parseImageResponse(payload);
  if (images.length === 0) throw new Error("生图接口没有返回图片数据。");
  return { model: profile.model, images, elapsedMs: Date.now() - started };
}

/** 视频接口风格：百炼异步视频合成、方舟视频任务。 */
export type VideoEndpointStyle = "dashscope-video" | "ark-video";

/** 请求可能已经抵达厂商，但没有取得可用于恢复的任务编号。 */
export class VideoSubmissionUncertainError extends Error {}

/** 解析视频端点：百炼 workspace 用原生异步视频接口，方舟用 contents 任务。 */
export function resolveVideoEndpoint(baseUrl: string): { url: string; style: VideoEndpointStyle } {
  const parsed = new URL(baseUrl.trim().replace(/\/+$/u, ""));
  if (parsed.hostname.includes("volces.com")) {
    return { url: `${resolveArkMediaBase(parsed)}/contents/generations/tasks`, style: "ark-video" };
  }
  return { url: `${parsed.origin}/api/v1/services/aigc/video-generation/video-synthesis`, style: "dashscope-video" };
}

/** 创建视频任务（异步），返回 taskId。 */
export async function createMediaVideoTask(profile: LlmProfile, input: MediaVideoInput): Promise<{ taskId: string; status: MediaVideoResult["status"]; style: VideoEndpointStyle }> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("视频提示词不能为空。");
  const apiKey = profile.apiKey.trim();
  if (!apiKey) throw new Error(`模型配置「${profile.name}」尚未设置 API Key，无法生成视频。`);
  const endpoint = resolveVideoEndpoint(profile.baseUrl);
  const visualModel = endpoint.style === "ark-video"
    ? /seedance-2\.(?:0|5)/u.test(profile.model)
    : /^wan3\.0-video(?:-prime)?$/u.test(profile.model);
  if (input.visualInputs?.length && !visualModel) {
    throw new Error("请选择支持画布参考输入的 Wan 3.0 或 Seedance 2.x 视频模型。");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...(endpoint.style === "dashscope-video" ? { "X-DashScope-Async": "enable" } : {}),
  };
  let response: Response;
  try {
    response = await fetch(endpoint.url, {
      method: "POST",
      headers,
      body: JSON.stringify(buildVideoTaskBody(profile, input, endpoint.style)),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new VideoSubmissionUncertainError(`视频任务请求失败：无法连接视频接口（${detail}）。暂时无法确认厂商是否收到请求。`);
  }
  const text = await response.text().catch(() => "");
  if (!response.ok) {
    // 方舟 Agent Plan 的视频模型只有 Large / Max 套餐可用；档位不够时给出可执行的升级建议。
    if (endpoint.style === "ark-video" && getArkPlanKind(profile.baseUrl) === "agent" && /UnsupportedModel|does not support (?:the agent plan feature|content generation)/u.test(text)) {
      throw new Error("当前火山方舟 Agent Plan 套餐档位不支持该视频模型：Small / Medium 套餐不含视频生成，需升级到 Large / Max，或改用标准方舟 API Key（/api/v3）后再生成。");
    }
    const message = `视频任务创建失败（${response.status}）：${text.slice(0, 300) || response.statusText}`;
    if (response.status >= 500) throw new VideoSubmissionUncertainError(message);
    throw new Error(message);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new VideoSubmissionUncertainError("视频任务接口返回了无法解析的内容。");
  }
  const parsed = parseVideoTask(payload, endpoint.style);
  if (!parsed.taskId) throw new VideoSubmissionUncertainError("视频任务没有返回任务 ID。");
  return { taskId: parsed.taskId, status: parsed.status, style: endpoint.style };
}

/** 查询视频任务状态。 */
export async function getMediaVideoTask(profile: LlmProfile, taskId: string): Promise<{ status: MediaVideoResult["status"]; videoUrl?: string; message?: string }> {
  const apiKey = profile.apiKey.trim();
  const endpoint = resolveVideoEndpoint(profile.baseUrl);
  const style = endpoint.style;
  const url = style === "ark-video"
    ? `${endpoint.url}/${encodeURIComponent(taskId)}`
    : `${new URL(profile.baseUrl.trim()).origin}/api/v1/tasks/${encodeURIComponent(taskId)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  const text = await response.text().catch(() => "");
  if (!response.ok) throw new Error(`查询视频任务失败（${response.status}）：${text.slice(0, 200) || response.statusText}`);
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error("视频查询接口返回了无法解析的内容。");
  }
  return parseVideoTaskResult(payload, style);
}

/** 创建并轮询视频任务；超时返回 taskId 与当前状态，便于后续用 get_video 查询。 */
export async function generateMediaVideo(profile: LlmProfile, input: MediaVideoInput): Promise<MediaVideoResult> {
  const started = Date.now();
  const created = await createMediaVideoTask(profile, input);
  const waitMs = Math.max(10_000, input.waitMs ?? 240_000);
  const interval = 10_000;
  let status = created.status;
  let videoUrl: string | undefined;
  let message: string | undefined;
  while (status === "PENDING" || status === "RUNNING") {
    if (Date.now() - started >= waitMs) break;
    await new Promise((resolve) => setTimeout(resolve, interval));
    const snapshot = await getMediaVideoTask(profile, created.taskId);
    status = snapshot.status;
    videoUrl = snapshot.videoUrl;
    message = snapshot.message;
    if (status === "FAILED" || status === "CANCELED" || status === "UNKNOWN") break;
  }
  return {
    model: profile.model,
    taskId: created.taskId,
    status,
    ...(videoUrl ? { videoUrl } : {}),
    ...(message ? { message } : {}),
    elapsedMs: Date.now() - started,
  };
}

/** 按配置生成视频（供 Host 服务调用）。 */
export async function generateConfiguredVideo(
  profiles: readonly LlmProfile[],
  activeProfileId: string,
  input: MediaVideoInput,
): Promise<MediaVideoResult> {
  const { profile, modelId } = selectVideoProfile(profiles, activeProfileId, input);
  // 选型可能把 r2v / i2v 换成 t2v：请求体的 model 必须以选型结果为准，
  // 不能被调用方原来的 modelId 覆盖，否则回退失效、厂商仍收到缺参考素材的 r2v。
  const result = await generateMediaVideo({ ...profile, model: modelId }, { ...input, modelId });
  // 带上实际使用的配置，Agent 跨套餐生成时必须能向用户说明用的是哪一套。
  return { ...result, profileId: profile.id, profileName: profile.name };
}

/** 按配置查询视频任务（供 Host 服务调用）。 */
export async function getConfiguredVideoTask(
  profiles: readonly LlmProfile[],
  activeProfileId: string,
  input: { taskId: string; profileId?: string; modelId?: string },
): Promise<MediaVideoResult> {
  const { profile, modelId } = selectVideoProfile(profiles, activeProfileId, input);
  const snapshot = await getMediaVideoTask({ ...profile, model: modelId }, input.taskId);
  return {
    model: modelId,
    profileId: profile.id,
    profileName: profile.name,
    taskId: input.taskId,
    status: snapshot.status,
    ...(snapshot.videoUrl ? { videoUrl: snapshot.videoUrl } : {}),
    ...(snapshot.message ? { message: snapshot.message } : {}),
    elapsedMs: 0,
  };
}

export { generateConfiguredAudio, generateMediaAudio, parseAudioResponse, buildAudioRequestBody, resolveAudioEndpoint, selectAudioProfile, detectLanguageType, type MediaAudioInput, type MediaAudioResult } from "./media-audio";

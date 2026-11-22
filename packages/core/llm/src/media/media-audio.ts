// 媒体生成 · 语音合成：Qwen-TTS / 方舟语音接口适配与模型选择。
import { resolveModelKind } from "../capabilities";
import type { LlmProfile } from "../types";

/** 一次语音合成的入参。 */
export interface MediaAudioInput {
  text: string;
  voice?: string;
  languageType?: string;
  modelId?: string;
  profileId?: string;
}

/** 语音合成结果：返回可下载的音频地址与用量。 */
export interface MediaAudioResult {
  model: string;
  audioUrl?: string;
  audioBase64?: string;
  mime: string;
  expiresAt?: number;
  characters?: number;
  elapsedMs: number;
}

/** 解析语音合成端点：百炼与生图共用同步多模态接口；方舟走 audio/speech。 */
export function resolveAudioEndpoint(baseUrl: string): { url: string; style: "dashscope-tts" | "ark-speech" } {
  const parsed = new URL(baseUrl.trim().replace(/\/+$/u, ""));
  if (parsed.hostname.includes("volces.com")) {
    return { url: `${parsed.origin}/api/v3/audio/speech`, style: "ark-speech" };
  }
  return { url: `${parsed.origin}/api/v1/services/aigc/multimodal-generation/generation`, style: "dashscope-tts" };
}

/** 根据文本粗略推断语言，让语音合成发音更自然。 */
export function detectLanguageType(text: string): string {
  const cjk = (text.match(/[\u4e00-\u9fff]/gu) ?? []).length;
  return cjk > 0 ? "Chinese" : "English";
}

/** 组装语音合成请求体。 */
export function buildAudioRequestBody(
  profile: LlmProfile,
  input: MediaAudioInput,
  style: "dashscope-tts" | "ark-speech" = "dashscope-tts",
): Record<string, unknown> {
  const model = input.modelId?.trim() || profile.model;
  const text = input.text.trim();
  const voice = input.voice?.trim() || "Cherry";
  if (style === "ark-speech") {
    return { model, input: text, voice, response_format: "mp3" };
  }
  return {
    model,
    input: {
      text,
      voice,
      language_type: input.languageType?.trim() || detectLanguageType(text),
    },
  };
}

/** 解析语音合成响应：兼容 output.audio.url/base64 与 data 字段。 */
export function parseAudioResponse(payload: unknown): { audioUrl?: string; audioBase64?: string; expiresAt?: number; characters?: number } {
  const record = (payload ?? {}) as Record<string, unknown>;
  const output = (record.output ?? {}) as Record<string, unknown>;
  const audio = (output.audio ?? {}) as Record<string, unknown>;
  const usage = (record.usage ?? {}) as Record<string, unknown>;
  const url = typeof audio.url === "string" ? audio.url : typeof output.audio_url === "string" ? output.audio_url : undefined;
  const b64 = typeof audio.data === "string" && audio.data ? audio.data : undefined;
  return {
    ...(url ? { audioUrl: url } : {}),
    ...(b64 ? { audioBase64: b64 } : {}),
    ...(typeof audio.expires_at === "number" ? { expiresAt: audio.expires_at } : {}),
    ...(typeof usage.characters === "number" ? { characters: usage.characters } : {}),
  };
}

/** 选语音档案与模型：显式优先，其次含语音模型的档案。 */
export function selectAudioProfile(
  profiles: readonly LlmProfile[],
  activeProfileId: string,
  input: Pick<MediaAudioInput, "profileId" | "modelId">,
): { profile: LlmProfile; modelId: string } {
  const isAudio = (modelId: string) => resolveModelKind(modelId) === "audio";
  // TTS 优先于 ASR/实时语音：优先含 tts 的模型。
  const rank = (modelId: string) => (/tts/u.test(modelId.toLowerCase()) ? 0 : /asr|realtime/u.test(modelId.toLowerCase()) ? 2 : 1);
  const audioModelOf = (profile: LlmProfile): string | undefined =>
    [profile.model, ...(profile.availableModels?.map((model) => model.id) ?? [])]
      .filter((modelId) => isAudio(modelId))
      .sort((a, b) => rank(a) - rank(b))[0];
  if (input.profileId) {
    const profile = profiles.find((item) => item.id === input.profileId);
    if (!profile) throw new Error(`找不到模型配置：${input.profileId}`);
    const modelId = input.modelId?.trim() || audioModelOf(profile);
    if (!modelId || !isAudio(modelId)) throw new Error("该模型配置不是语音合成模型，请选择带 TTS 模型的套餐。");
    return { profile, modelId };
  }
  const candidates = profiles.filter((profile) => Boolean(audioModelOf(profile)));
  if (candidates.length === 0) throw new Error("还没有配置语音合成模型：请在「设置 → 模型管理」中添加包含 TTS 模型的套餐。");
  const profile = candidates.find((item) => item.id === activeProfileId) ?? candidates[0]!;
  return { profile, modelId: input.modelId?.trim() || audioModelOf(profile)! };
}

/** 语音合成（同步），返回音频 URL / base64 与字符用量。 */
export async function generateMediaAudio(profile: LlmProfile, input: MediaAudioInput): Promise<MediaAudioResult> {
  const text = input.text.trim();
  if (!text) throw new Error("语音合成文本不能为空。");
  if (text.length > 600) throw new Error("语音合成文本最多 600 个字符，请分段生成。");
  const apiKey = profile.apiKey.trim();
  if (!apiKey) throw new Error(`模型配置「${profile.name}」尚未设置 API Key，无法生成语音。`);
  const started = Date.now();
  const endpoint = resolveAudioEndpoint(profile.baseUrl);
  const response = await fetch(endpoint.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(buildAudioRequestBody(profile, input, endpoint.style)),
  });
  const raw = await response.text().catch(() => "");
  if (!response.ok) throw new Error(`语音合成失败（${response.status}）：${raw.slice(0, 300) || response.statusText}`);
  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("语音合成接口返回了无法解析的内容。");
  }
  const parsed = parseAudioResponse(payload);
  if (!parsed.audioUrl && !parsed.audioBase64) throw new Error("语音合成接口没有返回音频数据。");
  return {
    model: profile.model,
    mime: "audio/mpeg",
    elapsedMs: Date.now() - started,
    ...parsed,
  };
}

/** 按配置生成语音（供 Host 服务调用）。 */
export async function generateConfiguredAudio(
  profiles: readonly LlmProfile[],
  activeProfileId: string,
  input: MediaAudioInput,
): Promise<MediaAudioResult> {
  const { profile, modelId } = selectAudioProfile(profiles, activeProfileId, input);
  return generateMediaAudio({ ...profile, model: modelId }, input);
}

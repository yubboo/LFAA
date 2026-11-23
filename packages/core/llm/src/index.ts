// @lfaa/llm Host 侧 Cordis 服务：管理模型配置与安全凭据，并驱动思考与推理调用。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { type Context, Service } from "@deepseek-ai/cordis";
import { callAnthropicMessagesApi } from "./adapters/anthropic-adapter";
import { ARK_AGENT_VIDEO_MODELS, findArkChatModel, getArkPlanCatalog, getArkPlanKind } from "./ark-plan";
import { knownMediaModels, listVideoProfileOptions } from "./media/media-models";
import { fetchOfficialModels, normalizeModelCapability, resolveModelCapabilities, resolveModelKind } from "./capabilities";
import { isTokenPlanBaseUrl, tokenPlanCatalogModels } from "./token-plan";
import {
  generateConfiguredAudio,
  generateConfiguredVideo,
  generateMediaImage,
  getConfiguredVideoTask,
  selectImageProfile,
  type MediaImageInput,
  type MediaImageResult,
  type MediaVideoInput,
  type MediaVideoResult,
  type MediaAudioInput,
  type MediaAudioResult,
} from "./media/media";
export type { MediaImageInput, MediaImageResult, MediaVideoInput, MediaVideoResult, MediaAudioInput, MediaAudioResult } from "./media/media";
import { callGeminiGenerateContentApi } from "./adapters/gemini-adapter";
import { callOpenAiCompatibleChat } from "./adapters/openai-adapter";
import { asApiProtocol, resolveEffectiveProtocol } from "./protocol-utils";
import { priceFields, sanitizeStoredConfig, withSelectedModel, asAgentPlanTier, type StoredLlmConfig } from "./config-sanitize";
import { callOpenAiResponsesApi } from "./adapters/responses-adapter";
import type {
  LlmAdapter,
  LlmApiProtocol,
  LlmGenerateInput,
  LlmGenerateOutput,
  LlmProfile,
  LlmProviderKind,
  ModelCapabilityInfo,
  PublicLlmProfile,
  SaveLlmProfileInput,
} from "./types";

// 对外提供模型契约、能力解析与 HTTP 安装入口，应用无需导入 Host 内部模块。
export * from "./types";
export { fetchOfficialModels, formatLlmHttpError, resolveModelCapabilities } from "./capabilities";
export { createLlmHttpHandler } from "./http-handler";
export { asApiProtocol, resolveEffectiveProtocol } from "./protocol-utils";
export { resolveReportedContextWindow } from "./context-window";

/** 允许启动方配置档案文件和适配器，便于测试使用独立存储及模拟模型。 */
export interface LlmPluginConfig {
  storeFilePath?: string;
  adapter?: LlmAdapter;
}

const DEFAULT_LLM_STORE_PATH = join(homedir(), ".lfaa", "llm-config.json");

/** 生成配置页的凭据提示，公共档案只携带脱敏片段。 */
export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}****`;
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}

/** 将 Host 档案转换为可发往浏览器的公开模型配置。 */
export function toPublicProfile(profile: LlmProfile): PublicLlmProfile {
  const apiProtocol = resolveEffectiveProtocol(profile);
  const plan = (apiProtocol === "openai-chat" || apiProtocol === "anthropic-messages")
    ? getArkPlanKind(profile.baseUrl)
    : undefined;
  const synced = knownMediaModels(profile);
  const hasApiKey = profile.apiKey.trim().length > 0;
  // 没有凭据时不展示任何模型：模型必须来自真实配置的接口与套餐，不能凭空出现。
  const usable = hasApiKey || profile.kind === "ollama";
  // 方舟套餐以官方目录为准：语言模型 + 视觉/语音模型都补齐，避免同步接口漏返回时用户选不到 5.0-pro / 5.5。
  const catalogMedia = plan
    ? getArkPlanCatalog(plan).otherGroups
      .filter((group) => group.kind !== "embedding")
      .flatMap((group) => group.models.map((model) => ({
        id: model.id,
        modelKind: (group.kind === "vision" ? "image" : "audio") as "image" | "audio",
        supportsReasoning: false,
        reasoningMode: "none" as const,
        reasoningLevels: [],
      })))
    : [];
  const baseModels = plan
    ? [
      ...getArkPlanCatalog(plan).chatModels,
      ...catalogMedia,
      // 视频模型只在 Large / Max 档位展示；Small / Medium 不把 Seedance 塞进可用清单。
      ...(plan === "agent" && (profile.agentPlanTier === "large" || profile.agentPlanTier === "max")
        ? ARK_AGENT_VIDEO_MODELS.map((id) => resolveModelCapabilities(id, profile.kind))
        : []),
    ]
    // 千问 Token Plan 的 /models 不返回视频模型（如 happyhorse），按官方套餐清单补齐，已返回的以 API 为准。
    : (isTokenPlanBaseUrl(profile.baseUrl) ? tokenPlanCatalogModels(synced) : synced);
  // 目录与同步结果可能重复，按模型 ID 去重后保持「语言 → 视觉/语音 → 已同步补充」的顺序。
  const seenModels = new Set<string>();
  const models = (usable ? baseModels : []).filter((model) => {
    if (seenModels.has(model.id)) return false;
    seenModels.add(model.id);
    return true;
  });
  const currentModel = (plan && findArkChatModel(profile.model)) || resolveModelCapabilities(profile.model, profile.kind);
  const currentIsUnsupportedPlanVideo = plan === "agent" && currentModel.modelKind === "video"
    && profile.agentPlanTier !== "large" && profile.agentPlanTier !== "max";
  if (models.length > 0 && !models.some((model) => model.id === profile.model) && !currentIsUnsupportedPlanVideo) {
    models.unshift(currentModel);
  }
  return {
    id: profile.id,
    ...(profile.providerId ? { providerId: profile.providerId } : {}),
    name: profile.name,
    kind: profile.kind,
    apiProtocol,
    ...(profile.agentPlanTier ? { agentPlanTier: profile.agentPlanTier } : {}),
    baseUrl: profile.baseUrl,
    model: profile.model,
    hasApiKey,
    apiKeyMasked: maskApiKey(profile.apiKey),
    configured: Boolean(profile.configured || hasApiKey),
    availableModels: models,
    ...(typeof profile.temperature === "number" ? { temperature: profile.temperature } : {}),
    ...(typeof profile.maxTokens === "number" ? { maxTokens: profile.maxTokens } : {}),
    // 用户未填写时按模型名/家族推断；仍无法确定则不设值，界面显示"未配置"而不是编造。
    ...(profile.contextWindowTokens && profile.contextWindowTokens > 0
      ? { contextWindowTokens: profile.contextWindowTokens } : {}),
    ...(typeof profile.inputPricePerMillion === "number" ? { inputPricePerMillion: profile.inputPricePerMillion } : {}),
    ...(typeof profile.outputPricePerMillion === "number" ? { outputPricePerMillion: profile.outputPricePerMillion } : {}),
    ...(typeof profile.cachedInputPricePerMillion === "number"
      ? { cachedInputPricePerMillion: profile.cachedInputPricePerMillion }
      : {}),
    updatedAt: profile.updatedAt,
  };
}

async function dispatchByProtocol(profile: LlmProfile, input: LlmGenerateInput): Promise<LlmGenerateOutput> {
  const protocol = resolveEffectiveProtocol(profile);
  if (protocol === "openai-responses") {
    return callOpenAiResponsesApi(profile, input);
  }
  if (protocol === "anthropic-messages") {
    return callAnthropicMessagesApi(profile, input);
  }
  if (protocol === "gemini-generate-content") {
    return callGeminiGenerateContentApi(profile, input);
  }
  return callOpenAiCompatibleChat(profile, input);
}

// Host 侧 LLM 大脑服务：管理模型配置并将推理任务按协议分发至对应适配器。
export class LlmService extends Service {
  private readonly storeFilePath: string;
  private readonly adapter: LlmAdapter;

  constructor(ctx: Context, config: LlmPluginConfig = {}) {
    super(ctx, "llm");
    this.storeFilePath = config.storeFilePath ? resolve(config.storeFilePath) : DEFAULT_LLM_STORE_PATH;
    this.adapter = config.adapter ?? dispatchByProtocol;
  }

  private async readConfig(): Promise<StoredLlmConfig> {
    try {
      const raw = await readFile(this.storeFilePath, "utf8");
      let repaired = false;
      const config = sanitizeStoredConfig(JSON.parse(raw), () => { repaired = true; });
      // 修复了历史乱码名称就立即回写，避免每次启动都重复修复。
      if (repaired) await this.writeConfig(config).catch(() => {});
      return config;
    } catch {
      return sanitizeStoredConfig(null);
    }
  }

  private async writeConfig(config: StoredLlmConfig): Promise<void> {
    await mkdir(dirname(this.storeFilePath), { recursive: true });
    await writeFile(this.storeFilePath, JSON.stringify(config, null, 2), "utf8");
  }

  /** 生成图片：按档案找到厂商图片接口并返回图片数据。 */
  async generateImage(input: MediaImageInput): Promise<MediaImageResult> {
    const config = await this.readConfig();
    const { profile, modelId } = selectImageProfile(config.profiles, config.activeProfileId, input);
    return { ...await generateMediaImage({ ...profile, model: modelId }, input), profileId: profile.id };
  }

  /** 生成视频：默认只用当前配置，绝不静默跨套餐；跨套餐必须由调用方显式传 profileId。 */
  async generateVideo(input: MediaVideoInput): Promise<MediaVideoResult> {
    const config = await this.readConfig();
    const explicitProfileId = input.profileId?.trim();
    const targetProfileId = explicitProfileId || config.activeProfileId;
    try {
      return await generateConfiguredVideo(config.profiles, config.activeProfileId, { ...input, profileId: targetProfileId });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const options = listVideoProfileOptions(config.profiles).filter((option) => option.profileId !== targetProfileId);
      // 没显式指定套餐时，把其他可选视频配置交给 Agent，让它先征询用户，而不是偷偷换厂商。
      if (explicitProfileId || options.length === 0) throw error;
      const available = options.map((option) => `「${option.profileName}」${option.models.join("、")}`).join("；");
      throw new Error(`${detail}\n\n其他可用视频配置：${available}。请先向用户说明当前配置没有可用视频模型，并询问是否切换；用户同意后再调用 generate_video 并传 profileId。`);
    }
  }

  /** 查询视频任务：默认沿用当前配置；跨套餐任务需显式传 profileId。 */
  async getVideoTask(input: { taskId: string; profileId?: string; modelId?: string }): Promise<MediaVideoResult> {
    const config = await this.readConfig();
    const targetProfileId = input.profileId?.trim() || config.activeProfileId;
    return getConfiguredVideoTask(config.profiles, config.activeProfileId, { ...input, profileId: targetProfileId });
  }

  /** 语音合成：按配置调用 TTS 模型，返回可下载的音频地址。 */
  async generateAudio(input: MediaAudioInput): Promise<MediaAudioResult> {
    const config = await this.readConfig();
    return generateConfiguredAudio(config.profiles, config.activeProfileId, input);
  }

  async listPublicProfiles(): Promise<{ activeProfileId: string; profiles: PublicLlmProfile[] }> {
    const config = await this.readConfig();
    return {
      activeProfileId: config.activeProfileId,
      profiles: config.profiles.map(toPublicProfile),
    };
  }

  async setActiveProfile(profileId: string): Promise<string> {
    const config = await this.readConfig();
    if (!config.profiles.some((p) => p.id === profileId)) {
      throw new Error(`找不到模型配置：${profileId}`);
    }
    await this.writeConfig({ ...config, activeProfileId: profileId });
    return profileId;
  }

  async saveProfile(input: SaveLlmProfileInput): Promise<PublicLlmProfile> {
    const name = input.name.trim();
    const baseUrl = input.baseUrl.trim();
    const model = input.model.trim();
    if (!name || !baseUrl || !model) {
      throw new Error("模型名称、接口地址与模型 ID 不能为空。");
    }
    const parsedUrl = new URL(baseUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("接口地址必须为 http 或 https。");
    }

    const config = await this.readConfig();
    const existing = input.id ? config.profiles.find((p) => p.id === input.id) : undefined;
    const providerId = input.providerId?.trim() || existing?.providerId;
    const apiProtocol = asApiProtocol(input.apiProtocol) ?? existing?.apiProtocol;
    const finalApiKey = input.apiKey !== undefined ? input.apiKey.trim() : (existing?.apiKey ?? "");
    const availableModels = input.availableModels ?? existing?.availableModels;
    const configured = input.configured ?? (finalApiKey.length > 0 || input.kind === "ollama");
    // Agent Plan 档位决定是否展示 Seedance；未选择时按 Medium 处理，避免把 Large/Max 的视频模型给 Medium。
    const isAgentPlan = providerId === "volcengine-agent-plan" || getArkPlanKind(baseUrl) === "agent";
    const agentPlanTier = isAgentPlan
      ? (asAgentPlanTier(input.agentPlanTier) ?? existing?.agentPlanTier ?? "medium")
      : undefined;
    // Small / Medium 不能把 Seedance 存成当前模型，否则模型卡片会显示一个不在可用清单里的模型。
    const finalModel = isAgentPlan && agentPlanTier !== "large" && agentPlanTier !== "max" && resolveModelKind(model) === "video"
      ? "ark-code-latest"
      : model;
    const nextProfile: LlmProfile = {
      id: existing?.id ?? input.id?.trim() ?? randomUUID(),
      ...(providerId ? { providerId } : {}),
      name,
      kind: input.kind,
      ...(apiProtocol ? { apiProtocol } : {}),
      ...(agentPlanTier ? { agentPlanTier } : {}),
      baseUrl: baseUrl.replace(/\/+$/u, ""),
      model: finalModel,
      apiKey: finalApiKey,
      configured,
      ...(availableModels && availableModels.length > 0 ? { availableModels } : {}),
      ...(typeof input.temperature === "number" ? { temperature: input.temperature } : {}),
      ...(typeof input.maxTokens === "number" ? { maxTokens: input.maxTokens } : {}),
      ...(typeof input.contextWindowTokens === "number" && input.contextWindowTokens > 0
        ? { contextWindowTokens: Math.floor(input.contextWindowTokens) }
        : existing?.model === finalModel && existing.contextWindowTokens !== undefined
          ? { contextWindowTokens: existing.contextWindowTokens }
          : {}),
      ...priceFields(input, existing),
      updatedAt: Date.now(),
    };

    const profiles = existing
      ? config.profiles.map((p) => (p.id === nextProfile.id ? nextProfile : p))
      : [...config.profiles, nextProfile];
    const activeProfileId = existing ? config.activeProfileId : nextProfile.id;
    await this.writeConfig({ activeProfileId, profiles });
    return toPublicProfile(nextProfile);
  }

  async removeProfile(profileId: string): Promise<boolean> {
    const config = await this.readConfig();
    const nextProfiles = config.profiles.filter((p) => p.id !== profileId);
    if (nextProfiles.length === config.profiles.length) return false;
    if (nextProfiles.length === 0) {
      throw new Error("至少需保留一个模型配置。");
    }
    const activeProfileId = nextProfiles.some((p) => p.id === config.activeProfileId)
      ? config.activeProfileId
      : nextProfiles[0]!.id;
    await this.writeConfig({ activeProfileId, profiles: nextProfiles });
    return true;
  }

  async resolveProfile(profileId?: string): Promise<LlmProfile> {
    const config = await this.readConfig();
    const targetId = profileId || config.activeProfileId;
    const found = config.profiles.find((p) => p.id === targetId);
    if (!found) {
      throw new Error("当前没有可用的模型配置。");
    }
    return found;
  }

  async complete(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    const profile = await this.resolveProfile(input.profileId);
    // 允许在同一个配置里临时指定对话模型：图片配置里通常也带对话模型，提示词扩写就复用它。
    const model = input.modelId?.trim() || profile.model;
    if (resolveModelKind(model) !== "chat") throw new Error("此模型用于媒体生成，请使用相应的生成入口。");
    return this.adapter({ ...profile, model }, input);
  }

  async listRemoteModels(input: {
    profileId?: string;
    kind?: LlmProviderKind;
    apiProtocol?: LlmApiProtocol;
    baseUrl?: string;
    apiKey?: string;
  }): Promise<ModelCapabilityInfo[]> {
    const config = await this.readConfig();
    const existing = input.profileId ? config.profiles.find((p) => p.id === input.profileId) : undefined;
    const kind = input.kind ?? existing?.kind ?? "openai-compatible";
    const apiProtocol = asApiProtocol(input.apiProtocol) ?? existing?.apiProtocol;
    const baseUrl = input.baseUrl?.trim() || existing?.baseUrl || "";
    const apiKey = input.apiKey?.trim() || existing?.apiKey || "";
    let models: ModelCapabilityInfo[];
    try {
      models = await fetchOfficialModels({
        kind,
        ...(apiProtocol ? { apiProtocol } : {}),
        baseUrl,
        apiKey,
      });
    } catch (err) {
      const arkKind = getArkPlanKind(baseUrl);
      if (!arkKind) throw err;
      // 部分套餐端点不开放 /models，同步时回退到最新官方套餐目录。
      models = getArkPlanCatalog(arkKind).chatModels.map((m) => normalizeModelCapability(m, kind));
    }
    // 千问 Token Plan 的 /models 不返回视频模型，按官方套餐清单补齐，保证套餐内模型都能选到。
    if (isTokenPlanBaseUrl(baseUrl)) models = tokenPlanCatalogModels(models);
    if (existing) {
      const nextModel = models.some((m) => m.id === existing.model) ? existing.model : (models[0]?.id ?? existing.model);
      const updated = config.profiles.map((p) =>
        p.id === existing.id
          ? {
              ...withSelectedModel(p, nextModel),
              ...(apiProtocol ? { apiProtocol } : {}),
              availableModels: models,
              configured: true,
              updatedAt: Date.now(),
            }
          : p,
      );
      await this.writeConfig({ ...config, profiles: updated });
    }
    return models;
  }

  async selectProfileModel(profileId: string, modelId: string): Promise<PublicLlmProfile> {
    const cleanModel = modelId.trim();
    if (!cleanModel) throw new Error("模型 ID 不能为空。");
    const config = await this.readConfig();
    const found = config.profiles.find((p) => p.id === profileId);
    if (!found) throw new Error(`找不到模型配置：${profileId}`);
    // Medium / Small 档位不能选视频模型；即使前端漏出 Seedance，这里也直接拒绝。
    if (getArkPlanKind(found.baseUrl) === "agent"
      && found.agentPlanTier !== "large" && found.agentPlanTier !== "max"
      && resolveModelKind(cleanModel) === "video") {
      throw new Error("当前火山方舟 Agent Plan 档位不支持视频模型：Small / Medium 需升级到 Large / Max。");
    }
    const nextList = config.profiles.map((p) =>
      p.id === profileId ? { ...withSelectedModel(p, cleanModel), updatedAt: Date.now() } : p,
    );
    await this.writeConfig({ activeProfileId: profileId, profiles: nextList });
    const updated = nextList.find((p) => p.id === profileId)!;
    return toPublicProfile(updated);
  }

  async testConnection(profileId?: string): Promise<{ ok: boolean; model: string; replyPreview: string }> {
    const output = await this.complete({
      ...(profileId !== undefined ? { profileId } : {}),
      messages: [
        { role: "system", content: "Reply with OK only." },
        { role: "user", content: "Ping" },
      ],
      maxTokens: 16,
      temperature: 0,
    });
    return {
      ok: true,
      model: output.model,
      replyPreview: output.content.trim().slice(0, 80) || "OK",
    };
  }
}

/** 为 Host Cordis 上下文注册 LLM 服务，测试可注入独立的存储路径和适配器。 */
export function llmPlugin(context: Context, config: LlmPluginConfig = {}): void {
  new LlmService(context, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    llm: LlmService;
  }
}
/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default llmPlugin;

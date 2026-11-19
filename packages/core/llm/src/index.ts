// @lfaa/llm Host 侧 Cordis 服务：管理模型配置与安全凭据，并驱动思考与推理调用。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { type Context, Service } from "@deepseek-ai/cordis";
import { callAnthropicMessagesApi } from "./anthropic-adapter";
import { findArkChatModel, getArkPlanCatalog, getArkPlanKind } from "./ark-plan";
import { fetchOfficialModels, normalizeModelCapability, resolveModelCapabilities } from "./capabilities";
import { callGeminiGenerateContentApi } from "./gemini-adapter";
import { callOpenAiCompatibleChat } from "./openai-adapter";
import { asApiProtocol, resolveEffectiveProtocol } from "./protocol-utils";
import { callOpenAiResponsesApi } from "./responses-adapter";
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

/** 允许启动方配置档案文件和适配器，便于测试使用独立存储及模拟模型。 */
export interface LlmPluginConfig {
  storeFilePath?: string;
  adapter?: LlmAdapter;
}

interface StoredLlmConfig {
  activeProfileId: string;
  profiles: LlmProfile[];
}

const DEFAULT_LLM_STORE_PATH = join(homedir(), ".lfaa", "llm-config.json");

function createDefaultProfiles(): LlmProfile[] {
  const now = Date.now();
  return [
    {
      id: "deepseek-chat",
      name: "DeepSeek Chat",
      kind: "deepseek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: "",
      temperature: 0.3,
      updatedAt: now,
    },
    {
      id: "openai-gpt4o",
      name: "OpenAI Compatible",
      kind: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      apiKey: "",
      temperature: 0.3,
      updatedAt: now,
    },
    {
      id: "ollama-local",
      name: "Ollama 本地模型",
      kind: "ollama",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "qwen2.5-coder:7b",
      apiKey: "",
      temperature: 0.2,
      updatedAt: now,
    },
  ];
}

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
  // 方舟 Chat 档案使用套餐目录，同时保留用户之前保存的自定义模型 ID。
  const models =
    plan ? [
      ...(findArkChatModel(profile.model) ? [] : [
        { id: profile.model, supportsReasoning: false, reasoningMode: "none" as const, reasoningLevels: [] },
      ]),
      ...getArkPlanCatalog(plan).chatModels,
    ] : profile.availableModels && profile.availableModels.length > 0
        ? profile.availableModels.map((m) => normalizeModelCapability(m, profile.kind))
        : [resolveModelCapabilities(profile.model, profile.kind)];
  const hasApiKey = profile.apiKey.trim().length > 0;
  return {
    id: profile.id,
    ...(profile.providerId ? { providerId: profile.providerId } : {}),
    name: profile.name,
    kind: profile.kind,
    apiProtocol,
    baseUrl: profile.baseUrl,
    model: profile.model,
    hasApiKey,
    apiKeyMasked: maskApiKey(profile.apiKey),
    configured: Boolean(profile.configured || hasApiKey),
    availableModels: models,
    ...(typeof profile.temperature === "number" ? { temperature: profile.temperature } : {}),
    ...(typeof profile.maxTokens === "number" ? { maxTokens: profile.maxTokens } : {}),
    ...(typeof profile.contextWindowTokens === "number" && profile.contextWindowTokens > 0
      ? { contextWindowTokens: profile.contextWindowTokens }
      : {}),
    ...(typeof profile.inputPricePerMillion === "number" ? { inputPricePerMillion: profile.inputPricePerMillion } : {}),
    ...(typeof profile.outputPricePerMillion === "number" ? { outputPricePerMillion: profile.outputPricePerMillion } : {}),
    ...(typeof profile.cachedInputPricePerMillion === "number"
      ? { cachedInputPricePerMillion: profile.cachedInputPricePerMillion }
      : {}),
    updatedAt: profile.updatedAt,
  };
}

function isValidProviderKind(kind: unknown): kind is LlmProviderKind {
  return kind === "openai-compatible" || kind === "deepseek" || kind === "ollama";
}

function sanitizeStoredConfig(raw: unknown): StoredLlmConfig {
  if (typeof raw !== "object" || raw === null) {
    const defaults = createDefaultProfiles();
    return { activeProfileId: defaults[0]!.id, profiles: defaults };
  }
  const record = raw as Record<string, unknown>;
  const profiles: LlmProfile[] = Array.isArray(record.profiles)
    ? record.profiles
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .filter(
          (item) =>
            typeof item.id === "string"
            && typeof item.name === "string"
            && isValidProviderKind(item.kind)
            && typeof item.baseUrl === "string"
            && typeof item.model === "string",
        )
        .map((item) => {
          const kind = item.kind as LlmProviderKind;
          const modelStr = item.model as string;
          const apiKeyStr = typeof item.apiKey === "string" ? item.apiKey : "";
          const rawModels = Array.isArray(item.availableModels) ? item.availableModels : [];
          const parsedModels: ModelCapabilityInfo[] = rawModels
            .filter((m): m is ModelCapabilityInfo => typeof m === "object" && m !== null && typeof (m as { id?: unknown }).id === "string")
            .map((m) => normalizeModelCapability(m, kind));
          const apiProtocol = asApiProtocol(item.apiProtocol);
          return {
            id: item.id as string,
            ...(typeof item.providerId === "string" && item.providerId.trim() ? { providerId: item.providerId.trim() } : {}),
            name: item.name as string,
            kind,
            ...(apiProtocol ? { apiProtocol } : {}),
            baseUrl: item.baseUrl as string,
            model: modelStr,
            apiKey: apiKeyStr,
            ...(typeof item.configured === "boolean" ? { configured: item.configured } : {}),
            ...(parsedModels.length > 0 ? { availableModels: parsedModels } : {}),
            ...(typeof item.temperature === "number" ? { temperature: item.temperature } : {}),
            ...(typeof item.maxTokens === "number" ? { maxTokens: item.maxTokens } : {}),
            ...(typeof item.contextWindowTokens === "number" && item.contextWindowTokens > 0
              ? { contextWindowTokens: Math.floor(item.contextWindowTokens) }
              : {}),
            ...(typeof item.inputPricePerMillion === "number" ? { inputPricePerMillion: item.inputPricePerMillion } : {}),
            ...(typeof item.outputPricePerMillion === "number" ? { outputPricePerMillion: item.outputPricePerMillion } : {}),
            ...(typeof item.cachedInputPricePerMillion === "number"
              ? { cachedInputPricePerMillion: item.cachedInputPricePerMillion }
              : {}),
            updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
          };
        })
    : [];

  if (profiles.length === 0) {
    const defaults = createDefaultProfiles();
    return { activeProfileId: defaults[0]!.id, profiles: defaults };
  }

  const activeId =
    typeof record.activeProfileId === "string" && profiles.some((p) => p.id === record.activeProfileId)
      ? record.activeProfileId
      : profiles[0]!.id;

  return { activeProfileId: activeId, profiles };
}

/** 校验并保留非负单价；未提供时沿用已有值。 */
function readPrice(input: number | undefined, existing: number | undefined): number | undefined {
  if (typeof input === "number" && Number.isFinite(input) && input >= 0) return input;
  return existing;
}

/** 组装模型档案的计价字段，未提供的沿用已有值。 */
function priceFields(
  input: Pick<SaveLlmProfileInput, "inputPricePerMillion" | "outputPricePerMillion" | "cachedInputPricePerMillion">,
  existing: LlmProfile | undefined,
): Pick<LlmProfile, "inputPricePerMillion" | "outputPricePerMillion" | "cachedInputPricePerMillion"> {
  const inputPrice = readPrice(input.inputPricePerMillion, existing?.inputPricePerMillion);
  const outputPrice = readPrice(input.outputPricePerMillion, existing?.outputPricePerMillion);
  const cachedPrice = readPrice(input.cachedInputPricePerMillion, existing?.cachedInputPricePerMillion);
  return {
    ...(inputPrice !== undefined ? { inputPricePerMillion: inputPrice } : {}),
    ...(outputPrice !== undefined ? { outputPricePerMillion: outputPrice } : {}),
    ...(cachedPrice !== undefined ? { cachedInputPricePerMillion: cachedPrice } : {}),
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
      return sanitizeStoredConfig(JSON.parse(raw));
    } catch {
      return sanitizeStoredConfig(null);
    }
  }

  private async writeConfig(config: StoredLlmConfig): Promise<void> {
    await mkdir(dirname(this.storeFilePath), { recursive: true });
    await writeFile(this.storeFilePath, JSON.stringify(config, null, 2), "utf8");
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
    const nextProfile: LlmProfile = {
      id: existing?.id ?? input.id?.trim() ?? randomUUID(),
      ...(providerId ? { providerId } : {}),
      name,
      kind: input.kind,
      ...(apiProtocol ? { apiProtocol } : {}),
      baseUrl: baseUrl.replace(/\/+$/u, ""),
      model,
      apiKey: finalApiKey,
      configured,
      ...(availableModels && availableModels.length > 0 ? { availableModels } : {}),
      ...(typeof input.temperature === "number" ? { temperature: input.temperature } : {}),
      ...(typeof input.maxTokens === "number" ? { maxTokens: input.maxTokens } : {}),
      ...(typeof input.contextWindowTokens === "number" && input.contextWindowTokens > 0
        ? { contextWindowTokens: Math.floor(input.contextWindowTokens) }
        : existing?.contextWindowTokens !== undefined
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
    return this.adapter(profile, input);
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
    if (existing) {
      const nextModel = models.some((m) => m.id === existing.model) ? existing.model : (models[0]?.id ?? existing.model);
      const updated = config.profiles.map((p) =>
        p.id === existing.id
          ? {
              ...p,
              ...(apiProtocol ? { apiProtocol } : {}),
              model: nextModel,
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
    const nextList = config.profiles.map((p) =>
      p.id === profileId ? { ...p, model: cleanModel, updatedAt: Date.now() } : p,
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

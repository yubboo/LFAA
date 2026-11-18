// @lfaa/llm Host 侧 Cordis 服务：管理模型配置与安全凭据，并驱动思考与推理调用。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { type Context, Service } from "@deepseek-ai/cordis";
import { callOpenAiCompatibleChat } from "./openai-adapter";
import type {
  LlmAdapter,
  LlmGenerateInput,
  LlmGenerateOutput,
  LlmProfile,
  LlmProviderKind,
  PublicLlmProfile,
  SaveLlmProfileInput,
} from "./types";

export * from "./types";
export { createLlmHttpHandler } from "./http-handler";

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

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}****`;
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}

export function toPublicProfile(profile: LlmProfile): PublicLlmProfile {
  return {
    id: profile.id,
    name: profile.name,
    kind: profile.kind,
    baseUrl: profile.baseUrl,
    model: profile.model,
    hasApiKey: profile.apiKey.trim().length > 0,
    apiKeyMasked: maskApiKey(profile.apiKey),
    ...(typeof profile.temperature === "number" ? { temperature: profile.temperature } : {}),
    ...(typeof profile.maxTokens === "number" ? { maxTokens: profile.maxTokens } : {}),
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
        .map((item) => ({
          id: item.id as string,
          name: item.name as string,
          kind: item.kind as LlmProviderKind,
          baseUrl: item.baseUrl as string,
          model: item.model as string,
          apiKey: typeof item.apiKey === "string" ? item.apiKey : "",
          ...(typeof item.temperature === "number" ? { temperature: item.temperature } : {}),
          ...(typeof item.maxTokens === "number" ? { maxTokens: item.maxTokens } : {}),
          updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
        }))
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

// Host 侧 LLM 大脑服务：管理模型配置并将推理任务转发给标准适配器。
export class LlmService extends Service {
  private readonly storeFilePath: string;
  private readonly adapter: LlmAdapter;

  constructor(ctx: Context, config: LlmPluginConfig = {}) {
    super(ctx, "llm");
    this.storeFilePath = config.storeFilePath ? resolve(config.storeFilePath) : DEFAULT_LLM_STORE_PATH;
    this.adapter = config.adapter ?? callOpenAiCompatibleChat;
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
    const nextProfile: LlmProfile = {
      id: existing?.id ?? input.id?.trim() ?? randomUUID(),
      name,
      kind: input.kind,
      baseUrl: baseUrl.replace(/\/+$/u, ""),
      model,
      apiKey: input.apiKey !== undefined ? input.apiKey.trim() : (existing?.apiKey ?? ""),
      ...(typeof input.temperature === "number" ? { temperature: input.temperature } : {}),
      ...(typeof input.maxTokens === "number" ? { maxTokens: input.maxTokens } : {}),
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

export function llmPlugin(context: Context, config: LlmPluginConfig = {}): void {
  new LlmService(context, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    llm: LlmService;
  }
}

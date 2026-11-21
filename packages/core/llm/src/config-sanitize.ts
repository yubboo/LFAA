// 模型配置的读取清洗：兼容历史字段、修复乱码名称，并生成默认档案。
import { normalizeModelCapability } from "./capabilities";
import { asApiProtocol } from "./protocol-utils";
import type { SaveLlmProfileInput } from "./index";
import { repairMojibakeText } from "./text-repair";
import type { LlmProfile, LlmProviderKind, ModelCapabilityInfo } from "./types";

export interface StoredLlmConfig {
  activeProfileId: string;
  profiles: LlmProfile[];
}

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

function isValidProviderKind(kind: unknown): kind is LlmProviderKind {
  return kind === "openai-compatible" || kind === "deepseek" || kind === "ollama";
}

export function sanitizeStoredConfig(raw: unknown, onRepair?: () => void): StoredLlmConfig {
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

  // 修复历史数据里被错误按 GBK 保存的 UTF-8 名称（如「鍗冮棶」→「千问」）。
  const repairedProfiles = profiles.map((profile) => {
    const name = repairMojibakeText(profile.name);
    const models = profile.availableModels?.map((model) => {
      const displayName = model.displayName ? repairMojibakeText(model.displayName) : undefined;
      return displayName && displayName !== model.displayName ? { ...model, displayName } : model;
    });
    if (name !== profile.name || models?.some((model, index) => model !== profile.availableModels?.[index])) onRepair?.();
    return { ...profile, name, ...(models ? { availableModels: models } : {}) };
  });
  return { activeProfileId: activeId, profiles: repairedProfiles };
}

/** 校验并保留非负单价；未提供时沿用已有值。 */
function readPrice(input: number | undefined, existing: number | undefined): number | undefined {
  if (typeof input === "number" && Number.isFinite(input) && input >= 0) return input;
  return existing;
}

/** 手动配置的窗口只适用于对应模型。 */
export function withSelectedModel(profile: LlmProfile, model: string): LlmProfile {
  if (profile.model === model) return profile;
  const { contextWindowTokens: _oldWindow, ...rest } = profile;
  return { ...rest, model };
}

/** 组装模型档案的计价字段，未提供的沿用已有值。 */
export function priceFields(
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

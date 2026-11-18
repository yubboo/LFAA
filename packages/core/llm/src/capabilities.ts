// 解析并优先采信模型提供商 /models 返回的真实思考强度能力（effort.supported_levels），无多档参数时不虚构假数据。
import { isDeepSeekEndpoint, resolveEffectiveProtocol } from "./protocol-utils";
import type { LlmApiProtocol, LlmProviderKind, ModelCapabilityInfo, ReasoningEffortLevel } from "./types";

const VALID_LEVELS = new Set<ReasoningEffortLevel>(["minimal", "low", "medium", "high", "max"]);

/** 校验外部返回的思考档位，只将内部契约支持的值提供给上层。 */
export function asReasoningLevel(raw: unknown): ReasoningEffortLevel | undefined {
  return typeof raw === "string" && VALID_LEVELS.has(raw as ReasoningEffortLevel)
    ? (raw as ReasoningEffortLevel)
    : undefined;
}

// 当 /models 接口未附带 effort 元数据时，基于公开模型家族规格兜底判断能力。
export function resolveModelCapabilities(
  rawModelId: string,
  _kind?: LlmProviderKind,
): ModelCapabilityInfo {
  const id = rawModelId.trim();
  const lower = id.toLowerCase();

  if (
    lower.includes("deepseek-reasoner") ||
    lower.includes("deepseek-r1") ||
    lower.startsWith("qwq") ||
    lower.includes("-thinking")
  ) {
    return {
      id,
      supportsReasoning: true,
      reasoningMode: "fixed",
      reasoningLevels: ["high"],
      defaultReasoningLevel: "high",
    };
  }

  if (/^gpt-5\b/u.test(lower) || lower.includes("/gpt-5")) {
    return {
      id,
      supportsReasoning: true,
      reasoningMode: "effort",
      reasoningLevels: ["minimal", "low", "medium", "high"],
      defaultReasoningLevel: "medium",
    };
  }

  if (
    /^(?:o1|o3|o4)(?:-|$)/u.test(lower) ||
    lower.includes("/o1") ||
    lower.includes("/o3") ||
    lower.includes("/o4") ||
    lower.includes("gemini-2.5") ||
    lower.includes("gemini-3") ||
    lower.includes("claude-3-7") ||
    lower.includes("claude-sonnet-4") ||
    lower.includes("claude-opus-4") ||
    lower.includes("glm-z1")
  ) {
    return {
      id,
      supportsReasoning: true,
      reasoningMode: "effort",
      reasoningLevels: ["low", "medium", "high"],
      defaultReasoningLevel: "medium",
    };
  }

  if (lower.includes("grok-3-mini")) {
    return {
      id,
      supportsReasoning: true,
      reasoningMode: "effort",
      reasoningLevels: ["low", "high"],
      defaultReasoningLevel: "low",
    };
  }

  return {
    id,
    supportsReasoning: false,
    reasoningMode: "none",
    reasoningLevels: [],
  };
}

/** 清理远程或历史能力数据，缺少档位时交给模型家族规则兜底。 */
export function normalizeModelCapability(
  raw: Partial<ModelCapabilityInfo> & { id: string },
  kind?: LlmProviderKind,
): ModelCapabilityInfo {
  const id = raw.id.trim();
  if (raw.reasoningMode === "effort" && Array.isArray(raw.reasoningLevels) && raw.reasoningLevels.length > 0) {
    const cleanLevels = raw.reasoningLevels.map((l) => asReasoningLevel(l)).filter((l): l is ReasoningEffortLevel => Boolean(l));
    if (cleanLevels.length > 0) {
      const def = asReasoningLevel(raw.defaultReasoningLevel);
      return {
        id,
        ...(raw.displayName ? { displayName: raw.displayName } : {}),
        supportsReasoning: true,
        reasoningMode: "effort",
        reasoningLevels: cleanLevels,
        ...(def && cleanLevels.includes(def) ? { defaultReasoningLevel: def } : { defaultReasoningLevel: cleanLevels[0]! }),
      };
    }
  }
  const fallback = resolveModelCapabilities(id, kind);
  return {
    ...fallback,
    ...(raw.displayName ? { displayName: raw.displayName } : {}),
  };
}

/** 把界面选择限制到模型可用档位，并处理不兼容或缺失值的回退。 */
export function mapEffortForModelApi(
  effort: ReasoningEffortLevel | undefined,
  capability: ModelCapabilityInfo,
): ReasoningEffortLevel | undefined {
  if (capability.reasoningMode !== "effort" || capability.reasoningLevels.length === 0) return undefined;
  if (effort && capability.reasoningLevels.includes(effort)) return effort;
  if (effort === "max" && !capability.reasoningLevels.includes("max") && capability.reasoningLevels.includes("high")) {
    return "high";
  }
  if (effort === "minimal" && !capability.reasoningLevels.includes("minimal") && capability.reasoningLevels.includes("low")) {
    return "low";
  }
  return capability.defaultReasoningLevel ?? capability.reasoningLevels[0];
}

interface RawRemoteModelEntry {
  id?: unknown;
  name?: unknown;
  display_name?: unknown;
  displayName?: unknown;
  supportedGenerationMethods?: unknown;
  effort?: {
    supported_levels?: unknown;
    default_level?: unknown;
  };
}

function parseRemoteModelItem(raw: RawRemoteModelEntry, kind: LlmProviderKind): ModelCapabilityInfo | null {
  if (
    Array.isArray(raw.supportedGenerationMethods)
    && !raw.supportedGenerationMethods.includes("generateContent")
  ) {
    return null;
  }
  const rawId = typeof raw.id === "string" && raw.id.trim()
    ? raw.id.trim()
    : (typeof raw.name === "string" ? raw.name.trim() : "");
  const id = rawId.replace(/^models\//u, "");
  if (!id) return null;
  const displayName =
    (typeof raw.displayName === "string" && raw.displayName.trim())
    || (typeof raw.display_name === "string" && raw.display_name.trim())
    || (typeof raw.name === "string" && raw.name.trim() && raw.name.trim() !== rawId ? raw.name.trim() : undefined);

  const rawLevels = Array.isArray(raw.effort?.supported_levels) ? raw.effort.supported_levels : [];
  const parsedLevels = rawLevels
    .map((lvl) => asReasoningLevel(lvl))
    .filter((lvl): lvl is ReasoningEffortLevel => Boolean(lvl));

  if (parsedLevels.length > 0) {
    const def = asReasoningLevel(raw.effort?.default_level);
    return {
      id,
      ...(displayName ? { displayName } : {}),
      supportsReasoning: true,
      reasoningMode: "effort",
      reasoningLevels: parsedLevels,
      defaultReasoningLevel: def && parsedLevels.includes(def) ? def : parsedLevels[0]!,
    };
  }

  const fallback = resolveModelCapabilities(id, kind);
  return {
    ...fallback,
    ...(displayName ? { displayName } : {}),
  };
}

/** 为 DeepSeek 目录补充可辨认的官方版本显示名，保留实际调用 ID。 */
export async function enrichDeepSeekReleaseNames(
  models: ModelCapabilityInfo[],
  docsUrl = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing",
): Promise<ModelCapabilityInfo[]> {
  try {
    const res = await fetch(docsUrl, {
      method: "GET",
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return models;
    const html = await res.text();
    // 从 DeepSeek 官方定价与模型文档实时提取带日期版本号的发布名（如 DeepSeek-V4.1-Flash-1017 / DeepSeek-V4-Pro-0813）
    const releaseTags = [...new Set(html.match(/DeepSeek-[A-Za-z0-9._-]+-\d{4}/g) ?? [])];
    if (releaseTags.length === 0) return models;

    return models.map((item) => {
      const baseName = item.displayName?.trim();
      if (!baseName) return item;
      const matched = releaseTags.find(
        (tag) => tag === baseName || tag.toLowerCase().startsWith(`${baseName.toLowerCase()}-`),
      );
      return matched ? { ...item, displayName: matched } : item;
    });
  } catch {
    return models;
  }
}

/** 按生效协议查询模型目录，解析真实能力并将接口错误反馈给配置页。 */
export async function fetchOfficialModels(params: {
  kind: LlmProviderKind;
  apiProtocol?: LlmApiProtocol;
  baseUrl: string;
  apiKey?: string;
}): Promise<ModelCapabilityInfo[]> {
  const normalizedBase = params.baseUrl.trim().replace(/\/+$/u, "");
  const parsed = new URL(normalizedBase);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("接口地址仅支持 http 或 https 协议。");
  }

  const key = params.apiKey?.trim() ?? "";
  if (!key && params.kind !== "ollama") {
    throw new Error("请先填写 API Key 再获取官方模型列表。");
  }

  const effectiveProtocol = resolveEffectiveProtocol({
    ...(params.apiProtocol ? { apiProtocol: params.apiProtocol } : {}),
    kind: params.kind,
    baseUrl: normalizedBase,
  });

  const headers: Record<string, string> = { Accept: "application/json" };
  const candidateEndpoints: string[] = [];

  if (effectiveProtocol === "gemini-generate-content") {
    const geminiBase = normalizedBase.replace(/\/openai$/iu, "");
    if (key) headers["x-goog-api-key"] = key;
    candidateEndpoints.push(geminiBase.endsWith("/models") ? geminiBase : `${geminiBase}/models`);
  } else if (effectiveProtocol === "anthropic-messages") {
    if (key) {
      headers["x-api-key"] = key;
      headers["anthropic-version"] = "2023-06-01";
      headers.Authorization = `Bearer ${key}`;
    }
    const cleanBase = normalizedBase.replace(/\/messages$/iu, "");
    candidateEndpoints.push(cleanBase.endsWith("/v1") ? `${cleanBase}/models` : `${cleanBase}/v1/models`);
    if (isDeepSeekEndpoint(params.kind, normalizedBase)) {
      candidateEndpoints.push("https://api.deepseek.com/v1/models");
    }
  } else {
    if (key) headers.Authorization = `Bearer ${key}`;
    const cleanBase = normalizedBase.replace(/\/(chat\/completions|responses)$/iu, "");
    candidateEndpoints.push(cleanBase.endsWith("/models") ? cleanBase : `${cleanBase}/models`);
    if (!cleanBase.endsWith("/v1") && !cleanBase.endsWith("/models")) {
      candidateEndpoints.push(`${cleanBase}/v1/models`);
    }
  }

  let lastResponse: Response | null = null;
  for (const endpoint of [...new Set(candidateEndpoints)]) {
    const response = await fetch(endpoint, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    });
    lastResponse = response;
    if (!response.ok) continue;

    const json = (await response.json()) as { data?: RawRemoteModelEntry[]; models?: RawRemoteModelEntry[] };
    const entries = [
      ...(Array.isArray(json.data) ? json.data : []),
      ...(Array.isArray(json.models) ? json.models : []),
    ];
    const map = new Map<string, ModelCapabilityInfo>();
    for (const entry of entries) {
      if (typeof entry !== "object" || entry === null) continue;
      const cap = parseRemoteModelItem(entry, params.kind);
      if (cap && !map.has(cap.id)) {
        map.set(cap.id, cap);
      }
    }
    if (map.size > 0) {
      const list = [...map.values()];
      if (isDeepSeekEndpoint(params.kind, normalizedBase)) {
        return await enrichDeepSeekReleaseNames(list);
      }
      return list;
    }
  }

  if (params.kind === "ollama") {
    const rootUrl = normalizedBase.replace(/\/v1$/u, "");
    const ollamaRes = await fetch(`${rootUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(6000),
    });
    if (ollamaRes.ok) {
      const json = (await ollamaRes.json()) as { models?: Array<{ name?: unknown }> };
      const ids = (Array.isArray(json.models) ? json.models.map((m) => m.name) : [])
        .filter((name): name is string => typeof name === "string" && name.trim().length > 0);
      if (ids.length > 0) {
        return [...new Set(ids)].map((id) => resolveModelCapabilities(id, params.kind));
      }
    }
  }

  if (lastResponse && lastResponse.ok) {
    throw new Error("官方模型接口未返回可用模型列表。");
  }
  const errBody = lastResponse ? await lastResponse.text().catch(() => "") : "";
  throw new Error(
    formatLlmHttpError(lastResponse?.status ?? 502, errBody, lastResponse?.statusText ?? "Bad Gateway"),
  );
}

const HTTP_ERROR_GUIDE: Record<number, { title: string; guide: string }> = {
  400: {
    title: "400 格式错误",
    guide: "请求体格式错误，请根据错误提示检查并修改请求体。",
  },
  401: {
    title: "401 认证失败",
    guide: "API Key 错误或无效，请核对凭据或前往 platform.deepseek.com/api_keys 创建。",
  },
  402: {
    title: "402 余额不足",
    guide: "账号余额不足，请确认账户余额并前往 platform.deepseek.com/top_up 充值。",
  },
  408: {
    title: "408 请求超时",
    guide: "上传文件或网络传输过慢，请检查网络连接后重试。",
  },
  413: {
    title: "413 请求体过大",
    guide: "单次上传文件或上下文体积超出接口限制，请减小后重试。",
  },
  422: {
    title: "422 参数错误",
    guide: "请求体参数不合法（如 model、reasoning_effort 等），请调整参数后重试。",
  },
  429: {
    title: "429 请求速率达到上限",
    guide: "请求频率或并发数已达上限，请降低并发或稍后重试。",
  },
  500: {
    title: "500 服务器故障",
    guide: "服务端内部异常，请稍等待后重试。",
  },
  503: {
    title: "503 服务器繁忙",
    guide: "服务器负载过高，请稍后重试您的请求。",
  },
  504: {
    title: "504 网关超时",
    guide: "请求未在时限内完成，请稍后重试或减小单次输入体积。",
  },
};

function extractUpstreamErrorMessage(rawBody: string): string {
  const trimmed = rawBody.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as { error?: { message?: unknown }; message?: unknown };
    const msg = parsed.error?.message ?? parsed.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim().slice(0, 200);
  } catch {
    // 非 JSON 响应体直接截断展示
  }
  return trimmed.slice(0, 200);
}

// 统一解析 DeepSeek / OpenAI 兼容接口错误码，输出清晰中文原因与排查建议。
export function formatLlmHttpError(status: number, rawBody: string, statusText: string): string {
  const known = HTTP_ERROR_GUIDE[status];
  const detail = extractUpstreamErrorMessage(rawBody) || statusText;
  if (known) {
    return `${known.title}：${known.guide}${detail ? `（${detail}）` : ""}`;
  }
  return `模型接口返回错误 (${status}): ${detail || "未知错误"}`;
}

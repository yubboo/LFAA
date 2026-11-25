// Host 侧 Chat Completions 适配器，用统一的 LLM 契约处理方舟、DeepSeek、OpenAI 和 Ollama 的响应。
// 复用选模界面的方舟能力目录，使可选档位与发给方舟的参数一致。
import { findArkChatModel, getArkPlanKind, getArkReasoningEffort } from "../ark-plan";
import { formatLlmHttpError, mapEffortForModelApi, normalizeModelCapability, resolveModelCapabilities } from "../capabilities";
import type {
  LlmGenerateInput,
  LlmGenerateOutput,
  LlmMessage,
  LlmProfile,
  LlmToolCall,
  LlmToolDefinition,
} from "../types";

// 兼容 OpenAI 的 prompt_tokens_details.cached_tokens 与 DeepSeek 的 prompt_cache_hit_tokens。
function readCachedPromptTokens(raw: {
  prompt_tokens_details?: { cached_tokens?: number } | null;
  prompt_cache_hit_tokens?: number;
} | undefined): number | undefined {
  if (!raw) return undefined;
  const nested = typeof raw.prompt_tokens_details?.cached_tokens === "number"
    ? raw.prompt_tokens_details.cached_tokens
    : undefined;
  const direct = typeof raw.prompt_cache_hit_tokens === "number" ? raw.prompt_cache_hit_tokens : undefined;
  return nested ?? direct;
}

// 统一接口地址的尾部斜杠，再将 HTTP(S) 地址用于拼接聊天请求路径。
function normalizeBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/u, "");
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("模型服务地址仅支持 http 或 https 协议。");
  }
  return trimmed;
}

// 将内部会话历史转为 Chat Completions 消息，保留工具请求与结果之间的调用 ID。
function buildApiMessages(
  messages: LlmMessage[],
  includeReasoningContent = false,
): Array<Record<string, unknown>> {
  return messages.map((msg) => {
    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: msg.content || null,
        // DeepSeek Thinking 模式进行多步工具调用时要求 assistant 消息必须回传 reasoning_content
        ...(includeReasoningContent ? { reasoning_content: msg.reasoningContent ?? "" } : {}),
        tool_calls: msg.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: {
            name: call.name,
            arguments: call.argumentsJson,
          },
        })),
      };
    }
    if (msg.role === "tool") {
      return {
        role: "tool",
        tool_call_id: msg.toolCallId ?? "",
        content: msg.content,
      };
    }
    const images = msg.role === "user" ? (msg.images ?? []).filter(Boolean) : [];
    if (images.length > 0) {
      return {
        role: "user",
        content: [
          ...(msg.content ? [{ type: "text", text: msg.content }] : []),
          ...images.map((url) => ({ type: "image_url", image_url: { url } })),
        ],
      };
    }
    return {
      role: msg.role,
      content: msg.content,
    };
  });
}

// 将工具参数模式封装为接口所需的 function 定义，无工具时省略 tools 字段。
function buildApiTools(tools?: LlmToolDefinition[]): Array<Record<string, unknown>> | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

// 消费 OpenAI SSE 数据流并聚合成完整输出（文本、推理与增量 tool_calls）。
async function readSseCompletion(
  response: Response,
  profile: LlmProfile,
  input: LlmGenerateInput,
): Promise<LlmGenerateOutput> {
  if (!response.body) {
    throw new Error("模型接口未返回响应流。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let content = "";
  let reasoningContent = "";
  let finishReason = "stop";
  let responseModel = profile.model;
  let usage: LlmGenerateOutput["usage"];
  const toolBuffers = new Map<number, { id: string; name: string; args: string; notified: boolean }>();
  const toolNames = input.tools?.map((tool) => tool.name);

  // 单条 SSE 数据可以包含用量、增量文本或工具参数片段，分别归并到本次回复。
  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    const parsed = JSON.parse(payload) as {
      model?: string;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number } | null;
        prompt_cache_hit_tokens?: number;
      };
      choices?: Array<{
        finish_reason?: string | null;
        delta?: {
          content?: string | null;
          reasoning_content?: string | null;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
    };

    if (parsed.model) responseModel = parsed.model;
    if (parsed.usage) {
      const cachedPromptTokens = readCachedPromptTokens(parsed.usage);
      usage = {
        ...(typeof parsed.usage.prompt_tokens === "number" ? { promptTokens: parsed.usage.prompt_tokens } : {}),
        ...(typeof parsed.usage.completion_tokens === "number" ? { completionTokens: parsed.usage.completion_tokens } : {}),
        ...(typeof parsed.usage.total_tokens === "number" ? { totalTokens: parsed.usage.total_tokens } : {}),
        ...(cachedPromptTokens === undefined ? {} : { cachedPromptTokens }),
      };
    }
    const choice = parsed.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;

    const delta = choice.delta;
    if (!delta) return;

    if (typeof delta.reasoning_content === "string" && delta.reasoning_content.length > 0) {
      reasoningContent += delta.reasoning_content;
      input.onDelta?.({ type: "reasoning", text: delta.reasoning_content });
    }
    if (typeof delta.content === "string" && delta.content.length > 0) {
      content += delta.content;
      input.onDelta?.({ type: "text", text: delta.content });
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = typeof tc.index === "number" ? tc.index : 0;
        const entry = toolBuffers.get(idx) ?? {
          id: "",
          name: "",
          args: "",
          notified: false,
        };
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) entry.name += tc.function.name;
        if (tc.function?.arguments) {
          entry.args += tc.function.arguments;
        }
        toolBuffers.set(idx, entry);
        // 等待真实 ID 和完整工具名，避免同一调用在时间线上产生两条记录。
        if (entry.id && entry.name && !entry.notified && (!toolNames || toolNames.includes(entry.name))) {
          entry.notified = true;
          input.onDelta?.({ type: "tool_call", toolCallId: entry.id, toolName: entry.name });
        }
        if (tc.function?.arguments) {
          input.onActivity?.(entry.notified ? {
            toolCallId: entry.id, argumentChars: entry.args.length, argumentPrefix: entry.args.slice(0, 768),
          } : undefined);
        }
      }
    }
  };

  // 网络分块可能拆开一行 SSE 或一个 UTF-8 字符，保留剩余文本等待后续分块。
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nlIndex = buffer.indexOf("\n");
    while (nlIndex >= 0) {
      const line = buffer.slice(0, nlIndex);
      buffer = buffer.slice(nlIndex + 1);
      processLine(line);
      nlIndex = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) {
    processLine(buffer);
  }

  const toolCalls: LlmToolCall[] = [...toolBuffers.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([index, item]) => ({
      id: item.id || `call_${index + 1}`,
      name: item.name,
      argumentsJson: item.args || "{}",
    }));

  return {
    model: responseModel,
    provider: profile.kind,
    content,
    ...(reasoningContent ? { reasoningContent } : {}),
    toolCalls,
    finishReason,
    ...(usage ? { usage } : {}),
  };
}

// 调用 OpenAI-Compatible `/chat/completions` 接口并兼容流式 SSE 与标准 JSON 返回。
export async function callOpenAiCompatibleChat(
  profile: LlmProfile,
  input: LlmGenerateInput,
): Promise<LlmGenerateOutput> {
  const baseUrl = normalizeBaseUrl(profile.baseUrl);
  const endpoint = baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl}/chat/completions`;

  if (profile.kind !== "ollama" && !profile.apiKey.trim()) {
    throw new Error(`模型配置“${profile.name}”尚未设置 API Key，请在「设置 → 模型与规则配置」中填写。`);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream, application/json",
  };
  if (profile.apiKey.trim()) {
    headers.Authorization = `Bearer ${profile.apiKey.trim()}`;
  }

  // 方舟套餐按模型映射档位；直连 DeepSeek、DeepSeek Reasoner 固定思考模型及方舟思考模型在多轮工具调用时均须回传历史 reasoning_content。
  const arkPlan = getArkPlanKind(profile.baseUrl);
  const isDeepSeek = !arkPlan
    && (profile.kind === "deepseek" || profile.baseUrl.toLowerCase().includes("deepseek.com"));
  const cachedCap = profile.availableModels?.find((m) => m.id === profile.model);
  const capability = cachedCap
    ? normalizeModelCapability(cachedCap, profile.kind)
    : resolveModelCapabilities(profile.model, profile.kind);
  const mappedEffort = arkPlan
    ? getArkReasoningEffort(findArkChatModel(profile.model), input.reasoningEffort)
    : mapEffortForModelApi(input.reasoningEffort, capability);
  const enableThinking = Boolean(isDeepSeek && mappedEffort);
  const includeReasoning = Boolean(
    enableThinking
    || (isDeepSeek && capability.supportsReasoning && capability.reasoningMode === "fixed")
    || (arkPlan && Boolean(mappedEffort || (capability.supportsReasoning && capability.reasoningMode === "fixed"))),
  );

  const bodyPayload: Record<string, unknown> = {
    model: profile.model,
    messages: buildApiMessages(input.messages, includeReasoning),
    stream: true,
    // 流式调用默认不带用量；声明后多数兼容服务会在末尾分片返回 usage，供成本核算。
    stream_options: { include_usage: true },
  };
  const apiTools = buildApiTools(input.tools);
  if (apiTools) {
    bodyPayload.tools = apiTools;
    bodyPayload.tool_choice = "auto";
  }
  const temperature = input.temperature ?? profile.temperature;
  if (typeof temperature === "number") bodyPayload.temperature = temperature;
  const maxTokens = input.maxTokens ?? profile.maxTokens;
  if (typeof maxTokens === "number") bodyPayload.max_tokens = maxTokens;
  if (mappedEffort) {
    const modelLower = profile.model.toLowerCase();
    // 方舟套餐走自己的目录映射（reasoning_effort）；只有直连/qwen 等兼容端点才用专属参数。
    const isQwenThinking = !arkPlan && (/(?:^|[/-])qwen3(?:[.\-]|$)/u.test(modelLower) || modelLower.startsWith("qwen3"));
    const isZhipuThinking = !arkPlan && /glm-(?:5|4\.6|4\.5)/u.test(modelLower);
    if (isQwenThinking) {
      // 百炼 Qwen3：思考强度用 thinking_budget 映射，避免发送其不支持的 reasoning_effort。
      bodyPayload.enable_thinking = true;
      bodyPayload.thinking_budget = mappedEffort === "low" ? 1_024 : mappedEffort === "medium" ? 4_096 : 8_192;
    } else if (isZhipuThinking) {
      // 智谱 GLM：原生思考开关，无多档 effort 参数。
      bodyPayload.thinking = { type: "enabled" };
    } else if (enableThinking) {
      bodyPayload.thinking = { type: "enabled" };
      bodyPayload.reasoning_effort = mappedEffort;
    } else {
      bodyPayload.reasoning_effort = mappedEffort;
    }
  }

  const post = () => fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(bodyPayload),
    ...(input.signal ? { signal: input.signal } : {}),
  });

  let response = await post();
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    // 少数兼容服务不识别 stream_options：去掉该字段重试一次，用量退回由非流式统计。
    if (response.status === 400 && /stream_options|include_usage|unknown.*(?:field|parameter)|unrecognized/iu.test(errText)) {
      delete bodyPayload.stream_options;
      response = await post();
      if (!response.ok) {
        const retryText = await response.text().catch(() => "");
        throw new Error(formatLlmHttpError(response.status, retryText, response.statusText));
      }
    } else {
      throw new Error(formatLlmHttpError(response.status, errText, response.statusText));
    }
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("text/event-stream")) {
    return readSseCompletion(response, profile, input);
  }

  // 兼容请求流式输出后仍返回完整 JSON 的服务，使用非流式响应的字段结构解析。
  const json = (await response.json()) as {
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number } | null;
      prompt_cache_hit_tokens?: number;
    };
    choices?: Array<{
      finish_reason?: string;
      message?: {
        content?: string | null;
        reasoning_content?: string | null;
        tool_calls?: Array<{
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
    }>;
  };

  // 使用首个候选，将完整的思考和正文各作为一次增量通知，并整理工具调用。
  const choice = json.choices?.[0];
  const message = choice?.message;
  const content = message?.content ?? "";
  const reasoningContent = message?.reasoning_content ?? "";
  if (reasoningContent) input.onDelta?.({ type: "reasoning", text: reasoningContent });
  if (content) input.onDelta?.({ type: "text", text: content });
  const toolCalls: LlmToolCall[] = (message?.tool_calls ?? []).map((call, idx) => ({
    id: call.id || `call_${idx + 1}`,
    name: call.function?.name ?? "",
    argumentsJson: call.function?.arguments ?? "{}",
  }));

  // 与 SSE 分支返回同一结果结构，用量字段沿用内部契约的驼峰命名。
  const cachedPromptTokens = json.usage ? readCachedPromptTokens(json.usage) : undefined;
  return {
    model: json.model ?? profile.model,
    provider: profile.kind,
    content,
    ...(reasoningContent ? { reasoningContent } : {}),
    toolCalls,
    finishReason: choice?.finish_reason ?? "stop",
    ...(json.usage
      ? {
          usage: {
            ...(typeof json.usage.prompt_tokens === "number" ? { promptTokens: json.usage.prompt_tokens } : {}),
            ...(typeof json.usage.completion_tokens === "number" ? { completionTokens: json.usage.completion_tokens } : {}),
            ...(typeof json.usage.total_tokens === "number" ? { totalTokens: json.usage.total_tokens } : {}),
            ...(cachedPromptTokens === undefined ? {} : { cachedPromptTokens }),
          },
        }
      : {}),
  };
}

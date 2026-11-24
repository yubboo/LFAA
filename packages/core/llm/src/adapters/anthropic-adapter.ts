// Anthropic Messages API (`/v1/messages`) 适配器，支持 Claude 官方及 DeepSeek Anthropic 格式接口。
import { formatLlmHttpError, mapEffortForModelApi, normalizeModelCapability, resolveModelCapabilities } from "../capabilities";
import { isDeepSeekEndpoint, iterateSseJsonPayloads, normalizeHttpBaseUrl, splitDataUrl } from "../protocol-utils";
import type { LlmGenerateInput, LlmGenerateOutput, LlmMessage, LlmProfile, LlmToolCall, LlmUsage } from "../types";

/** Anthropic 分列未缓存、缓存写入和缓存读取，输入总量需要合并三项。 */
function readAnthropicUsage(raw: Record<string, unknown>): LlmUsage {
  const input = typeof raw.input_tokens === "number" ? raw.input_tokens : undefined;
  const cacheRead = typeof raw.cache_read_input_tokens === "number" ? raw.cache_read_input_tokens : undefined;
  const cacheWrite = typeof raw.cache_creation_input_tokens === "number" ? raw.cache_creation_input_tokens : 0;
  return {
    ...(input !== undefined ? { promptTokens: input + cacheWrite + (cacheRead ?? 0) } : {}),
    ...(cacheRead !== undefined ? { cachedPromptTokens: cacheRead } : {}),
    ...(typeof raw.output_tokens === "number" ? { completionTokens: raw.output_tokens } : {}),
  };
}

function buildAnthropicPayloadMessages(messages: LlmMessage[]): {
  system?: string;
  messages: Array<Record<string, unknown>>;
} {
  const systemParts: string[] = [];
  const apiMessages: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      if (msg.content.trim()) systemParts.push(msg.content.trim());
      continue;
    }
    if (msg.role === "tool") {
      const toolResult = {
        type: "tool_result",
        tool_use_id: msg.toolCallId ?? "",
        content: msg.content,
      };
      // 并行工具调用会产生连续多条 role="tool"，必须合并到同一条 user 消息的 content 数组，否则 Anthropic 返回 HTTP 400。
      const prev = apiMessages.at(-1);
      if (prev && prev.role === "user" && Array.isArray(prev.content)) {
        (prev.content as Array<Record<string, unknown>>).push(toolResult);
      } else {
        apiMessages.push({ role: "user", content: [toolResult] });
      }
      continue;
    }
    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      const blocks: Array<Record<string, unknown>> = [];
      if (msg.reasoningContent) {
        blocks.push({ type: "thinking", thinking: msg.reasoningContent });
      }
      if (msg.content) {
        blocks.push({ type: "text", text: msg.content });
      }
      for (const call of msg.toolCalls) {
        let parsedInput: unknown = {};
        try {
          parsedInput = JSON.parse(call.argumentsJson || "{}");
        } catch {
          parsedInput = {};
        }
        blocks.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: parsedInput,
        });
      }
      apiMessages.push({ role: "assistant", content: blocks });
      continue;
    }
    const images = msg.role === "user" ? (msg.images ?? []).filter(Boolean) : [];
    apiMessages.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: images.length > 0
        ? [
          ...(msg.content ? [{ type: "text", text: msg.content }] : []),
          ...images.map((url) => {
            const parsed = splitDataUrl(url);
            return parsed
              ? { type: "image", source: { type: "base64", media_type: parsed.mime, data: parsed.data } }
              : { type: "image", source: { type: "url", url } };
          }),
        ]
        : msg.content,
    });
  }

  return {
    ...(systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {}),
    messages: apiMessages,
  };
}

function parseAnthropicJsonResponse(payload: Record<string, unknown>, profile: LlmProfile): LlmGenerateOutput {
  const blocks = Array.isArray(payload.content) ? (payload.content as Array<Record<string, unknown>>) : [];
  let content = "";
  let reasoningContent = "";
  const toolCalls: LlmToolCall[] = [];

  for (const block of blocks) {
    if (block.type === "thinking" && typeof block.thinking === "string") {
      reasoningContent += block.thinking;
    } else if (block.type === "text" && typeof block.text === "string") {
      content += block.text;
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: typeof block.id === "string" ? block.id : `tool_${toolCalls.length}`,
        name: typeof block.name === "string" ? block.name : "",
        argumentsJson: JSON.stringify(block.input ?? {}),
      });
    }
  }

  const rawUsage = typeof payload.usage === "object" && payload.usage !== null
    ? (payload.usage as Record<string, unknown>)
    : undefined;
  const usage = rawUsage ? readAnthropicUsage(rawUsage) : undefined;

  return {
    model: typeof payload.model === "string" ? payload.model : profile.model,
    provider: profile.kind,
    content,
    ...(reasoningContent ? { reasoningContent } : {}),
    toolCalls,
    finishReason: typeof payload.stop_reason === "string" ? payload.stop_reason : "end_turn",
    ...(usage ? { usage } : {}),
  };
}

// 调用 Anthropic Messages 协议端点（支持 `/messages` 与 `/v1/messages` 自动拼接）。
export async function callAnthropicMessagesApi(
  profile: LlmProfile,
  input: LlmGenerateInput,
): Promise<LlmGenerateOutput> {
  const baseUrl = normalizeHttpBaseUrl(profile.baseUrl);
  const endpoint = baseUrl.endsWith("/messages")
    ? baseUrl
    : (baseUrl.endsWith("/v1") ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`);

  if (profile.kind !== "ollama" && !profile.apiKey.trim()) {
    throw new Error(`模型配置“${profile.name}”尚未设置 API Key，请在「设置 → 模型与规则配置」中填写。`);
  }

  const { system, messages } = buildAnthropicPayloadMessages(input.messages);
  const cachedCap = profile.availableModels?.find((m) => m.id === profile.model);
  const capability = cachedCap
    ? normalizeModelCapability(cachedCap, profile.kind)
    : resolveModelCapabilities(profile.model, profile.kind);
  const mappedEffort = mapEffortForModelApi(input.reasoningEffort, capability);
  const maxTokens = input.maxTokens ?? profile.maxTokens ?? 4096;

  const bodyPayload: Record<string, unknown> = {
    model: profile.model,
    max_tokens: maxTokens,
    messages,
    stream: true,
  };
  if (system) bodyPayload.system = system;
  if (input.tools && input.tools.length > 0) {
    bodyPayload.tools = input.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  const temperature = input.temperature ?? profile.temperature;
  const deepSeekAnthropic = isDeepSeekEndpoint(profile.kind, baseUrl, profile.providerId);
  // Anthropic 要求 budget_tokens >= 1024 且严格小于 max_tokens；短预算调用（如连通性探测）跳过 thinking 避免 400。
  if (mappedEffort && (deepSeekAnthropic || maxTokens > 1_024)) {
    const effortBudget = mappedEffort === "low" ? 1_024 : mappedEffort === "medium" ? 4_096 : 8_192;
    bodyPayload.thinking = deepSeekAnthropic
      ? { type: "enabled" }
      : { type: "enabled", budget_tokens: Math.max(1_024, Math.min(maxTokens - 256, effortBudget)) };
    if (deepSeekAnthropic) {
      bodyPayload.reasoning_effort = mappedEffort;
    }
  } else if (typeof temperature === "number") {
    bodyPayload.temperature = temperature;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream, application/json",
    "anthropic-version": "2023-06-01",
  };
  if (profile.apiKey.trim()) {
    headers["x-api-key"] = profile.apiKey.trim();
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(bodyPayload),
    ...(input.signal ? { signal: input.signal } : {}),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(formatLlmHttpError(response.status, errText, response.statusText));
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("text/event-stream")) {
    const json = (await response.json()) as Record<string, unknown>;
    const parsed = parseAnthropicJsonResponse(json, profile);
    if (parsed.reasoningContent) input.onDelta?.({ type: "reasoning", text: parsed.reasoningContent });
    if (parsed.content) input.onDelta?.({ type: "text", text: parsed.content });
    return parsed;
  }

  let content = "";
  let reasoningContent = "";
  let responseModel = profile.model;
  let finishReason = "end_turn";
  let rawStreamUsage: Record<string, unknown> | undefined;
  const toolBlocks = new Map<number, { id: string; name: string; jsonBuf: string }>();

  await iterateSseJsonPayloads(response, (payload) => {
    const eventType = typeof payload.type === "string" ? payload.type : "";
    if (eventType === "message_start" && typeof payload.message === "object" && payload.message !== null) {
      const msgObj = payload.message as Record<string, unknown>;
      if (typeof msgObj.model === "string") responseModel = msgObj.model;
      if (msgObj.usage && typeof msgObj.usage === "object") rawStreamUsage = { ...msgObj.usage };
    } else if (
      eventType === "content_block_start"
      && typeof payload.index === "number"
      && typeof payload.content_block === "object"
      && payload.content_block !== null
    ) {
      const block = payload.content_block as Record<string, unknown>;
      if (block.type === "tool_use") {
        const id = typeof block.id === "string" ? block.id : `tool_${payload.index}`;
        const name = typeof block.name === "string" ? block.name : "";
        toolBlocks.set(payload.index, { id, name, jsonBuf: "" });
        if (name) input.onDelta?.({ type: "tool_call", toolCallId: id, toolName: name });
      }
    } else if (eventType === "content_block_delta" && typeof payload.delta === "object" && payload.delta !== null) {
      const delta = payload.delta as Record<string, unknown>;
      if (delta.type === "text_delta" && typeof delta.text === "string") {
        content += delta.text;
        input.onDelta?.({ type: "text", text: delta.text });
      } else if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
        reasoningContent += delta.thinking;
        input.onDelta?.({ type: "reasoning", text: delta.thinking });
      } else if (
        delta.type === "input_json_delta"
        && typeof payload.index === "number"
        && typeof delta.partial_json === "string"
      ) {
        const slot = toolBlocks.get(payload.index);
        if (slot && delta.partial_json) {
          slot.jsonBuf += delta.partial_json;
          input.onActivity?.({
            toolCallId: slot.id, argumentChars: slot.jsonBuf.length, argumentPrefix: slot.jsonBuf.slice(0, 768),
          });
        }
      }
    } else if (eventType === "message_delta" && typeof payload.delta === "object" && payload.delta !== null) {
      const delta = payload.delta as Record<string, unknown>;
      if (typeof delta.stop_reason === "string") finishReason = delta.stop_reason;
      if (payload.usage && typeof payload.usage === "object") rawStreamUsage = { ...rawStreamUsage, ...payload.usage };
    }
  });

  const toolCalls: LlmToolCall[] = [...toolBlocks.values()].map((item) => ({
    id: item.id,
    name: item.name,
    argumentsJson: item.jsonBuf || "{}",
  }));

  return {
    model: responseModel,
    provider: profile.kind,
    content,
    ...(reasoningContent ? { reasoningContent } : {}),
    toolCalls,
    finishReason,
    ...(rawStreamUsage ? { usage: readAnthropicUsage(rawStreamUsage) } : {}),
  };
}

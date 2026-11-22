// OpenAI Responses API (`/responses`) 适配器，支持 OpenAI 与 DeepSeek Responses 接口及流式工具调用。
import { formatLlmHttpError, mapEffortForModelApi, normalizeModelCapability, resolveModelCapabilities } from "../capabilities";
import { isDeepSeekEndpoint, iterateSseJsonPayloads, normalizeHttpBaseUrl } from "../protocol-utils";
import type { LlmGenerateInput, LlmGenerateOutput, LlmMessage, LlmProfile, LlmToolCall, LlmUsage } from "../types";

function buildResponsesInput(messages: LlmMessage[]): {
  instructions?: string;
  input: Array<Record<string, unknown>>;
} {
  const systemParts: string[] = [];
  const input: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      if (msg.content.trim()) systemParts.push(msg.content.trim());
      continue;
    }
    if (msg.role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: msg.toolCallId ?? "",
        output: msg.content,
      });
      continue;
    }
    if (msg.role === "assistant") {
      if (msg.content) {
        input.push({ role: "assistant", content: msg.content });
      }
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const call of msg.toolCalls) {
          input.push({
            type: "function_call",
            call_id: call.id,
            name: call.name,
            arguments: call.argumentsJson || "{}",
          });
        }
      }
      continue;
    }
    input.push({
      role: "user",
      content: msg.images && msg.images.length > 0
        ? [
          ...(msg.content ? [{ type: "input_text", text: msg.content }] : []),
          ...msg.images.filter(Boolean).map((url) => ({ type: "input_image", image_url: url })),
        ]
        : msg.content,
    });
  }

  return {
    ...(systemParts.length > 0 ? { instructions: systemParts.join("\n\n") } : {}),
    input,
  };
}

function parseResponsesOutput(
  payload: Record<string, unknown>,
  profile: LlmProfile,
): LlmGenerateOutput {
  const outputItems = Array.isArray(payload.output) ? (payload.output as Array<Record<string, unknown>>) : [];
  let content = typeof payload.output_text === "string" ? payload.output_text : "";
  let reasoningContent = "";
  const toolCalls: LlmToolCall[] = [];

  for (const item of outputItems) {
    const type = typeof item.type === "string" ? item.type : "";
    if (type === "reasoning") {
      const parts = Array.isArray(item.content) ? (item.content as Array<Record<string, unknown>>) : [];
      for (const part of parts) {
        if (typeof part.text === "string" && part.text) {
          reasoningContent += part.text;
        }
      }
      const summary = Array.isArray(item.summary) ? (item.summary as Array<Record<string, unknown>>) : [];
      if (!reasoningContent) {
        for (const part of summary) {
          if (typeof part.text === "string" && part.text) {
            reasoningContent += part.text;
          }
        }
      }
    } else if (type === "message") {
      const parts = Array.isArray(item.content) ? (item.content as Array<Record<string, unknown>>) : [];
      for (const part of parts) {
        if (typeof part.text === "string" && part.text && !payload.output_text) {
          content += part.text;
        }
      }
    } else if (type === "function_call") {
      toolCalls.push({
        id: (typeof item.call_id === "string" && item.call_id) || (typeof item.id === "string" ? item.id : `call_${toolCalls.length}`),
        name: typeof item.name === "string" ? item.name : "",
        argumentsJson: typeof item.arguments === "string" && item.arguments ? item.arguments : "{}",
      });
    }
  }

  const rawUsage = (typeof payload.usage === "object" && payload.usage !== null
    ? (payload.usage as Record<string, unknown>)
    : undefined);
  const inputDetails = typeof rawUsage?.input_tokens_details === "object" && rawUsage.input_tokens_details !== null
    ? (rawUsage.input_tokens_details as { cached_tokens?: unknown })
    : undefined;
  const cachedPromptTokens = typeof inputDetails?.cached_tokens === "number" ? inputDetails.cached_tokens : undefined;
  const usage: LlmUsage | undefined = rawUsage
    ? {
        ...(typeof rawUsage.input_tokens === "number" ? { promptTokens: rawUsage.input_tokens } : {}),
        ...(typeof rawUsage.output_tokens === "number" ? { completionTokens: rawUsage.output_tokens } : {}),
        ...(typeof rawUsage.total_tokens === "number" ? { totalTokens: rawUsage.total_tokens } : {}),
        ...(cachedPromptTokens === undefined ? {} : { cachedPromptTokens }),
      }
    : undefined;

  return {
    model: typeof payload.model === "string" ? payload.model : profile.model,
    provider: profile.kind,
    content,
    ...(reasoningContent ? { reasoningContent } : {}),
    toolCalls,
    finishReason: typeof payload.status === "string" ? payload.status : "completed",
    ...(usage ? { usage } : {}),
  };
}

// 调用 OpenAI Responses API (`/responses`) 并支持 SSE 流式增量与标准 JSON 响应。
export async function callOpenAiResponsesApi(
  profile: LlmProfile,
  input: LlmGenerateInput,
): Promise<LlmGenerateOutput> {
  const baseUrl = normalizeHttpBaseUrl(profile.baseUrl);
  const endpoint = baseUrl.endsWith("/responses") ? baseUrl : `${baseUrl}/responses`;
  if (profile.kind !== "ollama" && !profile.apiKey.trim()) {
    throw new Error(`模型配置“${profile.name}”尚未设置 API Key，请在「设置 → 模型与规则配置」中填写。`);
  }

  const { instructions, input: items } = buildResponsesInput(input.messages);
  const cachedCap = profile.availableModels?.find((m) => m.id === profile.model);
  const capability = cachedCap
    ? normalizeModelCapability(cachedCap, profile.kind)
    : resolveModelCapabilities(profile.model, profile.kind);
  const mappedEffort = mapEffortForModelApi(input.reasoningEffort, capability);

  const bodyPayload: Record<string, unknown> = {
    model: profile.model,
    input: items,
    stream: true,
    store: false,
  };
  if (instructions) bodyPayload.instructions = instructions;
  if (input.tools && input.tools.length > 0) {
    bodyPayload.tools = input.tools.map((tool) => ({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
    bodyPayload.tool_choice = "auto";
  }
  const temperature = input.temperature ?? profile.temperature;
  if (typeof temperature === "number") bodyPayload.temperature = temperature;
  const maxTokens = input.maxTokens ?? profile.maxTokens;
  if (typeof maxTokens === "number") bodyPayload.max_output_tokens = maxTokens;
  if (mappedEffort) {
    bodyPayload.reasoning = { effort: mappedEffort };
    if (isDeepSeekEndpoint(profile.kind, baseUrl, profile.providerId)) {
      bodyPayload.thinking = { type: "enabled" };
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream, application/json",
  };
  if (profile.apiKey.trim()) {
    headers.Authorization = `Bearer ${profile.apiKey.trim()}`;
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
    const parsed = parseResponsesOutput(json, profile);
    if (parsed.reasoningContent) input.onDelta?.({ type: "reasoning", text: parsed.reasoningContent });
    if (parsed.content) input.onDelta?.({ type: "text", text: parsed.content });
    return parsed;
  }

  let content = "";
  let reasoningContent = "";
  let completedPayload: Record<string, unknown> | null = null;
  const toolMap = new Map<string, { id: string; name: string; args: string }>();

  await iterateSseJsonPayloads(response, (payload, eventName) => {
    const type = typeof payload.type === "string" ? payload.type : (eventName ?? "");
    if (type === "response.output_text.delta" && typeof payload.delta === "string") {
      content += payload.delta;
      input.onDelta?.({ type: "text", text: payload.delta });
    } else if (
      (type === "response.reasoning_text.delta" || type === "response.reasoning_summary_text.delta")
      && typeof payload.delta === "string"
    ) {
      reasoningContent += payload.delta;
      input.onDelta?.({ type: "reasoning", text: payload.delta });
    } else if (type === "response.output_item.added" && typeof payload.item === "object" && payload.item !== null) {
      const item = payload.item as Record<string, unknown>;
      if (item.type === "function_call") {
        const itemId = typeof item.id === "string" ? item.id : `fc_${toolMap.size}`;
        const streamedCallId = typeof item.call_id === "string" ? item.call_id : "";
        const callId = streamedCallId || itemId;
        const name = typeof item.name === "string" ? item.name : "";
        toolMap.set(itemId, { id: callId, name, args: typeof item.arguments === "string" ? item.arguments : "" });
        if (name && streamedCallId) input.onDelta?.({ type: "tool_call", toolCallId: callId, toolName: name });
      }
    } else if (type === "response.function_call_arguments.delta") {
      const itemId = typeof payload.item_id === "string" ? payload.item_id : "";
      const slot = toolMap.get(itemId);
      if (slot && typeof payload.delta === "string" && payload.delta) {
        slot.args += payload.delta;
        input.onActivity?.({
          toolCallId: slot.id, argumentChars: slot.args.length, argumentPrefix: slot.args.slice(0, 768),
        });
      }
    } else if (type === "response.completed" && typeof payload.response === "object" && payload.response !== null) {
      completedPayload = payload.response as Record<string, unknown>;
    }
  });

  if (completedPayload) {
    const finalParsed = parseResponsesOutput(completedPayload, profile);
    return {
      ...finalParsed,
      content: content || finalParsed.content,
      ...(reasoningContent || finalParsed.reasoningContent
        ? { reasoningContent: reasoningContent || finalParsed.reasoningContent }
        : {}),
      toolCalls:
        finalParsed.toolCalls.length > 0
          ? finalParsed.toolCalls
          : [...toolMap.values()].map((t) => ({ id: t.id, name: t.name, argumentsJson: t.args || "{}" })),
    };
  }

  return {
    model: profile.model,
    provider: profile.kind,
    content,
    ...(reasoningContent ? { reasoningContent } : {}),
    toolCalls: [...toolMap.values()].map((t) => ({ id: t.id, name: t.name, argumentsJson: t.args || "{}" })),
    finishReason: "completed",
  };
}

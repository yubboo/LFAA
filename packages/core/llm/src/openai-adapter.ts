// OpenAI-Compatible 流式/非流式推理适配器，支持 DeepSeek reasoning_content、OpenAI 与本地 Ollama。
import type {
  LlmGenerateInput,
  LlmGenerateOutput,
  LlmMessage,
  LlmProfile,
  LlmToolCall,
  LlmToolDefinition,
} from "./types";

function normalizeBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/u, "");
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("模型服务地址仅支持 http 或 https 协议。");
  }
  return trimmed;
}

function buildApiMessages(messages: LlmMessage[]): Array<Record<string, unknown>> {
  return messages.map((msg) => {
    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: msg.content || null,
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
    return {
      role: msg.role,
      content: msg.content,
    };
  });
}

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

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    const parsed = JSON.parse(payload) as {
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
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
      usage = {
        ...(typeof parsed.usage.prompt_tokens === "number" ? { promptTokens: parsed.usage.prompt_tokens } : {}),
        ...(typeof parsed.usage.completion_tokens === "number" ? { completionTokens: parsed.usage.completion_tokens } : {}),
        ...(typeof parsed.usage.total_tokens === "number" ? { totalTokens: parsed.usage.total_tokens } : {}),
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
          id: tc.id || `call_${idx + 1}`,
          name: "",
          args: "",
          notified: false,
        };
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) entry.name += tc.function.name;
        if (tc.function?.arguments) entry.args += tc.function.arguments;
        toolBuffers.set(idx, entry);
        if (entry.name && !entry.notified) {
          entry.notified = true;
          input.onDelta?.({ type: "tool_call", toolCallId: entry.id, toolName: entry.name });
        }
      }
    }
  };

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
    .map(([, item]) => ({
      id: item.id,
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

  const bodyPayload: Record<string, unknown> = {
    model: profile.model,
    messages: buildApiMessages(input.messages),
    stream: true,
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

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(bodyPayload),
    ...(input.signal ? { signal: input.signal } : {}),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`模型接口返回错误 (${response.status}): ${errText.slice(0, 300) || response.statusText}`);
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("text/event-stream")) {
    return readSseCompletion(response, profile, input);
  }

  const json = (await response.json()) as {
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
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
          },
        }
      : {}),
  };
}

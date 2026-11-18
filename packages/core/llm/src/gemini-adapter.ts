// Google Gemini 原生 generateContent / streamGenerateContent 协议适配器。
import { formatLlmHttpError, mapEffortForModelApi, normalizeModelCapability, resolveModelCapabilities } from "./capabilities";
import { iterateSseJsonPayloads, normalizeHttpBaseUrl } from "./protocol-utils";
import type { LlmGenerateInput, LlmGenerateOutput, LlmMessage, LlmProfile, LlmToolCall, LlmUsage } from "./types";

function buildGeminiContents(messages: LlmMessage[]): {
  systemInstruction?: Record<string, unknown>;
  contents: Array<Record<string, unknown>>;
} {
  const systemParts: string[] = [];
  const contents: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      if (msg.content.trim()) systemParts.push(msg.content.trim());
      continue;
    }
    if (msg.role === "tool") {
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: msg.name || msg.toolCallId || "tool_result",
              response: { result: msg.content },
            },
          },
        ],
      });
      continue;
    }
    if (msg.role === "assistant") {
      const parts: Array<Record<string, unknown>> = [];
      if (msg.content) parts.push({ text: msg.content });
      if (msg.toolCalls) {
        for (const call of msg.toolCalls) {
          let args: unknown = {};
          try {
            args = JSON.parse(call.argumentsJson || "{}");
          } catch {
            args = {};
          }
          parts.push({ functionCall: { name: call.name, args } });
        }
      }
      if (parts.length > 0) contents.push({ role: "model", parts });
      continue;
    }
    contents.push({ role: "user", parts: [{ text: msg.content }] });
  }

  return {
    ...(systemParts.length > 0 ? { systemInstruction: { parts: [{ text: systemParts.join("\n\n") }] } } : {}),
    contents,
  };
}

function appendGeminiParts(
  payload: Record<string, unknown>,
  state: {
    content: string;
    reasoning: string;
    toolCalls: LlmToolCall[];
    finishReason: string;
    usage?: LlmUsage;
  },
  onDelta?: LlmGenerateInput["onDelta"],
): void {
  const candidates = Array.isArray(payload.candidates) ? (payload.candidates as Array<Record<string, unknown>>) : [];
  const first = candidates[0];
  if (first) {
    if (typeof first.finishReason === "string") state.finishReason = first.finishReason;
    const contentObj = typeof first.content === "object" && first.content !== null
      ? (first.content as Record<string, unknown>)
      : undefined;
    const parts = Array.isArray(contentObj?.parts) ? (contentObj.parts as Array<Record<string, unknown>>) : [];
    for (const part of parts) {
      if (part.thought === true && typeof part.text === "string" && part.text) {
        state.reasoning += part.text;
        onDelta?.({ type: "reasoning", text: part.text });
      } else if (typeof part.text === "string" && part.text) {
        state.content += part.text;
        onDelta?.({ type: "text", text: part.text });
      } else if (typeof part.functionCall === "object" && part.functionCall !== null) {
        const fc = part.functionCall as Record<string, unknown>;
        const callId = `gemini_fc_${state.toolCalls.length}`;
        const name = typeof fc.name === "string" ? fc.name : "";
        state.toolCalls.push({
          id: callId,
          name,
          argumentsJson: JSON.stringify(fc.args ?? {}),
        });
        if (name) onDelta?.({ type: "tool_call", toolCallId: callId, toolName: name });
      }
    }
  }

  if (typeof payload.usageMetadata === "object" && payload.usageMetadata !== null) {
    const u = payload.usageMetadata as Record<string, unknown>;
    state.usage = {
      ...(typeof u.promptTokenCount === "number" ? { promptTokens: u.promptTokenCount } : {}),
      ...(typeof u.candidatesTokenCount === "number" ? { completionTokens: u.candidatesTokenCount } : {}),
      ...(typeof u.totalTokenCount === "number" ? { totalTokens: u.totalTokenCount } : {}),
    };
  }
}

// 调用 Google Gemini 原生 generateContent / streamGenerateContent 接口。
export async function callGeminiGenerateContentApi(
  profile: LlmProfile,
  input: LlmGenerateInput,
): Promise<LlmGenerateOutput> {
  const baseUrl = normalizeHttpBaseUrl(profile.baseUrl).replace(/\/openai$/iu, "");
  if (!profile.apiKey.trim()) {
    throw new Error(`模型配置“${profile.name}”尚未设置 API Key，请在「设置 → 模型与规则配置」中填写。`);
  }

  const cleanModel = profile.model.replace(/^models\//u, "");
  const endpoint = baseUrl.includes(":generateContent") || baseUrl.includes(":streamGenerateContent")
    ? baseUrl
    : `${baseUrl}/models/${encodeURIComponent(cleanModel)}:streamGenerateContent?alt=sse`;

  const { systemInstruction, contents } = buildGeminiContents(input.messages);
  const cachedCap = profile.availableModels?.find((m) => m.id === profile.model);
  const capability = cachedCap
    ? normalizeModelCapability(cachedCap, profile.kind)
    : resolveModelCapabilities(profile.model, profile.kind);
  const mappedEffort = mapEffortForModelApi(input.reasoningEffort, capability);

  const generationConfig: Record<string, unknown> = {};
  const temperature = input.temperature ?? profile.temperature;
  if (typeof temperature === "number") generationConfig.temperature = temperature;
  const maxTokens = input.maxTokens ?? profile.maxTokens;
  if (typeof maxTokens === "number") generationConfig.maxOutputTokens = maxTokens;
  if (mappedEffort) {
    generationConfig.thinkingConfig = {
      includeThoughts: true,
      thinkingLevel: mappedEffort.toUpperCase(),
    };
  }

  const bodyPayload: Record<string, unknown> = {
    contents,
    ...(systemInstruction ? { systemInstruction } : {}),
    ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
  };
  if (input.tools && input.tools.length > 0) {
    bodyPayload.tools = [
      {
        functionDeclarations: input.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ];
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json",
      "x-goog-api-key": profile.apiKey.trim(),
    },
    body: JSON.stringify(bodyPayload),
    ...(input.signal ? { signal: input.signal } : {}),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(formatLlmHttpError(response.status, errText, response.statusText));
  }

  const state: {
    content: string;
    reasoning: string;
    toolCalls: LlmToolCall[];
    finishReason: string;
    usage?: LlmUsage;
  } = {
    content: "",
    reasoning: "",
    toolCalls: [],
    finishReason: "STOP",
  };

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("text/event-stream")) {
    await iterateSseJsonPayloads(response, (payload) => appendGeminiParts(payload, state, input.onDelta));
  } else {
    const json = (await response.json()) as Record<string, unknown>;
    appendGeminiParts(json, state, input.onDelta);
  }

  return {
    model: cleanModel,
    provider: profile.kind,
    content: state.content,
    ...(state.reasoning ? { reasoningContent: state.reasoning } : {}),
    toolCalls: state.toolCalls,
    finishReason: state.finishReason,
    ...(state.usage ? { usage: state.usage } : {}),
  };
}

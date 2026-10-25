/**
 * 功能：把 LFAA Provider、Tool 和消息合同接到 Pi Agent Core。
 * 作用：仅委托 Pi 管理单次运行的模型/工具回合；不接管 LFAA 权限、Session 或 Provider。
 * 关联文件：execute-turn.ts、lfaa-llm、lfaa-tools、lfaa-session。
 */
import { Agent, type AgentContext, type AgentEvent, type AgentTool } from "@earendil-works/pi-agent-core";
import { createAssistantMessageEventStream, type Api, type AssistantMessage, type AssistantMessageEventStream, type ImageContent, type Message, type Model, type TextContent, type ToolCall, type ToolResultMessage, type Usage } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import type { AiCompletionMessage, AiCompletionResult, AiCompletionTool, AiCompletionToolCall, AiCompletionContentPart } from "lfaa-llm";

const zeroUsage: Usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
};

export interface LfaaPiToolResult {
  /** LFAA 模型可见的内容。图像原文只通过 details 在当前进程内转交。 */
  content: AiCompletionMessage["content"];
  isError?: boolean;
  terminate?: boolean;
}

export interface LfaaPiRequestResult extends AiCompletionResult {
  text: string;
  /** 本轮被拒绝的未提供工具名；交由 LFAA 在下一请求前生成纠正反馈。 */
  rejectedToolNames?: string[];
}

export interface LfaaPiRuntimeOptions {
  model: Model<Api>;
  messages: AiCompletionMessage[];
  getTools: () => AiCompletionTool[];
  stream: (input: {
    messages: AiCompletionMessage[];
    tools: AiCompletionTool[];
    signal: AbortSignal;
    onDelta: (delta: string) => void;
  }) => Promise<LfaaPiRequestResult>;
  onRejectedToolCalls?: (names: string[]) => void;
  onAssistantMessage?: (message: AiCompletionMessage, signal: AbortSignal) => Promise<void> | void;
  executeTool: (call: AiCompletionToolCall, signal: AbortSignal) => Promise<LfaaPiToolResult>;
  prepareRequest: (input: { messages: AiCompletionMessage[]; signal: AbortSignal }) => Promise<{ messages?: AiCompletionMessage[]; tools?: AiCompletionTool[] }>;
  prepareNextTurn: (input: { messages: AiCompletionMessage[]; signal: AbortSignal }) => Promise<{ messages?: AiCompletionMessage[]; tools?: AiCompletionTool[] }>;
  getToolResultMessage?: (toolCallId: string) => AiCompletionMessage | undefined;
  beforeToolCall?: NonNullable<ConstructorParameters<typeof Agent>[0]["beforeToolCall"]>;
  finishTurn?: NonNullable<ConstructorParameters<typeof Agent>[0]["finishTurn"]>;
  onEvent?: (event: AgentEvent, signal: AbortSignal) => Promise<void> | void;
  signal: AbortSignal;
}

/** Run one LFAA turn through Pi's single Agent state machine. */
export async function runLfaaPiAgent(options: LfaaPiRuntimeOptions): Promise<void> {
  options.signal.throwIfAborted();
  let currentTools = options.getTools();
  let lastStreamError: unknown;
  let agent: Agent;
  const rawMessages = new WeakMap<object, AiCompletionMessage>();
  const rawToolArguments = new Map<string, string>();
  const genericParameters = Type.Object({}, { additionalProperties: true });

  const toPiTools = (tools: AiCompletionTool[]): AgentTool[] => tools.map(tool => ({
    name: tool.function.name,
    label: tool.function.name,
    description: tool.function.description,
    parameters: genericParameters,
    executionMode: "sequential",
    execute: async (toolCallId, parameters, signal) => {
      const call: AiCompletionToolCall = {
        id: toolCallId,
        name: tool.function.name,
        arguments: rawToolArguments.get(toolCallId) ?? JSON.stringify(parameters)
      };
      const result = await options.executeTool(call, signal ?? options.signal);
      return {
        content: toPiToolResultContent(result.content),
        details: null,
        ...(result.isError ? { isError: true } : {}),
        ...(result.terminate ? { terminate: true } : {})
      };
    }
  }));

  const fromPiMessages = (messages: readonly (Message | AgentContext["messages"][number])[]): AiCompletionMessage[] => {
    const result: AiCompletionMessage[] = [];
    for (const message of messages) {
      if (message.role === "system") continue;
      const original = rawMessages.get(message);
      if (original) {
        result.push(structuredClone(original));
        continue;
      }
      if (message.role === "toolResult") {
        const source = options.getToolResultMessage?.(message.toolCallId);
        if (source) {
          result.push(structuredClone(source));
          continue;
        }
      }
      const mapped = fromPiMessage(message);
      if (mapped) result.push(mapped);
    }
    return result;
  };

  const streamFn = async (model: Model<Api>, context: { messages: Message[] }, streamOptions?: { signal?: AbortSignal }): Promise<AssistantMessageEventStream> => {
    const stream = createAssistantMessageEventStream();
    const signal = streamOptions?.signal ?? options.signal;
    void (async () => {
      try {
        signal.throwIfAborted();
        const assistant = createPendingAssistant(model);
        stream.push({ type: "start", partial: assistant });
        let textIndex = -1;
        let streamedText = "";
        const response = await options.stream({
          messages: fromPiMessages(context.messages),
          tools: currentTools,
          signal,
          onDelta: delta => {
            if (!delta || signal.aborted) return;
            if (textIndex < 0) {
              textIndex = assistant.content.length;
              assistant.content.push({ type: "text", text: "" });
              stream.push({ type: "text_start", contentIndex: textIndex, partial: assistant });
            }
            streamedText += delta;
            const text = assistant.content[textIndex];
            if (text?.type === "text") text.text = streamedText;
            stream.push({ type: "text_delta", contentIndex: textIndex, delta, partial: assistant });
          }
        });
        signal.throwIfAborted();
        if (response.text && !streamedText) {
          textIndex = assistant.content.length;
          streamedText = response.text;
          assistant.content.push({ type: "text", text: streamedText });
          stream.push({ type: "text_start", contentIndex: textIndex, partial: assistant });
          stream.push({ type: "text_delta", contentIndex: textIndex, delta: streamedText, partial: assistant });
        }
        if (textIndex >= 0) stream.push({ type: "text_end", contentIndex: textIndex, content: streamedText, partial: assistant });

        const accepted = new Set(currentTools.map(tool => tool.function.name));
        const unknownNames = [...new Set(response.toolCalls.filter(call => !accepted.has(call.name)).map(call => call.name))];
        const toolCalls = unknownNames.length ? [] : response.toolCalls;
        if (unknownNames.length) options.onRejectedToolCalls?.(unknownNames);
        const effectiveResponse = { ...response, toolCalls };
        const rawMessage = completionMessage(effectiveResponse);
        for (const call of toolCalls) rawToolArguments.set(call.id, call.arguments);
        const piToolCalls = toolCalls.map(toPiToolCall);
        for (const call of piToolCalls) {
          const contentIndex = assistant.content.length;
          assistant.content.push(call);
          stream.push({ type: "toolcall_start", contentIndex, partial: assistant });
          stream.push({ type: "toolcall_end", contentIndex, toolCall: call, partial: assistant });
        }
        assistant.usage = toPiUsage(response.usage);
        assistant.stopReason = piToolCalls.length ? "toolUse" : "stop";
        rawMessages.set(assistant, rawMessage);
        const reason = piToolCalls.length ? "toolUse" : "stop";
        stream.push({ type: "done", reason, message: assistant });
      } catch (error) {
        lastStreamError = error;
        const message = error instanceof Error ? error.message : "LFAA Provider 请求失败。";
        const aborted = signal.aborted || (error instanceof Error && error.name === "AbortError");
        const failure = createErrorAssistant(model, message, aborted);
        stream.push({ type: "error", reason: aborted ? "aborted" : "error", error: failure });
      }
    })();
    return stream;
  };

  agent = new Agent({
    initialState: {
      model: options.model,
      systemPrompt: "",
      tools: toPiTools(currentTools),
      messages: options.messages.map(message => toPiMessage(message, rawMessages))
    },
    toolExecution: "sequential",
    identity: { attribution: null },
    // LFAA builds the canonical system prompt and converts tool definitions for its Provider.
    convertToLlm: messages => messages.filter(message => message.role !== "system") as Message[],
    streamFn,
    ...(options.beforeToolCall ? { beforeToolCall: options.beforeToolCall } : {}),
    ...(options.finishTurn ? { finishTurn: options.finishTurn } : {}),
    prepareRequest: async ({ context }, signal) => {
      const effectiveSignal = signal ?? options.signal;
      const prepared = await options.prepareRequest({ messages: fromPiMessages(context.messages), signal: effectiveSignal });
      if (prepared.messages) context.messages = prepared.messages.map(message => toPiMessage(message, rawMessages));
      if (prepared.tools) currentTools = prepared.tools;
      else currentTools = options.getTools();
      context.tools = toPiTools(currentTools);
      agent.state.tools = context.tools;
      return { context };
    },
    prepareNextTurnWithContext: async ({ context }, signal) => {
      const effectiveSignal = signal ?? options.signal;
      const prepared = await options.prepareNextTurn({ messages: fromPiMessages(context.messages), signal: effectiveSignal });
      if (prepared.messages) context.messages = prepared.messages.map(message => toPiMessage(message, rawMessages));
      if (prepared.tools) currentTools = prepared.tools;
      else currentTools = options.getTools();
      context.tools = toPiTools(currentTools);
      agent.state.tools = context.tools;
      return { context };
    }
  });

  const unsubscribe = agent.subscribe(async (event, signal) => {
    if (event.type === "message_end" && event.message.role === "assistant" && event.message.stopReason !== "error" && event.message.stopReason !== "aborted") {
      const mapped = fromPiMessages([event.message])[0];
      if (mapped) await options.onAssistantMessage?.(mapped, signal);
    }
    await options.onEvent?.(event, signal);
  });
  const relayAbort = (): void => agent.abort();
  options.signal.addEventListener("abort", relayAbort, { once: true });

  try {
    await agent.continue();
    if (lastStreamError !== undefined) throw lastStreamError;
    if (options.signal.aborted) throw options.signal.reason ?? new DOMException("LFAA Agent Run 已取消。", "AbortError");
    if (agent.state.errorMessage) throw new Error(agent.state.errorMessage);
  } finally {
    options.signal.removeEventListener("abort", relayAbort);
    agent.clearAllQueues();
    unsubscribe();
  }
}

function toPiMessage(message: AiCompletionMessage, rawMessages: WeakMap<object, AiCompletionMessage>): AgentContext["messages"][number] {
  let mapped: AgentContext["messages"][number];
  const timestamp = Date.now();
  if (message.role === "system") {
    const content = typeof message.content === "string" ? message.content : Array.isArray(message.content)
      ? message.content.filter((part): part is Extract<AiCompletionContentPart, { type: "text" }> => part.type === "text").map(part => part.text).join("")
      : "";
    mapped = { role: "system", content, timestamp };
  } else if (message.role === "user") {
    mapped = { role: "user", content: toPiUserContent(message.content), timestamp };
  } else if (message.role === "assistant") {
    const content: AssistantMessage["content"] = [];
    const text = typeof message.content === "string" ? message.content : Array.isArray(message.content) ? message.content.filter((part): part is Extract<AiCompletionContentPart, { type: "text" }> => part.type === "text").map(part => part.text).join("") : "";
    if (text) content.push({ type: "text", text });
    for (const call of message.tool_calls ?? []) content.push(toPiToolCall({ id: call.id, name: call.function.name, arguments: call.function.arguments }));
    mapped = {
      role: "assistant", content, api: "openai-completions", provider: "lfaa", model: "lfaa-session",
      usage: zeroUsage, stopReason: message.tool_calls?.length ? "toolUse" : "stop", timestamp
    };
  } else {
    const toolCallId = message.tool_call_id ?? "lfaa-tool-result";
    mapped = {
      role: "toolResult", toolCallId, toolName: "lfaa-tool",
      content: toPiToolResultContent(message.content), timestamp, isError: false
    } as ToolResultMessage;
  }
  rawMessages.set(mapped, message);
  return mapped;
}

function fromPiMessage(message: Message | AgentContext["messages"][number]): AiCompletionMessage | null {
  if (message.role === "user") {
    const content = piContentToLfaa(message.content);
    return { role: "user", content: Array.isArray(content) && content.length === 1 && content[0]?.type === "text" ? content[0].text : content };
  }
  if (message.role === "assistant") {
    const text = message.content.filter((part): part is TextContent => part.type === "text").map(part => part.text).join("");
    const calls = message.content.filter((part): part is ToolCall => part.type === "toolCall");
    return {
      role: "assistant", content: text || null,
      ...(calls.length ? { tool_calls: calls.map(call => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: JSON.stringify(call.arguments) } })) } : {})
    };
  }
  if (message.role === "toolResult") {
    const details = message.details && typeof message.details === "object" ? message.details as { lfaaContent?: AiCompletionMessage["content"] } : undefined;
    const content = details?.lfaaContent ?? piContentToLfaa(message.content);
    return { role: "tool", tool_call_id: message.toolCallId, content };
  }
  return null;
}

function toPiUserContent(content: AiCompletionMessage["content"]): string | Array<TextContent> {
  if (typeof content === "string" || content === null) return content ?? "";
  return content.reduce<Array<TextContent>>((parts, part) => {
    if (part.type === "text") { parts.push({ type: "text", text: part.text }); return parts; }
    parts.push({ type: "text", text: "[LFAA image retained in the current request]" });
    return parts;
  }, []);
}

function toPiToolResultContent(content: AiCompletionMessage["content"]): Array<TextContent> {
  if (typeof content === "string" || content === null) return [{ type: "text", text: content ?? "" }];
  return content.reduce<Array<TextContent>>((parts, part) => {
    if (part.type === "text") { parts.push({ type: "text", text: part.text }); return parts; }
    parts.push({ type: "text", text: "[LFAA image retained in the current request]" });
    return parts;
  }, []);
}

function piContentToLfaa(content: string | Array<TextContent | ImageContent>): AiCompletionMessage["content"] {
  if (typeof content === "string") return content;
  return content.map(part => part.type === "text"
    ? { type: "text" as const, text: part.text }
    : { type: "image_url" as const, image_url: { url: `data:${part.mimeType};base64,${part.data}` } });
}

function toPiToolCall(call: AiCompletionToolCall): ToolCall {
  try {
    const parsed = JSON.parse(call.arguments) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("参数必须是 JSON 对象。");
    return { type: "toolCall", id: call.id, name: call.name, arguments: parsed as ToolCall["arguments"] };
  } catch {
    return { type: "toolCall", id: call.id, name: call.name, arguments: {} };
  }
}

function completionMessage(response: LfaaPiRequestResult): AiCompletionMessage {
  return {
    role: "assistant",
    content: response.text || null,
    ...(response.toolCalls.length ? { tool_calls: response.toolCalls.map(call => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: call.arguments } })) } : {}),
    ...(response.providerReplay ? { providerReplay: response.providerReplay } : {})
  };
}

function createPendingAssistant(model: Model<Api>): AssistantMessage {
  return {
    role: "assistant", content: [], api: model.api, provider: model.provider, model: model.id,
    usage: zeroUsage, stopReason: "pending", timestamp: Date.now()
  };
}

function createErrorAssistant(model: Model<Api>, errorMessage: string, aborted: boolean): AssistantMessage {
  return {
    role: "assistant", content: [{ type: "text", text: "" }], api: model.api, provider: model.provider, model: model.id,
    usage: zeroUsage, stopReason: aborted ? "aborted" : "error", errorMessage, timestamp: Date.now()
  };
}

function toPiUsage(usage: AiCompletionResult["usage"]): Usage {
  const input = usage.promptTokens ?? 0;
  const output = usage.completionTokens ?? 0;
  const cacheRead = usage.cacheReadTokens ?? 0;
  return { input, output, cacheRead, cacheWrite: 0, totalTokens: input + output, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
}


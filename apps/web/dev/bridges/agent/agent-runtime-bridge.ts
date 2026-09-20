/**
 * 文件：agent-runtime-bridge.ts
 * 作用：Web 开发宿主的最小真实 Agent Runtime Bridge，让已配置 API 模型可以完成多轮文本对话。
 * 负责：Run 生命周期、账户/Secret 解析、Provider HTTP 调用、开发态内存会话、Vite Runtime Event。
 * 不负责：Tool/Skill/MCP 调用、正式 Session Store、ChatGPT/Codex 套餐 Runtime、生产 Server。
 * 安全：Secret 只在 Node Host 内存中按 credentialRef 读取；响应/错误不得包含凭据。
 */
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import {
  AiProviderRegistry,
  builtinAiProviderPlugins,
  type AiAccountRecord,
  type AiModelSettingValue,
} from "@lfaa/config-system";
import type { AgentRunRequest, AgentRuntimeEvent } from "@lfaa/agent-runtime";
import { JsonAiAccountRepository } from "../ai/account-state-repository.ts";
import { createWebDevSecretStore } from "../ai/rust-secret-store.ts";

const BASE = "/__lfaa/dev/agent";
const MAX_BODY_BYTES = 64 * 1024;
const MAX_HISTORY_MESSAGES = 24;

type ConversationMessage = { role: "user" | "assistant"; content: string };
type ProviderMessage = { role: "system" | "user" | "assistant"; content: string };

const REASONING_BOOST_INSTRUCTION =
  "Use a more deliberate verification pass before answering. Keep internal reasoning private and return only the final answer.";

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.end(JSON.stringify(body));
}

function isSameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return url.host === host && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  } catch { return false; }
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY_BYTES) throw new Error("Run 请求体过大。");
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Run 请求体必须是 JSON object。");
  return parsed as Record<string, unknown>;
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "模型调用失败。";
  return message
    .replace(/(?:sk|tp)-[A-Za-z0-9_-]{6,}/g, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~-]{6,}/gi, "Bearer [REDACTED]")
    .slice(0, 420);
}

function parseRunRequest(value: unknown): AgentRunRequest {
  if (!value || typeof value !== "object") throw new Error("Run 参数无效。");
  const raw = value as Record<string, unknown>;
  const model = raw.model;
  if (!model || typeof model !== "object") throw new Error("Run 缺少模型绑定。");
  const m = model as Record<string, unknown>;
  if (typeof raw.input !== "string" || !raw.input.trim()) throw new Error("Run 输入为空。");
  if (raw.surface !== "chat" && raw.surface !== "work") throw new Error("Run surface 无效。");
  if (typeof m.accountId !== "string" || typeof m.providerId !== "string" || typeof m.modelId !== "string") throw new Error("Run 模型绑定无效。");
  const settings: Record<string, string | number | boolean> = {};
  if (m.settings && typeof m.settings === "object" && !Array.isArray(m.settings)) {
    for (const [key, item] of Object.entries(m.settings as Record<string, unknown>)) {
      if (["string", "number", "boolean"].includes(typeof item)) settings[key] = item as string | number | boolean;
    }
  }
  const rawHints = raw.executionHints;
  const executionHints = rawHints && typeof rawHints === "object" && !Array.isArray(rawHints)
    ? { reasoningBoost: (rawHints as Record<string, unknown>).reasoningBoost === true }
    : undefined;
  return {
    surface: raw.surface,
    input: raw.input.trim(),
    model: { accountId: m.accountId, providerId: m.providerId, modelId: m.modelId, settings },
    permissionProfileId: typeof raw.permissionProfileId === "string" ? raw.permissionProfileId as AgentRunRequest["permissionProfileId"] : "ask",
    ...(executionHints ? { executionHints } : {}),
    workspaceId: typeof raw.workspaceId === "string" && raw.workspaceId ? raw.workspaceId : "lfaa",
  };
}

function setRequestPath(target: Record<string, unknown>, path: string, value: AiModelSettingValue): void {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length) return;
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

function responseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") throw new Error("Provider 返回了无效响应。");
  const root = payload as Record<string, unknown>;
  if (typeof root.output_text === "string" && root.output_text.trim()) return root.output_text.trim();
  const choices = root.choices;
  if (Array.isArray(choices)) {
    const first = choices[0];
    if (first && typeof first === "object") {
      const message = (first as Record<string, unknown>).message;
      if (message && typeof message === "object") {
        const content = (message as Record<string, unknown>).content;
        if (typeof content === "string" && content.trim()) return content.trim();
      }
    }
  }
  const output = root.output;
  if (Array.isArray(output)) {
    const text = output.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) return [];
      return content.flatMap((part) => part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string"
        ? [(part as Record<string, unknown>).text as string] : []);
    }).join("");
    if (text.trim()) return text.trim();
  }
  throw new Error("Provider 响应没有可显示的文本。");
}

async function providerCall(options: {
  account: AiAccountRecord;
  request: AgentRunRequest;
  credential: string;
  history: readonly ConversationMessage[];
  signal: AbortSignal;
}): Promise<string> {
  const registry = new AiProviderRegistry(builtinAiProviderPlugins);
  const provider = registry.get(options.account.providerId);
  const connection = provider.resolveConnection({ authMethodId: options.account.authMethodId, settings: options.account.settings });
  if (connection.protocol !== "openai-compatible" || !connection.baseUrl || !connection.authHeader) {
    throw new Error("当前认证方式尚未接入 Web 开发态对话 Runtime；ChatGPT/Codex 套餐将由官方 Harness Adapter 承担。 ");
  }
  const authValue = connection.authHeader.scheme ? `${connection.authHeader.scheme} ${options.credential}` : options.credential;
  const headers = { "content-type": "application/json", accept: "application/json", [connection.authHeader.name]: authValue };
  const capability = provider.describeModel(options.request.model.modelId);
  const settings = options.request.model.settings ?? {};

  const providerHistory: readonly ProviderMessage[] = options.request.executionHints?.reasoningBoost
    ? [{ role: "system", content: REASONING_BOOST_INSTRUCTION }, ...options.history]
    : options.history;

  let url: string;
  const body: Record<string, unknown> = { model: options.request.model.modelId };
  if (options.account.providerId === "openai") {
    url = `${connection.baseUrl.replace(/\/$/, "")}/responses`;
    body.input = providerHistory.map((message) => ({ role: message.role, content: message.content }));
  } else {
    url = `${connection.baseUrl.replace(/\/$/, "")}/chat/completions`;
    body.messages = providerHistory;
  }
  for (const field of capability?.settings ?? []) {
    const value = settings[field.id];
    if (value !== undefined) setRequestPath(body, field.requestPath, value);
  }

  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: options.signal });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Provider 认证失败（HTTP 401），请重新验证当前账户凭据。");
    if (response.status === 429) throw new Error("Provider 当前限流或额度不足（HTTP 429）。");
    throw new Error(`Provider 调用失败（HTTP ${response.status}）。`);
  }
  return responseText(await response.json());
}

export function lfaaDevAgentRuntimeBridge(projectRoot: string): Plugin {
  const repository = new JsonAiAccountRepository(projectRoot);
  const secrets = createWebDevSecretStore(projectRoot);
  const running = new Map<string, { abort: AbortController; sessionId: string }>();
  const conversations = new Map<string, ConversationMessage[]>();

  const emit = (server: ViteDevServer, event: AgentRuntimeEvent) => {
    server.ws.send({ type: "custom", event: "lfaa:agent-runtime-event", data: event });
  };

  return {
    name: "lfaa-dev-agent-runtime-bridge",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
        if (!pathname.startsWith(BASE)) { next(); return; }
        try {
          if (request.method !== "GET" && !isSameOrigin(request)) {
            sendJson(response, 403, { ok: false, error: "Agent Runtime 只接受当前 LFAA 本地页面的同源请求。" });
            return;
          }
          if (request.method === "POST" && pathname === `${BASE}/runs`) {
            const body = await readJson(request);
            const runRequest = parseRunRequest(body.request);
            const accounts = await repository.list();
            const account = accounts.find((item) => item.id === runRequest.model.accountId);
            if (!account || account.providerId !== runRequest.model.providerId) throw new Error("当前模型账户不存在或 Provider 不匹配。");
            if (!account.credentialRef) throw new Error("当前模型认证方式没有可供开发态直接调用的 API 凭据。");
            const credential = await secrets.get(account.credentialRef);
            if (!credential) throw new Error("当前账户凭据不存在，请回到模型管理重新认证。");

            const runId = randomUUID();
            const sessionId = `web-${runRequest.workspaceId}`;
            const abort = new AbortController();
            running.set(runId, { abort, sessionId });
            sendJson(response, 202, { ok: true, handle: { runId, sessionId } });

            queueMicrotask(async () => {
              emit(server, { type: "run.started", runId, sessionId });
              const key = `${runRequest.workspaceId}:${account.id}:${runRequest.model.modelId}`;
              const previous = conversations.get(key) ?? [];
              const history = [...previous, { role: "user" as const, content: runRequest.input }].slice(-MAX_HISTORY_MESSAGES);
              try {
                const text = await providerCall({ account, request: runRequest, credential, history, signal: abort.signal });
                const nextConversation: ConversationMessage[] = [...history, { role: "assistant", content: text }];
                conversations.set(key, nextConversation.slice(-MAX_HISTORY_MESSAGES));
                emit(server, { type: "assistant.completed", runId, sessionId, text });
              } catch (error) {
                if (abort.signal.aborted) emit(server, { type: "run.cancelled", runId, sessionId });
                else emit(server, { type: "run.failed", runId, sessionId, error: safeMessage(error) });
              } finally {
                running.delete(runId);
              }
            });
            return;
          }
          if (request.method === "DELETE" && pathname.startsWith(`${BASE}/runs/`)) {
            const runId = decodeURIComponent(pathname.slice(`${BASE}/runs/`.length));
            running.get(runId)?.abort.abort();
            sendJson(response, 200, { ok: true });
            return;
          }
          sendJson(response, 404, { ok: false, error: "未知 Agent Runtime 路由。" });
        } catch (error) {
          sendJson(response, 400, { ok: false, error: safeMessage(error) });
        }
      });
      server.httpServer?.once("close", () => {
        for (const run of running.values()) run.abort.abort();
        running.clear();
      });
    },
  };
}

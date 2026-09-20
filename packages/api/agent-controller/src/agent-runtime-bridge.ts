/**
 * 文件：agent-runtime-bridge.ts
 * 作用：Web 开发宿主的最小真实 Agent Runtime Bridge，让已配置 API 模型可以完成多轮文本对话。
 * 负责：Run 生命周期、账户/Secret 解析、开发态内存会话、Vite Runtime Event，并委托 LLM Adapter 完成模型调用。
 * 不负责：Provider 协议细节、Tool/Skill/MCP 调用、正式 Session Store、ChatGPT/Codex 套餐 Runtime、生产 Server。
 * 安全：Secret 只在 Node Host 内存中按 credentialRef 读取；响应/错误不得包含凭据。
 */
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import type { AgentRunRequest, AgentRuntimeEvent } from "@lfaa/agent-runtime";
import { JsonAiAccountRepository } from "@lfaa/config-host-node";
import { createWebDevSecretStore } from "@lfaa/credentials-native";
import { callOpenAiCompatibleTextModel, type LlmConversationMessage } from "@lfaa/llm-openai-compatible";

const BASE = "/__lfaa/dev/agent";
const MAX_BODY_BYTES = 64 * 1024;
const MAX_HISTORY_MESSAGES = 24;

type ConversationMessage = LlmConversationMessage;

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
  if (raw.workspaceMode !== "chat" && raw.workspaceMode !== "work") throw new Error("Run workspaceMode 无效。");
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
    workspaceMode: raw.workspaceMode,
    input: raw.input.trim(),
    model: { accountId: m.accountId, providerId: m.providerId, modelId: m.modelId, settings },
    permissionProfileId: typeof raw.permissionProfileId === "string" ? raw.permissionProfileId as AgentRunRequest["permissionProfileId"] : "ask",
    ...(executionHints ? { executionHints } : {}),
    workspaceId: typeof raw.workspaceId === "string" && raw.workspaceId ? raw.workspaceId : "lfaa",
  };
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
                const text = await callOpenAiCompatibleTextModel({ account, request: runRequest, credential, history, signal: abort.signal });
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

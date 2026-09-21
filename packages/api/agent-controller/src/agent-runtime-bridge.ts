/**
 * 文件：agent-runtime-bridge.ts
 * 作用：Web 开发宿主的统一 Agent Runtime Controller，让 Chat / Work 共用同一执行核心与干预语义。
 * 负责：Run 生命周期、账户/协议解析、API Key Secret 读取、Runtime 路由、用户干预、Vite Runtime Event。
 * 不负责：Provider 协议细节、Codex JSONL 细节、Tool/Skill/MCP 实现、正式 Session Store、生产 Server。
 * 状态归属：Controller 持有运行中 Run；OpenAI-compatible 暂存开发态历史；Codex 多轮线程归 Codex Runtime。
 * 对外接口：lfaaDevAgentRuntimeBridge(projectRoot, { codexRuntime? })。
 * 关联文件：@lfaa/codex-app-server、@lfaa/llm-openai-compatible、packages/client/connection。
 * 修改注意事项：Chat/Work 只能改变表现层，禁止选择不同能力等级；Manual 不进入该 Controller。
 */
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import type { AgentRunHandle, AgentRunRequest, AgentRuntimeEvent } from "@lfaa/agent-runtime";
import { CodexAppServerHost, type CodexAppServerTextRuntime } from "@lfaa/codex-app-server";
import { JsonAiAccountRepository } from "@lfaa/config-host-node";
import { AiProviderRegistry, builtinAiProviderPlugins } from "@lfaa/config-system";
import { createWebDevSecretStore } from "@lfaa/credentials-native";
import { callOpenAiCompatibleTextModel, type LlmConversationMessage } from "@lfaa/llm-openai-compatible";

const BASE = "/__lfaa/dev/agent";
const MAX_BODY_BYTES = 64 * 1024;
const MAX_HISTORY_MESSAGES = 24;

type ConversationMessage = LlmConversationMessage;
type RuntimeProtocol = "codex-app-server" | "openai-compatible" | string;
interface RunningRun {
  readonly abort: AbortController;
  readonly sessionId: string;
  readonly request: AgentRunRequest;
  readonly protocol: RuntimeProtocol;
  readonly sessionKey: string;
}

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
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[REDACTED]")
    .slice(0, 420);
}

function parseRunRequest(value: unknown): AgentRunRequest {
  if (!value || typeof value !== "object") throw new Error("Run 参数无效。");
  const raw = value as Record<string, unknown>;
  const model = raw.model;
  if (!model || typeof model !== "object") throw new Error("Run 缺少模型绑定。");
  const m = model as Record<string, unknown>;
  if (typeof raw.input !== "string" || !raw.input.trim()) throw new Error("Run 输入为空。");
  if (raw.workspaceMode !== "chat" && raw.workspaceMode !== "work") throw new Error("Run workspaceMode 无效；Manual 不允许进入 Agent Runtime。");
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
  const workspaceContext = typeof raw.workspaceContext === "string" && raw.workspaceContext.trim() ? raw.workspaceContext.trim().slice(0, 16_000) : undefined;
  return {
    workspaceMode: raw.workspaceMode,
    input: raw.input.trim(),
    model: { accountId: m.accountId, providerId: m.providerId, modelId: m.modelId, settings },
    permissionProfileId: typeof raw.permissionProfileId === "string" ? raw.permissionProfileId as AgentRunRequest["permissionProfileId"] : "ask",
    ...(executionHints ? { executionHints } : {}),
    workspaceId: typeof raw.workspaceId === "string" && raw.workspaceId ? raw.workspaceId : "lfaa",
    ...(workspaceContext ? { workspaceContext } : {}),
  };
}

function parseIntervention(value: unknown): { input: string; workspaceContext?: string } {
  if (!value || typeof value !== "object") throw new Error("干预参数无效。");
  const root = value as Record<string, unknown>;
  const raw = root.request && typeof root.request === "object" && !Array.isArray(root.request) ? root.request as Record<string, unknown> : root;
  const input = raw.input;
  if (typeof input !== "string" || !input.trim()) throw new Error("干预内容为空。");
  const workspaceContext = typeof raw.workspaceContext === "string" && raw.workspaceContext.trim() ? raw.workspaceContext.trim().slice(0, 16_000) : undefined;
  return { input: input.trim(), ...(workspaceContext ? { workspaceContext } : {}) };
}

function runtimeInput(input: string, workspaceContext?: string): string {
  return workspaceContext?.trim()
    ? `[LFAA Workspace Context]\n${workspaceContext.trim()}\n\n[LFAA User Input]\n${input}`
    : input;
}

export function lfaaDevAgentRuntimeBridge(projectRoot: string, options: { codexRuntime?: CodexAppServerTextRuntime } = {}): Plugin {
  const repository = new JsonAiAccountRepository(projectRoot);
  const secrets = createWebDevSecretStore(projectRoot);
  const providerRegistry = new AiProviderRegistry(builtinAiProviderPlugins);
  const ownedCodexHost = options.codexRuntime ? null : new CodexAppServerHost();
  const codexRuntime = options.codexRuntime ?? ownedCodexHost!.textRuntime;
  const running = new Map<string, RunningRun>();
  const conversations = new Map<string, ConversationMessage[]>();

  const emit = (server: ViteDevServer, event: AgentRuntimeEvent) => {
    server.ws.send({ type: "custom", event: "lfaa:agent-runtime-event", data: event });
  };

  const beginRun = async (server: ViteDevServer, runRequest: AgentRunRequest): Promise<AgentRunHandle> => {
    const accounts = await repository.list();
    const account = accounts.find((item) => item.id === runRequest.model.accountId);
    if (!account || account.providerId !== runRequest.model.providerId) throw new Error("当前模型账户不存在或 Provider 不匹配。");
    const provider = providerRegistry.get(account.providerId);
    const connection = provider.resolveConnection({ authMethodId: account.authMethodId, settings: account.settings });
    const protocol = connection.protocol;
    const runId = randomUUID();
    const sessionId = `web-${runRequest.workspaceId}`;
    const sessionKey = `${runRequest.workspaceId}:${account.id}:${runRequest.model.modelId}`;
    const abort = new AbortController();
    running.set(runId, { abort, sessionId, request: runRequest, protocol, sessionKey });
    const input = runtimeInput(runRequest.input, runRequest.workspaceContext);

    queueMicrotask(async () => {
      emit(server, { type: "run.started", runId, sessionId });
      try {
        if (protocol === "codex-app-server") {
          const reasoningEffort = typeof runRequest.model.settings?.reasoningEffort === "string"
            ? runRequest.model.settings.reasoningEffort
            : undefined;
          const result = await codexRuntime.runText({
            sessionKey,
            modelId: runRequest.model.modelId,
            input,
            cwd: projectRoot,
            ...(reasoningEffort ? { reasoningEffort } : {}),
            signal: abort.signal,
            onTextDelta: (delta) => emit(server, { type: "assistant.delta", runId, sessionId, delta }),
          });
          emit(server, { type: "assistant.completed", runId, sessionId, text: result.text });
        } else if (protocol === "openai-compatible") {
          if (!account.credentialRef) throw new Error("当前 API 认证方式缺少凭据引用，请回到模型管理重新认证。");
          const credential = await secrets.get(account.credentialRef);
          if (!credential) throw new Error("当前账户凭据不存在，请回到模型管理重新认证。");
          const previous = conversations.get(sessionKey) ?? [];
          const history = [...previous, { role: "user" as const, content: input }].slice(-MAX_HISTORY_MESSAGES);
          const text = await callOpenAiCompatibleTextModel({ account, request: runRequest, credential, history, signal: abort.signal });
          const nextConversation: ConversationMessage[] = [...history, { role: "assistant", content: text }];
          conversations.set(sessionKey, nextConversation.slice(-MAX_HISTORY_MESSAGES));
          emit(server, { type: "assistant.completed", runId, sessionId, text });
        } else {
          throw new Error(`当前 Provider Runtime 尚未接入：${protocol}`);
        }
      } catch (error) {
        if (abort.signal.aborted || (error instanceof Error && error.name === "AbortError")) emit(server, { type: "run.cancelled", runId, sessionId });
        else emit(server, { type: "run.failed", runId, sessionId, error: safeMessage(error) });
      } finally {
        running.delete(runId);
      }
    });

    return { runId, sessionId };
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
            const handle = await beginRun(server, parseRunRequest(body.request));
            sendJson(response, 202, { ok: true, handle });
            return;
          }
          const interventionMatch = pathname.match(new RegExp(`^${BASE}/runs/([^/]+)/interventions$`));
          if (request.method === "POST" && interventionMatch) {
            const runId = decodeURIComponent(interventionMatch[1]!);
            const active = running.get(runId);
            if (!active) throw new Error("当前 Run 已结束，无法继续插话干预。");
            const intervention = parseIntervention(await readJson(request));
            const nextInput = runtimeInput(intervention.input, intervention.workspaceContext);
            if (active.protocol === "codex-app-server") {
              await codexRuntime.steerText(active.sessionKey, nextInput);
              emit(server, { type: "run.intervention.accepted", runId, sessionId: active.sessionId, input: intervention.input, disposition: "steered" });
              sendJson(response, 200, { ok: true, handle: { runId, sessionId: active.sessionId }, disposition: "steered" });
              return;
            }
            active.abort.abort();
            const handle = await beginRun(server, {
              ...active.request,
              input: intervention.input,
              ...(intervention.workspaceContext ? { workspaceContext: intervention.workspaceContext } : {}),
            });
            emit(server, { type: "run.intervention.accepted", runId: handle.runId, sessionId: handle.sessionId, input: intervention.input, disposition: "restarted" });
            sendJson(response, 200, { ok: true, handle, disposition: "restarted" });
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
        if (ownedCodexHost) ownedCodexHost.dispose();
      });
    },
  };
}

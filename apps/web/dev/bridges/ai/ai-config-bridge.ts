/**
 * 文件：ai-config-bridge.ts
 * 作用：Vite Web 开发宿主的 AI 设置 localhost Bridge。
 * 负责：把浏览器同源请求映射到 Config System Account Service，并返回脱敏 JSON。
 * 不负责：Provider 业务、UI、Secret 文件持久化、生产 Server API。
 * 状态归属：Vite 进程持有 Account Service 与非 Windows 内存 Secret fallback。
 * 对外接口：lfaaDevAiConfigBridge(projectRoot)。
 * 关联文件：account-state-repository.ts、rust-secret-store.ts、node-http-json.ts、apps/web/src/host/ai-settings-client.ts。
 * 修改注意事项：只绑定 Vite localhost；任何响应不得返回 Secret；请求体大小必须受限。
 */
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import { AiAccountService, AiProviderRegistry, builtinAiProviderPlugins, type AiAccountDraft } from "@lfaa/config-system";
import { JsonAiAccountRepository } from "./account-state-repository.ts";
import { NodeAiHttpJsonPort } from "./node-http-json.ts";
import { createWebDevSecretStore } from "./rust-secret-store.ts";

const MAX_BODY = 32 * 1024;

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY) throw new Error("请求体过大。");
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("请求体必须是 JSON 对象。");
  return parsed as Record<string, unknown>;
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "AI 配置操作失败。";
  return message.replace(/sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}/g, "[REDACTED]").slice(0, 320);
}

function parseDraft(value: unknown): AiAccountDraft {
  if (!value || typeof value !== "object") throw new Error("账户配置无效。");
  const raw = value as Record<string, unknown>;
  if (typeof raw.providerId !== "string" || typeof raw.authMethodId !== "string") throw new Error("Provider / 认证方式无效。");
  const settings: Record<string, string> = {};
  if (raw.settings && typeof raw.settings === "object" && !Array.isArray(raw.settings)) {
    for (const [key, item] of Object.entries(raw.settings as Record<string, unknown>)) if (typeof item === "string") settings[key] = item;
  }
  const modelSettings: Record<string, string | number | boolean> = {};
  if (raw.modelSettings && typeof raw.modelSettings === "object" && !Array.isArray(raw.modelSettings)) {
    for (const [key, item] of Object.entries(raw.modelSettings as Record<string, unknown>)) {
      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") modelSettings[key] = item;
    }
  }
  return {
    ...(typeof raw.accountId === "string" ? { accountId: raw.accountId } : {}),
    providerId: raw.providerId as AiAccountDraft["providerId"],
    displayName: typeof raw.displayName === "string" ? raw.displayName : "",
    authMethodId: raw.authMethodId,
    settings,
    selectedModelId: typeof raw.selectedModelId === "string" ? raw.selectedModelId : null,
    modelSettings,
  };
}

function ensureSameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (url.hostname === "127.0.0.1" || url.hostname === "localhost") && (url.protocol === "http:" || url.protocol === "https:");
  } catch { return false; }
}

export function lfaaDevAiConfigBridge(projectRoot: string): Plugin {
  const registry = new AiProviderRegistry(builtinAiProviderPlugins);
  const service = new AiAccountService(registry, {
    repository: new JsonAiAccountRepository(projectRoot),
    secrets: createWebDevSecretStore(projectRoot),
    http: new NodeAiHttpJsonPort(),
    createId: randomUUID,
    now: () => new Date().toISOString(),
  });

  return {
    name: "lfaa-dev-ai-config-bridge",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/__lfaa/dev/ai", async (request, response, next) => {
        if (!request.url) return next();
        if (!ensureSameOrigin(request)) return sendJson(response, 403, { ok: false, error: "拒绝非本地来源请求。" });
        const pathname = new URL(request.url, "http://localhost").pathname;
        try {
          if (request.method === "GET" && pathname === "/accounts") {
            return sendJson(response, 200, { ok: true, ...(await service.snapshot()) });
          }
          if (request.method === "POST" && pathname === "/probe") {
            const body = await readJson(request);
            const secret = typeof body.secret === "string" ? body.secret : "";
            return sendJson(response, 200, { ok: true, probe: await service.probe(parseDraft(body.draft), secret) });
          }
          if (request.method === "POST" && pathname === "/accounts") {
            const body = await readJson(request);
            const secret = typeof body.secret === "string" ? body.secret : "";
            const result = await service.save(parseDraft(body.draft), secret);
            return sendJson(response, 200, { ok: true, ...result, snapshot: await service.snapshot() });
          }
          const match = pathname.match(/^\/accounts\/([A-Za-z0-9-]{8,80})(?:\/(probe|model))?$/);
          const accountId = match?.[1];
          const action = match?.[2];
          if (accountId && request.method === "POST" && action === "probe") {
            return sendJson(response, 200, { ok: true, probe: await service.reprobe(accountId) });
          }
          if (accountId && request.method === "POST" && action === "model") {
            const body = await readJson(request);
            if (typeof body.modelId !== "string") throw new Error("模型 ID 无效。");
            const modelSettings: Record<string, string | number | boolean> = {};
            if (body.modelSettings && typeof body.modelSettings === "object" && !Array.isArray(body.modelSettings)) {
              for (const [key, value] of Object.entries(body.modelSettings as Record<string, unknown>)) {
                if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") modelSettings[key] = value;
              }
            }
            await service.selectModel(accountId, body.modelId, modelSettings);
            return sendJson(response, 200, { ok: true, snapshot: await service.snapshot() });
          }
          if (accountId && request.method === "DELETE" && !action) {
            await service.delete(accountId);
            return sendJson(response, 200, { ok: true, snapshot: await service.snapshot() });
          }
          return next();
        } catch (error) {
          return sendJson(response, 400, { ok: false, error: safeMessage(error) });
        }
      });
    },
  };
}

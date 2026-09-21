/**
 * 文件：ai-config-bridge.ts
 * 作用：Vite Web 开发宿主的 AI 设置 localhost Bridge。
 * 负责：把浏览器同源请求映射到 Config System Account Service，挂接 Codex App Server 托管认证，并返回脱敏 JSON。
 * 不负责：Provider 业务、UI、Secret 文件持久化、生产 Server API。
 * 状态归属：Vite 进程持有 Account Service；Codex Host 可由 Web Bundle 注入并与 Agent Runtime 共用。
 * 对外接口：lfaaDevAiConfigBridge(projectRoot, { managedAuth? })。
 * 关联文件：account-state-repository.ts、rust-secret-store.ts、node-http-json.ts、codex-app-server.ts、packages/client/connection/src/ai-settings-client.ts。
 * 修改注意事项：只绑定 Vite localhost；任何响应不得返回 Secret；请求体大小必须受限。
 */
import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import {
  AiAccountService,
  AiProviderRegistry,
  builtinAiProviderPlugins,
  type AiAccountDraft,
  type AiManagedAuthPort,
} from "@lfaa/config-system";
import { JsonAiAccountRepository, NodeAiHttpJsonPort } from "@lfaa/config-host-node";
import { createWebDevSecretStore } from "@lfaa/credentials-native";
import { CodexAppServerHost } from "@lfaa/codex-app-server";

const MAX_BODY = 32 * 1024;
/** 显式 Probe 成功后的短期复用窗口；只用于避免“测试连接→保存”重复打官方网络。 */
const VERIFIED_PROBE_TTL_MS = 5 * 60_000;

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

function probeFingerprint(draft: AiAccountDraft, secret: string): string {
  // Probe 的远端事实只取决于 Provider / 认证 / 连接设置 / Secret；
  // 用户在 Probe 后选择模型或调整 reasoning 不应让保存再次访问同一官方模型目录。
  return createHash("sha256")
    .update(JSON.stringify({
      providerId: draft.providerId,
      authMethodId: draft.authMethodId,
      settings: draft.settings,
      secret,
    }))
    .digest("hex");
}

export function lfaaDevAiConfigBridge(projectRoot: string, options: { managedAuth?: AiManagedAuthPort } = {}): Plugin {
  const registry = new AiProviderRegistry(builtinAiProviderPlugins);
  const ownedCodexHost = options.managedAuth ? null : new CodexAppServerHost();
  const managedAuth = options.managedAuth ?? ownedCodexHost!.managedAuth;
  const service = new AiAccountService(registry, {
    repository: new JsonAiAccountRepository(projectRoot),
    secrets: createWebDevSecretStore(projectRoot),
    http: new NodeAiHttpJsonPort(),
    managedAuth,
    createId: randomUUID,
    now: () => new Date().toISOString(),
  });
  const verifiedProbes = new Map<string, { probe: Awaited<ReturnType<AiAccountService["probe"]>>; expiresAt: number }>();

  const rememberProbe = (draft: AiAccountDraft, secret: string, probe: Awaited<ReturnType<AiAccountService["probe"]>>) => {
    verifiedProbes.set(probeFingerprint(draft, secret), { probe, expiresAt: Date.now() + VERIFIED_PROBE_TTL_MS });
  };
  const takeProbe = (draft: AiAccountDraft, secret: string) => {
    const key = probeFingerprint(draft, secret);
    const cached = verifiedProbes.get(key);
    verifiedProbes.delete(key);
    return cached && cached.expiresAt >= Date.now() ? cached.probe : undefined;
  };

  return {
    name: "lfaa-dev-ai-config-bridge",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      if (ownedCodexHost) server.httpServer?.once("close", () => ownedCodexHost.dispose());
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
            const draft = parseDraft(body.draft);
            const probe = await service.probe(draft, secret);
            rememberProbe(draft, secret, probe);
            return sendJson(response, 200, { ok: true, probe });
          }
          if (request.method === "POST" && pathname === "/managed-login/start") {
            const body = await readJson(request);
            return sendJson(response, 200, { ok: true, login: await service.startManagedLogin(parseDraft(body.draft)) });
          }
          const managedLoginMatch = pathname.match(/^\/managed-login\/([A-Za-z0-9._-]{8,160})$/);
          if (managedLoginMatch && request.method === "GET") {
             return sendJson(response, 200, { ok: true, status: await service.managedLoginStatus(managedLoginMatch[1]!) });
          }
          if (managedLoginMatch && request.method === "DELETE") {
             await service.cancelManagedLogin(managedLoginMatch[1]!);
            return sendJson(response, 200, { ok: true });
          }
          if (request.method === "POST" && pathname === "/subscription/accounts") {
            const body = await readJson(request);
            const result = await service.save(parseDraft(body.draft), null);
            return sendJson(response, 200, { ok: true, ...result, snapshot: await service.snapshot() });
          }
          if (request.method === "POST" && pathname === "/accounts") {
            const body = await readJson(request);
            const secret = typeof body.secret === "string" ? body.secret : "";
            const draft = parseDraft(body.draft);
            const result = await service.save(draft, secret, takeProbe(draft, secret));
            return sendJson(response, 200, { ok: true, ...result, snapshot: await service.snapshot() });
          }
          const match = pathname.match(/^\/accounts\/([A-Za-z0-9-]{8,80})(?:\/(probe|model|active-model|active|usage))?$/);
          const accountId = match?.[1];
          const action = match?.[2];
          if (accountId && request.method === "GET" && action === "usage") {
            return sendJson(response, 200, { ok: true, usage: await service.usage(accountId) });
          }
          if (accountId && request.method === "POST" && action === "probe") {
            const probe = await service.reprobe(accountId);
            return sendJson(response, 200, { ok: true, probe, snapshot: await service.snapshot() });
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
          if (accountId && request.method === "POST" && action === "active-model") {
            const body = await readJson(request);
            if (typeof body.modelId !== "string") throw new Error("模型 ID 无效。");
            const modelSettings: Record<string, string | number | boolean> = {};
            if (body.modelSettings && typeof body.modelSettings === "object" && !Array.isArray(body.modelSettings)) {
              for (const [key, value] of Object.entries(body.modelSettings as Record<string, unknown>)) {
                if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") modelSettings[key] = value;
              }
            }
            await service.setActiveModel(accountId, body.modelId, modelSettings);
            return sendJson(response, 200, { ok: true, snapshot: await service.snapshot() });
          }
          if (accountId && request.method === "POST" && action === "active") {
            await service.activateModel(accountId);
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

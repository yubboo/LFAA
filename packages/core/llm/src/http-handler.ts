// 为本机 Web 服务提供 /api/llm/* HTTP 接口，绝不向浏览器返回原始 API Key。
import type { IncomingMessage, ServerResponse } from "node:http";
import { asApiProtocol, type LlmProviderKind, type LlmService } from "./index";

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

function asProviderKind(value: unknown): LlmProviderKind {
  if (value === "deepseek" || value === "ollama" || value === "openai-compatible") return value;
  return "openai-compatible";
}

export function createLlmHttpHandler(service: LlmService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const pathname = (req.url ?? "").split("?")[0] ?? "";
    if (!pathname.startsWith("/api/llm/")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (method === "GET" && pathname === "/api/llm/profiles") {
        const result = await service.listPublicProfiles();
        sendJson(res, 200, result);
        return true;
      }

      if (method === "POST" && pathname === "/api/llm/profiles") {
        const body = await readJsonBody(req);
        const apiProtocol = asApiProtocol(body.apiProtocol);
        const profile = await service.saveProfile({
          ...(typeof body.id === "string" ? { id: body.id } : {}),
          ...(typeof body.providerId === "string" ? { providerId: body.providerId } : {}),
          name: typeof body.name === "string" ? body.name : "",
          kind: asProviderKind(body.kind),
          ...(apiProtocol ? { apiProtocol } : {}),
          baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : "",
          model: typeof body.model === "string" ? body.model : "",
          ...(typeof body.apiKey === "string" ? { apiKey: body.apiKey } : {}),
          ...(typeof body.temperature === "number" ? { temperature: body.temperature } : {}),
          ...(typeof body.maxTokens === "number" ? { maxTokens: body.maxTokens } : {}),
        });
        const list = await service.listPublicProfiles();
        sendJson(res, 200, { profile, ...list });
        return true;
      }

      if (method === "POST" && pathname === "/api/llm/active") {
        const body = await readJsonBody(req);
        const profileId = typeof body.profileId === "string" ? body.profileId : "";
        const activeProfileId = await service.setActiveProfile(profileId);
        sendJson(res, 200, { activeProfileId });
        return true;
      }

      if (method === "POST" && pathname === "/api/llm/models") {
        const body = await readJsonBody(req);
        const apiProtocol = asApiProtocol(body.apiProtocol);
        const models = await service.listRemoteModels({
          ...(typeof body.profileId === "string" ? { profileId: body.profileId } : {}),
          ...(body.kind === "deepseek" || body.kind === "ollama" || body.kind === "openai-compatible"
            ? { kind: body.kind }
            : {}),
          ...(apiProtocol ? { apiProtocol } : {}),
          ...(typeof body.baseUrl === "string" ? { baseUrl: body.baseUrl } : {}),
          ...(typeof body.apiKey === "string" ? { apiKey: body.apiKey } : {}),
        });
        const list = await service.listPublicProfiles();
        sendJson(res, 200, { models, ...list });
        return true;
      }

      if (method === "POST" && pathname === "/api/llm/select-model") {
        const body = await readJsonBody(req);
        const profileId = typeof body.profileId === "string" ? body.profileId : "";
        const model = typeof body.model === "string" ? body.model : "";
        const profile = await service.selectProfileModel(profileId, model);
        const list = await service.listPublicProfiles();
        sendJson(res, 200, { profile, ...list });
        return true;
      }

      if (method === "POST" && pathname === "/api/llm/test") {
        const body = await readJsonBody(req);
        const profileId = typeof body.profileId === "string" ? body.profileId : undefined;
        const result = await service.testConnection(profileId);
        sendJson(res, 200, result);
        return true;
      }

      if (method === "DELETE" && pathname.startsWith("/api/llm/profiles/")) {
        const profileId = decodeURIComponent(pathname.slice("/api/llm/profiles/".length));
        const removed = await service.removeProfile(profileId);
        if (!removed) {
          sendJson(res, 404, { error: "模型配置不存在。" });
          return true;
        }
        const list = await service.listPublicProfiles();
        sendJson(res, 200, list);
        return true;
      }

      sendJson(res, 404, { error: "未找到 LLM 接口路由。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}

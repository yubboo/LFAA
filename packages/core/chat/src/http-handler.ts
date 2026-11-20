// 为本机 Web 服务提供 /api/chat/* 聊天会话 CRUD 与项目聊天数统计接口。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ChatService } from "./index";

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

const MAX_JSON_BODY_BYTES = 21 * 1024 * 1024;

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buf.length;
    if (total > MAX_JSON_BODY_BYTES) {
      throw new Error("请求体过大，请缩短单次录音时长。");
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

/** 把会话读写、常规设置与本地语音请求分派给 Chat Host 服务。 */
export function createChatHttpHandler(service: ChatService, options: {
  withIdleSession?: <T>(sessionId: string, action: () => Promise<T>) => Promise<T>;
  resolveSessionPreset?: (id?: string) => Promise<{ sessionPreset: string; sessionModules: string[] }>;
  /** 由模型生成追问建议；未提供时该接口返回空数组，客户端不展示。 */
  suggestFollowUps?: (input: { userPrompt: string; assistantReply: string }) => Promise<string[]>;
} = {}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const urlObj = new URL(req.url ?? "", "http://127.0.0.1");
    const pathname = urlObj.pathname;
    if (!pathname.startsWith("/api/chat/")) return false;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      if (method === "GET" && pathname === "/api/chat/sessions") {
        const includeArchived = urlObj.searchParams.get("includeArchived") === "1";
        const projectId = urlObj.searchParams.get("projectId");
        const sessions = await service.listSessions({
          includeArchived,
          ...(projectId ? { projectId } : {}),
        });
        const countsByProject = await service.countByProject(false);
        sendJson(res, 200, { sessions, countsByProject });
        return true;
      }

      if (method === "POST" && pathname === "/api/chat/suggestions") {
        const body = await readJsonBody(req);
        const userPrompt = typeof body.userPrompt === "string" ? body.userPrompt : "";
        const assistantReply = typeof body.assistantReply === "string" ? body.assistantReply : "";
        if (!options.suggestFollowUps || !assistantReply.trim()) {
          sendJson(res, 200, { suggestions: [] });
          return true;
        }
        const suggestions = await options.suggestFollowUps({ userPrompt, assistantReply });
        sendJson(res, 200, { suggestions: suggestions.slice(0, 3) });
        return true;
      }

      if (method === "POST" && pathname === "/api/chat/sessions") {
        const body = await readJsonBody(req);
        const preset = await resolvePreset(body.sessionPreset);
        const session = await service.createSession({
          ...preset,
          ...(typeof body.title === "string" ? { title: body.title } : {}),
          projectId: typeof body.projectId === "string" ? body.projectId : null,
          sectionId: typeof body.sectionId === "string" ? body.sectionId : null,
        });
        sendJson(res, 201, { session });
        return true;
      }

      if (method === "GET" && pathname === "/api/chat/general-settings") {
        const settings = await service.getGeneralSettings();
        sendJson(res, 200, { settings });
        return true;
      }

      if (method === "PATCH" && pathname === "/api/chat/general-settings") {
        const body = await readJsonBody(req);
        const settings = await service.updateGeneralSettings(body);
        sendJson(res, 200, { settings });
        return true;
      }

      if (method === "GET" && pathname === "/api/chat/licenses") {
        const packages = await service.getOpenSourceLicenses();
        sendJson(res, 200, { packages });
        return true;
      }

      if (method === "POST" && pathname === "/api/chat/transcribe") {
        const body = await readJsonBody(req);
        const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64.trim() : "";
        if (!audioBase64) {
          sendJson(res, 400, { error: "缺少录音音频数据（audioBase64）。" });
          return true;
        }
        const wavBuffer = Buffer.from(audioBase64, "base64");
        const lang = typeof body.lang === "string" ? body.lang : undefined;
        const result = await service.transcribeAudio(wavBuffer, lang);
        sendJson(res, 200, result);
        return true;
      }

      if (pathname.startsWith("/api/chat/sessions/")) {
        const suffix = pathname.slice("/api/chat/sessions/".length);
        if (method === "POST" && suffix.endsWith("/fork")) {
          const sourceId = decodeURIComponent(suffix.slice(0, -"/fork".length));
          const forked = await service.forkSession(sourceId);
          if (!forked) {
            sendJson(res, 404, { error: "聊天会话不存在。" });
            return true;
          }
          sendJson(res, 201, { session: forked });
          return true;
        }
        const sessionId = decodeURIComponent(suffix);
        if (method === "GET") {
          const session = await service.getSession(sessionId);
          if (!session) {
            sendJson(res, 404, { error: "聊天会话不存在。" });
            return true;
          }
          sendJson(res, 200, { session });
          return true;
        }
        if (method === "PATCH") {
          const body = await readJsonBody(req);
          const changesPreset = Object.hasOwn(body, "sessionPreset");
          if (changesPreset && !options.withIdleSession) throw new Error("会话模式修改不可用。");
          const write = async () => service.updateSession(sessionId, {
            ...(changesPreset ? await resolvePreset(body.sessionPreset) : {}),
            ...(typeof body.title === "string" ? { title: body.title } : {}),
            ...(body.projectId !== undefined
              ? { projectId: typeof body.projectId === "string" ? body.projectId : null }
              : {}),
            ...(body.sectionId !== undefined
              ? { sectionId: typeof body.sectionId === "string" ? body.sectionId : null }
              : {}),
            ...(typeof body.pinned === "boolean" ? { pinned: body.pinned } : {}),
            ...(typeof body.archived === "boolean" ? { archived: body.archived } : {}),
            ...(typeof body.unread === "boolean" ? { unread: body.unread } : {}),
          });
          const session = (body.projectId !== undefined || changesPreset) && options.withIdleSession
            ? await options.withIdleSession(sessionId, write)
            : await write();
          if (!session) {
            sendJson(res, 404, { error: "聊天会话不存在。" });
            return true;
          }
          sendJson(res, 200, { session });
          return true;
        }
        if (method === "DELETE") {
          const removed = await service.deleteSession(sessionId);
          if (!removed) {
            sendJson(res, 404, { error: "聊天会话不存在。" });
            return true;
          }
          sendJson(res, 200, { removed: true });
          return true;
        }
      }

      sendJson(res, 404, { error: "未找到聊天接口路由。" });
      return true;
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };

  async function resolvePreset(id: unknown) {
    if (id !== undefined && (typeof id !== "string" || !id.trim() || !options.resolveSessionPreset)) {
      throw new Error("会话模式不可用。");
    }
    return options.resolveSessionPreset?.(typeof id === "string" ? id : undefined);
  }
}

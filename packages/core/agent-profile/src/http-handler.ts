// @lfaa/agent-profile HTTP 接口：agent 定义与模型绑定的增删改查，供 Agents 页与会话顶栏使用。
// 校验与业务规则在 service 层，这里只负责路由、JSON 读写与把错误转成可展示的 400。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AgentProfileService } from "./service";
import type { AgentCreateInput, AgentUpdateInput, BindingCreateInput, BindingUpdateInput } from "./types";

const MAX_BODY_BYTES = 128 * 1024;

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buf.length;
    if (total > MAX_BODY_BYTES) throw new Error("请求体过大。");
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

/** 从路径里取最后一段作为 id；带斜杠视为不合法路径。 */
function readId(pathname: string, prefix: string): string {
  const suffix = pathname.slice(prefix.length);
  if (!suffix || suffix.includes("/")) return "";
  return decodeURIComponent(suffix);
}

/** agent 与绑定接口：四个方法一组，写操作失败返回 400 与可展示原因。 */
export function createAgentProfileHttpHandler(service: AgentProfileService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const { pathname } = new URL(req.url ?? "/", "http://127.0.0.1");
    const isAgents = pathname === "/api/agents" || pathname.startsWith("/api/agents/");
    const isBindings = pathname === "/api/bindings" || pathname.startsWith("/api/bindings/");
    if (!isAgents && !isBindings) return false;

    try {
      if (pathname === "/api/agents") {
        if (req.method === "GET") {
          sendJson(res, 200, { agents: await service.listAgents() });
          return true;
        }
        if (req.method === "POST") {
          const body = await readJsonBody(req);
          const agent = await service.createAgent(body as unknown as AgentCreateInput);
          sendJson(res, 201, { agent });
          return true;
        }
        sendJson(res, 405, { error: "agent 集合只支持 GET / POST。" });
        return true;
      }

      if (pathname === "/api/agents/export" && req.method === "GET") {
        sendJson(res, 200, { snapshot: await service.exportSnapshot() });
        return true;
      }

      if (pathname === "/api/agents/import" && req.method === "POST") {
        const body = await readJsonBody(req);
        // 兼容直接贴快照与 { snapshot } 两种包装。
        const snapshot = (body as { snapshot?: unknown }).snapshot ?? body;
        sendJson(res, 200, await service.importSnapshot(snapshot));
        return true;
      }

      if (pathname === "/api/bindings") {
        if (req.method === "GET") {
          sendJson(res, 200, { bindings: await service.listBindings() });
          return true;
        }
        if (req.method === "POST") {
          const body = await readJsonBody(req);
          const binding = await service.createBinding(body as unknown as BindingCreateInput);
          sendJson(res, 201, { binding });
          return true;
        }
        sendJson(res, 405, { error: "绑定集合只支持 GET / POST。" });
        return true;
      }

      if (isAgents) {
        const id = readId(pathname, "/api/agents/");
        if (!id) {
          sendJson(res, 404, { error: "未找到 agent。" });
          return true;
        }
        if (req.method === "PATCH") {
          const body = await readJsonBody(req);
          sendJson(res, 200, { agent: await service.updateAgent(id, body as unknown as AgentUpdateInput) });
          return true;
        }
        if (req.method === "DELETE") {
          sendJson(res, 200, { removed: await service.removeAgent(id) });
          return true;
        }
        sendJson(res, 405, { error: "单个 agent 只支持 PATCH / DELETE。" });
        return true;
      }

      const id = readId(pathname, "/api/bindings/");
      if (!id) {
        sendJson(res, 404, { error: "未找到绑定。" });
        return true;
      }
      if (req.method === "PATCH") {
        const body = await readJsonBody(req);
        sendJson(res, 200, { binding: await service.updateBinding(id, body as unknown as BindingUpdateInput) });
        return true;
      }
      if (req.method === "DELETE") {
        sendJson(res, 200, { removed: await service.removeBinding(id) });
        return true;
      }
      sendJson(res, 405, { error: "单个绑定只支持 PATCH / DELETE。" });
      return true;
    } catch (error) {
      // 业务校验失败属于用户可修正的输入问题，统一 400 并把原因原样交给界面。
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}
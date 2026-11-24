// 接入宿主令牌网关，提供 MCP 设置接口，响应只返回安全摘要。
import type { IncomingMessage, ServerResponse } from "node:http";
import type { McpService } from "./mcp-service";
import { McpConfigError, record } from "./server-config";

const base = "/api/mcp/servers";

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function read(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 262_144) {
      req.resume();
      throw new McpConfigError("MCP configuration exceeds 256 KiB.");
    }
    chunks.push(bytes);
  }
  try {
    return record(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    throw new McpConfigError("Enter a valid JSON object.");
  }
}

export function createMcpHttpHandler(service: McpService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (path !== base && !path.startsWith(base + "/")) return false;
    const method = req.method;
    try {
      const [encoded, action, extra] = path.slice(base.length + 1).split("/");
      const id = encoded ? decodeURIComponent(encoded) : "";
      if (path === base && method === "POST") {
        const { id: name, ...patch } = await read(req);
        if (typeof name !== "string") throw new McpConfigError("Enter a server name.");
        await service.save(name, patch, true);
      } else if (path === base + "/import" && method === "POST") await service.import(await read(req));
      else if (id && !action && !extra && method === "GET") {
        const server = service.list().find((entry) => entry.id === id);
        send(res, server ? 200 : 404, server ? { server } : { error: "Server not found." });
        return true;
      }
      else if (id && !action && !extra && method === "PATCH") await service.save(id, await read(req), false);
      else if (id && !action && !extra && method === "DELETE") await service.remove(id);
      else if (id && action === "reconnect" && !extra && method === "POST") service.reconnect(id);
      else if (id && action === "test" && !extra && method === "POST") {
        send(res, 200, { count: await service.test(id) });
        return true;
      } else if (!(path === base && method === "GET")) {
        send(res, 404, { error: "MCP endpoint not found." });
        return true;
      }
      send(res, 200, { servers: service.list() });
    } catch (error) {
      if (error instanceof McpConfigError) send(res, 400, { error: error.message });
      else if (error instanceof URIError) send(res, 400, { error: "Invalid server name." });
      else send(res, 500, { error: "MCP configuration is unavailable." });
    }
    return true;
  };
}

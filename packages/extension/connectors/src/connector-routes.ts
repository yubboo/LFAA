// 接入宿主令牌网关，提供连接器列表、CLI 增删改、探测与测试接口；响应只返回摘要与可编辑配置。
import type { IncomingMessage, ServerResponse } from "node:http";
import { ConnectorConfigError } from "./cli-config";
import { findTemplate } from "./cli-templates";
import type { ConnectorService } from "./connector-service";

const base = "/api/connectors";

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
      throw new ConnectorConfigError("连接器配置超过 256 KiB。");
    }
    chunks.push(bytes);
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new ConnectorConfigError("请输入有效的 JSON 对象。");
  }
}

/** 由模板与本次提交的字段合成新建负载；模板只提供默认值，提交字段优先。 */
function composeCreate(body: Record<string, unknown>): { id: string; payload: Record<string, unknown> } {
  const patch = { ...body };
  const templateId = typeof patch.templateId === "string" ? patch.templateId.trim() : "";
  delete patch.templateId;
  const template = templateId ? findTemplate(templateId) : undefined;
  if (templateId && !template) throw new ConnectorConfigError("未知的连接器模板。");
  const id = typeof patch.id === "string" && patch.id.trim() ? patch.id.trim() : template?.connector.id ?? "";
  const payload = template ? { ...structuredClone(template.connector), ...patch } : patch;
  return { id, payload };
}

export function createConnectorsHttpHandler(service: ConnectorService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (path !== base && !path.startsWith(base + "/")) return false;
    const method = req.method;
    try {
      const [encoded, action, extra] = path.slice(base.length + 1).split("/");
      const id = encoded ? decodeURIComponent(encoded) : "";
      if (path === base && method === "GET") {
        send(res, 200, { connectors: service.list(), templates: service.templates(), catalog: service.catalog() });
        return true;
      }
      if (path === base && method === "POST") {
        const { id: connectorId, payload } = composeCreate(await read(req));
        await service.save(connectorId, payload, true);
      } else if (path === base + "/catalog" && method === "GET") {
        send(res, 200, { catalog: service.catalog() });
        return true;
      } else if (encoded === "catalog" && action && extra === "connect" && method === "POST") {
        const body = await read(req);
        const inputs = typeof body.inputs === "object" && body.inputs ? body.inputs as Record<string, unknown> : {};
        const values = Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
        send(res, 202, { job: service.connectCatalog(decodeURIComponent(action), values) });
        return true;
      } else if (encoded === "catalog" && action && !extra && method === "DELETE") {
        await service.disconnectCatalog(decodeURIComponent(action));
      } else if (encoded === "jobs" && action && !extra && method === "GET") {
        const job = service.job(decodeURIComponent(action));
        if (!job) send(res, 404, { error: "连接任务不存在。" });
        else send(res, 200, { job });
        return true;
      } else if (path === base + "/probe" && method === "POST") {
        const body = await read(req);
        const executable = typeof body.executable === "string" ? body.executable : "";
        const args = Array.isArray(body.args) ? body.args.map(String).slice(0, 10) : undefined;
        send(res, 200, { result: await service.probe(executable, args) });
        return true;
      } else if (path === base + "/import" && method === "POST") {
        await service.import(await read(req));
      } else if (id && !action && !extra && method === "GET") {
        send(res, 200, { connector: service.get(id) });
        return true;
      } else if (id && !action && !extra && method === "PATCH") {
        await service.save(id, await read(req), false);
      } else if (id && !action && !extra && method === "DELETE") {
        await service.remove(id);
      } else if (id && action === "test" && !extra && method === "POST") {
        send(res, 200, { result: await service.test(id) });
        return true;
      } else {
        send(res, 404, { error: "连接器接口不存在。" });
        return true;
      }
      send(res, 200, { connectors: service.list(), templates: service.templates(), catalog: service.catalog() });
    } catch (error) {
      if (error instanceof ConnectorConfigError) send(res, 400, { error: error.message });
      else if (error instanceof URIError) send(res, 400, { error: "连接器名称无效。" });
      else send(res, 500, { error: error instanceof Error ? error.message : "连接器配置不可用。" });
    }
    return true;
  };
}
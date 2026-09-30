/**
 * 功能：把用户配置的 MCP Streamable HTTP 工具接入 Agent。
 * 作用：按任务建立协议会话、发现与校验工具、回传真实结果并关闭会话；不重试可能已执行的调用。
 * 关联文件：settings/service.ts、agent-loop/execute-turn.ts、permission-presets；仅实现 2025-11-25/2025-06-18 工具协议，认证与 stdio 尚未接入。
 */
import { createHash } from "node:crypto";
import { Ajv } from "ajv";
import type { PluginSettings } from "lfaa-settings/src/service.js";
import type { AiBusinessTool } from "./business-tools.js";

type ObjectValue = Record<string, unknown>;
const versions = ["2025-11-25", "2025-06-18"];
const jsonObject = (value: unknown): ObjectValue => { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("MCP 返回了无效对象。"); return value as ObjectValue; };

class McpConnection {
  private sessionId = "";
  private version = versions[0];
  private sequence = 0;
  constructor(private server: PluginSettings["mcpServers"][number], private signal: AbortSignal, private timeout: number) {
    const url = new URL(server.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("MCP 地址格式无效，地址不得包含认证资料。");
  }
  private headers(): Record<string, string> { return { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": this.version, ...(this.sessionId ? { "MCP-Session-Id": this.sessionId } : {}) }; }
  async request(method: string, params: ObjectValue, notification = false, detached = false): Promise<ObjectValue> {
    const id = ++this.sequence;
    try { return await this.performRequest(id, method, params, notification, detached); }
    catch (error) {
      // 在响应头到达前断线也可能已执行，发送取消通知但绝不重发调用。
      if (method === "tools/call") await this.request("notifications/cancelled", { requestId: id, reason: "客户端停止等待；调用未重发" }, true, true).catch(() => undefined);
      throw error;
    }
  }
  private async performRequest(id: number, method: string, params: ObjectValue, notification: boolean, detached: boolean): Promise<ObjectValue> {
    const response = await fetch(this.server.url, { method: "POST", headers: this.headers(), redirect: "error", signal: detached ? AbortSignal.timeout(2000) : AbortSignal.any([this.signal, AbortSignal.timeout(this.timeout)]), body: JSON.stringify({ jsonrpc: "2.0", ...(notification ? {} : { id }), method, params }) });
    if (!response.ok) throw new Error(`MCP ${this.server.name} 返回 HTTP ${response.status}；未自动重发。`);
    if (method === "initialize") this.sessionId = response.headers.get("MCP-Session-Id") ?? "";
    if (notification) { await response.body?.cancel(); return {}; }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("MCP 响应缺少正文。");
    const decoder = new TextDecoder();
    let buffer = "", received = 0;
    const sse = response.headers.get("Content-Type")?.includes("text/event-stream");
    if (!sse && !response.headers.get("Content-Type")?.includes("application/json")) { await reader.cancel(); throw new Error("MCP 返回了不支持的响应类型。"); }
    const extract = (value: unknown): ObjectValue | null => {
      const message = jsonObject(value);
      // 没有开放服务器向客户端的采样、输入请求或提示词执行，不能用服务器指令冒充授权。
      if (message.method && message.id !== undefined) throw new Error("MCP 服务要求未启用的客户端能力，已停止等待。");
      if (message.id !== id) return null;
      if (message.jsonrpc !== "2.0") throw new Error("MCP JSON-RPC 版本无效。");
      if (message.error) { const error = jsonObject(message.error); throw new Error(`MCP 工具协议错误 ${String(error.code)}：${String(error.message).slice(0, 300)}`); }
      return jsonObject(message.result);
    };
    try {
      while (true) {
        const { done, value } = await reader.read();
        received += value?.byteLength ?? 0;
        if (received > 2 * 1024 * 1024) throw new Error("MCP 响应超过 2 MiB 安全限制。");
        buffer += decoder.decode(value, { stream: !done });
        if (sse) {
          let boundary: RegExpExecArray | null;
          while ((boundary = /\r?\n\r?\n/u.exec(buffer))) {
            const event = buffer.slice(0, boundary.index); buffer = buffer.slice(boundary.index + boundary[0].length);
            const data = event.split(/\r?\n/u).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
            if (!data.trim()) continue;
            const result = extract(JSON.parse(data)); if (result) return result;
          }
        } else if (done) { const result = extract(JSON.parse(buffer)); if (result) return result; }
        if (done) throw new Error("MCP 连接在结果到达前结束；执行状态未知，未自动重发。");
      }
    } finally { await reader.cancel().catch(() => undefined); }
  }
  async initialize(): Promise<void> {
    const result = await this.request("initialize", { protocolVersion: this.version, capabilities: {}, clientInfo: { name: "LFAA", version: "0.1.1" } });
    if (typeof result.protocolVersion !== "string" || !versions.includes(result.protocolVersion)) throw new Error("MCP 服务协议版本未受当前实现支持。");
    this.version = result.protocolVersion;
    await this.request("notifications/initialized", {}, true);
  }
  async close(): Promise<void> {
    if (!this.sessionId) return;
    await fetch(this.server.url, { method: "DELETE", headers: this.headers(), redirect: "error", signal: AbortSignal.timeout(2000) }).then(async response => { await response.body?.cancel(); }).catch(() => undefined);
  }
}

/** 外部声明的只读标记不是授权依据；每次外部执行均走高风险权限合同。 */
export async function discoverMcpTools(servers: PluginSettings["mcpServers"], signal: AbortSignal, timeoutSeconds: number): Promise<{ tools: AiBusinessTool[]; errors: string[]; close: () => Promise<void> }> {
  const connections: McpConnection[] = [];
  const tools: AiBusinessTool[] = [], errors: string[] = [];
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false, ownProperties: true });
  for (const server of servers.filter(server => server.enabled)) {
    try {
      signal.throwIfAborted();
      const connection = new McpConnection(server, signal, timeoutSeconds * 1000); connections.push(connection);
      await connection.initialize();
      let cursor: string | undefined;
      const cursors = new Set<string>();
      do {
        const result = await connection.request("tools/list", cursor ? { cursor } : {});
        if (!Array.isArray(result.tools)) throw new Error("MCP 工具列表格式无效。");
        for (const item of result.tools) {
          const remote = jsonObject(item), schema = jsonObject(remote.inputSchema);
          if (typeof remote.name !== "string" || !remote.name.length || remote.name.length > 120 || schema.type !== "object") throw new Error("MCP 工具定义无效。");
          if (tools.length >= 200) throw new Error("MCP 工具目录超过 200 项安全限制。");
          const remoteName = remote.name;
          const digest = createHash("sha256").update(remoteName).digest("hex").slice(0, 16);
          const name = `mcp_${server.id}_${digest}`;
          if (tools.some(tool => tool.name === name)) throw new Error("MCP 工具名称重复。");
          const validate = ajv.compile(schema);
          tools.push({ id: `mcp.${server.id}.${digest}`, name, description: `MCP ${server.name} · ${remoteName}。${String(remote.description ?? "").slice(0, 2000)}`, applicationIds: ["workspace"], schema,
            parse: value => { const parameters = jsonObject(value); if (!validate(parameters)) throw new Error(`MCP 参数不符合工具约束：${ajv.errorsText(validate.errors).slice(0, 500)}`); return parameters; },
            risk: () => "dangerous", approval: parameters => ({ scopeKey: "mcp:" + createHash("sha256").update(JSON.stringify([server.url, remoteName, parameters])).digest("hex"), scopeSummary: `${server.name} · ${remoteName}`, summary: `调用 MCP 服务 ${server.name} 的 ${remoteName}` }),
            execute: async (parameters, context) => { context.signal.throwIfAborted(); return connection.request("tools/call", { name: remoteName, arguments: parameters }); }
          });
        }
        cursor = typeof result.nextCursor === "string" ? result.nextCursor : undefined;
        if (cursor && cursors.has(cursor)) throw new Error("MCP 服务返回重复的分页游标。");
        if (cursors.size >= 200) throw new Error("MCP 工具目录分页超过安全限制。");
        if (cursor) cursors.add(cursor);
      } while (cursor);
    } catch (error) {
      if (signal.aborted) { await Promise.allSettled(connections.map(connection => connection.close())); signal.throwIfAborted(); }
      // 某个服务不完整时撤销它已发现的工具，避免以残缺目录误导模型。
      for (let index = tools.length - 1; index >= 0; index--) if (tools[index].id.startsWith(`mcp.${server.id}.`)) tools.splice(index, 1);
      errors.push(`${server.name}：${error instanceof Error ? error.message : "MCP 连接失败"}`);
    }
  }
  return { tools, errors, close: async () => { await Promise.allSettled(connections.map(connection => connection.close())); } };
}

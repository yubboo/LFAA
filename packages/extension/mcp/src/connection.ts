// 使用官方协议客户端管理 MCP 传输、工具分页及取消。此模块只运行在 Host。
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerConfig } from "./server-config";

const timeout = 10_000;
export type RemoteTool = ListToolsResult["tools"][number];

export function createConnection(config: ServerConfig): { client: Client; connect(signal: AbortSignal): Promise<void> } {
  const client = new Client({ name: "LFAA", version: "0.1.0" });
  const remote = () => {
    const url = new URL(config.url);
    const options = {
      requestInit: { headers: config.headers, redirect: "error" as const },
      fetch: (input: string | URL | Request, init?: RequestInit) => {
        const target = new URL(input instanceof Request ? input.url : input);
        if (target.origin !== url.origin) throw new Error("MCP credentials are limited to the configured origin.");
        return fetch(input, { ...init, redirect: "error" });
      },
    };
    return config.transport === "sse" ? new SSEClientTransport(url, options) : new StreamableHTTPClientTransport(url, options);
  };
  const transport = config.transport === "stdio"
    ? new StdioClientTransport({ command: config.command, args: config.args, env: config.env, stderr: "ignore", maxBufferSize: 8_388_608 })
    : remote();
  return { client, connect: (signal) => {
    // start() 在握手请求前执行，额外的取消监听也覆盖等待旧版 SSE endpoint 的阶段。
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(timeout)]);
    deadline.throwIfAborted();
    let close: (() => void) | undefined;
    const stopped = new Promise<never>((_resolve, reject) => {
      close = () => {
        void client.close().catch(() => undefined);
        reject(deadline.reason);
      };
      deadline.addEventListener("abort", close, { once: true });
    });
    return Promise.race([client.connect(transport, { signal: deadline, timeout }), stopped]).finally(() => {
      if (close) deadline.removeEventListener("abort", close);
    });
  } };
}

export async function discoverTools(client: Client, signal: AbortSignal): Promise<RemoteTool[]> {
  if (!client.getServerCapabilities()?.tools) return [];
  const tools = new Map<string, RemoteTool>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const response = await client.listTools(cursor ? { cursor } : undefined, { signal, timeout });
    for (const tool of response.tools) tools.set(tool.name, tool);
    cursor = response.nextCursor;
    if (cursor) {
      if (cursors.has(cursor) || cursors.size >= 100) throw new Error("Invalid MCP tool pagination.");
      cursors.add(cursor);
    }
  } while (cursor);
  return [...tools.values()];
}

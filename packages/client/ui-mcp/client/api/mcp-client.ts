// 浏览器端 MCP 请求封装。宿主令牌由 Web 入口统一注入。
import type { McpServerSummary } from "@lfaa/mcp/contract";

const base = "/api/mcp/servers";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const failure = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(failure?.error ?? `HTTP ${response.status}`);
  }
  return await response.json() as T;
}

const json = (method: string, payload?: unknown): RequestInit => (payload === undefined
  ? { method }
  : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

export const mcpApi = {
  list: (signal: AbortSignal) => request<{ servers: McpServerSummary[] }>(base, { signal }),
  projects: (signal: AbortSignal) => request<{ projects: Array<{ id: string; name: string }> }>("/api/workspace/projects", { signal }),
  create: (payload: unknown) => request<{ servers: McpServerSummary[] }>(base, json("POST", payload)),
  import: (payload: unknown) => request<{ servers: McpServerSummary[] }>(base + "/import", json("POST", payload)),
  update: (id: string, payload: unknown) => request<{ servers: McpServerSummary[] }>(base + "/" + encodeURIComponent(id), json("PATCH", payload)),
  remove: (id: string) => request<{ servers: McpServerSummary[] }>(base + "/" + encodeURIComponent(id), json("DELETE")),
  reconnect: (id: string) => request<{ servers: McpServerSummary[] }>(base + "/" + encodeURIComponent(id) + "/reconnect", json("POST")),
  test: (id: string) => request<{ count: number }>(base + "/" + encodeURIComponent(id) + "/test", json("POST")),
};

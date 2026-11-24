// MCP 设置接口的浏览器安全契约。连接参数只由客户端写入，Host 不回显。
export type McpTransport = "stdio" | "http" | "sse";
export type McpStatus = "disabled" | "connecting" | "connected" | "error";
export type McpTrust = "ask" | "trusted";

export interface McpToolSummary {
  name: string;
  title: string;
  trust: McpTrust | "inherit";
}

export interface McpServerSummary {
  id: string;
  transport: McpTransport;
  enabled: boolean;
  projectId: string | null;
  trust: McpTrust;
  status: McpStatus;
  tools: McpToolSummary[];
}

export interface McpServerPatch {
  transport?: McpTransport;
  enabled?: boolean;
  projectId?: string | null;
  trust?: McpTrust;
  toolTrust?: Record<string, McpTrust | "inherit">;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

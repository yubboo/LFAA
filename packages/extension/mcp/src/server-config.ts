// 校验 MCP 连接设置与 Claude Desktop/Cursor 导入内容，仅在 Host 使用。
import type { McpTransport, McpTrust } from "../contract";

export interface ServerConfig {
  id: string;
  transport: McpTransport;
  enabled: boolean;
  projectId: string | null;
  trust: McpTrust;
  toolTrust: Record<string, McpTrust>;
  command: string;
  args: string[];
  env: Record<string, string>;
  url: string;
  headers: Record<string, string>;
}

export class McpConfigError extends Error {}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new McpConfigError("Expected a JSON object.");
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string" || value.includes("\0")) throw new McpConfigError("Expected a text value.");
  return value;
}

function mapValues<T>(value: unknown, parse: (item: unknown) => T): Record<string, T> {
  return Object.fromEntries(Object.entries(record(value)).map(([key, item]) => [key, parse(item)]));
}

function trust(value: unknown): McpTrust {
  if (value === "ask" || value === "trusted") return value;
  throw new McpConfigError("Invalid approval policy.");
}

/** 编辑器省略未修改的连接字段，新连接和传输类型变更时重新校验。 */
export function parseServer(id: string, input: unknown, previous?: ServerConfig): ServerConfig {
  if (!/^[\p{L}\p{N}_][\p{L}\p{N}_. -]{0,79}$/u.test(id)) throw new McpConfigError("Invalid server name.");
  const patch = record(input);
  const transport = patch.transport ?? patch.type ?? previous?.transport ?? (patch.command !== undefined ? "stdio" : "http");
  if (transport !== "stdio" && transport !== "http" && transport !== "sse") {
    if (transport === "streamable-http" || transport === "streamableHttp") return parseServer(id, { ...patch, transport: "http" }, previous);
    throw new McpConfigError("Unsupported transport.");
  }
  const old = previous?.transport === transport ? previous : undefined;
  const enabled = patch.enabled ?? previous?.enabled ?? false;
  if (typeof enabled !== "boolean") throw new McpConfigError("Invalid enabled status.");
  const project = Object.hasOwn(patch, "projectId") ? patch.projectId : previous?.projectId ?? null;
  const projectId = project === null ? null : text(project);
  const toolTrust = { ...previous?.toolTrust };
  for (const [name, value] of Object.entries(record(patch.toolTrust ?? {}))) {
    if (value === "inherit") delete toolTrust[name];
    else Object.defineProperty(toolTrust, name, { value: trust(value), enumerable: true, configurable: true, writable: true });
  }
  const base = {
    id, transport, enabled, projectId, trust: trust(patch.trust ?? previous?.trust ?? "ask"), toolTrust,
    command: "", args: [], env: {}, url: "", headers: {},
  } satisfies ServerConfig;
  if (transport === "stdio") {
    const command = text(patch.command ?? old?.command ?? "").trim();
    const args = patch.args ?? old?.args ?? [];
    if (!command || !Array.isArray(args)) throw new McpConfigError("Enter a command and a JSON array of arguments.");
    return { ...base, command, args: (args as unknown[]).map(text), env: mapValues(patch.env ?? old?.env ?? {}, text) };
  }
  const url = URL.parse(text(patch.url ?? old?.url ?? ""));
  if (!url || !["https:", "http:"].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new McpConfigError("Enter an HTTP or HTTPS URL without embedded credentials or a fragment.");
  }
  const headers = mapValues(patch.headers ?? old?.headers ?? {}, text);
  try {
    new Headers(headers);
  } catch {
    throw new McpConfigError("Invalid HTTP headers.");
  }
  return { ...base, url: url.href, headers };
}

/** 导入只添加新条目，默认停用且由用户逐个授予信任。 */
export function parseImport(input: unknown): ServerConfig[] {
  const servers = Object.entries(record(record(input).mcpServers));
  if (servers.length === 0) throw new McpConfigError("Add at least one entry under mcpServers.");
  return servers.map(([id, config]) => parseServer(id, {
    ...record(config), enabled: false, projectId: null, trust: "ask", toolTrust: {},
  }));
}

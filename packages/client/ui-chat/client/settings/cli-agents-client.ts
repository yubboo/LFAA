// 浏览器端官方 CLI 代理管理客户端：封装 /api/cli-agents/* 请求与公共类型，供设置页与聊天模型选择器共用。
// 关联：packages/host/web-server/src/handlers/handlers-cli-agents.ts；运行环境：浏览器。
import { fetchJson } from "../store/chat-http";

export type CliAgentMode = "chat" | "terminal";

export interface CliAgentAccount {
  id: string;
  label: string;
  homeDir: string;
  createdAt: number;
}

export interface CliAgentSnapshot {
  id: string;
  name: string;
  vendor: string;
  binary: string;
  descriptionZh: string;
  descriptionEn: string;
  supportsChat: boolean;
  supportsAccounts: boolean;
  accountEnvVar: string | null;
  loginCommand: string;
  terminalCommand: string;
  installHint: string;
  docsUrl: string;
  installed: boolean;
  binaryPath: string | null;
  version: string | null;
  systemLoginDetected: boolean;
  enabled: boolean;
  openMode: CliAgentMode;
  extraArgs: string;
  activeAccountId: string | null;
  accounts: CliAgentAccount[];
}

export interface CliAgentsOverview {
  defaultOpenMode: CliAgentMode;
  agents: CliAgentSnapshot[];
}

export interface CliAgentCommandResponse {
  agentId: string;
  action: "login" | "terminal";
  command: string;
  envOverlay: Record<string, string>;
  accountLabel: string | null;
}

const CLI_AGENTS_CHANGE_EVENT = "lfaa:cli-agents-changed";

/** 广播 CLI 代理配置变化，通知输入栏模型选择器同步刷新。 */
export function notifyCliAgentsChanged(overview?: CliAgentsOverview): void {
  window.dispatchEvent(new CustomEvent(CLI_AGENTS_CHANGE_EVENT, { detail: overview ?? null }));
}

export function subscribeCliAgentsChanged(listener: (overview: CliAgentsOverview | null) => void): () => void {
  const handler = (event: Event) => {
    listener((event as CustomEvent<CliAgentsOverview | null>).detail ?? null);
  };
  window.addEventListener(CLI_AGENTS_CHANGE_EVENT, handler);
  return () => window.removeEventListener(CLI_AGENTS_CHANGE_EVENT, handler);
}

export function fetchCliAgentsOverview(): Promise<CliAgentsOverview> {
  return fetchJson<CliAgentsOverview>("/api/cli-agents");
}

export async function refreshCliAgentsOverview(): Promise<CliAgentsOverview> {
  const overview = await fetchJson<CliAgentsOverview>("/api/cli-agents/refresh", { method: "POST" });
  notifyCliAgentsChanged(overview);
  return overview;
}

export async function updateCliAgentsGlobal(patch: { defaultOpenMode: CliAgentMode }): Promise<CliAgentsOverview> {
  const overview = await fetchJson<CliAgentsOverview>("/api/cli-agents/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  notifyCliAgentsChanged(overview);
  return overview;
}

export async function updateCliAgentConfig(
  agentId: string,
  patch: Partial<{ enabled: boolean; openMode: CliAgentMode; extraArgs: string; activeAccountId: string | null }>,
): Promise<CliAgentsOverview> {
  const overview = await fetchJson<CliAgentsOverview>(`/api/cli-agents/${encodeURIComponent(agentId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  notifyCliAgentsChanged(overview);
  return overview;
}

export async function addCliAgentAccount(agentId: string, label: string): Promise<CliAgentsOverview> {
  const res = await fetchJson<{ overview: CliAgentsOverview }>(`/api/cli-agents/${encodeURIComponent(agentId)}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  notifyCliAgentsChanged(res.overview);
  return res.overview;
}

export async function removeCliAgentAccount(agentId: string, accountId: string): Promise<CliAgentsOverview> {
  const overview = await fetchJson<CliAgentsOverview>(
    `/api/cli-agents/${encodeURIComponent(agentId)}/accounts/${encodeURIComponent(accountId)}`,
    { method: "DELETE" },
  );
  notifyCliAgentsChanged(overview);
  return overview;
}

export function buildCliAgentCommand(agentId: string, action: "login" | "terminal"): Promise<CliAgentCommandResponse> {
  return fetchJson<CliAgentCommandResponse>(`/api/cli-agents/${encodeURIComponent(agentId)}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

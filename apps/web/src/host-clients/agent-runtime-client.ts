/**
 * 文件：agent-runtime-client.ts
 * 作用：浏览器连接本地 Web Agent Runtime Bridge，并把 Vite custom event 适配为统一 AgentRuntimeHost。
 */
import type { AgentRunHandle, AgentRunRequest, AgentRuntimeEvent, AgentRuntimeEventListener, AgentRuntimeHost } from "@lfaa/agent-runtime";

const BASE = "/__lfaa/dev/agent";
const listeners = new Set<AgentRuntimeEventListener>();
let hotBound = false;

function bindHotEvents(): void {
  if (hotBound || !import.meta.hot) return;
  hotBound = true;
  import.meta.hot.on("lfaa:agent-runtime-event", (event: AgentRuntimeEvent) => {
    for (const listener of listeners) listener(event);
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = await response.json() as { ok: boolean; error?: string } & T;
  if (!response.ok || !payload.ok) throw new Error(payload.error || `Agent Runtime 请求失败：${response.status}`);
  return payload;
}

export const webAgentRuntimeHost: AgentRuntimeHost = {
  async startRun(runRequest: AgentRunRequest): Promise<AgentRunHandle> {
    bindHotEvents();
    return (await request<{ handle: AgentRunHandle }>("/runs", { method: "POST", body: JSON.stringify({ request: runRequest }) })).handle;
  },
  async cancelRun(runId: string): Promise<void> {
    await request(`/runs/${encodeURIComponent(runId)}`, { method: "DELETE" });
  },
  subscribe(listener: AgentRuntimeEventListener): () => void {
    bindHotEvents();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/// <reference path="./vite-custom-events.d.ts" />
/**
 * 文件：agent-runtime-client.ts
 * 作用：浏览器连接本地 Web Agent Runtime，并把 HTTP/HMR 适配为统一 AgentRuntimeHost。
 * 负责：start / intervene / cancel / subscribe。
 * 不负责：Provider 协议、模型配置、Workspace UI 状态。
 * 状态归属：只持有浏览器事件订阅集合，无业务持久状态。
 * 对外接口：webAgentRuntimeHost。
 * 关联文件：@lfaa/agent-runtime、packages/api/agent-controller。
 * 修改注意事项：Chat/Work 必须共用本 Host；Manual 不调用这些接口。
 */
import type {
  AgentInterventionDisposition,
  AgentInterventionRequest,
  AgentRunHandle,
  AgentRunRequest,
  AgentRuntimeEvent,
  AgentRuntimeEventListener,
  AgentRuntimeHost,
} from "@lfaa/agent-runtime";

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
  async interveneRun(runId: string, intervention: AgentInterventionRequest): Promise<{ handle: AgentRunHandle; disposition: AgentInterventionDisposition }> {
    bindHotEvents();
    return request<{ handle: AgentRunHandle; disposition: AgentInterventionDisposition }>(`/runs/${encodeURIComponent(runId)}/interventions`, {
      method: "POST",
      body: JSON.stringify({ request: intervention }),
    });
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

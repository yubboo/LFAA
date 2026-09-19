/**
 * 文件：ai-settings-client.ts
 * 作用：Web 浏览器宿主访问本地 AI 配置 Bridge 的 Client Adapter。
 * 负责：同源 HTTP 请求、错误映射、把 Host API 适配为 AgentAiSettingsHost。
 * 不负责：Provider URL、Secret 持久化、业务规则、UI。
 * 状态归属：无持久状态。
 * 对外接口：webAiSettingsHost。
 * 关联文件：apps/web/dev/bridges/ai/ai-config-bridge.ts、@lfaa/app-shell workbench.types.ts。
 * 修改注意事项：Secret 只允许出现在请求体内存中，禁止 console/localStorage/sessionStorage/URL。
 */
import type { AgentAiSettingsHost } from "@lfaa/app-shell";
import type { AiAccountDraft, AiAccountProbeResult, AiAccountSnapshot, AiModelSettingValue } from "@lfaa/config-system";

const BASE = "/__lfaa/dev/ai";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = await response.json() as { ok: boolean; error?: string } & T;
  if (!response.ok || !payload.ok) throw new Error(payload.error || `AI Host 请求失败：${response.status}`);
  return payload;
}

export const webAiSettingsHost: AgentAiSettingsHost = {
  async snapshot() {
    const payload = await request<AiAccountSnapshot>("/accounts");
    return { accounts: payload.accounts, secretPersistence: payload.secretPersistence };
  },
  async probe(draft: AiAccountDraft, secret: string) {
    const payload = await request<{ probe: AiAccountProbeResult }>("/probe", { method: "POST", body: JSON.stringify({ draft, secret }) });
    return payload.probe;
  },
  async save(draft: AiAccountDraft, secret: string) {
    const payload = await request<{ probe: AiAccountProbeResult; snapshot: AiAccountSnapshot }>("/accounts", { method: "POST", body: JSON.stringify({ draft, secret }) });
    return { probe: payload.probe, snapshot: payload.snapshot };
  },
  async reprobe(accountId: string) {
    const payload = await request<{ probe: AiAccountProbeResult }>(`/accounts/${encodeURIComponent(accountId)}/probe`, { method: "POST", body: "{}" });
    return payload.probe;
  },
  async deleteAccount(accountId: string) {
    const payload = await request<{ snapshot: AiAccountSnapshot }>(`/accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" });
    return payload.snapshot;
  },
  async selectModel(accountId: string, modelId: string, modelSettings: Readonly<Record<string, AiModelSettingValue>>) {
    const payload = await request<{ snapshot: AiAccountSnapshot }>(`/accounts/${encodeURIComponent(accountId)}/model`, { method: "POST", body: JSON.stringify({ modelId, modelSettings }) });
    return payload.snapshot;
  },
};

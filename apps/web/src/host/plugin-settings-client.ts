/**
 * 文件：plugin-settings-client.ts
 * 作用：浏览器设置中心访问本地 PluginManager Bridge 的 Client Adapter。
 * 负责：同源请求、JSON transport → Registry Map 重建、AgentPluginSettingsHost 适配。
 * 不负责：pnpm、Secret、第三方代码执行、权限绕过。
 */
import type { AgentPluginSettingsHost } from "@lfaa/app-shell";
import type { InstalledPluginBundle, PluginInstallOutcome, PluginManagerSnapshot, PluginSpecInspection } from "@lfaa/plugin-runtime";
import type { LfaaCapabilityDescriptor, LfaaPluginManifest } from "@lfaa/plugin-sdk";

const BASE = "/__lfaa/dev/plugins";

interface TransportSnapshot {
  installed: readonly InstalledPluginBundle[];
  registry: {
    generation: number;
    plugins: readonly LfaaPluginManifest[];
    capabilities: readonly LfaaCapabilityDescriptor[];
  };
}

function restoreSnapshot(value: TransportSnapshot): PluginManagerSnapshot {
  return {
    installed: value.installed,
    registry: {
      generation: value.registry.generation,
      plugins: new Map(value.registry.plugins.map((plugin) => [plugin.pluginId, plugin])),
      capabilities: new Map(value.registry.capabilities.map((capability) => [capability.id, capability])),
    },
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = await response.json() as { ok: boolean; error?: string } & T;
  if (!response.ok || !payload.ok) throw new Error(payload.error || `Plugin Host 请求失败：${response.status}`);
  return payload;
}

export const webPluginSettingsHost: AgentPluginSettingsHost = {
  async snapshot() {
    return restoreSnapshot((await request<{ snapshot: TransportSnapshot }>("/snapshot")).snapshot);
  },
  async inspect(spec: string) {
    return (await request<{ inspection: PluginSpecInspection }>("/inspect", { method: "POST", body: JSON.stringify({ spec }) })).inspection;
  },
  async install(spec: string, requestId: string, approvedBuilds?: readonly string[]) {
    const payload = await request<{ outcome: PluginInstallOutcome; snapshot: TransportSnapshot }>("/install", {
      method: "POST",
      body: JSON.stringify({ spec, requestId, ...(approvedBuilds?.length ? { approvedBuilds } : {}) }),
    });
    return { outcome: payload.outcome, snapshot: restoreSnapshot(payload.snapshot) };
  },
  async setEnabled(packageName: string, enabled: boolean) {
    return restoreSnapshot((await request<{ snapshot: TransportSnapshot }>("/enable", { method: "POST", body: JSON.stringify({ packageName, enabled }) })).snapshot);
  },
  async remove(packageName: string) {
    return restoreSnapshot((await request<{ snapshot: TransportSnapshot }>("/remove", { method: "POST", body: JSON.stringify({ packageName }) })).snapshot);
  },
  async cancel(requestId: string) {
    await request("/cancel", { method: "POST", body: JSON.stringify({ requestId }) });
  },
};

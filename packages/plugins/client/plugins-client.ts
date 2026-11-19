// @lfaa/plugins 浏览器端 HTTP 请求封装，与 Host /api/plugins 接口通信。
import type { PluginCatalogItem, PluginRecord } from "../contract/index";

export interface PluginsStatePayload {
  profile?: string;
  profileRoot?: string;
  installed: PluginRecord[];
  availableCatalog: PluginCatalogItem[];
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data;
}

export async function fetchPluginsState(): Promise<PluginsStatePayload> {
  const res = await fetch("/api/plugins");
  return parseJson<PluginsStatePayload>(res);
}

export async function installPluginRequest(catalogId: string): Promise<PluginsStatePayload> {
  const res = await fetch("/api/plugins/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ catalogId }),
  });
  return parseJson<PluginsStatePayload>(res);
}

export async function enablePluginRequest(id: string): Promise<PluginsStatePayload> {
  const res = await fetch(`/api/plugins/${encodeURIComponent(id)}/enable`, { method: "POST" });
  return parseJson<PluginsStatePayload>(res);
}

export async function disablePluginRequest(id: string): Promise<PluginsStatePayload> {
  const res = await fetch(`/api/plugins/${encodeURIComponent(id)}/disable`, { method: "POST" });
  return parseJson<PluginsStatePayload>(res);
}

export async function uninstallPluginRequest(id: string): Promise<PluginsStatePayload> {
  const res = await fetch(`/api/plugins/${encodeURIComponent(id)}/uninstall`, { method: "POST" });
  return parseJson<PluginsStatePayload>(res);
}

export async function forkPluginRequest(id: string): Promise<PluginsStatePayload> {
  const res = await fetch(`/api/plugins/${encodeURIComponent(id)}/fork`, { method: "POST" });
  return parseJson<PluginsStatePayload>(res);
}

export async function updatePluginManifestRequest(
  id: string,
  patch: { name?: string; description?: string },
): Promise<PluginsStatePayload> {
  const res = await fetch(`/api/plugins/${encodeURIComponent(id)}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseJson<PluginsStatePayload>(res);
}

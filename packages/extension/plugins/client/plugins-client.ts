// @lfaa/plugins 浏览器端 HTTP 请求封装，与 Host /api/plugins 接口通信。
import type { PluginCatalogItem, PluginRecord } from "../contract/index";

export interface PluginsStatePayload {
  profile?: string;
  profileRoot?: string;
  installed: PluginRecord[];
  availableCatalog: PluginCatalogItem[];
  presets?: Array<{ id: string; name: string; description: string; modules: string[] }>;
  activePreset?: string;
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

/** 内置插件一步启用：不存在安装语义，Host 侧直接登记为已启用。 */
export async function enableBuiltinRequest(moduleName: string): Promise<PluginsStatePayload & { plugin: PluginRecord }> {
  const res = await fetch("/api/plugins/builtin/enable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moduleName }),
  });
  const payload = await parseJson<PluginsStatePayload & { plugin?: PluginRecord }>(res);
  if (!payload.plugin) throw new Error("启用响应缺少插件记录。");
  return { ...payload, plugin: payload.plugin };
}

/** 按模块说明符（包名或 file: URL）安装；Host 侧会拒绝已由 bundle 装配的包。 */
export async function installPluginRequest(moduleName: string): Promise<PluginsStatePayload & { plugin: PluginRecord }> {
  const res = await fetch("/api/plugins/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moduleName }),
  });
  const payload = await parseJson<PluginsStatePayload & { plugin?: PluginRecord }>(res);
  if (!payload.plugin) throw new Error("安装响应缺少插件记录。");
  return { ...payload, plugin: payload.plugin };
}

/** 切换当前模式预设。 */
export async function setPresetRequest(id: string): Promise<PluginsStatePayload> {
  const res = await fetch("/api/plugins/preset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
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

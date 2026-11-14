/**
 * 已安装 AI 扩展/插件与运行控制 API；安装进度协议复用既有认证代次/错误边界。
 */
import { ApiError, authenticationGeneration, clearPendingReads, handleSessionAuthenticationFailure, isSessionAuthenticationError, request } from "./http-client.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";
import type { AiExtension, AiRuntimeHookInfo, AiRuntimePlugin, ManagedPluginInstallProgress, ManagedPluginRecord } from "./ai-plugin-types.js";
import type { ManagedPluginInspection } from "./ai-capability-types.js";



export function loadAiExtensions(signal?: AbortSignal): Promise<{ plugins: AiRuntimePlugin[]; extensions: AiExtension[]; hooks: AiRuntimeHookInfo[]; hotReloadEnabled: boolean }> {
  return request<{ plugins: AiRuntimePlugin[]; extensions: AiExtension[]; hooks: AiRuntimeHookInfo[]; hotReloadEnabled: boolean }>("/ai/extensions", signal ? { signal } : {});
}


export function loadManagedPlugins(signal?: AbortSignal): Promise<{ profile: string; installationDirectory: string; plugins: ManagedPluginRecord[] }> {
  return request("/plugins", signal ? { signal } : {});
}


export function setManagedPluginEnabled(pluginId: string, input: { enabled: boolean; targetApplicationId: ApplicationId; expectedSourceCommit: string }): Promise<{ plugin: ManagedPluginRecord }> {
  return request(`/plugins/${encodeURIComponent(pluginId)}/lifecycle`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}


export async function installManagedPlugin(
  input: { repositoryUrl: string; ref: string; expectedResolvedRef: string; expectedSourceType: ManagedPluginInspection["sourceType"]; expectedSourceLocation: string; npmRegistry?: string },
  onProgress?: (progress: ManagedPluginInstallProgress) => void
): Promise<{ plugin: ManagedPluginRecord }> {
  const requestGeneration = authenticationGeneration;
  clearPendingReads();
  try {
    const response = await fetch("/api/plugins/install", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      credentials: "include",
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      const rawBody = await response.text();
      let responseBody: unknown;
      try { responseBody = rawBody ? JSON.parse(rawBody) as unknown : undefined; } catch { responseBody = undefined; }
      const message = typeof responseBody === "object" && responseBody !== null && "message" in responseBody && typeof responseBody.message === "string" ? responseBody.message : "插件安装请求失败，请稍后重试。";
      const code = typeof responseBody === "object" && responseBody !== null && "error" in responseBody && typeof responseBody.error === "string" ? responseBody.error : undefined;
      if (isSessionAuthenticationError(response.status, code)) handleSessionAuthenticationFailure("/plugins/install", requestGeneration);
      throw new ApiError(response.status, message, code);
    }
    if (!response.body) throw new ApiError(response.status, "插件安装服务没有返回进度流。", "plugin_install_stream_missing");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pendingLine = "";
    let result: { plugin: ManagedPluginRecord } | null = null;
    const consumeLine = (line: string): void => {
      if (!line.trim()) return;
      let event: unknown;
      try { event = JSON.parse(line) as unknown; }
      catch { throw new ApiError(response.status, "插件安装进度格式无效。", "plugin_install_stream_invalid"); }
      if (typeof event !== "object" || event === null || !("event" in event)) throw new ApiError(response.status, "插件安装进度格式无效。", "plugin_install_stream_invalid");
      if (event.event === "progress" && "progress" in event && typeof event.progress === "object" && event.progress !== null) {
        onProgress?.(event.progress as ManagedPluginInstallProgress);
        return;
      }
      if (event.event === "result" && "result" in event && typeof event.result === "object" && event.result !== null && "plugin" in event.result) {
        result = event.result as { plugin: ManagedPluginRecord };
        return;
      }
      if (event.event === "error" && "error" in event && typeof event.error === "object" && event.error !== null) {
        const failure = event.error as { status?: unknown; code?: unknown; message?: unknown };
        throw new ApiError(typeof failure.status === "number" ? failure.status : response.status, typeof failure.message === "string" ? failure.message : "插件安装失败。", typeof failure.code === "string" ? failure.code : "plugin_operation_failed");
      }
      throw new ApiError(response.status, "插件安装进度包含未知事件。", "plugin_install_stream_invalid");
    };

    try {
      while (true) {
        const chunk = await reader.read();
        pendingLine += decoder.decode(chunk.value, { stream: !chunk.done });
        if (pendingLine.length > 1_048_576) throw new ApiError(response.status, "插件安装进度行超过允许长度。", "plugin_install_stream_invalid");
        let newline = pendingLine.indexOf("\n");
        while (newline >= 0) {
          consumeLine(pendingLine.slice(0, newline));
          pendingLine = pendingLine.slice(newline + 1);
          newline = pendingLine.indexOf("\n");
        }
        if (chunk.done) break;
      }
      consumeLine(pendingLine);
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    }
    if (!result) throw new ApiError(response.status, "插件安装进度流结束，但没有收到安装结果。", "plugin_install_result_missing");
    return result;
  } finally {
    clearPendingReads();
  }
}


export function removeManagedPlugin(pluginId: string, input: { targetApplicationId: ApplicationId; expectedSourceCommit: string }): Promise<{ removed: true }> {
  return request(`/plugins/${encodeURIComponent(pluginId)}/remove`, { method: "POST", body: JSON.stringify(input) });
}


export function manageAiRuntimePlugin(pluginId: string, action: "start" | "stop" | "reload"): Promise<{ plugins: AiRuntimePlugin[]; hotReloadEnabled: boolean }> {
  return request<{ plugins: AiRuntimePlugin[]; hotReloadEnabled: boolean }>(`/settings/runtime-plugins/${encodeURIComponent(pluginId)}/actions`, {
    method: "POST",
    body: JSON.stringify({ action })
  });
}

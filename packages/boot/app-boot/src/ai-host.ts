/**
 * 功能：创建和关闭 LFAA 后端 AI 插件宿主。
 * 作用：用 Cordis 装配受信任的内置扩展登记插件，并在开发环境启用源码热更新。
 * 关联文件：packages/host/webserver/src/server.ts、packages/util/launch-environment/src/config.ts、packages/telemetry/logger/src/logger.ts、packages/core/agent/src/extension-registry.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { AiExtensionKind, AiExtensionManifest, AiExtensionRegistry } from "lfaa-agent/src/extension-registry.js";
import type { AiRuntimeHookInfo, AiRuntimeHookRegistry, AiRuntimeHookResult } from "lfaa-hook-protocol/src/runtime-hooks.js";
import type { PluginRuntimeSnapshot } from "./plugin-runtime.js";

export type AiPluginSnapshot = PluginRuntimeSnapshot;

export interface AiPluginHost {
  readonly hotReloadEnabled: boolean;
  listPlugins(): AiPluginSnapshot[];
  setPluginEnabled(pluginId: string, enabled: boolean): Promise<void>;
  reloadPlugin(pluginId: string): Promise<void>;
  listExtensions(kind?: AiExtensionKind): AiExtensionManifest[];
  listInstructionExtensions(applicationId: "steamcmd" | "minecraft" | "writing" | "workspace"): AiExtensionManifest[];
  listHooks(): AiRuntimeHookInfo[];
  getSystemInstructions(applicationId: "steamcmd" | "minecraft" | "writing" | "workspace"): string[];
  runBeforeInference(event: Parameters<AiRuntimeHookRegistry["beforeInference"]>[0]): AiRuntimeHookResult;
  runAfterInference(event: Parameters<AiRuntimeHookRegistry["afterInference"]>[0]): AiRuntimeHookResult;
  close(): Promise<void>;
}

export function createAiPluginHost(context: Context): AiPluginHost {
  let closed = false;
  return {
    get hotReloadEnabled() {
      return Boolean(context.get("lfaaHotReload")) && context.lfaaPluginRuntime.list().some((plugin) => plugin.id === "hmr" && plugin.enabled);
    },
    listPlugins: () => context.lfaaPluginRuntime.list(),
    setPluginEnabled: (pluginId, enabled) => context.lfaaPluginRuntime.setEnabled(pluginId, enabled),
    reloadPlugin: (pluginId) => context.lfaaPluginRuntime.reload(pluginId),
    listExtensions: (kind) => (context.aiExtensions as AiExtensionRegistry).list(kind),
    listInstructionExtensions: (applicationId) => (context.aiExtensions as AiExtensionRegistry).listInstructionExtensions(applicationId),
    listHooks: () => (context.aiRuntimeHooks as AiRuntimeHookRegistry).list(),
    getSystemInstructions: (applicationId) => (context.aiExtensions as AiExtensionRegistry).getInstructions(applicationId),
    runBeforeInference: (event) => (context.aiRuntimeHooks as AiRuntimeHookRegistry).beforeInference(event),
    runAfterInference: (event) => (context.aiRuntimeHooks as AiRuntimeHookRegistry).afterInference(event),
    close: async () => {
      if (closed) return;
      closed = true;
      // 共享上下文由启动器关闭，API 适配器只撤销自己的引用状态。
    }
  };
}

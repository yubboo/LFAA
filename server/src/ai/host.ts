/**
 * 功能：创建和关闭 LFAA 后端 AI 插件宿主。
 * 作用：用 Cordis 装配受信任的内置扩展登记插件，并在开发环境启用源码热更新。
 * 关联文件：server/src/index.ts、server/src/config.ts、server/src/logger.ts、server/src/ai/plugins/extension-registry.ts。
 */
import { Context } from "@deepseek-ai/cordis";
import Hmr from "@deepseek-ai/cordis-plugin-hmr";
import Loader from "@deepseek-ai/cordis-plugin-loader";
import Timer from "@deepseek-ai/cordis-plugin-timer";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { AiExtensionKind, AiExtensionManifest, AiExtensionRegistry } from "./plugins/extension-registry.js";
import type { AiRuntimeHookInfo, AiRuntimeHookRegistry, AiRuntimeHookResult } from "./plugins/runtime-hooks.js";

// Cordis 4.0.4 将 FiberState 声明为 const enum，类型定义可见但运行时没有对应导出。
const FIBER_STATE = {
  PENDING: 0,
  LOADING: 1,
  ACTIVE: 2,
  FAILED: 3,
  DISPOSED: 4,
  UNLOADING: 5
} as const;

export interface AiPluginSnapshot {
  id: string;
  enabled: boolean;
  state: string;
}

export interface AiPluginHost {
  readonly hotReloadEnabled: boolean;
  listPlugins(): AiPluginSnapshot[];
  listExtensions(kind?: AiExtensionKind): AiExtensionManifest[];
  listHooks(): AiRuntimeHookInfo[];
  getSystemInstructions(applicationId: "steamcmd" | "minecraft" | "writing"): string[];
  runBeforeInference(event: Parameters<AiRuntimeHookRegistry["beforeInference"]>[0]): AiRuntimeHookResult;
  runAfterInference(event: Parameters<AiRuntimeHookRegistry["afterInference"]>[0]): AiRuntimeHookResult;
  close(): Promise<void>;
}

function getRegistryPluginUrl(): string {
  const extension = import.meta.url.endsWith(".ts") ? "ts" : "js";
  return new URL(`./plugins/extension-registry.${extension}`, import.meta.url).href;
}

function getBuiltinCatalogPluginUrl(): string {
  const extension = import.meta.url.endsWith(".ts") ? "ts" : "js";
  return new URL(`./plugins/builtin-catalog.${extension}`, import.meta.url).href;
}

function getRuntimeHooksPluginUrl(): string {
  const extension = import.meta.url.endsWith(".ts") ? "ts" : "js";
  return new URL(`./plugins/runtime-hooks.${extension}`, import.meta.url).href;
}

export async function createAiPluginHost(): Promise<AiPluginHost> {
  const context = new Context();
  let hotReloadEnabled = false;

  try {
    context.baseUrl = import.meta.url;
    await context.plugin(Loader, { baseUrl: import.meta.url });
    await context.plugin(Timer);

    if (config.nodeEnvironment === "development") {
      try {
        await context.plugin(Hmr, {
          root: ["plugins"],
          ignored: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
          debounce: 120
        });
        context.on("hmr/reload", (reloads) => {
          logger.info("LFAA AI 内置插件热更新完成", { reloadedPluginCount: reloads.size });
        });
        hotReloadEnabled = true;
      } catch (error) {
        logger.warn("AI 插件源码热更新未启用，宿主仍可运行", {
          errorName: error instanceof Error ? error.name : "UnknownError"
        });
      }
    }

    await context.loader.create({ name: getRegistryPluginUrl() });
    await context.loader.create({ name: getRuntimeHooksPluginUrl() });
    await context.loader.create({ name: getBuiltinCatalogPluginUrl(), inject: ["aiExtensions", "aiRuntimeHooks"] });
    await context.loader.await();

    const pluginCount = [...context.loader.entries()].length;
    logger.info("LFAA AI 插件宿主已启动", {
      pluginCount,
      hotReloadEnabled,
      inferenceEnabled: true
    });

    let closed = false;
    return {
      hotReloadEnabled,
      listPlugins: () => [...context.loader.entries()].map((entry) => {
        const lifecycle = entry.fiber?.state;
        const state = lifecycle === FIBER_STATE.ACTIVE ? "ACTIVE"
          : lifecycle === FIBER_STATE.FAILED ? "FAILED"
            : lifecycle === FIBER_STATE.LOADING ? "LOADING"
              : lifecycle === FIBER_STATE.UNLOADING ? "UNLOADING"
                : lifecycle === FIBER_STATE.DISPOSED ? "DISPOSED" : "PENDING";
        return { id: entry.id, enabled: !entry.disabled && lifecycle === FIBER_STATE.ACTIVE, state };
      }),
      listExtensions: (kind) => (context.aiExtensions as AiExtensionRegistry).list(kind),
      listHooks: () => (context.aiRuntimeHooks as AiRuntimeHookRegistry).list(),
      getSystemInstructions: (applicationId) => (context.aiExtensions as AiExtensionRegistry).getInstructions(applicationId),
      runBeforeInference: (event) => (context.aiRuntimeHooks as AiRuntimeHookRegistry).beforeInference(event),
      runAfterInference: (event) => (context.aiRuntimeHooks as AiRuntimeHookRegistry).afterInference(event),
      close: async () => {
        if (closed) return;
        closed = true;
        await context.fiber.dispose();
      }
    };
  } catch (error) {
    await context.fiber.dispose();
    throw error;
  }
}

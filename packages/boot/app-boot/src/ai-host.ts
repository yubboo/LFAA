/**
 * 功能：创建和关闭 LFAA 后端 AI 插件宿主。
 * 作用：用 Cordis 装配受信任的内置扩展登记插件，并在开发环境启用源码热更新。
 * 关联文件：packages/host/webserver/src/server.ts、packages/util/launch-environment/src/config.ts、packages/telemetry/logger/src/logger.ts、packages/core/agent/src/extension-registry.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";
import type { AiExtensionKind, AiExtensionManifest, AiExtensionRegistry } from "lfaa-agent/src/extension-registry.js";
import type { AiRuntimeHookInfo, AiRuntimeHookRegistry, AiRuntimeHookResult } from "lfaa-hook-protocol/src/runtime-hooks.js";
import type { PluginRuntimeSnapshot } from "./plugin-runtime.js";
import type { SkillLookupOptions, SkillSummary } from "lfaa-skill";
import type { AiCompletionMessage } from "lfaa-llm/src/completion.js";
import type { AiCompletionService } from "lfaa-llm/src/completion.js";

/** Host 只适配已装配压缩服务；摘要请求由调用 Run 负责。 */
export interface HostCompactionInput {
  messages: AiCompletionMessage[];
  contextWindow: number;
  signal?: AbortSignal;
  summarize: (text: string, instruction: string) => Promise<string>;
}

export type AiPluginSnapshot = PluginRuntimeSnapshot;

export interface AiPluginHost {
  /** All model requests share the active provider registry, including summaries and memory. */
  llm: AiCompletionService;
  /** 当前请求的目录，正文仍由模型按需调用 Skill 工具。 */
  listSkills?: (options: SkillLookupOptions) => Promise<SkillSummary[]>;
  compactContext?: (input: HostCompactionInput) => Promise<{ messages: AiCompletionMessage[] } | null>;
  readonly hotReloadEnabled: boolean;
  listPlugins(): AiPluginSnapshot[];
  setPluginEnabled(pluginId: string, enabled: boolean): Promise<void>;
  reloadPlugin(pluginId: string): Promise<void>;
  listExtensions(kind?: AiExtensionKind): AiExtensionManifest[];
  listInstructionExtensions(applicationId: ApplicationId): AiExtensionManifest[];
  listHooks(): AiRuntimeHookInfo[];
  getSystemInstructions(applicationId: ApplicationId): string[];
  /** 模型选择正文/专家时使用同一个扩展 Owner，不从 App 自动加载。 */
  loadInstruction?: (id: string, applicationId: ApplicationId) => Promise<AiExtensionManifest & { instructions: string }>;
  runBeforeInference(event: Parameters<AiRuntimeHookRegistry["beforeInference"]>[0]): AiRuntimeHookResult;
  runAfterInference(event: Parameters<AiRuntimeHookRegistry["afterInference"]>[0]): AiRuntimeHookResult;
  close(): Promise<void>;
}

export function createAiPluginHost(context: Context): AiPluginHost {
  let closed = false;
  const llm = context.get("lfaaLlm") as AiCompletionService | undefined;
  if (!llm) throw new Error("LLM Provider 服务尚未装载。");
  return {
    llm,
    listSkills: options => context.skills.list(options),
    compactContext: async input => {
      const service = context.get("lfaaCompaction");
      if (!service) return null;
      return service.createBasicCompactionEngine({ summarize: input.summarize, streamCompletion: llm.streamCompletion }).compactIfNeeded({ messages: input.messages, contextWindow: input.contextWindow, ...(input.signal ? { signal: input.signal } : {}), trigger: { reason: "pressure" } });
    },
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
    loadInstruction: (id, applicationId) => (context.aiExtensions as AiExtensionRegistry).loadInstructions(id, applicationId),
    runBeforeInference: (event) => (context.aiRuntimeHooks as AiRuntimeHookRegistry).beforeInference(event),
    runAfterInference: (event) => (context.aiRuntimeHooks as AiRuntimeHookRegistry).afterInference(event),
    close: async () => {
      if (closed) return;
      closed = true;
      // 共享上下文由启动器关闭，API 适配器只撤销自己的引用状态。
    }
  };
}

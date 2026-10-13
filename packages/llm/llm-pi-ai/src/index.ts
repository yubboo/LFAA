/**
 * 移植参考：DeepSeek Harness dsh-llm-pi-ai（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：index.ts
 * 功能：豆包/火山方舟 Provider 服务插件（完整 Provider：目录/认证/探测/模型/上下文/流式）。
 * 作用：在默认装配中加载，集中暴露 Ark 事实与各子能力；Provider 目录条目见 settings/service.ts 的 doubao case。
 * 适配说明：DSH 版本基于 ctx.llm.registerAdapter 与 pi-ai SDK，LFAA 无此体系；
 *   实际 chat 统一走 settings 解析 + lfaa-llm 的 streamAiCompletion（OpenAI 兼容）。
 *   本包提供豆包专属的目录/认证/探测/模型选择/上下文估算/流式解析原语，不重复发 HTTP。
 * 关联文件：packages/settings/settings/src/service.ts（resolveProvider 的 doubao 分支）。
 */
import type { Context } from "@deepseek-ai/cordis";
import {
  DOUBAO_PROVIDER_ID,
  DOUBAO_PROVIDER_NAME,
  DOUBAO_DEFAULT_MODELS,
  ARK_BASE_URL,
  type PiAiProviderService
} from "./ark.js";
import { checkArkApiKey } from "./auth.js";
import { discoverArkModels } from "./discovery.js";
import { listDoubaoModels, pickDefaultModel } from "./models.js";
import { evaluateContextPressure } from "./context.js";
import { loginWithArkApiKey } from "./login.js";
import { createDoubaoProvider } from "./provider.js";

// 子模块导出，供其他包按需引用。
export { checkArkApiKey } from "./auth.js";
export { discoverArkModels, type ArkDiscoveryResult, type DiscoveredModel } from "./discovery.js";
export { listDoubaoModels, pickDefaultModel, DEFAULT_DOUBAO_MODEL_ID } from "./models.js";
export { evaluateContextPressure, type ContextPressure } from "./context.js";
export { loginWithArkApiKey, type ArkLoginResult } from "./login.js";
export { createDoubaoProvider, type DoubaoProvider } from "./provider.js";
export { DoubaoReplayCache } from "./replay.js";
export { buildArkChatRequest, readArkUsage, type ArkChatRequest } from "./adapter.js";
export { defaultDoubaoCatalog, lookupDoubaoCapability, type DoubaoModelCapability } from "./catalog.js";
export { resolveThinking, type DoubaoAccountConfig } from "./config.js";
export { consumeArkStream } from "./stream.js";

export const name = "lfaaLlmPiAi";
// 可配置 Provider 能力：不强制依赖主链；登记后默认加载，用户配置密钥后即可选用。
export const inject = [] as const;

/** 豆包 Provider 服务：元数据 + 各子能力聚合。 */
export interface LfaaPiAiService extends PiAiProviderService {
  checkKey: typeof checkArkApiKey;
  discover: typeof discoverArkModels;
  listModels: typeof listDoubaoModels;
  pickModel: typeof pickDefaultModel;
  evaluateContext: typeof evaluateContextPressure;
  login: typeof loginWithArkApiKey;
  provider: ReturnType<typeof createDoubaoProvider>;
}

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaLlmPiAi: LfaaPiAiService }
}

/** 构造豆包 Provider 服务实例（聚合元数据与子能力）。 */
export function createPiAiProviderService(): LfaaPiAiService {
  return Object.freeze({
    providerId: DOUBAO_PROVIDER_ID,
    displayName: DOUBAO_PROVIDER_NAME,
    baseUrl: ARK_BASE_URL,
    defaultModels: () => DOUBAO_DEFAULT_MODELS,
    checkKey: checkArkApiKey,
    discover: discoverArkModels,
    listModels: listDoubaoModels,
    pickModel: pickDefaultModel,
    evaluateContext: evaluateContextPressure,
    login: loginWithArkApiKey,
    provider: createDoubaoProvider()
  });
}

/** Cordis 装配：登记豆包 Provider 服务。 */
export function apply(ctx: Context): void {
  ctx.provide(name, createPiAiProviderService());
}

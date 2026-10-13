/**
 * 移植参考：DeepSeek Harness dsh-llm-pi-ai（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：ark.ts
 * 功能：火山方舟（Volcano Ark / 豆包）Provider 的端点常量与默认模型目录。
 * 作用：LFAA 的 Provider 解析集中在 settings/service.ts（resolveProvider），本包只集中维护
 *   Ark 的公开端点事实与一份精选默认模型目录，供默认模型选择与模型目录 UI 参考。
 * 说明：实际 chat/completions 请求由 lfaa-llm 的 streamAiCompletion 经 settings 解析后发出；
 *   本包不持有密钥、不发请求。
 */

/** 火山方舟 OpenAI 兼容 Base。 */
export const ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

/** Provider 目录 id（与 settings/service.ts providers 表一致）。 */
export const DOUBAO_PROVIDER_ID = "doubao";

/** Provider 展示名。 */
export const DOUBAO_PROVIDER_NAME = "豆包 / 火山方舟";

/** 一个默认模型目录条目。 */
export interface DoubaoDefaultModel {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  /** 是否为推理（thinking）模型。 */
  reasoning: boolean;
}

/**
 * 精选默认模型目录：在用户尚未触发 /models 探测时提供合理的可选项。
 * 真实可用模型以账户实际开通的推理接入点（ep-xxxx）或模型 ID 为准。
 */
export const DOUBAO_DEFAULT_MODELS: readonly DoubaoDefaultModel[] = Object.freeze([
  Object.freeze({ id: "doubao-seed-1-6-250615", name: "Doubao Seed 1.6", contextWindow: 256_000, maxOutputTokens: 32_768, reasoning: true }),
  Object.freeze({ id: "doubao-1.5-pro-256k-250115", name: "Doubao 1.5 Pro 256k", contextWindow: 256_000, maxOutputTokens: 128_000, reasoning: true }),
  Object.freeze({ id: "doubao-1.5-pro-32k-250115", name: "Doubao 1.5 Pro 32k", contextWindow: 32_768, maxOutputTokens: 16_384, reasoning: true }),
  Object.freeze({ id: "doubao-1.5-lite-32k-250115", name: "Doubao 1.5 Lite 32k", contextWindow: 32_768, maxOutputTokens: 16_384, reasoning: false }),
  Object.freeze({ id: "doubao-pro-128k-241215", name: "Doubao Pro 128k", contextWindow: 131_072, maxOutputTokens: 16_384, reasoning: false })
]);

/** Provider 服务：集中暴露豆包/火山方舟的公开事实。 */
export interface PiAiProviderService {
  readonly providerId: typeof DOUBAO_PROVIDER_ID;
  readonly displayName: string;
  readonly baseUrl: string;
  defaultModels(): readonly DoubaoDefaultModel[];
}

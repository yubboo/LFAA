/**
 * 移植参考：DeepSeek Harness dsh-llm-pi-ai（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：catalog.ts
 * 功能：豆包/火山方舟模型目录与能力（上下文窗口/输出上限/推理能力）映射。
 * 作用：在账户尚未触发 /models 探测时提供精选默认目录；探测成功后以探测结果为准。
 * 关联文件：ark.ts（端点常量）、models.ts（选择）、discovery.ts（探测）。
 */
import { ARK_BASE_URL, DOUBAO_DEFAULT_MODELS, type DoubaoDefaultModel } from "./ark.js";

/** 模型能力摘要（供 UI 与请求决策使用，不写死模型选择）。 */
export interface DoubaoModelCapability {
  modelId: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  /** 是否支持隐藏推理（thinking）。 */
  reasoning: boolean;
}

/** 把精选默认目录条目映射为能力摘要。 */
export function catalogModelCapability(model: DoubaoDefaultModel): DoubaoModelCapability {
  return Object.freeze({
    modelId: model.id,
    name: model.name,
    contextWindow: model.contextWindow,
    maxOutputTokens: model.maxOutputTokens,
    reasoning: model.reasoning
  });
}

/** 精选默认目录（能力摘要视图）。 */
export function defaultDoubaoCatalog(): readonly DoubaoModelCapability[] {
  return DOUBAO_DEFAULT_MODELS.map(catalogModelCapability);
}

/** 按模型 ID 查询能力；未命中返回 undefined（交由探测目录补充）。 */
export function lookupDoubaoCapability(modelId: string): DoubaoModelCapability | undefined {
  const hit = DOUBAO_DEFAULT_MODELS.find((model) => model.id === modelId);
  return hit === undefined ? undefined : catalogModelCapability(hit);
}

/** Provider 公开事实（供设置/默认模型选择读取）。 */
export const DOUBAO_CATALOG = Object.freeze({
  providerId: "doubao",
  baseUrl: ARK_BASE_URL,
  /** OpenAI 兼容：/models 列表端点。 */
  modelsUrl: `${ARK_BASE_URL}/models`,
  /** OpenAI 兼容：chat/completions 端点。 */
  chatUrl: `${ARK_BASE_URL}/chat/completions`
});

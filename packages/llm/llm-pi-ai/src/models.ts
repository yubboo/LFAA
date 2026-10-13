/**
 * 移植参考：DeepSeek Harness dsh-llm-pi-ai（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：models.ts
 * 功能：豆包模型选择与能力映射。
 * 作用：从精选目录/探测目录中挑选默认模型，映射思考档位；不写死强制选择，只给可选项。
 * 关联文件：catalog.ts（目录）、config.ts（思考档位）。
 */
import { defaultDoubaoCatalog, lookupDoubaoCapability, type DoubaoModelCapability } from "./catalog.js";

/** 默认推荐模型（日常通用，非强制；用户可改选其他已开通模型）。 */
export const DEFAULT_DOUBAO_MODEL_ID = "doubao-seed-1-6-250615";

/** 列出可选模型（精选目录）。 */
export function listDoubaoModels(): readonly DoubaoModelCapability[] {
  return defaultDoubaoCatalog();
}

/**
 * 选择默认模型：优先命中精选默认，否则退到目录首项。
 * @param available 账户实际可用的模型 ID 列表（探测结果）。
 */
export function pickDefaultModel(available: readonly string[]): DoubaoModelCapability | undefined {
  if (available.includes(DEFAULT_DOUBAO_MODEL_ID)) return lookupDoubaoCapability(DEFAULT_DOUBAO_MODEL_ID);
  const first = available[0];
  return first === undefined ? undefined : (lookupDoubaoCapability(first) ?? {
    modelId: first,
    name: first,
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    reasoning: false
  });
}

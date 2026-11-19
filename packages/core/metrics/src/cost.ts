// 按模型档案的人民币单价把 token 用量换算成成本，供会话状态栏与 Token 浮层展示。
import type { LlmUsage } from "@lfaa/llm";
import type { AgentRunCost } from "@lfaa/memory";

/** 每百万 token 的人民币单价；缓存读取价缺省时按输入价计算。 */
export interface TokenPricing {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion?: number;
}

/** 判断单价是否至少有一项大于 0，避免全零时显示 ¥0.000 噪音。 */
export function hasPricing(pricing: TokenPricing | undefined): boolean {
  if (!pricing) return false;
  return pricing.inputPricePerMillion > 0
    || pricing.outputPricePerMillion > 0
    || (pricing.cachedInputPricePerMillion ?? 0) > 0;
}

/** 计算单次运行成本；缺少 token 用量或有效单价时返回 undefined。 */
export function computeTokenCost(usage: LlmUsage, pricing: TokenPricing | undefined): AgentRunCost | undefined {
  if (!pricing || !hasPricing(pricing)) return undefined;
  const prompt = usage.promptTokens;
  const completion = usage.completionTokens;
  if (prompt === undefined && completion === undefined) return undefined;

  const cached = Math.min(usage.cachedPromptTokens ?? 0, prompt ?? 0);
  const uncached = Math.max(0, (prompt ?? 0) - cached);
  const cachedPrice = pricing.cachedInputPricePerMillion ?? pricing.inputPricePerMillion;
  const input = (uncached / 1_000_000) * pricing.inputPricePerMillion;
  const cachedInput = (cached / 1_000_000) * cachedPrice;
  const output = ((completion ?? 0) / 1_000_000) * pricing.outputPricePerMillion;

  return { amount: input + cachedInput + output, currency: "CNY", input, cachedInput, output };
}

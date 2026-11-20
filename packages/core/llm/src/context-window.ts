// @lfaa/llm 上下文窗口推断：模型名里的容量标记优先（如 32k / 128k / 1m），
// 其次按已知模型家族取公开值；无法确定时返回 undefined，由调用方显示"未配置"而不是编造数字。

/** 统计以实际响应模型为准；方舟规格仅适用于已知官方档案与型号。 */
export function resolveReportedContextWindow(
  profile: { model: string; providerId?: string; contextWindowTokens?: number },
  responseModel: string,
): { tokens: number; source: "configured" | "provider-spec" } | undefined {
  if (responseModel === profile.model && profile.contextWindowTokens && profile.contextWindowTokens > 0) {
    return { tokens: profile.contextWindowTokens, source: "configured" };
  }
  // 火山方舟 Agent/Coding Plan 官方模型规格。仅匹配这些已公布型号与版本后缀。
  if (/^volcengine(?:-agent-plan|-coding-plan)?$/u.test(profile.providerId ?? "")
    && /^deepseek-v(?:4[.-]1-flash(?:-economy)?|4-(?:flash|pro))(?:-(?:ga-)?\d{6})?$/iu.test(responseModel)) {
    return { tokens: 1_048_576, source: "provider-spec" };
  }
  return undefined;
}

/** 模型名里形如 32k / 128k / 1m 的容量标记。 */
const NAME_CAPACITY = /(?:^|[-_@/])(\d+(?:\.\d+)?)\s*([km])(?:$|[-_@/.])/iu;

/** 已知模型家族：按前缀匹配，值来自厂商公开文档（单位 token）。 */
const KNOWN_FAMILIES: ReadonlyArray<{ pattern: RegExp; tokens: number }> = [
  { pattern: /^claude-/iu, tokens: 200_000 },
  { pattern: /^gemini-/iu, tokens: 1_000_000 },
  { pattern: /^gpt-4\.1/iu, tokens: 1_000_000 },
  { pattern: /^gpt-4o/iu, tokens: 128_000 },
  { pattern: /^gpt-4-turbo/iu, tokens: 128_000 },
  { pattern: /^deepseek-(chat|reasoner)/iu, tokens: 64_000 },
  { pattern: /^deepseek-v3/iu, tokens: 128_000 },
  { pattern: /^qwen/iu, tokens: 128_000 },
  { pattern: /^glm-4/iu, tokens: 128_000 },
  { pattern: /^minimax/iu, tokens: 245_000 },
];

/**
 * 推断模型上下文窗口。
 * @param model 模型标识（如 `doubao-pro-32k`、`gemini-2.5-pro`）。
 * @returns 推断出的窗口 token 数；无法确定时返回 undefined。
 */
export function inferContextWindow(model: string | undefined): number | undefined {
  if (!model) return undefined;
  const match = NAME_CAPACITY.exec(model);
  if (match?.[1] && match[2]) {
    const value = Number.parseFloat(match[1]);
    if (Number.isFinite(value) && value > 0) {
      return Math.round(value * (match[2].toLowerCase() === "m" ? 1_000_000 : 1_000));
    }
  }
  const family = KNOWN_FAMILIES.find((entry) => entry.pattern.test(model));
  return family?.tokens;
}

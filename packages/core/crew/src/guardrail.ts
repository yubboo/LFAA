// 交接前的结构验收：从 expectedOutput 里解析 JSON 与必含字段要求，输出不合格时给出可回传的原因。
/** 由交付要求解析出的校验规则；v1 只做确定性检查，不调模型。 */
export interface CrewGuardrail {
  minChars: number;
  expectJson: boolean;
  required: string[];
}

/** 默认最小长度：只挡「好」「完成」这类空交付；需要更长时由 expectedOutput 显式声明。 */
const MIN_OUTPUT_CHARS = 12;

/**
 * 从 expectedOutput 里解析规则：
 * - 出现 JSON 关键字 → 要求输出可被解析；
 * - 出现「必须包含：A、B」→ 要求逐项出现。
 */
export function buildGuardrail(expectedOutput: string): CrewGuardrail {
  const requiredMatch = expectedOutput.match(/(?:必须包含|must include|must contain)\s*[:：]\s*([^\n。]+)/iu);
  const requiredText = requiredMatch?.[1] ?? "";
  const required = requiredText
    .split(/[、,，;；]/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const expectJson = /\bjson\b/iu.test(expectedOutput);
  // 「不少于 N 字 / 至少 N 字」显式覆盖默认下限，避免清单类交付被长度误杀。
  const lengthMatch = expectedOutput.match(/(?:不少于|至少|at least)\s*(\d+)\s*(?:字|字符|chars?)/iu);
  const minChars = lengthMatch
    ? Math.min(2000, Math.max(4, Number(lengthMatch[1])))
    : expectJson ? 2 : MIN_OUTPUT_CHARS;
  return { minChars, expectJson, required };
}

/** 检查一次交付；通过返回 ok，失败返回拼接后的原因（直接进重试提示）。 */
export function checkDelivery(output: string, guardrail: CrewGuardrail): { ok: boolean; reason?: string } {
  const text = output.trim();
  const reasons: string[] = [];
  if (text.length < guardrail.minChars) {
    reasons.push(`交付内容过短（${text.length} 字符，至少 ${guardrail.minChars}）`);
  }
  if (guardrail.expectJson) {
    const parsed = tryParseJson(text);
    if (!parsed.ok) reasons.push("交付要求 JSON，但输出不是合法 JSON");
  }
  const missing = guardrail.required.filter((item) => !text.includes(item));
  if (missing.length > 0) reasons.push(`缺少必含内容：${missing.join("、")}`);
  return reasons.length === 0 ? { ok: true } : { ok: false, reason: reasons.join("；") };
}

/** 从可能带说明文字的输出里截取首个 JSON 块并解析。 */
function tryParseJson(text: string): { ok: boolean } {
  const start = text.search(/[[{]/u);
  if (start < 0) return { ok: false };
  const candidate = text.slice(start);
  const end = Math.max(candidate.lastIndexOf("]"), candidate.lastIndexOf("}"));
  if (end <= 0) return { ok: false };
  try {
    JSON.parse(candidate.slice(0, end + 1));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
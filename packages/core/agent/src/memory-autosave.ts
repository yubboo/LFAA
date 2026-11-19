// 从用户明确陈述中提取值得跨会话记住的偏好或约定，作为长期记忆的确定性沉淀来源。

/** 明确表达“要记住 / 以后统一 / 不要再 / 偏好 / 约定”的句式；普通任务描述不会命中。 */
const EXPLICIT_MEMORY_INTENT =
  /(?:记住|以后(?:都|一律|统一|默认|固定)?(?:用|使用)|今后|之后都|不要再|别再用|不要再用|偏好|约定|规定)/u;

/** 仅去掉客套前缀，保留用户可独立复述的完整一句。 */
function cleanSentence(sentence: string): string {
  return sentence
    .replace(/^(?:请|麻烦)?(?:你)?(?:帮我)?(?:记住|记一下)[：:，,\s]*/u, "")
    .replace(/^[“"'‘]+|[”"'’]+$/gu, "")
    .replace(/\s+/gu, " ")
    .slice(0, 200)
    .trim();
}

/**
 * 提取需要长期保存的偏好/约定；无法确定时返回 undefined，避免把普通请求误存成记忆。
 * 只处理单句，命中明确标记才返回，内容截断到 200 字符。
 */
export function extractExplicitMemory(userMessage: string): string | undefined {
  const sentences = userMessage
    .split(/[。！？!?\n]/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    if (!EXPLICIT_MEMORY_INTENT.test(sentence)) continue;
    const candidate = cleanSentence(sentence);
    if (candidate.length >= 6) return candidate;
  }
  return undefined;
}

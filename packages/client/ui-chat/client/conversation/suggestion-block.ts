// 解析模型最终答复末尾的追问建议隐藏块：正文照常展示，建议交给按钮卡片渲染。
// 块格式：<!--suggestions:["第一人称短句","...","..."]-->；流式未闭合时先隐藏半个标记，避免闪出原始文本。
export interface SuggestionSplit {
  /** 去掉隐藏块后的正文。 */
  content: string;
  /** 解析出的建议短句，最多 3 条。 */
  suggestions: string[];
}

const OPEN = "<!--suggestions:";
const CLOSE = "-->";
const MAX_ITEMS = 3;
const MAX_LENGTH = 120;

function parseSuggestions(body: string): string[] {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    // 模型偶尔给换行列表而不是 JSON：按行兜底即可，不因此丢掉建议。
  }
  const list: unknown[] = Array.isArray(parsed)
    ? parsed
    : body.split(/\r?\n/u).map((line) => line.replace(/^[\s\-*"'`]+|["'`,]+$/gu, ""));
  return list
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= MAX_LENGTH)
    .slice(0, MAX_ITEMS);
}

/** 流式截断在标记中间时，末尾可能是 OPEN 的前缀：先藏起来，避免用户看到「<!--sugg」。 */
function trailingOpenPrefixLength(raw: string): number {
  for (let length = Math.min(OPEN.length - 1, raw.length); length >= 5; length -= 1) {
    if (OPEN.startsWith(raw.slice(-length))) return length;
  }
  return 0;
}

/** 拆分正文与建议；没有完整块时只返回正文（流式末尾的半截标记会被隐藏）。 */
export function splitSuggestionBlock(raw: string): SuggestionSplit {
  const start = raw.indexOf(OPEN);
  if (start < 0) {
    const hidden = trailingOpenPrefixLength(raw);
    return {
      content: hidden > 0 ? raw.slice(0, raw.length - hidden).trimEnd() : raw,
      suggestions: [],
    };
  }
  const content = raw.slice(0, start).trimEnd();
  const end = raw.indexOf(CLOSE, start + OPEN.length);
  if (end < 0) return { content, suggestions: [] };
  return { content, suggestions: parseSuggestions(raw.slice(start + OPEN.length, end).trim()) };
}

/** 去重时的归一化：忽略大小写、空白和常见标点，避免「帮我补测试」与「帮我补测试。」重复出现。 */
function normalizeSuggestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s，。！？、；：,.!?;:'"`（）()【】\[\]「」<>《》]/gu, "");
}

/** 过滤历史追问里已经出现过的建议，并顺手去掉本轮内部的重复项。 */
export function dedupeSuggestions(current: readonly string[], history: readonly string[]): string[] {
  const seen = new Set((history ?? []).map(normalizeSuggestion).filter(Boolean));
  const result: string[] = [];
  for (const item of current) {
    const key = normalizeSuggestion(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
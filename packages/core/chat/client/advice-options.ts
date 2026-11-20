// 从助手最终回答的「建议/下一步」段落提取可选后续项，供界面编号展示、用户点选发送。
import { isAdviceHeading, parseMarkdownBlocks } from "./markdown-parser";

const MAX_OPTIONS = 5;
const MIN_LEN = 4;
const MAX_LEN = 180;

/** 去掉行内 Markdown 标记与列表前缀，得到可直接发送的建议文本。 */
function cleanInline(text: string): string {
  return text
    .replace(/`([^`]*)`/gu, "$1")
    .replace(/\*\*([^*]*)\*\*/gu, "$1")
    .replace(/__([^_]*)__/gu, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/^\s*(?:[-*+]|\d+[.)、])\s+/u, "")
    .trim();
}

/** 提取建议段落的列表项；没有建议标题或不足 2 条时返回空数组（不做无意义选项）。 */
export function extractAdviceOptions(content: string, max = MAX_OPTIONS): string[] {
  const options: string[] = [];
  let inAdviceSection = false;
  for (const block of parseMarkdownBlocks(content)) {
    if (block.type === "heading") {
      inAdviceSection = isAdviceHeading(block.text);
      continue;
    }
    if (!inAdviceSection) {
      // 加粗短句引出的建议段落（如「下一步去哪些页面」）同样采纳。
      if (block.type === "paragraph" && block.text.trim().length <= 80 && isAdviceHeading(block.text)) {
        inAdviceSection = true;
      }
      continue;
    }
    if (block.type === "list") {
      for (const item of block.items) {
        const text = cleanInline(item);
        if (text.length >= MIN_LEN && text.length <= MAX_LEN && !options.includes(text)) options.push(text);
        if (options.length >= max) return options;
      }
    } else if (block.type === "paragraph" && options.length === 0) {
      // 建议标题后可能先有一段说明，继续等待列表项。
      continue;
    } else if (block.type !== "paragraph") {
      inAdviceSection = false;
    }
  }
  return options.length >= 2 ? options.slice(0, max) : [];
}

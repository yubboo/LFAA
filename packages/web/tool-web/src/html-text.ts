/**
 * 文件：html-text.ts
 * 功能：手写 HTML→纯文本提取，不引入 cheerio/turndown（pnpm store 无这些依赖）。
 * 作用：删除 script/style/noscript/注释与标签后，保留页面可见文本并折叠空白；
 *      把网页正文转成模型可读的纯文本，避免原始活动标记进入模型上下文。
 * 不负责：Markdown 表格渲染、DOM 语义化排版（本环境无 DOM 实现）。
 * 关联文件：fetch.ts。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-tool-web。
 */

/** 子树都应移除的内容元素；若输入截断导致缺少闭合标签，剩余前缀也一并丢弃。 */
const RAW_DROP_ELEMENTS = new Set(["script", "style", "noscript", "template", "iframe", "object"]);
/** void 元素没有子树，只需移除元素标签本身。 */
const VOID_DROP_ELEMENTS = new Set(["embed"]);

/** 块级元素：转换时在前后补换行。 */
const BLOCK_ELEMENTS = new Set([
  "html", "body", "head", "div", "p", "br", "article", "section", "main", "header", "footer",
  "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "table", "tr", "blockquote", "pre", "hr", "form", "fieldset",
]);

/** 常见命名字符实体解码。 */
function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/&#x27;/giu, "'")
    .replace(/&#(\d+);/gu, (_match, code: string) => String.fromCodePoint(Number(code)));
}

/**
 * 把 HTML 字符串提取为纯文本。
 * @param html 已解码的 HTML 正文。
 * @param maxChars 同步处理的源字符上限，超出只保留前缀。
 */
export function htmlToText(html: string, maxChars: number): { text: string; sourceTruncated: boolean } {
  const source = html.slice(0, maxChars);
  const sourceTruncated = source.length !== html.length;
  let working = source;

  // 删除 HTML 注释。
  working = working.replace(/<!--[\s\S]*?-->/gu, "");
  // 整段删除内容元素；截断后缺少闭合标签时，安全丢弃到输入末尾。
  working = working.replace(new RegExp(`<(${[...RAW_DROP_ELEMENTS].join("|")})\\b[^>]*>[\\s\\S]*?(?:<\\/\\1\\s*>|$)`, "giu"), "");
  // void 元素没有内容区，不能让其缺少闭合标签时吞掉后续正文。
  working = working.replace(new RegExp(`<(${[...VOID_DROP_ELEMENTS].join("|")})\\b[^>]*>`, "giu"), "");

  // 块级标签先替换为换行，避免相邻文本被粘在一起。
  working = working.replace(new RegExp(`</?(${[...BLOCK_ELEMENTS].join("|")})\\b[^>]*>`, "giu"), "\n");
  // 删除其余所有标签。
  working = working.replace(/<[^>]*>/gu, "");
  working = decodeEntities(working);

  // 折叠每行空白与连续空行。
  const lines = working
    .split("\n")
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter((line, index, all) => line.length > 0 || (index > 0 && all[index - 1]?.length !== 0));
  const text = lines.join("\n").trim();
  return { text: text.length > 0 ? text : "[网页正文为空或无法提取文本]", sourceTruncated };
}

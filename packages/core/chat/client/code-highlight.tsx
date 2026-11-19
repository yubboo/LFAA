// 为右工作台 VS Code 代码查看器提供多语言词法高亮、嵌套标签/括号彩虹配对着色、语言徽标及面包屑路径解析。
import type { ReactNode } from "react";

const CODE_EXT_RE = /\.(?:[cm]?[jt]sx?|java|kt|py|go|rs|json|css|scss|html?|xml|ya?ml|md|sh|bash|bat|cmd|sql|toml|ini|properties)$/iu;

const KEYWORDS = new Set([
  "import", "export", "from", "package", "public", "private", "protected", "final", "static", "void",
  "const", "let", "var", "return", "function", "if", "else", "for", "while", "do", "switch", "case", "default",
  "break", "continue", "try", "catch", "finally", "async", "await", "class", "interface", "type", "enum",
  "extends", "implements", "new", "throw", "yield", "typeof", "instanceof", "in", "of", "as",
  "def", "fn", "struct", "impl", "use", "SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE",
]);

const LITERALS = new Set(["true", "false", "null", "undefined", "this", "super", "NaN", "Infinity"]);

const VOID_HTML_TAGS = new Set([
  "!doctype", "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr",
]);

const RAINBOW_COUNT = 5;

export function isHighlightableCodeFile(filePath: string): boolean {
  return CODE_EXT_RE.test(filePath);
}

export function getFileBadgeLabel(filePath: string): { label: string; kind: "ts" | "js" | "css" | "java" | "json" | "md" | "other" } {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".tsx") || lower.endsWith(".ts") || lower.endsWith(".mts")) return { label: "TS", kind: "ts" };
  if (lower.endsWith(".jsx") || lower.endsWith(".js") || lower.endsWith(".mjs")) return { label: "JS", kind: "js" };
  if (lower.endsWith(".css") || lower.endsWith(".scss")) return { label: "{}", kind: "css" };
  if (lower.endsWith(".java") || lower.endsWith(".kt")) return { label: "J", kind: "java" };
  if (lower.endsWith(".json") || lower.endsWith(".yaml") || lower.endsWith(".yml")) return { label: "{}", kind: "json" };
  if (lower.endsWith(".md")) return { label: "M", kind: "md" };
  return { label: "·", kind: "other" };
}

interface TagFrame {
  name: string;
  colorIdx: number;
}

interface BracketFrame {
  openChar: string;
  colorIdx: number;
}

const MATCHING_CLOSE: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
const MATCHING_OPEN: Record<string, string> = { ")": "(", "}": "{", "]": "[" };

/** 对整份代码行数组进行跨行状态扫描：保留注释/字符串状态，并为成对标签与括号分配彩虹深度色。 */
export function highlightDocumentLines(lines: string[]): ReactNode[][] {
  const tagStack: TagFrame[] = [];
  const bracketStack: BracketFrame[] = [];
  let inBlockComment = false;
  let inHtmlComment = false;
  let nextTagColor = 0;

  return lines.map((line, lineIdx) => {
    if (!line) return ["\u00A0"];
    const nodes: ReactNode[] = [];
    let i = 0;
    let keyCounter = 0;
    const pushPlain = (txt: string) => {
      if (!txt) return;
      const last = nodes[nodes.length - 1];
      if (typeof last === "string") nodes[nodes.length - 1] = last + txt;
      else nodes.push(txt);
    };
    const pushSpan = (attrs: Record<string, string | number>, txt: string) => {
      keyCounter += 1;
      nodes.push(<span key={`${lineIdx}-${keyCounter}`} {...attrs}>{txt}</span>);
    };

    while (i < line.length) {
      if (inBlockComment) {
        const end = line.indexOf("*/", i);
        if (end < 0) {
          pushSpan({ "data-token": "comment" }, line.slice(i));
          i = line.length;
        } else {
          pushSpan({ "data-token": "comment" }, line.slice(i, end + 2));
          i = end + 2;
          inBlockComment = false;
        }
        continue;
      }

      if (inHtmlComment) {
        const end = line.indexOf("-->", i);
        if (end < 0) {
          pushSpan({ "data-token": "comment" }, line.slice(i));
          i = line.length;
        } else {
          pushSpan({ "data-token": "comment" }, line.slice(i, end + 3));
          i = end + 3;
          inHtmlComment = false;
        }
        continue;
      }

      const ch = line[i]!;

      if (line.startsWith("<!--", i)) {
        const end = line.indexOf("-->", i + 4);
        if (end < 0) {
          pushSpan({ "data-token": "comment" }, line.slice(i));
          inHtmlComment = true;
          i = line.length;
        } else {
          pushSpan({ "data-token": "comment" }, line.slice(i, end + 3));
          i = end + 3;
        }
        continue;
      }

      if (line.startsWith("//", i)) {
        pushSpan({ "data-token": "comment" }, line.slice(i));
        i = line.length;
        continue;
      }

      if (line.startsWith("/*", i)) {
        const end = line.indexOf("*/", i + 2);
        if (end < 0) {
          pushSpan({ "data-token": "comment" }, line.slice(i));
          inBlockComment = true;
          i = line.length;
        } else {
          pushSpan({ "data-token": "comment" }, line.slice(i, end + 2));
          i = end + 2;
        }
        continue;
      }

      if (ch === '"' || ch === "'" || ch === "`") {
        let j = i + 1;
        while (j < line.length) {
          if (line[j] === "\\") { j += 2; continue; }
          if (line[j] === ch) { j += 1; break; }
          j += 1;
        }
        pushSpan({ "data-token": "string" }, line.slice(i, j));
        i = j;
        continue;
      }

      // 闭合标签 </tag>
      const closeTagMatch = /^<\/([A-Za-z][A-Za-z0-9.:_-]*)\s*>/u.exec(line.slice(i));
      if (closeTagMatch) {
        const tagName = closeTagMatch[1]!;
        let matchedColor = tagStack.length % RAINBOW_COUNT;
        for (let s = tagStack.length - 1; s >= 0; s -= 1) {
          if (tagStack[s]!.name.toLowerCase() === tagName.toLowerCase()) {
            matchedColor = tagStack[s]!.colorIdx;
            tagStack.length = s;
            break;
          }
        }
        pushSpan({ "data-rainbow": String(matchedColor) }, "</");
        pushSpan({ "data-tag-rainbow": String(matchedColor) }, tagName);
        pushSpan({ "data-rainbow": String(matchedColor) }, ">");
        i += closeTagMatch[0].length;
        continue;
      }

      // 开始标签 <tagName 或 <!DOCTYPE
      const openTagMatch = /^<(![A-Za-z]+|[A-Za-z][A-Za-z0-9.:_-]*)(?=[\s/>]|$)/u.exec(line.slice(i));
      if (openTagMatch) {
        const tagName = openTagMatch[1]!;
        const lower = tagName.toLowerCase();
        const restAfterName = line.slice(i + openTagMatch[0].length);
        const selfClosePos = restAfterName.search(/\/?>/u);
        const isSelfClosing = VOID_HTML_TAGS.has(lower)
          || (selfClosePos >= 0 && restAfterName.slice(selfClosePos, selfClosePos + 2) === "/>");
        const colorIdx = nextTagColor % RAINBOW_COUNT;
        nextTagColor += 1;
        if (!isSelfClosing && !VOID_HTML_TAGS.has(lower)) {
          tagStack.push({ name: tagName, colorIdx });
        }
        pushSpan({ "data-rainbow": String(colorIdx) }, "<");
        pushSpan({ "data-tag-rainbow": String(colorIdx) }, tagName);
        i += openTagMatch[0].length;
        continue;
      }

      if (MATCHING_CLOSE[ch]) {
        const colorIdx = bracketStack.length % RAINBOW_COUNT;
        bracketStack.push({ openChar: ch, colorIdx });
        pushSpan({ "data-rainbow": String(colorIdx) }, ch);
        i += 1;
        continue;
      }

      if (MATCHING_OPEN[ch]) {
        let colorIdx = Math.max(0, bracketStack.length - 1) % RAINBOW_COUNT;
        for (let s = bracketStack.length - 1; s >= 0; s -= 1) {
          if (bracketStack[s]!.openChar === MATCHING_OPEN[ch]) {
            colorIdx = bracketStack[s]!.colorIdx;
            bracketStack.length = s;
            break;
          }
        }
        pushSpan({ "data-rainbow": String(colorIdx) }, ch);
        i += 1;
        continue;
      }

      if (ch === "#" && /^[0-9a-fA-F]{3,8}\b/u.test(line.slice(i + 1))) {
        const hexMatch = /^#[0-9a-fA-F]{3,8}\b/u.exec(line.slice(i))!;
        pushSpan({ "data-token": "literal" }, hexMatch[0]);
        i += hexMatch[0].length;
        continue;
      }

      if (ch === "#" && (i === 0 || /\s/u.test(line[i - 1]!))) {
        pushSpan({ "data-token": "comment" }, line.slice(i));
        i = line.length;
        continue;
      }

      if (/[0-9]/u.test(ch) && (i === 0 || !/[A-Za-z0-9_$]/u.test(line[i - 1]!))) {
        const numMatch = /^\d+(?:\.\d+)?(?:px|rem|em|vh|vw|ms|s|%)?/u.exec(line.slice(i))!;
        pushSpan({ "data-token": "literal" }, numMatch[0]);
        i += numMatch[0].length;
        continue;
      }

      if (/[A-Za-z_$]/u.test(ch)) {
        const idMatch = /^[A-Za-z_$][A-Za-z0-9_$-]*/u.exec(line.slice(i))!;
        const word = idMatch[0];
        const nextChar = line[i + word.length] ?? "";
        if (KEYWORDS.has(word)) {
          pushSpan({ "data-token": "keyword" }, word);
        } else if (LITERALS.has(word)) {
          pushSpan({ "data-token": "literal" }, word);
        } else if (nextChar === "(") {
          pushSpan({ "data-token": "fn" }, word);
        } else if (nextChar === "=" || nextChar === ":") {
          pushSpan({ "data-token": "attr" }, word);
        } else if (/^[A-Z]/u.test(word)) {
          pushSpan({ "data-token": "type" }, word);
        } else {
          pushPlain(word);
        }
        i += word.length;
        continue;
      }

      pushPlain(ch);
      i += 1;
    }

    return nodes.length > 0 ? nodes : ["\u00A0"];
  });
}

/** 兼容单行词法渲染入口。 */
export function renderHighlightedCodeLine(text: string): ReactNode[] {
  return highlightDocumentLines([text])[0] ?? ["\u00A0"];
}

// 轻量流式安全 Markdown 块级解析与代码语法分词器，用于渲染助手消息中的标题、列表、表格、引用与高亮代码块。

export type TableAlign = "left" | "center" | "right";

/** 建议类标题：命中后整段用强调色突出，便于一眼看到 Agent 给出的下一步建议。 */
const ADVICE_HEADING_ZH = /建议|下一步|推荐|执行顺序|行动项|后续步骤|可改进|待办|方案/iu;
const ADVICE_HEADING_EN = /suggest|next step|recommend|plan|todo|action item|improve/iu;

/** 判断标题是否属于「建议/下一步」类，供渲染层加强调样式。 */
export function isAdviceHeading(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  return ADVICE_HEADING_ZH.test(value) || ADVICE_HEADING_EN.test(value);
}

/** 描述解析出的 Markdown 文档块，由对应视图渲染。 */
export type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; language: string; code: string }
  | { type: "table"; headers: string[]; alignments: TableAlign[]; rows: string[][] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "blockquote"; lines: string[] }
  | { type: "hr" }
  | { type: "paragraph"; text: string };

/** 区分代码词元的着色类别，交给渲染层应用样式。 */
export type CodeTokenKind =
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "type"
  | "function"
  | "plain";

/** 保存代码片段与其着色类别。 */
export interface CodeToken {
  kind: CodeTokenKind;
  text: string;
}

const FENCE_RE = /^```([\w.+-]*)\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const HR_RE = /^(?:---+|\*\*\*+|___+)\s*$/;
const UL_ITEM_RE = /^\s*[-*+]\s+(.+)$/;
const OL_ITEM_RE = /^\s*\d+[.)]\s+(.+)$/;
const TABLE_SEP_CELL_RE = /^:?-{2,}:?$/;

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function parseTableAlignments(line: string): TableAlign[] | null {
  if (!line.includes("|") && !line.includes("-")) return null;
  const cells = splitTableRow(line);
  if (cells.length === 0 || !cells.every((cell) => TABLE_SEP_CELL_RE.test(cell))) {
    return null;
  }
  return cells.map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  });
}

function isBlockBoundary(line: string, nextLine: string | undefined): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (FENCE_RE.test(trimmed) || HEADING_RE.test(trimmed) || HR_RE.test(trimmed)) return true;
  if (trimmed.startsWith(">")) return true;
  if (UL_ITEM_RE.test(line) || OL_ITEM_RE.test(line)) return true;
  if (line.includes("|") && nextLine && parseTableAlignments(nextLine)) return true;
  return false;
}

/** 将 Markdown 文本解析为块级 AST（支持流式未闭合代码块与表格） */
export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const fenceMatch = FENCE_RE.exec(trimmed);
    if (fenceMatch) {
      const language = fenceMatch[1] ?? "";
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test((lines[i] ?? "").trim())) {
        codeLines.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: "code", language, code: codeLines.join("\n") });
      continue;
    }

    if (HR_RE.test(trimmed)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    const headingMatch = HEADING_RE.exec(trimmed);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1]?.length ?? 1,
        text: headingMatch[2] ?? "",
      });
      i += 1;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length) {
      const alignments = parseTableAlignments(lines[i + 1] ?? "");
      if (alignments) {
        const headers = splitTableRow(line);
        const rows: string[][] = [];
        i += 2;
        while (i < lines.length && (lines[i] ?? "").includes("|") && (lines[i] ?? "").trim()) {
          rows.push(splitTableRow(lines[i] ?? ""));
          i += 1;
        }
        blocks.push({ type: "table", headers, alignments, rows });
        continue;
      }
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith(">")) {
        quoteLines.push((lines[i] ?? "").trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    const ulMatch = UL_ITEM_RE.exec(line);
    if (ulMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemMatch = UL_ITEM_RE.exec(lines[i] ?? "");
        if (!itemMatch) break;
        items.push(itemMatch[1] ?? "");
        i += 1;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    const olMatch = OL_ITEM_RE.exec(line);
    if (olMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemMatch = OL_ITEM_RE.exec(lines[i] ?? "");
        if (!itemMatch) break;
        items.push(itemMatch[1] ?? "");
        i += 1;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i] ?? "";
      if (paraLines.length > 0 && isBlockBoundary(cur, lines[i + 1])) break;
      paraLines.push(cur.trim());
      i += 1;
    }
    blocks.push({ type: "paragraph", text: paraLines.join("\n") });
  }

  return blocks;
}

const CODE_KEYWORDS = new Set([
  "const", "let", "var", "function", "async", "await", "return", "import", "from", "export",
  "default", "type", "interface", "class", "extends", "implements", "new", "if", "else",
  "for", "while", "switch", "case", "break", "continue", "try", "catch", "finally", "throw",
  "true", "false", "null", "undefined", "void", "typeof", "keyof", "in", "of", "as",
  "def", "elif", "None", "True", "False", "lambda", "with", "yield", "pass", "raise",
  "pub", "fn", "struct", "enum", "impl", "trait", "mut", "match", "use", "mod",
  "SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "JOIN", "GROUP", "ORDER", "BY",
]);

const CODE_TOKEN_RE =
  /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b(?=\s*\()|\b[A-Z][A-Za-z0-9_]*\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/gm;

/** 对单行代码执行轻量词法着色分词 */
export function tokenizeCodeLine(line: string): CodeToken[] {
  if (!line) return [{ kind: "plain", text: "" }];
  const tokens: CodeToken[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(CODE_TOKEN_RE)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      tokens.push({ kind: "plain", text: line.slice(lastIndex, idx) });
    }
    const word = match[0];
    let kind: CodeTokenKind = "plain";
    if (word.startsWith("//") || word.startsWith("#") || word.startsWith("/*")) {
      kind = "comment";
    } else if (word.startsWith("\"") || word.startsWith("'") || word.startsWith("`")) {
      kind = "string";
    } else if (/^\d/.test(word)) {
      kind = "number";
    } else if (CODE_KEYWORDS.has(word)) {
      kind = "keyword";
    } else if (/^[A-Z]/.test(word)) {
      kind = "type";
    } else if (line[idx + word.length] === "(") {
      kind = "function";
    }
    tokens.push({ kind, text: word });
    lastIndex = idx + word.length;
  }

  if (lastIndex < line.length) {
    tokens.push({ kind: "plain", text: line.slice(lastIndex) });
  }
  return tokens;
}

/** 对多行代码块执行带跨行块注释状态的分词，确保 JSDoc 等多行注释整段着色 */
export function tokenizeCodeLines(lines: string[]): CodeToken[][] {
  let inBlockComment = false;
  return lines.map((line) => {
    if (inBlockComment) {
      const endIdx = line.indexOf("*/");
      if (endIdx === -1) {
        return [{ kind: "comment", text: line }];
      }
      inBlockComment = false;
      const commentPart = line.slice(0, endIdx + 2);
      const restPart = line.slice(endIdx + 2);
      return [
        { kind: "comment", text: commentPart },
        ...(restPart ? tokenizeCodeLine(restPart) : []),
      ];
    }

    const startIdx = line.indexOf("/*");
    if (startIdx !== -1 && !line.slice(0, startIdx).includes("//")) {
      const endIdx = line.indexOf("*/", startIdx + 2);
      if (endIdx === -1) {
        inBlockComment = true;
        const before = line.slice(0, startIdx);
        const commentPart = line.slice(startIdx);
        return [
          ...(before ? tokenizeCodeLine(before) : []),
          { kind: "comment", text: commentPart },
        ];
      }
    }

    return tokenizeCodeLine(line);
  });
}

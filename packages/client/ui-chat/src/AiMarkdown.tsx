/**
 * 功能：渲染 AI 回复中的常用 Markdown 内容。
 * 作用：把标题、段落、列表、表格和代码块转换为可读的 React 内容，不解释模型返回的 HTML。
 * 关联文件：packages/client/ui-chat/src/AiWorkChat.tsx、packages/client/ui-chat/src/ai-work-chat.css。
 */
import { memo, type ReactNode } from "react";

interface AiMarkdownProps {
  content: string;
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const tokenPattern = /(\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)]+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  return text.split(tokenPattern).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    const link = /^\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)$/.exec(part);
    if (link) return <a key={key} href={link[2]} target="_blank" rel="noreferrer noopener">{link[1]}</a>;
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("~~") && part.endsWith("~~")) return <del key={key}>{part.slice(2, -2)}</del>;
    if (part.startsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) return <em key={key}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? "";
  return /^\s*(```|#{1,6}\s|>\s?|[-*+]\s|\d+[.)]\s)/.test(line) || Boolean(lines[index + 1] && isTableSeparator(lines[index + 1]));
}

export const AiMarkdown = memo(function AiMarkdown({ content }: AiMarkdownProps) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = /^\s*```([^`]*)$/.exec(line);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index] ?? "")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(<pre className="_block_lfaa_wallpaper_code" key={`block-${blocks.length}`}><code data-language={fence[1].trim() || undefined}>{codeLines.join("\n")}</code></pre>);
      continue;
    }

    const heading = /^\s*(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = Math.min(heading[1].length, 4);
      const Heading = `h${level}` as "h1" | "h2" | "h3" | "h4";
      blocks.push(<Heading key={`block-${blocks.length}`}>{renderInlineMarkdown(heading[2], `heading-${blocks.length}`)}</Heading>);
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && isTableSeparator(lines[index + 1] ?? "")) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? "").includes("|")) {
        rows.push(tableCells(lines[index] ?? ""));
        index += 1;
      }
      blocks.push(<div className="ai-work-chat__table-wrap _tableScroll_lfaa_wallpaper" key={`block-${blocks.length}`}><table><thead><tr>{headers.map((cell, cellIndex) => <th key={`head-${cellIndex}`}>{renderInlineMarkdown(cell, `table-head-${blocks.length}-${cellIndex}`)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={`row-${rowIndex}`}>{headers.map((_, cellIndex) => <td key={`cell-${cellIndex}`}>{renderInlineMarkdown(row[cellIndex] ?? "", `table-${blocks.length}-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }

    const listItem = /^\s*([-*+]|\d+[.)])\s+(.+)$/.exec(line);
    if (listItem) {
      const ordered = /^\d/.test(listItem[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = /^\s*([-*+]|\d+[.)])\s+(.+)$/.exec(lines[index] ?? "");
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        items.push(item[2]);
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={`block-${blocks.length}`}>{items.map((item, itemIndex) => <li key={`item-${itemIndex}`}>{renderInlineMarkdown(item, `list-${blocks.length}-${itemIndex}`)}</li>)}</List>);
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index] ?? "")) {
        quote.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push(<blockquote key={`block-${blocks.length}`}>{quote.map((part, quoteIndex) => <p key={`quote-${quoteIndex}`}>{renderInlineMarkdown(part, `quote-${blocks.length}-${quoteIndex}`)}</p>)}</blockquote>);
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && (lines[index] ?? "").trim() && !isBlockStart(lines, index)) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push(<p key={`block-${blocks.length}`}>{paragraph.map((part, partIndex) => <span key={`line-${partIndex}`}>{partIndex ? <br /> : null}{renderInlineMarkdown(part, `paragraph-${blocks.length}-${partIndex}`)}</span>)}</p>);
  }

  return <div className="ai-work-chat__markdown _markdown_lfaa_wallpaper">{blocks}</div>;
});

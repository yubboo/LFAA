// 助手消息富文本 Markdown 渲染组件：提供克制优雅的文档排版、表格、代码块语法高亮与块级流式缓存。
import { Fragment, memo, useMemo, useState, type ReactNode } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { normalizeLegacyMediaOutput, parseMarkdownBlocks, tokenizeCodeLines, type MarkdownBlock } from "./markdown-parser";
import { LocalMediaImage } from "@lfaa/client-ui-tool-media/client";
import styles from "./MarkdownContent.module.css";

const INLINE_RE =
  /(!\[[^\]\n]*\]\([^)\s]+\)|`[^`\n]+`|\*\*[^*\n]+?\*\*|__[^_\n]+?__|~~[^~\n]+?~~|\*[^*\n]+?\*|\[([^\]\n]+)\]\(([^)\s]+)\))/g;

const FILE_EXT_RE =
  /(?<![A-Za-z0-9_./:-])([A-Za-z0-9_\u4e00-\u9fa5-]+\.(?:json|ya?ml|toml|txt|md|sqlite|db|ts|tsx|js|jsx|mjs|cjs|css|html|svg|png|jpg|webp|sh|ps1|py|rs|go|env|lock|log))\b/gi;

const ASCII_ENUM_RE =
  /\b([a-z0-9][a-z0-9_.-]*(?:[、,，]\s*[a-z0-9][a-z0-9_.-]*){2,})\b/gi;

function isSafeLink(href: string): boolean {
  return /^(https?:\/\/|mailto:|\/)/i.test(href);
}

/** 将普通文本中的显式文件名（含扩展名）或连续英文目录/文件枚举渲染为清晰的行内胶囊。 */
function renderPlainTextWithFiles(text: string, keyPrefix: string): ReactNode[] {
  const tokens: Array<{ start: number; end: number; value: string; kind: "file" | "enum" }> = [];
  for (const m of text.matchAll(FILE_EXT_RE)) {
    const start = m.index ?? 0;
    tokens.push({ start, end: start + m[0].length, value: m[0], kind: "file" });
  }
  for (const m of text.matchAll(ASCII_ENUM_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (!tokens.some((t) => !(end <= t.start || start >= t.end))) {
      tokens.push({ start, end, value: m[0], kind: "enum" });
    }
  }
  if (tokens.length === 0) return [text];
  tokens.sort((a, b) => a.start - b.start);

  const out: ReactNode[] = [];
  let cursor = 0;
  tokens.forEach((tok, idx) => {
    if (tok.start > cursor) out.push(text.slice(cursor, tok.start));
    if (tok.kind === "file") {
      out.push(<code key={`${keyPrefix}-f-${idx}`} className={styles.fileChip}>{tok.value}</code>);
    } else {
      const parts = tok.value.split(/([、,，]\s*)/);
      parts.forEach((part, pIdx) => {
        if (/^[、,，]\s*$/.test(part)) {
          out.push(part);
        } else if (part) {
          out.push(<code key={`${keyPrefix}-e-${idx}-${pIdx}`} className={styles.fileChip}>{part}</code>);
        }
      });
    }
    cursor = tok.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let partIdx = 0;

  for (const match of text.matchAll(INLINE_RE)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      nodes.push(...renderPlainTextWithFiles(text.slice(lastIndex, idx), `${keyPrefix}-p-${partIdx++}`));
    }
    const token = match[0];
    const key = `${keyPrefix}-${partIdx++}`;

    if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={key} className={styles.inlineCode}>{token.slice(1, -1)}</code>);
    } else if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
      nodes.push(<strong key={key} className={styles.bold}>{renderInline(token.slice(2, -2), key)}</strong>);
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      nodes.push(<del key={key}>{renderInline(token.slice(2, -2), key)}</del>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1), key)}</em>);
    } else if (token.startsWith("![")) {
      // 图片：本机媒体经 /api/media 预览，外链图片直接渲染。
      const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/u.exec(token);
      if (image) nodes.push(<LocalMediaImage key={key} src={image[2] ?? ""} alt={image[1] ?? ""} />);
    } else if (token.startsWith("[")) {
      const label = match[2] ?? token;
      const href = match[3] ?? "";
      if (isSafeLink(href)) {
        nodes.push(
          <a key={key} className={styles.link} href={href} target="_blank" rel="noopener noreferrer">
            {label}
          </a>,
        );
      } else {
        nodes.push(label);
      }
    }
    lastIndex = idx + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(...renderPlainTextWithFiles(text.slice(lastIndex), `${keyPrefix}-tail-${partIdx}`));
  }
  return nodes;
}

function renderParagraphLines(text: string, keyPrefix: string): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, idx) => (
    <Fragment key={`${keyPrefix}-l-${idx}`}>
      {idx > 0 && <br />}
      {renderInline(line, `${keyPrefix}-l-${idx}`)}
    </Fragment>
  ));
}

const CodeBlockCard = memo(function CodeBlockCard({
  language,
  code,
  isZh,
}: {
  language: string;
  code: string;
  isZh: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const tokenizedLines = useMemo(() => tokenizeCodeLines(code.split("\n")), [code]);

  const handleCopy = () => {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className={styles.codeCard}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>{language || "text"}</span>
        <button type="button" className={styles.copyBtn} onClick={handleCopy}>
          {copied ? <IconCheck size={13} stroke={2} /> : <IconCopy size={13} stroke={1.8} />}
          <span>{copied ? (isZh ? "已复制" : "Copied") : (isZh ? "复制代码" : "Copy")}</span>
        </button>
      </div>
      <pre className={styles.codePre}>
        <code>
          {tokenizedLines.map((lineTokens, lineIdx) => (
            <div key={lineIdx} className={styles.codeLine}>
              {lineTokens.map((tok, tokIdx) => (
                <span key={tokIdx} className={tok.kind === "plain" ? undefined : styles[`tok_${tok.kind}`]}>
                  {tok.text}
                </span>
              ))}
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
});

/** 比较两个解析块内容是否完全等价：流式输出时跳过前面已闭合块的重渲染与正则重扫。 */
function areBlocksEqual(a: MarkdownBlock, b: MarkdownBlock): boolean {
  if (a === b) return true;
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "hr":
      return true;
    case "heading":
      return b.type === "heading" && a.level === b.level && a.text === b.text;
    case "code":
      return b.type === "code" && a.language === b.language && a.code === b.code;
    case "paragraph":
      return b.type === "paragraph" && a.text === b.text;
    case "blockquote":
      return b.type === "blockquote"
        && a.lines.length === b.lines.length
        && a.lines.every((line, i) => line === b.lines[i]);
    case "list":
      return b.type === "list"
        && a.ordered === b.ordered
        && a.items.length === b.items.length
        && a.items.every((item, i) => item === b.items[i]);
    case "table":
      return b.type === "table"
        && a.headers.length === b.headers.length
        && a.rows.length === b.rows.length
        && a.headers.every((h, i) => h === b.headers[i])
        && a.alignments.every((al, i) => al === b.alignments[i])
        && a.rows.every((row, r) => row.length === b.rows[r]?.length && row.every((c, i) => c === b.rows[r]?.[i]));
  }
}

const MarkdownBlockView = memo(function MarkdownBlockView({
  block,
  blockKey,
  isZh,
}: {
  block: MarkdownBlock;
  blockKey: string;
  isZh: boolean;
}) {
  switch (block.type) {
    case "heading": {
      const level = Math.min(4, Math.max(1, block.level));
      return (
        <div role="heading" aria-level={block.level} className={styles[`h${level}`]}>
          {renderInline(block.text, blockKey)}
        </div>
      );
    }
    case "code":
      return <CodeBlockCard language={block.language} code={block.code} isZh={isZh} />;
    case "table":
      return (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {block.headers.map((header, colIdx) => (
                  <th key={colIdx} style={{ textAlign: block.alignments[colIdx] ?? "left" }}>
                    {renderInline(header, `${blockKey}-th-${colIdx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {block.headers.map((_, colIdx) => (
                    <td key={colIdx} style={{ textAlign: block.alignments[colIdx] ?? "left" }}>
                      {renderInline(row[colIdx] ?? "", `${blockKey}-r-${rowIdx}-c-${colIdx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "list":
      return block.ordered ? (
        <ol className={styles.ol}>
          {block.items.map((item, itemIdx) => (
            <li key={itemIdx}>{renderInline(item, `${blockKey}-li-${itemIdx}`)}</li>
          ))}
        </ol>
      ) : (
        <ul className={styles.ul}>
          {block.items.map((item, itemIdx) => (
            <li key={itemIdx}>{renderInline(item, `${blockKey}-li-${itemIdx}`)}</li>
          ))}
        </ul>
      );
    case "blockquote":
      return (
        <blockquote className={styles.blockquote}>
          {block.lines.map((line, lIdx) => (
            <p key={lIdx}>{renderInline(line, `${blockKey}-q-${lIdx}`)}</p>
          ))}
        </blockquote>
      );
    case "hr":
      return <hr className={styles.hr} />;
    case "paragraph":
      return (
        <p className={styles.p}>
          {renderParagraphLines(block.text, blockKey)}
        </p>
      );
  }
}, (prev, next) => prev.isZh === next.isZh && prev.blockKey === next.blockKey && areBlocksEqual(prev.block, next.block));

/** 把助手消息解析成安全的 React 文档块；正文列表保持标准阅读排版，不做卡片劫持。 */
export const MarkdownContent = memo(function MarkdownContent({
  content,
  isZh = true,
}: {
  content: string;
  isZh?: boolean;
  /** 保留可选属性签名以兼容旧调用点；正文列表统一还原标准阅读排版。 */
  onSelectAdvice?: ((text: string) => void) | undefined;
}) {
  // 先兼容旧版媒体输出（列表里的绝对路径），再解析块级结构，历史消息也按新排版显示。
  const blocks = useMemo(() => parseMarkdownBlocks(normalizeLegacyMediaOutput(content)), [content]);

  return (
    <div className={styles.root}>
      {blocks.map((block, idx) => (
        <MarkdownBlockView key={`b-${idx}`} block={block} blockKey={`b-${idx}`} isZh={isZh} />
      ))}
    </div>
  );
});

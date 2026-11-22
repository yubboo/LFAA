// 助手消息富文本 Markdown 渲染组件：消除原始 ** / - 等标记符，提供精美排版、表格、代码块语法高亮与一键复制。
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { isAdviceHeading, isAdviceLeadIn, normalizeLegacyMediaOutput, parseMarkdownBlocks, tokenizeCodeLines } from "./markdown-parser";
import { LocalMediaImage } from "@lfaa/tool-media/client";
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

/** 去掉行内 Markdown 标记，得到可直接发送的纯文本建议。 */
function plainText(text: string): string {
  return text
    .replace(/`([^`]*)`/gu, "$1")
    .replace(/\*\*([^*]*)\*\*/gu, "$1")
    .replace(/__([^_]*)__/gu, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .trim();
}

/** 将普通文本中的显式文件名（含扩展名）或连续英文目录/文件枚举渲染为清晰的行内胶囊 */
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

function CodeBlockCard({
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
}

/** 把助手消息解析成安全的 React 文档块，代码和表格由各自的渲染分支处理。 */
export function MarkdownContent({
  content,
  isZh = true,
  onSelectAdvice,
}: {
  content: string;
  isZh?: boolean;
  /** 点击「建议/下一步」列表项时回调，用于把该条建议直接作为下一条消息发送。 */
  onSelectAdvice?: ((text: string) => void) | undefined;
}) {
  // 先兼容旧版媒体输出（列表里的绝对路径），再解析块级结构，历史消息也按新排版显示。
  const blocks = useMemo(() => parseMarkdownBlocks(normalizeLegacyMediaOutput(content)), [content]);
  // 标记每个块是否属于「建议/下一步」段落：属于则列表项渲染为编号可点选项。
  const adviceFlags = useMemo(() => {
    let active = false;
    return blocks.map((block) => {
      if (block.type === "heading") {
        active = isAdviceHeading(block.text);
        return false;
      }
      // 有的回答用加粗短句引出建议（如「下一步去哪些页面」），同样视为建议段落起点。
      if (block.type === "paragraph" && isAdviceLeadIn(block.text)) {
        active = true;
        return false;
      }
      return active;
    });
  }, [blocks]);

  return (
    <div className={styles.root}>
      {blocks.map((block, idx) => {
        const key = `b-${idx}`;
        switch (block.type) {
          case "heading": {
            const level = Math.min(4, Math.max(1, block.level));
            const base = styles[`h${level}`];
            // 建议/下一步类标题用强调色突出，Agent 的结论推荐一眼可见。
            const cls = isAdviceHeading(block.text) ? `${base} ${styles.adviceHeading}` : base;
            return (
              <div key={key} role="heading" aria-level={block.level} className={cls} data-advice={isAdviceHeading(block.text) ? "true" : undefined}>
                {renderInline(block.text, key)}
              </div>
            );
          }
          case "code":
            return <CodeBlockCard key={key} language={block.language} code={block.code} isZh={isZh} />;
          case "table":
            return (
              <div key={key} className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {block.headers.map((header, colIdx) => (
                        <th key={colIdx} style={{ textAlign: block.alignments[colIdx] ?? "left" }}>
                          {renderInline(header, `${key}-th-${colIdx}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {block.headers.map((_, colIdx) => (
                          <td key={colIdx} style={{ textAlign: block.alignments[colIdx] ?? "left" }}>
                            {renderInline(row[colIdx] ?? "", `${key}-r-${rowIdx}-c-${colIdx}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "list": {
            // 建议段落的列表项：编号 + 可点击，直接作为下一条消息发送（用户自行选择）。
            if (adviceFlags[idx] && onSelectAdvice) {
              return (
                <div key={key} className={styles.adviceOptions} role="list">
                  {block.items.map((item, itemIdx) => (
                    <button
                      key={itemIdx}
                      type="button"
                      role="listitem"
                      className={styles.adviceOptionBtn}
                      onClick={() => onSelectAdvice(plainText(item))}
                    >
                      <span className={styles.adviceOptionIndex}>{itemIdx + 1}</span>
                      <span className={styles.adviceOptionText}>{renderInline(item, `${key}-li-${itemIdx}`)}</span>
                      {itemIdx === 0 && (
                        <span className={styles.adviceOptionRecommended}>{isZh ? "推荐" : "Recommended"}</span>
                      )}
                      <span className={styles.adviceOptionArrow} aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
              );
            }
            return block.ordered ? (
              <ol key={key} className={styles.ol}>
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx}>{renderInline(item, `${key}-li-${itemIdx}`)}</li>
                ))}
              </ol>
            ) : (
              <ul key={key} className={styles.ul}>
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx}>{renderInline(item, `${key}-li-${itemIdx}`)}</li>
                ))}
              </ul>
            );
          }
          case "blockquote":
            return (
              <blockquote key={key} className={styles.blockquote}>
                {block.lines.map((line, lIdx) => (
                  <p key={lIdx}>{renderInline(line, `${key}-q-${lIdx}`)}</p>
                ))}
              </blockquote>
            );
          case "hr":
            return <hr key={key} className={styles.hr} />;
          case "paragraph":
            return (
              <p key={key} className={styles.p}>
                {renderParagraphLines(block.text, key)}
              </p>
            );
        }
      })}
    </div>
  );
}

// 群聊富文本消息卡片：支持轻量 Markdown（标题、行内代码、可复制代码块）、可折叠工具步骤与流式状态。
// 关联：packages/client/ui-agent-group/client/view/Group-View.tsx；运行环境：浏览器。
import { useState, type ReactNode } from "react";
import { IconCheck, IconChevronDown, IconChevronRight, IconCopy } from "@tabler/icons-react";
import type { GroupMessageItem } from "../group/group-api";
import styles from "./Group-Message-Card.module.css";

interface ContentBlock {
  kind: "code" | "text";
  lang?: string;
  value: string;
}

/** 将消息文本按围栏代码块拆分为文本块与代码块。 */
function splitMarkdownBlocks(raw: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const fence = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/gu;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(raw)) !== null) {
    if (match.index > last) {
      blocks.push({ kind: "text", value: raw.slice(last, match.index) });
    }
    blocks.push({ kind: "code", lang: match[1] || "code", value: match[2] ?? "" });
    last = match.index + match[0].length;
  }
  if (last < raw.length) {
    blocks.push({ kind: "text", value: raw.slice(last) });
  }
  return blocks;
}

function renderInlineCode(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`)/gu);
  return parts.map((part, idx) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 2
      ? <code key={idx} className={styles.inlineCode}>{part.slice(1, -1)}</code>
      : part,
  );
}

function CodeBlockView({ lang, code, isZh }: { lang: string; code: string; isZh: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // 忽略剪贴板权限受限
    }
  };
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHead}>
        <span>{lang}</span>
        <button type="button" className={styles.copyBtn} onClick={() => void handleCopy()}>
          {copied ? <IconCheck size={12} aria-hidden="true" /> : <IconCopy size={12} aria-hidden="true" />}
          <span>{copied ? (isZh ? "已复制" : "Copied") : (isZh ? "复制" : "Copy")}</span>
        </button>
      </div>
      <pre className={styles.codePre}><code>{code}</code></pre>
    </div>
  );
}

export function GroupMessageCard({
  message,
  authorName,
  isCli,
  isZh,
}: {
  message: GroupMessageItem;
  authorName: string;
  isCli: boolean;
  isZh: boolean;
}) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const isUser = message.role === "user";
  const blocks = splitMarkdownBlocks(message.content || "");
  const steps = message.steps ?? [];

  return (
    <article className={`${styles.card} ${isUser ? styles.cardUser : styles.cardAssistant}`}>
      <div className={styles.meta}>
        <span className={styles.author}>{isUser ? (isZh ? "你" : "You") : authorName}</span>
        {!isUser && isCli && <span className={`${styles.badge} ${styles.badgeCli}`}>CLI</span>}
        {!isUser && message.model && <span className={styles.badge}>{message.model}</span>}
        {message.speakerTask && <span className={styles.badge}>{message.speakerTask}</span>}
        {message.status === "streaming" && <span className={styles.streamingDot} aria-label="streaming" />}
        {message.status === "aborted" && <span className={styles.badge}>{isZh ? "已停止" : "Stopped"}</span>}
        {message.status === "error" && <span className={styles.badge}>{isZh ? "异常" : "Error"}</span>}
      </div>

      {steps.length > 0 && (
        <>
          <button type="button" className={styles.stepsToggle} onClick={() => setStepsOpen((v) => !v)}>
            {stepsOpen ? <IconChevronDown size={13} aria-hidden="true" /> : <IconChevronRight size={13} aria-hidden="true" />}
            <span>{isZh ? `执行步骤（${steps.length}）` : `Steps (${steps.length})`}</span>
          </button>
          {stepsOpen && (
            <div className={styles.stepsList}>
              {steps.map((step, i) => (
                <div key={step.id ?? i}>
                  <strong>{step.title ?? (isZh ? "步骤" : "Step")}</strong>
                  {step.detail ? ` — ${step.detail}` : ""}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className={styles.body}>
        {blocks.length === 0 ? (
          <p className={styles.paragraph}>{message.status === "streaming" ? (isZh ? "正在思考…" : "Thinking…") : ""}</p>
        ) : (
          blocks.map((block, index) => {
            if (block.kind === "code") {
              return <CodeBlockView key={index} lang={block.lang ?? "code"} code={block.value} isZh={isZh} />;
            }
            const lines = block.value.trim().split(/\n{2,}/u).filter(Boolean);
            return lines.map((para, pIdx) => {
              const heading = /^#{1,3}\s+(.+)$/u.exec(para.trim());
              if (heading?.[1]) {
                return <h4 key={`${index}-${pIdx}`} className={styles.heading}>{renderInlineCode(heading[1])}</h4>;
              }
              return <p key={`${index}-${pIdx}`} className={styles.paragraph}>{renderInlineCode(para)}</p>;
            });
          })
        )}
      </div>
    </article>
  );
}

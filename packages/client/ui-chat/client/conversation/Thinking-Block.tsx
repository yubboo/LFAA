// 思维链与同轮执行折叠块：以脑形图标、实时状态与左侧细竖线引导呈现本轮思考正文及关联工具链，
// 思考正文超过预设高度后自动启用统一细滚动条并在流式思考时智能跟随底部，默认展开且点击标题一次收起或展开整轮过程。
import { memo, useState, type ReactNode } from "react";
import { ScrollArea } from "@lfaa/ui-primitives/client";
import {
  IconBrain,
  IconChevronRight,
  IconFileSearch,
  IconPencil,
  IconRobot,
  IconTerminal2,
  IconTool,
  IconWorld,
} from "@tabler/icons-react";
import type { RoundHeaderIconKind } from "./round-title";
import { useBoundedScroll } from "./useBoundedScroll";
import styles from "./Thinking-Block.module.css";

function renderRoundIcon(kind: RoundHeaderIconKind) {
  switch (kind) {
    case "command": return <IconTerminal2 size={15} stroke={1.7} />;
    case "file": return <IconPencil size={15} stroke={1.7} />;
    case "read": return <IconFileSearch size={15} stroke={1.7} />;
    case "subagent": return <IconRobot size={15} stroke={1.7} />;
    case "browser": return <IconWorld size={15} stroke={1.7} />;
    case "tool": return <IconTool size={15} stroke={1.7} />;
    default: return <IconBrain size={15} stroke={1.7} />;
  }
}

const INLINE_CODE_RE = /(`[^`\n]+`)/g;

/** 轻量渲染思考正文中的行内代码片段，避免思考流高频更新时做重型全量 Markdown 解析。 */
function renderThinkingLine(line: string, lineIdx: number): ReactNode[] {
  const parts = line.split(INLINE_CODE_RE);
  return parts.map((part, idx) => {
    if (part.length >= 2 && part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={`${lineIdx}-${idx}`} className={styles.inlineCode}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/** 单轮思维链块：思考正文在限高内可滚动并自动跟随流式输出，与本轮工具链作为一个整体默认展开，点击标题可一次性收起或展开。 */
export const ThinkingBlock = memo(function ThinkingBlock({
  label,
  iconKind = "brain",
  durationText,
  reasoningText,
  toolCount = 0,
  live,
  isZh,
  children,
}: {
  /** 标题文案（动态跟随本轮最新操作或思考意图，不再固定写死「已思考」）。 */
  label: string;
  /** 左侧图标语义类型，默认脑形图标，有工具操作时动态切换。 */
  iconKind?: RoundHeaderIconKind | undefined;
  /** 可选耗时文案（如「3 秒」）。 */
  durationText?: string | undefined;
  /** 本轮思考正文，支持流式逐段追加。 */
  reasoningText?: string | undefined;
  /** 本轮包含的工具调用数：收起后在标题行提示，便于感知折叠内容。 */
  toolCount?: number | undefined;
  /** 本轮是否仍在实时运行中：用于开启微光呼吸动效与流式贴底跟随。 */
  live: boolean;
  isZh: boolean;
  /** 本轮关联的过程说明与工具链，随本轮思考块同步收起/展开。 */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  // 去掉部分推理模型偶发输出的 "(Thinking)" 前缀，保持思考正文清爽自然。
  const trimmed = (reasoningText?.trim() ?? "").replace(/^(?:\(Thinking\)|\[Thinking\])\s*/iu, "");
  const hasBody = trimmed.length > 0;
  const hasChildren = Boolean(children);
  const canToggle = hasBody || hasChildren;
  const paragraphs = hasBody ? trimmed.split(/\r?\n/u) : [];
  const collapsedToolSummary = !open && toolCount > 0
    ? (isZh ? `${toolCount} 步工具` : `${toolCount} ${toolCount === 1 ? "tool" : "tools"}`)
    : undefined;
  const { viewportRef, contentRef, edges, handleWheel, handleScroll, resumeFollowing } = useBoundedScroll(
    open,
    hasBody,
    trimmed,
    live,
  );

  const headerContent = (
    <>
      <span className={styles.iconWrap} data-live={live ? "true" : undefined} aria-hidden="true">
        {renderRoundIcon(iconKind)}
      </span>
      <span className={styles.title} data-live={live ? "true" : undefined}>
        {label}
      </span>
      {durationText && <span className={styles.duration}>{durationText}</span>}
      {collapsedToolSummary && <span className={styles.duration}>· {collapsedToolSummary}</span>}
      {canToggle && (
        <IconChevronRight
          size={13}
          stroke={1.9}
          className={styles.chevron}
          data-open={open ? "true" : undefined}
          aria-hidden="true"
        />
      )}
    </>
  );

  return (
    <div className={styles.root} data-live={live ? "true" : undefined}>
      {canToggle ? (
        <button
          type="button"
          className={styles.headerBtn}
          aria-expanded={open}
          aria-label={
            open
              ? (isZh ? `收起${label}` : `Collapse ${label}`)
              : (isZh ? `展开${label}` : `Expand ${label}`)
          }
          onClick={() => {
            setOpen((prev) => {
              const next = !prev;
              if (next && live) resumeFollowing();
              return next;
            });
          }}
        >
          {headerContent}
        </button>
      ) : (
        <div className={styles.headerStatic}>{headerContent}</div>
      )}

      {open && (hasBody || hasChildren) && (
        <div className={styles.roundContent}>
          {hasBody && (
            <div className={styles.body}>
              <ScrollArea
                ref={viewportRef}
                className={styles.scrollViewport}
                role={edges.scrollable ? "region" : undefined}
                aria-label={edges.scrollable ? (isZh ? `${label}正文` : `${label} content`) : undefined}
                tabIndex={edges.scrollable ? 0 : undefined}
                data-scrollable={edges.scrollable ? "true" : undefined}
                data-fade-top={edges.fadeTop ? "true" : undefined}
                data-fade-bottom={edges.fadeBottom ? "true" : undefined}
                onWheel={handleWheel}
                onScroll={handleScroll}
              >
                <div ref={contentRef} className={styles.content}>
                  {paragraphs.map((line, idx) =>
                    line.trim() ? (
                      <p key={idx} className={styles.line}>
                        {renderThinkingLine(line, idx)}
                      </p>
                    ) : (
                      <div key={idx} className={styles.spacer} aria-hidden="true" />
                    ),
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
});

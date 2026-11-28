// 启动页地址栏联想下拉：展示最近访问站点（带图标与标题）与搜索词，支持高亮匹配与逐条删除。
import { Fragment, useState } from "react";
import { IconSearch, IconWorld, IconX } from "@tabler/icons-react";
import { extractFaviconOrigin, type StartHistoryEntry } from "./start-omnibox-history";
import styles from "./Start-Omnibox.module.css";

/** 按大小写不敏感切分字符串并加粗命中片段。 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const index = lowerText.indexOf(lowerNeedle);
  if (index < 0) return <>{text}</>;
  return (
    <Fragment>
      {text.slice(0, index)}
      <strong className={styles.match}>{text.slice(index, index + needle.length)}</strong>
      {text.slice(index + needle.length)}
    </Fragment>
  );
}

/** 站点图标：优先尝试 /favicon.ico，失败自动回退为地球图标，不露出破图。 */
function SiteFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const origin = extractFaviconOrigin(url);
  if (!origin || failed) {
    return <IconWorld size={16} stroke={1.6} className={styles.fallbackIcon} aria-hidden="true" />;
  }
  return (
    <img
      src={`${origin}/favicon.ico`}
      alt=""
      width={16}
      height={16}
      className={styles.favicon}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function StartOmnibox({
  entries,
  query,
  activeIndex,
  isZh,
  onHoverIndex,
  onSelect,
  onDelete,
}: {
  entries: StartHistoryEntry[];
  query: string;
  activeIndex: number;
  isZh: boolean;
  onHoverIndex: (index: number) => void;
  onSelect: (entry: StartHistoryEntry) => void;
  onDelete: (entry: StartHistoryEntry) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div
      className={styles.dropdown}
      role="listbox"
      aria-label={isZh ? "最近访问与搜索记录" : "Recent visits and searches"}
    >
      {entries.map((entry, index) => {
        const active = index === activeIndex;
        return (
          <div
            key={entry.key}
            className={`${styles.row} ${active ? styles.rowActive : ""}`}
            role="option"
            aria-selected={active}
            onMouseEnter={() => onHoverIndex(index)}
            onMouseDown={(event) => {
              // 阻止输入框失焦收起下拉，确保点击条目直接触发跳转。
              event.preventDefault();
            }}
            onClick={() => onSelect(entry)}
          >
            <span className={styles.iconSlot}>
              {entry.kind === "url"
                ? <SiteFavicon url={entry.value} />
                : <IconSearch size={15} stroke={1.7} className={styles.fallbackIcon} aria-hidden="true" />}
            </span>
            <span className={styles.label}>
              {entry.kind === "url" && entry.title ? (
                <>
                  <span className={styles.title}><HighlightedText text={entry.title} query={query} /></span>
                  <span className={styles.dash} aria-hidden="true"> — </span>
                  <span className={styles.url}><HighlightedText text={entry.displayUrl} query={query} /></span>
                </>
              ) : entry.kind === "url" ? (
                <span className={styles.url}><HighlightedText text={entry.displayUrl} query={query} /></span>
              ) : (
                <span className={styles.title}><HighlightedText text={entry.value} query={query} /></span>
              )}
            </span>
            <button
              type="button"
              className={styles.deleteBtn}
              aria-label={isZh ? `删除记录：${entry.title || entry.displayUrl}` : `Remove ${entry.title || entry.displayUrl}`}
              title={isZh ? "从记录中移除" : "Remove from history"}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(entry);
              }}
            >
              <IconX size={14} stroke={1.8} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

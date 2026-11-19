// 代码查看器内嵌文本搜索栏：支持大小写切换、匹配统计、上一处/下一处跳转定位与快捷键关闭。
import { useEffect, useRef } from "react";
import { IconArrowDown, IconArrowUp, IconX } from "@tabler/icons-react";
import styles from "./FileChangePreview.module.css";

export function CodeSearchBar({
  isZh,
  query,
  caseSensitive,
  matchCount,
  activeIndex,
  onChangeQuery,
  onToggleCase,
  onPrev,
  onNext,
  onClose,
}: {
  isZh: boolean;
  query: string;
  caseSensitive: boolean;
  matchCount: number;
  activeIndex: number;
  onChangeQuery: (value: string) => void;
  onToggleCase: () => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className={styles.searchBar} role="search" aria-label={isZh ? "代码内搜索" : "Find in file"}>
      <input
        ref={inputRef}
        className={styles.searchInput}
        value={query}
        placeholder={isZh ? "搜索当前文件内容…" : "Find in file..."}
        onChange={(e) => onChangeQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "Enter" && e.shiftKey) onPrev();
          else if (e.key === "Enter") onNext();
        }}
      />
      <button
        type="button"
        className={`${styles.searchBtn} ${caseSensitive ? styles.modeBtnActive : ""}`}
        title={isZh ? "区分大小写" : "Match case"}
        aria-pressed={caseSensitive}
        onClick={onToggleCase}
      >
        Aa
      </button>
      <span className={styles.searchCount}>
        {query ? (matchCount > 0 ? `${activeIndex + 1}/${matchCount}` : (isZh ? "无结果" : "No results")) : ""}
      </span>
      <button type="button" className={styles.searchBtn} disabled={matchCount === 0} title={isZh ? "上一处" : "Previous"} onClick={onPrev}>
        <IconArrowUp size={13} />
      </button>
      <button type="button" className={styles.searchBtn} disabled={matchCount === 0} title={isZh ? "下一处" : "Next"} onClick={onNext}>
        <IconArrowDown size={13} />
      </button>
      <button type="button" className={styles.searchBtn} title={isZh ? "关闭搜索" : "Close"} onClick={onClose}>
        <IconX size={13} />
      </button>
    </div>
  );
}

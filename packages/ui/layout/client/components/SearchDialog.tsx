// 提供本地导航和项目搜索，不宣称可搜索尚不存在的聊天记录。
import { useEffect, useRef, useState } from "react";
import type { LocaleMessages } from "../locales";
import type { NavigationTarget } from "../navigation";
import { NavigationIcon } from "./NavigationIcon";
import styles from "./SearchDialog.module.css";

/** 在本地导航和项目列表中筛选目标，选中后由工作台打开对应位置。 */
export function SearchDialog({
  locale,
  targets,
  onClose,
  onChoose,
}: {
  locale: LocaleMessages;
  targets: NavigationTarget[];
  onClose: () => void;
  onChoose: (target: NavigationTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalized = query.trim().toLocaleLowerCase();
  const results = targets.filter((target) =>
    !normalized || `${target.label} ${target.description}`.toLocaleLowerCase().includes(normalized),
  );

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className={styles.backdrop} onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lfaa-search-title"
        onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}
      >
        <label className={styles.searchBox}>
          <NavigationIcon name="search" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            aria-label={locale.search}
            placeholder={locale.searchPlaceholder}
            onChange={(event) => { setQuery(event.currentTarget.value); setActiveIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && results.length) {
                event.preventDefault();
                setActiveIndex((index) => (index + 1) % results.length);
              } else if (event.key === "ArrowUp" && results.length) {
                event.preventDefault();
                setActiveIndex((index) => (index - 1 + results.length) % results.length);
              } else if (event.key === "Enter" && results[activeIndex]) {
                event.preventDefault();
                onChoose(results[activeIndex]);
              }
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <h2 id="lfaa-search-title" className={styles.heading}>{query ? locale.searchResults : locale.searchDestinations}</h2>
        <div className={styles.results}>
          {results.length ? results.map((target, index) => (
            <button key={target.id} className={`${styles.result} ${index === activeIndex ? styles.resultActive : ""}`} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => onChoose(target)}>
              <span className={styles.resultText}><strong>{target.label}</strong><small>{target.description}</small></span>
              <NavigationIcon name="chevronRight" />
            </button>
          )) : (
            <p className={styles.empty}>{query ? locale.noSearchResults : locale.noSearchTargets}</p>
          )}
        </div>
        <p className={styles.footer}>{locale.searchLocalOnly}</p>
      </section>
    </div>
  );
}

// 搜索弹层：同时搜索会话标题/消息正文、侧栏功能与本地项目，支持键盘选择与命中片段高亮。
import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkbenchChatProvider, WorkbenchChatSearchResult } from "../../contract/index";
import type { LocaleMessages } from "../locales";
import type { NavigationTarget } from "../navigation";
import { NavigationIcon } from "./NavigationIcon";
import styles from "./SearchDialog.module.css";

type SearchEntry =
  | { kind: "chat"; result: WorkbenchChatSearchResult }
  | { kind: "nav"; target: NavigationTarget };

/** 把命中词包进 <mark>，便于在搜索结果里一眼看到匹配位置。 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}

/** 在会话全文搜索与本地导航目标之间切换，选中后由工作台打开对应位置。 */
export function SearchDialog({
  locale,
  targets,
  chatProvider,
  onClose,
  onChoose,
}: {
  locale: LocaleMessages;
  targets: NavigationTarget[];
  chatProvider?: WorkbenchChatProvider<unknown> | null | undefined;
  onClose: () => void;
  onChoose: (target: NavigationTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [chatResults, setChatResults] = useState<WorkbenchChatSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalized = query.trim();
  const navResults = targets.filter((target) =>
    !normalized || `${target.label} ${target.description}`.toLocaleLowerCase().includes(normalized.toLocaleLowerCase()),
  );

  useEffect(() => { inputRef.current?.focus(); }, []);

  // 会话/消息搜索由聊天插件提供；输入停顿 200ms 再请求，旧请求结果直接丢弃。
  useEffect(() => {
    const searchChat = chatProvider?.searchChat;
    if (!normalized || !searchChat) {
      setChatResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchChat(normalized)
        .then((results) => { if (!cancelled) setChatResults(results); })
        .catch(() => { if (!cancelled) setChatResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [normalized, chatProvider]);

  const entries = useMemo<SearchEntry[]>(() => [
    ...chatResults.map((result): SearchEntry => ({ kind: "chat", result })),
    ...navResults.map((target): SearchEntry => ({ kind: "nav", target })),
  ], [chatResults, navResults]);
  const safeIndex = entries.length === 0 ? 0 : Math.min(activeIndex, entries.length - 1);

  const choose = (entry: SearchEntry | undefined) => {
    if (!entry) return;
    onClose();
    if (entry.kind === "chat") {
      const { sessionId, messageId } = entry.result;
      if (chatProvider?.openSessionMessage) {
        void chatProvider.openSessionMessage(sessionId, messageId);
      } else {
        void chatProvider?.openSession(sessionId);
      }
      return;
    }
    onChoose(entry.target);
  };

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
              if (event.key === "ArrowDown" && entries.length) {
                event.preventDefault();
                setActiveIndex((index) => (index + 1) % entries.length);
              } else if (event.key === "ArrowUp" && entries.length) {
                event.preventDefault();
                setActiveIndex((index) => (index - 1 + entries.length) % entries.length);
              } else if (event.key === "Enter") {
                event.preventDefault();
                choose(entries[safeIndex]);
              }
            }}
          />
          <kbd>Esc</kbd>
        </label>

        <div className={styles.results}>
          {normalized && chatProvider?.searchChat && (
            <section className={styles.group} aria-label={locale.searchChatGroup}>
              <h2 className={styles.heading}>{locale.searchChatGroup}</h2>
              {searching && <p className={styles.hint}>{locale.searchingChats}</p>}
              {!searching && chatResults.length === 0 && (
                <p className={styles.hint}>{locale.noChatSearchResults}</p>
              )}
              {chatResults.map((result) => {
                const index = entries.findIndex((entry) => entry.kind === "chat" && entry.result === result);
                return (
                  <button
                    key={`${result.sessionId}:${result.messageId ?? "title"}`}
                    className={`${styles.result} ${index === safeIndex ? styles.resultActive : ""}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(entries[index])}
                  >
                    <span className={styles.resultText}>
                      <strong>
                        <HighlightedText text={result.sessionTitle} query={normalized} />
                        {result.archived ? <span className={styles.badge}>{locale.searchArchived}</span> : null}
                      </strong>
                      <small>
                        <HighlightedText text={result.snippet} query={normalized} />
                      </small>
                      <small className={styles.meta}>
                        {result.match === "title"
                          ? locale.searchMatchTitle
                          : `${result.role === "user" ? locale.searchMatchUser : locale.searchMatchAssistant} · ${locale.searchMatchMessage}`}
                      </small>
                    </span>
                    <NavigationIcon name="chevronRight" />
                  </button>
                );
              })}
            </section>
          )}

          <section className={styles.group} aria-label={locale.searchTargetsGroup}>
            <h2 className={styles.heading}>{locale.searchTargetsGroup}</h2>
            {navResults.length ? navResults.map((target) => {
              const index = entries.findIndex((entry) => entry.kind === "nav" && entry.target === target);
              return (
                <button
                  key={target.id}
                  className={`${styles.result} ${index === safeIndex ? styles.resultActive : ""}`}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(entries[index])}
                >
                  <span className={styles.resultText}><strong>{target.label}</strong><small>{target.description}</small></span>
                  <NavigationIcon name="chevronRight" />
                </button>
              );
            }) : (
              <p className={styles.empty}>{normalized ? locale.noSearchResults : locale.noSearchTargets}</p>
            )}
          </section>
        </div>
        <p className={styles.footer}>{locale.searchLocalOnly}</p>
      </section>
    </div>
  );
}
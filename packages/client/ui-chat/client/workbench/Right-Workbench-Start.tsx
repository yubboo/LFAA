// 右工作台启动页，复用项目文件、浏览器、历史地址联想和辅助面板入口，适用于空白浏览器标签。
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { IconFileDiff, IconMessageCircle, IconSearch, IconTerminal2 } from "@tabler/icons-react";
import { deleteBrowserHistoryItem, fetchBrowserHistory, type BrowserHistoryItem } from "@lfaa/client-ui-browser/client";
import type { ChatClientStore } from "../store/chat-store";
import { rightWorkbenchStartLabels } from "../locales";
import { StartOmnibox } from "./Start-Omnibox";
import {
  filterStartHistory,
  findInlineCompletion,
  isExplicitStartUrl,
  mergeStartHistory,
  readLocalStartHistory,
  recordLocalStartHistory,
  removeLocalStartHistory,
  type StartHistoryEntry,
} from "./start-omnibox-history";
import styles from "./Right-Workbench-Start.module.css";

export function RightWorkbenchStart({
  isZh, store, projectId, worktreeId, projectName, onOpenUrl, onOpenTerminal, onOpenReview, onOpenSideAsk, extraShortcuts, children,
}: {
  isZh: boolean;
  store: ChatClientStore;
  projectId: string | null;
  /** 绑定工作树时按工作树目录读取输入的文件路径。 */
  worktreeId?: string | undefined;
  projectName: string | null;
  onOpenUrl: (url: string) => Promise<void>;
  onOpenTerminal: () => void;
  onOpenReview: () => void;
  onOpenSideAsk: () => void;
  extraShortcuts?: ReactNode;
  children?: ReactNode;
}) {
  const labels = rightWorkbenchStartLabels[isZh ? "zh" : "en"];
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [serverHistory, setServerHistory] = useState<BrowserHistoryItem[]>([]);
  const [localHistory, setLocalHistory] = useState<StartHistoryEntry[]>(() => readLocalStartHistory());
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const suppressAutocompleteRef = useRef(false);

  useEffect(() => () => request.current?.abort(), []);

  /** 聚焦时拉取最新浏览器访问历史，同时刷新本地输入记录。 */
  const refreshHistory = useCallback(() => {
    setLocalHistory(readLocalStartHistory());
    void fetchBrowserHistory().then((res) => {
      setServerHistory(res.items ?? []);
    }).catch(() => {});
  }, []);

  // 点击搜索区域外部时收起下拉。
  useEffect(() => {
    if (!dropdownOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapRef.current?.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [dropdownOpen]);

  const allHistory = useMemo(() => mergeStartHistory(serverHistory, localHistory), [localHistory, serverHistory]);
  const suggestions = useMemo(() => filterStartHistory(allHistory, query), [allHistory, query]);

  // 有项目时，普通文本作为文件路径；显式协议、本机地址或来自网址历史的条目交给内置浏览器。
  const submitInput = useCallback(async (rawInput: string, forceUrl = false) => {
    const input = rawInput.trim();
    if (!input || request.current) return;
    setDropdownOpen(false);
    const operation = new AbortController();
    request.current = operation;
    setOpening(true);
    setError("");
    try {
      const isUrl = forceUrl || isExplicitStartUrl(input);
      setLocalHistory(recordLocalStartHistory({ kind: isUrl ? "url" : "query", value: input }));
      if (!projectId || isUrl) {
        await onOpenUrl(input);
      } else {
        const file = await store.readProjectFile(projectId, input, operation.signal, worktreeId);
        if (!operation.signal.aborted) store.openWorkspaceFile(projectId, file.path, file.relativePath, undefined, undefined, worktreeId);
      }
    } catch (cause) {
      if (!operation.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      request.current = null;
      if (!operation.signal.aborted) setOpening(false);
    }
  }, [onOpenUrl, projectId, store, worktreeId]);

  const openInput = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitInput(value);
  };

  const handleSelectSuggestion = useCallback((entry: StartHistoryEntry) => {
    setValue(entry.kind === "url" ? entry.displayUrl : entry.value);
    setQuery(entry.kind === "url" ? entry.displayUrl : entry.value);
    void submitInput(entry.value, entry.kind === "url");
  }, [submitInput]);

  const handleDeleteSuggestion = useCallback((entry: StartHistoryEntry) => {
    setLocalHistory(removeLocalStartHistory(entry.key));
    if (entry.serverIds.length > 0) {
      const removedSet = new Set(entry.serverIds);
      setServerHistory((prev) => prev.filter((item) => !removedSet.has(item.id)));
      for (const id of entry.serverIds) {
        void deleteBrowserHistoryItem(id).catch(() => {});
      }
    }
    setActiveIndex(-1);
  }, []);

  const handleInputChange = (nextRaw: string) => {
    setError("");
    setDropdownOpen(true);
    setActiveIndex(-1);
    setQuery(nextRaw);

    const inputEl = inputRef.current;
    const atEnd = inputEl ? inputEl.selectionStart === nextRaw.length && inputEl.selectionEnd === nextRaw.length : true;
    const shouldComplete = !composingRef.current && !suppressAutocompleteRef.current && atEnd && nextRaw.length > 0;
    suppressAutocompleteRef.current = false;

    if (shouldComplete) {
      const filtered = filterStartHistory(allHistory, nextRaw);
      const completed = findInlineCompletion(filtered, nextRaw);
      if (completed) {
        setValue(completed);
        setActiveIndex(0);
        // 下一帧把自动补全的后缀选中，继续打字会自然覆盖，按回车直接打开。
        requestAnimationFrame(() => {
          inputRef.current?.setSelectionRange(nextRaw.length, completed.length);
        });
        return;
      }
    }
    setValue(nextRaw);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" || event.key === "Delete") {
      suppressAutocompleteRef.current = true;
      return;
    }
    if (event.key === "Escape") {
      if (dropdownOpen) {
        event.preventDefault();
        setDropdownOpen(false);
        setActiveIndex(-1);
      }
      return;
    }
    if (!dropdownOpen || suggestions.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = activeIndex < 0
        ? (step > 0 ? 0 : suggestions.length - 1)
        : (activeIndex + step + suggestions.length) % suggestions.length;
      setActiveIndex(nextIndex);
      const target = suggestions[nextIndex];
      if (target) setValue(target.kind === "url" ? target.displayUrl : target.value);
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      handleSelectSuggestion(suggestions[activeIndex]!);
    }
  };

  const shortcuts = [
    { label: labels.terminal, icon: IconTerminal2, action: onOpenTerminal },
    { label: labels.changes, icon: IconFileDiff, action: onOpenReview },
    { label: labels.sideAsk, icon: IconMessageCircle, action: onOpenSideAsk },
  ];

  return (
    <div className={styles.stage}>
      <div className={styles.content}>
        <h2 className={styles.srOnly}>{labels.title}</h2>
        <div className={styles.searchWrap} ref={wrapRef}>
          <form className={styles.field} role="search" onSubmit={openInput}>
            <IconSearch size={17} aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={value}
              autoComplete="off"
              spellCheck={false}
              placeholder={projectId ? labels.fileOrUrl : labels.url}
              aria-label={projectId ? labels.fileOrUrl : labels.url}
              aria-expanded={dropdownOpen && suggestions.length > 0}
              aria-autocomplete="both"
              onFocus={() => {
                refreshHistory();
                setDropdownOpen(true);
              }}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={(event) => {
                composingRef.current = false;
                handleInputChange(event.currentTarget.value);
              }}
              onKeyDown={handleKeyDown}
              onChange={(event) => handleInputChange(event.currentTarget.value)}
            />
            <button type="submit" className={styles.srOnly} aria-label={labels.open} disabled={!value.trim() || opening} />
          </form>
          {dropdownOpen && (
            <StartOmnibox
              entries={suggestions}
              query={query}
              activeIndex={activeIndex}
              isZh={isZh}
              onHoverIndex={setActiveIndex}
              onSelect={handleSelectSuggestion}
              onDelete={handleDeleteSuggestion}
            />
          )}
        </div>
        {opening && <p className={styles.feedback} role="status">{labels.opening}</p>}
        {error && <p className={styles.feedback} role="alert">{error}</p>}
        <section className={styles.section} aria-label={labels.shortcuts}>
          <div className={styles.sectionRow}>
            <span className={styles.sectionLabel}>{labels.shortcuts}</span>
            {projectName && <span className={styles.sectionMeta} title={projectName}>{projectName}</span>}
          </div>
          <div className={styles.shortcuts} role="group" aria-label={labels.shortcuts}>
            {shortcuts.map(({ label, icon: Icon, action }) => (
              <button key={label} type="button" onClick={action}>
                <Icon size={19} stroke={1.7} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
            {extraShortcuts}
          </div>
        </section>
        {children}
      </div>
    </div>
  );
}

// 浏览器「浏览历史」与「下载历史记录」管理子页：按日期分组、搜索、智能体标识、定位文件与一键清空。
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconArrowLeft, IconFile, IconFolder, IconGlobe, IconSearch, IconTrash } from "@tabler/icons-react";
import { SettingsPage, settingsStyles as baseStyles } from "@lfaa/ui-primitives/client";
import {
  clearBrowserDownloads,
  clearBrowserHistory,
  deleteBrowserDownloadItem,
  deleteBrowserHistoryItem,
  fetchBrowserDownloads,
  fetchBrowserHistory,
  revealBrowserDownload,
  type BrowserDownloadItem,
  type BrowserHistoryItem,
} from "../api/browser-data-client";
import { DownloadActivity } from "../downloads/DownloadActivity";
import styles from "./Browser-Settings.module.css";

function formatDateKey(ts: number, isZh: boolean): string {
  const d = new Date(ts);
  return isZh ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日` : d.toLocaleDateString();
}

function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function BrowserHistorySubpage({ isZh, onBack }: { isZh: boolean; onBack: () => void }) {
  const [items, setItems] = useState<BrowserHistoryItem[]>([]);
  const [query, setQuery] = useState("");

  const load = useCallback(async (q?: string) => {
    const res = await fetchBrowserHistory(q).catch(() => ({ items: [] }));
    setItems(res.items);
  }, []);

  useEffect(() => { void load(query); }, [load, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, BrowserHistoryItem[]>();
    for (const item of items) {
      const key = formatDateKey(item.visitedAt, isZh);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [isZh, items]);

  return (
    <SettingsPage
      title={isZh ? "浏览历史" : "Browsing history"}
      description={isZh ? "查看和管理你在内置浏览器中访问过的页面。" : "Find websites visited in the built-in browser."}
      actions={(
        <button
          type="button"
          className={baseStyles.actionBtn}
          disabled={items.length === 0}
          onClick={() => void clearBrowserHistory().then(() => load(query))}
        >
          {isZh ? "清除浏览数据" : "Clear history"}
        </button>
      )}
    >
      <div className={styles.breadcrumb}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <IconArrowLeft size={14} aria-hidden="true" />
          <span>{isZh ? "浏览器" : "Browser"}</span>
        </button>
        <span>/</span>
        <span>{isZh ? "浏览历史" : "History"}</span>
      </div>

      <div className={styles.searchBar}>
        <div className={styles.searchInputWrap}>
          <IconSearch size={14} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            value={query}
            placeholder={isZh ? "搜索浏览历史" : "Search history"}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className={styles.emptyText}>{isZh ? "暂无浏览历史记录。" : "No browsing history yet."}</p>
      ) : grouped.map(([dateLabel, list]) => (
        <div key={dateLabel}>
          <h3 className={styles.dateHeading}>{dateLabel}</h3>
          <div className={styles.itemList}>
            {list.map((item) => (
              <div key={item.id} className={styles.itemRow}>
                <IconGlobe size={15} aria-hidden="true" />
                <div className={styles.itemMain}>
                  <span className={styles.itemTitle} title={item.title}>{item.title}</span>
                  <span className={styles.itemSub} title={item.url}>{item.url}</span>
                </div>
                {item.byAgent && <span className={styles.agentTag}>{isZh ? "智能体" : "Agent"}</span>}
                <span className={styles.timeText}>{formatClock(item.visitedAt)}</span>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={isZh ? "删除记录" : "Delete"}
                  onClick={() => void deleteBrowserHistoryItem(item.id).then(() => load(query))}
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </SettingsPage>
  );
}

export function BrowserDownloadsSubpage({ isZh, onBack }: { isZh: boolean; onBack: () => void }) {
  const [items, setItems] = useState<BrowserDownloadItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    void fetchBrowserDownloads(query).then((res) => {
      if (!active) return;
      setItems(res.items);
      setError("");
    }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [query, refresh]);

  const change = (operation: Promise<unknown>) => {
    void operation.then(reload).catch((reason: Error) => setError(reason.message));
  };

  const grouped = useMemo(() => {
    const map = new Map<string, BrowserDownloadItem[]>();
    for (const item of items) {
      const key = formatDateKey(item.downloadedAt, isZh);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [isZh, items]);

  return (
    <SettingsPage
      title={isZh ? "下载历史记录" : "Download history"}
      description={isZh ? "查看和管理从内置浏览器下载的文件。" : "View and manage files downloaded from the built-in browser."}
      actions={(
        <button
          type="button"
          className={baseStyles.actionBtn}
          disabled={items.length === 0}
          onClick={() => change(clearBrowserDownloads())}
        >
          {isZh ? "清除全部" : "Clear all"}
        </button>
      )}
    >
      <div className={styles.breadcrumb}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <IconArrowLeft size={14} aria-hidden="true" />
          <span>{isZh ? "浏览器" : "Browser"}</span>
        </button>
        <span>/</span>
        <span>{isZh ? "下载历史记录" : "Downloads"}</span>
      </div>

      <div className={styles.searchBar}>
        <div className={styles.searchInputWrap}>
          <IconSearch size={14} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            value={query}
            placeholder={isZh ? "搜索下载历史记录" : "Search downloads"}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <DownloadActivity isZh={isZh} onSaved={reload} />
      {error && <p role="alert">{error}</p>}
      {grouped.length === 0 ? (
        !error && <p className={styles.emptyText}>{isZh ? "暂无下载记录。" : "No downloads yet."}</p>
      ) : grouped.map(([dateLabel, list]) => (
        <div key={dateLabel}>
          <h3 className={styles.dateHeading}>{dateLabel}</h3>
          <div className={styles.itemList}>
            {list.map((item) => (
              <div key={item.id} className={styles.itemRow}>
                <IconFile size={15} aria-hidden="true" />
                <div className={styles.itemMain}>
                  <span className={styles.itemTitle}>{item.filename}{item.deleted ? (isZh ? " · 已删除" : " · Deleted") : ""}</span>
                  <span className={styles.itemSub} title={item.savePath}>{item.savePath || item.url}</span>
                </div>
                <span className={styles.timeText}>{formatClock(item.downloadedAt)}</span>
                {!item.deleted && item.savePath && (
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title={isZh ? "在资源管理器中显示" : "Show in Explorer"}
                    onClick={() => void revealBrowserDownload(item.id).catch((reason: Error) => setError(reason.message))}
                  >
                    <IconFolder size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={isZh ? "移除记录" : "Remove"}
                  onClick={() => change(deleteBrowserDownloadItem(item.id))}
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </SettingsPage>
  );
}

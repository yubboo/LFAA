// 浏览器画布资料库、运行历史与全屏 Agent 对话抽屉。
import { useEffect, useState, type ReactNode } from "react";
import {
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import type { CanvasRun } from "@lfaa/canvas/contract";
import { assetUrl, libraryMediaUrl, listLibraryMedia, type LibraryMediaEntry } from "../api/canvas-api";
import type { CanvasLabels } from "../locales";
import { startLibraryDrag } from "./canvas-library-drag";
import styles from "./Canvas-Drawers.module.css";

/** 复用应用资料库中的图片和视频，并显示当前画布的运行历史。 */
export function CanvasSideDrawer({
  drawer,
  path,
  runs,
  t,
  onClose,
  onInsertLibraryItem,
  onDragLibraryItem,
}: {
  drawer: "assets" | "history";
  path: string;
  runs: CanvasRun[];
  t: CanvasLabels;
  onClose: () => void;
  onInsertLibraryItem: (item: LibraryMediaEntry) => void;
  onDragLibraryItem: (item: LibraryMediaEntry | null) => void;
}) {
  const [items, setItems] = useState<LibraryMediaEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (drawer !== "assets") return;
    const controller = new AbortController();
    setLoading(true);
    void listLibraryMedia(80, controller.signal)
      .then((list) => setItems(list))
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [drawer]);

  const filtered = filter === "all" ? items : items.filter((item) => item.kind === filter);

  return (
    <aside className={styles.sideDrawer} aria-label={drawer === "assets" ? t.assetsDrawer : t.historyDrawer}>
      <header className={styles.drawerHeader}>
        <strong>{drawer === "assets" ? t.assetsDrawer : t.historyDrawer}</strong>
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label={t.close}>
          <IconX size={15} />
        </button>
      </header>

      {drawer === "assets" ? (
        <>
          <div className={styles.filterTabs}>
            {(["all", "image", "video"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={styles.filterTab}
                data-active={filter === tab ? "true" : undefined}
                onClick={() => setFilter(tab)}
              >
                {tab === "all" ? t.allMedia : tab === "image" ? t.imagesTab : t.videosTab}
              </button>
            ))}
          </div>
          <div className={styles.assetGrid}>
            {!loading && filtered.length === 0 && <p className={styles.emptyText}>{t.emptyLibrary}</p>}
            {filtered.map((item) => (
              <button
                key={item.path}
                type="button"
                className={styles.assetTile}
                title={`${item.name} · ${t.insertToCanvas}`}
                draggable
                onDragStart={(event) => {
                  startLibraryDrag(event.dataTransfer);
                  onDragLibraryItem(item);
                }}
                onDragEnd={() => onDragLibraryItem(null)}
                onClick={() => onInsertLibraryItem(item)}
              >
                {item.kind === "video"
                  ? <video draggable={false} muted preload="metadata" src={libraryMediaUrl(item.path)} />
                  : <img draggable={false} alt="" loading="lazy" src={libraryMediaUrl(item.path)} />}
                <span className={styles.assetName}>{item.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.historyList}>
          {runs.length === 0 && <p className={styles.emptyText}>{t.noOutput}</p>}
          {runs.map((run) => (
            <div key={run.id} className={styles.historyRow}>
              {run.assetId && run.kind === "image" && <img alt="" src={assetUrl(path, run.assetId)} />}
              <div className={styles.historyMeta}>
                <strong>{t[run.kind]} · {t[run.status]}</strong>
                <span>{run.prompt}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

/** 仅在工作台最大化/全屏时显示：右下角「与 Agent 对话」悬浮胶囊及滑出的右侧对话抽屉。 */
export function CanvasFullscreenChat({
  maximized,
  t,
  renderChat,
}: {
  maximized: boolean;
  t: CanvasLabels;
  renderChat?: (() => ReactNode) | undefined;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!maximized && open) setOpen(false);
  }, [maximized, open]);

  if (!maximized || !renderChat) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          className={styles.agentFab}
          data-testid="canvas-agent-fab"
          onClick={() => setOpen(true)}
        >
          <span className={styles.agentOrb} aria-hidden="true">
            <IconSparkles size={13} stroke={2} />
          </span>
          <span>{t.chatWithAgent}</span>
        </button>
      )}

      {open && (
        <aside className={styles.agentDrawer} aria-label={t.agentDrawerTitle} data-testid="canvas-agent-drawer">
          <header className={styles.drawerHeader}>
            <span className={styles.agentDrawerTitle}>
              <IconSparkles size={15} />
              <strong>{t.agentDrawerTitle}</strong>
            </span>
            <button type="button" className={styles.iconBtn} onClick={() => setOpen(false)} aria-label="Close">
              <IconX size={15} />
            </button>
          </header>
          <div className={styles.agentDrawerBody}>{renderChat()}</div>
        </aside>
      )}
    </>
  );
}

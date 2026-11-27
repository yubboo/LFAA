// 浏览器画布侧边工具条、资料库、运行历史与全屏 Agent 对话抽屉。
import { useEffect, useState, type ReactNode } from "react";
import {
  IconFolder,
  IconHistory,
  IconPlayerPlay,
  IconPlus,
  IconScissors,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import type { CanvasNodeKind, CanvasRun } from "@lfaa/canvas/contract";
import { assetUrl, libraryMediaUrl, listLibraryMedia, type LibraryMediaEntry } from "../api/canvas-api";
import type { CanvasLabels } from "../locales";
import { canvasNodeOptions } from "./Canvas-Menu";
import styles from "./Canvas-Drawers.module.css";

export type SideDrawerKind = "add" | "assets" | "history" | null;

export function CanvasLeftDock({
  t,
  activeDrawer,
  onToggleDrawer,
  onQuickRun,
  onQuickPrevis,
  onAddNode,
}: {
  t: CanvasLabels;
  activeDrawer: SideDrawerKind;
  onToggleDrawer: (drawer: SideDrawerKind) => void;
  onQuickRun: () => void;
  onQuickPrevis: () => void;
  onAddNode: (kind: CanvasNodeKind) => void;
}) {
  return (
    <div className={styles.leftRailWrap}>
      <nav className={styles.leftRail} aria-label="Canvas tools">
        <button
          type="button"
          className={styles.railPrimary}
          data-active={activeDrawer === "add" ? "true" : undefined}
          title={t.add}
          aria-label={t.add}
          onClick={() => onToggleDrawer(activeDrawer === "add" ? null : "add")}
        >
          <IconPlus size={18} stroke={2.2} />
        </button>
        <button
          type="button"
          className={styles.railBtn}
          data-active={activeDrawer === "assets" ? "true" : undefined}
          title={t.assetsDrawer}
          aria-label={t.assetsDrawer}
          onClick={() => onToggleDrawer(activeDrawer === "assets" ? null : "assets")}
        >
          <IconFolder size={17} stroke={1.7} />
        </button>
        <button
          type="button"
          className={styles.railBtn}
          title={t.run}
          aria-label={t.run}
          onClick={onQuickRun}
        >
          <IconPlayerPlay size={17} stroke={1.7} />
        </button>
        <button
          type="button"
          className={styles.railBtn}
          data-active={activeDrawer === "history" ? "true" : undefined}
          title={t.historyDrawer}
          aria-label={t.historyDrawer}
          onClick={() => onToggleDrawer(activeDrawer === "history" ? null : "history")}
        >
          <IconHistory size={17} stroke={1.7} />
        </button>
        <button
          type="button"
          className={styles.railBtn}
          title={t.previs}
          aria-label={t.previs}
          onClick={onQuickPrevis}
        >
          <IconScissors size={17} stroke={1.7} />
        </button>
      </nav>

      {activeDrawer === "add" && (
        <div className={styles.addPopover} role="menu" aria-label={t.add}>
          {canvasNodeOptions.map(({ kind, Icon }) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => {
                onAddNode(kind);
                onToggleDrawer(null);
              }}
            >
              <Icon size={15} />
              <span>{t[kind]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 统一资料库资产抽屉（读取 E:\lfaa\data\.lfaa-media\{images,videos}）与运行历史抽屉。 */
export function CanvasSideDrawer({
  drawer,
  path,
  runs,
  t,
  onClose,
  onInsertLibraryItem,
}: {
  drawer: "assets" | "history";
  path: string;
  runs: CanvasRun[];
  t: CanvasLabels;
  onClose: () => void;
  onInsertLibraryItem: (item: LibraryMediaEntry) => void;
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
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
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
                onClick={() => onInsertLibraryItem(item)}
              >
                {item.kind === "video"
                  ? <video muted preload="metadata" src={libraryMediaUrl(item.path)} />
                  : <img alt={item.name} loading="lazy" src={libraryMediaUrl(item.path)} />}
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

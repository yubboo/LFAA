// 右栏标签右键菜单：关闭系列、复制路径/网址与新建标签；快捷键提示取自工作台注册表，不写死。
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconCopy, IconFileText, IconPlus, IconX } from "@tabler/icons-react";
import { formatShortcutKeys, type WorkbenchShortcutBinding } from "@lfaa/ui-layout/client";
import type { WorkbenchOrderedTab } from "./useWorkbenchTabMenu";
import styles from "./WorkbenchTabMenu.module.css";

const EDGE_GAP = 8;

/** 显示在鼠标位置的标签菜单；越界时自动回收到视口内，Esc/点外部/滚轮关闭。 */
export function WorkbenchTabMenu({
  isZh,
  x,
  y,
  tab,
  tabs,
  shortcuts,
  onClose,
  onCloseTab,
  onCloseOthers,
  onCloseRight,
  onCloseAll,
  onNewTab,
}: {
  isZh: boolean;
  x: number;
  y: number;
  tab: WorkbenchOrderedTab;
  tabs: WorkbenchOrderedTab[];
  shortcuts: WorkbenchShortcutBinding[];
  onClose: () => void;
  onCloseTab: (key: string) => void;
  onCloseOthers: (key: string) => void;
  onCloseRight: (key: string) => void;
  onCloseAll: () => void;
  onNewTab: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      x: Math.max(EDGE_GAP, Math.min(x, window.innerWidth - rect.width - EDGE_GAP)),
      y: Math.max(EDGE_GAP, Math.min(y, window.innerHeight - rect.height - EDGE_GAP)),
    });
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const shortcutKeys = (id: string) => formatShortcutKeys(shortcuts.find((item) => item.id === id)?.keys ?? null);
  const index = tabs.findIndex((item) => item.key === tab.key);
  const hasOthers = tabs.length > 1;
  const hasRight = index >= 0 && index < tabs.length - 1;
  const copyValue = tab.kind === "file" ? tab.path : tab.kind === "browser" ? tab.url : undefined;
  const copyLabel = tab.kind === "browser"
    ? (isZh ? "复制网址" : "Copy URL")
    : (isZh ? "复制文件路径" : "Copy file path");

  const closeKeyHint = shortcutKeys("workbench.close-tab");
  const newTabHint = shortcutKeys("workbench.new-tab");

  return (
    <div
      ref={ref}
      className={styles.menu}
      role="menu"
      aria-label={isZh ? "标签操作" : "Tab actions"}
      style={{ left: position.x, top: position.y }}
    >
      <button
        type="button"
        role="menuitem"
        className={styles.item}
        onClick={() => { onCloseTab(tab.key); onClose(); }}
      >
        <IconX size={14} aria-hidden="true" />
        <span>{isZh ? "关闭" : "Close"}</span>
        {closeKeyHint && <kbd className={styles.kbd}>{closeKeyHint}</kbd>}
      </button>
      <button
        type="button"
        role="menuitem"
        className={styles.item}
        disabled={!hasOthers}
        onClick={() => { onCloseOthers(tab.key); onClose(); }}
      >
        <IconX size={14} aria-hidden="true" />
        <span>{isZh ? "关闭其他标签页" : "Close other tabs"}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className={styles.item}
        disabled={!hasRight}
        onClick={() => { onCloseRight(tab.key); onClose(); }}
      >
        <IconX size={14} aria-hidden="true" />
        <span>{isZh ? "关闭右侧标签页" : "Close tabs to the right"}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className={styles.item}
        onClick={() => { onCloseAll(); onClose(); }}
      >
        <IconX size={14} aria-hidden="true" />
        <span>{isZh ? "关闭所有标签页" : "Close all tabs"}</span>
      </button>
      <div className={styles.divider} role="separator" />
      {copyValue && (
        <button
          type="button"
          role="menuitem"
          className={styles.item}
          onClick={() => {
            void navigator.clipboard?.writeText(copyValue).catch(() => {});
            onClose();
          }}
        >
          {tab.kind === "browser" ? <IconFileText size={14} aria-hidden="true" /> : <IconCopy size={14} aria-hidden="true" />}
          <span>{copyLabel}</span>
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        className={styles.item}
        onClick={() => { onNewTab(); onClose(); }}
      >
        <IconPlus size={14} aria-hidden="true" />
        <span>{isZh ? "新建标签页" : "New tab"}</span>
        {newTabHint && <kbd className={styles.kbd}>{newTabHint}</kbd>}
      </button>
    </div>
  );
}
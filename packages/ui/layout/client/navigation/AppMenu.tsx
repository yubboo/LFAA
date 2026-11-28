// 展示更多应用：按悬浮卡片规范贴左二栏展开，桌面支持固定入口，手机汇总底栏收纳项。
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useDismissibleLayer, usePanePresence } from "@lfaa/ui-primitives/client";
import type { LocaleMessages } from "../locales";
import type { NavigationView } from "./navigation";
import type { NavigationIconName } from "./NavigationIcon";
import { NavigationIcon } from "./NavigationIcon";
import { resolveAppMenuGeometry, type AppMenuGeometry } from "./app-menu-geometry";
import styles from "./AppMenu.module.css";

interface AppMenuAction {
  view: NavigationView;
  label: string;
  icon: NavigationIconName;
}

/** 将桌面固定入口和窄屏收纳入口集中到同一悬浮卡片，位置与宽度跟随左二栏，不越栏。 */
export function AppMenu({
  open,
  anchorRef,
  actions,
  locale,
  isMobile,
  activeView,
  pinnedApps,
  onClose,
  onSelect,
  onTogglePinned,
}: {
  open: boolean;
  /** 触发按钮：卡片按它的位置展开，Esc / Tab 关闭后焦点也回到它。 */
  anchorRef: RefObject<HTMLButtonElement | null>;
  actions: AppMenuAction[];
  locale: LocaleMessages;
  isMobile: boolean;
  activeView: NavigationView;
  pinnedApps: NavigationView[];
  onClose: () => void;
  onSelect: (view: NavigationView) => void;
  onTogglePinned: (view: NavigationView) => boolean;
}) {
  const [notice, setNotice] = useState("");
  const [panelPos, setPanelPos] = useState<AppMenuGeometry | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const mounted = usePanePresence(open, 140);
  const layerRefs = useMemo(() => [panelRef, anchorRef], [anchorRef]);

  /** 量取菜单卡片位置：宽度跟随左二栏内宽，不压住中间会话区；窄屏交由 CSS 底部抽屉。 */
  const measurePanel = useCallback(() => {
    const trigger = anchorRef.current?.getBoundingClientRect();
    const compact = isMobile || window.matchMedia("(max-width: 767px)").matches;
    if (!trigger || compact) {
      setPanelPos(null);
      return;
    }
    const column = document.querySelector<HTMLElement>('[data-region="section-navigation"]')?.getBoundingClientRect();
    setPanelPos(resolveAppMenuGeometry({
      trigger,
      column: column && column.width > 0 ? column : null,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));
  }, [anchorRef, isMobile]);

  useLayoutEffect(() => {
    if (!open) return;
    setNotice("");
    measurePanel();
  }, [measurePanel, open]);

  useEffect(() => {
    if (!open) return;
    if (isMobile) {
      panelRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    }
    window.addEventListener("resize", measurePanel);
    return () => window.removeEventListener("resize", measurePanel);
  }, [isMobile, measurePanel, open]);

  useDismissibleLayer({ open, refs: layerRefs, onClose, returnFocusRef: anchorRef });

  if (!mounted) return null;

  return createPortal(
    <>
      {open && <div className={styles.scrim} aria-hidden="true" onClick={onClose} />}
      <section
        className={styles.menu}
        id="lfaa-app-menu"
        ref={panelRef}
        role="menu"
        aria-label={locale.more}
        data-state={open ? "open" : "closed"}
        style={panelPos ? { left: `${panelPos.left}px`, top: `${panelPos.top}px`, width: `${panelPos.width}px` } : undefined}
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            onClose();
            anchorRef.current?.focus();
            return;
          }
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
          event.preventDefault();
          const items = panelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
          if (!items || items.length === 0) return;
          if (event.key === "Home") {
            items[0]?.focus();
            return;
          }
          if (event.key === "End") {
            items[items.length - 1]?.focus();
            return;
          }
          const current = Array.prototype.indexOf.call(items, document.activeElement);
          const step = event.key === "ArrowDown" ? 1 : -1;
          items[(current + step + items.length) % items.length]?.focus();
        }}
      >
        {actions.map((action) => {
          const pinned = pinnedApps.includes(action.view);
          return (
            <div key={action.view} className={styles.entry}>
              <button
                className={styles.entryAction}
                type="button"
                role="menuitem"
                aria-current={isMobile && activeView === action.view ? "page" : undefined}
                onClick={() => onSelect(action.view)}
              >
                <NavigationIcon name={action.icon} /><span>{action.label}</span>
              </button>
              {!isMobile && (
                <button
                  className={`${styles.pinButton} ${pinned ? styles.pinButtonActive : ""}`}
                  type="button"
                  aria-label={`${pinned ? locale.unpinApp : locale.pinApp}: ${action.label}`}
                  aria-pressed={pinned}
                  onClick={() => setNotice(onTogglePinned(action.view) ? "" : locale.pinStorageError)}
                >
                  <NavigationIcon name="pin" />
                </button>
              )}
            </div>
          );
        })}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
      </section>
    </>,
    document.body,
  );
}

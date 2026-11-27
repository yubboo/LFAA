// 设置中心弹窗：把原先占满工作区的设置页收敛为居中卡片（左栏目录 + 右内容区），
// 背景保留当前工作区并压暗；关闭时回到打开设置前的视图。
import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { ScrollArea } from "@lfaa/ui-primitives/client";
import type { LocaleMessages } from "../locales";
import type { NavigationView } from "../navigation/navigation";
import { NavigationIcon } from "../navigation/NavigationIcon";
import { SETTINGS_CATALOG, findSettingsCatalogItem } from "./settings-catalog";
import styles from "./SettingsDialog.module.css";

// 弹窗内可聚焦元素选择器；用于 Tab 焦点循环，避免焦点跑出 aria-modal 区域。
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** 渲染居中设置弹窗：目录导航、当前设置页与关闭入口。 */
export function SettingsDialog({
  open = true,
  locale,
  activeView,
  renderContent,
  onNavigate,
  onClose,
}: {
  open?: boolean;
  locale: LocaleMessages;
  activeView: string;
  renderContent: () => ReactNode;
  onNavigate: (view: NavigationView) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isZh = locale.settings === "设置";
  const currentItem = findSettingsCatalogItem(activeView);
  const currentLabel = currentItem ? (isZh ? currentItem.labelZh : currentItem.labelEn) : activeView;
  // 只求值一次视图内容：未接入的设置页没有注册视图，退化为占位说明。
  const content = renderContent();

  // 打开时把焦点移入弹窗，并锁住背景滚动；关闭后恢复原来的焦点与滚动。
  // 同时在根元素标记设置中心已打开，让壳层切到「设置中心」自己的背景图（由主题插件按选择输出）。
  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.settingsOpen = "true";
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      delete document.documentElement.dataset.settingsOpen;
      previousActive?.focus({ preventScroll: true });
    };
  }, [open]);

  // 每次切换设置页都把内容区滚回顶部，避免沿用上一页的滚动位置。
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [activeView]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    }
  }, [onClose]);

  const state = open ? "open" : "closed";

  return (
    <div
      className={styles.backdrop}
      data-state={state}
      // 只响应遮罩自身的点击，避免在弹窗内部拖动到遮罩时误关闭。
      onPointerDown={(event) => {
        if (open && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-label={locale.settingsCenter}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <aside className={styles.nav} aria-label={locale.settingsCenter}>
          <p className={styles.navHeading}>{locale.settingsCenter}</p>
          {/* 目录本身滚动：共享滚动容器统一细滚动条，常驻槽位避免目录项左右跳。 */}
          <ScrollArea className={styles.navScroll} stableGutter>
            {SETTINGS_CATALOG.map((group) => (
              <section key={group.id} className={styles.navGroup}>
                <p className={styles.navGroupTitle}>{isZh ? group.titleZh : group.titleEn}</p>
                {group.items.map((item) => {
                  const label = isZh ? item.labelZh : item.labelEn;
                  const active = activeView === item.viewId;
                  return (
                    <button
                      key={item.viewId}
                      className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      title={label}
                      onClick={() => onNavigate(item.viewId as NavigationView)}
                    >
                      {label}
                    </button>
                  );
                })}
              </section>
            ))}
          </ScrollArea>
        </aside>

        <section className={styles.panel} aria-label={currentLabel}>
          <div className={styles.panelHeader}>
            <button className={styles.closeButton} type="button" aria-label={locale.close} title={locale.close} onClick={onClose}>
              <NavigationIcon name="close" />
            </button>
          </div>
          {/* 设置页正文独立滚动：常驻槽位让各页出现/收起滚动条时中间内容不再左右抖动。 */}
          <ScrollArea className={styles.panelBody} ref={bodyRef} stableGutter>
            {content !== null ? content : (
              <div className={styles.placeholder}>
                <h2>{currentLabel}</h2>
                <p>{locale.featureUnavailable}</p>
              </div>
            )}
          </ScrollArea>
        </section>
      </div>
    </div>
  );
}

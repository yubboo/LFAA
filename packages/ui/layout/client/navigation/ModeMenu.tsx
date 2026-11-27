// 模式卡片：按悬浮卡片规范贴左二栏展开，复用账号卡片的几何、密度与交互。
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useDismissibleLayer, usePanePresence } from "@lfaa/ui-primitives/client";
import type { LocaleMessages } from "../locales";
import type { WorkspaceMode } from "./navigation";
import { NavigationIcon } from "./NavigationIcon";
import { resolveModeMenuGeometry, type ModeMenuGeometry } from "./mode-menu-geometry";
import styles from "./ModeMenu.module.css";

export interface ModeMenuProps {
  open: boolean;
  /** 触发按钮：卡片按它的底边定位，Esc / Tab 关闭后焦点也回到它。 */
  anchorRef: RefObject<HTMLButtonElement | null>;
  locale: LocaleMessages;
  mode: WorkspaceMode;
  onClose: () => void;
  onModeChange: (mode: WorkspaceMode) => void;
}

/** 聊天 / 工作二选一的模式卡片；位置与宽度跟随左二栏，不越栏。 */
export function ModeMenu({ open, anchorRef, locale, mode, onClose, onModeChange }: ModeMenuProps) {
  const [panelPos, setPanelPos] = useState<ModeMenuGeometry | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const mounted = usePanePresence(open, 140);
  const layerRefs = useMemo(() => [panelRef, anchorRef], [anchorRef]);

  /** 量取卡片位置：宽度取左二栏内宽；窗口变化时重算，绘制前完成定位避免首帧跳闪。 */
  const measure = useCallback(() => {
    const trigger = anchorRef.current?.getBoundingClientRect();
    if (!trigger) {
      setPanelPos(null);
      return;
    }
    const column = document.querySelector<HTMLElement>('[data-region="section-navigation"]')?.getBoundingClientRect();
    setPanelPos(resolveModeMenuGeometry({
      trigger,
      column: column && column.width > 0 ? column : null,
      viewportWidth: window.innerWidth,
    }));
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
  }, [measure, open]);

  useEffect(() => {
    if (!open) return;
    // 卡片 Portal 在 body 末尾；打开即把焦点送进当前选项，键盘不会越过整页才摸到菜单。
    panelRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, open]);

  useDismissibleLayer({ open, refs: layerRefs, onClose, returnFocusRef: anchorRef });

  if (!mounted) return null;

  return createPortal(
    <>
      {open && <div className={styles.scrim} aria-hidden="true" onClick={onClose} />}
      <section
        className={styles.menu}
        id="lfaa-mode-menu"
        ref={panelRef}
        role="menu"
        aria-label={locale.workspaceMode}
        data-state={open ? "open" : "closed"}
        style={panelPos ? { left: `${panelPos.left}px`, top: `${panelPos.top}px`, width: `${panelPos.width}px` } : undefined}
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            // Tab 按菜单惯例关闭卡片，焦点交回触发按钮，再按 Tab 继续走页面顺序。
            onClose();
            anchorRef.current?.focus();
            return;
          }
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          const items = panelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
          if (!items || items.length === 0) return;
          const current = Array.prototype.indexOf.call(items, document.activeElement);
          const step = event.key === "ArrowDown" ? 1 : -1;
          items[(current + step + items.length) % items.length]?.focus();
        }}
      >
        <ModeOption selected={mode === "chatgpt"} title={locale.chatModeTitle} description={locale.chatModeDescription} onClick={() => { onModeChange("chatgpt"); onClose(); }} />
        <ModeOption selected={mode === "codex"} title={locale.codexModeTitle} description={locale.codexModeDescription} onClick={() => { onModeChange("codex"); onClose(); }} />
      </section>
    </>,
    document.body,
  );
}

/** 单项：标题 + 说明 + 选中勾，密度与账号卡片动作行一致。 */
function ModeOption({ selected, title, description, onClick }: { selected: boolean; title: string; description: string; onClick: () => void }) {
  return (
    <button className={styles.option} type="button" role="menuitemradio" aria-checked={selected} onClick={onClick}>
      <span className={styles.optionText}><strong>{title}</strong><small>{description}</small></span>
      {selected && <NavigationIcon name="check" className={styles.check} />}
    </button>
  );
}
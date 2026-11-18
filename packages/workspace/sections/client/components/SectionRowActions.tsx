// 渲染左二自定义分区标题行右侧操作按钮（··· 管理菜单与新聊天入口）。
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconDots, IconEdit, IconPencil, IconTrash } from "@tabler/icons-react";
import type { WorkbenchSectionItem } from "@lfaa/ui-layout";
import type { SectionsLocaleMessages } from "../locales";
import type { SectionStore } from "../section-store";
import styles from "./SectionRowActions.module.css";

/** 为自定义分区行提供独立操作菜单和创建会话入口。 */
export function SectionRowActions({
  locale,
  section,
  store,
  onNewChatInSection,
}: {
  locale: SectionsLocaleMessages;
  section: WorkbenchSectionItem;
  store: SectionStore;
  onNewChatInSection: (section: WorkbenchSectionItem) => void;
}) {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuPos) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMenuPos(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuPos(null);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuPos]);

  const toggleMenu = () => {
    if (menuPos) {
      setMenuPos(null);
      return;
    }
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;
    setMenuPos({
      top: Math.max(12, Math.min(rect.bottom + 6, vh - 120)),
      left: Math.max(12, Math.min(rect.left - 8, vw - 176)),
    });
  };

  return (
    <div className={styles.actions} data-section-menu-open={menuPos ? "true" : undefined}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.actionBtn} ${menuPos ? styles.actionBtnActive : ""}`}
        aria-label={`${locale.sectionMoreOptions}: ${section.name}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(menuPos)}
        title={locale.sectionMoreOptions}
        onClick={(event) => {
          event.stopPropagation();
          toggleMenu();
        }}
      >
        <IconDots aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.actionBtn}
        aria-label={`${locale.newChatInSection}: ${section.name}`}
        title={locale.newChatInSection}
        onClick={(event) => {
          event.stopPropagation();
          setMenuPos(null);
          onNewChatInSection(section);
        }}
      >
        <IconEdit aria-hidden="true" />
      </button>

      {menuPos && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className={styles.menu}
          role="menu"
          aria-label={`${locale.sectionMoreOptions}: ${section.name}`}
          data-section-action-menu={section.id}
          style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
        >
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={() => {
              setMenuPos(null);
              store.openRenameDialog(section);
            }}
          >
            <IconPencil aria-hidden="true" />
            <span>{locale.renameSection}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            onClick={() => {
              setMenuPos(null);
              void store.removeSection(section.id);
            }}
          >
            <IconTrash aria-hidden="true" />
            <span>{locale.deleteSection}</span>
          </button>
        </div>,
        document.querySelector("[data-device]") ?? document.body,
      )}
    </div>
  );
}

// 无限画布「我的项目」卡片更多操作浮层：支持打开、重命名、修改封面、创建副本、移动至分区与删除项目。
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronRight } from "@tabler/icons-react";
import type { WorkbenchSectionItem } from "@lfaa/ui-layout/contract";
import styles from "./Canvas-Hub-Card-Menu.module.css";

export interface HubCardMenuAnchor {
  projectId: string;
  canvasId: string;
  name: string;
  sectionId?: string | null;
  top: number;
  right: number;
}

export function CanvasHubCardMenu({
  anchor,
  isZh,
  sections,
  onClose,
  onOpen,
  onStartRename,
  onPickCover,
  onDuplicate,
  onMoveSection,
  onDelete,
}: {
  anchor: HubCardMenuAnchor;
  isZh: boolean;
  sections: readonly WorkbenchSectionItem[];
  onClose: () => void;
  onOpen: () => void;
  onStartRename: () => void;
  onPickCover: () => void;
  onDuplicate: () => void;
  onMoveSection: (sectionId: string | null) => void;
  onDelete: () => void;
}) {
  const [subOpen, setSubOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const menuWidth = 176;
  const menuHeight = 236;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.max(8, Math.min(anchor.right - menuWidth, vw - menuWidth - 8));
  const top = anchor.top + menuHeight > vh - 12 ? Math.max(8, anchor.top - menuHeight - 36) : anchor.top;

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div
        role="menu"
        className={styles.menu}
        style={{ top, left }}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" role="menuitem" className={styles.item} onClick={() => { onClose(); onOpen(); }}>
          <span>{isZh ? "打开" : "Open"}</span>
        </button>

        <button type="button" role="menuitem" className={styles.item} onClick={() => { onClose(); onStartRename(); }}>
          <span>{isZh ? "重命名" : "Rename"}</span>
        </button>

        <button type="button" role="menuitem" className={styles.item} onClick={() => { onClose(); onPickCover(); }}>
          <span>{isZh ? "修改封面" : "Change cover"}</span>
        </button>

        <button type="button" role="menuitem" className={styles.item} onClick={() => { onClose(); onDuplicate(); }}>
          <span>{isZh ? "创建副本" : "Duplicate"}</span>
        </button>

        <div
          className={styles.subWrap}
          onMouseEnter={() => setSubOpen(true)}
          onMouseLeave={() => setSubOpen(false)}
        >
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => setSubOpen((open) => !open)}
          >
            <span>{isZh ? "移动至文件夹" : "Move to folder"}</span>
            <IconChevronRight size={14} stroke={1.8} />
          </button>

          {subOpen && (
            <div role="menu" className={styles.subMenu}>
              {sections.length === 0 ? (
                <span className={styles.subEmpty}>{isZh ? "暂无自定义分区" : "No folders yet"}</span>
              ) : (
                <>
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      role="menuitem"
                      className={styles.item}
                      onClick={() => {
                        onClose();
                        onMoveSection(section.id);
                      }}
                    >
                      <span>{section.name}</span>
                    </button>
                  ))}
                  {anchor.sectionId && (
                    <>
                      <div className={styles.divider} />
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.item}
                        onClick={() => {
                          onClose();
                          onMoveSection(null);
                        }}
                      >
                        <span>{isZh ? "移出当前文件夹" : "Remove from folder"}</span>
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className={styles.divider} />

        <button
          type="button"
          role="menuitem"
          className={`${styles.item} ${styles.danger}`}
          onClick={() => { onClose(); onDelete(); }}
        >
          <span>{isZh ? "删除项目" : "Delete project"}</span>
        </button>
      </div>
    </>,
    document.body,
  );
}

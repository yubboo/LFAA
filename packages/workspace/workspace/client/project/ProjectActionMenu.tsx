// 点击项目行“···”后在按钮下方弹出的操作菜单：支持置顶、编辑、分区、在资源管理器中打开、归档聊天（禁用态）与移除项目。
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconArchive,
  IconCheck,
  IconChevronRight,
  IconFolder,
  IconFolderPlus,
  IconGitBranch,
  IconList,
  IconPin,
  IconSettings,
  IconX,
} from "@tabler/icons-react";
import type { WorkbenchProjectItem, WorkbenchSectionItem } from "@lfaa/ui-layout";
import type { WorkspaceLocaleMessages } from "../locales";
import type { HoverAnchorRect } from "./ProjectHoverCard";
import styles from "./ProjectActionMenu.module.css";

/** 把置顶、编辑、分区移动与移出动作绑定到当前项目。 */
export function ProjectActionMenu({
  locale,
  project,
  sections,
  anchorRect,
  canPin,
  canEdit,
  canOpenExplorer,
  canRemove,
  onTogglePin,
  onAssignSection,
  onCreateSection,
  onEdit,
  onOpenProject,
  onNewWorktreeSession,
  onOpenInExplorer,
  onRemove,
  onClose,
}: {
  locale: WorkspaceLocaleMessages;
  project: WorkbenchProjectItem;
  sections: WorkbenchSectionItem[];
  anchorRect: HoverAnchorRect;
  canPin: boolean;
  canEdit: boolean;
  canOpenExplorer: boolean;
  canRemove: boolean;
  onTogglePin: () => void | Promise<void>;
  onAssignSection: (sectionId: string | null) => void | Promise<void>;
  onCreateSection: () => void;
  onEdit: () => void;
  onOpenProject: () => void;
  onNewWorktreeSession: () => void;
  onOpenInExplorer: () => Promise<{ opened: boolean; error?: string }>;
  onRemove: () => void | Promise<void>;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(`[data-project-more="${project.id}"]`)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, project.id]);

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
  const menuWidth = Math.min(238, Math.max(200, viewportWidth - 24));
  const left = Math.max(12, Math.min(anchorRect.left - 4, viewportWidth - menuWidth - 12));
  const top = Math.max(12, Math.min(anchorRect.bottom + 6, viewportHeight - 280));
  const openSubmenuLeft = left + menuWidth + 196 > viewportWidth;

  const handleOpenExplorer = async () => {
    setErrorMessage("");
    setBusy(true);
    try {
      const result = await onOpenInExplorer();
      if (result.opened) {
        onClose();
      } else {
        setErrorMessage(result.error ?? locale.unavailable);
      }
    } finally {
      setBusy(false);
    }
  };

  const menuNode = (
    <div
      ref={menuRef}
      className={styles.menu}
      role="menu"
      aria-label={`${locale.projectMoreOptions}: ${project.name}`}
      data-project-action-menu={project.id}
      style={{ top: `${top}px`, left: `${left}px`, width: `${menuWidth}px` }}
    >
      {canPin && (
        <button
          type="button"
          role="menuitem"
          className={styles.item}
          onClick={() => {
            onClose();
            void onTogglePin();
          }}
        >
          <IconPin className={styles.icon} aria-hidden="true" />
          <span>{project.pinned ? locale.unpinProject : locale.pinShort}</span>
        </button>
      )}

      {canEdit && (
        <button
          type="button"
          role="menuitem"
          className={styles.item}
          onClick={() => {
            onClose();
            onEdit();
          }}
        >
          <IconSettings className={styles.icon} aria-hidden="true" />
          <span>{locale.editShort}</span>
        </button>
      )}

      <button
        type="button"
        role="menuitem"
        className={styles.item}
        onClick={() => {
          onClose();
          onOpenProject();
        }}
      >
        <IconFolder className={styles.icon} aria-hidden="true" />
        <span>{locale.openProject}</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className={styles.item}
        onClick={() => {
          onClose();
          onNewWorktreeSession();
        }}
      >
        <IconGitBranch className={styles.icon} aria-hidden="true" />
        <span>{locale.newWorktreeChat}</span>
      </button>

      <hr className={styles.divider} />

      <div
        className={styles.submenuWrap}
        onMouseEnter={() => setSectionsOpen(true)}
        onMouseLeave={() => setSectionsOpen(false)}
      >
        <button
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={sectionsOpen}
          className={styles.item}
          onClick={() => setSectionsOpen((open) => !open)}
        >
          <IconList className={styles.icon} aria-hidden="true" />
          <span className={styles.grow}>{locale.projectSections}</span>
          <IconChevronRight className={styles.chevron} aria-hidden="true" />
        </button>

        {sectionsOpen && (
          <div
            className={`${styles.submenu} ${openSubmenuLeft ? styles.submenuLeft : ""}`}
            role="menu"
            aria-label={locale.projectSections}
          >
            {sections.length > 0 ? (
              sections.map((section) => {
                const selected = project.sectionId === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    className={styles.item}
                    onClick={() => {
                      void onAssignSection(selected ? null : section.id);
                      onClose();
                    }}
                  >
                    <span className={styles.grow}>{section.name}</span>
                    {selected && <IconCheck className={styles.check} aria-hidden="true" />}
                  </button>
                );
              })
            ) : (
              <button type="button" role="menuitem" disabled className={styles.itemDisabled}>
                <span>{locale.noCustomSections}</span>
              </button>
            )}
            <hr className={styles.divider} />
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => {
                onClose();
                onCreateSection();
              }}
            >
              <IconFolderPlus className={styles.icon} aria-hidden="true" />
              <span>{locale.newSectionMenu}</span>
            </button>
          </div>
        )}
      </div>

      {canOpenExplorer && (
        <button
          type="button"
          role="menuitem"
          className={styles.item}
          disabled={busy}
          onClick={() => { void handleOpenExplorer(); }}
        >
          <IconFolder className={styles.icon} aria-hidden="true" />
          <span>{locale.openInExplorer}</span>
        </button>
      )}

      <hr className={styles.divider} />

      <button
        type="button"
        role="menuitem"
        disabled
        aria-disabled="true"
        title={locale.archiveChatsUnavailable}
        className={styles.itemDisabled}
      >
        <IconArchive className={styles.icon} aria-hidden="true" />
        <span>{locale.archiveChats}</span>
      </button>

      {canRemove && (
        <>
          <hr className={styles.divider} />
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              onClose();
              void onRemove();
            }}
          >
            <IconX className={styles.icon} aria-hidden="true" />
            <span>{locale.removeProjectMenu}</span>
          </button>
        </>
      )}

      {errorMessage && (
        <p className={styles.error} role="alert">{errorMessage}</p>
      )}
    </div>
  );

  if (typeof document === "undefined") return menuNode;
  return createPortal(menuNode, document.querySelector("[data-device]") ?? document.body);
}

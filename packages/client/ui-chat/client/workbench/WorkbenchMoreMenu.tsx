// 渲染右侧工作台“更多”菜单：会话重命名、置顶、归档、复制与工作台入口。
import type { FormEvent } from "react";
import {
  IconArchive,
  IconChevronRight,
  IconCopy,
  IconLayoutColumns,
  IconPencil,
  IconPin,
  IconPuzzle,
  IconWorld,
} from "@tabler/icons-react";
import type { ChatSessionDetail } from "../store/chat-types";
import styles from "./RightWorkbenchActions.module.css";

/** 展示会话与工作台操作；重命名草稿和菜单开关仍由父组件持有。 */
export function WorkbenchMoreMenu({
  isZh,
  activeSession,
  renaming,
  renameText,
  onRenameTextChange,
  onRenameSubmit,
  onStartRename,
  onTogglePinned,
  onToggleArchived,
  onTriggerBrowser,
  onCopy,
  onOpenExtensions,
  onCloseMenu,
}: {
  isZh: boolean;
  activeSession: ChatSessionDetail | null;
  renaming: boolean;
  renameText: string;
  onRenameTextChange: (text: string) => void;
  onRenameSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStartRename: () => void;
  onTogglePinned: () => void;
  onToggleArchived: () => void;
  onTriggerBrowser: () => void;
  onCopy: () => void;
  onOpenExtensions?: (() => void) | undefined;
  onCloseMenu: () => void;
}) {
  return (
    <div className={styles.popover} role="menu" aria-label={isZh ? "会话与工作台操作" : "Workbench actions"}>
      {renaming && activeSession ? (
        <form className={styles.renameForm} onSubmit={onRenameSubmit}>
          <input
            autoFocus
            value={renameText}
            onChange={(event) => onRenameTextChange(event.target.value)}
            placeholder={isZh ? "输入会话新名称…" : "Session title..."}
          />
          <button type="submit" className={styles.renameSave}>{isZh ? "保存" : "Save"}</button>
        </form>
      ) : (
        <button
          type="button"
          role="menuitem"
          className={styles.menuItem}
          disabled={!activeSession}
          onClick={onStartRename}
        >
          <IconPencil size={14} />
          <span>{isZh ? "重命名" : "Rename"}</span>
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        className={styles.menuItem}
        disabled={!activeSession}
        onClick={onTogglePinned}
      >
        <IconPin size={14} />
        <span>{activeSession?.pinned ? (isZh ? "取消置顶" : "Unpin") : (isZh ? "置顶" : "Pin")}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className={styles.menuItem}
        disabled={!activeSession}
        onClick={onToggleArchived}
      >
        <IconArchive size={14} />
        <span>{activeSession?.archived ? (isZh ? "取消归档" : "Unarchive") : (isZh ? "归档" : "Archive")}</span>
      </button>
      <div className={styles.divider} />
      <button type="button" role="menuitem" className={styles.menuItem} onClick={onTriggerBrowser}>
        <IconLayoutColumns size={14} />
        <span>{isZh ? "分屏打开内置浏览器" : "Split browser tab"}</span>
        <IconWorld size={13} className={styles.trailingIcon} />
      </button>
      <button
        type="button"
        role="menuitem"
        className={styles.menuItem}
        onClick={onCopy}
      >
        <IconCopy size={14} />
        <span>{isZh ? "复制" : "Copy"}</span>
        <IconChevronRight size={13} className={styles.trailingIcon} />
      </button>
      {onOpenExtensions && (
        <>
          <div className={styles.divider} />
          <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { onOpenExtensions(); onCloseMenu(); }}>
            <IconPuzzle size={14} />
            <span>{isZh ? "扩展" : "Extensions"}</span>
            <IconChevronRight size={13} className={styles.trailingIcon} />
          </button>
        </>
      )}
    </div>
  );
}
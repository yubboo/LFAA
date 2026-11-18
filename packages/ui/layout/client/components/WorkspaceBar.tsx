// 渲染工作区顶部栏：左侧栏展开/收起按钮、当前标题、本地模式状态与右侧栏展开/收起按钮。
import type { LocaleMessages } from "../locales";
import { NavigationIcon } from "./NavigationIcon";
import styles from "./WorkbenchShell.module.css";

export function WorkspaceBar({
  locale,
  title,
  leftOpen,
  leftDragCollapsed,
  hasRightColumn,
  rightOpen,
  rightDragCollapsed,
  onToggleLeft,
  onToggleRight,
}: {
  locale: LocaleMessages;
  title: string;
  leftOpen: boolean;
  leftDragCollapsed: boolean;
  hasRightColumn: boolean;
  rightOpen: boolean;
  rightDragCollapsed: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}) {
  return (
    <header className={styles.workspaceBar}>
      <div className={styles.barGroup}>
        <button
          className={`${styles.toggleButton} ${leftOpen && !leftDragCollapsed ? styles.toggleButtonActive : ""}`}
          type="button"
          aria-label={leftOpen ? locale.collapseLeftSidebar : locale.expandLeftSidebar}
          aria-expanded={leftOpen && !leftDragCollapsed}
          title={leftOpen ? locale.collapseLeftSidebar : locale.expandLeftSidebar}
          onClick={onToggleLeft}
        >
          <NavigationIcon name="sidebarLeft" />
        </button>
        <span className={styles.barTitle}>{title}</span>
      </div>
      <div className={styles.barGroup}>
        <span className={styles.status} title={locale.ready}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span className={styles.statusText}>{locale.ready}</span>
        </span>
        {hasRightColumn && (
          <button
            className={`${styles.toggleButton} ${rightOpen && !rightDragCollapsed ? styles.toggleButtonActive : ""}`}
            type="button"
            aria-label={rightOpen ? locale.collapseRightPanel : locale.expandRightPanel}
            aria-expanded={rightOpen && !rightDragCollapsed}
            title={rightOpen ? locale.collapseRightPanel : locale.expandRightPanel}
            onClick={onToggleRight}
          >
            <NavigationIcon name="sidebarRight" />
          </button>
        )}
      </div>
    </header>
  );
}

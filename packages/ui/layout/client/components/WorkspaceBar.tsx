// 渲染工作区顶部栏：左侧栏展开/收起按钮、当前标题、本地模式状态、插件工作区快捷入口与右侧栏展开/收起按钮。
import type { ReactNode } from "react";
import type { WorkbenchWorkspaceActionContribution } from "../../contract/index";
import type { LocaleMessages } from "../locales";
import { NavigationIcon } from "./NavigationIcon";
import styles from "./WorkbenchShell.module.css";

/** 展示当前工作区与左右栏控制，折叠事件由四栏骨架处理。 */
export function WorkspaceBar({
  locale,
  title,
  leftOpen,
  leftDragCollapsed,
  hasRightColumn,
  rightOpen,
  hideRightToggleWhenOpen = false,
  rightDragCollapsed,
  compact = false,
  rightPanelMaximized = false,
  workspaceActions = [],
  onToggleLeft,
  onToggleRight,
}: {
  locale: LocaleMessages;
  title: string;
  leftOpen: boolean;
  leftDragCollapsed: boolean;
  hasRightColumn: boolean;
  rightOpen: boolean;
  hideRightToggleWhenOpen?: boolean;
  rightDragCollapsed: boolean;
  compact?: boolean;
  rightPanelMaximized?: boolean;
  workspaceActions?: WorkbenchWorkspaceActionContribution<ReactNode>[];
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
        {workspaceActions.map((action) => (
          <span key={action.id} className={styles.barActionSlot}>
            {action.render({ compact, rightPanelOpen: rightOpen && !rightDragCollapsed, rightPanelMaximized })}
          </span>
        ))}
        {hasRightColumn && (!hideRightToggleWhenOpen || !rightOpen || rightDragCollapsed) && (
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

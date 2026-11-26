// 渲染工作区顶部栏：左侧栏展开/收起按钮、当前标题、插件工作区快捷入口与右侧栏展开/收起按钮。
import { CapsuleBar, PanelToggleButton } from "@lfaa/ui-primitives/client";
import { formatShortcutKeys, readShortcutKeysFor } from "../shortcuts";
import { defaultShortcutKeys } from "../shortcut-defaults";
import type { ReactNode } from "react";
import type { WorkbenchTitleActionContribution, WorkbenchWorkspaceActionContribution } from "../../contract/index";
import type { LocaleMessages } from "../locales";
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
  titleActions = [],
  workspaceActions = [],
  onToggleLeft,
  onToggleRight,
}: {
  locale: LocaleMessages;
  /** 空会话不显示标题；其余视图按当前名称展示。 */
  title?: string | null;
  leftOpen: boolean;
  leftDragCollapsed: boolean;
  hasRightColumn: boolean;
  rightOpen: boolean;
  hideRightToggleWhenOpen?: boolean;
  rightDragCollapsed: boolean;
  compact?: boolean;
  rightPanelMaximized?: boolean;
  /** 标题右侧的状态控件（会话模式等），窄栏也不隐藏，只压缩标题。 */
  titleActions?: WorkbenchTitleActionContribution<ReactNode>[];
  workspaceActions?: WorkbenchWorkspaceActionContribution<ReactNode>[];
  onToggleLeft: () => void;
  onToggleRight: () => void;
}) {
  const leftHint = formatShortcutKeys(readShortcutKeysFor("global.toggle-left-sidebar", defaultShortcutKeys("global.toggle-left-sidebar"))) || undefined;
  const rightHint = formatShortcutKeys(readShortcutKeysFor("global.toggle-right-panel", defaultShortcutKeys("global.toggle-right-panel"))) || undefined;
  return (
    <header className={styles.workspaceBar}>
      {/* 与左二栏头部同一个胶囊外壳：中间区不再是一整条带底分割线的平栏。 */}
      <CapsuleBar className={styles.barCapsule}>
        <div className={styles.barGroup}>
          <PanelToggleButton
            side="left"
            expanded={leftOpen && !leftDragCollapsed}
            label={leftOpen ? locale.collapseLeftSidebar : locale.expandLeftSidebar}
            shortcut={leftHint}
            onClick={onToggleLeft}
          />
          {title ? <span className={styles.barTitle}>{title}</span> : null}
          {titleActions.length > 0 && (
            <span className={styles.barTitleActions}>
              {titleActions.map((action) => (
                <span key={action.id}>{action.render({ compact })}</span>
              ))}
            </span>
          )}
        </div>
        <div className={styles.barGroup}>
          {workspaceActions.map((action) => (
            <span key={action.id} className={styles.barActionSlot}>
              {action.render({ compact, rightPanelOpen: rightOpen && !rightDragCollapsed, rightPanelMaximized })}
            </span>
          ))}
          {hasRightColumn && (!hideRightToggleWhenOpen || !rightOpen || rightDragCollapsed) && (
            <PanelToggleButton
              side="right"
              expanded={rightOpen && !rightDragCollapsed}
              label={rightOpen ? locale.collapseRightPanel : locale.expandRightPanel}
              shortcut={rightHint}
              onClick={onToggleRight}
            />
          )}
        </div>
      </CapsuleBar>
    </header>
  );
}


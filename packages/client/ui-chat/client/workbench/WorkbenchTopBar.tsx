// 右栏工作台顶栏：标签区与动作组装进左二栏、中间区同款胶囊，外观只由 @lfaa/ui-primitives 的 CapsuleBar 定义。
// 拆成独立组件是因为主壳体已接近 400 行硬上限，顶栏本身与主舞台、终端条没有耦合。
import { useSyncExternalStore, type ComponentProps } from "react";
import { IconChevronRight, IconMessageCircle } from "@tabler/icons-react";
import { shortcutHint } from "@lfaa/ui-layout/client";
import { CapsuleBar, PanelToggleButton } from "@lfaa/ui-primitives/client";
import { RightWorkbenchActions } from "./RightWorkbenchActions";
import { WorkbenchTabs } from "./WorkbenchTabs";
import styles from "./RightWorkbenchPane.module.css";
import barStyles from "./WorkbenchTopBar.module.css";

/** 组装「（全屏会话返回面包屑）+ 标签栏 + 右侧动作组」，外观由 CapsuleBar 统一。 */
export function WorkbenchTopBar({
  tabProps,
  actionProps,
  fullscreenSessionTitle,
  fullscreenShowingChat,
  onSelectFullscreenChat,
  onSelectWorkbenchTab,
}: {
  tabProps: ComponentProps<typeof WorkbenchTabs>;
  actionProps: ComponentProps<typeof RightWorkbenchActions>;
  fullscreenSessionTitle?: string | undefined;
  fullscreenShowingChat?: boolean | undefined;
  onSelectFullscreenChat?: (() => void) | undefined;
  onSelectWorkbenchTab?: (() => void) | undefined;
}) {
  const workbench = tabProps.workbench;
  const leftOpen = useSyncExternalStore(
    workbench ? workbench.subscribe : () => () => {},
    () => workbench?.getSnapshot().leftSidebarOpen ?? true,
    () => true,
  );
  const leftHint = shortcutHint("global.toggle-left-sidebar");

  return (
    <header className={styles.topHeader}>
      <CapsuleBar className={styles.headerCapsule}>
        {fullscreenSessionTitle && workbench && (
          <PanelToggleButton
            side="left"
            expanded={leftOpen}
            label={leftOpen
              ? (tabProps.isZh ? "收起左二会话项目菜单栏" : "Collapse sidebar")
              : (tabProps.isZh ? "展开左二会话项目菜单栏" : "Expand sidebar")}
            shortcut={leftHint}
            onClick={() => workbench.toggleLeftSidebar()}
          />
        )}
        {fullscreenSessionTitle && onSelectFullscreenChat && (
          <div className={barStyles.fullscreenCrumb}>
            <button
              type="button"
              role="tab"
              aria-selected={Boolean(fullscreenShowingChat)}
              className={barStyles.fullscreenCrumbBtn}
              data-active={fullscreenShowingChat ? "true" : undefined}
              title={tabProps.isZh ? "切换到会话对话" : "Switch to chat"}
              onClick={onSelectFullscreenChat}
            >
              <IconMessageCircle size={13} stroke={1.8} aria-hidden="true" />
              <span className={barStyles.fullscreenCrumbText}>{fullscreenSessionTitle}</span>
            </button>
            <IconChevronRight size={13} stroke={1.8} className={barStyles.fullscreenCrumbSep} aria-hidden="true" />
          </div>
        )}
        <div className={barStyles.tabsHost} onClickCapture={() => { if (fullscreenShowingChat) onSelectWorkbenchTab?.(); }}>
          <WorkbenchTabs {...tabProps} />
        </div>
        <RightWorkbenchActions {...actionProps} />
      </CapsuleBar>
    </header>
  );
}
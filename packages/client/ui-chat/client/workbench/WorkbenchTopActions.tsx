// 渲染右侧工作台顶栏控制按钮组：更多、概览、跟随 Agent、最大化与收起侧面板；提示气泡统一带快捷键徽章。
import {
  IconDotsVertical,
  IconLayoutList,
  IconLayoutSidebarRight,
  IconMaximize,
  IconMinimize,
  IconRobot,
  IconX,
} from "@tabler/icons-react";
import { HoverTip } from "@lfaa/ui-primitives/client";
import { shortcutHint } from "@lfaa/ui-layout/client";
import styles from "./RightWorkbenchActions.module.css";

/** 按 variant 与最大化状态渲染顶栏按钮；菜单开关状态仍由父组件持有。 */
export function WorkbenchTopActions({
  isZh,
  compact,
  rightPanelMaximized,
  followAgentWorkbench,
  menuOpen,
  showSessionControls,
  showPanelControls,
  onToggleMore,
  onToggleOverview,
  onToggleFollowAgent,
  onToggleMaximize,
  onCollapsePanel,
}: {
  isZh: boolean;
  compact: boolean;
  rightPanelMaximized: boolean;
  followAgentWorkbench?: boolean | undefined;
  menuOpen: "more" | "overview" | null;
  showSessionControls: boolean;
  showPanelControls: boolean;
  onToggleMore: () => void;
  onToggleOverview: () => void;
  onToggleFollowAgent?: (() => void) | undefined;
  onToggleMaximize?: (() => void) | undefined;
  onCollapsePanel?: (() => void) | undefined;
}) {
  const maximizeHint = shortcutHint("global.maximize-right-panel");
  const panelHint = shortcutHint("global.toggle-right-panel");
  return (
    <>
      {showSessionControls && (
        <>
          <HoverTip label={isZh ? "更多操作" : "More actions"}>
            <button
              type="button"
              className={`${styles.topIconBtn} ${menuOpen === "more" ? styles.topIconBtnActive : ""}`}
              aria-label={isZh ? "工作台更多选项" : "More workbench options"}
              aria-expanded={menuOpen === "more"}
              onClick={onToggleMore}
            >
              <IconDotsVertical size={15} />
            </button>
          </HoverTip>

          <HoverTip label={isZh ? "切换概览面板" : "Toggle overview"}>
            <button
              type="button"
              className={`${styles.topIconBtn} ${menuOpen === "overview" ? styles.topIconBtnActive : ""}`}
              aria-label={`${isZh ? "切换概览面板" : "Toggle overview"} Ctrl+Alt+O`}
              aria-expanded={menuOpen === "overview"}
              onClick={onToggleOverview}
            >
              <IconLayoutList size={15} />
            </button>
          </HoverTip>
        </>
      )}

      {showPanelControls && onToggleFollowAgent && (
        <HoverTip
          label={followAgentWorkbench
            ? (isZh ? "跟随 Agent：已开启，点击暂停" : "Follow Agent: ON, click to pause")
            : (isZh ? "跟随 Agent：已关闭，点击开启" : "Follow Agent: OFF, click to enable")}
        >
          <button
            type="button"
            className={`${styles.topIconBtn} ${followAgentWorkbench ? styles.followBtnActive : ""}`}
            aria-label={isZh ? "跟随 Agent 自动展开右侧工作台" : "Follow Agent in right workbench"}
            aria-pressed={Boolean(followAgentWorkbench)}
            onClick={onToggleFollowAgent}
          >
            <IconRobot size={15} />
          </button>
        </HoverTip>
      )}

      {showPanelControls && !compact && onToggleMaximize && (
        <HoverTip label={rightPanelMaximized ? (isZh ? "退出全屏视图" : "Exit fullscreen") : (isZh ? "最大化窗格" : "Maximize pane")} shortcut={maximizeHint}>
          <button
            type="button"
            className={rightPanelMaximized ? styles.exitFullscreenBtn : styles.topIconBtn}
            aria-label={`${rightPanelMaximized ? (isZh ? "退出全屏视图" : "Exit fullscreen") : (isZh ? "最大化窗格" : "Maximize pane")}${maximizeHint ? ` ${maximizeHint}` : ""}`}
            aria-pressed={rightPanelMaximized}
            onClick={onToggleMaximize}
          >
            {rightPanelMaximized ? (
              <>
                <IconMinimize size={14} />
                <span>{isZh ? "退出全屏视图" : "Exit fullscreen"}</span>
              </>
            ) : <IconMaximize size={15} />}
          </button>
        </HoverTip>
      )}

      {showPanelControls && !rightPanelMaximized && onCollapsePanel && (
        <HoverTip
          label={compact ? (isZh ? "关闭右侧工作台" : "Close right workbench") : (isZh ? "切换侧面板" : "Toggle right panel")}
          shortcut={compact ? undefined : panelHint}
        >
          <button
            type="button"
            className={styles.topIconBtn}
            aria-label={compact ? (isZh ? "关闭右侧工作台" : "Close right workbench") : `${isZh ? "切换侧面板" : "Toggle right panel"}${panelHint ? ` ${panelHint}` : ""}`}
            onClick={onCollapsePanel}
          >
            {compact ? <IconX size={15} /> : <IconLayoutSidebarRight size={15} />}
          </button>
        </HoverTip>
      )}
    </>
  );
}
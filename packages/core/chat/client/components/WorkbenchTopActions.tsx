// 渲染右侧工作台顶栏控制按钮组：更多、概览、最大化与收起侧面板。
import {
  IconDotsVertical,
  IconLayoutList,
  IconLayoutSidebarRight,
  IconMaximize,
  IconMinimize,
  IconX,
} from "@tabler/icons-react";
import styles from "./RightWorkbenchActions.module.css";

/** 按 variant 与最大化状态渲染顶栏按钮；菜单开关状态仍由父组件持有。 */
export function WorkbenchTopActions({
  isZh,
  compact,
  rightPanelMaximized,
  menuOpen,
  showSessionControls,
  showPanelControls,
  onToggleMore,
  onToggleOverview,
  onToggleMaximize,
  onCollapsePanel,
}: {
  isZh: boolean;
  compact: boolean;
  rightPanelMaximized: boolean;
  menuOpen: "more" | "overview" | null;
  showSessionControls: boolean;
  showPanelControls: boolean;
  onToggleMore: () => void;
  onToggleOverview: () => void;
  onToggleMaximize?: (() => void) | undefined;
  onCollapsePanel?: (() => void) | undefined;
}) {
  return (
    <>
      {showSessionControls && (
        <>
          <button
            type="button"
            className={`${styles.topIconBtn} ${menuOpen === "more" ? styles.topIconBtnActive : ""}`}
            aria-label={isZh ? "工作台更多选项" : "More workbench options"}
            aria-expanded={menuOpen === "more"}
            title={isZh ? "更多操作" : "More actions"}
            onClick={onToggleMore}
          >
            <IconDotsVertical size={15} />
          </button>

          <button
            type="button"
            className={`${styles.topIconBtn} ${menuOpen === "overview" ? styles.topIconBtnActive : ""}`}
            aria-label={isZh ? "切换概览面板 Ctrl+Alt+O" : "Toggle overview Ctrl+Alt+O"}
            aria-expanded={menuOpen === "overview"}
            title={isZh ? "切换概览面板 Ctrl+Alt+O" : "Toggle overview (Ctrl+Alt+O)"}
            onClick={onToggleOverview}
          >
            <IconLayoutList size={15} />
          </button>
        </>
      )}

      {showPanelControls && !compact && onToggleMaximize && (
        <button
          type="button"
          className={`${styles.topIconBtn} ${rightPanelMaximized ? styles.topIconBtnActive : ""}`}
          aria-label={rightPanelMaximized ? (isZh ? "还原窗格 Ctrl+Shift+M" : "Restore pane") : (isZh ? "最大化窗格 Ctrl+Shift+M" : "Maximize pane")}
          aria-pressed={rightPanelMaximized}
          title={rightPanelMaximized ? (isZh ? "还原窗格 Ctrl+Shift+M" : "Restore pane (Ctrl+Shift+M)") : (isZh ? "最大化窗格 Ctrl+Shift+M" : "Maximize pane (Ctrl+Shift+M)")}
          onClick={onToggleMaximize}
        >
          {rightPanelMaximized ? <IconMinimize size={15} /> : <IconMaximize size={15} />}
        </button>
      )}

      {showPanelControls && onCollapsePanel && (
        <button
          type="button"
          className={styles.topIconBtn}
          aria-label={compact ? (isZh ? "关闭右侧工作台" : "Close right workbench") : (isZh ? "切换侧面板 Ctrl+Shift+B" : "Toggle right panel")}
          title={compact ? (isZh ? "关闭右侧工作台" : "Close") : (isZh ? "切换侧面板 Ctrl+Shift+B" : "Toggle right panel (Ctrl+Shift+B)")}
          onClick={onCollapsePanel}
        >
          {compact ? <IconX size={15} /> : <IconLayoutSidebarRight size={15} />}
        </button>
      )}
    </>
  );
}
// 注册四栏 Shell 全局键盘快捷键（搜索 Ctrl+K、活动 Ctrl+Alt+U、右栏开关/最大化与 Esc 收起）。
import { useEffect } from "react";

/** 绑定全局快捷键，卸载时自动移除监听。 */
export function useShellShortcuts({
  hasRightColumn,
  isCompact,
  leftSidebarOpen,
  rightPanelOpen,
  onOpenSearch,
  onOpenActivity,
  onCloseOverlays,
  onToggleRightPanel,
  onToggleRightMaximized,
  onCloseCompactDrawers,
}: {
  hasRightColumn: boolean;
  isCompact: boolean;
  leftSidebarOpen: boolean;
  rightPanelOpen: boolean;
  onOpenSearch: () => void;
  onOpenActivity: () => void;
  onCloseOverlays: () => void;
  onToggleRightPanel: () => void;
  onToggleRightMaximized: () => void;
  onCloseCompactDrawers: () => void;
}) {
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenSearch();
      } else if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "u") {
        event.preventDefault();
        onOpenActivity();
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "b") {
        if (hasRightColumn) {
          event.preventDefault();
          onToggleRightPanel();
        }
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "m") {
        if (hasRightColumn && !isCompact) {
          event.preventDefault();
          onToggleRightMaximized();
        }
      } else if (event.key === "Escape") {
        onCloseOverlays();
        if (isCompact && (leftSidebarOpen || rightPanelOpen)) {
          onCloseCompactDrawers();
        }
      }
    };
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, [
    hasRightColumn,
    isCompact,
    leftSidebarOpen,
    rightPanelOpen,
    onOpenSearch,
    onOpenActivity,
    onCloseOverlays,
    onToggleRightPanel,
    onToggleRightMaximized,
    onCloseCompactDrawers,
  ]);
}

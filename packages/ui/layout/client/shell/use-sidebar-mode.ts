// 左二内容模式（会话列表 / 项目工作区）的本地状态与持久化，避免 Shell 主组件继续膨胀。
import { useCallback, useState } from "react";
import { readSidebarModePref, writeSidebarModePref, type SidebarMode } from "./ui-preferences";

/** 返回当前模式与切换函数；切换即写回偏好，刷新后保持。 */
export function useSidebarMode(): [SidebarMode, (mode: SidebarMode) => void] {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => readSidebarModePref());
  const changeSidebarMode = useCallback((next: SidebarMode) => {
    setSidebarMode(next);
    writeSidebarModePref(next);
  }, []);
  return [sidebarMode, changeSidebarMode];
}
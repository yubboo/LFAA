/**
 * 功能：提供 Client 工作区共用的中间区标题栏。
 * 作用：统一左侧入口、当前页面标题、中间模式槽和右侧操作槽的结构。
 * 负责：标题栏语义结构、响应式数据属性与共享样式。
 * 不负责：栏位开合状态、页面路由、业务动作和用户设置持久化。
 * 状态归属：受控展示组件，无内部状态。
 * 对外接口：WorkbenchHeader、WorkbenchHeaderProps。
 * 关联文件：ApplicationWorkspace、FileManagerPage 与 ui-primitives/WorkbenchHeader.css。
 */
import type { ReactNode } from "react";
import "./WorkbenchHeader.css";

export interface WorkbenchHeaderProps {
  children: ReactNode;
  layoutMode?: string;
  moduleMode?: string;
  className?: string;
}

export function WorkbenchHeader({
  children,
  layoutMode,
  moduleMode,
  className = ""
}: WorkbenchHeaderProps) {
  return (
    <header
      className={["lfaa-workbench-header", className].filter(Boolean).join(" ")}
      data-layout-mode={layoutMode}
      data-module-mode={moduleMode}
    >
      {children}
    </header>
  );
}

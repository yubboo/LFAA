// 组合四栏 Shell 右栏：拖拽宽度手柄与插件上下文面板。
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import type { WorkbenchContextPanelContribution } from "../../contract/index";
import type { LocaleMessages } from "../locales";
import type { ResizeSide } from "./useSidebarResize";
import { ContextPanel } from "../panels/ContextPanel";
import { SidebarResizeHandle } from "./SidebarResizeHandle";

/** 按右栏展开与最大化状态渲染拖拽手柄和上下文面板，状态由 Shell 根组件持有。 */
export function ShellRightColumn({
  locale,
  panels,
  projectContext,
  compact,
  showPanel,
  rightPanelMaximized,
  dragging,
  snapped,
  onStartResize,
  onKeyResize,
  onToggleMaximize,
  onClosePanel,
}: {
  locale: LocaleMessages;
  panels: WorkbenchContextPanelContribution<ReactNode>[];
  projectContext: ReactNode | null;
  compact: boolean;
  showPanel: boolean;
  rightPanelMaximized: boolean;
  dragging: boolean;
  snapped: boolean;
  onStartResize: (side: ResizeSide, event: PointerEvent<HTMLDivElement>) => void;
  onKeyResize: (side: ResizeSide, event: KeyboardEvent<HTMLDivElement>) => void;
  onToggleMaximize: () => void;
  onClosePanel: () => void;
}) {
  return (
    <>
      {!compact && showPanel && !rightPanelMaximized && (
        <SidebarResizeHandle
          side="right"
          label={locale.resizeRightPanel}
          dragging={dragging}
          snapped={snapped}
          onStartResize={onStartResize}
          onKeyResize={onKeyResize}
        />
      )}

      {showPanel && (
        <ContextPanel
          locale={locale}
          panels={panels}
          projectContext={projectContext}
          compact={compact}
          rightPanelMaximized={rightPanelMaximized}
          onToggleMaximizeRightPanel={onToggleMaximize}
          onCollapseRightPanel={onClosePanel}
          onCloseDrawer={onClosePanel}
        />
      )}
    </>
  );
}
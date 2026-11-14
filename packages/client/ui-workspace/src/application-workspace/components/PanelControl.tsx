/**
 * 文件：PanelControl.tsx
 * 功能：呈现工作区终端与上下文栏的共享开合按钮。
 * 作用：只映射名称、快捷键和 active 状态，不持有面板状态。
 * 关联文件：./ApplicationCenterWorkspace.tsx、../../module-workbench.css。
 */
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

export function PanelControl({ name, title, shortcut, active, onClick }: { name: "terminal" | "panelRight"; title: string; shortcut: string; active: boolean; onClick: () => void }) {
  const ariaShortcuts = shortcut.split(" / ").map((chord) => chord.replace("Ctrl", "Control")).join(" ");
  return <button className="module-panel-control" type="button" aria-label={title} aria-keyshortcuts={ariaShortcuts} aria-pressed={active} title={`${title} · ${shortcut || "未分配"}`} onClick={onClick}><WorkbenchIcon name={name} size={16} /><span>{title}</span></button>;
}

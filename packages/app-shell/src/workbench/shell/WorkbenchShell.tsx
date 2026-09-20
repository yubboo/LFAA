/**
 * 文件：WorkbenchShell.tsx
 * 作用：Left / Center / Right / Bottom 的几何总装配。
 * 负责：ResizableWorkbench 受控接线与收起左栏 Hover Preview。
 * 不负责：各区域内部 DOM/样式、Settings、Provider、Agent Run 业务。
 */
import type { CSSProperties,ReactNode } from "react";
import { ResizableWorkbench } from "@lfaa/ui";
import type { WorkbenchChromeController } from "./useWorkbenchChromeController";
import styles from "./WorkbenchShell.module.css";
export function WorkbenchShell({chrome,suspended,left,center,right,bottom,overlays}:{chrome:WorkbenchChromeController;suspended:boolean;left:ReactNode;center:ReactNode;right:ReactNode;bottom:ReactNode;overlays?:ReactNode}){
  const {layout,layoutMode}=chrome;
  return <div ref={chrome.stageRef} className={`${styles.stage}${suspended?` ${styles.suspended}`:""}`} aria-hidden={suspended} style={{"--agent-left-preview-width":`${chrome.leftPaneWidth}px`,"--agent-left-live-width":`${chrome.leftPaneWidth}px`} as CSSProperties} data-ui="workbench-shell">
    {chrome.chrome.leftCollapsed?<div className={`${styles.leftPreview}${chrome.leftPreviewOpen?` ${styles.leftPreviewVisible}`:""}`} data-layout-mode={layoutMode} onMouseEnter={chrome.openLeftPreview} onMouseLeave={()=>chrome.closeLeftPreview(120)}>{left}</div>:null}
    <ResizableWorkbench left={left} center={center} right={right} bottom={bottom} bottomOpen={chrome.chrome.terminalOpen} layoutMode={layoutMode} leftWidth={chrome.leftPaneWidth} leftLimits={layout.left} rightLimits={layout.right} bottomLimits={layout.bottom} snapCaptureRatio={layout.snapCaptureRatio} snapHysteresis={layout.snapHysteresis} minCenterWidth={layout.minCenterWidth} leftCollapsed={chrome.chrome.leftCollapsed} onLeftWidthChange={chrome.setLeftPaneWidth} rightCollapsed={chrome.chrome.rightCollapsed} onLeftCollapsedChange={chrome.setLeftCollapsed} onRightCollapsedChange={chrome.setRightCollapsed} onBottomOpenChange={chrome.setTerminalOpen}/>
    {overlays}
  </div>;
}

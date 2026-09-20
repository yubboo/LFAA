/** Composer 的“+”能力菜单。只拥有本菜单的 dismiss layer；能力执行仍由 Runtime/Host。 */
import { useDismissibleLayer } from "@lfaa/ui";
import { WorkbenchIcon } from "../center-dependencies";
import type { LayoutMode } from "../center-dependencies";
import styles from "./AddCapabilityMenu.module.css";

const entries = [
  ["file","文件","把文件加入当前任务上下文"], ["folder","文件夹","选择工作区资源"], ["tools","工具与技能","从 Capability Registry 按需装配"], ["browser","浏览器","使用浏览器能力完成任务"],
] as const;

export function AddCapabilityMenu({ open, layoutMode, onOpenChange, onChoose }: { open:boolean; layoutMode:LayoutMode; onOpenChange:(open:boolean)=>void; onChoose:(label:string)=>void; }) {
  const ref=useDismissibleLayer<HTMLDivElement>({open,onDismiss:()=>onOpenChange(false)});
  return <div className={styles.anchor} data-layout-mode={layoutMode} ref={ref}>
    <button className={styles.icon} type="button" aria-label="添加能力或附件" aria-expanded={open} onClick={()=>onOpenChange(!open)}><WorkbenchIcon name="plus"/></button>
    {open?<div className={styles.popover} role="menu">{entries.map(([icon,label,description])=><button key={label} type="button" role="menuitem" onClick={()=>{onOpenChange(false);onChoose(label);}}><WorkbenchIcon name={icon} size={17}/><span><strong>{label}</strong><small>{description}</small></span></button>)}</div>:null}
  </div>;
}

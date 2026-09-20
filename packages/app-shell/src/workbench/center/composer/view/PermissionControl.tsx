/** Composer 权限模式选择。权限真值来自 Agent Runtime profile contract。 */
import { AGENT_PERMISSION_PROFILES, type AgentPermissionProfileId } from "@lfaa/agent-runtime";
import { useDismissibleLayer } from "@lfaa/ui";
import { WorkbenchIcon } from "#center/contracts";
import type { LayoutMode } from "#center/contracts";
import styles from "../styles/PermissionControl.module.css";

export function PermissionControl({ open, layoutMode, value, onOpenChange, onChange }: { open:boolean; layoutMode:LayoutMode; value:AgentPermissionProfileId; onOpenChange:(open:boolean)=>void; onChange:(value:AgentPermissionProfileId)=>void; }) {
  const ref=useDismissibleLayer<HTMLDivElement>({open,onDismiss:()=>onOpenChange(false)});
  return <div className={styles.anchor} data-layout-mode={layoutMode} ref={ref}>
    <button className={styles.button} data-permission-profile={value} type="button" aria-label="权限模式" aria-expanded={open} title="权限模式 · Ctrl+Shift+P" onClick={()=>onOpenChange(!open)}>
      <WorkbenchIcon name={value==="full-access"?"shield":value==="approve-for-me"?"spark":"review"} size={15}/><span>{AGENT_PERMISSION_PROFILES[value].label}</span><WorkbenchIcon name="chevron" size={12}/>
    </button>
    {open?<div className={styles.menu} role="menu" aria-label="权限模式"><div className={styles.header}><strong>如何审批 LFAA 操作？</strong><span>选择本次任务的执行边界</span></div>
      {(Object.keys(AGENT_PERMISSION_PROFILES) as AgentPermissionProfileId[]).map((id)=>{const profile=AGENT_PERMISSION_PROFILES[id];return <button className={id===value?styles.active:""} data-permission-profile={id} key={id} type="button" role="menuitemradio" aria-checked={id===value} onClick={()=>{onChange(id);onOpenChange(false);}}><span className={styles.icon}><WorkbenchIcon name={id==="full-access"?"shield":id==="approve-for-me"?"spark":"review"} size={16}/></span><span><strong>{profile.label}</strong><small>{profile.description}</small></span><span className={styles.check}>{id===value?"✓":""}</span></button>;})}
    </div>:null}
  </div>;
}

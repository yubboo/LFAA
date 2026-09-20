/**
 * Composer 父模块。只拥有 draft/submitting/notice 与三个子菜单的开合协调。
 * Permission / Add / RuntimeControl 各自拥有自己的 DOM、样式和内部状态。
 */
import { useState } from "react";
import type { AgentExecutionHints, AgentPermissionProfileId, AgentRunHandle, AgentSurfaceMode } from "@lfaa/agent-runtime";
import type { AiModelSettingValue } from "@lfaa/config-system";
import { useShortcut } from "@lfaa/ui";
import type { ActiveReasoningControl, LayoutMode, QuickModelOption } from "#center/contracts";
import { AddCapabilityMenu } from "./AddCapabilityMenu";
import { PermissionControl } from "./PermissionControl";
import { RuntimeControl, useRuntimeControlController } from "../runtime-control";
import styles from "../styles/Composer.module.css";

export function ComposerRegion({ layoutMode, agentSurface, permissionProfileId, modelLabel, quickModels, activeReasoning, runtimeConnected, onPermissionProfileChange, onSubmitTask, onQuickSelectModel, onQuickUpdateModelSetting, onOpenAiSettings }: {
  layoutMode: LayoutMode;
  agentSurface: AgentSurfaceMode;
  permissionProfileId: AgentPermissionProfileId;
  modelLabel: string;
  quickModels: readonly QuickModelOption[];
  activeReasoning: ActiveReasoningControl | null;
  runtimeConnected: boolean;
  onPermissionProfileChange: (profileId: AgentPermissionProfileId) => void;
  onSubmitTask: (input: string, executionHints?: AgentExecutionHints, modelSettingOverrides?: Readonly<Record<string, AiModelSettingValue>>) => Promise<AgentRunHandle>;
  onQuickSelectModel: (accountId: string, modelId: string) => Promise<void>;
  onQuickUpdateModelSetting: (fieldId: string, value: AiModelSettingValue) => Promise<void>;
  onOpenAiSettings: () => void;
}) {
  const [draft,setDraft]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [runNotice,setRunNotice]=useState<string|null>(null);
  const [permissionMenuOpen,setPermissionMenuOpen]=useState(false);
  const [addMenuOpen,setAddMenuOpen]=useState(false);
  const [runtimeControlOpen,setRuntimeControlOpen]=useState(false);
  const runtimeController=useRuntimeControlController({activeReasoning,onQuickSelectModel,onQuickUpdateModelSetting,onNotice:setRunNotice});

  const closeRuntime=()=>{setRuntimeControlOpen(false);runtimeController.closeModelPicker();runtimeController.setReasoningPreviewIndex(null);};
  const openAdd=(open:boolean)=>{setAddMenuOpen(open);if(open){setPermissionMenuOpen(false);closeRuntime();}};
  const openPermission=(open:boolean)=>{setPermissionMenuOpen(open);if(open){setAddMenuOpen(false);closeRuntime();}};
  const openRuntime=(open:boolean)=>{setAddMenuOpen(false);setPermissionMenuOpen(false);setRuntimeControlOpen(open);if(!open){runtimeController.closeModelPicker();runtimeController.setReasoningPreviewIndex(null);}};

  useShortcut({key:"m",ctrl:true,shift:true},()=>{setAddMenuOpen(false);setPermissionMenuOpen(false);if(quickModels.length===0){onOpenAiSettings();return;}openRuntime(!runtimeControlOpen);});
  useShortcut({key:"p",ctrl:true,shift:true},()=>{setAddMenuOpen(false);closeRuntime();setPermissionMenuOpen((value)=>!value);});

  const submitTask=async()=>{
    const input=draft.trim();
    if(!input||!runtimeConnected||modelLabel==="未配置模型"||submitting)return;
    setSubmitting(true);setRunNotice(null);
    try{
      const {executionHints,modelSettingOverrides}=runtimeController.executionContext;
      const handle=await onSubmitTask(input,executionHints,modelSettingOverrides);
      setDraft("");setRunNotice(`Run 已启动 · ${handle.runId}`);
    }catch(error){setRunNotice(error instanceof Error?error.message:"Runtime 启动失败。");}
    finally{setSubmitting(false);}
  };

  return <div className={styles.wrap} data-layout-mode={layoutMode} data-agent-surface={agentSurface} data-ui="composer">
    <div className={styles.composer}>
      <textarea aria-label="输入任务" placeholder={agentSurface==="chat"?"一句话交代任务":"描述目标，Runtime 会把执行过程投影到画布"} rows={1} value={draft} onChange={(event)=>setDraft(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void submitTask();}}}/>
      <div className={styles.actions}>
        <AddCapabilityMenu open={addMenuOpen} layoutMode={layoutMode} onOpenChange={openAdd} onChoose={(label)=>setRunNotice(`${label}入口已就绪；实际能力由 Runtime/Host 提供。`)}/>
        <PermissionControl open={permissionMenuOpen} layoutMode={layoutMode} value={permissionProfileId} onOpenChange={openPermission} onChange={onPermissionProfileChange}/>
        <RuntimeControl open={runtimeControlOpen} layoutMode={layoutMode} onOpenChange={openRuntime} modelLabel={modelLabel} quickModels={quickModels} activeReasoning={activeReasoning} controller={runtimeController} onOpenAiSettings={()=>{setAddMenuOpen(false);setPermissionMenuOpen(false);closeRuntime();onOpenAiSettings();}}/>
        <button className={styles.send} type="button" aria-label="发送" disabled={!runtimeConnected||modelLabel==="未配置模型"||submitting||!draft.trim()} onClick={()=>{void submitTask();}}>{submitting?"…":"↑"}</button>
      </div>
    </div>
    {runNotice?<div className={styles.notice} role="status">{runNotice}</div>:null}
  </div>;
}

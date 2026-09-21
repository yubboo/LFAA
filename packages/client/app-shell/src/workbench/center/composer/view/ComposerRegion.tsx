/**
 * 文件：ComposerRegion.tsx
 * 作用：Chat/Work 共用 Agent Composer，并为 Manual 提供不依赖模型的手动工具栏。
 * 负责：draft/submitting/notice、三个子菜单协调、Manual 工具入口。
 * 不负责：Agent Runtime 实现、模型 Provider、PTY 生命周期、Canvas 状态。
 * 状态归属：Composer 局部 UI 状态；Agent/Manual 真值分别归 Runtime 与 Tool Host。
 * 对外接口：ComposerRegion。
 * 关联文件：RuntimeControl、PermissionControl、@lfaa/workspace。
 * 修改注意事项：Chat/Work 必须走同一个 onSubmitTask；Manual 不得因为未配置模型而被禁用。
 */
import { useState } from "react";
import type { AgentExecutionHints, AgentPermissionProfileId, AgentRunHandle } from "@lfaa/agent-runtime";
import type { AiModelSettingValue } from "@lfaa/config-system";
import type { WorkspaceMode } from "@lfaa/workspace";
import { useShortcut } from "@lfaa/ui";
import type { ActiveReasoningControl, LayoutMode, QuickModelOption } from "#center/contracts";
import { AddCapabilityMenu } from "./AddCapabilityMenu";
import { PermissionControl } from "./PermissionControl";
import { RuntimeControl, useRuntimeControlController } from "../runtime-control";
import styles from "../styles/Composer.module.css";

export function ComposerRegion({ layoutMode, workspaceMode, permissionProfileId, modelLabel, quickModels, activeReasoning, runtimeConnected, automationReady, onPermissionProfileChange, onSubmitTask, onQuickSelectModel, onQuickUpdateModelSetting, onOpenAiSettings, onToggleTerminal }: {
  layoutMode: LayoutMode;
  workspaceMode: WorkspaceMode;
  permissionProfileId: AgentPermissionProfileId;
  modelLabel: string;
  quickModels: readonly QuickModelOption[];
  activeReasoning: ActiveReasoningControl | null;
  runtimeConnected: boolean;
  automationReady: boolean;
  onPermissionProfileChange: (profileId: AgentPermissionProfileId) => void;
  onSubmitTask: (input: string, executionHints?: AgentExecutionHints, modelSettingOverrides?: Readonly<Record<string, AiModelSettingValue>>) => Promise<AgentRunHandle>;
  onQuickSelectModel: (accountId: string, modelId: string) => Promise<void>;
  onQuickUpdateModelSetting: (fieldId: string, value: AiModelSettingValue) => Promise<void>;
  onOpenAiSettings: () => void;
  onToggleTerminal: () => void;
}) {
  const [draft,setDraft]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [runNotice,setRunNotice]=useState<string|null>(null);
  const [permissionMenuOpen,setPermissionMenuOpen]=useState(false);
  const [addMenuOpen,setAddMenuOpen]=useState(false);
  const [runtimeControlOpen,setRuntimeControlOpen]=useState(false);
  const runtimeController=useRuntimeControlController({activeReasoning,onQuickSelectModel,onQuickUpdateModelSetting,onNotice:setRunNotice});

  const manual = workspaceMode === "manual";
  const closeRuntime=()=>{setRuntimeControlOpen(false);runtimeController.closeModelPicker();runtimeController.setReasoningPreviewIndex(null);};
  const openAdd=(open:boolean)=>{setAddMenuOpen(open);if(open){setPermissionMenuOpen(false);closeRuntime();}};
  const openPermission=(open:boolean)=>{setPermissionMenuOpen(open);if(open){setAddMenuOpen(false);closeRuntime();}};
  const openRuntime=(open:boolean)=>{setAddMenuOpen(false);setPermissionMenuOpen(false);setRuntimeControlOpen(open);if(!open){runtimeController.closeModelPicker();runtimeController.setReasoningPreviewIndex(null);}};

  useShortcut({key:"m",ctrl:true,shift:true},()=>{if(manual)return;setAddMenuOpen(false);setPermissionMenuOpen(false);if(quickModels.length===0){onOpenAiSettings();return;}openRuntime(!runtimeControlOpen);});
  useShortcut({key:"p",ctrl:true,shift:true},()=>{if(manual)return;setAddMenuOpen(false);closeRuntime();setPermissionMenuOpen((value)=>!value);});

  const submitTask=async()=>{
    const input=draft.trim();
    if(manual||!input||!automationReady||modelLabel==="未配置模型"||submitting)return;
    setSubmitting(true);setRunNotice(null);
    try{
      const {executionHints,modelSettingOverrides}=runtimeController.executionContext;
      const handle=await onSubmitTask(input,executionHints,modelSettingOverrides);
      setDraft("");setRunNotice(`Run 已启动 · ${handle.runId}`);
    }catch(error){setRunNotice(error instanceof Error?error.message:"Runtime 启动失败。");}
    finally{setSubmitting(false);}
  };

  if (manual) {
    return <div className={`${styles.wrap} ${styles.manualWrap}`} data-layout-mode={layoutMode} data-workspace-mode="manual" data-ui="manual-controls">
      <div className={styles.manualBar}>
        <div className={styles.manualCopy}><strong>完全手动</strong><span>不调用模型，不消耗模型额度；画布与工具由你直接操作。</span></div>
        <div className={styles.manualActions}>
          <button type="button" onClick={onToggleTerminal}>终端</button>
          <button type="button" onClick={()=>setRunNotice("更多手动工具会从统一 Runtime Registry 按真实注册状态出现，不做假入口。")}>工具说明</button>
        </div>
      </div>
      {runNotice?<div className={styles.notice} role="status">{runNotice}</div>:null}
    </div>;
  }

  return <div className={styles.wrap} data-layout-mode={layoutMode} data-workspace-mode={workspaceMode} data-ui="composer">
    <div className={styles.composer}>
      <textarea aria-label="输入任务" placeholder={workspaceMode==="chat"?"一句话交代任务，Agent 会自动完成并交付":"描述目标；Agent 会在无限画布中执行，你可以随时调整画布或继续对话干预"} rows={1} value={draft} onChange={(event)=>setDraft(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void submitTask();}}}/>
      <div className={styles.actions}>
        <AddCapabilityMenu open={addMenuOpen} layoutMode={layoutMode} onOpenChange={openAdd} onChoose={(label)=>setRunNotice(`${label}入口已就绪；实际能力由统一 Runtime/Host 提供。`)}/>
        <PermissionControl open={permissionMenuOpen} layoutMode={layoutMode} value={permissionProfileId} onOpenChange={openPermission} onChange={onPermissionProfileChange}/>
        <RuntimeControl open={runtimeControlOpen} layoutMode={layoutMode} onOpenChange={openRuntime} modelLabel={modelLabel} quickModels={quickModels} activeReasoning={activeReasoning} controller={runtimeController} onOpenAiSettings={()=>{setAddMenuOpen(false);setPermissionMenuOpen(false);closeRuntime();onOpenAiSettings();}}/>
        <button className={styles.send} type="button" aria-label="发送" disabled={!automationReady||modelLabel==="未配置模型"||submitting||!draft.trim()} onClick={()=>{void submitTask();}}>{submitting?"…":"↑"}</button>
      </div>
    </div>
    {!runtimeConnected?<div className={styles.notice} role="status">Agent Runtime 未连接；你仍可切换到手动模式使用本地工具。</div>:runNotice?<div className={styles.notice} role="status">{runNotice}</div>:null}
  </div>;
}

/**
 * 文件：useAgentSessionController.ts
 * 作用：Chat/Work Run 状态唯一 Owner。
 * 负责：surface、permission、chat projection、work nodes、Runtime event subscription、startRun。
 * 不负责：模型账户配置、Composer draft、Shell chrome、UI 布局。
 */
import { useEffect,useState } from "react";
import type { AgentExecutionHints,AgentModelBinding,AgentPermissionProfileId,AgentRunHandle,AgentRuntimeEvent,AgentRuntimeHost,AgentSurfaceMode } from "@lfaa/agent-runtime";
import type { AiModelSettingValue } from "@lfaa/config-system";
import type { InfiniteCanvasNode } from "@lfaa/ui";
import type { ChatProjectionMessage } from "../contracts";
const AGENT_SURFACE_KEY="lfaa.agent.surface.v1";
const AGENT_PERMISSION_KEY="lfaa.agent.permission-profile.v1";
const INITIAL_WORK_NODES:readonly InfiniteCanvasNode[]=[
  {id:"goal",kind:"goal",title:"一句话目标",description:"用户目标进入同一个 Agent Runtime。",status:"idle",x:40,y:70},
  {id:"agent",kind:"agent",title:"主智能体",description:"使用当前配置模型推理、规划并调度能力。",status:"idle",x:370,y:70},
  {id:"tools",kind:"tool",title:"Tools / Skills",description:"工具、技能、专家、命令与 MCP 按需装配。",status:"idle",x:700,y:-20},
  {id:"subagent",kind:"agent",title:"子智能体",description:"按 Harness Provider 委派并行任务。",status:"idle",x:700,y:150},
  {id:"result",kind:"artifact",title:"最终产物",description:"文件、代码、报告与可验证结果回到同一 Run。",status:"idle",x:1030,y:70},
];
function initialAgentSurface():AgentSurfaceMode { if(typeof window==="undefined")return "chat"; return window.localStorage.getItem(AGENT_SURFACE_KEY)==="work"?"work":"chat"; }
function initialPermissionProfile():AgentPermissionProfileId { if(typeof window==="undefined")return "ask"; const stored=window.localStorage.getItem(AGENT_PERMISSION_KEY); return stored==="approve-for-me"||stored==="full-access"?stored:"ask"; }
export function useAgentSessionController({runtimeHost,workspaceId,activeModelBinding}:{runtimeHost:AgentRuntimeHost|undefined;workspaceId:string|undefined;activeModelBinding:AgentModelBinding|null}){
  const [agentSurface,setAgentSurface]=useState<AgentSurfaceMode>(initialAgentSurface);
  const [permissionProfileId,setPermissionProfileId]=useState<AgentPermissionProfileId>(initialPermissionProfile);
  const [workNodes,setWorkNodes]=useState<readonly InfiniteCanvasNode[]>(INITIAL_WORK_NODES);
  const [chatMessages,setChatMessages]=useState<readonly ChatProjectionMessage[]>([]);
  useEffect(()=>{window.localStorage.setItem(AGENT_SURFACE_KEY,agentSurface);},[agentSurface]);
  useEffect(()=>{window.localStorage.setItem(AGENT_PERMISSION_KEY,permissionProfileId);},[permissionProfileId]);
  useEffect(()=>{if(!runtimeHost)return;return runtimeHost.subscribe((event:AgentRuntimeEvent)=>{if(event.type==="assistant.completed")setChatMessages((messages)=>[...messages,{id:`${event.runId}:assistant`,role:"assistant",text:event.text,runId:event.runId}]);else if(event.type==="run.failed")setChatMessages((messages)=>[...messages,{id:`${event.runId}:error`,role:"error",text:event.error,runId:event.runId}]);else if(event.type==="run.cancelled")setChatMessages((messages)=>[...messages,{id:`${event.runId}:cancelled`,role:"error",text:"本次 Run 已取消。",runId:event.runId}]);});},[runtimeHost]);
  const startAgentRun=async(input:string,executionHints?:AgentExecutionHints,modelSettingOverrides?:Readonly<Record<string,AiModelSettingValue>>):Promise<AgentRunHandle>=>{
    if(!runtimeHost)throw new Error("Agent Runtime Host 未连接。");
    if(!activeModelBinding)throw new Error("请先在设置中配置并选择模型。");
    const runModelBinding:AgentModelBinding=modelSettingOverrides?{...activeModelBinding,settings:{...(activeModelBinding.settings??{}),...modelSettingOverrides}}:activeModelBinding;
    if(agentSurface==="chat")setChatMessages((messages)=>[...messages,{id:`user:${Date.now()}:${messages.length}`,role:"user",text:input}]);
    const handle=await runtimeHost.startRun({surface:agentSurface,input,model:runModelBinding,permissionProfileId,...(executionHints?{executionHints}:{}),workspaceId:workspaceId??"lfaa"});
    setWorkNodes((nodes)=>nodes.map((node)=>node.id==="goal"?{...node,description:input,status:"done" as const}:node.id==="agent"?{...node,status:"running" as const}:node));
    return handle;
  };
  return {agentSurface,setAgentSurface,permissionProfileId,setPermissionProfileId,workNodes,setWorkNodes,chatMessages,startAgentRun,runtimeConnected:Boolean(runtimeHost)};
}
export type AgentSessionController=ReturnType<typeof useAgentSessionController>;

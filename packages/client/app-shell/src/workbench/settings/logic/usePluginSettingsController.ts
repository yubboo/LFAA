/** Plugin Settings 的唯一 App-Shell 状态 Owner。 */
import { useEffect,useState } from "react";
import type { PluginManagerSnapshot } from "@lfaa/plugin-runtime";
import type { AgentPluginSettingsHost } from "#workbench/contracts";
import { mapInstalledPlugin,mapPluginInspection,mapPluginInstallOutcome } from "./settings-view-models";
const EMPTY:PluginManagerSnapshot={installed:[],registry:{generation:0,plugins:new Map(),capabilities:new Map()}};
export function usePluginSettingsController(host:AgentPluginSettingsHost|undefined){
  const [snapshot,setSnapshot]=useState<PluginManagerSnapshot>(EMPTY); const [hostAvailable,setHostAvailable]=useState(Boolean(host));
  useEffect(()=>{let cancelled=false;if(!host){setHostAvailable(false);return;}host.snapshot().then((next)=>{if(cancelled)return;setSnapshot(next);setHostAvailable(true);}).catch(()=>{if(!cancelled)setHostAvailable(false);});return()=>{cancelled=true;};},[host]);
  const requireHost=()=>{if(!host)throw new Error("当前宿主未提供 Plugin Manager 桥。");return host;};
  return {snapshot,hostAvailable,installed:snapshot.installed.map(mapInstalledPlugin),inspect:async(spec:string)=>mapPluginInspection(await requireHost().inspect(spec)),install:async(spec:string,requestId:string,approvedBuilds?:readonly string[])=>{const result=await requireHost().install(spec,requestId,approvedBuilds);setSnapshot(result.snapshot);return mapPluginInstallOutcome(result.outcome);},setEnabled:async(packageName:string,enabled:boolean)=>setSnapshot(await requireHost().setEnabled(packageName,enabled)),remove:async(packageName:string)=>setSnapshot(await requireHost().remove(packageName)),cancel:async(requestId:string)=>requireHost().cancel(requestId)};
}
export type PluginSettingsController=ReturnType<typeof usePluginSettingsController>;

/** AI Settings / Model ViewModel 映射的唯一 App-Shell 状态 Owner。 */
import { useEffect,useMemo,useState } from "react";
import type { AgentModelBinding } from "@lfaa/agent-runtime";
import { builtinAiProviderPlugins, type AiAccountSnapshot, type AiModelSettingValue } from "@lfaa/config-system";
import type { AiSettingsDraftInput } from "@lfaa/ui";
import type { AgentAiSettingsHost } from "#workbench/contracts";
import type { ActiveReasoningControl, QuickModelOption } from "#workbench/contracts";
import { buildAiProviderViews,mapAiAccount,mapAiProbe,toAiAccountDraft } from "./settings-view-models";

const EMPTY_SNAPSHOT:AiAccountSnapshot={accounts:[],activeModel:null,secretPersistence:"memory",hostCapabilities:{"codex-app-server":{available:false,reason:"正在检查 Codex App Server…"}}};
function formatReasoningEffort(value:unknown):string|null { if(typeof value!=="string"||!value.trim()) return null; const labels:Readonly<Record<string,string>>={none:"关",disabled:"关",enabled:"开",low:"低",medium:"中",high:"高",xhigh:"极高",max:"最大"}; return labels[value]??value; }

export function useAiSettingsController(host:AgentAiSettingsHost|undefined) {
  const [selectedProviderId,setSelectedProviderId]=useState(builtinAiProviderPlugins[0]?.id??"openai");
  const [snapshot,setSnapshot]=useState<AiAccountSnapshot>(EMPTY_SNAPSHOT);
  const [hostAvailable,setHostAvailable]=useState(Boolean(host));
  useEffect(()=>{ let cancelled=false; if(!host){setHostAvailable(false);return;} host.snapshot().then((next)=>{if(cancelled)return;setSnapshot(next);setHostAvailable(true);}).catch(()=>{if(!cancelled)setHostAvailable(false);}); return()=>{cancelled=true;}; },[host]);
  const requireHost=()=>{if(!host)throw new Error("当前宿主未提供 AI 配置桥。");return host;};
  const activeAccount=snapshot.activeModel?snapshot.accounts.find((account)=>account.id===snapshot.activeModel?.accountId):undefined;
  const activeCatalogModel=snapshot.activeModel?activeAccount?.modelCatalog.find((model)=>model.id===snapshot.activeModel?.modelId):undefined;
  const activeReasoningField=activeCatalogModel?.capabilities?.settings.find((field)=>field.id==="reasoningEffort"&&field.kind==="select")??null;
  const activeReasoning:ActiveReasoningControl|null=snapshot.activeModel&&activeReasoningField?{field:activeReasoningField,value:activeAccount?.modelSettings[activeReasoningField.id]??activeReasoningField.defaultValue,modelKey:`${snapshot.activeModel.accountId}:${snapshot.activeModel.providerId}:${snapshot.activeModel.modelId}`}:null;
  const reasoningEffortLabel=formatReasoningEffort(activeReasoning?.value);
  const modelLabel=snapshot.activeModel?`${activeCatalogModel?.name??snapshot.activeModel.modelId}${reasoningEffortLabel?` · ${reasoningEffortLabel}`:""}`:"未配置模型";
  const quickModels:readonly QuickModelOption[]=useMemo(()=>snapshot.accounts.flatMap((account)=>account.modelCatalog.map((model)=>({accountId:account.id,providerId:account.providerId,accountName:account.displayName,modelId:model.id,...(model.name?{modelName:model.name}:{}),active:snapshot.activeModel?.accountId===account.id&&snapshot.activeModel.modelId===model.id,unavailable:account.verificationStatus==="error"}))).sort((left,right)=>Number(right.active)-Number(left.active)||left.accountName.localeCompare(right.accountName,"zh-CN")||left.modelId.localeCompare(right.modelId,"en")),[snapshot]);
  const activeModelBinding:AgentModelBinding|null=snapshot.activeModel?{accountId:snapshot.activeModel.accountId,providerId:snapshot.activeModel.providerId,modelId:snapshot.activeModel.modelId,settings:activeAccount?.modelSettings??{}}:null;
  return {
    selectedProviderId,setSelectedProviderId,snapshot,hostAvailable,
    providerViews:buildAiProviderViews(snapshot.hostCapabilities),accounts:snapshot.accounts.map(mapAiAccount),activeReasoning,modelLabel,quickModels,activeModelBinding,
    probe:async(draft:AiSettingsDraftInput,secret:string)=>mapAiProbe(await requireHost().probe(toAiAccountDraft(draft),secret)),
    save:async(draft:AiSettingsDraftInput,secret:string)=>{const result=await requireHost().save(toAiAccountDraft(draft),secret);setSnapshot(result.snapshot);return mapAiProbe(result.probe);},
    connectSubscription:async(draft:AiSettingsDraftInput)=>{const result=await requireHost().connectSubscription(toAiAccountDraft(draft));setSnapshot(result.snapshot);return mapAiProbe(result.probe);},
    reprobe:async(accountId:string)=>{const result=await requireHost().reprobe(accountId);setSnapshot(result.snapshot);return mapAiProbe(result.probe);},
    deleteAccount:async(accountId:string)=>setSnapshot(await requireHost().deleteAccount(accountId)),
    selectAccountModel:async(accountId:string,modelId:string,modelSettings:Readonly<Record<string,string|number|boolean>>)=>setSnapshot(await requireHost().selectModel(accountId,modelId,modelSettings)),
    quickSelectModel:async(accountId:string,modelId:string)=>setSnapshot(await requireHost().setActiveModel(accountId,modelId,{})),
    quickUpdateModelSetting:async(fieldId:string,value:AiModelSettingValue)=>{if(!snapshot.activeModel||!activeAccount)throw new Error("当前没有可调整的模型。");const nextSettings={...activeAccount.modelSettings,[fieldId]:value};setSnapshot(await requireHost().setActiveModel(activeAccount.id,snapshot.activeModel.modelId,nextSettings));},
    activateAccountModel:async(accountId:string)=>setSnapshot(await requireHost().activateModel(accountId)),
  };
}
export type AiSettingsController=ReturnType<typeof useAiSettingsController>;

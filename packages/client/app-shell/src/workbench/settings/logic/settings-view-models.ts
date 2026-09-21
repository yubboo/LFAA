/**
 * Settings Host -> UI ViewModel 纯映射函数。无 React 状态、无 DOM、无 Provider 网络。
 */
import type {
  AiAccountDraft,
  AiAccountHostCapabilities,
  AiAccountProbeResult,
  AiAccountRecord,
  AiAccountUsageSnapshot,
} from "@lfaa/config-system";
import { builtinAiProviderPlugins } from "@lfaa/config-system";
import type {
  AiSettingsAccountView,
  AiSettingsDraftInput,
  AiSettingsProbeView,
  AiSettingsProviderView,
} from "@lfaa/ui";
import type { PluginSettingsInstalledView, PluginSettingsInspectionView, PluginSettingsInstallResultView } from "../contracts/settings.types";
import type { InstalledPluginBundle, PluginInstallOutcome, PluginSpecInspection } from "@lfaa/plugin-runtime";

export function buildAiProviderViews(hostCapabilities:AiAccountHostCapabilities):readonly AiSettingsProviderView[] {
  return builtinAiProviderPlugins.map((plugin)=>({
    id:plugin.id,name:plugin.displayName,description:plugin.description,
    authMethods:plugin.authMethods.map((auth)=>{
      const capability=auth.hostCapability?hostCapabilities[auth.hostCapability]:undefined;
      const available=auth.hostCapability?capability?.available===true:true;
      return { id:auth.id,label:auth.label,kind:auth.kind,...(auth.description?{description:auth.description}:{}),...(auth.secretLabel?{secretLabel:auth.secretLabel}:{}),available,...(!available&&auth.hostCapability?{unavailableReason:capability?.reason??`当前宿主缺少 ${auth.hostCapability} 能力。`}:{}) };
    }),
    fields:plugin.configFields.map((field)=>({ id:field.id,label:field.label,kind:field.kind,required:field.required,...(field.defaultValue!==undefined?{defaultValue:field.defaultValue}:{}),...(field.placeholder!==undefined?{placeholder:field.placeholder}:{}),...(field.options!==undefined?{options:field.options}:{}),...(field.help!==undefined?{help:field.help}:{}) })),
  }));
}
export function mapAiUsage(usage:AiAccountUsageSnapshot):import("@lfaa/ui").AiSettingsUsageView {
  return {
    status:usage.status,scope:usage.scope,source:usage.source,checkedAt:usage.checkedAt,message:usage.message,
    ...(usage.planType?{planType:usage.planType}:{}),
    ...(usage.balances?{balances:usage.balances}:{}),
    ...(usage.rateLimits?{rateLimits:usage.rateLimits}:{}),
    ...(usage.modelQuotas?{modelQuotas:usage.modelQuotas}:{}),
    ...(usage.tokenUsage?{tokenUsage:usage.tokenUsage}:{}),
    ...(usage.resetCreditsAvailable!==undefined?{resetCreditsAvailable:usage.resetCreditsAvailable}:{}),
  };
}
export function mapAiAccount(record:AiAccountRecord,usage?:AiAccountUsageSnapshot):AiSettingsAccountView { return { id:record.id,providerId:record.providerId,displayName:record.displayName,authMethodId:record.authMethodId,selectedModelId:record.selectedModelId,modelSettings:record.modelSettings,modelCatalog:record.modelCatalog,verificationStatus:record.verificationStatus,lastVerifiedAt:record.lastVerifiedAt,...(usage?{usage:mapAiUsage(usage)}:{}) }; }
export function mapAiProbe(probe:AiAccountProbeResult):AiSettingsProbeView { return { status:probe.status,message:probe.message,models:probe.models,...(probe.manualModelEntry===true?{manualModelEntry:true}:{}),...(probe.resolvedBaseUrl?{resolvedBaseUrl:probe.resolvedBaseUrl}:{}) }; }
export function toAiAccountDraft(draft:AiSettingsDraftInput):AiAccountDraft { return { ...(draft.accountId?{accountId:draft.accountId}:{}),providerId:draft.providerId as AiAccountDraft["providerId"],displayName:draft.displayName,authMethodId:draft.authMethodId,settings:draft.settings,selectedModelId:draft.selectedModelId??null,modelSettings:draft.modelSettings??{} }; }
export function mapInstalledPlugin(bundle:InstalledPluginBundle):PluginSettingsInstalledView { return { packageName:bundle.packageName,packageVersion:bundle.packageVersion,pluginId:bundle.manifest.pluginId,displayName:bundle.manifest.displayName,...(bundle.manifest.description?{description:bundle.manifest.description}:{}),enabled:bundle.enabled,capabilities:bundle.manifest.capabilities.map((capability)=>({id:capability.id,kind:capability.kind,displayName:capability.displayName})),credentials:(bundle.manifest.credentials??[]).map((credential)=>({id:credential.id,displayName:credential.displayName,exposure:credential.exposure})) }; }
export function mapPluginInspection(inspection:PluginSpecInspection):PluginSettingsInspectionView {
  if(inspection.status==="refused") return {status:"refused",spec:inspection.spec,reason:inspection.reason};
  const permissions=[...new Set(inspection.manifest.capabilities.flatMap((capability)=>capability.permissions?.map((item)=>item.scope?`${item.capability}:${item.scope}`:item.capability)??[]))];
  return { status:"accepted",sourceKind:inspection.sourceKind,spec:inspection.spec,packageName:inspection.packageName,packageVersion:inspection.packageVersion,pluginId:inspection.manifest.pluginId,pluginApiVersion:inspection.manifest.pluginApiVersion,displayName:inspection.manifest.displayName,...(inspection.description||inspection.manifest.description?{description:inspection.description??inspection.manifest.description}:{}),enabled:false,permissions,capabilities:inspection.manifest.capabilities.map((capability)=>({id:capability.id,kind:capability.kind,displayName:capability.displayName})),credentials:(inspection.manifest.credentials??[]).map((credential)=>({id:credential.id,displayName:credential.displayName,exposure:credential.exposure})) };
}
export function mapPluginInstallOutcome(outcome:PluginInstallOutcome):PluginSettingsInstallResultView { return { status:outcome.status,...(outcome.bundle?{packageName:outcome.bundle.packageName,bundleDisplayName:outcome.bundle.manifest.displayName}:{}),...(outcome.failureKind?{failureKind:outcome.failureKind}:{}),...(outcome.diagnostic?{diagnostic:outcome.diagnostic}:{}),...(outcome.pendingBuilds?.length?{pendingBuilds:outcome.pendingBuilds}:{}) }; }

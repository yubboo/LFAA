/**
 * 文件：useAiSettingsController.ts
 * 作用：AI Settings / Model ViewModel 映射的唯一 App-Shell 状态 Owner。
 * 负责：账户快照、模型快捷切换、官方 Usage 独立加载状态、Host 错误终态。
 * 不负责：Provider 网络、Secret、React Settings 具体布局、官方额度解析。
 * 状态归属：App Shell 只持有浏览器会话级快照与 Usage UI 状态；Provider 真值仍归 Host/Config System。
 * 对外接口：useAiSettingsController、AiSettingsController。
 * 关联文件：settings-view-models.ts、@lfaa/ui AiSettingsPanel、packages/client/connection/src/ai-settings-client.ts。
 * 修改注意事项：Usage 失败必须进入 error 终态；不得吞错后让 UI 永久显示“读取中”。
 */
import { useEffect, useMemo, useState } from "react";
import type { AgentModelBinding } from "@lfaa/agent-runtime";
import {
  builtinAiProviderPlugins,
  type AiAccountSnapshot,
  type AiAccountUsageSnapshot,
  type AiModelSettingValue,
} from "@lfaa/config-system";
import type { AiSettingsDraftInput } from "@lfaa/ui";
import type { AgentAiSettingsHost, ActiveReasoningControl, QuickModelOption } from "#workbench/contracts";
import { buildAiProviderViews, mapAiAccount, mapAiProbe, toAiAccountDraft } from "./settings-view-models";

const EMPTY_SNAPSHOT: AiAccountSnapshot = {
  accounts: [],
  activeModel: null,
  secretPersistence: "memory",
  hostCapabilities: { "codex-app-server": { available: false, reason: "正在检查 OpenAI 官方 ChatGPT 账户能力…" } },
};

type UsageLoadState = { state: "idle" | "loading" | "ready" | "error"; error?: string };

function formatReasoningEffort(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const labels: Readonly<Record<string, string>> = { none: "关", disabled: "关", enabled: "开", low: "低", medium: "中", high: "高", xhigh: "极高", max: "最大" };
  return labels[value] ?? value;
}

function errorMessage(value: unknown): string {
  return value instanceof Error && value.message.trim() ? value.message : "官方余额 / 额度读取失败。";
}

export function useAiSettingsController(host: AgentAiSettingsHost | undefined) {
  const [selectedProviderId, setSelectedProviderId] = useState<string>(builtinAiProviderPlugins[0]?.id ?? "openai");
  const [snapshot, setSnapshot] = useState<AiAccountSnapshot>(EMPTY_SNAPSHOT);
  const [hostAvailable, setHostAvailable] = useState(Boolean(host));
  const [usageByAccount, setUsageByAccount] = useState<Readonly<Record<string, AiAccountUsageSnapshot>>>({});
  const [usageLoadByAccount, setUsageLoadByAccount] = useState<Readonly<Record<string, UsageLoadState>>>({});

  const loadUsage = async (targetHost: AgentAiSettingsHost, accountId: string): Promise<void> => {
    setUsageLoadByAccount((current) => ({ ...current, [accountId]: { state: "loading" } }));
    try {
      const usage = await targetHost.usage(accountId);
      setUsageByAccount((current) => ({ ...current, [accountId]: usage }));
      setUsageLoadByAccount((current) => ({ ...current, [accountId]: { state: "ready" } }));
    } catch (error) {
      setUsageLoadByAccount((current) => ({ ...current, [accountId]: { state: "error", error: errorMessage(error) } }));
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!host) {
      setHostAvailable(false);
      return;
    }
    host.snapshot().then((next) => {
      if (cancelled) return;
      setSnapshot(next);
      setHostAvailable(true);
      setUsageLoadByAccount((current) => Object.fromEntries(next.accounts.map((account) => [account.id, current[account.id] ?? { state: "idle" }] as const)));
      // 额度是附加状态，不阻塞账户/模型配置首屏；每个账户独立进入 ready/error 终态。
      for (const account of next.accounts) void loadUsage(host, account.id);
    }).catch(() => {
      if (!cancelled) setHostAvailable(false);
    });
    return () => { cancelled = true; };
  }, [host]);

  const requireHost = () => {
    if (!host) throw new Error("当前宿主未提供 AI 配置桥。");
    return host;
  };
  const activeAccount = snapshot.activeModel ? snapshot.accounts.find((account) => account.id === snapshot.activeModel?.accountId) : undefined;
  const activeCatalogModel = snapshot.activeModel ? activeAccount?.modelCatalog.find((model) => model.id === snapshot.activeModel?.modelId) : undefined;
  const activeReasoningField = activeCatalogModel?.capabilities?.settings.find((field) => field.id === "reasoningEffort" && field.kind === "select") ?? null;
  const activeReasoning: ActiveReasoningControl | null = snapshot.activeModel && activeReasoningField ? {
    field: activeReasoningField,
    value: activeAccount?.modelSettings[activeReasoningField.id] ?? activeReasoningField.defaultValue,
    modelKey: `${snapshot.activeModel.accountId}:${snapshot.activeModel.providerId}:${snapshot.activeModel.modelId}`,
  } : null;
  const reasoningEffortLabel = formatReasoningEffort(activeReasoning?.value);
  const modelLabel = snapshot.activeModel
    ? `${activeCatalogModel?.name ?? snapshot.activeModel.modelId}${reasoningEffortLabel ? ` · ${reasoningEffortLabel}` : ""}`
    : "未配置模型";
  const quickModels: readonly QuickModelOption[] = useMemo(() => snapshot.accounts
    .flatMap((account) => account.modelCatalog.map((model) => ({
      accountId: account.id,
      providerId: account.providerId,
      accountName: account.displayName,
      modelId: model.id,
      ...(model.name ? { modelName: model.name } : {}),
      active: snapshot.activeModel?.accountId === account.id && snapshot.activeModel.modelId === model.id,
      unavailable: account.verificationStatus === "error",
    })))
    .sort((left, right) => Number(right.active) - Number(left.active) || left.accountName.localeCompare(right.accountName, "zh-CN") || left.modelId.localeCompare(right.modelId, "en")), [snapshot]);
  const activeModelBinding: AgentModelBinding | null = snapshot.activeModel ? {
    accountId: snapshot.activeModel.accountId,
    providerId: snapshot.activeModel.providerId,
    modelId: snapshot.activeModel.modelId,
    settings: activeAccount?.modelSettings ?? {},
  } : null;

  return {
    selectedProviderId,
    setSelectedProviderId,
    snapshot,
    hostAvailable,
    providerViews: buildAiProviderViews(snapshot.hostCapabilities),
    accounts: snapshot.accounts.map((account) => {
      const mapped = mapAiAccount(account, usageByAccount[account.id]);
      const load = usageLoadByAccount[account.id] ?? { state: "idle" as const };
      return { ...mapped, usageState: load.state, ...(load.error ? { usageError: load.error } : {}) };
    }),
    activeReasoning,
    modelLabel,
    quickModels,
    activeModelBinding,
    probe: async (draft: AiSettingsDraftInput, secret: string) => mapAiProbe(await requireHost().probe(toAiAccountDraft(draft), secret)),
    save: async (draft: AiSettingsDraftInput, secret: string) => {
      const targetHost = requireHost();
      const result = await targetHost.save(toAiAccountDraft(draft), secret);
      setSnapshot(result.snapshot);
      const savedAccount = result.snapshot.accounts.find((account) => draft.accountId
        ? account.id === draft.accountId
        : account.providerId === draft.providerId && account.authMethodId === draft.authMethodId && account.displayName === draft.displayName);
      if (savedAccount) void loadUsage(targetHost, savedAccount.id);
      return mapAiProbe(result.probe);
    },
    connectSubscription: async (draft: AiSettingsDraftInput) => {
      const targetHost = requireHost();
      const result = await targetHost.connectSubscription(toAiAccountDraft(draft));
      setSnapshot(result.snapshot);
      const account = result.snapshot.accounts.find((item) => item.providerId === draft.providerId && item.authMethodId === draft.authMethodId);
      if (account) void loadUsage(targetHost, account.id);
      return mapAiProbe(result.probe);
    },
    refreshUsage: async (accountId: string) => {
      await loadUsage(requireHost(), accountId);
    },
    reprobe: async (accountId: string) => {
      const targetHost = requireHost();
      const result = await targetHost.reprobe(accountId);
      setSnapshot(result.snapshot);
      void loadUsage(targetHost, accountId);
      return mapAiProbe(result.probe);
    },
    deleteAccount: async (accountId: string) => {
      setSnapshot(await requireHost().deleteAccount(accountId));
      setUsageByAccount((current) => { const next = { ...current }; delete next[accountId]; return next; });
      setUsageLoadByAccount((current) => { const next = { ...current }; delete next[accountId]; return next; });
    },
    selectAccountModel: async (accountId: string, modelId: string, modelSettings: Readonly<Record<string, string | number | boolean>>) => setSnapshot(await requireHost().selectModel(accountId, modelId, modelSettings)),
    quickSelectModel: async (accountId: string, modelId: string) => setSnapshot(await requireHost().setActiveModel(accountId, modelId, {})),
    quickUpdateModelSetting: async (fieldId: string, value: AiModelSettingValue) => {
      if (!snapshot.activeModel || !activeAccount) throw new Error("当前没有可调整的模型。");
      const nextSettings = { ...activeAccount.modelSettings, [fieldId]: value };
      setSnapshot(await requireHost().setActiveModel(activeAccount.id, snapshot.activeModel.modelId, nextSettings));
    },
    activateAccountModel: async (accountId: string) => setSnapshot(await requireHost().activateModel(accountId)),
  };
}
export type AiSettingsController = ReturnType<typeof useAiSettingsController>;

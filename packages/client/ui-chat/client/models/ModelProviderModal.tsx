// 浏览器端模型配置弹窗：持有表单状态与初始化回填，处理模型同步、保存、测试、删除，并组合表单主体与底部操作栏。
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { getArkPlanKind } from "@lfaa/llm/ark-plan";
import { ModalDialog } from "@lfaa/ui-primitives/client";
import type { ChatClientStore, LlmApiProtocolOption, ModelCapabilityItem, PublicLlmProfileItem } from "../store/chat-store";
import { inferProtocolForPreset, type ModelProviderPreset } from "./provider-catalog";
import { ModelProviderFooter } from "./ModelProviderFooter";
import { ModelProviderForm, type ModelProviderStatusNotice } from "./ModelProviderForm";

// 模型清单统一从 Chat Completions 端点查询：套餐地址固定跟随该端点，普通档案用已保存地址。
function resolveListBaseUrl(provider: ModelProviderPreset, profile?: PublicLlmProfileItem): string {
  if (provider.subscription) return provider.protocolBaseUrls?.["openai-chat"] ?? provider.defaultBaseUrl;
  return profile?.baseUrl ?? provider.defaultBaseUrl;
}

/** 共用普通 API 和套餐表单，从接入方式进入时提供返回入口。 */
export function ModelProviderModal({
  open,
  isZh,
  provider,
  profile,
  canDelete,
  store,
  onClose,
  onBack,
}: {
  open: boolean;
  isZh: boolean;
  provider: ModelProviderPreset | null;
  profile?: PublicLlmProfileItem | undefined;
  canDelete: boolean;
  store: ChatClientStore;
  onClose: () => void;
  onBack?: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PublicLlmProfileItem["kind"]>("openai-compatible");
  const [apiProtocol, setApiProtocol] = useState<LlmApiProtocolOption>("openai-chat");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [contextWindow, setContextWindow] = useState("");
  const [inputPrice, setInputPrice] = useState("");
  const [outputPrice, setOutputPrice] = useState("");
  const [cachedInputPrice, setCachedInputPrice] = useState("");
  const [agentPlanTier, setAgentPlanTier] = useState<"small" | "medium" | "large" | "max">("medium");
  const [officialModels, setOfficialModels] = useState<ModelCapabilityItem[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusNotice, setStatusNotice] = useState<ModelProviderStatusNotice | null>(null);
  const initKeyRef = useRef<string | null>(null);
  const modelInputId = useId();
  const focusFormOnOpen = Boolean(onBack);
  // 进入第二步时聚焦表单区域，避免直接唤起手机软键盘。
  const focusForm = useCallback((form: HTMLDivElement | null) => {
    if (focusFormOnOpen) form?.focus({ preventScroll: true });
  }, [focusFormOnOpen]);

  useEffect(() => {
    if (!open || !provider) {
      initKeyRef.current = null;
      return;
    }
    const openKey = provider.id;
    if (initKeyRef.current === openKey) return;
    initKeyRef.current = openKey;

    const nextProtocol = inferProtocolForPreset(provider, profile);
    const nextBaseUrl = provider.subscription
      ? (provider.protocolBaseUrls?.[nextProtocol] ?? provider.defaultBaseUrl)
      : (profile?.baseUrl ?? provider.defaultBaseUrl);
    setName(profile?.name ?? (isZh ? provider.nameZh : provider.nameEn));
    setKind(profile?.kind ?? provider.kind);
    setApiProtocol(nextProtocol);
    setBaseUrl(nextBaseUrl);
    setModel(profile?.model ?? provider.defaultModel);
    setApiKey("");
    setContextWindow(profile?.contextWindowTokens ? String(profile.contextWindowTokens) : "");
    setInputPrice(profile?.inputPricePerMillion ? String(profile.inputPricePerMillion) : "");
    setOutputPrice(profile?.outputPricePerMillion ? String(profile.outputPricePerMillion) : "");
    setCachedInputPrice(profile?.cachedInputPricePerMillion ? String(profile.cachedInputPricePerMillion) : "");
    setAgentPlanTier(profile?.agentPlanTier ?? "medium");
    setStatusNotice(null);
    const isOllamaDefaultPlaceholder =
      (profile?.kind ?? provider.kind) === "ollama"
      && !profile?.configured
      && (profile?.availableModels?.length ?? 0) <= 1;
    const cached = !isOllamaDefaultPlaceholder && profile?.availableModels?.length ? profile.availableModels : [];
    setOfficialModels(cached);

    // 仅在弹窗初次打开时自动同步一次真实官方模型清单，避免保存或测试后重复触发清空状态提示。
    // 套餐同样按已保存凭据拉取，确保千问等套餐能列出名下全部模型，而不是只认一个模型 ID。
    if (profile?.configured || profile?.hasApiKey || (profile?.kind ?? provider.kind) === "ollama") {
      setFetchingModels(true);
      void store
        .fetchRemoteModels({
          ...(profile?.id ? { profileId: profile.id } : {}),
          kind: profile?.kind ?? provider.kind,
          apiProtocol: nextProtocol,
          baseUrl: resolveListBaseUrl(provider, profile),
        })
        .then((list) => {
          setOfficialModels(list);
          if (list[0] && !list.some((item) => item.id === (profile?.model ?? "").trim())) {
            setModel(list[0].id);
          }
        })
        .catch(() => {})
        .finally(() => setFetchingModels(false));
    }
  }, [isZh, open, profile, provider, store]);

  useEffect(() => {
    if (statusNotice?.tone !== "success") return;
    const timer = window.setTimeout(() => setStatusNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [statusNotice]);

  if (!provider) return null;
  const subscription = provider.subscription === true;
  const isLocal = provider.id === "local" || kind === "ollama";
  const arkPlan = subscription ? getArkPlanKind(provider.defaultBaseUrl) : undefined;
  // 套餐的保存和测试都使用当前所选协议对应的官方预设地址，防止凭据随表单草稿发送到普通 API。
  const configProtocol = apiProtocol;
  const configBaseUrl = subscription
    ? (provider.protocolBaseUrls?.[apiProtocol] ?? provider.defaultBaseUrl)
    : baseUrl.trim();

  const title = isZh ? `${provider.nameZh} 模型配置` : `${provider.nameEn} Configuration`;
  const subtitle = isZh ? provider.descZh : provider.descEn;

  // 同步当前接口的模型。原模型仍在目录中时保留选择，否则用首项填入表单。
  const handleFetchModels = async () => {
    setFetchingModels(true);
    setStatusNotice({
      tone: "loading",
      title: isZh ? "同步中" : "Syncing",
      message: "",
    });
    try {
      const list = await store.fetchRemoteModels({
        ...(profile?.id ? { profileId: profile.id } : {}),
        kind,
        apiProtocol: configProtocol,
        baseUrl: resolveListBaseUrl(provider, profile),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setOfficialModels(list);
      if (list[0] && !list.some((item) => item.id === model.trim())) {
        setModel(list[0].id);
      }
      setStatusNotice({
        tone: "success",
        title: isZh ? "已同步" : "Synced",
        message: isLocal
          ? (isZh ? `${list.length} 个本地模型` : `${list.length} local models`)
          : (isZh ? `${list.length} 个官方模型` : `${list.length} models`),
      });
    } catch (err) {
      setStatusNotice({
        tone: "error",
        title: isZh ? "同步失败" : "Sync Failed",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setFetchingModels(false);
    }
  };

  // 留空的 API Key 交由 Host 保留原值，套餐保存时省略普通 API 的模型缓存。
  const saveConfig = async (activate: boolean) => {
    setBusy(true);
    setStatusNotice(null);
    try {
      const saved = await store.saveLlmProfile({
        ...(profile?.id ? { id: profile.id } : {}),
        providerId: provider.id,
        name: name.trim() || model.trim() || (isZh ? provider.nameZh : provider.nameEn),
        kind,
        apiProtocol: configProtocol,
        baseUrl: configBaseUrl,
        model: model.trim(),
        ...(Number(contextWindow) > 0 ? { contextWindowTokens: Math.floor(Number(contextWindow)) } : {}),
        inputPricePerMillion: Number(inputPrice) || 0,
        outputPricePerMillion: Number(outputPrice) || 0,
        cachedInputPricePerMillion: Number(cachedInputPrice) || 0,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        ...(officialModels.length > 0 ? { availableModels: officialModels } : {}),
        ...(arkPlan === "agent" ? { agentPlanTier } : {}),
        activate,
      });
      setApiKey("");
      if (activate) {
        onClose();
        return;
      }
      setStatusNotice({
        tone: "success",
        title: isZh ? "已保存" : "Saved",
        message: saved?.model ?? model.trim(),
      });
    } catch (err) {
      setStatusNotice({
        tone: "error",
        title: isZh ? "保存失败" : "Save Failed",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  // 先保存当前表单，再按档案 ID 发起真实连接测试；套餐同样在保存前补齐真实模型清单。
  const handleTest = async () => {
    setBusy(true);
    setStatusNotice({
      tone: "loading",
      title: isZh ? "连接测试中" : "Testing",
      message: "",
    });
    try {
      const fetched = officialModels.length > 0
        ? officialModels
        : await store
            .fetchRemoteModels({
              ...(profile?.id ? { profileId: profile.id } : {}),
              kind,
              apiProtocol: configProtocol,
              baseUrl: resolveListBaseUrl(provider, profile),
              ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
            })
            .catch(() => officialModels);
      if (fetched.length > 0) setOfficialModels(fetched);

      const saved = await store.saveLlmProfile({
        ...(profile?.id ? { id: profile.id } : {}),
        providerId: provider.id,
        name: name.trim() || model.trim(),
        kind,
        apiProtocol: configProtocol,
        baseUrl: configBaseUrl,
        model: model.trim(),
        ...(Number(contextWindow) > 0 ? { contextWindowTokens: Math.floor(Number(contextWindow)) } : {}),
        inputPricePerMillion: Number(inputPrice) || 0,
        outputPricePerMillion: Number(outputPrice) || 0,
        cachedInputPricePerMillion: Number(cachedInputPrice) || 0,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        ...(fetched.length > 0 ? { availableModels: fetched } : {}),
        ...(arkPlan === "agent" ? { agentPlanTier } : {}),
      });
      const targetId = saved?.id ?? profile?.id;
      if (!targetId) {
        setStatusNotice({
          tone: "warning",
          title: isZh ? "未保存" : "Unsaved",
          message: isZh ? "请先填写并保存配置。" : "Save profile first.",
        });
        return;
      }
      const res = await store.testLlmProfile(targetId);
      setStatusNotice({
        tone: "success",
        title: isZh ? "连接成功" : "Connected",
        message: res.replyPreview || "OK",
      });
    } catch (err) {
      setStatusNotice({
        tone: "error",
        title: isZh ? "连接失败" : "Connection Failed",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  // 删除成功后关闭弹窗，失败时保留表单以便查看错误并重试。
  const handleDelete = async () => {
    if (!profile?.id) return;
    setBusy(true);
    try {
      await store.deleteLlmProfile(profile.id);
      onClose();
    } catch (err) {
      setStatusNotice({
        tone: "error",
        title: isZh ? "删除失败" : "Delete Failed",
        message: err instanceof Error ? err.message : String(err),
      });
      setBusy(false);
    }
  };

  return (
    <ModalDialog
      open={open}
      title={title}
      subtitle={subtitle}
      size="md"
      animation="scale"
      closeLabel={isZh ? "关闭弹窗" : "Close"}
      onClose={onClose}
      icon={(
        <span style={{ color: provider.accentColor, fontWeight: 700, fontSize: "0.86em" }}>
          {provider.isAddStyle ? <IconPlus size={16} stroke={2} /> : provider.glyph}
        </span>
      )}
      footer={(
        <ModelProviderFooter
          isZh={isZh}
          busy={busy}
          canDelete={canDelete}
          profileId={profile?.id}
          onBack={onBack}
          onDelete={() => void handleDelete()}
          onTest={() => void handleTest()}
          onSave={() => void saveConfig(false)}
          onSaveAndUse={() => void saveConfig(true)}
        />
      )}
    >
      <ModelProviderForm
        isZh={isZh}
        provider={provider}
        profile={profile}
        subscription={subscription}
        isLocal={isLocal}
        arkPlan={arkPlan}
        configBaseUrl={configBaseUrl}
        values={{ name, kind, apiProtocol, baseUrl, model, apiKey, contextWindow, inputPrice, outputPrice, cachedInputPrice, agentPlanTier }}
        setters={{ setName, setApiProtocol, setBaseUrl, setModel, setApiKey, setContextWindow, setInputPrice, setOutputPrice, setCachedInputPrice, setAgentPlanTier }}
        officialModels={officialModels}
        fetchingModels={fetchingModels}
        busy={busy}
        statusNotice={statusNotice}
        modelInputId={modelInputId}
        focusForm={focusForm}
        focusFormOnOpen={focusFormOnOpen}
        onFetchModels={() => void handleFetchModels()}
      />
    </ModalDialog>
  );
}

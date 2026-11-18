// 渲染点击模型卡片后弹出的居中配置弹窗：集成实时官方 /models 拉取、真实思考能力标注与按钮原地状态反馈。
import { useEffect, useRef, useState } from "react";
import { IconCheck, IconLoader2, IconPlus, IconX } from "@tabler/icons-react";
import { ModalDialog, type StatusTone } from "@lfaa/ui-primitives/client";
import type { ChatClientStore, LlmApiProtocolOption, ModelCapabilityItem, PublicLlmProfileItem } from "../chat-store";
import {
  inferProtocolForPreset,
  LLM_API_PROTOCOL_OPTIONS,
  resolveNextBaseUrlForProtocol,
  type ModelProviderPreset,
} from "../provider-catalog";
import styles from "./ModelProviderGrid.module.css";

function formatCapabilityTag(cap: ModelCapabilityItem, isZh: boolean): string {
  if (cap.reasoningMode === "fixed") return isZh ? "深度思考" : "Reasoning";
  if (cap.reasoningMode === "effort" && cap.reasoningLevels.length > 0) {
    const labelMap: Record<string, string> = isZh
      ? { minimal: "极简", low: "低", medium: "中", high: "高", max: "极高" }
      : { minimal: "Min", low: "Low", medium: "Med", high: "High", max: "Max" };
    return cap.reasoningLevels.map((lvl) => labelMap[lvl] ?? lvl).join("/");
  }
  return "";
}

export function ModelProviderModal({
  open,
  isZh,
  provider,
  profile,
  canDelete,
  store,
  onClose,
}: {
  open: boolean;
  isZh: boolean;
  provider: ModelProviderPreset | null;
  profile?: PublicLlmProfileItem | undefined;
  canDelete: boolean;
  store: ChatClientStore;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PublicLlmProfileItem["kind"]>("openai-compatible");
  const [apiProtocol, setApiProtocol] = useState<LlmApiProtocolOption>("openai-chat");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [officialModels, setOfficialModels] = useState<ModelCapabilityItem[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ tone: StatusTone; title?: string; message: string } | null>(null);
  const initKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !provider) {
      initKeyRef.current = null;
      return;
    }
    const openKey = `${provider.id}:${profile?.id ?? "new"}`;
    if (initKeyRef.current === openKey) return;
    initKeyRef.current = openKey;

    const nextProtocol = inferProtocolForPreset(provider, profile);
    setName(profile?.name ?? (isZh ? provider.nameZh : provider.nameEn));
    setKind(profile?.kind ?? provider.kind);
    setApiProtocol(nextProtocol);
    setBaseUrl(profile?.baseUrl ?? provider.defaultBaseUrl);
    setModel(profile?.model ?? provider.defaultModel);
    setApiKey("");
    setStatusNotice(null);
    const cached = profile?.availableModels?.length ? profile.availableModels : [];
    setOfficialModels(cached);

    // 仅在弹窗初次打开时自动同步一次真实官方模型清单，避免保存或测试后重复触发清空状态提示。
    if (profile?.configured || profile?.hasApiKey || (profile?.kind ?? provider.kind) === "ollama") {
      setFetchingModels(true);
      void store
        .fetchRemoteModels({
          ...(profile?.id ? { profileId: profile.id } : {}),
          kind: profile?.kind ?? provider.kind,
          apiProtocol: nextProtocol,
          baseUrl: profile?.baseUrl ?? provider.defaultBaseUrl,
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

  // 原地状态按钮：同步中/测试中 → 成功（连接成功 · OK）/ 失败，成功态数秒后自动复位
  const tone = statusNotice?.tone;
  const isErrorTone = tone === "error" || tone === "warning";
  const inlineToneClass =
    tone === "success" ? styles.inlineBtnSuccess
      : isErrorTone ? styles.inlineBtnError
        : tone === "loading" ? styles.inlineBtnLoading
          : "";
  const inlineLabel = !statusNotice
    ? (isZh ? "获取官方模型" : "Fetch Official Models")
    : tone === "loading"
      ? `${statusNotice.title ?? ""}…`
      : tone === "success" && statusNotice.message
        ? `${statusNotice.title ?? ""} · ${statusNotice.message}`
        : (statusNotice.title ?? "");
  const inlineIcon =
    tone === "loading" ? <IconLoader2 size={13} stroke={2} className={styles.spinIcon} />
      : tone === "success" ? <IconCheck size={13} stroke={2.2} />
        : isErrorTone ? <IconX size={13} stroke={2.2} />
          : null;

  const title = isZh ? `${provider.nameZh} 模型配置` : `${provider.nameEn} Configuration`;
  const subtitle = isZh ? provider.descZh : provider.descEn;

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
        apiProtocol,
        baseUrl: baseUrl.trim(),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setOfficialModels(list);
      if (list[0] && !list.some((item) => item.id === model.trim())) {
        setModel(list[0].id);
      }
      setStatusNotice({
        tone: "success",
        title: isZh ? "已同步" : "Synced",
        message: isZh ? `${list.length} 个官方模型` : `${list.length} models`,
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

  const saveConfig = async (activate: boolean) => {
    setBusy(true);
    setStatusNotice(null);
    try {
      const saved = await store.saveLlmProfile({
        ...(profile?.id ? { id: profile.id } : {}),
        providerId: provider.id,
        name: name.trim() || model.trim() || (isZh ? provider.nameZh : provider.nameEn),
        kind,
        apiProtocol,
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        ...(officialModels.length > 0 ? { availableModels: officialModels } : {}),
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
              apiProtocol,
              baseUrl: baseUrl.trim(),
              ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
            })
            .catch(() => officialModels);
      if (fetched.length > 0) setOfficialModels(fetched);

      const saved = await store.saveLlmProfile({
        ...(profile?.id ? { id: profile.id } : {}),
        providerId: provider.id,
        name: name.trim() || model.trim(),
        kind,
        apiProtocol,
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        ...(fetched.length > 0 ? { availableModels: fetched } : {}),
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
        <div className={styles.footerGroup}>
          <div>
            {profile?.id && canDelete && (
              <button type="button" className={styles.dangerBtn} disabled={busy} onClick={() => void handleDelete()}>
                {isZh ? "删除配置" : "Delete"}
              </button>
            )}
          </div>
          <div className={styles.footerRight}>
            <button type="button" className={styles.btn} disabled={busy} onClick={() => void handleTest()}>
              {isZh ? "测试连接" : "Test"}
            </button>
            <button type="button" className={styles.btn} disabled={busy} onClick={() => void saveConfig(false)}>
              {isZh ? "保存" : "Save"}
            </button>
            <button type="button" className={styles.primaryBtn} disabled={busy} onClick={() => void saveConfig(true)}>
              {isZh ? "保存并设为当前模型" : "Save & Use"}
            </button>
          </div>
        </div>
      )}
    >
      <div className={styles.modalForm}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{isZh ? "显示名称" : "Display Name"}</span>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{isZh ? "API 协议格式" : "API Protocol"}</span>
          <div className={styles.chipsRow} role="group" aria-label={isZh ? "API 协议格式" : "API Protocol"}>
            {LLM_API_PROTOCOL_OPTIONS.filter((opt) => provider.supportedProtocols.includes(opt.id)).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`${styles.chipBtn} ${apiProtocol === opt.id ? styles.chipBtnActive : ""}`}
                onClick={() => {
                  setApiProtocol(opt.id);
                  setBaseUrl((prev) => resolveNextBaseUrlForProtocol(provider, prev, opt.id));
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{isZh ? "接口地址 (Base URL)" : "Base URL"}</span>
          <input className={styles.input} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </label>

        <div className={styles.field}>
          <div className={styles.fieldHeaderRow}>
            <span className={styles.fieldLabel}>{isZh ? "模型 ID (Model)" : "Model ID"}</span>
            {/* 同步 / 测试 / 保存状态直接在此按钮原地切换展示，不再弹出顶部横幅 */}
            <button
              type="button"
              className={`${styles.inlineActionBtn} ${inlineToneClass}`}
              disabled={fetchingModels || busy}
              title={statusNotice?.message || undefined}
              aria-live="polite"
              onClick={() => void handleFetchModels()}
            >
              {inlineIcon}
              <span>{inlineLabel}</span>
            </button>
          </div>
          <input className={styles.input} value={model} onChange={(e) => setModel(e.target.value)} />
          {isErrorTone && statusNotice?.message && (
            <span className={styles.errorHint} role="alert">{statusNotice.message}</span>
          )}
          {officialModels.length > 0 ? (
            <div className={styles.chipsRow}>
              {officialModels.slice(0, 18).map((item) => {
                const capText = formatCapabilityTag(item, isZh);
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.displayName ? `${item.displayName} (${item.id})` : item.id}
                    className={`${styles.chipBtn} ${model === item.id ? styles.chipBtnActive : ""}`}
                    onClick={() => setModel(item.id)}
                  >
                    <span>{item.displayName && item.displayName !== item.id ? `${item.displayName} (${item.id})` : item.id}</span>
                    {capText && <span className={styles.capTag}>· {capText}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className={styles.fieldHint}>
              {isZh ? "填写凭据后点击「获取官方模型」从官方接口实时加载真实可用模型" : "Click Fetch Official Models after entering credentials"}
            </span>
          )}
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{isZh ? "API Key" : "API Key"}</span>
          <input
            type="password"
            className={styles.input}
            value={apiKey}
            placeholder={
              kind === "ollama"
                ? (isZh ? "本地服务通常无需填写 API Key" : "Optional for local Ollama")
                : (profile?.hasApiKey ? `${profile.apiKeyMasked}（留空保持不变）` : (isZh ? "输入 API Key..." : "Enter API Key..."))
            }
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>
      </div>
    </ModalDialog>
  );
}

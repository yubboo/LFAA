// 模型提供商配置弹窗的表单主体：渲染协议、地址、模型目录、上下文窗口、成本单价与 API Key 字段。
import type { Dispatch, SetStateAction } from "react";
import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import type { ArkPlanKind } from "@lfaa/llm/ark-plan";
import type { StatusTone } from "@lfaa/ui-primitives/client";
import type { LlmApiProtocolOption, ModelCapabilityItem, PublicLlmProfileItem } from "../chat-store";
import { providerAccessMessages } from "../locales";
import {
  LLM_API_PROTOCOL_OPTIONS,
  LOCAL_RUNTIME_PRESETS,
  resolveNextBaseUrlForProtocol,
  type ModelProviderPreset,
} from "../provider-catalog";
import { ArkModels } from "./Ark-Models";
import styles from "./ModelProviderGrid.module.css";

/** 弹窗内联状态提示：同步 / 测试 / 保存的结果统一用这个结构展示。 */
export interface ModelProviderStatusNotice {
  tone: StatusTone;
  title?: string;
  message: string;
}

/** 表单受控值；状态由弹窗容器持有，提交时直接读取。 */
export interface ModelProviderFormValues {
  name: string;
  kind: PublicLlmProfileItem["kind"];
  apiProtocol: LlmApiProtocolOption;
  baseUrl: string;
  model: string;
  apiKey: string;
  contextWindow: string;
  inputPrice: string;
  outputPrice: string;
  cachedInputPrice: string;
}

/** 表单字段写回函数，直接复用弹窗容器的 useState setter。 */
export interface ModelProviderFormSetters {
  setName: Dispatch<SetStateAction<string>>;
  setApiProtocol: Dispatch<SetStateAction<LlmApiProtocolOption>>;
  setBaseUrl: Dispatch<SetStateAction<string>>;
  setModel: Dispatch<SetStateAction<string>>;
  setApiKey: Dispatch<SetStateAction<string>>;
  setContextWindow: Dispatch<SetStateAction<string>>;
  setInputPrice: Dispatch<SetStateAction<string>>;
  setOutputPrice: Dispatch<SetStateAction<string>>;
  setCachedInputPrice: Dispatch<SetStateAction<string>>;
}

// 只为明确支持思考的模型生成档位标签，能力未知时留空。
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

/** 表单主体：只做受控渲染，模型同步与保存测试仍由弹窗容器负责。 */
export function ModelProviderForm({
  isZh,
  provider,
  profile,
  subscription,
  isLocal,
  arkPlan,
  configBaseUrl,
  values,
  setters,
  officialModels,
  fetchingModels,
  busy,
  statusNotice,
  modelInputId,
  focusForm,
  focusFormOnOpen,
  onFetchModels,
}: {
  isZh: boolean;
  provider: ModelProviderPreset;
  profile?: PublicLlmProfileItem | undefined;
  subscription: boolean;
  isLocal: boolean;
  arkPlan: ArkPlanKind | undefined;
  configBaseUrl: string;
  values: ModelProviderFormValues;
  setters: ModelProviderFormSetters;
  officialModels: ModelCapabilityItem[];
  fetchingModels: boolean;
  busy: boolean;
  statusNotice: ModelProviderStatusNotice | null;
  modelInputId: string;
  focusForm: (form: HTMLDivElement | null) => void;
  focusFormOnOpen: boolean;
  onFetchModels: () => void;
}) {
  const { name, kind, apiProtocol, baseUrl, model, apiKey, contextWindow, inputPrice, outputPrice, cachedInputPrice } = values;
  const { setName, setApiProtocol, setBaseUrl, setModel, setApiKey, setContextWindow, setInputPrice, setOutputPrice, setCachedInputPrice } = setters;
  const visibleOfficialModels = provider.id === "volcengine" ? officialModels : officialModels.slice(0, 18);

  // 原地状态按钮：同步中/测试中 → 成功（连接成功 · OK）/ 失败，成功态数秒后自动复位
  const tone = statusNotice?.tone;
  const isErrorTone = tone === "error" || tone === "warning";
  const inlineToneClass =
    tone === "success" ? styles.inlineBtnSuccess
      : isErrorTone ? styles.inlineBtnError
        : tone === "loading" ? styles.inlineBtnLoading
          : "";
  const inlineLabel = !statusNotice
    ? (isLocal ? (isZh ? "获取本地模型" : "Fetch Local Models") : (isZh ? "获取官方模型" : "Fetch Official Models"))
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

  return (
    <div className={styles.modalForm} ref={focusForm} tabIndex={focusFormOnOpen ? -1 : undefined}>
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

      {/* 普通 API 可编辑地址，套餐地址与所选协议的官方端点绑定。 */}
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{isZh ? "接口地址 (Base URL)" : "Base URL"}</span>
        {provider.id === "local" && (
          <div className={styles.chipsRow}>
            {LOCAL_RUNTIME_PRESETS.map((preset) => {
              const targetUrl = apiProtocol === "anthropic-messages"
                ? preset.baseUrl.replace(/\/v1$/u, "")
                : preset.baseUrl;
              const active = baseUrl.trim().replace(/\/+$/u, "") === targetUrl;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`${styles.chipBtn} ${active ? styles.chipBtnActive : ""}`}
                  onClick={() => setBaseUrl(targetUrl)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        )}
        <input
          className={styles.input}
          value={subscription ? configBaseUrl : baseUrl}
          readOnly={subscription}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </label>

      <div className={styles.field}>
        <div className={styles.fieldHeaderRow}>
          <label htmlFor={modelInputId} className={styles.fieldLabel}>{isZh ? "模型 ID (Model)" : "Model ID"}</label>
          {/* 同步 / 测试 / 保存状态直接在此按钮原地切换展示，不再弹出顶部横幅 */}
          {subscription ? (statusNotice && (
            <span className={`${styles.inlineActionBtn} ${inlineToneClass}`} role="status">
              {inlineIcon}<span>{inlineLabel}</span>
            </span>
          )) : <button
            type="button"
            className={`${styles.inlineActionBtn} ${inlineToneClass}`}
            disabled={fetchingModels || busy}
            title={statusNotice?.message || undefined}
            aria-live="polite"
            onClick={() => void onFetchModels()}
          >
            {inlineIcon}
            <span>{inlineLabel}</span>
          </button>}
        </div>
        <input id={modelInputId} className={styles.input} value={model} onChange={(e) => setModel(e.target.value)} />
        {isErrorTone && statusNotice?.message && (
          <span className={styles.errorHint} role="alert">{statusNotice.message}</span>
        )}
        {/* 方舟展示公开套餐目录，其他套餐允许填写官方 ID，普通 API 展示查询结果。 */}
        {arkPlan ? (
          <ArkModels plan={arkPlan} model={model} isZh={isZh} onSelect={setModel} />
        ) : subscription ? (
          <span className={styles.fieldHint}>{providerAccessMessages[isZh ? "zh" : "en"].planModel}</span>
        ) : officialModels.length > 0 ? (
          <div className={styles.chipsRow}>
            {visibleOfficialModels.map((item) => {
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
            {isLocal
              ? (isZh ? "请先启动本地模型服务（如 Ollama / LM Studio），再点击「获取本地模型」" : "Start your local server (Ollama / LM Studio) and click Fetch Local Models")
              : (isZh ? "填写凭据后点击「获取官方模型」从官方接口实时加载真实可用模型" : "Click Fetch Official Models after entering credentials")}
          </span>
        )}
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          {isZh ? "上下文窗口（tokens，可选）" : "Context window (tokens, optional)"}
        </span>
        <input
          type="number"
          min={1000}
          step={1000}
          className={styles.input}
          value={contextWindow}
          placeholder={isZh ? "留空使用提供商默认值，不显示上下文占比" : "Empty = provider default; context % hidden"}
          onChange={(e) => setContextWindow(e.target.value)}
        />
      </label>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>
          {isZh ? "成本单价（元 / 百万 tokens，可选）" : "Price per 1M tokens (CNY, optional)"}
        </span>
        <div className={styles.priceRow}>
          <input
            type="number"
            min={0}
            step={0.01}
            className={styles.input}
            value={inputPrice}
            placeholder={isZh ? "输入" : "Input"}
            aria-label={isZh ? "输入单价" : "Input price"}
            onChange={(event) => setInputPrice(event.target.value)}
          />
          <input
            type="number"
            min={0}
            step={0.01}
            className={styles.input}
            value={outputPrice}
            placeholder={isZh ? "输出" : "Output"}
            aria-label={isZh ? "输出单价" : "Output price"}
            onChange={(event) => setOutputPrice(event.target.value)}
          />
          <input
            type="number"
            min={0}
            step={0.01}
            className={styles.input}
            value={cachedInputPrice}
            placeholder={isZh ? "缓存读取" : "Cached"}
            aria-label={isZh ? "缓存读取单价" : "Cached input price"}
            onChange={(event) => setCachedInputPrice(event.target.value)}
          />
        </div>
        <span className={styles.fieldHint}>
          {isZh
            ? "仅用于本地成本估算，不参与计费；缓存读取留空按输入单价计算。"
            : "Local cost estimate only; cached input falls back to the input price when empty."}
        </span>
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
  );
}

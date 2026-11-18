// 渲染输入栏单品牌官方模型列表与真实思考强度调节浮窗：
// 主视图仅显示当前已激活已配置品牌的真实官方模型；「模型管理」在浮窗原地切换已配置品牌卡槽（不跳设置页）；仅「配置模型卡片...」跳转设置中心。
import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconRefresh, IconSettings, IconX } from "@tabler/icons-react";
import { HoverTip, PopoverCard, StepSliderPopover, type StepSliderOption } from "@lfaa/ui-primitives/client";
import type { ModelCapabilityItem, PublicLlmProfileItem, ReasoningLevelOption } from "../chat-types";
import { getProtocolShortLabel } from "../provider-catalog";
import styles from "./ModelReasoningPicker.module.css";

type PickerPanelMode = "closed" | "models" | "brands" | "reasoning";

const REASONING_LABELS_ZH: Record<ReasoningLevelOption, string> = {
  minimal: "最低",
  low: "低",
  medium: "中",
  high: "高",
  max: "极高",
};

const REASONING_LABELS_EN: Record<ReasoningLevelOption, string> = {
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  max: "Max",
};

export function ModelReasoningPicker({
  isZh,
  profiles,
  activeProfileId,
  reasoningLevel,
  onSelectProfile,
  onSelectBrandModel,
  onRefreshBrandModels,
  onSelectReasoning,
  onOpenSettings,
}: {
  isZh: boolean;
  profiles: PublicLlmProfileItem[];
  activeProfileId: string;
  reasoningLevel: ReasoningLevelOption;
  onSelectProfile: (profileId: string) => void;
  onSelectBrandModel: (profileId: string, modelId: string) => void;
  onRefreshBrandModels: (profileId: string) => Promise<void>;
  onSelectReasoning: (level: ReasoningLevelOption) => void;
  onOpenSettings: () => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [panelMode, setPanelMode] = useState<PickerPanelMode>("closed");
  const [refreshing, setRefreshing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ tone: "success" | "error"; message?: string } | null>(null);

  useEffect(() => {
    if (syncFeedback?.tone !== "success") return;
    const timer = window.setTimeout(() => setSyncFeedback(null), 3500);
    return () => window.clearTimeout(timer);
  }, [syncFeedback]);

  useEffect(() => {
    if (panelMode === "closed") setSyncFeedback(null);
  }, [panelMode]);

  // 仅加载在设置中心完成配置或已填凭据的提供商
  const configuredProfiles = useMemo(
    () => profiles.filter((p) => p.configured || p.hasApiKey),
    [profiles],
  );

  const activeProfile =
    configuredProfiles.find((p) => p.id === activeProfileId) ?? configuredProfiles[0] ?? null;

  // 当前品牌下的真实官方模型清单：已同步过官方清单时严格只列出官方返回模型
  const brandModels = useMemo<ModelCapabilityItem[]>(() => {
    if (!activeProfile) return [];
    const list = activeProfile.availableModels ?? [];
    if (list.length > 0) return list;
    return [{ id: activeProfile.model, supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] }];
  }, [activeProfile]);

  const activeModelId =
    brandModels.find((m) => m.id === activeProfile?.model)?.id ?? brandModels[0]?.id ?? activeProfile?.model ?? "";

  const activeModelCap =
    brandModels.find((m) => m.id === activeModelId) ?? {
      id: activeModelId,
      supportsReasoning: false,
      reasoningMode: "none" as const,
      reasoningLevels: [],
    };

  const levelOptions = useMemo<Array<StepSliderOption<ReasoningLevelOption>>>(() => {
    if (activeModelCap.reasoningMode !== "effort") return [];
    return activeModelCap.reasoningLevels.map((id) => ({
      id,
      label: isZh ? REASONING_LABELS_ZH[id] : REASONING_LABELS_EN[id],
    }));
  }, [activeModelCap.reasoningLevels, activeModelCap.reasoningMode, isZh]);

  const effectiveReasoning = levelOptions.some((o) => o.id === reasoningLevel)
    ? reasoningLevel
    : (activeModelCap.defaultReasoningLevel && levelOptions.some((o) => o.id === activeModelCap.defaultReasoningLevel)
        ? activeModelCap.defaultReasoningLevel
        : (levelOptions[Math.max(0, levelOptions.length - 1)]?.id ?? "high"));
  const activeLevelLabel = levelOptions.find((o) => o.id === effectiveReasoning)?.label ?? "";

  if (!activeProfile) {
    return (
      <div className={styles.anchor}>
        <button
          type="button"
          className={styles.triggerPill}
          onClick={onOpenSettings}
        >
          <span>{isZh ? "未配置模型 · 去配置卡片" : "Configure Model"}</span>
          <IconChevronRight size={13} stroke={1.9} />
        </button>
      </div>
    );
  }

  return (
    <div ref={anchorRef} className={styles.anchor}>
      {/* 整体模型选择胶囊：统一弹出模型列表，推理强度仅在弹窗内调节 */}
      <HoverTip label={isZh ? "选择模型" : "Select model"} disabled={panelMode !== "closed"}>
        <button
          type="button"
          className={styles.triggerPill}
          aria-label={isZh ? "选择模型" : "Select model"}
          aria-expanded={panelMode !== "closed"}
          onClick={() => setPanelMode((prev) => (prev === "closed" ? "models" : "closed"))}
        >
          <span className={styles.modelLabel}>{activeModelId}</span>
          {activeModelCap.reasoningMode === "effort" && activeLevelLabel && (
            <span className={styles.reasoningLabel}>{activeLevelLabel}</span>
          )}
          {activeModelCap.reasoningMode === "fixed" && (
            <span className={styles.reasoningLabel}>{isZh ? "深度思考" : "Thinking"}</span>
          )}
          <IconChevronDown size={13} stroke={1.9} className={styles.chevronIcon} />
        </button>
      </HoverTip>

      {/* 视图 1：仅展示当前已配置激活品牌的官方真实模型列表 */}
      <PopoverCard
        open={panelMode === "models"}
        label={isZh ? "选择模型" : "Select Model"}
        placement="top-end"
        anchorRef={anchorRef}
        onClose={() => setPanelMode("closed")}
      >
        <div className={styles.modelPopoverCard}>
          <div className={styles.modelHeaderRow}>
            <span className={styles.modelHeader}>{activeProfile.name}</span>
            <button
              type="button"
              className={`${styles.iconActionBtn} ${
                syncFeedback?.tone === "success"
                  ? styles.syncBtnSuccess
                  : syncFeedback?.tone === "error"
                    ? styles.syncBtnError
                    : ""
              }`}
              disabled={refreshing}
              title={syncFeedback?.message || undefined}
              aria-live="polite"
              onClick={() => {
                setRefreshing(true);
                setSyncFeedback(null);
                void onRefreshBrandModels(activeProfile.id)
                  .then(() => {
                    setSyncFeedback({ tone: "success" });
                  })
                  .catch((err) => {
                    setSyncFeedback({
                      tone: "error",
                      message: err instanceof Error ? err.message : String(err),
                    });
                  })
                  .finally(() => setRefreshing(false));
              }}
            >
              {syncFeedback?.tone === "success" && !refreshing ? (
                <IconCheck size={12} stroke={2.2} />
              ) : syncFeedback?.tone === "error" && !refreshing ? (
                <IconX size={12} stroke={2.2} />
              ) : (
                <IconRefresh size={12} stroke={1.9} className={refreshing ? styles.spinIcon : undefined} />
              )}
              <span>
                {refreshing
                  ? (isZh ? "同步中…" : "Syncing…")
                  : syncFeedback?.tone === "success"
                    ? (isZh ? `已同步 · ${brandModels.length} 个` : `Synced · ${brandModels.length}`)
                    : syncFeedback?.tone === "error"
                      ? (isZh ? "同步失败" : "Failed")
                      : (isZh ? "同步官方" : "Sync")}
              </span>
            </button>
          </div>

          {syncFeedback?.tone === "error" && syncFeedback.message && (
            <div className={styles.syncErrorHint} role="alert">{syncFeedback.message}</div>
          )}

          <div className={styles.modelSubHeaderRow}>
            <span className={styles.modelGroupLabel}>{isZh ? "当前品牌官方模型" : "Official Brand Models"}</span>
            <span className={styles.protocolTag}>{getProtocolShortLabel(activeProfile.apiProtocol)}</span>
          </div>
          <div className={styles.modelList}>
            {brandModels.map((item) => {
              const selected = item.id === activeModelId;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.modelItem} ${selected ? styles.modelItemActive : ""}`}
                  onClick={() => {
                    onSelectBrandModel(activeProfile.id, item.id);
                    setPanelMode("closed");
                  }}
                >
                  <div className={styles.modelMeta}>
                    <span>{item.id}</span>
                    {item.displayName && item.displayName !== item.id && (
                      <span className={styles.modelSub}>{item.displayName}</span>
                    )}
                  </div>
                  {selected && <IconCheck size={15} stroke={2} />}
                </button>
              );
            })}
          </div>

          <div className={styles.popoverDivider} />

          {activeModelCap.reasoningMode === "effort" ? (
            <button
              type="button"
              className={styles.popoverFooterBtn}
              onClick={() => setPanelMode("reasoning")}
            >
              <span>{isZh ? `推理强度：${activeLevelLabel}` : `Reasoning: ${activeLevelLabel}`}</span>
              <IconChevronRight size={13} stroke={1.9} />
            </button>
          ) : activeModelCap.reasoningMode === "fixed" ? (
            <div className={styles.staticInfoRow}>
              {isZh ? "思考模式：官方原生固定开启（无多档强度）" : "Reasoning: Fixed native thinking"}
            </div>
          ) : (
            <div className={styles.staticInfoRow}>
              {isZh ? "当前模型为标准对话模型（无思考强度选项）" : "Standard model (no reasoning effort options)"}
            </div>
          )}

          {/* 原地切换至「模型管理」已配置品牌卡槽，不跳转设置中心 */}
          <button
            type="button"
            className={styles.popoverFooterBtn}
            onClick={() => setPanelMode("brands")}
          >
            <span>{isZh ? `模型管理（${configuredProfiles.length} 个已配置品牌）` : `Model Manager (${configuredProfiles.length})`}</span>
            <IconChevronRight size={13} stroke={1.9} />
          </button>

          <div className={styles.popoverDivider} />

          {/* 仅此一项跳转至设置中心进行新品牌首次配置 */}
          <button
            type="button"
            className={styles.popoverFooterBtn}
            onClick={() => {
              setPanelMode("closed");
              onOpenSettings();
            }}
          >
            <span>{isZh ? "配置模型卡片..." : "Configure Model Cards..."}</span>
            <IconSettings size={13} stroke={1.8} />
          </button>
        </div>
      </PopoverCard>

      {/* 视图 2：浮窗原地「模型管理」卡槽，切换不同已配置品牌 */}
      <PopoverCard
        open={panelMode === "brands"}
        label={isZh ? "模型管理" : "Model Manager"}
        placement="top-end"
        anchorRef={anchorRef}
        onClose={() => setPanelMode("closed")}
      >
        <div className={styles.modelPopoverCard}>
          <div className={styles.modelHeaderRow}>
            <button
              type="button"
              className={styles.iconActionBtn}
              onClick={() => setPanelMode("models")}
            >
              <IconChevronLeft size={13} stroke={1.9} />
              <span>{isZh ? "返回模型列表" : "Back"}</span>
            </button>
            <span className={styles.modelHeader}>{isZh ? "模型管理" : "Model Slots"}</span>
          </div>

          <div className={styles.modelGroupLabel}>{isZh ? "切换已配置品牌卡槽" : "Configured Providers"}</div>
          <div className={styles.modelList}>
            {configuredProfiles.map((p) => {
              const isCurrent = p.id === activeProfile.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.modelItem} ${isCurrent ? styles.modelItemActive : ""}`}
                  onClick={() => {
                    onSelectProfile(p.id);
                    setPanelMode("models");
                  }}
                >
                  <div className={styles.modelMeta}>
                    <span>{p.name}</span>
                    <span className={styles.modelSub}>{p.model}</span>
                  </div>
                  {isCurrent && <IconCheck size={15} stroke={2} />}
                </button>
              );
            })}
          </div>

          <div className={styles.popoverDivider} />
          <button
            type="button"
            className={styles.popoverFooterBtn}
            onClick={() => {
              setPanelMode("closed");
              onOpenSettings();
            }}
          >
            <span>{isZh ? "配置模型卡片..." : "Configure Model Cards..."}</span>
            <IconSettings size={13} stroke={1.8} />
          </button>
        </div>
      </PopoverCard>

      {/* 视图 3：仅在支持真实 reasoning_effort 的模型上启用滑块调节 */}
      <PopoverCard
        open={panelMode === "reasoning" && activeModelCap.reasoningMode === "effort"}
        label={isZh ? "选择推理强度" : "Select Reasoning Intensity"}
        placement="top-end"
        anchorRef={anchorRef}
        onClose={() => setPanelMode("closed")}
      >
        <StepSliderPopover
          options={levelOptions}
          value={effectiveReasoning}
          subtitle={activeModelId}
          onSubtitleClick={() => setPanelMode("models")}
          resetLabel={isZh ? "恢复官方默认强度" : "Reset default effort"}
          onReset={() => {
            const fallback =
              activeModelCap.defaultReasoningLevel && levelOptions.some((o) => o.id === activeModelCap.defaultReasoningLevel)
                ? activeModelCap.defaultReasoningLevel
                : (levelOptions[0]?.id ?? "high");
            onSelectReasoning(fallback);
          }}
          onChange={(nextLevel) => onSelectReasoning(nextLevel)}
        />
      </PopoverCard>
    </div>
  );
}

// 浏览器端聊天输入栏的模型选择器，连接当前模型档案、品牌切换和思考强度调节。
import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconChevronLeft, IconChevronRight, IconRefresh, IconSettings, IconX } from "@tabler/icons-react";
import { PopoverCard, StepSliderPopover } from "@lfaa/ui-primitives/client";
import { describeTokenPlanModel } from "@lfaa/llm/token-plan";
import { describeArkModelLine } from "@lfaa/llm/ark-plan";
import type { PublicLlmProfileItem, ReasoningLevelOption } from "../store/chat-types";
import { arkModelMessages, providerAccessMessages } from "../locales";
import { getProtocolShortLabel } from "./provider-catalog";
import { findProviderPlan } from "./provider-plans";
import { ModelOptionRow, ProfileSlotRow } from "./ModelReasoningList";
import {
  buildBrandModels,
  buildLevelOptions,
  describeModelCapability,
  filterConfiguredProfiles,
  resolveActiveModelCap,
  resolveActiveModelId,
  resolveActiveProfile,
  resolveArkModel,
  resolveArkPlan,
  resolveEffectiveReasoning,
  resolveResetReasoning,
} from "./model-reasoning-options";
import { ConfigureModelTrigger, ModelReasoningTrigger } from "./ModelReasoningTrigger";
import styles from "./ModelReasoningPicker.module.css";

type PickerPanelMode = "closed" | "models" | "brands" | "reasoning";

/** 管理同一个浮窗内的选模、品牌切换和强度调节，档案与设置由调用方维护。 */
export function ModelReasoningPicker({
  isZh,
  profiles,
  activeProfileId,
  reasoningLevel,
  compact = false,
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
  /** 聊天模式把触发胶囊压成纯图标，弹层内容与选择行为完全不变。 */
  compact?: boolean;
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

  // 成功反馈短暂显示，浮窗关闭或组件卸载时清理反馈与计时器。
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
    () => filterConfiguredProfiles(profiles),
    [profiles],
  );

  const activeProfile = resolveActiveProfile(configuredProfiles, activeProfileId);
  const providerPlan = activeProfile ? findProviderPlan(activeProfile) : undefined;
  const arkPlan = resolveArkPlan(activeProfile);
  const arkModel = resolveArkModel(activeProfile, arkPlan);
  const arkLabels = arkModelMessages[isZh ? "zh" : "en"];

  // 使用当前档案下发的模型清单，让选择器与发送路由共用同一份能力信息。
  const brandModels = useMemo(
    () => buildBrandModels(activeProfile, arkPlan).map((item) => {
      // 套餐模型的副标题显示「品牌 · 能力」的中英文对应文案。
      const label = describeTokenPlanModel(item.id, isZh) ?? describeArkModelLine(item.id, isZh);
      return label ? { ...item, displayName: label } : item;
    }),
    [activeProfile, arkPlan, isZh],
  );

  const activeModelId = resolveActiveModelId(arkModel, brandModels, activeProfile);

  const activeModelCap = resolveActiveModelCap(brandModels, activeModelId);

  // 模型按用途分组：语言 / 视觉（图像与视频）/ 语音，避免所有模型挤在一个长列表里。
  const modelSections = useMemo(() => {
    type Item = (typeof brandModels)[number];
    const groups = new Map<string, { label: string; items: Item[] }>();
    for (const item of brandModels) {
      const kind = item.modelKind ?? "chat";
      const key = kind === "image" || kind === "video" ? "vision" : kind === "audio" ? "speech" : "chat";
      const label = key === "vision"
        ? (isZh ? "视觉模型" : "Vision models")
        : key === "speech" ? (isZh ? "语音模型" : "Speech models") : (isZh ? "语言模型" : "Language models");
      const group = groups.get(key) ?? { label, items: [] };
      group.items.push(item);
      groups.set(key, group);
    }
    return ["chat", "vision", "speech"].flatMap((key) => {
      const group = groups.get(key);
      return group ? [{ key, label: group.label, items: group.items }] : [];
    });
  }, [brandModels, isZh]);

  // 只有模型支持多档强度才生成滑块选项。方舟的 minimal 若可关闭思考则显示「关闭」。
  const levelOptions = useMemo(
    () => buildLevelOptions({ activeModelCap, arkModel, arkLabels, isZh }),
    [activeModelCap.reasoningLevels, activeModelCap.reasoningMode, arkLabels, arkModel, isZh],
  );

  // 切换模型后优先保留仍受支持的档位，否则用该模型的默认档。
  const effectiveReasoning = resolveEffectiveReasoning(levelOptions, reasoningLevel, activeModelCap);
  const activeLevelLabel = levelOptions.find((o) => o.id === effectiveReasoning)?.label ?? "";

  if (!activeProfile) {
    return (
      <div className={styles.anchor}>
        <ConfigureModelTrigger isZh={isZh} compact={compact} onOpenSettings={onOpenSettings} />
      </div>
    );
  }

  return (
    <div ref={anchorRef} className={styles.anchor}>
      {/* 整体模型选择胶囊：统一弹出模型列表，推理强度仅在弹窗内调节 */}
      <ModelReasoningTrigger
        isZh={isZh}
        isOpen={panelMode !== "closed"}
        activeModelId={activeModelId}
        activeLevelLabel={activeLevelLabel}
        reasoningMode={activeModelCap.reasoningMode}
        compact={compact}
        onToggle={() => setPanelMode((prev) => (prev === "closed" ? "models" : "closed"))}
      />

      {/* 选模视图展示当前档案的模型，品牌切换在独立视图内处理。 */}
      <PopoverCard
        open={panelMode === "models"}
        label={isZh ? "选择模型" : "Select Model"}
        placement="top-end"
        className={styles.pickerPopover ?? ""}
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
                      : activeProfile.kind === "ollama"
                        ? (isZh ? "同步本地" : "Sync Local")
                        : (isZh ? "同步官方" : "Sync")}
              </span>
            </button>
          </div>

          {syncFeedback?.tone === "error" && syncFeedback.message && (
            <div className={styles.syncErrorHint} role="alert">{syncFeedback.message}</div>
          )}

          {/* 模型列表的标题说明目录来源，协议标签显示当前档案使用的接口格式。 */}
          <div className={styles.modelSubHeaderRow}>
            <span className={styles.modelGroupLabel}>
              {arkPlan ? (isZh ? "方舟官方模型目录" : "Official Ark catalog") : providerPlan
                ? providerAccessMessages[isZh ? "zh" : "en"].selectedModel
                : (isZh ? "当前品牌官方模型" : "Official Brand Models")}
            </span>
            <span className={styles.protocolTag}>{getProtocolShortLabel(activeProfile.apiProtocol)}</span>
          </div>
          <div className={styles.modelList}>
            {modelSections.map((section) => (
              <div key={section.key} className={styles.modelSection} role="group" aria-label={section.label}>
                <div className={styles.modelSectionLabel}>{section.label}</div>
                {section.items.map((item) => (
                  <ModelOptionRow
                    key={item.id}
                    item={item}
                    selected={item.id === activeModelId}
                    arkPlan={arkPlan}
                    arkLabels={arkLabels}
                    onSelect={() => {
                      onSelectBrandModel(activeProfile.id, item.id);
                      setPanelMode("closed");
                    }}
                  />
                ))}
              </div>
            ))}
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
              {arkPlan
                ? arkLabels.supported
                : (isZh ? "思考模式：官方原生固定开启（无多档强度）" : "Reasoning: Fixed native thinking")}
            </div>
          ) : activeModelCap.modelKind && activeModelCap.modelKind !== "chat" ? (
            <div className={styles.staticInfoRow}>
              {describeModelCapability(activeModelCap.modelKind, isZh)}
            </div>
          ) : (
            <div className={styles.staticInfoRow}>
              {arkModel?.status === "routed"
                ? arkLabels.routedReasoning
                : arkPlan ? arkLabels.unknownReasoning
                  : (isZh ? "当前模型为标准对话模型（无思考强度选项）" : "Standard model (no reasoning effort options)")}
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
        className={styles.pickerPopover ?? ""}
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
            {configuredProfiles.map((p) => (
              <ProfileSlotRow
                key={p.id}
                profile={p}
                current={p.id === activeProfile.id}
                onSelect={() => {
                  onSelectProfile(p.id);
                  setPanelMode("models");
                }}
              />
            ))}
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
        className={styles.pickerPopover ?? ""}
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
            onSelectReasoning(resolveResetReasoning(levelOptions, activeModelCap));
          }}
          onChange={(nextLevel) => onSelectReasoning(nextLevel)}
        />
      </PopoverCard>
    </div>
  );
}

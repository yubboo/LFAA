// 模型选择器的触发胶囊：分为「未配置模型」与「已选模型」两种展示，弹层由父级控制。
import { IconChevronDown, IconChevronRight, IconCpu } from "@tabler/icons-react";
import type { ModelCapabilityItem } from "../chat-types";
import { HoverTip } from "@lfaa/ui-primitives/client";
import styles from "./ModelReasoningPicker.module.css";

/** 渲染未配置模型时的引导胶囊，点击跳转设置中心完成首次配置。 */
export function ConfigureModelTrigger({
  isZh,
  onOpenSettings,
}: {
  isZh: boolean;
  onOpenSettings: () => void;
}) {
  const configureLabel = isZh ? "未配置模型 · 去配置卡片" : "Configure Model";
  return (
    <HoverTip label={configureLabel}>
      <button
        type="button"
        className={styles.triggerPill}
        aria-label={configureLabel}
        onClick={onOpenSettings}
      >
        <IconCpu size={16} className={styles.modelIcon} aria-hidden="true" />
        <span className={styles.modelLabel}>{configureLabel}</span>
        <IconChevronRight size={13} stroke={1.9} className={styles.chevronIcon} aria-hidden="true" />
      </button>
    </HoverTip>
  );
}

/** 渲染已选模型胶囊：展示模型 ID、推理强度提示，并切换选模弹层开关。 */
export function ModelReasoningTrigger({
  isZh,
  isOpen,
  activeModelId,
  activeLevelLabel,
  reasoningMode,
  onToggle,
}: {
  isZh: boolean;
  isOpen: boolean;
  activeModelId: string;
  activeLevelLabel: string;
  reasoningMode: ModelCapabilityItem["reasoningMode"];
  onToggle: () => void;
}) {
  return (
    <HoverTip label={isZh ? "选择模型" : "Select model"} disabled={isOpen}>
      <button
        type="button"
        className={styles.triggerPill}
        aria-label={isZh ? "选择模型" : "Select model"}
        aria-description={[activeModelId, activeLevelLabel].filter(Boolean).join(" · ")}
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <IconCpu size={16} className={styles.modelIcon} aria-hidden="true" />
        <span className={styles.modelLabel}>{activeModelId}</span>
        {reasoningMode === "effort" && activeLevelLabel && (
          <span className={styles.reasoningLabel}>{activeLevelLabel}</span>
        )}
        {reasoningMode === "fixed" && (
          <span className={styles.reasoningLabel}>{isZh ? "深度思考" : "Thinking"}</span>
        )}
        <IconChevronDown size={13} stroke={1.9} className={styles.chevronIcon} />
      </button>
    </HoverTip>
  );
}

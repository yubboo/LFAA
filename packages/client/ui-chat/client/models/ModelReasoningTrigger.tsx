// 模型选择器的触发胶囊：分为「未配置模型」与「已选模型」两种展示，弹层由父级控制。
import { IconChevronDown, IconChevronRight, IconCpu } from "@tabler/icons-react";
import type { ModelCapabilityItem } from "../store/chat-types";
import { HoverTip } from "@lfaa/ui-primitives/client";
import { shortcutHint } from "@lfaa/ui-layout/client";
import styles from "./ModelReasoningPicker.module.css";

/** 渲染未配置模型时的引导胶囊，点击跳转设置中心完成首次配置。 */
export function ConfigureModelTrigger({
  isZh,
  compact = false,
  onOpenSettings,
}: {
  isZh: boolean;
  /** 聊天模式只留图标：标签与箭头收进 aria-label / 悬浮提示，点击行为不变。 */
  compact?: boolean;
  onOpenSettings: () => void;
}) {
  const configureLabel = isZh ? "未配置模型 · 去配置卡片" : "Configure Model";
  const reasoningHint = shortcutHint("composer.reasoning");
  return (
    <HoverTip label={configureLabel} shortcut={reasoningHint}>
      <button
        type="button"
        className={styles.triggerPill}
        data-compact={compact || undefined}
        aria-label={configureLabel}
        onClick={onOpenSettings}
      >
        <IconCpu size={14} className={styles.modelIcon} aria-hidden="true" />
        {!compact && <span className={styles.modelLabel}>{configureLabel}</span>}
        {!compact && <IconChevronRight size={13} stroke={1.9} className={styles.chevronIcon} aria-hidden="true" />}
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
  compact = false,
  onToggle,
}: {
  isZh: boolean;
  isOpen: boolean;
  activeModelId: string;
  activeLevelLabel: string;
  reasoningMode: ModelCapabilityItem["reasoningMode"];
  /** 聊天模式只留芯片图标：模型 ID 与强度收进 aria-description 与悬浮提示。 */
  compact?: boolean;
  onToggle: () => void;
}) {
  return (
    <HoverTip label={isZh ? "选择模型与推理强度" : "Model and reasoning"} shortcut={shortcutHint("composer.reasoning")} disabled={isOpen}>
      <button
        type="button"
        className={styles.triggerPill}
        data-compact={compact || undefined}
        aria-label={isZh ? "选择模型" : "Select model"}
        aria-description={[activeModelId, activeLevelLabel].filter(Boolean).join(" · ")}
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <IconCpu size={14} className={styles.modelIcon} aria-hidden="true" />
        {!compact && <span className={styles.modelLabel}>{activeModelId}</span>}
        {!compact && reasoningMode === "effort" && activeLevelLabel && (
          <span className={styles.reasoningLabel}>{activeLevelLabel}</span>
        )}
        {!compact && reasoningMode === "fixed" && (
          <span className={styles.reasoningLabel}>{isZh ? "深度思考" : "Thinking"}</span>
        )}
        {!compact && <IconChevronDown size={13} stroke={1.9} className={styles.chevronIcon} />}
      </button>
    </HoverTip>
  );
}


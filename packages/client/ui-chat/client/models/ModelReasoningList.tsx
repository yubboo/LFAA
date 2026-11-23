// 模型选择弹层的列表行：渲染可选模型行与已配置品牌卡槽行，复用选择器样式与目录状态文案。
import { IconCheck } from "@tabler/icons-react";
import { findArkChatModel, type ArkPlanKind } from "@lfaa/llm/ark-plan";
import type { ModelCapabilityItem, PublicLlmProfileItem } from "../store/chat-types";
import type { ArkModelLabels } from "./model-reasoning-options";
import styles from "./ModelReasoningPicker.module.css";

/** 渲染单个可选模型行；方舟目录内的模型附带「即将下线 / 控制台路由」状态文案。 */
export function ModelOptionRow({
  item,
  selected,
  arkPlan,
  arkLabels,
  onSelect,
}: {
  item: ModelCapabilityItem;
  selected: boolean;
  arkPlan: ArkPlanKind | undefined;
  arkLabels: ArkModelLabels;
  onSelect: () => void;
}) {
  const status = arkPlan ? findArkChatModel(item.id)?.status : undefined;
  // 「控制台路由」已经写在副标题的方舟能力里，再单独占一行就是重复；只保留「即将下线」这类额外状态。
  const statusLabel = status && status !== "routed" ? arkLabels[status] : "";
  return (
    <button
      type="button"
      className={`${styles.modelItem} ${selected ? styles.modelItemActive : ""}`}
      onClick={onSelect}
    >
      <div className={styles.modelMeta}>
        <span>{item.id}</span>
        {item.displayName && item.displayName !== item.id && (
          <span className={styles.modelCap}>{item.displayName}</span>
        )}
        {statusLabel && <span className={styles.modelSub}>{statusLabel}</span>}
      </div>
      {selected && <IconCheck size={15} stroke={2} />}
    </button>
  );
}

/** 渲染已配置品牌卡槽行，当前卡槽带选中态。 */
export function ProfileSlotRow({
  profile,
  current,
  onSelect,
}: {
  profile: PublicLlmProfileItem;
  current: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.modelItem} ${current ? styles.modelItemActive : ""}`}
      onClick={onSelect}
    >
      <div className={styles.modelMeta}>
        <span>{profile.name}</span>
        <span className={styles.modelSub}>{profile.model}</span>
      </div>
      {current && <IconCheck size={15} stroke={2} />}
    </button>
  );
}

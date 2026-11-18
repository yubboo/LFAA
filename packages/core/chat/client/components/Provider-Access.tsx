// 浏览器端模型接入选择弹窗，根据品牌套餐目录和已保存档案显示可用入口。
import { useId } from "react";
import { ModalDialog } from "@lfaa/ui-primitives/client";
import type { PublicLlmProfileItem } from "../chat-types";
import { providerAccessMessages } from "../locales";
import { findProfileForProvider, type ModelProviderPreset } from "../provider-catalog";
import { getProviderPlans } from "../provider-plans";
import styles from "./Provider-Access.module.css";

/** 选择要进入的 API 或套餐表单，并在返回时恢复上一个选项的焦点。 */
export function ProviderAccess({
  isZh,
  ordinary,
  profiles,
  focusPresetId,
  onSelect,
  onClose,
}: {
  isZh: boolean;
  ordinary: ModelProviderPreset;
  profiles: PublicLlmProfileItem[];
  focusPresetId?: string | undefined;
  onSelect: (preset: ModelProviderPreset) => void;
  onClose: () => void;
}) {
  const headingId = useId();
  const labels = providerAccessMessages[isZh ? "zh" : "en"];
  const providerName = isZh ? ordinary.nameZh : ordinary.nameEn;

  // 已保存的各接入方式都可以直接重开对应档案。
  const choice = (preset: ModelProviderPreset, title: string, description: string) => (
    <button
      key={preset.id}
      type="button"
      className={styles.choice}
      autoFocus={(focusPresetId ?? ordinary.id) === preset.id}
      onClick={() => onSelect(preset)}
    >
      <span className={styles.choiceHeader}>
        <strong>{title}</strong>
        {findProfileForProvider(profiles, preset) && (
          <span className={styles.reconfigure}>{labels.reconfigure}</span>
        )}
      </span>
      <span className={styles.description}>{description}</span>
    </button>
  );

  return (
    <ModalDialog
      open
      title={`${providerName} · ${labels.title}`}
      closeLabel={labels.close}
      size="md"
      onClose={onClose}
    >
      <div className={styles.choices}>
        {choice(ordinary, labels.api, labels.apiDescription)}
        {/* 每个套餐使用独立预设，打开已存在的档案时显示「重新配置」。 */}
        <section className={styles.choices} aria-labelledby={headingId}>
          <h3 id={headingId} className={styles.heading}>{labels.subscription}</h3>
          {getProviderPlans(ordinary.id).map((preset) => choice(
            preset,
            preset.accessLabel,
            isZh ? preset.descZh : preset.descEn,
          ))}
        </section>
      </div>
    </ModalDialog>
  );
}

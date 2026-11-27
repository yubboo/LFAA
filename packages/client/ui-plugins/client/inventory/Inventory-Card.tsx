// 插件清单卡片：折叠时显示标题、两行描述、条目 id 与状态标签；展开后显示完整名称、来源与状态事实。
import { IconChevronDown } from "@tabler/icons-react";
import type { PluginFiberPhase, PluginInventoryEntry } from "@lfaa/plugins/contract";
import type { InventoryMessages } from "./locales";
import styles from "./Plugin-Inventory.module.css";

/** 根 Fiber 相位到文案的映射。 */
function phaseLabel(phase: PluginFiberPhase, t: InventoryMessages): string {
  switch (phase) {
    case "pending": return t.pending;
    case "loading": return t.loading;
    case "unloading": return t.unloading;
    case "failed": return t.failed;
    case "active": return t.running;
    default: return t.unobserved;
  }
}

/** 只有会持续一段时间的相位才画状态点；运行中与失败由标签表达。 */
function phaseDot(phase: PluginFiberPhase): "pending" | "ongoing" | null {
  if (phase === "pending") return "pending";
  if (phase === "loading" || phase === "unloading") return "ongoing";
  return null;
}

/** 单张清单卡片；来源预设为空表示系统装配的全局插件。 */
export function InventoryCard({
  entry,
  t,
  isZh,
  fromPreset,
  open,
  onToggle,
  onSetEnabled,
  busy,
}: {
  entry: PluginInventoryEntry;
  t: InventoryMessages;
  isZh: boolean;
  /** 该行所属的会话预设名；全局插件不传。 */
  fromPreset?: string;
  open: boolean;
  onToggle: () => void;
  /** 启停入口；静态装配的条目没有这个回调。 */
  onSetEnabled?: (enabled: boolean) => void;
  /** 启停请求进行中：按钮禁用并显示同一句提示。 */
  busy?: boolean;
}) {
  const title = entry.meta.title[isZh ? "zh" : "en"] || entry.meta.title.zh;
  const description = entry.meta.description[isZh ? "zh" : "en"] || entry.meta.description.zh;
  const failed = entry.fiberPhase === "failed";
  const tag = failed ? t.failed : entry.enabled ? null : t.disabled;
  const dot = entry.enabled && !failed ? phaseDot(entry.fiberPhase) : null;
  const showId = entry.entryId !== title;
  // 静态装配条目用包名短名作标识，去掉 bundle: 前缀更接近 DSH 的条目 id。
  const idText = entry.entryId.startsWith("bundle:")
    ? entry.moduleName.replace(/^@[^/]+\//u, "")
    : entry.entryId;
  const detailId = `plugin-detail-${encodeURIComponent(entry.entryId)}`;

  return (
    <li className={styles.card} data-open={open} data-failed={failed}>
      <button
        type="button"
        className={styles.cardButton}
        aria-expanded={open}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <span className={styles.titleRow}>
          <span className={styles.cardTitle} title={entry.moduleName}>{title}</span>
          <span className={styles.trailing}>
            {dot && <span className={styles.dot} data-state={dot} aria-hidden="true" />}
            {tag && <span className={styles.tag} data-tone={failed ? "danger" : "neutral"}>{tag}</span>}
            <IconChevronDown className={styles.chevron} size={13} aria-hidden="true" />
          </span>
        </span>
        {description && <span className={styles.cardDesc}>{description}</span>}
        {showId && <code className={styles.idChip} title={entry.moduleName}>{idText}</code>}
      </button>

      {open && (
        <div className={styles.details} id={detailId}>
          <dl className={styles.facts}>
            <div><dt>{t.moduleLabel}</dt><dd>{entry.moduleName}</dd></div>
            {fromPreset && <div><dt>{t.fromPreset}</dt><dd>{fromPreset}</dd></div>}
            <div><dt>{t.configuration}</dt><dd>{entry.enabled ? t.enabled : t.disabled}</dd></div>
            <div><dt>{t.runtime}</dt><dd>{phaseLabel(entry.fiberPhase, t)}</dd></div>
          </dl>
          {entry.meta.error && <p className={styles.error}>{t.metadataError.replace("{error}", entry.meta.error)}</p>}
          {entry.diagnostic && <p className={styles.error}>{entry.diagnostic}</p>}
          {onSetEnabled && (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.actionButton}
                disabled={busy === true}
                onClick={() => onSetEnabled(!entry.enabled)}
              >
                {entry.enabled ? t.toggleDisable : t.toggleEnable}
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
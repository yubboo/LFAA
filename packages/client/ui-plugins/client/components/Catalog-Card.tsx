// @lfaa/plugins 插件中心目录卡片：区分「已装配」「已安装」与可安装三种状态，并提供安装入口。
import type { PluginCatalogItem } from "@lfaa/plugins/contract";
import type { PluginsMessages } from "../locales";
import styles from "./Plugins-View.module.css";



/** 单张可安装目录卡片。`provided` 表示该能力已由当前应用装配，禁止重复安装。 */
export function CatalogCard({
  entry,
  t,
  busy,
  busyLabel,
  onInstall,
}: {
  entry: PluginCatalogItem;
  t: PluginsMessages;
  busy: boolean;
  /** 该卡片的操作正在执行时显示的文字；为空表示不在执行。 */
  busyLabel?: string | undefined;
  onInstall: () => void;
}) {
  return (
    <div className={styles.card} data-provided={entry.provided === true}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{entry.manifest.name}</span>
        {/* 右上角只留来源标记；装配状态放左下，避免同一信息重复三次 */}
        {entry.kind === "builtin" && <span className={styles.badge}>{t.builtinBadge}</span>}
      </div>
      <p className={styles.desc}>{entry.manifest.description}</p>
      <p className={styles.meta}>{t.moduleLabel}{entry.moduleName}</p>
      {entry.provided && <p className={styles.hint}>{t.providedHint}</p>}
      {busyLabel && (
        <p className={styles.progressRow} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          {busyLabel}…
        </p>
      )}
      <div className={styles.actions}>
        {entry.provided ? (
          <span className={`${styles.badge} ${styles.badgeProvided}`}>{t.providedBadge}</span>
        ) : entry.installed ? (
          <span className={styles.badge}>{t.installedBadge}</span>
        ) : (
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy} onClick={onInstall}>
            {/* 内置插件不存在"安装"：未装配时就是一次启用 */}
            {entry.kind === "builtin" ? t.enable : t.install}
          </button>
        )}
      </div>
    </div>
  );
}

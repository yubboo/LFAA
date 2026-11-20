// @lfaa/plugins 插件中心已安装插件卡片：展示运行时状态、包名与失败原因，并承载启停/编辑/卸载操作。
import { IconCopy, IconEdit, IconPlayerPlay, IconPlayerStop, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import type { PluginRecord } from "../contract/index";
import type { PluginsMessages } from "./locales";
import styles from "./Plugins-View.module.css";



/** 单张已安装插件卡片。`busy` 为真时禁用全部操作，避免并发状态切换。 */
export function PluginCard({
  record,
  t,
  busy,
  busyLabel,
  onEnable,
  onDisable,
  onUninstall,
  onUpdate,
  onFork,
}: {
  record: PluginRecord;
  t: PluginsMessages;
  busy: boolean;
  /** 该卡片的操作正在执行时显示的文字；为空表示不在执行。 */
  busyLabel?: string | undefined;
  onEnable: () => void;
  onDisable: () => void;
  onUninstall: () => void;
  onUpdate: (patch: { name?: string; description?: string }) => void;
  onFork: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(record.manifest.name);
  const [description, setDescription] = useState(record.manifest.description);
  const running = record.status === "running";
  const failed = record.status === "error";

  return (
    <div className={styles.card} data-status={record.status}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{record.manifest.name}</span>
        <span className={`${styles.badge} ${running ? styles.badgeRunning : ""} ${failed ? styles.badgeError : ""}`}>
          {t.statusMap[record.status]}
        </span>
      </div>
      <p className={styles.desc}>{record.manifest.description}</p>
      <p className={styles.meta}>{record.kind === "builtin" ? `${t.builtinBadge} · ` : ""}{t.moduleLabel}{record.moduleName}</p>
      {busyLabel && (
        <p className={styles.progressRow} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          {busyLabel}…
        </p>
      )}
      {record.error && (
        <p className={styles.errorText} role="alert">{t.errorLabel}{record.error}</p>
      )}

      {editing && (
        <div className={styles.editBox}>
          <input className={styles.searchInput} value={name} onChange={(event) => setName(event.target.value)} />
          <input
            className={styles.searchInput}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={busy}
              onClick={() => {
                onUpdate({ name, description });
                setEditing(false);
              }}
            >
              {t.save}
            </button>
            <button type="button" className={styles.btn} onClick={() => setEditing(false)}>{t.cancel}</button>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        {running ? (
          <button type="button" className={styles.btn} disabled={busy} onClick={onDisable}>
            <IconPlayerStop size={13} /> {t.disable}
          </button>
        ) : (
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy} onClick={onEnable}>
            <IconPlayerPlay size={13} /> {t.enable}
          </button>
        )}
        <button
          type="button"
          className={styles.btn}
          disabled={busy}
          onClick={() => {
            setEditing(true);
            setName(record.manifest.name);
            setDescription(record.manifest.description);
          }}
        >
          <IconEdit size={13} /> {t.edit}
        </button>
        <button type="button" className={styles.btn} disabled title={t.forkUnavailable} onClick={onFork}>
          <IconCopy size={13} /> {t.fork}
        </button>
        {record.kind === "builtin" ? null : (
          <button type="button" className={styles.btn} disabled={busy} onClick={onUninstall}>
            <IconTrash size={13} /> {t.uninstall}
          </button>
        )}
      </div>
    </div>
  );
}

// 项目创建前的信任确认视图：展示目标路径与风险说明，确认后才真正落盘。
// 从 ProjectDialog 拆出：这是独立的一屏，只依赖目标路径、提交状态与两个回调。
import { IconX } from "@tabler/icons-react";
import type { WorkspaceLocaleMessages } from "../locales";
import styles from "./ProjectDialog.module.css";

/** 信任确认：确认 = 创建并信任该目录，取消 = 退回到表单。 */
export function ProjectTrustPrompt({ locale, targetPath, submitting, error, onConfirm, onCancel }: {
  locale: WorkspaceLocaleMessages;
  targetPath: string;
  submitting: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.trustBody}>
      <button
        className={`${styles.close} ${styles.trustClose}`}
        type="button"
        aria-label={locale.close}
        disabled={submitting}
        onClick={onCancel}
      >
        <IconX />
      </button>
      <h2 id="lfaa-project-title" className={styles.trustTitle}>{locale.trustTitle}</h2>
      <p className={styles.trustPath}>{targetPath}</p>
      <p className={styles.trustDesc}>{locale.trustDescription}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.trustActions}>
        <button type="button" className={styles.trustConfirm} disabled={submitting} onClick={onConfirm}>
          {locale.trustConfirm}
        </button>
        <button type="button" className={styles.trustCancel} disabled={submitting} onClick={onCancel}>
          {locale.cancel}
        </button>
      </div>
    </div>
  );
}
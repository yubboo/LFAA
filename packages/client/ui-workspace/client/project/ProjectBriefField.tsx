// 项目简介输入区：创建/编辑项目共用，展示自动生成初稿、字数与重新生成入口。
import type { WorkspaceLocaleMessages } from "../locales";
import styles from "./ProjectBriefField.module.css";

/** 项目简介上限需与 Host 侧 MAX_PROJECT_BRIEF_CHARS 保持一致。 */
export const PROJECT_BRIEF_MAX_LENGTH = 500;

export function ProjectBriefField({
  locale,
  value,
  disabled = false,
  generating = false,
  onChange,
  onRegenerate,
}: {
  locale: WorkspaceLocaleMessages;
  value: string;
  disabled?: boolean;
  generating?: boolean;
  onChange: (value: string) => void;
  onRegenerate?: () => void;
}) {
  return (
    <div className={styles.field}>
      <div className={styles.header}>
        <span className={styles.label}>{locale.projectScopeLabel}</span>
        {onRegenerate && (
          <button
            type="button"
            className={styles.regenerate}
            disabled={disabled || generating}
            onClick={onRegenerate}
          >
            {generating ? locale.generatingBrief : locale.regenerateBrief}
          </button>
        )}
      </div>
      <textarea
        className={styles.textarea}
        value={value}
        disabled={disabled}
        maxLength={PROJECT_BRIEF_MAX_LENGTH}
        rows={3}
        placeholder={locale.projectScopePlaceholder}
        aria-label={locale.projectScopeLabel}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <div className={styles.footer}>
        <small className={styles.hint}>{locale.projectScopeHint}</small>
        <small className={styles.count}>{value.trim().length}/{PROJECT_BRIEF_MAX_LENGTH}</small>
      </div>
    </div>
  );
}
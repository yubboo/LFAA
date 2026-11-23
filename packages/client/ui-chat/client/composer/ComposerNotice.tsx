// 输入框上方的上下文提示条：显示一次性提示与关闭按钮。
import { IconX } from "@tabler/icons-react";
import styles from "../conversation/ChatWorkspace.composer.module.css";

/** 上下文提示条：消息为空时不渲染。 */
export function ComposerNotice({
  message,
  dismissLabel,
  onDismiss,
}: {
  message: string;
  dismissLabel: string;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <div className={styles.contextNotice} role="status">
      <span>{message}</span>
      <button
        type="button"
        className={styles.contextNoticeClose}
        aria-label={dismissLabel}
        onClick={onDismiss}
      >
        <IconX size={12} aria-hidden="true" />
      </button>
    </div>
  );
}
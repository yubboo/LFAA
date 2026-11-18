// 提供全站复用的语义化状态通知横幅（success / error / warning / info / loading），统一通知视觉对比度与关闭交互。
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconLoader2,
  IconX,
} from "@tabler/icons-react";
import type { StatusTone } from "../src/index";
import styles from "./StatusBanner.module.css";

const TONE_CLASS: Record<StatusTone, string | undefined> = {
  success: styles.toneSuccess,
  error: styles.toneError,
  warning: styles.toneWarning,
  info: styles.toneInfo,
  loading: styles.toneLoading,
};

/** 定义通知状态、文案与可选关闭回调，供设置和运行反馈复用。 */
export interface StatusBannerProps {
  tone?: StatusTone;
  title?: string;
  message: string;
  dismissLabel?: string;
  onDismiss?: () => void;
  className?: string;
}

function renderToneIcon(tone: StatusTone) {
  if (tone === "success") return <IconCircleCheck size={16} stroke={2} />;
  if (tone === "error") return <IconAlertCircle size={16} stroke={2} />;
  if (tone === "warning") return <IconAlertTriangle size={16} stroke={2} />;
  if (tone === "loading") return <IconLoader2 size={16} stroke={2} className={styles.spin} />;
  return <IconInfoCircle size={16} stroke={2} />;
}

/** 按语义状态呈现统一的通知横幅，加载、失败和成功各自有明确状态。 */
export function StatusBanner({
  tone = "info",
  title,
  message,
  dismissLabel = "关闭提示",
  onDismiss,
  className,
}: StatusBannerProps) {
  return (
    <div
      role="status"
      className={`${styles.banner} ${TONE_CLASS[tone] ?? ""}${className ? ` ${className}` : ""}`}
    >
      <div className={styles.main}>
        <span className={styles.icon} aria-hidden="true">
          {renderToneIcon(tone)}
        </span>
        <div className={styles.content}>
          {title && <span className={styles.title}>{title}</span>}
          <span className={styles.message}>{message}</span>
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          className={styles.dismissBtn}
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          <IconX size={14} stroke={1.9} />
        </button>
      )}
    </div>
  );
}

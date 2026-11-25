// 共享悬停提示胶囊组件：统一在触发按钮正上方居中展示暗色圆角提示与快捷键徽章。
import type { ReactNode } from "react";
import styles from "./HoverTip.module.css";

/** 为触发元素提供悬停提示与快捷键标签；multiline 用于完整路径这类可能很长的文案。 */
export function HoverTip({
  label,
  shortcut,
  disabled = false,
  multiline = false,
  children,
}: {
  label: string;
  shortcut?: string | undefined;
  disabled?: boolean | undefined;
  multiline?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <span className={`${styles.wrap} ${disabled ? styles.disabled : ""}`}>
      {children}
      {!disabled && label && (
        <span className={`${styles.tip} ${multiline ? styles.tipMultiline : ""}`} role="tooltip">
          <span>{label}</span>
          {shortcut && <span className={styles.kbd}>{shortcut}</span>}
        </span>
      )}
    </span>
  );
}

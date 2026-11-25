// 活动行路径气泡：文件行与目录/工具行共用的唯一实现，悬停时在目标上方浮出完整路径。
import type { ReactNode } from "react";
import { FileTypeIcon } from "@lfaa/ui-icons/client";
import styles from "./Activity-Path-Tip.module.css";

export function ActivityPathTip({
  path,
  text,
  kind = "file",
  className,
  children,
}: {
  /** 用于文件类型图标的路径。 */
  path: string;
  /** 气泡里展示的完整路径文本。 */
  text: string;
  /** 图标类型：文件或目录。 */
  kind?: "file" | "directory" | undefined;
  className?: string | undefined;
  /** 需要悬停触发的行内目标（通常是文件芯片或工具目标）。 */
  children: ReactNode;
}) {
  return (
    <span className={className ? `${styles.anchor} ${className}` : styles.anchor}>
      {children}
      <span className={styles.tip} role="tooltip">
        <FileTypeIcon name={path} kind={kind} size={13} className={styles.glyph ?? ""} />
        <span className={styles.text}>{text}</span>
      </span>
    </span>
  );
}
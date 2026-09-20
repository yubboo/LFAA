/**
 * Workbench 框架级图标按钮。只负责 DOM/ARIA/Tooltip，不拥有 Shell 状态。
 */
import type { ReactNode } from "react";
import styles from "../styles/ShellHeaderButton.module.css";

export function ShellHeaderButton({ label, shortcut, active = false, expanded, onClick, onMouseEnter, onMouseLeave, onFocus, onBlur, tooltipAlign = "center", children }: {
  label: string;
  shortcut: string;
  active?: boolean;
  expanded?: boolean;
  tooltipAlign?: "start" | "center" | "end";
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`${styles.button}${active ? ` ${styles.active}` : ""}`}
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label={`${label}，快捷键 ${shortcut}`}
      aria-expanded={expanded}
    >
      {children}
      <span className={`${styles.tooltip} ${styles[tooltipAlign]}`} role="presentation">
        <span>{label}</span><kbd>{shortcut}</kbd>
      </span>
    </button>
  );
}

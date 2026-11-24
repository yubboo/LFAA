// 共享「展开/收起」图标按钮：分栏线随展开状态滑动，过渡时长与曲线统一消费 @lfaa/ui-theme 动效令牌。
// 左右栏、抽屉或其他面板切换都直接复用本组件，不再各写一份图标与状态样式。
import styles from "./PanelToggleButton.module.css";

/** 面板所在方向：右侧按钮沿用同一图形整体镜像，分栏线滑向另一侧。 */
export type PanelToggleSide = "left" | "right";

/** 渲染可复用的面板展开/收起按钮；展开状态、动作文案与点击回调由调用方持有。 */
export function PanelToggleButton({
  expanded,
  label,
  onClick,
  side = "left",
  className,
  disabled = false,
}: {
  expanded: boolean;
  /** 当前动作文案（收起 / 展开），同时作为 aria-label 与原生 title。 */
  label: string;
  onClick: () => void;
  side?: PanelToggleSide;
  className?: string | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <button
      className={`${styles.button}${className ? ` ${className}` : ""}`}
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      data-expanded={expanded ? "true" : "false"}
      data-side={side}
      disabled={disabled}
      onClick={onClick}
    >
      <svg className={styles.glyph} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4" y="4" width="16" height="16" rx="2.6" />
        <line className={styles.divider} x1="9" y1="5" x2="9" y2="19" />
      </svg>
    </button>
  );
}

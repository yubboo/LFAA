// @lfaa/chat 实时状态的小鱼动画：替代转圈指示，鱼身沿路径摆动并循环游动。
import styles from "./Live-Fish.module.css";

/** 一条循环游动的小鱼，用于「模型正在推理 / 正在回复」等运行中状态。 */
export function LiveFish({ className }: { className?: string }) {
  return (
    <span className={`${styles.swimmer} ${className ?? ""}`} aria-hidden="true">
      <svg className={styles.fish} viewBox="0 0 34 16" role="presentation">
        {/* 身体 */}
        <path
          className={styles.body}
          d="M4 8c4-5.2 12-6.4 18-2.6 2.6 1.7 4.8 2.6 7 2.6-2.2 0-4.4.9-7 2.6C16 14.4 8 13.2 4 8Z"
        />
        {/* 尾巴 */}
        <path className={styles.tail} d="M22.6 8c2.6-2 4.6-3.4 6.4-4.2L27.4 8l1.6 4.2c-1.8-.8-3.8-2.2-6.4-4.2Z" />
        {/* 眼睛 */}
        <circle className={styles.eye} cx="9.2" cy="7" r="0.9" />
      </svg>
    </span>
  );
}

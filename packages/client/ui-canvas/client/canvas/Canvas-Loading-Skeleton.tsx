// 无限画布打开过渡骨架屏：淡点阵画布底纹 + 顶/底胶囊与居中三张扫光节点卡片骨架，平滑过渡至真实画布。
// 关联：packages/client/ui-canvas/client/canvas/Canvas-Workspace.tsx；运行环境：浏览器。
import styles from "./Canvas-Loading-Skeleton.module.css";

export function CanvasLoadingSkeleton({ isZh }: { isZh: boolean }) {
  return (
    <div
      className={styles.skeleton}
      role="status"
      aria-label={isZh ? "正在打开画布" : "Opening canvas"}
    >
      <div className={styles.topRow} aria-hidden="true">
        <div className={`${styles.bar} ${styles.topLeft}`} />
        <div className={`${styles.bar} ${styles.topRight}`} />
      </div>

      <div className={styles.stage} aria-hidden="true">
        <div className={`${styles.card} ${styles.cardLeft}`} />
        <div className={`${styles.card} ${styles.cardCenter}`} />
        <div className={`${styles.card} ${styles.cardRight}`} />
      </div>

      <div className={styles.bottomRow} aria-hidden="true">
        <div className={`${styles.bar} ${styles.bottomDock}`} />
      </div>
    </div>
  );
}

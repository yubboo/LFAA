// 自定义画布贝塞尔连线：默认精致细线/虚线，选中或运行态叠加流光脉冲，严格消费主题色变量。
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import styles from "./Graph-Node.module.css";

export function CanvasEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.38,
  });

  const pending = Boolean((data as { pending?: boolean } | undefined)?.pending);
  const running = Boolean((data as { running?: boolean } | undefined)?.running);

  return (
    <g className={styles.edgeGroup} data-selected={selected ? "true" : undefined} data-pending={pending ? "true" : undefined} data-running={running ? "true" : undefined}>
      <BaseEdge id={id} path={edgePath} className={styles.edgeBase} />
      {(selected || running || !pending) && (
        <path d={edgePath} pathLength={1} data-canvas-edge-pulse="" className={styles.edgeGlow} fill="none" />
      )}
    </g>
  );
}

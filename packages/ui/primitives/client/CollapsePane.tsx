// 共享折叠面板容器：展开即挂载、收起后等过渡结束再卸载，并裁剪溢出的固定宽度内容，
// 使面板在收起过程中不被挤压重排；容器宽度动画由调用方（如四栏 Shell 的栅格轨道）控制。
import type { ReactNode } from "react";
import { usePanePresence } from "./usePanePresence";
import styles from "./CollapsePane.module.css";

/** 渲染带挂载保持、裁剪与无障碍状态的折叠容器。 */
export function CollapsePane({
  open,
  children,
  side = "left",
  durationMs,
  className,
}: {
  open: boolean;
  children: ReactNode;
  side?: "left" | "right";
  /** 收起过渡时长；不传时按动效令牌与「减少动态效果」设置自动决定。 */
  durationMs?: number | undefined;
  className?: string | undefined;
}) {
  const mounted = usePanePresence(open, durationMs);
  if (!mounted) return null;

  return (
    <div
      className={`${styles.pane}${className ? ` ${className}` : ""}`}
      data-pane-state={open ? "open" : "closed"}
      data-pane-side={side}
      aria-hidden={open ? undefined : true}
      inert={open ? undefined : true}
    >
      {children}
    </div>
  );
}

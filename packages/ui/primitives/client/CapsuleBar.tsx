// 工作台头部胶囊条：左二菜单栏头部与中间区域顶栏共用同一份「圆角卡片 + 一排动作」外观，
// 尺寸走 --capsule-* 变量，调用方只按栏位收紧内边距或间距，不再各自写一套圆角与描边。
import type { HTMLAttributes, ReactNode } from "react";
import styles from "./CapsuleBar.module.css";

export interface CapsuleBarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** 头部胶囊容器：主题色、圆角、描边、阴影与两端分布都在这里定义一次。 */
export function CapsuleBar({ children, className, ...rest }: CapsuleBarProps) {
  return (
    <div {...rest} className={className ? `${styles.capsule} ${className}` : styles.capsule}>
      {children}
    </div>
  );
}
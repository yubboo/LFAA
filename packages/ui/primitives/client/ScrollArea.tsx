// 共享滚动容器：统一「透明轨道 + 强调色圆角滑块」的细滚动条，并负责滚动方向、槽位预留与滚动高亮反馈。
// 工作台各栏、弹窗与列表都直接复用它，不再各自抄一份 ::-webkit-scrollbar 颜色；颜色只消费 @lfaa/ui-theme 令牌。
import { useCallback, useEffect, useRef, type HTMLAttributes, type ReactNode, type Ref } from "react";
import styles from "./ScrollArea.module.css";

/** 滚动方向：纵向（默认）、横向或双向；调用方仍可用自己的类覆盖，便于按断点切换。 */
export type ScrollAxis = "y" | "x" | "both";

/** 共享滚动容器的属性；未声明的原生 div 属性原样透传。 */
export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** 滚动方向，默认纵向。 */
  axis?: ScrollAxis;
  /** 常驻预留滚动条槽，内容长短切换时不左右抖动。 */
  stableGutter?: boolean;
  /** 绑到滚动视口本身，调用方可直接读写 scrollTop 或做测量。 */
  ref?: Ref<HTMLDivElement>;
}

/** 渲染带统一样式的滚动视口；滚动条外观与滚动高亮由组件自己维护。 */
export function ScrollArea({
  axis = "y",
  stableGutter = false,
  className,
  children,
  ref: forwardedRef,
  ...rest
}: ScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // 内部监听和调用方 ref 绑到同一个节点；ref 变化时才重新挂接，避免每次渲染都重绑。
  const attachRef = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  // 滚动期间给视口打上 data-scrolling，让滑块临时加深；停下后收回，恢复常态配色。
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof window === "undefined") return;
    let timer = 0;
    const handleScroll = () => {
      viewport.dataset.scrolling = "true";
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        delete viewport.dataset.scrolling;
      }, 700);
    };
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
      window.clearTimeout(timer);
      delete viewport.dataset.scrolling;
    };
  }, []);

  return (
    <div
      {...rest}
      ref={attachRef}
      className={`${styles.scrollArea}${className ? ` ${className}` : ""}`}
      data-axis={axis}
      data-gutter={stableGutter ? "stable" : undefined}
    >
      {children}
    </div>
  );
}
// 维护会话页两个布局测量值：外层视口预留的滚动条槽（收回）与输入区实际高度（正文让位）。
import { useLayoutEffect, type RefObject } from "react";

/**
 * 外层工作区视口给「长页面」常驻预留了一条滚动条槽（设置中心等靠它热切换不抖动）；
 * 会话页整页由内部滚动区负责，永远用不到那条槽。留着会把消息滚动条挤到离分隔线十几像素处，
 * 正文列也会相对中间栏偏左半个槽宽。这里量出实际槽宽写回 `--chat-gutter-reclaim`，
 * 量不到（触屏 / 覆盖式滚动条）就保持 0，不影响其它端。
 */
export function useChatGutterReclaim(rootRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const root = rootRef.current;
    const host = root?.parentElement;
    if (!root || !host) return;
    const apply = () => {
      const style = getComputedStyle(host);
      const border = (Number.parseFloat(style.borderLeftWidth) || 0) + (Number.parseFloat(style.borderRightWidth) || 0);
      const scrolled = host.scrollHeight > host.clientHeight + 1;
      const gutter = scrolled ? 0 : host.offsetWidth - host.clientWidth - border;
      root.style.setProperty("--chat-gutter-reclaim", gutter > 0 ? `${-gutter}px` : "0px");
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [rootRef]);
}

/**
 * 输入区叠在消息区上方，滚动条才能一直画到面板最底部；正文末端要让出输入区的高度，
 * 否则最后一条消息会被输入卡片盖住。输入区高度随附件 / 队列 / 提示条变化，所以要持续量。
 */
export function useChatComposerHeight(
  rootRef: RefObject<HTMLElement | null>,
  dockRef: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    const root = rootRef.current;
    const dock = dockRef.current;
    if (!root || !dock) return;
    let lastHeight = -1;
    const apply = () => {
      const nextHeight = dock.offsetHeight;
      if (nextHeight === lastHeight) return;
      lastHeight = nextHeight;
      root.style.setProperty("--chat-composer-height", `${nextHeight}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(dock);
    return () => observer.disconnect();
  }, [rootRef, dockRef]);
}
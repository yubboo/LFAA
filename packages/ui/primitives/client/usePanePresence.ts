// 面板挂载保持：展开立即挂载，收起后保留内容等过渡结束再卸载；供 CollapsePane 及其他折叠容器复用。
import { useEffect, useState } from "react";

/** 面板收起过渡时长（毫秒），与 @lfaa/ui-theme 的 --motion-duration-slow 保持一致。 */
export const PANE_TRANSITION_MS = 260;

/** 读取当前是否要求减少动态效果：优先外观设置，其次系统偏好。 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  const setting = document.documentElement.dataset.reducedMotion;
  if (setting === "on") return true;
  if (setting === "off") return false;
  return typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 收起时实际需要等待的时长：减少动效时归零，避免留下看不见的空挂载。 */
export function resolvePaneTransitionMs(durationMs?: number): number {
  if (prefersReducedMotion()) return 0;
  return durationMs ?? PANE_TRANSITION_MS;
}

/** 在收起过渡期间保持挂载，过渡结束或再次展开时正确交接。 */
export function usePanePresence(open: boolean, durationMs?: number): boolean {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const wait = resolvePaneTransitionMs(durationMs);
    if (wait <= 0) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), wait);
    return () => window.clearTimeout(timer);
  }, [durationMs, mounted, open]);

  return mounted;
}

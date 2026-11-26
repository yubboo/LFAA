// 刷新后的指针 / 焦点守卫：浏览器可能把焦点还给上次点过的按钮，指针也还停在原处。
// 在用户第一次移动指针或按键前，先收回无输入来源的焦点，并暂停分组悬停底色，
// 避免页面一打开就出现一个像被选中的「框」。
import { useEffect } from "react";

export function usePointerIdleGuard(): void {
  useEffect(() => {
    const root = document.documentElement;
    let interacted = false;
    root.dataset.pointerIdle = "true";
    const markInteracted = () => {
      interacted = true;
      delete root.dataset.pointerIdle;
    };
    window.addEventListener("pointermove", markInteracted, { once: true });
    window.addEventListener("keydown", markInteracted, { once: true });
    const clearRestoredFocus = () => {
      if (interacted) return;
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || active === document.body) return;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      // 弹窗打开时会把焦点送进内容，刷新后恢复的设置/搜索弹窗依赖焦点接收 Esc：不能收回。
      if (active.closest('[role="dialog"], [aria-modal="true"]')) return;
      active.blur();
    };
    const timers = [0, 150, 500].map((delay) => window.setTimeout(clearRestoredFocus, delay));
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("pointermove", markInteracted);
      window.removeEventListener("keydown", markInteracted);
      delete root.dataset.pointerIdle;
    };
  }, []);
}
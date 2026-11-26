// 终端展示位置偏好：右侧工作台标签（默认）或 Shell 底部面板，写入 localStorage 并广播给同页组件。
export type TerminalPlacement = "right" | "bottom";

const STORAGE_KEY = "lfaa:terminal-placement";
const CHANGE_EVENT = "lfaa:terminal-placement-change";

/** 读取当前位置：缺省与非法值都回退右侧。 */
export function readTerminalPlacement(): TerminalPlacement {
  if (typeof localStorage === "undefined") return "right";
  return localStorage.getItem(STORAGE_KEY) === "bottom" ? "bottom" : "right";
}

/** 写入位置并广播，让底部面板与右栏标签同时切换。 */
export function writeTerminalPlacement(placement: TerminalPlacement): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, placement);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** 订阅位置变化；返回退订函数。 */
export function subscribeTerminalPlacement(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
// Shell 布局编排动画原语：最大化/还原时让会话列与工作台在同一时间轴上互补变形——
// 会话列淡出并轻微收窄，工作台贴着另一侧铺满；两块首尾相接，中间区域因此不会露白。
// 只操作 DOM 与内联样式，不感知 React。

import { PANE_TRANSITION_MS, prefersReducedMotion } from "@lfaa/ui-primitives/client";
import styles from "./PaneAnim.module.css";

/** 参与编排的两块面板：都是 Shell 的直接子节点，几何共用同一套坐标系。 */
export interface PanePair {
  shell: HTMLElement;
  /** 会话列（预览区在左时它在右边）。 */
  chat: HTMLElement;
  /** 右侧工作台（预览区在左时它在中间）。 */
  panel: HTMLElement;
}

/** 一块面板在外壳内容区坐标系里的盒，口径与绝对定位的 left/top 一致。 */
export interface PaneBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 两块面板在常态（两块都可见）下的几何，所有插值都由它推导。 */
export interface PaneBoxes {
  chat: PaneBox;
  panel: PaneBox;
}

/** 一轮进行中的编排，交给 settle 统一收尾。 */
export interface PaneRun {
  pair: PanePair;
  layer: HTMLElement;
}

/** 交互锁覆盖层的标记，供验收脚本确认没有残留。 */
const LAYER_ATTR = "data-pane-anim";
/** 放大的一块在变形期间隐藏内容，只留底色。 */
const VEIL_ATTR = "data-anim-veil";
/** CSS Modules 类名在严格索引检查下可能为空，这里收敛成必填字符串。 */
const PANE_CLASS = styles.pane ?? "";
const LAYER_CLASS = styles.layer ?? "";

/** 固化前的内联样式、类名与 display 快照，收尾时整体写回，不留半截 position/transform。 */
const savedStyles = new WeakMap<HTMLElement, string>();
const savedClasses = new WeakMap<HTMLElement, string>();
const savedDisplay = new WeakMap<HTMLElement, string>();

/** 补间参数：把「常态 → 铺满」压成每帧都要用的两个数，两块面板共用同一进度。 */
interface PaneMotion {
  /** 会话列靠左（聊天区在左）还是靠右（预览区在左）。 */
  chatOnLeft: boolean;
  /** 工作台铺满后相对常态宽度的放大倍数。 */
  gain: number;
}

/** 会话列收窄到原来的 92%：只为让「确有动画」可测量，文字不会被压成竖条。 */
const CHAT_SQUEEZE = 0.08;
// 几何与淡出共用进缓出曲线，让 260ms 全程都在动：主题里的强调曲线前段就跑完 95%，
// 剩下的时间只能看见遮蔽的一块底色，会话内容也会过早消失。
const EASE_MOVE = "cubic-bezier(0.65, 0, 0.35, 1)";

/** 取 Shell 里参与编排的两块；结构不符时返回 null，由调用方退回瞬时切换。 */
export function capturePanes(shell: HTMLElement): PanePair | null {
  const chat = shell.querySelector<HTMLElement>('main[data-region="workspace"]');
  const panel = shell.querySelector<HTMLElement>(':scope > [data-pane-side="right"]');
  if (!chat || !panel) return null;
  if (chat.parentElement !== shell || panel.parentElement !== shell) return null;
  return { shell, chat, panel };
}

/** 只有桌面端、未要求减少动效、两块等高时才编排；其余情况一律瞬时切换。 */
export function shouldAnimate(pair: PanePair): boolean {
  if (typeof window === "undefined" || prefersReducedMotion()) return false;
  const chat = pair.chat.getBoundingClientRect();
  const panel = pair.panel.getBoundingClientRect();
  // 会话列在最大化状态下宽度可能已经是 0，这里只校验高度与工作台宽度。
  return panel.width >= 2 && chat.height >= 2 && Math.abs(chat.height - panel.height) <= 8;
}

/** 开一层只负责锁交互的覆盖层：两块面板的层级压在它之上，采样命中仍是面板本身。 */
export function mountLayer(shell: HTMLElement): HTMLElement {
  const layer = document.createElement("div");
  layer.className = LAYER_CLASS;
  layer.setAttribute(LAYER_ATTR, "layer");
  shell.appendChild(layer);
  return layer;
}

/** 就地固化两块面板：脱离栅格流但保持传入的盒，外层排版因此可以立刻切到终态。 */
export function adopt(pair: PanePair, boxes: PaneBoxes): void {
  const motion = resolveMotion(boxes);
  // 会话列以远离边界的那条边为原点收窄，工作台以另一侧为原点铺开：
  // 两块各自向自己的外侧边收缩/生长，中间那条边界始终首尾相接，不会被对方或左栏压住。
  pin(pair.chat, boxes.chat, motion.chatOnLeft ? "0% 50%" : "100% 50%", false);
  pin(pair.panel, boxes.panel, motion.chatOnLeft ? "100% 50%" : "0% 50%", true);
}

/** 播放一次补间：先把起始帧提交给样式系统，同一任务内改成终值，过渡才会真正发生。 */
export function play(
  run: PaneRun,
  boxes: PaneBoxes,
  from: number,
  to: number,
  durationMs = PANE_TRANSITION_MS,
): Promise<void> {
  const motion = resolveMotion(boxes);
  const { chat, panel, shell } = run.pair;
  // 会话列淡出并轻微收窄，工作台铺开：两块共用同一进度，中间那条边界逐帧同一位置。
  chat.style.transform = chatTransform(from);
  chat.style.opacity = String(1 - from);
  panel.style.transform = panelTransform(motion, from);
  void shell.offsetWidth;

  chat.style.transition = `transform ${durationMs}ms ${EASE_MOVE}, opacity ${durationMs}ms ${EASE_MOVE}`;
  panel.style.transition = `transform ${durationMs}ms ${EASE_MOVE}`;
  chat.style.transform = chatTransform(to);
  chat.style.opacity = String(1 - to);
  panel.style.transform = panelTransform(motion, to);

  return Promise.all([
    whenTransformSettled(chat, durationMs),
    whenTransformSettled(panel, durationMs),
  ]).then(() => undefined);
}

/** 收尾：面板写回原样、覆盖层移除，之后布局就是终态本身。 */
export function settle(run: PaneRun): void {
  restorePane(run.pair.chat);
  restorePane(run.pair.panel);
  run.layer.remove();
}

/** 把常态几何换算成补间参数；两块相邻，因此只看会话列宽与工作台宽的比值。 */
function resolveMotion(boxes: PaneBoxes): PaneMotion {
  const chatOnLeft = boxes.chat.left <= boxes.panel.left;
  return {
    chatOnLeft,
    gain: 1 + boxes.chat.width / Math.max(boxes.panel.width, 1),
  };
}

function chatTransform(progress: number): string {
  return `scaleX(${Number((1 - CHAT_SQUEEZE * progress).toFixed(4))})`;
}

function panelTransform(motion: PaneMotion, progress: number): string {
  return `scaleX(${1 + (motion.gain - 1) * progress})`;
}

function pin(el: HTMLElement, box: PaneBox, origin: string, veil: boolean): void {
  if (!savedStyles.has(el)) {
    savedStyles.set(el, el.style.cssText);
    savedClasses.set(el, el.className);
    // 预览区在左 + 最大化会把会话列改成 block：固化期间锁回切换前的 display，
    // 否则内部栅格立刻散架，变形的那 260ms 会看到内容重排。
    savedDisplay.set(el, getComputedStyle(el).display);
  }
  el.classList.add(PANE_CLASS);
  if (veil) el.setAttribute(VEIL_ATTR, "true");
  else el.removeAttribute(VEIL_ATTR);

  const style = el.style;
  style.position = "absolute";
  // 绝对定位的网格子元素会拿「自己的网格区域」当包含块，那会让 left/top 相对某一条轨道。
  // 这里把区域显式拉满整行整列，包含块就是外壳内容区，与传进来的盒同口径。
  style.gridArea = "1 / 1 / 2 / -1";
  style.left = `${box.left}px`;
  style.top = `${box.top}px`;
  style.width = `${box.width}px`;
  style.height = `${box.height}px`;
  style.margin = "0px";
  style.minWidth = "0px";
  style.minHeight = "0px";
  style.display = savedDisplay.get(el) ?? "block";
  style.transformOrigin = origin;
}

function restorePane(el: HTMLElement): void {
  const style = savedStyles.get(el);
  if (style !== undefined) el.style.cssText = style;
  const className = savedClasses.get(el);
  if (className !== undefined) el.className = className;
  el.removeAttribute(VEIL_ATTR);
  savedStyles.delete(el);
  savedClasses.delete(el);
  savedDisplay.delete(el);
}

/** 等 transform 过渡结束；被打断时不会派发 transitionend，兜一个上限时长。 */
function whenTransformSettled(el: HTMLElement, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    let timer = 0;
    const finish = () => {
      window.clearTimeout(timer);
      el.removeEventListener("transitionend", onEnd);
      resolve();
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === el && event.propertyName === "transform") finish();
    };
    el.addEventListener("transitionend", onEnd);
    timer = window.setTimeout(finish, durationMs + 90);
  });
}
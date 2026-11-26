// Shell 布局编排动画的编排入口：把一次布局变更包成「先定格 → 切换排版 → 补间 → 归位」，
// 并兜住快速连点（先收尾上一轮）与组件卸载（不留内联样式和悬挂回调）。

import { useEffect, type RefObject } from "react";
import { flushSync } from "react-dom";
import { PANE_TRANSITION_MS } from "@lfaa/ui-primitives/client";
import {
  adopt,
  capturePanes,
  mountLayer,
  play,
  settle,
  shouldAnimate,
  type PaneBox,
  type PaneBoxes,
  type PanePair,
  type PaneRun,
} from "./pane-anim";

/** 当前挂载的 Shell：动画由 workbench 服务触发，拿不到 ref，只能按活跃实例取。 */
let activeShell: HTMLElement | null = null;
/** 正在播的一轮；快速连点或卸载时先按它归位。 */
let running: PaneRun | null = null;
/** 编排期间被冻结的外壳过渡，收尾时原样写回。 */
let frozen: { shell: HTMLElement; transition: string } | null = null;

/** 登记 Shell 实例，并在卸载时收尾：残留的固化样式比少一段动画严重得多。 */
export function usePaneAnimHost(shellRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    activeShell = shellRef.current;
    return () => {
      activeShell = null;
      stopRunning();
    };
  }, [shellRef]);
}

/** 把一次布局变更包进编排动画；几何不可用或要求降级时直接执行变更，即原先的瞬时切换。 */
export function runPaneAnimation(mutate: () => void): void {
  // 快速连点：上一轮还在播就先归位，否则两块会叠在固化几何上继续变形。
  stopRunning();
  const shell = activeShell;
  const pair = shell ? capturePanes(shell) : null;
  if (!shell || !pair || shell.dataset.device !== "desktop" || !shouldAnimate(pair)) {
    mutate();
    return;
  }

  // 栅格轨道本身也有 260ms 过渡：编排全程冻结它，否则量到的终态是插值中的值。
  const before = measure(shell, pair);
  freezeShell(shell);
  let normal = before;
  let run = begin(shell, pair, before);
  flushSync(mutate);
  if (!shell.contains(pair.chat) || !shell.contains(pair.panel)) {
    stopRun(run);
    return;
  }

  // 方向取自 Shell 自己的标记：最大化 = 工作台铺满、会话列让位。
  const maximizing = shell.dataset.rightMaximized === "true";
  if (maximizing) {
    if (!usable(normal)) {
      stopRun(run);
      return;
    }
  } else {
    // 还原方向：常态几何只有排版切回来之后才量得到。这里只把两块放回文档流再量，
    // 外壳保持冻结，因此不会顺手把轨道过渡放出去。
    settle(run);
    normal = measure(shell, pair);
    if (!usable(normal)) {
      thawShell();
      return;
    }
    run = begin(shell, pair, normal);
  }

  const active = run;
  void play(active, normal, maximizing ? 0 : 1, maximizing ? 1 : 0, PANE_TRANSITION_MS).then(() => {
    if (running !== active) return;
    stopRun(active);
  });
}

/** 定格两块面板并挂上交互锁；收尾前不放开，避免中途被点击打断。 */
function begin(shell: HTMLElement, pair: PanePair, boxes: PaneBoxes): PaneRun {
  const layer = mountLayer(shell);
  adopt(pair, boxes);
  const run: PaneRun = { pair, layer };
  running = run;
  return run;
}

/** 收尾一轮：面板归位、覆盖层移除、外壳过渡放开。 */
function stopRun(run: PaneRun): void {
  settle(run);
  if (running === run) running = null;
  thawShell();
}

/** 立刻收尾正在播的一轮（快速连点、卸载、或本轮几何不可用）。 */
function stopRunning(): void {
  const run = running;
  if (run) {
    running = null;
    settle(run);
  }
  thawShell();
}

function freezeShell(shell: HTMLElement): void {
  if (frozen?.shell === shell) return;
  thawShell();
  frozen = { shell, transition: shell.style.transition };
  shell.style.transition = "none";
}

function thawShell(): void {
  if (!frozen) return;
  frozen.shell.style.transition = frozen.transition;
  frozen = null;
}

function measure(shell: HTMLElement, pair: PanePair): PaneBoxes {
  return { chat: toBox(shell, pair.chat), panel: toBox(shell, pair.panel) };
}

/** 视口坐标换算到外壳内容区，与绝对定位的 left/top 同口径。 */
function toBox(shell: HTMLElement, el: HTMLElement): PaneBox {
  const rect = el.getBoundingClientRect();
  const base = shell.getBoundingClientRect();
  return {
    left: rect.left - base.left - shell.clientLeft,
    top: rect.top - base.top - shell.clientTop,
    width: rect.width,
    height: rect.height,
  };
}

function usable(boxes: PaneBoxes): boolean {
  return boxes.chat.width >= 2 && boxes.panel.width >= 2;
}
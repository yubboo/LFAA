/**
 * 功能：提供设置中心和应用工作区共用的容器尺寸观察。
 * 作用：按帧合并 ResizeObserver 通知，同尺寸保留原状态，避免重复布局读取和整页重渲染。
 * 关联文件：workbench-layout.config.ts、SettingsPage.tsx、ApplicationWorkspace.tsx。
 */
import { useLayoutEffect, useState, type RefObject } from "react";
import { resolveWorkbenchLayoutMetrics, type WorkbenchLayoutMetrics } from "./workbench-layout.config.js";

export function readWorkbenchLeadingInsetWidth(element: HTMLElement) {
  const rawWidth = window.getComputedStyle(element).getPropertyValue("--lfaa-leading-width");
  const width = Number.parseFloat(rawWidth);
  return Number.isFinite(width) ? Math.max(0, width) : 0;
}

export function observeWorkbenchMetrics(element: HTMLDivElement, onChange: (metrics: WorkbenchLayoutMetrics) => void, responsiveRightDock = false, measureLeadingInset?: (element: HTMLDivElement) => number) {
  if (typeof ResizeObserver === "undefined") return () => undefined;
  let frame: number | null = null;
  let stopped = false;
  let previous: WorkbenchLayoutMetrics | null = null;
  let size: { width: number; height: number } = element.getBoundingClientRect();
  const update = () => {
    if (stopped || frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      const leadingInset = measureLeadingInset?.(element) ?? 0;
      const next = resolveWorkbenchLayoutMetrics(Math.max(0, size.width - leadingInset), size.height, responsiveRightDock);
      if (previous?.containerWidth === next.containerWidth && previous.containerHeight === next.containerHeight) return;
      previous = next;
      onChange(next);
    });
  };
  const observer = new ResizeObserver(entries => {
    const entry = entries.find(item => item.target === element);
    if (!entry) return;
    const box = entry.borderBoxSize?.[0];
    // borderBoxSize 与旧 getBoundingClientRect 的外框尺寸一致；旧 WebView 回退 contentRect。
    size = { width: box?.inlineSize ?? entry.contentRect.width, height: box?.blockSize ?? entry.contentRect.height };
    update();
  });
  update();
  observer.observe(element);
  return () => {
    if (stopped) return;
    stopped = true;
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    observer.disconnect();
  };
}

export function useWorkbenchMetrics(ref: RefObject<HTMLDivElement | null>, initialize: () => WorkbenchLayoutMetrics, responsiveRightDock = false, measureLeadingInset?: (element: HTMLDivElement) => number) {
  const [metrics, setMetrics] = useState(initialize);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // 首次提交后立即用工作台真实外框校准布局，避免嵌入式窄分栏先按浏览器整窗宽度绘制一帧。
    const bounds = element.getBoundingClientRect();
    const leadingInset = measureLeadingInset?.(element) ?? 0;
    const measured = resolveWorkbenchLayoutMetrics(Math.max(0, bounds.width - leadingInset), bounds.height, responsiveRightDock);
    setMetrics(current => current.containerWidth === measured.containerWidth && current.containerHeight === measured.containerHeight ? current : measured);
    return observeWorkbenchMetrics(element, next => {
      setMetrics(current => current.containerWidth === next.containerWidth && current.containerHeight === next.containerHeight ? current : next);
    }, responsiveRightDock, measureLeadingInset);
  }, [measureLeadingInset, ref, responsiveRightDock]);
  return metrics;
}

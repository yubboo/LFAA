/**
 * 功能：提供设置中心和应用工作区共用的容器尺寸观察。
 * 作用：按帧合并 ResizeObserver 通知，同尺寸保留原状态，避免重复布局读取和整页重渲染。
 * 关联文件：workbench-layout.config.ts、SettingsPage.tsx、ApplicationWorkspace.tsx。
 */
import { useEffect, useState, type RefObject } from "react";
import { resolveWorkbenchLayoutMetrics, type WorkbenchLayoutMetrics } from "./workbench-layout.config.js";

export function observeWorkbenchMetrics(element: HTMLDivElement, onChange: (metrics: WorkbenchLayoutMetrics) => void, responsiveRightDock = false) {
  if (typeof ResizeObserver === "undefined") return () => undefined;
  let frame: number | null = null;
  let stopped = false;
  let previous: WorkbenchLayoutMetrics | null = null;
  let size: { width: number; height: number } = element.getBoundingClientRect();
  const update = () => {
    if (stopped || frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      const next = resolveWorkbenchLayoutMetrics(size.width, size.height, responsiveRightDock);
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

export function useWorkbenchMetrics(ref: RefObject<HTMLDivElement | null>, initialize: () => WorkbenchLayoutMetrics, responsiveRightDock = false) {
  const [metrics, setMetrics] = useState(initialize);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return observeWorkbenchMetrics(element, next => {
      setMetrics(current => current.containerWidth === next.containerWidth && current.containerHeight === next.containerHeight ? current : next);
    }, responsiveRightDock);
  }, [ref, responsiveRightDock]);
  return metrics;
}

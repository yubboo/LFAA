/**
 * 文件：WorkbenchIcon.tsx
 * 作用：提供工作台壳层使用的轻量线性图标。
 * 负责：纯视觉 SVG。
 * 不负责：业务状态或交互状态。
 */
import type { ReactElement, SVGProps } from "react";

export type WorkbenchIconName =
  | "archive" | "browser" | "chevron" | "file" | "folder" | "grid" | "history"
  | "moon" | "new" | "panel" | "plus" | "review" | "search" | "settings"
  | "spark" | "sun" | "terminal" | "tools" | "user";

export interface WorkbenchIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: WorkbenchIconName;
  size?: number;
}

const paths: Record<WorkbenchIconName, ReactElement> = {
  archive: <><path d="M4 7h16"/><path d="M5 7v12h14V7"/><path d="M8 3h8l2 4H6l2-4Z"/><path d="M9 11h6"/></>,
  browser: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.7 2.4 4 5.4 4 9s-1.3 6.6-4 9c-2.7-2.4-4-5.4-4-9s1.3-6.6 4-9Z"/></>,
  chevron: <path d="m8 10 4 4 4-4"/>,
  file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/></>,
  folder: <><path d="M3 6h7l2 2h9v11H3z"/></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
  history: <><path d="M4 4v6h6"/><path d="M5.2 15A8 8 0 1 0 6 7"/><path d="M12 8v5l3 2"/></>,
  moon: <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.8 8.8 0 1 0 20 15.2Z"/>,
  new: <><path d="M5 19h4L19 9l-4-4L5 15v4Z"/><path d="m13 7 4 4"/></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  review: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="m9 16 2 2 4-4"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 3.1h5l.4-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4L19 13a7 7 0 0 0 0-1Z"/></>,
  spark: <><path d="m12 3 1.3 4.1L17 9l-3.7 1.9L12 15l-1.3-4.1L7 9l3.7-1.9L12 3Z"/><path d="m18 15 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/></>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3"/><path d="M12 15h5"/></>,
  tools: <><path d="m14 7 3-3 3 3-3 3"/><path d="m4 20 8-8"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
};

export function WorkbenchIcon({ name, size = 18, ...props }: WorkbenchIconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}

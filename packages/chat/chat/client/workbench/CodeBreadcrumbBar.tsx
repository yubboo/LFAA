// 代码查看器顶部可点击面包屑导航条与右侧操作栏（更多菜单 5 项、查看差异、刷新、切换文件树侧边栏）。
import { Fragment, useEffect, useRef, useState } from "react";
import {
  IconChevronRight,
  IconCode,
  IconCopy,
  IconDotsVertical,
  IconDownload,
  IconFileDiff,
  IconFolderOpen,
  IconLayoutSidebarRight,
  IconRefresh,
  IconSearch,
  IconTextWrap,
  IconTextWrapDisabled,
} from "@tabler/icons-react";
import type { ChatClientStore } from "../store/chat-store";
import { FileTypeIcon } from "@lfaa/ui-icons/client";
import styles from "./FileChangePreview.module.css";

interface BreadcrumbSegment {
  label: string;
  /** 列出同级兄弟项时需请求的父目录路径（"" 代表项目根目录）。 */
  listDirPath: string;
  /** 当前段自身路径，用于在弹层内高亮对应项（根目录段为 null）。 */
  selfRelPath: string | null;
}

interface DirItem {
  name: string;
  kind: "directory" | "file";
  relPath: string;
}

function buildSegments(displayPath: string, projectName?: string | null): BreadcrumbSegment[] {
  const clean = displayPath.replace(/\\/gu, "/").replace(/^\/+/u, "");
  let parts = clean.split("/").filter(Boolean);
  const segs: BreadcrumbSegment[] = [];
  if (projectName) {
    const projIdx = parts.findIndex((p) => p.toLowerCase() === projectName.toLowerCase());
    if (projIdx >= 0) {
      parts = parts.slice(projIdx + 1);
    }
    segs.push({ label: projectName, listDirPath: "", selfRelPath: null });
  }
  let acc = "";
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    if (/^[a-z]:$/iu.test(part)) continue;
    const parent = acc;
    acc = acc ? `${acc}/${part}` : part;
    segs.push({ label: part, listDirPath: parent, selfRelPath: acc });
  }
  if (segs.length === 0) {
    segs.push({ label: clean || "file", listDirPath: "", selfRelPath: clean || null });
  }
  return segs;
}

export function CodeBreadcrumbBar({
  displayPath,
  projectId,
  worktreeId,
  boundProjectName,
  isZh,
  hasDiffToggle,
  showChanges,
  focusBadge,
  sidebarOpen,
  hasSource,
  wrapEnabled,
  store,
  onToggleDiff,
  onRefresh,
  onToggleSidebar,
  onToggleWrap,
  onCopyContent,
  onDownloadFile,
  onCopyPath,
  onOpenSearch,
  onRevealInExplorer,
}: {
  displayPath: string;
  projectId: string | null;
  /** 绑定工作树时面包屑与同级文件来自工作树目录。 */
  worktreeId?: string | undefined;
  boundProjectName?: string | null | undefined;
  isZh: boolean;
  hasDiffToggle: boolean;
  showChanges: boolean;
  focusBadge?: string | undefined;
  sidebarOpen?: boolean | undefined;
  hasSource: boolean;
  /** 代码区是否开启自动换行。 */
  wrapEnabled?: boolean | undefined;
  store: ChatClientStore;
  onToggleDiff: () => void;
  onRefresh: () => void;
  onToggleSidebar?: (() => void) | undefined;
  onToggleWrap?: (() => void) | undefined;
  onCopyContent: () => void;
  onDownloadFile: () => void;
  onCopyPath: () => void;
  onOpenSearch: () => void;
  onRevealInExplorer?: (() => void) | undefined;
}) {
  const [openCrumbIdx, setOpenCrumbIdx] = useState<number | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number } | null>(null);
  const [crumbItems, setCrumbItems] = useState<DirItem[]>([]);
  const [expandedSubDirs, setExpandedSubDirs] = useState<Record<string, DirItem[]>>({});
  const [crumbLoading, setCrumbLoading] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [copiedHint, setCopiedHint] = useState("");
  const barRef = useRef<HTMLDivElement>(null);

  const segments = buildSegments(displayPath, boundProjectName);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        setOpenCrumbIdx(null);
        setMoreOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenCrumbIdx(null);
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const fetchDirEntries = async (relDirPath: string): Promise<DirItem[]> => {
    if (!projectId && !worktreeId) return [];
    const qs = relDirPath ? `?path=${encodeURIComponent(relDirPath)}` : "";
    const url = worktreeId
      ? `/api/worktrees/${encodeURIComponent(worktreeId)}/inspect${qs}`
      : `/api/workspace/projects/${encodeURIComponent(projectId ?? "")}/inspect${qs}`;
    const res = await fetch(url);
    const data = (await res.json()) as { entries?: Array<{ name: string; kind: "directory" | "file" }> };
    if (!res.ok || !Array.isArray(data.entries)) return [];
    return data.entries.map((entry) => ({
      name: entry.name,
      kind: entry.kind,
      relPath: relDirPath ? `${relDirPath}/${entry.name}` : entry.name,
    }));
  };

  const handleClickSegment = async (idx: number, seg: BreadcrumbSegment, targetEl: HTMLElement) => {
    setMoreOpen(false);
    if (!projectId) return;
    if (openCrumbIdx === idx) {
      setOpenCrumbIdx(null);
      return;
    }
    const rect = targetEl.getBoundingClientRect();
    const maxW = typeof window !== "undefined" ? window.innerWidth : 1280;
    const maxH = typeof window !== "undefined" ? window.innerHeight : 800;
    setPopoverPos({
      left: Math.max(8, Math.min(maxW - 250, Math.round(rect.left))),
      top: Math.max(8, Math.min(maxH - 260, Math.round(rect.bottom + 6))),
    });
    setOpenCrumbIdx(idx);
    setExpandedSubDirs({});
    setCrumbLoading(true);
    try {
      setCrumbItems(await fetchDirEntries(seg.listDirPath));
    } finally {
      setCrumbLoading(false);
    }
  };

  const handleClickPopoverItem = async (item: DirItem) => {
    if (!projectId) return;
    if (item.kind === "file") {
      store.openWorkspaceFile(projectId ?? "", item.relPath, item.relPath, undefined, undefined, worktreeId);
      setOpenCrumbIdx(null);
      return;
    }
    if (expandedSubDirs[item.relPath]) {
      setExpandedSubDirs((prev) => {
        const next = { ...prev };
        delete next[item.relPath];
        return next;
      });
      return;
    }
    const children = await fetchDirEntries(item.relPath);
    setExpandedSubDirs((prev) => ({ ...prev, [item.relPath]: children }));
  };

  const flashHint = (text: string) => {
    setCopiedHint(text);
    setTimeout(() => setCopiedHint(""), 1400);
  };

  const renderMenuEntries = (items: DirItem[], activeRel: string | null, depth: number) => items.map((item) => {
    const isExpanded = item.kind === "directory" && Boolean(expandedSubDirs[item.relPath]);
    const isSelected = activeRel === item.relPath || (item.kind === "directory" && Boolean(activeRel?.startsWith(`${item.relPath}/`)));
    return (
      <Fragment key={item.relPath}>
        <button
          type="button"
          className={`${styles.crumbMenuItem} ${isSelected || isExpanded ? styles.crumbMenuItemActive : ""}`}
          style={{ paddingLeft: `${0.55 + depth * 0.9}rem` }}
          onClick={() => void handleClickPopoverItem(item)}
        >
          <FileTypeIcon name={item.name} kind={item.kind} expanded={isExpanded} />
          <span className={styles.crumbMenuLabel}>{item.name}</span>
        </button>
        {isExpanded && expandedSubDirs[item.relPath] && renderMenuEntries(expandedSubDirs[item.relPath]!, activeRel, depth + 1)}
      </Fragment>
    );
  });

  return (
    <div ref={barRef} className={styles.breadcrumbBar}>
      <nav className={styles.breadcrumbs} aria-label={isZh ? "文件路径导航" : "File path"}>
        {segments.map((seg, idx) => {
          const isLast = idx === segments.length - 1;
          const isOpen = openCrumbIdx === idx;
          return (
            <div key={`${seg.label}-${idx}`} className={styles.crumbWrap}>
              {idx > 0 && <IconChevronRight size={12} className={styles.crumbSep} aria-hidden="true" />}
              <button
                type="button"
                className={`${styles.crumbBtn} ${isLast ? styles.crumbCurrent : ""} ${isOpen ? styles.crumbBtnOpen : ""}`}
                disabled={!projectId}
                title={projectId ? (isZh ? `浏览 ${seg.label} 同级文件` : `Browse ${seg.label}`) : displayPath}
                aria-expanded={isOpen}
                onClick={(e) => void handleClickSegment(idx, seg, e.currentTarget)}
              >
                {isLast && <FileTypeIcon name={seg.label} kind="file" />}
                <span>{seg.label}</span>
              </button>

              {isOpen && popoverPos && (
                <div
                  className={styles.crumbPopover}
                  style={{ left: `${popoverPos.left}px`, top: `${popoverPos.top}px` }}
                  role="menu"
                  aria-label={seg.label}
                >
                  {crumbLoading ? (
                    <div className={styles.crumbPopoverEmpty}>{isZh ? "读取目录…" : "Loading..."}</div>
                  ) : crumbItems.length === 0 ? (
                    <div className={styles.crumbPopoverEmpty}>{isZh ? "空目录" : "Empty directory"}</div>
                  ) : (
                    renderMenuEntries(crumbItems, seg.selfRelPath, 0)
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className={styles.toolbarActions}>
        {copiedHint && <span className={styles.copiedPill}>{copiedHint}</span>}
        {focusBadge && <span className={styles.lineBadge}>{focusBadge}</span>}

        <div className={styles.moreWrap}>
          <button
            type="button"
            className={styles.actionBtn}
            title={isZh ? "更多操作" : "More actions"}
            aria-label={isZh ? "更多操作" : "More actions"}
            aria-expanded={moreOpen}
            onClick={() => { setOpenCrumbIdx(null); setMoreOpen((v) => !v); }}
          >
            <IconDotsVertical size={14} />
          </button>
          {moreOpen && (
            <div className={styles.morePopover} role="menu">
              <button
                type="button"
                role="menuitem"
                className={styles.moreMenuItem}
                disabled={!hasSource}
                onClick={() => { onCopyContent(); setMoreOpen(false); flashHint(isZh ? "已复制内容" : "Copied"); }}
              >
                <IconCopy size={14} />
                <span>{isZh ? "复制内容" : "Copy content"}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.moreMenuItem}
                disabled={!hasSource}
                onClick={() => { onDownloadFile(); setMoreOpen(false); }}
              >
                <IconDownload size={14} />
                <span>{isZh ? "下载文件" : "Download file"}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.moreMenuItem}
                onClick={() => { onCopyPath(); setMoreOpen(false); flashHint(isZh ? "已复制路径" : "Copied"); }}
              >
                <IconCopy size={14} />
                <span>{isZh ? "复制路径" : "Copy path"}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.moreMenuItem}
                disabled={!hasSource}
                onClick={() => { onOpenSearch(); setMoreOpen(false); }}
              >
                <IconSearch size={14} />
                <span>{isZh ? "搜索" : "Search"}</span>
              </button>
              {projectId && onRevealInExplorer && (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.moreMenuItem}
                  onClick={() => { onRevealInExplorer(); setMoreOpen(false); }}
                >
                  <IconFolderOpen size={14} />
                  <span>{isZh ? "在文件资源管理器中显示" : "Reveal in File Explorer"}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {hasDiffToggle && (
          <button
            type="button"
            className={`${styles.actionBtn} ${showChanges ? styles.modeBtnActive : ""}`}
            title={showChanges ? (isZh ? "查看源码" : "View source") : (isZh ? "查看差异" : "View diff")}
            aria-label={showChanges ? (isZh ? "查看源码" : "View source") : (isZh ? "查看差异" : "View diff")}
            onClick={onToggleDiff}
          >
            {showChanges ? <IconCode size={14} /> : <IconFileDiff size={14} />}
          </button>
        )}

        <button
          type="button"
          className={styles.actionBtn}
          title={isZh ? "刷新" : "Refresh"}
          aria-label={isZh ? "刷新" : "Refresh"}
          onClick={onRefresh}
        >
          <IconRefresh size={14} />
        </button>

        {onToggleWrap && (
          <button
            type="button"
            className={`${styles.actionBtn} ${wrapEnabled ? styles.modeBtnActive : ""}`}
            title={wrapEnabled ? (isZh ? "关闭自动换行" : "Disable word wrap") : (isZh ? "自动换行" : "Word wrap")}
            aria-label={isZh ? "自动换行" : "Word wrap"}
            aria-pressed={wrapEnabled === true}
            onClick={onToggleWrap}
          >
            {wrapEnabled ? <IconTextWrap size={14} /> : <IconTextWrapDisabled size={14} />}
          </button>
        )}

        {onToggleSidebar && (
          <button
            type="button"
            className={`${styles.actionBtn} ${sidebarOpen ? styles.modeBtnActive : ""}`}
            title={isZh ? "切换侧边栏" : "Toggle sidebar"}
            aria-label={isZh ? "切换侧边栏" : "Toggle sidebar"}
            aria-pressed={sidebarOpen}
            onClick={onToggleSidebar}
          >
            <IconLayoutSidebarRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

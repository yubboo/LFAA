// 右辅助栏 VS Code 风格工作区文件树：展示根目录与垂直缩进指引线、文件/目录语义图标、懒加载及双向联动高亮。
import { useCallback, useEffect, useState } from "react";
import { IconChevronDown, IconChevronRight, IconRefresh } from "@tabler/icons-react";
import type { ChatClientStore } from "../chat-store";
import { readTreeExpandedState, writeTreeExpandedState } from "../workbench-persist";
import { FileTypeIcon } from "./file-icons";
import styles from "./RightFileTreePane.module.css";

interface TreeEntry {
  name: string;
  kind: "directory" | "file";
  fullPath: string;
  relativePath: string;
}

function joinPath(base: string, name: string): string {
  const cleanBase = base.replace(/[\\/]+$/u, "");
  return `${cleanBase}/${name}`;
}

function normalizeCmp(p: string): string {
  return p.replace(/\\/gu, "/").toLowerCase();
}

export function RightFileTreePane({
  projectId,
  projectName,
  activeFilePath,
  isZh,
  store,
}: {
  projectId: string | null;
  projectName: string | null;
  activeFilePath?: string | undefined;
  isZh: boolean;
  store: ChatClientStore;
}) {
  const [rootPath, setRootPath] = useState<string>("");
  const [rootExpanded, setRootExpanded] = useState(true);
  const [childrenMap, setChildrenMap] = useState<Record<string, TreeEntry[]>>({});
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");

  const loadDirectory = useCallback(async (dirPath?: string) => {
    if (!projectId) return;
    const key = dirPath ? normalizeCmp(dirPath) : "__root__";
    setLoadingDirs((prev) => new Set(prev).add(key));
    setError("");
    try {
      const qs = dirPath ? `?path=${encodeURIComponent(dirPath)}` : "";
      const res = await fetch(`/api/workspace/projects/${encodeURIComponent(projectId)}/inspect${qs}`);
      const data = (await res.json()) as {
        rootPath?: string;
        entries?: Array<{ name: string; kind: "directory" | "file" }>;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || `加载失败 (${res.status})`);
      const currentRoot = (data.rootPath || dirPath || "").replace(/\\/gu, "/");
      const baseRoot = !dirPath ? currentRoot : rootPath;
      if (!dirPath) setRootPath(currentRoot);
      const list: TreeEntry[] = (data.entries ?? []).map((e) => {
        const full = joinPath(currentRoot, e.name);
        const rel = baseRoot && normalizeCmp(full).startsWith(normalizeCmp(baseRoot))
          ? full.slice(baseRoot.length).replace(/^\/+/u, "")
          : full;
        return { name: e.name, kind: e.kind, fullPath: full, relativePath: rel };
      });
      setChildrenMap((prev) => ({ ...prev, [normalizeCmp(currentRoot)]: list }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDirs((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [projectId, rootPath]);

  useEffect(() => {
    const saved = readTreeExpandedState(projectId);
    setRootPath("");
    setRootExpanded(saved.rootExpanded);
    setChildrenMap({});
    setExpandedDirs(new Set(saved.dirs));
    if (projectId) void loadDirectory();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 持久化的已展开目录在根目录加载后按需补全子列表。
  useEffect(() => {
    if (!projectId || !rootPath || expandedDirs.size === 0) return;
    for (const dirKey of expandedDirs) {
      if (!childrenMap[dirKey] && !loadingDirs.has(dirKey)) {
        void loadDirectory(dirKey);
      }
    }
  }, [childrenMap, expandedDirs, loadDirectory, loadingDirs, projectId, rootPath]);

  useEffect(() => {
    if (!projectId) return;
    writeTreeExpandedState(projectId, { rootExpanded, dirs: [...expandedDirs] });
  }, [expandedDirs, projectId, rootExpanded]);

  // 联动打开的代码文件：自动逐级展开根目录与父目录。
  useEffect(() => {
    if (!projectId || !rootPath || !activeFilePath) return;
    const normRoot = normalizeCmp(rootPath).replace(/\/+$/u, "");
    const normTarget = normalizeCmp(activeFilePath);
    const candidate = normTarget.startsWith(normRoot)
      ? normTarget
      : `${normRoot}/${normTarget.replace(/^\/+/u, "")}`;
    if (!candidate.startsWith(`${normRoot}/`)) return;
    setRootExpanded(true);
    const relSegments = candidate.slice(normRoot.length + 1).split("/");
    if (relSegments.length <= 1) return;
    let cursor = rootPath.replace(/\/+$/u, "");
    const dirsToExpand: string[] = [];
    for (let i = 0; i < relSegments.length - 1; i += 1) {
      cursor = `${cursor}/${relSegments[i]}`;
      dirsToExpand.push(cursor);
    }
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      for (const d of dirsToExpand) next.add(normalizeCmp(d));
      return next;
    });
    for (const d of dirsToExpand) {
      if (!childrenMap[normalizeCmp(d)]) {
        void loadDirectory(d);
      }
    }
  }, [activeFilePath, childrenMap, loadDirectory, projectId, rootPath]);

  const toggleDir = (entry: TreeEntry) => {
    const key = normalizeCmp(entry.fullPath);
    const isExpanded = expandedDirs.has(key);
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (isExpanded) next.delete(key);
      else next.add(key);
      return next;
    });
    if (!isExpanded && !childrenMap[key]) {
      void loadDirectory(entry.fullPath);
    }
  };

  const renderNodes = (dirKey: string, depth: number) => {
    const entries = childrenMap[dirKey] ?? [];
    const normActive = activeFilePath ? normalizeCmp(activeFilePath) : "";
    return entries.map((entry) => {
      const key = normalizeCmp(entry.fullPath);
      const isDir = entry.kind === "directory";
      const isExpanded = isDir && expandedDirs.has(key);
      const isSelected = !isDir && normActive !== "" && (normActive === key || key.endsWith(`/${normActive.replace(/^\/+/u, "")}`));
      const isMuted = entry.name === ".git" || entry.name === "node_modules";
      return (
        <div key={entry.fullPath} className={styles.treeNodeWrap}>
          <button
            type="button"
            className={`${styles.treeRow} ${isSelected ? styles.treeRowActive : ""}`}
            data-dim={isMuted ? "true" : undefined}
            title={entry.relativePath}
            onClick={() => {
              if (isDir) toggleDir(entry);
              else if (projectId) store.openWorkspaceFile(projectId, entry.fullPath, entry.relativePath);
            }}
          >
            <span className={styles.treeChevron}>
              {isDir ? (isExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />) : null}
            </span>
            <FileTypeIcon name={entry.name} kind={entry.kind} expanded={isExpanded} />
            <span className={styles.treeLabel}>{entry.name}</span>
          </button>
          {isDir && isExpanded && (
            <div className={styles.treeChildren} data-depth={depth}>
              {renderNodes(key, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  if (!projectId) {
    return (
      <div className={styles.empty}>
        <span>{isZh ? "当前对话尚未绑定工作区项目，在输入框上方选择项目后即可浏览全部源码树。" : "Bind a project in chat to browse its workspace file tree."}</span>
      </div>
    );
  }

  const rootKey = normalizeCmp(rootPath);
  const isLoadingRoot = loadingDirs.has("__root__");
  const rootLabel = projectName || rootPath.split("/").pop() || rootPath;

  return (
    <div className={styles.panel}>
      <div className={styles.rootHeader}>
        <button
          type="button"
          className={styles.workspaceTitleBtn}
          onClick={() => setRootExpanded((v) => !v)}
          aria-expanded={rootExpanded}
        >
          <span>{isZh ? "工作区" : "Workspace"}</span>
          <IconChevronDown size={13} className={`${styles.titleChevron} ${!rootExpanded ? styles.titleChevronCollapsed : ""}`} />
        </button>
        <button
          type="button"
          className={styles.refreshBtn}
          title={isZh ? "刷新目录" : "Refresh tree"}
          onClick={() => {
            setChildrenMap({});
            void loadDirectory();
          }}
        >
          <IconRefresh size={13} />
        </button>
      </div>
      {error && <div className={styles.errorText}>{error}</div>}
      <div className={styles.treeBody} role="tree" aria-label={isZh ? "工作区文件树" : "Workspace file tree"}>
        <button
          type="button"
          className={styles.treeRow}
          title={rootPath}
          onClick={() => setRootExpanded((v) => !v)}
        >
          <span className={styles.treeChevron}>
            {rootExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
          </span>
          <FileTypeIcon name={rootLabel} kind="directory" expanded={rootExpanded} />
          <span className={styles.rootFolderLabel}>{rootLabel}</span>
        </button>

        {rootExpanded && (
          isLoadingRoot && !(childrenMap[rootKey]?.length) ? (
            <div className={styles.loadingText}>{isZh ? "正在读取目录…" : "Loading files..."}</div>
          ) : (
            <div className={styles.treeChildren}>
              {rootKey ? renderNodes(rootKey, 1) : null}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// 渲染由 @lfaa/workspace 插件贡献的项目概览页与绑定真实本地目录的文件工作区。
import { useCallback, useEffect, useState } from "react";
import { IconFile, IconFolder, IconRefresh } from "@tabler/icons-react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import { readStoredJson, writeStoredJson } from "@lfaa/ui-layout/client";
import type { WorkspaceInspection } from "../../contract/index";
import type { LocalProjectStore } from "../local-project-store";
import type { WorkspaceLocaleMessages } from "../locales";
import styles from "./ProjectWorkspace.module.css";

const PROJECT_FOLDERS_STORAGE_KEY = "lfaa:project-selected-folders";
const PROJECT_INSPECTIONS_CACHE_KEY = "lfaa:cache-project-inspections";
const MAX_CACHED_INSPECTIONS = 12;

function readSelectedFolderMap(): Record<string, string> {
  const stored = readStoredJson<unknown>(PROJECT_FOLDERS_STORAGE_KEY, null);
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return {};
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(stored)) {
    if (typeof value === "string") next[key] = value;
  }
  return next;
}

function toInspectionCacheKey(projectId: string, rootPath: string): string {
  return `${projectId}::${rootPath}`;
}

function readCachedInspection(projectId: string, rootPath: string): WorkspaceInspection | null {
  const map = readStoredJson<unknown>(PROJECT_INSPECTIONS_CACHE_KEY, null);
  if (typeof map !== "object" || map === null || Array.isArray(map)) return null;
  const entry = (map as Record<string, unknown>)[toInspectionCacheKey(projectId, rootPath)];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return null;
  return entry as WorkspaceInspection;
}

function writeCachedInspection(projectId: string, rootPath: string, inspection: WorkspaceInspection): void {
  const map = readStoredJson<unknown>(PROJECT_INSPECTIONS_CACHE_KEY, null);
  const current = typeof map === "object" && map !== null && !Array.isArray(map)
    ? { ...(map as Record<string, WorkspaceInspection>) }
    : {};
  const key = toInspectionCacheKey(projectId, rootPath);
  delete current[key];
  current[key] = inspection;
  const keys = Object.keys(current);
  if (keys.length > MAX_CACHED_INSPECTIONS) {
    for (const staleKey of keys.slice(0, keys.length - MAX_CACHED_INSPECTIONS)) {
      delete current[staleKey];
    }
  }
  writeStoredJson(PROJECT_INSPECTIONS_CACHE_KEY, current);
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 展示本地项目概况与进入项目的入口，供工作台未选择具体项目时使用。 */
export function ProjectsOverview({
  locale,
  projects,
  onOpenProject,
}: {
  locale: WorkspaceLocaleMessages;
  projects: WorkbenchProjectItem[];
  onOpenProject: (projectId: string) => void;
}) {
  return (
    <section className={styles.page} aria-labelledby="projects-title">
      <p className={styles.label}>{locale.localProject}</p>
      <h1 id="projects-title">{locale.projects}</h1>
      <p>{locale.projectsDescription}</p>
      {projects.length ? (
        <div className={styles.projectGrid}>
          {projects.map((project) => (
            <button key={project.id} type="button" onClick={() => onOpenProject(project.id)}>
              <IconFolder />
              <span className={styles.cardInfo}>
                <strong>{project.name}</strong>
                {project.rootPath && <small>{project.rootPath}</small>}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>{locale.noProjects}</p>
      )}
    </section>
  );
}

/** 读取选中项目的目录内容并渲染文件工作区。 */
export function ProjectDetailView({
  locale,
  project,
  store,
}: {
  locale: WorkspaceLocaleMessages;
  project: WorkbenchProjectItem;
  store: LocalProjectStore;
}) {
  const boundFolders = project.rootPaths?.length
    ? project.rootPaths
    : project.rootPath
      ? [project.rootPath]
      : [];
  const [selectedRootPath, setSelectedRootPath] = useState<string>(() => {
    const saved = readSelectedFolderMap()[project.id];
    return saved && boundFolders.includes(saved) ? saved : (boundFolders[0] ?? "");
  });
  const activeRootPath = boundFolders.includes(selectedRootPath) ? selectedRootPath : (boundFolders[0] ?? "");
  const initialCached = readCachedInspection(project.id, activeRootPath);
  const [inspection, setInspection] = useState<WorkspaceInspection | null>(initialCached);
  const [loading, setLoading] = useState(!initialCached);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = readSelectedFolderMap()[project.id];
    const nextPath = saved && boundFolders.includes(saved) ? saved : (boundFolders[0] ?? "");
    if (selectedRootPath !== nextPath && !boundFolders.includes(selectedRootPath)) {
      setSelectedRootPath(nextPath);
    }
  }, [boundFolders, project.id, selectedRootPath]);

  const handleSelectRootPath = (folderPath: string) => {
    setSelectedRootPath(folderPath);
    const cachedForTab = readCachedInspection(project.id, folderPath);
    if (cachedForTab) {
      setInspection(cachedForTab);
      setLoading(false);
    }
    writeStoredJson(PROJECT_FOLDERS_STORAGE_KEY, {
      ...readSelectedFolderMap(),
      [project.id]: folderPath,
    });
  };

  const loadInspection = useCallback(async (forceSpinner = false) => {
    const cached = readCachedInspection(project.id, activeRootPath);
    if (cached) {
      setInspection((current) => current ?? cached);
      if (!forceSpinner) setLoading(false);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      const next = await store.inspectProject(project.id, activeRootPath || undefined);
      writeCachedInspection(project.id, activeRootPath, next);
      setInspection((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    } catch (err) {
      if (!cached) {
        setError(err instanceof Error ? err.message : locale.projectStorageError);
      }
    } finally {
      setLoading(false);
    }
  }, [activeRootPath, locale.projectStorageError, project.id, store]);

  useEffect(() => {
    void loadInspection();
  }, [loadInspection]);

  return (
    <section className={styles.page} aria-labelledby="project-title">
      <div className={styles.headerRow}>
        <div>
          <p className={styles.label}>{locale.localProject}</p>
          <h1 id="project-title">{project.name}</h1>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={() => { void loadInspection(); }}>
          <IconRefresh />
          <span>{locale.refreshFolder}</span>
        </button>
      </div>

      {boundFolders.length > 1 ? (
        <div className={styles.folderTabs} role="tablist" aria-label={locale.rootPathLabel}>
          {boundFolders.map((folderPath) => (
            <button
              key={folderPath}
              type="button"
              role="tab"
              aria-selected={activeRootPath === folderPath}
              className={`${styles.folderTab} ${activeRootPath === folderPath ? styles.folderTabActive : ""}`}
              onClick={() => handleSelectRootPath(folderPath)}
            >
              {folderPath}
            </button>
          ))}
        </div>
      ) : (
        activeRootPath && <p className={styles.pathBanner}>{activeRootPath}</p>
      )}
      <p className={styles.desc}>{locale.projectDescription}</p>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {loading ? (
        <p className={styles.statusText}>{locale.loadingFolder}</p>
      ) : inspection && !inspection.exists ? (
        <p className={styles.error} role="status">{locale.folderMissing}</p>
      ) : inspection && inspection.entries.length > 0 ? (
        <div className={styles.treeCard}>
          <div className={styles.treeSummary}>
            <span>{locale.directoryCountLabel}: {inspection.directoryCount}</span>
            <span>{locale.fileCountLabel}: {inspection.fileCount}</span>
          </div>
          <ul className={styles.treeList}>
            {inspection.entries.map((entry) => (
              <li key={`${entry.kind}:${entry.name}`} className={styles.treeRow}>
                {entry.kind === "directory" ? <IconFolder /> : <IconFile />}
                <span className={styles.entryName}>{entry.name}</span>
                {entry.kind === "file" && <small className={styles.entrySize}>{formatSize(entry.size)}</small>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className={styles.emptyCard}>
          <p>{locale.emptyFolderHint}</p>
        </div>
      )}
    </section>
  );
}

/**
 * 功能：在 AI Work 右侧标签中预览绑定项目的文件、Git 变更树和文本差异。
 * 作用：通过认证的 Workspace 文件与 Git Owner 读取内容；不直接访问本机文件系统。
 * 关联文件：ApplicationWorkspace.tsx、connection/src/api.ts、project-file-git-tree.ts、ai-work-project-file-dock.css。
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Spin } from "antd";
import { getErrorMessage, loadWorkspaceGitFileDiff, loadWorkspaceGitStatus, readWorkspaceProjectTextFile, type WorkspaceGitFileDiff, type WorkspaceGitStatus, type WorkspaceProjectApplicationId, type WorkspaceProjectTextFile } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { buildProjectGitTree, workspaceGitStatusKind, workspaceGitStatusLabel, type ProjectGitTreeNode } from "./project-file-git-tree.js";
import "./ai-work-project-file-dock.css";

const fileReadPageSize = 40_000;

function diffLineKind(line: string): "added" | "removed" | "meta" | "context" {
  if (line.startsWith("+") && !line.startsWith("+++")) return "added";
  if (line.startsWith("-") && !line.startsWith("---")) return "removed";
  if (line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("\\")) return "meta";
  return "context";
}

function ProjectGitTreeNodes({ nodes, expandedPaths, selectedPath, onToggle, onOpenFile, root = false }: {
  nodes: ProjectGitTreeNode[];
  expandedPaths: Set<string>;
  selectedPath: string;
  onToggle: (path: string) => void;
  onOpenFile: (path: string) => void;
  root?: boolean;
}) {
  return <ul className="module-project-file-dock__tree-list" role={root ? "tree" : "group"} aria-label={root ? "Git 变更文件树" : undefined}>{nodes.map(node => node.kind === "directory" ? <li className="module-project-file-dock__tree-item" key={`directory:${node.path}`} role="treeitem" aria-expanded={expandedPaths.has(node.path)}>
    <button type="button" className="module-project-file-dock__tree-folder" aria-label={`${expandedPaths.has(node.path) ? "收起" : "展开"}文件夹 ${node.path}`} aria-expanded={expandedPaths.has(node.path)} onClick={() => onToggle(node.path)}>
      <WorkbenchIcon name="chevron" size={12} /><WorkbenchIcon name="folder" size={14} /><span>{node.name}</span>
    </button>
    {expandedPaths.has(node.path) ? <ProjectGitTreeNodes nodes={node.children} expandedPaths={expandedPaths} selectedPath={selectedPath} onToggle={onToggle} onOpenFile={onOpenFile} /> : null}
  </li> : <li className="module-project-file-dock__tree-item" key={`file:${node.path}`} role="treeitem" aria-current={node.file.projectPath === selectedPath || node.file.path === selectedPath ? "page" : undefined}>
    <button type="button" className={`module-project-file-dock__tree-file is-${workspaceGitStatusKind(node.file.status)}${node.file.projectPath === selectedPath || node.file.path === selectedPath ? " is-selected" : ""}`} aria-label={`打开 ${node.file.displayPath} 的 Git 差异：${workspaceGitStatusLabel(node.file.status)}`} onClick={() => onOpenFile(node.file.projectPath || node.file.path)}>
      <WorkbenchIcon name="file" size={14} /><span className="module-project-file-dock__tree-file-name" title={node.file.displayPath}>{node.name}</span><span className="module-project-file-dock__tree-status">{workspaceGitStatusLabel(node.file.status)}</span>
    </button>
  </li>)}</ul>;
}

export function AiWorkProjectFileDock({ project, appId, path, sourceId, initialView = "source", onOpenProjectFile }: {
  project: { id: string; title: string };
  appId: WorkspaceProjectApplicationId;
  path: string;
  sourceId?: string;
  initialView?: "source" | "diff";
  onOpenProjectFile?: (projectId: string, path: string, sourceId?: string, initialView?: "source" | "diff") => void;
}) {
  const [file, setFile] = useState<WorkspaceProjectTextFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"source" | "diff">(initialView);
  const [showChanges, setShowChanges] = useState(initialView === "diff");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [gitStatus, setGitStatus] = useState<WorkspaceGitStatus | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState("");
  const [gitRevision, setGitRevision] = useState(0);
  const [fileDiff, setFileDiff] = useState<WorkspaceGitFileDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState("");
  const requestRevision = useRef(0);
  const fileReadController = useRef<AbortController | null>(null);

  const readPage = useCallback(async (offset: number, append: boolean) => {
    const revision = ++requestRevision.current;
    fileReadController.current?.abort();
    const controller = new AbortController();
    fileReadController.current = controller;
    if (append) setLoadingMore(true);
    else {
      setFile(null);
      setLoading(true);
    }
    setError("");
    try {
      const { file: result } = await readWorkspaceProjectTextFile(project.id, appId, path, offset, fileReadPageSize, sourceId, controller.signal);
      if (requestRevision.current !== revision) return;
      setFile(current => append && current
        ? { ...result, offset: current.offset, content: current.content + result.content }
        : result);
    } catch (loadError) {
      if (requestRevision.current === revision && !controller.signal.aborted) setError(getErrorMessage(loadError));
    } finally {
      if (requestRevision.current === revision) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [appId, path, project.id, sourceId]);

  useEffect(() => {
    setView(initialView);
    setShowChanges(initialView === "diff");
  }, [initialView, path]);

  useEffect(() => {
    if (view !== "source") return;
    void readPage(0, false);
    return () => {
      requestRevision.current += 1;
      fileReadController.current?.abort();
      fileReadController.current = null;
    };
  }, [readPage, view]);

  const needsGitStatus = showChanges || view === "diff";
  useEffect(() => {
    if (!needsGitStatus) return;
    const controller = new AbortController();
    let active = true;
    setGitLoading(true);
    setGitError("");
    setGitStatus(null);
    void loadWorkspaceGitStatus(project.id, appId, sourceId, controller.signal)
      .then(({ status }) => { if (active) setGitStatus(status); })
      .catch(statusError => { if (active && !controller.signal.aborted) setGitError(getErrorMessage(statusError)); })
      .finally(() => { if (active) setGitLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [appId, gitRevision, needsGitStatus, project.id, sourceId]);

  const gitFile = useMemo(() => gitStatus?.files.find(candidate => candidate.projectPath === path || candidate.path === path) ?? null, [gitStatus, path]);
  const tree = useMemo(() => buildProjectGitTree(gitStatus?.files ?? []), [gitStatus]);

  useEffect(() => {
    if (view !== "diff" || !gitStatus || !gitFile) {
      setFileDiff(null);
      setDiffError("");
      setDiffLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setDiffLoading(true);
    setDiffError("");
    setFileDiff(null);
    void loadWorkspaceGitFileDiff(project.id, appId, gitFile.path, { sourceId, signal: controller.signal })
      .then(({ file: result }) => { if (active) setFileDiff(result); })
      .catch(diffLoadError => { if (active && !controller.signal.aborted) setDiffError(getErrorMessage(diffLoadError)); })
      .finally(() => { if (active) setDiffLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [appId, gitFile?.path, project.id, sourceId, view, gitStatus]);

  const toggleFolder = (folderPath: string) => setExpandedPaths(current => {
    const next = new Set(current);
    if (next.has(folderPath)) next.delete(folderPath);
    else next.add(folderPath);
    return next;
  });
  const openChangedFile = (selectedPath: string) => onOpenProjectFile?.(project.id, selectedPath, sourceId, "diff");
  const loadMore = async () => {
    if (!file || !file.truncated || loadingMore || loading) return;
    await readPage(file.offset + file.content.length, true);
  };

  const segments = path.split(/[\\/]/u).filter(Boolean);
  const loadedCharacters = file ? file.content.length : 0;
  const diffLines = fileDiff?.diff.split("\n") ?? [];
  return <section className="module-project-file-dock" aria-label={`项目文件 ${path}`}>
    <header className="module-project-file-dock__header">
      <nav className="module-project-file-dock__breadcrumb" aria-label="文件路径">
        <span className="module-project-file-dock__root" title={project.title}>{project.title}</span>
        {segments.map((segment, index) => <Fragment key={`${index}:${segment}`}>
          <WorkbenchIcon name="chevron" size={12} />
          <span className={index === segments.length - 1 ? "is-current" : ""} title={segment} aria-current={index === segments.length - 1 ? "page" : undefined}>{segment}</span>
        </Fragment>)}
      </nav>
      <Button size="small" type="text" aria-label={showChanges ? "隐藏更改" : "显示更改"} title={showChanges ? "隐藏更改" : "显示更改"} aria-expanded={showChanges} onClick={() => setShowChanges(value => !value)}><WorkbenchIcon name="branch" size={14} />{showChanges ? "隐藏更改" : "显示更改"}</Button>
      <Button size="small" type="text" aria-label={view === "source" ? "重新读取项目文件" : "刷新 Git 差异"} title={view === "source" ? "重新读取项目文件" : "刷新 Git 差异"} loading={view === "source" ? loading : gitLoading || diffLoading} onClick={() => view === "source" ? void readPage(0, false) : setGitRevision(value => value + 1)}><WorkbenchIcon name="refresh" size={15} /></Button>
    </header>
    {showChanges ? <section className="module-project-file-dock__changes" aria-label="Git 更改">
      <header className="module-project-file-dock__changes-heading"><strong>已更改的文件</strong>{gitStatus ? <span>{gitStatus.shownFileCount}{gitStatus.statusTruncated ? "+" : ""} 项</span> : null}<Button size="small" type="text" aria-label="刷新 Git 更改" title="刷新 Git 更改" loading={gitLoading} onClick={() => setGitRevision(value => value + 1)}><WorkbenchIcon name="refresh" size={13} /></Button></header>
      {gitLoading && !gitStatus ? <div className="module-project-file-dock__tree-state" role="status"><Spin size="small" /><span>正在读取 Git 状态…</span></div> : null}
      {gitError ? <Alert className="module-project-file-dock__tree-error" type="warning" showIcon message={gitError} /> : null}
      {gitStatus?.repositoryState === "not-repository" ? <p className="module-project-file-dock__tree-empty">当前项目尚未关联 Git 仓库。</p> : null}
      {gitStatus && gitStatus.repositoryState !== "not-repository" && tree.length === 0 ? <p className="module-project-file-dock__tree-empty">工作区干净，暂无变更文件。</p> : null}
      {tree.length ? <div className="module-project-file-dock__tree-scroll"><ProjectGitTreeNodes nodes={tree} expandedPaths={expandedPaths} selectedPath={path} onToggle={toggleFolder} onOpenFile={openChangedFile} root /></div> : null}
      {gitStatus?.statusTruncated ? <p className="module-project-file-dock__tree-truncated">Git Owner 仅返回前 {gitStatus.shownFileCount} 项，列表已按服务端范围截断。</p> : null}
    </section> : null}
    <div className="module-project-file-dock__view-tabs" role="tablist" aria-label="文件视图">
      <button type="button" role="tab" aria-selected={view === "source"} onClick={() => setView("source")}>源文件</button>
      <button type="button" role="tab" aria-selected={view === "diff"} onClick={() => setView("diff")}>Git 差异</button>
    </div>
    {view === "source" ? <>
      {loading && !file ? <div className="module-project-file-dock__state" role="status"><Spin size="small" /><span>正在读取项目文件…</span></div> : null}
      {error ? <Alert className="module-project-file-dock__error" type="warning" showIcon message={error} action={<Button size="small" onClick={() => void readPage(0, false)}>重试</Button>} /> : null}
      {file ? <>
        <div className="module-project-file-dock__meta"><WorkbenchIcon name="file" size={14} /><span>{file.path}</span><span>{loadedCharacters.toLocaleString()} / {file.totalCharacters.toLocaleString()} 字符</span></div>
        <div className="module-project-file-dock__source-scroll" aria-label="文件内容">
          <pre className="module-project-file-dock__source"><code>{file.content}</code></pre>
        </div>
        {file.truncated ? <footer className="module-project-file-dock__footer">
          <span>文件较长，已按页读取。</span>
          <Button size="small" loading={loadingMore} disabled={loading} onClick={() => void loadMore()}>读取下一段</Button>
        </footer> : null}
      </> : null}
    </> : <>
      {gitLoading && !gitStatus ? <div className="module-project-file-dock__state" role="status"><Spin size="small" /><span>正在检查 Git 状态…</span></div> : null}
      {gitError ? <Alert className="module-project-file-dock__error" type="warning" showIcon message={gitError} /> : null}
      {gitStatus?.repositoryState === "not-repository" ? <div className="module-project-file-dock__state">当前项目尚未关联 Git 仓库，无法读取差异。</div> : null}
      {gitStatus && gitStatus.repositoryState !== "not-repository" && !gitFile ? <div className="module-project-file-dock__state">Git 状态中没有当前文件的变更。</div> : null}
      {gitFile ? <div className="module-project-file-dock__diff-scroll" aria-label={`Git 差异 ${gitFile.displayPath}`}>
        <header className={`module-project-file-dock__diff-heading is-${workspaceGitStatusKind(gitFile.status)}`}><strong>{workspaceGitStatusLabel(gitFile.status)}</strong><code title={gitFile.displayPath}>{gitFile.displayPath}</code></header>
        {diffLoading ? <div className="module-project-file-dock__state" role="status"><Spin size="small" /><span>正在读取 Git 差异…</span></div> : null}
        {diffError ? <Alert className="module-project-file-dock__error" type="warning" showIcon message={diffError} /> : null}
        {fileDiff?.diffTruncated ? <Alert className="module-project-file-dock__error" type="warning" showIcon message="差异内容已达到 Git Owner 返回上限。" /> : null}
        {fileDiff?.diff ? <pre className="module-project-file-dock__diff"><code>{diffLines.map((line, index) => <span className="module-project-file-dock__diff-line" data-diff-type={diffLineKind(line)} key={`${index}:${line}`}>{line || " "}{index < diffLines.length - 1 ? "\n" : ""}</span>)}</code></pre> : null}
        {fileDiff && !fileDiff.diff ? <div className="module-project-file-dock__state">Git 没有返回可显示的文本差异。</div> : null}
      </div> : null}
    </>}
  </section>;
}

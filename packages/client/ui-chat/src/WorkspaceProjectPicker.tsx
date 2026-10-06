/**
 * 功能：在 AI Work 输入区选择或登记通用项目文件夹。
 * 作用：从在线 Daemon 的真实卷和用户主目录浏览一级文件夹，维护账户项目登记并把选择交给当前会话。
 * 不负责：Minecraft 实例管理、模型授权或全局 LFAA 数据目录管理。
 */
import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Input, Modal, Popconfirm, Popover, Select, Spin } from "antd";
import { browseWorkspaceDirectory, createWorkspaceGitWorktree, createWorkspaceProject, getErrorMessage, loadWorkspaceProjects, removeWorkspaceProject, renameWorkspaceProject, type WorkspaceDaemonNode, type WorkspaceProject, type WorkspaceProjectApplicationId } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

interface WorkspaceProjectPickerProps {
  appId: WorkspaceProjectApplicationId;
  applicationName: string;
  projects: WorkspaceProject[];
  projectListTruncated: boolean;
  projectLoadError: string;
  onRetryProjects: () => void;
  nodes: WorkspaceDaemonNode[];
  value: string | null;
  selectedProjectTitle?: string | null;
  defaultDirectory: string;
  disabled?: boolean;
  onChange: (project: WorkspaceProject | null) => void;
  onProjectsChange: (projects: WorkspaceProject[]) => void;
}

function parentDirectory(path: string): string {
  const trimmed = path.replace(/[\\/]+$/u, "");
  if (/^[A-Za-z]:$/u.test(trimmed)) return `${trimmed}\\`;
  if (!trimmed) return "/";
  const parent = trimmed.replace(/[\\/][^\\/]*$/u, "");
  return parent || trimmed;
}

function childDirectory(path: string, name: string, platform: string): string {
  const separator = platform === "win32" ? "\\" : "/";
  return `${path.replace(/[\\/]+$/u, "")}${separator}${name}`;
}

function directoryName(path: string): string {
  return path.replace(/[\\/]+$/u, "").split(/[\\/]/u).at(-1) || path;
}

export function WorkspaceProjectPicker({ appId, applicationName, projects, projectListTruncated, projectLoadError, onRetryProjects, nodes, value, selectedProjectTitle, defaultDirectory, disabled = false, onChange, onProjectsChange }: WorkspaceProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<WorkspaceProject | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [homeDirectory, setHomeDirectory] = useState("");
  const [homePath, setHomePath] = useState("");
  const [roots, setRoots] = useState<string[]>([]);
  const [directoryPath, setDirectoryPath] = useState("");
  const [entries, setEntries] = useState<string[]>([]);
  const [directoryTruncated, setDirectoryTruncated] = useState(false);
  const [title, setTitle] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [projectActionError, setProjectActionError] = useState("");
  const [worktreeLoadingId, setWorktreeLoadingId] = useState<string | null>(null);
  const [deleteWorktreeTarget, setDeleteWorktreeTarget] = useState<WorkspaceProject | null>(null);
  const [deleteWorktreeConfirmed, setDeleteWorktreeConfirmed] = useState(false);
  const [remoteProjects, setRemoteProjects] = useState<WorkspaceProject[] | null>(null);
  const [projectSearchTruncated, setProjectSearchTruncated] = useState(false);
  const [projectSearchLoading, setProjectSearchLoading] = useState(false);
  const selected = projects.find(project => project.id === value) ?? null;
  const selectedNode = nodes.find(node => node.id === nodeId) ?? null;
  const onlineNodes = nodes.filter(node => node.status === "online");
  const nodesById = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
  const homePrefix = selectedNode && homeDirectory ? childDirectory(homeDirectory, "", selectedNode.platform) : "";
  const currentLocation = directoryPath && homePrefix && (directoryPath === homeDirectory || directoryPath.startsWith(homePrefix))
    ? "@home"
    : roots.find(root => directoryPath.toLocaleLowerCase().startsWith(root.toLocaleLowerCase())) ?? homePath;
  const atVolumeRoot = roots.some(root => root.toLocaleLowerCase() === directoryPath.toLocaleLowerCase());
  const locationOptions = [...(homeDirectory ? [{ value: "@home", label: `用户主目录 · ${homeDirectory}` }] : []), ...roots.map(root => ({ value: root, label: `此计算机 · ${root}` }))];
  const visibleProjects = (query.trim() ? remoteProjects ?? [] : projects).filter(project => {
    const text = `${project.title} ${project.path} ${nodesById.get(project.nodeId)?.displayName ?? ""}`.toLocaleLowerCase();
    return text.includes(query.trim().toLocaleLowerCase());
  });

  useEffect(() => {
    const search = query.trim();
    if (!open || !search) {
      setRemoteProjects(null);
      setProjectSearchTruncated(false);
      setProjectSearchLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setProjectSearchLoading(true);
      setProjectActionError("");
      void loadWorkspaceProjects({ appId, query: search, signal: controller.signal }).then(result => {
        if (!controller.signal.aborted) {
          setRemoteProjects(result.projects);
          setProjectSearchTruncated(result.truncated);
        }
      }).catch(searchError => {
        if (!controller.signal.aborted) {
          setRemoteProjects([]);
          setProjectActionError(getErrorMessage(searchError));
        }
      }).finally(() => {
        if (!controller.signal.aborted) setProjectSearchLoading(false);
      });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [appId, open, query]);

  async function loadHome(nextNodeId: string, preferredPath = ""): Promise<void> {
    setDirectoryLoading(true);
    setError("");
    try {
      const homeResult = (await browseWorkspaceDirectory(appId, nextNodeId, "home")).result;
      const home = homeResult.path;
      setHomeDirectory(home);
      setHomePath(homeResult.root ?? home);
      setRoots(homeResult.roots ?? [homeResult.root ?? home]);
      let path = home;
      if (preferredPath) {
        try {
          await browseWorkspaceDirectory(appId, nextNodeId, "list", preferredPath);
          path = preferredPath;
        } catch { /* 设置中的默认任务目录可能属于其他节点；此时从该节点用户主目录开始浏览。 */ }
      }
      const result = (await browseWorkspaceDirectory(appId, nextNodeId, "list", path)).result;
      setHomePath(result.root ?? homeResult.root ?? home);
      setDirectoryPath(result.path);
      setEntries(result.entries ?? []);
      setDirectoryTruncated(Boolean(result.truncated));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setDirectoryPath("");
      setEntries([]);
      setDirectoryTruncated(false);
    } finally {
      setDirectoryLoading(false);
    }
  }

  function beginCreate(): void {
    setOpen(false);
    setQuery("");
    setCreateOpen(true);
    setTitle("");
    setNewFolderName("");
    setError("");
    const nextNode = onlineNodes[0];
    if (!nextNode) { setError("当前没有在线且支持项目文件访问的 Daemon。请连接或更新一个节点，然后重试。"); return; }
    setNodeId(nextNode.id);
    void loadHome(nextNode.id, defaultDirectory);
  }

  async function selectNode(nextNodeId: string): Promise<void> {
    setNodeId(nextNodeId);
    await loadHome(nextNodeId, "");
  }

  async function openDirectory(name: string): Promise<void> {
    if (!selectedNode || !directoryPath) return;
    setDirectoryLoading(true);
    setError("");
    try {
      const path = childDirectory(directoryPath, name, selectedNode.platform);
      const result = (await browseWorkspaceDirectory(appId, selectedNode.id, "list", path)).result;
      setHomePath(result.root ?? homePath);
      setDirectoryPath(result.path);
      setEntries(result.entries ?? []);
      setDirectoryTruncated(Boolean(result.truncated));
    } catch (loadError) { setError(getErrorMessage(loadError)); }
    finally { setDirectoryLoading(false); }
  }

  async function goUp(): Promise<void> {
    if (!selectedNode || !directoryPath || directoryPath === homePath || atVolumeRoot) return;
    const parent = parentDirectory(directoryPath);
    await openAbsoluteDirectory(parent);
  }

  async function openAbsoluteDirectory(path: string): Promise<void> {
    if (!selectedNode) return;
    setDirectoryLoading(true);
    setError("");
    try {
      const result = (await browseWorkspaceDirectory(appId, selectedNode.id, "list", path)).result;
      setHomePath(result.root ?? homePath);
      setDirectoryPath(result.path);
      setEntries(result.entries ?? []);
      setDirectoryTruncated(Boolean(result.truncated));
    } catch (loadError) { setError(getErrorMessage(loadError)); }
    finally { setDirectoryLoading(false); }
  }

  async function addFolder(): Promise<void> {
    if (!selectedNode || !directoryPath || !newFolderName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await browseWorkspaceDirectory(appId, selectedNode.id, "create-directory", directoryPath, newFolderName.trim());
      setNewFolderName("");
      await openAbsoluteDirectory(directoryPath);
    } catch (createError) { setError(getErrorMessage(createError)); }
    finally { setSaving(false); }
  }

  async function registerCurrentDirectory(): Promise<void> {
    if (!selectedNode || !directoryPath) return;
    setSaving(true);
    setError("");
    try {
      const { project } = await createWorkspaceProject(appId, selectedNode.id, directoryPath, title.trim());
      onProjectsChange([project, ...projects.filter(item => item.id !== project.id)]);
      onChange(project);
      setCreateOpen(false);
    } catch (createError) { setError(getErrorMessage(createError)); }
    finally { setSaving(false); }
  }

  async function saveRename(): Promise<void> {
    if (!renameTarget) return;
    setSaving(true);
    setError("");
    try {
      const { project } = await renameWorkspaceProject(renameTarget.id, renameDraft, appId);
      onProjectsChange([project, ...projects.filter(item => item.id !== project.id)]);
      setRemoteProjects(current => current?.map(item => item.id === project.id ? project : item) ?? null);
      setRenameTarget(null);
    } catch (renameError) { setError(getErrorMessage(renameError)); }
    finally { setSaving(false); }
  }

  async function unregister(project: WorkspaceProject, deleteManagedWorktree: boolean): Promise<void> {
    setProjectActionError("");
    try {
      await removeWorkspaceProject(project.id, deleteManagedWorktree, appId);
      onProjectsChange(projects.filter(item => item.id !== project.id));
      setRemoteProjects(current => current?.filter(item => item.id !== project.id) ?? null);
    } catch (removeError) { setProjectActionError(getErrorMessage(removeError)); }
  }

  async function createWorktree(project: WorkspaceProject): Promise<void> {
    setWorktreeLoadingId(project.id);
    setProjectActionError("");
    try {
      const { project: worktree } = await createWorkspaceGitWorktree(project.id, appId);
      onProjectsChange([worktree, ...projects.filter(item => item.id !== worktree.id)]);
      onChange(worktree);
      setOpen(false);
    } catch (createError) { setProjectActionError(getErrorMessage(createError)); }
    finally { setWorktreeLoadingId(null); }
  }

  const projectMenu = <div className="ai-work-chat__project-menu" role="dialog" aria-label={`选择 ${applicationName} 项目文件夹`}>
    <Input allowClear autoFocus maxLength={200} aria-label="搜索项目" placeholder="搜索项目" prefix={<WorkbenchIcon name="search" size={14} />} value={query} onChange={event => setQuery(event.target.value)} />
    <p className="ai-work-chat__project-empty">这里只管理当前 {applicationName} 的项目文件夹，用于会话归组和项目文件上下文；不会新建应用或 Minecraft 实例。</p>
    {projectLoadError ? <div className="ai-work-chat__project-error" role="alert">项目目录加载失败：{projectLoadError}<Button type="link" size="small" onClick={onRetryProjects}>重试</Button></div> : null}
    {projectActionError ? <p className="ai-work-chat__project-error" role="alert">{projectActionError}</p> : null}
    <div className="ai-work-chat__project-list" role="group" aria-label="项目目录">
      {projectSearchLoading ? <Spin size="small" /> : visibleProjects.map(project => <div className={`ai-work-chat__project-option${project.id === value ? " is-selected" : ""}`} key={project.id}>
        <button type="button" aria-pressed={project.id === value} onClick={() => { onProjectsChange([project, ...projects.filter(item => item.id !== project.id)]); onChange(project); setOpen(false); }} title={`${nodesById.get(project.nodeId)?.displayName ?? "Daemon 节点"} · ${project.path}`}><WorkbenchIcon name="folder" size={15} /><span><strong>{project.title}{project.appId === null ? " · 待归属" : ""}</strong><small>{nodesById.get(project.nodeId)?.displayName ?? "Daemon 节点"} · {project.path}</small></span>{project.id === value ? <span className="ai-work-chat__project-check" aria-label="当前项目">✓</span> : null}</button>
        <div className="ai-work-chat__project-option-actions">
          {project.gitWorktree ? <span title={`分支 ${project.gitWorktree.branch}`}>Worktree</span> : null}
          {!project.gitWorktree ? <Button type="text" size="small" loading={worktreeLoadingId === project.id} disabled={Boolean(worktreeLoadingId) || nodesById.get(project.nodeId)?.status !== "online" || !nodesById.get(project.nodeId)?.gitWorkspaceSupported} title={nodesById.get(project.nodeId)?.gitWorkspaceSupported ? "创建隔离 AI Worktree，不修改源项目" : "此 Daemon 尚未提供 Git Worktree 能力"} onClick={() => void createWorktree(project)}>创建 Worktree</Button> : null}
          <button type="button" aria-label={`重命名 ${project.title}`} title="重命名项目" onClick={() => { setError(""); setRenameTarget(project); setRenameDraft(project.title); setOpen(false); }}>改名</button>
          <Popconfirm title={project.gitWorktree ? "删除 AI Worktree？" : "从项目列表移除？"} description={project.gitWorktree ? `下一步会再次确认删除工作树中的文件；源项目不变。分支 ${project.gitWorktree.branch} 的 Git 历史会保留。` : "只移除目录登记；磁盘文件和已有会话会保留。"} okText={project.gitWorktree ? "下一步" : "移除登记"} cancelText="取消" onConfirm={() => { if (project.gitWorktree) { setDeleteWorktreeTarget(project); setDeleteWorktreeConfirmed(false); setProjectActionError(""); } else void unregister(project, false); }}>
            <button type="button" aria-label={project.gitWorktree ? `删除 AI Worktree ${project.title}` : `移除 ${project.title}`} title={project.gitWorktree ? "删除受管 AI 工作树" : "移除项目登记"}>移除</button>
          </Popconfirm>
        </div>
      </div>)}
      {!projectSearchLoading && !visibleProjects.length ? <span className="ai-work-chat__project-empty">{query.trim() ? "没有匹配的项目" : projects.length ? "没有匹配的项目" : "还没有项目"}</span> : null}
    </div>
    {query.trim() && projectSearchTruncated ? <span className="ai-work-chat__project-empty">结果超过 200 个，请继续缩小搜索范围</span> : null}
    {!query.trim() && projectListTruncated ? <span className="ai-work-chat__project-empty">显示最近 200 个项目；可搜索更早的项目</span> : null}
    <Button className="ai-work-chat__project-create" type="text" icon={<WorkbenchIcon name="plus" size={15} />} onClick={beginCreate}>关联文件夹</Button>
    <Button className="ai-work-chat__project-none" type="text" icon={<WorkbenchIcon name="close" size={14} />} onClick={() => { onChange(null); setOpen(false); }}>不在项目中</Button>
  </div>;

  return <>
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setQuery(""); }} trigger="click" placement="topLeft" arrow={false} overlayClassName="ai-work-chat__project-overlay" content={projectMenu} getPopupContainer={trigger => trigger.closest<HTMLElement>(".workbench-shell") ?? trigger.parentElement ?? document.body}>
      <Button className="ai-work-chat__project-trigger" type="text" disabled={disabled} aria-label={selected ? `当前项目：${selected.title}` : selectedProjectTitle ? `当前会话绑定已移除项目：${selectedProjectTitle}` : `选择 ${applicationName} 项目文件夹`} title={selected?.path ?? (selectedProjectTitle ? `项目登记已移除；会话仍保留原目录上下文：${selectedProjectTitle}` : `选择或关联 ${applicationName} 文件夹`)} icon={<WorkbenchIcon name="folder" size={13} />}>{selected?.title ?? (selectedProjectTitle ? `已移除 · ${selectedProjectTitle}` : "选择项目文件夹")}</Button>
    </Popover>
    <Modal className="ai-work-chat__project-modal" title={`关联 ${applicationName} 项目文件夹`} open={createOpen} onCancel={() => { if (!saving) setCreateOpen(false); }} onOk={() => void registerCurrentDirectory()} okText="关联此文件夹" cancelText="取消" okButtonProps={{ disabled: !directoryPath || directoryLoading || saving }} cancelButtonProps={{ disabled: saving }} confirmLoading={saving} destroyOnHidden>
      <div className="ai-work-chat__project-browser">
        <p className="ai-work-chat__project-empty">把现有文件夹登记到当前 {applicationName}，用于归组相关会话并限定 AI 项目文件上下文。这里只登记目录；不会新建应用或 Minecraft 实例。</p>
        <label>工作位置</label>
        <Select aria-label="工作位置" value={nodeId || undefined} placeholder="选择在线文件节点" disabled={directoryLoading || saving} options={nodes.map(node => ({ value: node.id, label: `${node.displayName} · ${node.status === "online" ? "在线" : "离线"}`, disabled: node.status !== "online" }))} onChange={value => void selectNode(value)} />
        {locationOptions.length > 1 ? <Select aria-label="计算机位置" value={currentLocation} disabled={directoryLoading || saving} options={locationOptions} onChange={value => void openAbsoluteDirectory(value === "@home" ? homeDirectory : value)} /> : null}
        {directoryPath ? <div className="ai-work-chat__project-path" title={directoryPath}><Button size="small" type="text" disabled={directoryPath === homePath || atVolumeRoot || directoryLoading} onClick={() => void goUp()}>上级</Button><span>{directoryPath}</span></div> : null}
        <div className="ai-work-chat__project-directories" aria-label="文件夹">
          {directoryLoading ? <Spin size="small" /> : entries.map(entry => <button type="button" key={entry} onClick={() => void openDirectory(entry)}><WorkbenchIcon name="folder" size={15} /><span>{entry}</span></button>)}
          {!directoryLoading && directoryTruncated ? <span className="ai-work-chat__project-empty">目录过多，仅显示前 500 个文件夹</span> : null}
          {!directoryLoading && !entries.length && directoryPath ? <span className="ai-work-chat__project-empty">此文件夹中没有子文件夹</span> : null}
        </div>
        <div className="ai-work-chat__project-new-folder"><Input aria-label="新文件夹名称" placeholder="新文件夹名称" maxLength={120} value={newFolderName} onChange={event => setNewFolderName(event.target.value)} onPressEnter={() => void addFolder()} /><Button disabled={!newFolderName.trim() || !directoryPath || saving} onClick={() => void addFolder()}>创建文件夹</Button></div>
        <Input aria-label="项目名称" placeholder={directoryPath ? directoryName(directoryPath) : "项目名称"} maxLength={120} value={title} onChange={event => setTitle(event.target.value)} />
        {error ? <p className="ai-work-chat__project-error" role="alert">{error}</p> : null}
      </div>
    </Modal>
    <Modal title={`重命名项目${renameTarget ? ` · ${renameTarget.title}` : ""}`} open={Boolean(renameTarget)} onCancel={() => setRenameTarget(null)} onOk={() => void saveRename()} okText="保存" cancelText="取消" confirmLoading={saving} destroyOnHidden>
      <Input aria-label="项目名称" maxLength={120} value={renameDraft} onChange={event => setRenameDraft(event.target.value)} onPressEnter={() => void saveRename()} />
      {error ? <p className="ai-work-chat__project-error" role="alert">{error}</p> : null}
    </Modal>
    <Modal title="再次确认删除 AI Worktree" open={Boolean(deleteWorktreeTarget)} onCancel={() => { if (worktreeLoadingId !== deleteWorktreeTarget?.id) setDeleteWorktreeTarget(null); }} onOk={() => {
      if (!deleteWorktreeTarget || !deleteWorktreeConfirmed) return;
      const target = deleteWorktreeTarget;
      setWorktreeLoadingId(target.id);
      void removeWorkspaceProject(target.id, true, appId).then(() => {
        onProjectsChange(projects.filter(item => item.id !== target.id));
        if (target.id === value) onChange(null);
        setDeleteWorktreeTarget(null);
      }).catch(removeError => setProjectActionError(getErrorMessage(removeError))).finally(() => setWorktreeLoadingId(null));
    }} okText="删除工作树文件" cancelText="保留工作树" okButtonProps={{ danger: true, disabled: !deleteWorktreeConfirmed || worktreeLoadingId === deleteWorktreeTarget?.id }} confirmLoading={worktreeLoadingId === deleteWorktreeTarget?.id} closable={worktreeLoadingId !== deleteWorktreeTarget?.id} maskClosable={worktreeLoadingId !== deleteWorktreeTarget?.id} destroyOnHidden>
      <p>这会删除受管工作树的全部文件。原始项目与源目录不受影响；分支 {deleteWorktreeTarget?.gitWorktree?.branch} 会保留在源仓库中。</p>
      <Checkbox checked={deleteWorktreeConfirmed} onChange={event => setDeleteWorktreeConfirmed(event.target.checked)}>我确认永久删除这棵独立工作树</Checkbox>
      {projectActionError ? <p className="ai-work-chat__project-error" role="alert">{projectActionError}</p> : null}
    </Modal>
  </>;
}

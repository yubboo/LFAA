import { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Popconfirm, Popover, Select, Spin, Tooltip } from "antd";
import { browseLocalWorkspaceDirectory, createLocalWorkspaceProject, isDesktopApp, loadWorkspaceProjects, removeWorkspaceProject, selectDesktopWorkspaceDirectory, updateLocalWorkspaceProject, type WorkspaceProject, type WorkspaceProjectContextApplicationId, type WorkspaceProjectMemoryMode } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { APPLICATION_LABELS, WORKSPACE_PROJECT_CONTEXT_APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import type { WorkspaceProjectPickerProps } from "./WorkspaceProjectPicker.js";
import { workspaceProjectManagerEventName } from "./project-manager-events.js";

const projectApplicationOptions = WORKSPACE_PROJECT_CONTEXT_APPLICATION_IDS.map(applicationId => ({ value: applicationId, label: APPLICATION_LABELS[applicationId] }));

function compactProjectSummary(project: WorkspaceProject): string {
  const extraSources = project.sources.filter(source => source.path !== project.path).map(source => source.path);
  const applications = project.applicationIds.map(applicationId => APPLICATION_LABELS[applicationId]).join("、");
  return [applications ? `关联应用：${applications}` : "未关联领域应用", project.path ? `项目文件夹：${project.path}` : "", ...extraSources].filter(Boolean).join(" · ") || "尚未关联本机文件夹";
}

export function LocalWorkspaceProjectPicker({ projects, projectListStatus, projectListTruncated, projectLoadError, onRetryProjects, value, selectedProjectTitle, disabled = false, onChange, onProjectsChange, activeSessionId }: WorkspaceProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<WorkspaceProject | null>(null);
  const [search, setSearch] = useState("");
  const [remoteProjects, setRemoteProjects] = useState<WorkspaceProject[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [applicationIds, setApplicationIds] = useState<WorkspaceProjectContextApplicationId[]>([]);
  const [memoryMode, setMemoryMode] = useState<WorkspaceProjectMemoryMode>("default");
  const [projectParentPath, setProjectParentPath] = useState("");
  const [sourcePaths, setSourcePaths] = useState<string[]>([]);
  const [sourcePathDraft, setSourcePathDraft] = useState("");
  const [pathEntryOpen, setPathEntryOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderPickerPurpose, setFolderPickerPurpose] = useState<"parent" | "source">("source");
  const [directoryPath, setDirectoryPath] = useState("");
  const [directoryRoots, setDirectoryRoots] = useState<string[]>([]);
  const [directoryEntries, setDirectoryEntries] = useState<string[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const selected = projects.find(project => project.id === value && project.nodeId === null) ?? null;
  const visibleProjects = useMemo(() => (search.trim() ? remoteProjects ?? [] : projects)
    .filter(project => project.appId === "workspace" && project.nodeId === null)
    .filter(project => `${project.title} ${compactProjectSummary(project)} ${project.instructions}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [projects, remoteProjects, search]);
  const resolvedTitle = selected?.title ?? selectedProjectTitle;

  function beginCreate(): void {
    setEditingProject(null);
    setTitle("");
    setInstructions("");
    setApplicationIds([]);
    setMemoryMode("default");
    setProjectParentPath("");
    setSourcePaths([]);
    setSourcePathDraft("");
    setError("");
    setEditorOpen(true);
    setOpen(false);
  }

  function beginEdit(project: WorkspaceProject): void {
    setEditingProject(project);
    setTitle(project.title);
    setInstructions(project.instructions);
    setApplicationIds(project.applicationIds);
    setMemoryMode(project.memoryMode);
    setProjectParentPath("");
    setSourcePaths(project.sources.map(source => source.path).filter(path => path !== project.path));
    setSourcePathDraft("");
    setError("");
    setEditorOpen(true);
    setOpen(false);
  }

  useEffect(() => {
    const openEditor = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string | null }>).detail;
      const target = detail?.projectId ? projects.find(project => project.id === detail.projectId) : null;
      if (target) beginEdit(target);
      else beginCreate();
    };
    window.addEventListener(workspaceProjectManagerEventName, openEditor);
    return () => window.removeEventListener(workspaceProjectManagerEventName, openEditor);
  }, [projects]);

  useEffect(() => {
    const query = search.trim();
    if (!open || !query) { setRemoteProjects(null); setSearchLoading(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      void loadWorkspaceProjects({ appId: "workspace", query, signal: controller.signal }).then(result => {
        if (!controller.signal.aborted) setRemoteProjects(result.projects);
      }).catch(() => {
        if (!controller.signal.aborted) setRemoteProjects([]);
      }).finally(() => {
        if (!controller.signal.aborted) setSearchLoading(false);
      });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, search]);

  async function addSourcePath(pathInput: string): Promise<void> {
    const path = pathInput.trim();
    if (!path) return;
    setSaving(true);
    setError("");
    try {
      const { result } = await browseLocalWorkspaceDirectory("inspect", path);
      if (result.directory !== true || !result.path) throw new Error("请选择 LFAA 本机上真实存在的文件夹。");
      if (result.path === editingProject?.path || sourcePaths.includes(result.path)) throw new Error("这个文件夹已经是项目目录或已添加到当前项目。");
      setSourcePaths(current => [...current, result.path]);
      setFolderPickerOpen(false);
      setSourcePathDraft("");
      setPathEntryOpen(false);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "本机文件夹核验失败。");
    } finally { setSaving(false); }
  }

  async function selectDirectory(pathInput: string, purpose: "parent" | "source"): Promise<void> {
    const path = pathInput.trim();
    if (!path) return;
    setSaving(true);
    setError("");
    try {
      const { result } = await browseLocalWorkspaceDirectory("inspect", path);
      if (result.directory !== true || !result.path) throw new Error("请选择 LFAA 本机上真实存在的文件夹。");
      if (purpose === "parent") {
        setProjectParentPath(result.path);
      } else {
        if (result.path === editingProject?.path || sourcePaths.includes(result.path)) throw new Error("这个文件夹已经是项目目录或已添加到当前项目。");
        setSourcePaths(current => [...current, result.path]);
      }
      setFolderPickerOpen(false);
      setSourcePathDraft("");
      setPathEntryOpen(false);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "本机文件夹核验失败。");
    } finally { setSaving(false); }
  }

  async function chooseFolder(purpose: "parent" | "source"): Promise<void> {
    setError("");
    setPathEntryOpen(false);
    setDirectoryError("");
    setFolderPickerPurpose(purpose);
    if (isDesktopApp()) {
      try {
        const path = await selectDesktopWorkspaceDirectory();
        if (path) await selectDirectory(path, purpose);
      } catch (selectionError) {
        setError(selectionError instanceof Error ? selectionError.message : "本机文件夹选择失败。");
      }
      return;
    }
    setFolderPickerOpen(true);
    setDirectoryLoading(true);
    try {
      const { result } = await browseLocalWorkspaceDirectory("home");
      if (!result.path) throw new Error("LFAA 本机 Host 没有返回可浏览的位置。");
      setDirectoryRoots(result.roots ?? []);
      await browseDirectory(result.path);
    } catch (selectionError) {
      setDirectoryError(selectionError instanceof Error ? selectionError.message : "本机文件夹浏览失败。");
    } finally { setDirectoryLoading(false); }
  }

  async function browseDirectory(path: string): Promise<void> {
    setDirectoryLoading(true);
    setDirectoryError("");
    try {
      const { result } = await browseLocalWorkspaceDirectory("list", path);
      if (!result.path) throw new Error("LFAA 本机 Host 没有返回有效文件夹。");
      setDirectoryPath(result.path);
      setDirectoryEntries(result.entries ?? []);
    } catch (browseError) {
      setDirectoryError(browseError instanceof Error ? browseError.message : "本机文件夹浏览失败。");
    } finally { setDirectoryLoading(false); }
  }

  function parentPath(path: string): string {
    const trimmed = path.replace(/[\\/]+$/u, "");
    if (/^[A-Za-z]:$/u.test(trimmed)) return `${trimmed}\\`;
    const parent = trimmed.replace(/[\\/][^\\/]*$/u, "");
    return parent || path;
  }

  function projectDirectoryPreview(): string {
    const parent = projectParentPath.replace(/[\\/]+$/u, "");
    const separator = /^[A-Za-z]:/u.test(projectParentPath) ? "\\" : "/";
    const folder = title.trim().replace(/\s+/gu, " ").replace(/[. ]+$/u, "") || "项目名称";
    return `${parent}${separator}${folder}`;
  }

  async function saveProject(): Promise<void> {
    if (!title.trim()) { setError("请填写项目名称。"); return; }
    if (!editingProject && !projectParentPath) { setError("请选择项目文件夹要创建在哪个工作区分组下。"); return; }
    setSaving(true);
    setError("");
    setFolderPickerOpen(false);
    try {
      const { project } = editingProject
        ? await updateLocalWorkspaceProject(editingProject.id, { title: title.trim(), instructions, memoryMode, applicationIds, sourcePaths })
        : await createLocalWorkspaceProject({ title: title.trim(), parentPath: projectParentPath, instructions, memoryMode, applicationIds, sourcePaths });
      onProjectsChange([project, ...projects.filter(item => item.id !== project.id)]);
      onRetryProjects();
      setEditorOpen(false);
      if (!editingProject && !activeSessionId) onChange(project);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "项目保存失败。");
    } finally { setSaving(false); }
  }

  async function removeProject(project: WorkspaceProject): Promise<void> {
    setActionError("");
    try {
      await removeWorkspaceProject(project.id, false, "workspace");
      onProjectsChange(projects.filter(item => item.id !== project.id));
      if (project.id === value) onChange(null);
      onRetryProjects();
    } catch (removeError) {
      setActionError(removeError instanceof Error ? removeError.message : "项目移除失败。");
    }
  }

  const projectMenu = <div className="ai-work-chat__project-menu" role="dialog" aria-label="项目管理">
    <Input allowClear autoFocus maxLength={200} aria-label="搜索项目" placeholder="搜索项目" prefix={<WorkbenchIcon name="search" size={14} />} value={search} onChange={event => setSearch(event.target.value)} />
    <p className="ai-work-chat__project-empty">项目用于归组聊天、关联本机源文件夹和保存项目指令。创建项目不需要选择 Daemon。</p>
    {projectLoadError ? <div className="ai-work-chat__project-error" role="alert">项目读取失败：{projectLoadError}<Button type="link" size="small" onClick={onRetryProjects}>重试</Button></div> : null}
    {actionError ? <p className="ai-work-chat__project-error" role="alert">{actionError}</p> : null}
    <div className="ai-work-chat__project-list" role="group" aria-label="项目">
      {projectListStatus === "loading" ? <span className="ai-work-chat__project-empty">正在读取项目…</span> : null}
      {searchLoading ? <Spin size="small" /> : visibleProjects.map(project => <div className={`ai-work-chat__project-option${project.id === value ? " is-selected" : ""}`} key={project.id}>
        <button type="button" aria-pressed={project.id === value} onClick={() => { onChange(project); setOpen(false); }} title={compactProjectSummary(project)}>
          <WorkbenchIcon name="folder" size={15} /><span><strong>{project.title}</strong><small>{compactProjectSummary(project)}</small></span>
          {project.id === value ? <span className="ai-work-chat__project-check" aria-label="当前项目">✓</span> : null}
        </button>
        <div className="ai-work-chat__project-option-actions">
          <button type="button" aria-label={`编辑项目：${project.title}`} title="编辑项目" onClick={() => beginEdit(project)}>编辑</button>
          <Popconfirm title="移除项目？" description="聊天和本机文件夹会保留；只移除项目归组、指令和记忆设置。" okText="移除项目" cancelText="取消" onConfirm={() => void removeProject(project)}>
            <button type="button" aria-label={`移除项目：${project.title}`} title="移除项目">移除</button>
          </Popconfirm>
        </div>
      </div>)}
      {!searchLoading && !visibleProjects.length ? <span className="ai-work-chat__project-empty">{search.trim() ? "没有匹配的项目" : "还没有项目"}</span> : null}
    </div>
    {!search.trim() && projectListTruncated ? <span className="ai-work-chat__project-empty">显示最近 200 个项目；可搜索更早的项目</span> : null}
    <Button className="ai-work-chat__project-create" type="text" icon={<WorkbenchIcon name="plus" size={15} />} onClick={beginCreate}>创建项目</Button>
    <Button className="ai-work-chat__project-none" type="text" icon={<WorkbenchIcon name="close" size={14} />} onClick={() => { onChange(null); setOpen(false); }}>移出项目</Button>
  </div>;

  return <>
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(""); }} trigger="click" placement="topLeft" arrow={false} overlayClassName="ai-work-chat__project-overlay" content={projectMenu} getPopupContainer={trigger => trigger.closest<HTMLElement>(".workbench-shell") ?? trigger.parentElement ?? document.body}>
      <Tooltip trigger={["hover", "focus"]} placement="top" title={selected ? `${selected.title} · ${compactProjectSummary(selected)}` : selectedProjectTitle ?? "将聊天归入项目"}>
        <Button className="ai-work-chat__project-trigger" type="text" disabled={disabled} aria-label={resolvedTitle ? `当前项目：${resolvedTitle}` : "选择项目"} icon={<WorkbenchIcon name="folder" size={13} />}><span className="ai-work-chat__project-trigger-label">{resolvedTitle ?? "选择项目"}</span></Button>
      </Tooltip>
    </Popover>
    <Modal className="ai-work-chat__project-modal" title={editingProject ? "编辑项目" : "创建项目"} open={editorOpen} onCancel={() => { if (!saving) setEditorOpen(false); }} onOk={() => void saveProject()} okText={editingProject ? "保存" : "创建项目"} cancelText="取消" okButtonProps={{ disabled: !title.trim() || (!editingProject && !projectParentPath) || saving }} cancelButtonProps={{ disabled: saving }} confirmLoading={saving} destroyOnHidden getContainer={() => document.querySelector(".workbench-shell") ?? document.body}>
      <div className="ai-work-chat__project-editor">
        <label htmlFor="ai-work-project-title">项目名称</label>
        <Input id="ai-work-project-title" maxLength={120} placeholder="输入项目名称" value={title} onChange={event => setTitle(event.target.value)} />
        <label htmlFor="ai-work-project-applications">关联应用（可选）</label>
        <Select id="ai-work-project-applications" mode="multiple" aria-label="项目关联应用" value={applicationIds} options={projectApplicationOptions} maxTagCount="responsive" placeholder="选择与项目相关的应用" onChange={(values: WorkspaceProjectContextApplicationId[]) => setApplicationIds(values)} />
        <p className="ai-work-chat__project-memory-help">关联的应用会作为 Agent 的项目领域背景，帮助它结合当前目标选择已登记的工具、Skill 和专家；关联本身不会授权额外操作。</p>
        <label>工作区分组</label>
        <div className="ai-work-chat__project-source-box">
          {editingProject
            ? <div className="ai-work-chat__project-source" title={editingProject.path}><WorkbenchIcon name="folder" size={16} /><span>项目文件夹 · {editingProject.path}</span></div>
            : <>
              <span className="ai-work-chat__project-source-empty">项目会在所选父目录下创建为独立文件夹。</span>
              <div className="ai-work-chat__project-path-entry"><Input aria-label="所选工作区分组" readOnly value={projectParentPath} placeholder="选择项目文件夹的父目录" /><Button type="default" icon={<WorkbenchIcon name="folder" size={15} />} disabled={saving} onClick={() => void chooseFolder("parent")}>选择工作区</Button></div>
              {projectParentPath ? <span className="ai-work-chat__project-folder-path" title={projectDirectoryPreview()}>{projectDirectoryPreview()}</span> : null}
            </>}
        </div>
        <label>其他源文件夹（可选）</label>
        <div className="ai-work-chat__project-source-box">
          {sourcePaths.map(path => <div className="ai-work-chat__project-source" key={path} title={path}>
            <WorkbenchIcon name="folder" size={16} /><span>{path}</span><button type="button" aria-label={`移除源文件夹 ${path}`} title="移除文件夹" disabled={saving} onClick={() => setSourcePaths(current => current.filter(source => source !== path))}><WorkbenchIcon name="close" size={14} /></button>
          </div>)}
          {!sourcePaths.length ? <span className="ai-work-chat__project-source-empty">项目文件夹会自动作为项目工作目录；也可以关联其他本机文件夹。</span> : null}
          <Button type="default" icon={<WorkbenchIcon name="folder" size={15} />} disabled={saving} onClick={() => void chooseFolder("source")}>在此电脑上添加文件夹</Button>
          {!isDesktopApp() ? <Button type="link" size="small" disabled={saving} onClick={() => { setPathEntryOpen(value => !value); setFolderPickerOpen(false); }}>输入文件夹路径</Button> : null}
          {folderPickerOpen ? <div className="ai-work-chat__project-folder-picker" aria-label="选择本机文件夹">
            <div className="ai-work-chat__project-folder-toolbar">
              <Select aria-label="本机磁盘" size="small" value={directoryRoots.find(root => directoryPath.toLocaleLowerCase().startsWith(root.toLocaleLowerCase())) ?? directoryRoots[0]} options={directoryRoots.map(root => ({ value: root, label: root }))} onChange={path => void browseDirectory(path)} />
              <Button size="small" disabled={!directoryPath || parentPath(directoryPath) === directoryPath || directoryLoading} onClick={() => void browseDirectory(parentPath(directoryPath))}>上一级</Button>
              <Button size="small" disabled={!directoryPath || directoryLoading} onClick={() => void selectDirectory(directoryPath, folderPickerPurpose)}>选择此文件夹</Button>
            </div>
            <span className="ai-work-chat__project-folder-path" title={directoryPath}>{directoryPath || "正在读取位置…"}</span>
            <div className="ai-work-chat__project-directories" role="group" aria-label="本机子文件夹">
              {directoryLoading ? <Spin size="small" /> : directoryEntries.map(entry => <button type="button" key={entry} aria-label={`打开文件夹 ${entry}`} onClick={() => {
                const separator = /^[A-Za-z]:/u.test(directoryPath) ? "\\" : "/";
                void browseDirectory(`${directoryPath.replace(/[\\/]+$/u, "")}${separator}${entry}`);
              }}><WorkbenchIcon name="folder" size={14} /><span>{entry}</span></button>)}
              {!directoryLoading && !directoryEntries.length ? <span className="ai-work-chat__project-source-empty">此文件夹中没有可显示的子文件夹</span> : null}
            </div>
            {directoryError ? <span className="ai-work-chat__project-error" role="alert">{directoryError}</span> : null}
          </div> : null}
          {pathEntryOpen ? <div className="ai-work-chat__project-path-entry"><Input aria-label="本机文件夹路径" placeholder="输入本机现有文件夹路径" value={sourcePathDraft} onChange={event => setSourcePathDraft(event.target.value)} onPressEnter={() => void addSourcePath(sourcePathDraft)} /><Button disabled={!sourcePathDraft.trim() || saving} loading={saving} onClick={() => void addSourcePath(sourcePathDraft)}>添加</Button></div> : null}
        </div>
        <label htmlFor="ai-work-project-instructions">项目指令</label>
        <Input.TextArea id="ai-work-project-instructions" maxLength={4000} autoSize={{ minRows: 3, maxRows: 6 }} placeholder="告诉小鱼在此项目中需要持续遵循的背景、目标或偏好" value={instructions} onChange={event => setInstructions(event.target.value)} />
        <label htmlFor="ai-work-project-memory">记忆范围</label>
        <Select id="ai-work-project-memory" value={memoryMode} onChange={value => setMemoryMode(value)} options={[
          { value: "default", label: "默认记忆" },
          { value: "project_only", label: "仅限项目的记忆" }
        ]} />
        <p className="ai-work-chat__project-memory-help">{memoryMode === "default"
          ? "此项目沿用账户记忆设置；项目中的聊天可使用账户记忆，账户记忆也可在其他聊天中使用。"
          : "此项目只读取和更新自己的记忆；不会读取或写入账户记忆，记忆不会提供给项目外的聊天。"}</p>
        <div className="ai-work-chat__project-info"><WorkbenchIcon name="spark" size={17} /><span>项目文件夹会在所选工作区分组下创建；其他源文件夹只建立关联，不会复制、移动或新建其中的文件。</span></div>
        {error ? <p className="ai-work-chat__project-error" role="alert">{error}</p> : null}
      </div>
    </Modal>
  </>;
}

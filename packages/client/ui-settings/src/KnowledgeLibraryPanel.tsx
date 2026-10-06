/** 功能：管理账户隔离的 Markdown 知识库与本地项目来源。作用：上传、编辑、删除并链接已登记项目；关联资料库 API、Daemon 项目文件 Owner。 */
import { useEffect, useState } from "react";
import { Alert, Button, Input, Modal, Popconfirm, Select, Space, Spin, Tag, message } from "antd";
import {
  createKnowledgeLibraryItem,
  createKnowledgeLibraryProjectSource,
  getErrorMessage,
  loadKnowledgeLibrary,
  loadKnowledgeLibraryItem,
  loadWorkspaceProjects,
  removeKnowledgeLibraryItem,
  removeKnowledgeLibraryProjectSource,
  updateKnowledgeLibraryItem,
  type ApplicationId,
  type KnowledgeLibraryItemSummary,
  type KnowledgeLibraryKind,
  type KnowledgeLibraryProjectSource,
  type KnowledgeLibraryScope,
  type WorkspaceProject,
  type WorkspaceProjectApplicationId
} from "lfaa-client-connection/src/api.js";
import { SettingGroup } from "lfaa-client-ui-primitives/src/settings-controls.js";
import "./KnowledgeLibraryPanel.css";

const scopeOptions: Array<{ value: KnowledgeLibraryScope; label: string }> = [
  { value: "workspace", label: "通用工作区" },
  { value: "minecraft", label: "Minecraft" },
  { value: "steamcmd", label: "SteamCMD 开服" },
  { value: "writing", label: "写作工作区" },
  { value: "all", label: "所有 App（共享）" }
];
const kindOptions: Array<{ value: KnowledgeLibraryKind; label: string }> = [
  { value: "knowledge", label: "知识" },
  { value: "skill", label: "Skill 方法" },
  { value: "prompt", label: "提示词" },
  { value: "expert", label: "领域专家方法" }
];
const projectAppOptions = [
  { value: "workspace", label: "通用工作区" },
  { value: "minecraft", label: "Minecraft" }
] as const;
const itemLimit = 128;

interface Draft {
  id: string | null;
  applicationId: ApplicationId | "all";
  kind: KnowledgeLibraryKind;
  title: string;
  description: string;
  contentMarkdown: string;
  expectedContentSha256: string | null;
  sourceKind: "manual" | "upload";
}

function emptyDraft(applicationId: KnowledgeLibraryScope): Draft {
  return { id: null, applicationId, kind: "knowledge", title: "", description: "", contentMarkdown: "", expectedContentSha256: null, sourceKind: "manual" };
}

export function KnowledgeLibraryPanel({ extensionsEnabled }: { extensionsEnabled: boolean }) {
  const [messageApi, messageContext] = message.useMessage();
  const [scope, setScope] = useState<KnowledgeLibraryScope>("workspace");
  const [items, setItems] = useState<KnowledgeLibraryItemSummary[]>([]);
  const [sources, setSources] = useState<KnowledgeLibraryProjectSource[]>([]);
  const [usage, setUsage] = useState({ resources: 0, limit: itemLimit });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [projectApp, setProjectApp] = useState<WorkspaceProjectApplicationId>("workspace");
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const [relativePath, setRelativePath] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [projectsLoading, setProjectsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setItems([]);
    setSources([]);
    void loadKnowledgeLibrary(scope === "all" ? undefined : scope).then(result => {
      if (!active) return;
      setItems(result.items);
      setSources(result.sources);
      setUsage(result.usage);
    }).catch(loadError => {
      if (active) setError(getErrorMessage(loadError));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope]);

  useEffect(() => {
    if (!linkOpen) return;
    let active = true;
    setProjectsLoading(true);
    void loadWorkspaceProjects({ appId: projectApp }).then(result => {
      if (!active) return;
      const available = result.projects.filter(project => project.appId === null || project.appId === projectApp);
      setProjects(available);
      setProjectId(current => available.some(project => project.id === current) ? current : available[0]?.id ?? "");
    }).catch(loadError => { if (active) setError(getErrorMessage(loadError)); })
      .finally(() => { if (active) setProjectsLoading(false); });
    return () => { active = false; };
  }, [linkOpen, projectApp]);

  const selectedProject = projects.find(project => project.id === projectId) ?? null;
  const draftBytes = draft ? new TextEncoder().encode(draft.contentMarkdown).byteLength : 0;

  async function refresh(): Promise<void> {
    const result = await loadKnowledgeLibrary(scope === "all" ? undefined : scope);
    setItems(result.items);
    setSources(result.sources);
    setUsage(result.usage);
  }

  function showError(loadError: unknown): void {
    setError(getErrorMessage(loadError));
  }

  async function openEditor(item?: KnowledgeLibraryItemSummary): Promise<void> {
    if (!item) { setDraft(emptyDraft(scope)); return; }
    const readScope = scope === "all" ? item.applicationId === "all" ? "workspace" : item.applicationId : scope;
    setBusy(`edit:${item.id}`);
    setError("");
    try {
      const result = await loadKnowledgeLibraryItem(item.id, readScope);
      setDraft({ id: result.item.id, applicationId: result.item.applicationId, kind: result.item.kind, title: result.item.title, description: result.item.description, contentMarkdown: result.item.contentMarkdown, expectedContentSha256: result.item.contentSha256, sourceKind: "manual" });
    } catch (loadError) { showError(loadError); }
    finally { setBusy(null); }
  }

  async function saveDraft(): Promise<void> {
    if (!draft) return;
    setBusy("save");
    setError("");
    try {
      if (draft.id) {
        const updateScope = draft.applicationId === "all" ? "workspace" : draft.applicationId;
        await updateKnowledgeLibraryItem(draft.id, { applicationId: updateScope, title: draft.title, description: draft.description, contentMarkdown: draft.contentMarkdown, expectedContentSha256: draft.expectedContentSha256 ?? "" });
      } else {
        await createKnowledgeLibraryItem({ applicationId: draft.applicationId, kind: draft.kind, title: draft.title, description: draft.description, contentMarkdown: draft.contentMarkdown, sourceKind: draft.sourceKind });
      }
      setDraft(null);
      void messageApi.success(draft.id ? "资料已更新" : "资料已保存");
      try { await refresh(); } catch (refreshError) { showError(refreshError); }
    } catch (saveError) { showError(saveError); }
    finally { setBusy(null); }
  }

  async function uploadMarkdown(file: File): Promise<void> {
    const extension = file.name.toLocaleLowerCase("en-US");
    if (!/\.(?:md|markdown)$/u.test(extension)) { setError("只支持 .md 或 .markdown 文件。"); return; }
    if (file.size > 64 * 1024) { setError("Markdown 文件不能超过 64 KiB。"); return; }
    setBusy("upload");
    setError("");
    try {
      const contentMarkdown = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      await createKnowledgeLibraryItem({ applicationId: scope, kind: "knowledge", title: file.name.replace(/\.(?:md|markdown)$/iu, ""), description: "", contentMarkdown, sourceKind: "upload" });
      void messageApi.success("Markdown 已加入资料库");
      try { await refresh(); } catch (refreshError) { showError(refreshError); }
    } catch (uploadError) { showError(uploadError); }
    finally { setBusy(null); }
  }

  async function deleteItem(item: KnowledgeLibraryItemSummary): Promise<void> {
    setBusy(`delete:${item.id}`);
    setError("");
    try { await removeKnowledgeLibraryItem(item.id); await refresh(); }
    catch (deleteError) { showError(deleteError); }
    finally { setBusy(null); }
  }

  async function addProjectSource(): Promise<void> {
    if (!selectedProject) { setError("请选择一个当前账户已登记的项目。"); return; }
    setBusy("source");
    setError("");
    try {
      await createKnowledgeLibraryProjectSource({ applicationId: projectApp, projectApplicationId: projectApp, projectId: selectedProject.id, relativePath, title: sourceTitle.trim() || selectedProject.title });
      setLinkOpen(false);
      setRelativePath("");
      setSourceTitle("");
      try { await refresh(); } catch (refreshError) { showError(refreshError); }
    } catch (sourceError) { showError(sourceError); }
    finally { setBusy(null); }
  }

  async function deleteSource(source: KnowledgeLibraryProjectSource): Promise<void> {
    setBusy(`source:${source.id}`);
    setError("");
    try { await removeKnowledgeLibraryProjectSource(source.id); await refresh(); }
    catch (removeError) { showError(removeError); }
    finally { setBusy(null); }
  }

  return <>
    {messageContext}
    <SettingGroup title="Markdown 知识库">
      <div className="knowledge-library">
        <p className="knowledge-library__intro">按需检索知识、Skills、提示词和领域专家方法。正文不会自动塞入每轮模型上下文；对话整理出的内容只有在你明确要求保存时才会写入。所有内容均作为不可信资料提供给模型。</p>
        {!extensionsEnabled ? <Alert type="warning" showIcon message="AI 扩展总开关已关闭，模型暂时不会获得资料库工具；此处仍可管理资料。" /> : null}
        <Alert type="info" showIcon message="GitHub 与网页资料通过当前 App 已配置且可用的 MCP 搜索工具查询；连接与权限仍由现有 MCP Owner 控制。" />
        {error ? <Alert type="error" showIcon message={error} /> : null}
        <div className="knowledge-library__toolbar">
          <label className="knowledge-library__field"><span>资料范围</span><Select aria-label="知识库资料范围" value={scope} options={scopeOptions} disabled={busy !== null} onChange={(value: KnowledgeLibraryScope) => setScope(value)} /></label>
          <Space wrap>
            <Button onClick={() => void openEditor()} disabled={busy !== null || usage.resources >= usage.limit}>新建 Markdown</Button>
            <label className="knowledge-library__upload">
              <input aria-label="上传 Markdown 文件" type="file" accept=".md,.markdown,text/markdown" disabled={busy !== null || usage.resources >= usage.limit} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadMarkdown(file); }} />
              <span>{busy === "upload" ? "上传中…" : "上传 .md"}</span>
            </label>
            <Button onClick={() => setLinkOpen(value => !value)} disabled={busy !== null}>{linkOpen ? "收起本地目录" : "链接本地目录"}</Button>
          </Space>
        </div>
        <p className="knowledge-library__limit">账户容量：{usage.resources} / {usage.limit} 条资源；单条 Markdown 最大 64 KiB。共享范围只影响资料文本，本地项目来源始终限定所属 App。</p>
        {linkOpen ? <div className="knowledge-library__source-form">
          <strong>链接账户已登记的本地项目</strong>
          <p>只保存项目引用与相对目录，不复制文件；搜索和读取由在线 Daemon 执行，并遵循项目文件权限模式。</p>
          <div className="knowledge-library__source-fields">
            <label className="knowledge-library__field"><span>项目 App</span><Select aria-label="本地资料所属 App" value={projectApp} options={[...projectAppOptions]} onChange={(value: WorkspaceProjectApplicationId) => { setProjectApp(value); setProjectId(""); }} /></label>
            <label className="knowledge-library__field"><span>已登记项目</span><Select aria-label="选择本地知识库项目" loading={projectsLoading} value={projectId || undefined} options={projects.map(project => ({ value: project.id, label: project.title }))} onChange={setProjectId} placeholder="选择项目" /></label>
            <label className="knowledge-library__field"><span>项目内相对目录</span><Input aria-label="项目内相对目录" value={relativePath} maxLength={512} placeholder="留空表示项目根目录" onChange={event => setRelativePath(event.target.value)} /></label>
            <label className="knowledge-library__field"><span>来源名称</span><Input aria-label="本地资料来源名称" value={sourceTitle} maxLength={120} placeholder={selectedProject?.title ?? "例如：产品文档"} onChange={event => setSourceTitle(event.target.value)} /></label>
          </div>
          <Button type="primary" onClick={() => void addProjectSource()} loading={busy === "source"} disabled={!selectedProject || projectsLoading || usage.resources >= usage.limit}>链接目录</Button>
        </div> : null}
        <div className="knowledge-library__list" aria-live="polite">
          {loading ? <div className="knowledge-library__empty"><Spin size="small" /> 正在读取资料库…</div> : items.length === 0 && sources.length === 0 ? <div className="knowledge-library__empty">此范围还没有 Markdown 资料或本地目录。</div> : null}
          {items.map(item => <article className="knowledge-library__entry" key={item.id}>
            <div className="knowledge-library__entry-copy">
              <div className="knowledge-library__entry-title"><strong>{item.title}</strong><Tag>{kindOptions.find(option => option.value === item.kind)?.label ?? item.kind}</Tag><Tag>{item.applicationId === "all" ? "所有 App" : scopeOptions.find(option => option.value === item.applicationId)?.label ?? item.applicationId}</Tag></div>
              <p>{item.description || "无补充说明"}</p>
              <small>{item.sourceKind === "upload" ? "上传" : item.sourceKind === "conversation" ? "对话整理" : "手工创建"} · 更新于 {new Date(item.updatedAt).toLocaleString("zh-CN")}</small>
            </div>
            <Space wrap>
              <Button size="small" loading={busy === `edit:${item.id}`} disabled={busy !== null} onClick={() => void openEditor(item)}>编辑</Button>
              <Popconfirm title={`删除“${item.title}”？`} description="此 Markdown 资料会从当前账户资料库中删除。" okText="删除" cancelText="取消" onConfirm={() => void deleteItem(item)}>
                <Button size="small" danger loading={busy === `delete:${item.id}`} disabled={busy !== null}>删除</Button>
              </Popconfirm>
            </Space>
          </article>)}
          {sources.map(source => <article className="knowledge-library__entry" key={source.id}>
            <div className="knowledge-library__entry-copy">
              <div className="knowledge-library__entry-title"><strong>{source.title}</strong><Tag>本地 Markdown</Tag><Tag>{projectAppOptions.find(option => option.value === source.projectApplicationId)?.label}</Tag></div>
              <p>{source.relativePath || "项目根目录"} · 搜索时由在线节点读取，不保存缓存副本。</p>
            </div>
            <Popconfirm title={`解除“${source.title}”的目录链接？`} okText="解除链接" cancelText="取消" onConfirm={() => void deleteSource(source)}>
              <Button size="small" danger loading={busy === `source:${source.id}`} disabled={busy !== null}>解除链接</Button>
            </Popconfirm>
          </article>)}
        </div>
      </div>
    </SettingGroup>
    <Modal title={draft?.id ? "编辑 Markdown 资料" : "新建 Markdown 资料"} open={draft !== null} onCancel={() => { if (busy !== "save") setDraft(null); }} onOk={() => void saveDraft()} okText="保存" cancelText="取消" confirmLoading={busy === "save"} okButtonProps={{ disabled: !draft?.title.trim() || !draft?.contentMarkdown.trim() || draftBytes > 64 * 1024 }} destroyOnClose>
      {draft ? <div className="knowledge-library__editor">
        {!draft.id ? <label className="knowledge-library__field"><span>保存到</span><Select aria-label="新资料可用范围" value={draft.applicationId} options={scopeOptions} onChange={(value: KnowledgeLibraryScope) => setDraft(current => current ? { ...current, applicationId: value } : current)} /></label> : <p>可用范围：{draft.applicationId === "all" ? "所有 App" : scopeOptions.find(option => option.value === draft.applicationId)?.label}</p>}
        {!draft.id ? <label className="knowledge-library__field"><span>资料类型</span><Select aria-label="Markdown 资料类型" value={draft.kind} options={kindOptions} onChange={(value: KnowledgeLibraryKind) => setDraft(current => current ? { ...current, kind: value } : current)} /></label> : null}
        <label className="knowledge-library__field"><span>标题</span><Input aria-label="Markdown 资料标题" value={draft.title} maxLength={120} onChange={event => setDraft(current => current ? { ...current, title: event.target.value } : current)} /></label>
        <label className="knowledge-library__field"><span>说明</span><Input aria-label="Markdown 资料说明" value={draft.description} maxLength={500} onChange={event => setDraft(current => current ? { ...current, description: event.target.value } : current)} /></label>
        <label className="knowledge-library__field"><span>Markdown 正文（最大 64 KiB UTF-8）</span><Input.TextArea aria-label="Markdown 资料正文" value={draft.contentMarkdown} rows={14} maxLength={64 * 1024} onChange={event => setDraft(current => current ? { ...current, contentMarkdown: event.target.value } : current)} /></label>
        <small>{draftBytes.toLocaleString("zh-CN")} / 65,536 字节</small>
      </div> : null}
    </Modal>
  </>;
}

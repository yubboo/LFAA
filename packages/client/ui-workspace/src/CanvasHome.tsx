/**
 * 功能：系统级画布首页（/canvas，即梦式沉浸入口）。
 * 作用：欢迎语“你好，今天想要创作什么？”、生成|画布分段切换、真实跨 App 项目列表（带 App 标签）、搜索、App 快捷卡片、
 *      导入入口与空态/错误态；生成模式创建项目并写入 generation 节点后进入工作区，画布模式直接创建空白画布。
 *      不显示假项目、假生成结果，也不在首页伪造 @ 素材（新建项目还没有项目素材）。
 * 关联文件：CanvasWorkspace.tsx、CanvasProjectTransfer.ts、ui-layout/src/Workbench.tsx、canvas-home.css。
 */
import { ArrowLeftOutlined, AppstoreOutlined, EditOutlined, FolderOpenOutlined, PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Alert, Button, Input, Segmented, Select, Spin, Typography } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  createCanvasProject, getErrorMessage, loadCanvasProjects, saveCanvasProject,
  type ApplicationId, type CanvasNode, type CanvasProjectSummary, type User, type UserSettings
} from "lfaa-client-connection/src/api.js";
import type { ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import type { ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import {
  CANVAS_ASPECT_RATIO_OPTIONS, CANVAS_LIMITS, MAX_IMPORT_FILE_BYTES,
  buildCanvasProjectPayload, formatCanvasBytes, importCanvasProject, parseCanvasImport, resolveCanvasSettings,
  type CanvasAspectRatio, type CanvasGenerationData
} from "./CanvasProjectTransfer.js";
import "./canvas-home.css";

type HomeMode = "generate" | "canvas";

export interface CanvasHomeProps {
  user: User;
  settings: UserSettings;
  serverState: ServiceState;
  applications: ApplicationNavigationItem[];
  navigationApplications: ApplicationNavigationItem[];
  onNavigate: (path: string) => void;
  onOpenApplication: (app: ApplicationId, mode: "normal") => Promise<void>;
  onOpenApplications?: () => void;
  onOpenRecentSessions: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

function errorText(error: unknown, fallback: string): string {
  const message = getErrorMessage(error);
  return !message || message === "发生了未知错误，请重试。" ? fallback : message;
}

/** 用提示词生成项目标题：取首行前 40 个字符；不写死假标题。 */
function titleFromPrompt(prompt: string): string {
  const firstLine = prompt.trim().split("\n")[0] ?? "";
  const title = firstLine.slice(0, 40).trim();
  return title || "未命名画布";
}

function canvasPath(summary: Pick<CanvasProjectSummary, "applicationId" | "id">): string {
  return "/apps/" + encodeURIComponent(summary.applicationId) + "/canvas/" + encodeURIComponent(summary.id);
}

export function CanvasHome({ user, settings, applications, onNavigate, onOpenSettings }: CanvasHomeProps) {
  const canvasSettings = resolveCanvasSettings(settings);
  const [mode, setMode] = useState<HomeMode>(() => canvasSettings.defaultMode === "canvas" ? "canvas" : "generate");
  const [projects, setProjects] = useState<CanvasProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generationKind, setGenerationKind] = useState<"image" | "video">("image");
  const [aspectRatio, setAspectRatio] = useState<CanvasAspectRatio>("1:1");
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [targetApp, setTargetApp] = useState<ApplicationId>("workspace");
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const { projects: loaded } = await loadCanvasProjects();
        if (active) setProjects(loaded);
      } catch (loadError) {
        if (active) setError(errorText(loadError, "无法加载画布项目列表。"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const applicationTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of applications) {
      if (item.applicationId) map.set(item.applicationId, item.title);
      else map.set(item.id, item.title);
    }
    return map;
  }, [applications]);

  const appOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: ApplicationId; label: string }> = [];
    for (const item of applications) {
      const id = item.applicationId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      options.push({ value: id, label: item.title });
    }
    if (options.length === 0) options.push({ value: "workspace", label: "小鱼智能体" });
    return options;
  }, [applications]);

  const filteredProjects = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter(project => {
      const appTitle = applicationTitles.get(project.applicationId) ?? project.applicationId;
      return project.title.toLowerCase().includes(keyword) || appTitle.toLowerCase().includes(keyword);
    });
  }, [applicationTitles, projects, search]);

  const filteredApps = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return appOptions;
    return appOptions.filter(app => app.label.toLowerCase().includes(keyword) || app.value.toLowerCase().includes(keyword));
  }, [appOptions, search]);

  const enterProject = useCallback((summary: Pick<CanvasProjectSummary, "applicationId" | "id">) => {
    onNavigate(canvasPath(summary));
  }, [onNavigate]);

  const createBlankCanvas = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const created = (await createCanvasProject(targetApp, "未命名画布")).project;
      if (!mountedRef.current) return;
      onNavigate(canvasPath(created));
    } catch (createError) {
      if (mountedRef.current) setError(errorText(createError, "创建空白画布失败。"));
    } finally {
      if (mountedRef.current) setCreating(false);
    }
  }, [creating, onNavigate, targetApp]);

  const createGenerateProject = useCallback(async () => {
    if (creating) return;
    const promptText = prompt.trim();
    if (!promptText) {
      setError("请先输入要生成的提示词。");
      return;
    }
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const created = (await createCanvasProject(targetApp, titleFromPrompt(promptText))).project;
      if (!mountedRef.current) return;
      const generation: CanvasGenerationData = {
        kind: generationKind,
        prompt: promptText.slice(0, CANVAS_LIMITS.textLength),
        status: "idle",
        aspectRatio,
        ...(generationKind === "video" ? { durationSeconds } : {})
      };
      const node: CanvasNode = {
        id: crypto.randomUUID(),
        type: "generation",
        x: 0,
        y: 0,
        width: 340,
        height: 300,
        data: { generation }
      };
      const payload = buildCanvasProjectPayload({
        project: created,
        title: created.title,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [node],
        edges: []
      });
      const saved = (await saveCanvasProject(targetApp, created.id, created.updatedAt, payload)).project;
      if (!mountedRef.current) return;
      onNavigate(canvasPath(saved));
    } catch (createError) {
      if (mountedRef.current) setError(errorText(createError, "创建生成项目失败。"));
    } finally {
      if (mountedRef.current) setCreating(false);
    }
  }, [aspectRatio, creating, durationSeconds, generationKind, onNavigate, prompt, targetApp]);

  const importFile = useCallback(async (file: File) => {
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setError("导入文件超过 " + formatCanvasBytes(MAX_IMPORT_FILE_BYTES) + " 上限。");
      return;
    }
    setCreating(true);
    setError("");
    setNotice("正在导入画布…");
    try {
      const bundle = parseCanvasImport(await file.text());
      const imported = await importCanvasProject(targetApp, bundle, message => {
        if (mountedRef.current) setNotice(message);
      });
      if (!mountedRef.current) return;
      // 导入成功后直接进入工作区；首页挂载时会重新拉取项目列表，列表刷新失败不影响已导入的项目。
      setNotice("已导入画布「" + imported.title + "」。");
      onNavigate(canvasPath(imported));
    } catch (importError) {
      if (mountedRef.current) setError("导入失败：" + errorText(importError, "无法读取导入文件。"));
    } finally {
      if (mountedRef.current) setCreating(false);
    }
  }, [onNavigate, targetApp]);

  const handleImportInput = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void importFile(file);
  }, [importFile]);

  return (
    <div className="lfaa-cnv-home">
      <header className="lfaa-cnv-home__topbar">
        <div className="lfaa-cnv-home__brand">
          <span className="lfaa-cnv-home__brand-mark" aria-hidden="true">L</span>
          <span>LFAA 画布</span>
        </div>
        <Input.Search
          className="lfaa-cnv-home__search"
          allowClear
          placeholder="搜索画布、项目或 App"
          value={search}
          onChange={event => setSearch(event.target.value)}
          aria-label="搜索画布项目或 App"
        />
        <div className="lfaa-cnv-home__topbar-actions">
          <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => onNavigate("/work")}>返回工作台</Button>
          <Button size="small" icon={<SettingOutlined />} onClick={onOpenSettings}>设置中心</Button>
        </div>
      </header>

      <main className="lfaa-cnv-home__scroll">
        {error ? <Alert className="lfaa-cnv-home__alert" type="error" showIcon closable message={error} onClose={() => setError("")} action={<Button size="small" onClick={onOpenSettings}>设置中心</Button>} /> : null}
        {notice ? <Alert className="lfaa-cnv-home__alert" type="info" showIcon message={notice} /> : null}

        <div className="lfaa-cnv-home__layout">
          <section className="lfaa-cnv-home__hero" aria-label="画布入口">
            <div className="lfaa-cnv-home__hero-copy">
              <p className="lfaa-cnv-home__eyebrow">LFAA 无限画布</p>
              <Typography.Title level={1} className="lfaa-cnv-home__welcome">欢迎回来</Typography.Title>
              <p className="lfaa-cnv-home__subtitle">释放灵感，创造无限可能。把提示词、素材与 App 项目放进同一张画布。</p>
            </div>

            <div className="lfaa-cnv-home__hero-actions">
              <Button type="primary" size="large" icon={<PlusOutlined />} data-testid="canvas-home-create-blank" loading={creating} onClick={() => void createBlankCanvas()}>新建画布</Button>
              <Button size="large" icon={<FolderOpenOutlined />} disabled={creating} onClick={() => importInputRef.current?.click()} title="导入 LFAA 画布 JSON 文件">打开文件</Button>
              <Button
                type="text"
                icon={<EditOutlined />}
                aria-expanded={creatorOpen}
                aria-controls={creatorOpen ? "lfaa-cnv-home-creator" : undefined}
                onClick={() => {
                  if (!creatorOpen) setMode(canvasSettings.defaultMode === "canvas" ? "canvas" : "generate");
                  setCreatorOpen(open => !open);
                }}
              >
                {creatorOpen ? "收起创作面板" : "通过提示词创作"}
              </Button>
            </div>

            {creatorOpen ? <div id="lfaa-cnv-home-creator" className="lfaa-cnv-home__creator">
              <div className="lfaa-cnv-home__creator-head">
                <div>
                  <strong>开始创作</strong>
                  <span>{mode === "generate" ? "描述画面，创建生成项目" : "创建空白画布，进入工作区"}</span>
                </div>
                <Segmented
                  className="lfaa-cnv-home__mode"
                  size="small"
                  value={mode}
                  onChange={value => setMode(value as HomeMode)}
                  options={[
                    { value: "generate", label: <span data-testid="canvas-home-generate-tab">生成</span> },
                    { value: "canvas", label: <span data-testid="canvas-home-canvas-tab">画布</span> }
                  ]}
                />
                <Button type="text" size="small" aria-label="收起提示词创作面板" onClick={() => setCreatorOpen(false)}>收起</Button>
              </div>
              {mode === "generate" ? (
                <div className="lfaa-cnv-home__composer">
                  <div className="lfaa-cnv-home__composer-row">
                    <Segmented
                      size="small"
                      value={generationKind}
                      onChange={value => setGenerationKind(value as "image" | "video")}
                      options={[{ value: "image", label: "图片" }, { value: "video", label: "视频" }]}
                    />
                    <Select
                      size="small"
                      className="lfaa-cnv-home__aspect"
                      aria-label="生成比例"
                      value={aspectRatio}
                      options={CANVAS_ASPECT_RATIO_OPTIONS.map(option => ({ value: option.value, label: option.label, title: option.note }))}
                      onChange={(value: CanvasAspectRatio) => setAspectRatio(value)}
                    />
                    {generationKind === "video" ? (
                      <Select
                        size="small"
                        aria-label="视频时长"
                        value={durationSeconds}
                        options={[5, 10].map(seconds => ({ value: seconds, label: seconds + " 秒" }))}
                        onChange={(value: number) => setDurationSeconds(value)}
                      />
                    ) : null}
                  </div>
                  <Input.TextArea
                    className="lfaa-cnv-home__prompt"
                    aria-label="生成提示词"
                    data-testid="canvas-home-prompt"
                    placeholder="描述你想生成的画面或视频"
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    maxLength={CANVAS_LIMITS.textLength}
                    value={prompt}
                    onChange={event => {
                      const value = event.target.value;
                      setPrompt(value);
                      const cursor = event.target.selectionStart ?? value.length;
                      setMentionOpen(/@([^\s@]*)$/u.test(value.slice(0, cursor)));
                    }}
                  />
                  {mentionOpen ? (
                    <p className="lfaa-cnv-home__mention-note" role="status">
                      新建画布还没有素材可以引用。创建项目后，在画布工作区输入 @ 可选择项目素材作为参考图。
                    </p>
                  ) : null}
                  {aspectRatio === "2:1" ? <p className="lfaa-cnv-home__mention-note">2:1 表示“全景比例图像”，不是球面全景渲染。</p> : null}
                  <div className="lfaa-cnv-home__composer-actions">
                    <label className="lfaa-cnv-home__target">
                      <span>创建到</span>
                      <Select size="small" className="lfaa-cnv-home__target-select" aria-label="选择目标 App" value={targetApp} options={appOptions} onChange={(value: ApplicationId) => setTargetApp(value)} />
                    </label>
                    <Button type="primary" data-testid="canvas-home-create" loading={creating} onClick={() => void createGenerateProject()}>创建项目并生成</Button>
                  </div>
                </div>
              ) : (
                <div className="lfaa-cnv-home__canvas-actions">
                  <label className="lfaa-cnv-home__target">
                    <span>创建到</span>
                    <Select size="small" className="lfaa-cnv-home__target-select" aria-label="选择目标 App" value={targetApp} options={appOptions} onChange={(value: ApplicationId) => setTargetApp(value)} />
                  </label>
                  <p>新建画布将归属于所选 App，并显示在右侧最近项目中。</p>
                </div>
              )}
            </div> : null}

            <input ref={importInputRef} className="lfaa-cnv-home__hidden-input" type="file" accept=".json,application/json" aria-label="选择要导入的画布 JSON 文件" onChange={handleImportInput} />
          </section>

          <aside className="lfaa-cnv-home__sidebar" aria-label="画布项目与 App">
            <section className="lfaa-cnv-home__panel lfaa-cnv-home__projects" aria-label="最近画布项目">
              <div className="lfaa-cnv-home__panel-head">
                <div>
                  <h2>最近项目</h2>
                  <span>{loading ? "正在同步" : filteredProjects.length + " 个项目"}</span>
                </div>
              </div>
              {loading ? (
                <div className="lfaa-cnv-home__loading"><Spin /><span>正在读取当前账户的画布项目…</span></div>
              ) : filteredProjects.length === 0 ? (
                <div className="lfaa-cnv-home__empty">
                  <p>{projects.length === 0 ? "当前账户还没有画布项目。" : "没有匹配的项目。"}</p>
                  {projects.length === 0 ? <p>创建新画布后会显示在这里。</p> : null}
                </div>
              ) : (
                <div className="lfaa-cnv-home__project-grid">
                  {filteredProjects.map(project => (
                    <button
                      key={project.applicationId + ":" + project.id}
                      type="button"
                      className="lfaa-cnv-home__project-card"
                      data-testid="canvas-home-project-card"
                      onClick={() => enterProject(project)}
                    >
                      <span className="lfaa-cnv-home__project-app">{applicationTitles.get(project.applicationId) ?? project.applicationId}</span>
                      <span className="lfaa-cnv-home__project-title" title={project.title}>{project.title}</span>
                      <span className="lfaa-cnv-home__project-meta">{project.nodeCount} 节点 · {project.assetCount} 素材</span>
                      <span className="lfaa-cnv-home__project-time">{new Date(project.updatedAt).toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="lfaa-cnv-home__panel lfaa-cnv-home__apps" aria-label="App 画布入口">
              <div className="lfaa-cnv-home__panel-head">
                <div>
                  <h2>App 画布</h2>
                  <span>{filteredApps.length} 个可用入口</span>
                </div>
              </div>
              {filteredApps.length > 0 ? (
                <div className="lfaa-cnv-home__app-grid">
                  {filteredApps.map(app => (
                    <button key={app.value} type="button" className="lfaa-cnv-home__app-card" onClick={() => onNavigate("/apps/" + encodeURIComponent(app.value) + "/canvas")}>
                      <AppstoreOutlined className="lfaa-cnv-home__app-mark" aria-hidden="true" />
                      <span className="lfaa-cnv-home__app-name">{app.label}</span>
                      <small>打开画布</small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="lfaa-cnv-home__empty"><p>没有匹配的 App。</p></div>
              )}
            </section>
          </aside>
        </div>

        <footer className="lfaa-cnv-home__footer">
          当前账户：{user.username} · 画布项目与素材按账户和 App 隔离；生成能力使用设置中心中已配置的图片/视频生成账户。
        </footer>
      </main>
    </div>
  );
}

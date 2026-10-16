/** 功能：呈现 LFAA Profile 插件管理页。作用：直接调用同一 Owner 安装、启停与卸载，显式操作复用 Permission Owner。 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, Select, Spin, Tag, Typography } from "antd";
import { getErrorMessage, hasAdminAccess, inspectManagedPlugin, installManagedPlugin, removeManagedPlugin, loadManagedPlugins, setManagedPluginEnabled, type ManagedPluginInspection, type ManagedPluginRecord, type User, type UserSettings } from "lfaa-client-connection/src/api.js";
import { GlobalNavigationRail, type ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { SettingsPage } from "lfaa-client-ui-settings/src/SettingsPage.js";
import type { ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";
import { type PluginAction } from "./plugin-goals.js";
import "./PluginManagerPage.css";

export interface PluginManagerPageProps {
  user: User;
  settings: UserSettings;
  resolvedTheme: "light" | "dark";
  serverState: ServiceState;
  applications: ApplicationNavigationItem[];
  onNavigate: (path: string) => void;
  onOpenApplication: (app: ApplicationId, mode: "normal") => Promise<void>;
  onOpenSettings: () => void;
  onLogout: () => void;
  onUserChange: (user: User) => void;
  onSettingsChange: (settings: UserSettings) => void;
}

type PluginSourceType = ManagedPluginInspection["sourceType"];

const permissionModeLabels: Record<UserSettings["permissions"]["mode"], string> = {
  ask: "按请求审批模式处理",
  approve_remembered: "按自动审批记忆与现有审批链处理",
  full_access: "按完全访问模式处理"
};

const applicationLabels: Record<ApplicationId, string> = {
  workspace: "通用工作台",
  steamcmd: "SteamCMD",
  minecraft: "Minecraft",
  connectivity: "联机服务",
  writing: "写作",
  aivideo: "AI 漫剧"
};

function pluginStateLabel(state: ManagedPluginRecord["state"]): string {
  return state === "enabled" ? "已启用" : state === "installed" ? "已安装，未启用" : "已安装，当前不兼容";
}

function pluginSourceLabel(plugin: ManagedPluginRecord): string {
  const kind = plugin.source.kind ?? (plugin.source.repository.startsWith("https://github.com/") ? "github" : plugin.source.repository.startsWith("npm:") ? "npm" : undefined);
  return kind === "github" ? "GitHub" : kind === "npm" ? "NPM" : kind === "local" ? "Host 本机" : "来源未登记";
}

function pluginCompatibilityLabel(value: ManagedPluginRecord["compatibility"]): string {
  return value === "lfaa-v1" ? "LFAA Runtime" : value === "dsh-v1" ? "DSH Bundle" : "未知合同";
}

function PluginCard({ plugin, targetApplicationId, canAdmin, pendingAction, onTargetApplicationChange, onAction }: {
  plugin: ManagedPluginRecord;
  targetApplicationId: ApplicationId;
  canAdmin: boolean;
  pendingAction: "enable" | "disable" | "remove" | null;
  onTargetApplicationChange: (app: ApplicationId) => void;
  onAction: (plugin: ManagedPluginRecord, action: PluginAction, app: ApplicationId) => void;
}) {
  const applicationOptions = plugin.applicationIds.map(id => ({ value: id, label: applicationLabels[id] ?? id }));
  return (
    <article className="plugin-manager-page__plugin-card" aria-label={`${plugin.name} 插件`}>
      <div className="plugin-manager-page__plugin-heading">
        <span className="plugin-manager-page__plugin-icon"><WorkbenchIcon name="extension" size={18} /></span>
        <div className="plugin-manager-page__plugin-title">
          <h4>{plugin.name}</h4>
          <span>v{plugin.version} · {pluginStateLabel(plugin.state)}</span>
        </div>
        <Tag color={plugin.state === "enabled" ? "green" : plugin.state === "incompatible" ? "orange" : undefined}>{pluginCompatibilityLabel(plugin.compatibility)}</Tag>
      </div>
      <p className="plugin-manager-page__plugin-description">{plugin.description || "此插件未提供说明。"}</p>
      <dl className="plugin-manager-page__plugin-meta">
        <div><dt>来源</dt><dd>{pluginSourceLabel(plugin)} · {plugin.source.repository}</dd></div>
        <div><dt>固定内容</dt><dd title={plugin.source.commit}>{plugin.source.commit.slice(0, 16)} · SHA-256 {plugin.source.archiveSha256.slice(0, 12)}</dd></div>
        <div><dt>许可证</dt><dd>{plugin.source.license ?? "未确认"}</dd></div>
        {applicationOptions.length > 1 ? <div><dt>适用应用</dt><dd>{applicationOptions.map(option => option.label).join("、")}</dd></div> : null}
      </dl>
      {plugin.reason ? <Alert type="warning" showIcon message={plugin.reason} /> : null}
      {applicationOptions.length > 1 ? <Select
        aria-label={`${plugin.name} 生命周期操作目标 App`}
        value={targetApplicationId}
        options={applicationOptions}
        disabled={!canAdmin}
        onChange={onTargetApplicationChange}
      /> : null}
      <div className="plugin-manager-page__plugin-actions">
        {plugin.state === "installed" ? <Button type="primary" disabled={!canAdmin || pendingAction !== null} loading={pendingAction === "enable"} onClick={() => onAction(plugin, "enable", targetApplicationId)}>启用</Button> : null}
        {plugin.state === "enabled" ? <Button disabled={!canAdmin || pendingAction !== null} loading={pendingAction === "disable"} onClick={() => onAction(plugin, "disable", targetApplicationId)}>停用</Button> : null}
        <Button danger disabled={!canAdmin || pendingAction !== null} loading={pendingAction === "remove"} onClick={() => onAction(plugin, "remove", targetApplicationId)}>卸载</Button>
      </div>
    </article>
  );
}

export function PluginManagerPage({ user, settings, resolvedTheme, serverState, applications, onNavigate, onOpenApplication, onOpenSettings, onLogout, onUserChange, onSettingsChange }: PluginManagerPageProps) {
  const canAdmin = hasAdminAccess(user.role);
  const [workspaceTab, setWorkspaceTab] = useState<"profile" | "extensions" | "wallpaper">("profile");
  const [plugins, setPlugins] = useState<ManagedPluginRecord[]>([]);
  const [profile, setProfile] = useState("");
  const [loading, setLoading] = useState(canAdmin);
  const [error, setError] = useState("");
  const [sourceType, setSourceType] = useState<PluginSourceType>("github");
  const [source, setSource] = useState("");
  const [reference, setReference] = useState("");
  const [inspection, setInspection] = useState<ManagedPluginInspection | null>(null);
  const [operation, setOperation] = useState<"inspect" | "install" | null>(null);
  const [pendingPluginAction, setPendingPluginAction] = useState<{ id: string; action: "enable" | "disable" | "remove" } | null>(null);
  const [selectedApplications, setSelectedApplications] = useState<Record<string, ApplicationId>>({});
  const listControllerRef = useRef<AbortController | null>(null);
  const inspectionControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const enabledCount = useMemo(() => plugins.filter(plugin => plugin.state === "enabled").length, [plugins]);

  const refresh = useCallback(async () => {
    if (!canAdmin) return;
    listControllerRef.current?.abort();
    const controller = new AbortController();
    listControllerRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const result = await loadManagedPlugins(controller.signal);
      if (!controller.signal.aborted && mountedRef.current) {
        setProfile(result.profile);
        setPlugins(result.plugins);
        setSelectedApplications(current => {
          const next = { ...current };
          for (const plugin of result.plugins) {
            if (!plugin.applicationIds.includes(next[plugin.id] as ApplicationId)) delete next[plugin.id];
          }
          return next;
        });
      }
    } catch (loadError) {
      if (!controller.signal.aborted && mountedRef.current) setError(`插件清单读取失败：${getErrorMessage(loadError)}`);
    } finally {
      if (listControllerRef.current === controller) {
        listControllerRef.current = null;
        if (mountedRef.current) setLoading(false);
      }
    }
  }, [canAdmin]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
      listControllerRef.current?.abort();
      inspectionControllerRef.current?.abort();
    };
  }, [refresh]);

  function resetInspection(): void {
    inspectionControllerRef.current?.abort();
    inspectionControllerRef.current = null;
    setInspection(null);
    setOperation(null);
  }

  async function inspectSource(): Promise<void> {
    const value = source.trim();
    if (!canAdmin || !value || operation) return;
    if (sourceType === "github" && !value.startsWith("https://github.com/")) { setError("GitHub 来源请输入完整仓库地址；npm 安装请选择 NPM 包并填写实际包名，例如 dsh-plugin-wallpaper-engine。"); return; }
    if (sourceType === "npm" && value.startsWith("https://")) { setError("NPM 来源请填写包名；仓库地址请选择 GitHub 来源。"); return; }
    inspectionControllerRef.current?.abort();
    const controller = new AbortController();
    inspectionControllerRef.current = controller;
    setOperation("inspect");
    setInspection(null);
    setError("");
    try {
      const result = await inspectManagedPlugin(value, sourceType === "local" ? undefined : reference.trim() || undefined, controller.signal);
      if (!controller.signal.aborted && mountedRef.current) setInspection(result.plugin);
    } catch (inspectError) {
      if (!controller.signal.aborted && mountedRef.current) setError(`来源检查失败：${getErrorMessage(inspectError)}`);
    } finally {
      if (inspectionControllerRef.current === controller) {
        inspectionControllerRef.current = null;
        if (mountedRef.current) setOperation(null);
      }
    }
  }

  async function submitInstall(): Promise<void> {
    if (!canAdmin || !inspection || operation || pendingPluginAction) return;
    setOperation("install"); setError("");
    try {
      const result = await installManagedPlugin({ repositoryUrl: inspection.sourceLocation, ref: inspection.sourceType === "github" ? inspection.resolvedCommit : inspection.sourceType === "npm" ? inspection.version : inspection.requestedRef || "local", expectedResolvedRef: inspection.resolvedCommit });
      if (mountedRef.current) {
        setInspection(null);
        await refresh();
        if (result.activationRequired) setError(result.activationError || "插件已安装，启动失败，请查看诊断后重试启用。");
      }
    } catch (requestError) { if (mountedRef.current) setError(getErrorMessage(requestError)); }
    finally { if (mountedRef.current) setOperation(null); }
  }

  async function submitPluginAction(plugin: ManagedPluginRecord, action: PluginAction, applicationId: ApplicationId): Promise<void> {
    if (!canAdmin || pendingPluginAction || operation) return;

    setPendingPluginAction({ id: plugin.id, action });
    setError("");
    try {
      if (action === "remove") {
        await removeManagedPlugin(plugin.id, { targetApplicationId: applicationId, expectedSourceCommit: plugin.source.commit });
        if (mountedRef.current) await refresh();
        return;
      }
      const result = await setManagedPluginEnabled(plugin.id, {
        enabled: action === "enable",
        targetApplicationId: applicationId,
        expectedSourceCommit: plugin.source.commit
      });
      if (mountedRef.current) setPlugins(current => current.map(item => item.id === result.plugin.id ? result.plugin : item));
    } catch (actionError) {
      if (mountedRef.current) setError(`插件${action === "enable" ? "启用" : action === "remove" ? "卸载" : "停用"}失败：${getErrorMessage(actionError)}`);
    } finally {
      if (mountedRef.current) setPendingPluginAction(null);
    }
  }

  const permissionDescription = permissionModeLabels[settings.permissions.mode];

  return (
    <div className="plugin-manager-stage">
      <GlobalNavigationRail
        username={user.username}
        role={user.role}
        serverState={serverState}
        shortcuts={settings.shortcuts}
        activePage="plugins"
        homeLabel="返回小鱼智能体工作区"
        applications={applications}
        showServiceStatus={settings.general.showServiceStatus}
        onHome={() => onNavigate("/work")}
        onNavigate={onNavigate}
        onOpenApplication={onOpenApplication}
        onOpenWork={() => onNavigate("/work")}
        onOpenFiles={() => onNavigate("/files")}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
      />
      <section className={`plugin-manager-page${workspaceTab === "extensions" ? " plugin-manager-page--extensions" : ""}`} aria-labelledby="plugin-manager-title">
        <div className={`plugin-manager-page__content${workspaceTab === "extensions" ? " plugin-manager-page__content--extensions" : ""}`}>
          <header className="plugin-manager-page__header">
            <div>
              <Typography.Title id="plugin-manager-title" level={2}>插件</Typography.Title>
              <p>Profile 插件、AI 扩展与 MCP、运行诊断和壁纸引擎插件设置都在此管理。</p>
            </div>
            <div className="plugin-manager-page__header-actions">
              {workspaceTab === "profile" ? <Button icon={<WorkbenchIcon name="refresh" size={15} />} disabled={!canAdmin || loading} loading={loading} onClick={() => void refresh()}>刷新插件</Button> : null}
            </div>
          </header>

          <nav className="plugin-manager-page__tabs" role="tablist" aria-label="插件能力分区" onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
            event.preventDefault();
            const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"));
            const currentIndex = tabs.indexOf(event.target as HTMLButtonElement);
            const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" ? (currentIndex + 1) % tabs.length : (currentIndex - 1 + tabs.length) % tabs.length;
            tabs[nextIndex]?.focus();
            tabs[nextIndex]?.click();
          }}>
            <button id="plugin-manager-profile-tab" type="button" role="tab" tabIndex={workspaceTab === "profile" ? 0 : -1} aria-selected={workspaceTab === "profile"} aria-controls="plugin-manager-profile-panel" className={workspaceTab === "profile" ? "is-active" : ""} onClick={() => setWorkspaceTab("profile")}>Profile 插件</button>
            <button id="plugin-manager-extensions-tab" type="button" role="tab" tabIndex={workspaceTab === "extensions" ? 0 : -1} aria-selected={workspaceTab === "extensions"} aria-controls="plugin-manager-extensions-panel" className={workspaceTab === "extensions" ? "is-active" : ""} onClick={() => setWorkspaceTab("extensions")}>AI 扩展与运行时</button>
            <button id="plugin-manager-wallpaper-tab" type="button" role="tab" tabIndex={workspaceTab === "wallpaper" ? 0 : -1} aria-selected={workspaceTab === "wallpaper"} aria-controls="plugin-manager-wallpaper-panel" className={workspaceTab === "wallpaper" ? "is-active" : ""} onClick={() => setWorkspaceTab("wallpaper")}>壁纸引擎插件</button>
          </nav>

          <div id="plugin-manager-profile-panel" className="plugin-manager-page__workspace-panel" role="tabpanel" aria-labelledby="plugin-manager-profile-tab" hidden={workspaceTab !== "profile"}>
          {!canAdmin ? <Alert type="warning" showIcon message="插件管理需要管理员身份。" description="插件清单和来源检查由控制端按当前账户角色授权。" /> : null}
          {error ? <Alert type="error" showIcon closable message={error} onClose={() => setError("")} /> : null}

          {canAdmin ? <>
            <section className="plugin-manager-page__section" aria-labelledby="plugin-manager-install-title">
              <div className="plugin-manager-page__section-heading">
                <Typography.Title id="plugin-manager-install-title" level={4}>安装插件</Typography.Title>
                <span>来源检查不会安装或运行插件内容</span>
              </div>
              <div className="plugin-manager-page__source-card">
                <div className="plugin-manager-page__source-grid">
                  <Select
                    aria-label="插件安装来源类型"
                    value={sourceType}
                    disabled={operation === "install" || pendingPluginAction !== null}
                    options={[
                      { value: "github", label: "GitHub 仓库" },
                      { value: "npm", label: "NPM 包" },
                      { value: "local", label: "Host 本机绝对路径" }
                    ]}
                    onChange={(value: PluginSourceType) => { setSourceType(value); setSource(""); setReference(""); resetInspection(); }}
                  />
                  <Input
                    className="plugin-manager-page__source-input"
                    aria-label="插件来源"
                    placeholder={sourceType === "github" ? "https://github.com/owner/repository" : sourceType === "npm" ? "例如 dsh-plugin-wallpaper-engine；留空版本安装最新版" : "LFAA Host 上的绝对目录或 .tgz/.tar.gz 路径"}
                    value={source}
                    disabled={operation === "install" || pendingPluginAction !== null}
                    maxLength={2048}
                    onChange={event => { setSource(event.target.value); resetInspection(); }}
                    onPressEnter={() => void inspectSource()}
                  />
                  {sourceType !== "local" ? <Input
                    aria-label={sourceType === "npm" ? "NPM 版本" : "GitHub 分支或提交"}
                    placeholder={sourceType === "npm" ? "可在来源中写版本；也可单独指定版本" : "分支、标签或提交；留空使用默认分支"}
                    value={reference}
                    disabled={operation === "install" || pendingPluginAction !== null}
                    maxLength={200}
                    onChange={event => { setReference(event.target.value); resetInspection(); }}
                  /> : <div />}
                  <Button type="primary" icon={<WorkbenchIcon name="search" size={15} />} disabled={!source.trim() || operation !== null} loading={operation === "inspect"} onClick={() => void inspectSource()}>
                    {sourceType === "local" ? "检查 Host 路径" : "检查来源"}
                  </Button>
                </div>
                <Typography.Text className="plugin-manager-page__permission" type="secondary">留空版本将实时获取官方最新版本。检查后点击安装即可下载并启用。Host 路径指运行 LFAA 的主机。</Typography.Text>
                {inspection ? <article className="plugin-manager-page__inspection" aria-label="插件来源检查结果">
                  <div className="plugin-manager-page__section-heading">
                    <div>
                      <Typography.Title level={5}>{inspection.name} · v{inspection.version}</Typography.Title>
                      <Typography.Text type="secondary">{inspection.description || "来源未提供说明。"}</Typography.Text>
                    </div>
                    <Tag color={inspection.canEnable ? "green" : "orange"}>{inspection.canEnable ? "有兼容 Runtime" : "安装后保持隔离"}</Tag>
                  </div>
                  <div className="plugin-manager-page__inspection-details">
                    <span>{inspection.sourceType === "github" ? "GitHub 固定提交" : inspection.sourceType === "npm" ? "NPM SHA-512 完整性校验" : "Host 内容 SHA-256 快照"} · {inspection.resolvedRef}</span>
                    <span>内容 SHA-256：{inspection.archiveSha256}</span>
                    <span>声明能力：{inspection.capabilities.join("、") || "无"} · 许可证：{inspection.license ?? "未确认"}</span>
                    {inspection.compatibility === "dsh-v1" ? <>
                      <span>DSH 要求：{inspection.requirements.dshVersion ?? "未声明版本"} · Host：{inspection.requirements.hostEntry ?? "入口未在归档中确认"} · Bundle：{inspection.requirements.bundlePatch ?? "未确认"}</span>
                      <span>Client：{inspection.requirements.clientEntry ?? "未声明"} · 注入：{inspection.requirements.clientInject.join("、") || "无"} · Peer：{Object.entries(inspection.requirements.peerDependencies).map(([name, version]) => `${name} ${version}`).join("；") || "无"}</span>
                      <span>依赖脚本声明：{inspection.requirements.declaredScripts.join("、") || "无"}（仅检查名称，不执行）</span>
                    </> : null}
                    {inspection.runtimeReason ? <span>运行限制：{inspection.runtimeReason}</span> : null}
                  </div>
                  <div className="plugin-manager-page__source-actions">
                    <Button type="primary" disabled={operation !== null || pendingPluginAction !== null} loading={operation === "install"} onClick={() => void submitInstall()}>安装并启用</Button>
                    <Typography.Text type="secondary">直接下载已检查的版本，安装与启用结果会显示在下方。</Typography.Text>
                  </div>
                </article> : null}
              </div>
            </section>

            <section className="plugin-manager-page__section" aria-labelledby="plugin-manager-installed-title">
              <div className="plugin-manager-page__section-heading">
                <Typography.Title id="plugin-manager-installed-title" level={4}>已安装</Typography.Title>
                <span>{plugins.length} 项 · {enabledCount} 项已启用{profile ? ` · Profile ${profile}` : ""}</span>
              </div>
              {loading && !plugins.length ? <div className="plugin-manager-page__empty"><Spin />正在读取 Profile 插件清单…</div>
                : plugins.length ? <div className="plugin-manager-page__plugin-list">
                  {plugins.map(plugin => {
                    const targetApplicationId = selectedApplications[plugin.id] ?? plugin.applicationIds[0] ?? "workspace";
                    return <PluginCard
                      key={plugin.id}
                      plugin={plugin}
                      targetApplicationId={targetApplicationId}
                      canAdmin={canAdmin && operation === null && pendingPluginAction === null}
                      pendingAction={pendingPluginAction?.id === plugin.id ? pendingPluginAction.action : null}
                      onTargetApplicationChange={applicationId => setSelectedApplications(current => ({ ...current, [plugin.id]: applicationId }))}
                      onAction={submitPluginAction}
                    />;
                  })}
                </div> : <div className="plugin-manager-page__empty">当前 Profile 尚未安装插件。输入 NPM 规格、GitHub 仓库或 Host 绝对路径开始检查。</div>}
            </section>

            <Alert type="info" showIcon message="安装、启停和卸载可在此直接操作" description={`卸载会停止插件并删除安装文件、运行副本和插件私有数据。账户外观设置与 Steam 壁纸原文件保留。自然语言操作仍${permissionDescription}。`} />
          </> : null}
          </div>
          <div id="plugin-manager-extensions-panel" className="plugin-manager-page__workspace-panel plugin-manager-page__workspace-panel--extensions" role="tabpanel" aria-labelledby="plugin-manager-extensions-tab" hidden={workspaceTab !== "extensions"}>
            {workspaceTab === "extensions" ? <SettingsPage
              user={user}
              serverState={serverState}
              settings={settings}
              resolvedTheme={resolvedTheme}
              initialSection="plugins"
              applications={applications}
              onOpenApplication={onOpenApplication}
              onBack={() => onNavigate("/work")}
              onNavigate={onNavigate}
              onOpenSettings={onOpenSettings}
              onLogout={onLogout}
              onUserChange={onUserChange}
              onSettingsChange={onSettingsChange}
              standalonePluginWorkspace
            /> : null}
          </div>
          <div id="plugin-manager-wallpaper-panel" className="plugin-manager-page__workspace-panel plugin-manager-page__workspace-panel--extensions" role="tabpanel" aria-labelledby="plugin-manager-wallpaper-tab" hidden={workspaceTab !== "wallpaper"}>
            {workspaceTab === "wallpaper" ? <SettingsPage
              user={user}
              serverState={serverState}
              settings={settings}
              resolvedTheme={resolvedTheme}
              initialSection="wallpaperEngine"
              standalonePluginSection="wallpaperEngine"
              applications={applications}
              onOpenApplication={onOpenApplication}
              onBack={() => onNavigate("/work")}
              onNavigate={onNavigate}
              onOpenSettings={onOpenSettings}
              onLogout={onLogout}
              onUserChange={onUserChange}
              onSettingsChange={onSettingsChange}
              standalonePluginWorkspace
            /> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

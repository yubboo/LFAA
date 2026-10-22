/** 功能：呈现 LFAA Profile 插件管理页。作用：直接调用同一 Owner 安装、启停与卸载，显式操作复用 Permission Owner。 */
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Button, Input, Modal, Select, Spin, Tag, Typography } from "antd";
import { Menu, MenuItemButton } from "@deepseek-ai/dsh-client-ui-primitives";
import { getErrorMessage, hasAdminAccess, inspectManagedPlugin, installManagedPlugin, removeManagedPlugin, loadManagedPlugins, setManagedPluginEnabled, type ManagedPluginInstallProgress, type ManagedPluginInspection, type ManagedPluginRecord, type User, type UserSettings } from "lfaa-client-connection/src/api.js";
import { DshSlotOutlet, useDshSlotEntries } from "lfaa-client-modules/src/client/index.js";
import { ResizableWorkbench } from "lfaa-client-ui-dockkit/src/ResizableWorkbench.js";
import { resolveWorkbenchLayoutMetrics, type WorkbenchLayoutMetrics } from "lfaa-client-ui-dockkit/src/workbench-layout.config.js";
import { useWorkbenchMetrics } from "lfaa-client-ui-dockkit/src/use-workbench-metrics.js";
import { readWorkbenchLeftWidth, saveWorkbenchLeftWidth } from "lfaa-client-ui-dockkit/src/workbench-preferences.js";
import { GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH, GLOBAL_NAVIGATION_RAIL_WIDTH, GlobalNavigationRail, type ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { SecondaryNavigation, type SecondaryNavigationGroup } from "lfaa-client-ui-sidebar/src/SecondaryNavigation.js";
import { SettingsPage, type StandalonePluginWorkspaceView } from "lfaa-client-ui-settings/src/SettingsPage.js";
import type { ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";
import { type PluginAction } from "./plugin-goals.js";
import { hasWallpaperEnginePlugin } from "./plugin-visibility.js";
import { detectPluginSourceInput, pluginSourceInputHint, type PluginSourceInputKind } from "./plugin-source-input.js";
import { rowConfigPrefix, toPluginPackageRef, type PluginActivationOwner, type PluginConfigOwner, type PluginDetailOwner, type PluginTabInstall, type PluginTabOwner, type PluginsSubject } from "./dsh-plugin-manager-slots.js";
import "./PluginManagerPage.css";

type PluginManagerWorkspaceTab = StandalonePluginWorkspaceView | "plugins" | "wallpaper";

const PLUGIN_MANAGER_LAYOUT_KEY = "lfaa.plugin-manager.layout.v1";

const pluginWorkspaceTabIcons: Record<PluginManagerWorkspaceTab, "book" | "branch" | "extension" | "file" | "grid" | "help" | "monitor" | "spark" | "tools" | "sun"> = {
  all: "grid",
  plugins: "extension",
  applications: "grid",
  tools: "tools",
  skills: "spark",
  prompts: "file",
  mcp: "branch",
  knowledge: "book",
  diagnostics: "monitor",
  experts: "help",
  wallpaper: "sun"
};

function initialPluginManagerMetrics(): WorkbenchLayoutMetrics {
  if (typeof window === "undefined") return resolveWorkbenchLayoutMetrics(1280 - GLOBAL_NAVIGATION_RAIL_WIDTH, 800);
  const railWidth = window.innerWidth <= 420 ? GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH : GLOBAL_NAVIGATION_RAIL_WIDTH;
  return resolveWorkbenchLayoutMetrics(window.innerWidth - railWidth, window.innerHeight);
}

const PLUGIN_MANAGER_WORKSPACE_TABS: Array<{ id: PluginManagerWorkspaceTab; label: string }> = [
  { id: "all", label: "全部" },
  { id: "plugins", label: "插件" },
  { id: "applications", label: "应用" },
  { id: "tools", label: "工具" },
  { id: "skills", label: "技能" },
  { id: "prompts", label: "提示词" },
  { id: "mcp", label: "MCP 连接" },
  { id: "knowledge", label: "我的知识库" },
  { id: "diagnostics", label: "运行诊断" },
  { id: "experts", label: "领域专家" },
  { id: "wallpaper", label: "壁纸引擎" }
];

function initialPluginManagerWorkspaceTab(): PluginManagerWorkspaceTab {
  if (typeof window === "undefined") return "all";
  const view = new URLSearchParams(window.location.search).get("view");
  return view === "applications" || view === "mcp" || view === "skills" ? view : "all";
}

export interface PluginManagerPageProps {
  user: User;
  settings: UserSettings;
  resolvedTheme: "light" | "dark";
  serverState: ServiceState;
  applications: ApplicationNavigationItem[];
  navigationApplications?: ApplicationNavigationItem[];
  onNavigate: (path: string) => void;
  onOpenApplication: (app: ApplicationId, mode: "normal") => Promise<void>;
  onOpenApplications?: () => void;
  onOpenRecentSessions: () => void;
  onOpenSettings: (section?: "plugins") => void;
  onLogout: () => void;
  onUserChange: (user: User) => void;
  onSettingsChange: (settings: UserSettings) => void;
}

type PluginSourceType = ManagedPluginInspection["sourceType"];
type PluginFilter = "all" | "enabled" | "installed" | "incompatible";

const pluginSourceChoices = [
  { type: "github", label: "GitHub 仓库", description: "检查仓库来源并固定实际提交。", icon: "branch" },
  { type: "npm", label: "NPM 包", description: "按包名和版本检查完整性摘要。", icon: "archive" },
  { type: "local", label: "Host 本机路径", description: "检查 LFAA Host 上的目录或归档。", icon: "folder" }
] as const;

const npmRegistryChoices = [
  { value: "china", label: "中国大陆镜像源" },
  { value: "official", label: "NPM 官方源" },
  { value: "custom", label: "自定义地址" }
] as const;

const installStageLabels: Record<ManagedPluginInstallProgress["stage"], string> = {
  resolving: "读取来源",
  "source-verified": "固定版本与完整性",
  "compatibility-checked": "兼容性检查",
  "writing-files": "安全写入文件",
  "committing-inventory": "保存插件清单",
  "already-installed": "检查现有安装",
  installed: "安装完成"
};

interface PluginExtensionBoundaryProps { name: string; children: ReactNode }
interface PluginExtensionBoundaryState { error: boolean }

/** A broken contribution must report visibly without taking down the Plugin Manager. */
class PluginExtensionBoundary extends Component<PluginExtensionBoundaryProps, PluginExtensionBoundaryState> {
  state: PluginExtensionBoundaryState = { error: false };

  static getDerivedStateFromError(): Partial<PluginExtensionBoundaryState> { return { error: true }; }

  private retry = () => this.setState({ error: false });

  render() {
    if (this.state.error) return <div className="plugin-manager-page__extension-error" role="alert">
      <Alert type="error" showIcon message="插件扩展暂不可用" description={`“${this.props.name}”扩展渲染失败。此区域已隔离，插件管理页仍可继续使用。`} />
      <Button size="small" onClick={this.retry}>重新加载</Button>
    </div>;
    return <>{this.props.children}</>;
  }
}

function PluginExtensionSlot({ name, owner, entryKey, only, fallback }: {
  name: string;
  owner?: object;
  entryKey?: string;
  only?: string;
  fallback?: ReactNode;
}) {
  const identity = `${name}:${entryKey ?? only ?? "all"}`;
  return <PluginExtensionBoundary key={identity} name={name}>
    <DshSlotOutlet name={name} owner={owner} entryKey={entryKey} only={only} fallback={fallback} />
  </PluginExtensionBoundary>;
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

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

function PluginCard({ plugin, targetApplicationId, canAdmin, pendingAction, onTargetApplicationChange, onAction, onOpenDetails }: {
  plugin: ManagedPluginRecord;
  targetApplicationId: ApplicationId;
  canAdmin: boolean;
  pendingAction: "enable" | "disable" | "remove" | null;
  onTargetApplicationChange: (app: ApplicationId) => void;
  onAction: (plugin: ManagedPluginRecord, action: PluginAction, app: ApplicationId) => void;
  onOpenDetails: () => void;
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
        <Button onClick={onOpenDetails}>设置与详情</Button>
        {plugin.state === "installed" ? <Button type="primary" disabled={!canAdmin || pendingAction !== null} loading={pendingAction === "enable"} onClick={() => onAction(plugin, "enable", targetApplicationId)}>启用</Button> : null}
        {plugin.state === "enabled" ? <Button disabled={!canAdmin || pendingAction !== null} loading={pendingAction === "disable"} onClick={() => onAction(plugin, "disable", targetApplicationId)}>停用</Button> : null}
        <Button danger disabled={!canAdmin || pendingAction !== null} loading={pendingAction === "remove"} onClick={() => onAction(plugin, "remove", targetApplicationId)}>卸载</Button>
      </div>
    </article>
  );
}

export function PluginManagerPage({ user, settings, resolvedTheme, serverState, applications, navigationApplications = applications, onNavigate, onOpenApplication, onOpenApplications, onOpenRecentSessions, onOpenSettings, onLogout, onUserChange, onSettingsChange }: PluginManagerPageProps) {
  const canAdmin = hasAdminAccess(user.role);
  const layoutRef = useRef<HTMLDivElement>(null);
  const layout = useWorkbenchMetrics(layoutRef, initialPluginManagerMetrics);
  const [leftCollapsed, setLeftCollapsed] = useState(() => initialPluginManagerMetrics().mode === "mobile");
  const [leftWidth, setLeftWidth] = useState(() => {
    const initial = initialPluginManagerMetrics();
    return readWorkbenchLeftWidth(initial.left, initial.containerWidth);
  });
  const [workspaceTab, setWorkspaceTab] = useState<PluginManagerWorkspaceTab>(initialPluginManagerWorkspaceTab);
  const isSettingsWorkspaceTab = workspaceTab !== "plugins" && workspaceTab !== "wallpaper";
  const pluginTabEntries = useDshSlotEntries("plugins.tab");
  const activationEntries = useDshSlotEntries("plugins.bundle.activation");
  const pluginItemEntries = useDshSlotEntries("plugins.item");
  const bundleConfigEntries = useDshSlotEntries("plugins.bundle.config");
  const rowConfigEntries = useDshSlotEntries("plugins.row.config");
  const [selectedPluginTab, setSelectedPluginTab] = useState<string | null>(null);
  const [selectedPluginDetailsId, setSelectedPluginDetailsId] = useState<string | null>(null);
  const [selectedPluginItemId, setSelectedPluginItemId] = useState<string | null>(null);
  const [selectedBundleConfigKey, setSelectedBundleConfigKey] = useState<string | null>(null);
  const [selectedRowConfigKey, setSelectedRowConfigKey] = useState<string | null>(null);
  const [activationPlugin, setActivationPlugin] = useState<ManagedPluginRecord | null>(null);
  const [addActionsOpen, setAddActionsOpen] = useState(false);
  const [contributedInstall, setContributedInstall] = useState<PluginTabInstall | null>(null);
  const [plugins, setPlugins] = useState<ManagedPluginRecord[]>([]);
  const [profile, setProfile] = useState("");
  const [installationDirectory, setInstallationDirectory] = useState("");
  const [loading, setLoading] = useState(canAdmin);
  const [error, setError] = useState("");
  const [sourceType, setSourceType] = useState<PluginSourceType>("github");
  const [source, setSource] = useState("");
  const [reference, setReference] = useState("");
  const [registryChoice, setRegistryChoice] = useState<"china" | "official" | "custom">("china");
  const [customRegistry, setCustomRegistry] = useState("");
  const [pluginQuery, setPluginQuery] = useState("");
  const [pluginFilter, setPluginFilter] = useState<PluginFilter>("all");
  const [installerOpen, setInstallerOpen] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [inspection, setInspection] = useState<ManagedPluginInspection | null>(null);
  const [installerError, setInstallerError] = useState("");
  const [installProgress, setInstallProgress] = useState<ManagedPluginInstallProgress[]>([]);
  const [installResult, setInstallResult] = useState<ManagedPluginRecord | null>(null);
  const [installDetailsOpen, setInstallDetailsOpen] = useState(false);
  const [operation, setOperation] = useState<"inspect" | "install" | null>(null);
  const [pendingPluginAction, setPendingPluginAction] = useState<{ id: string; action: "enable" | "disable" | "remove" } | null>(null);
  const [selectedApplications, setSelectedApplications] = useState<Record<string, ApplicationId>>({});
  const listControllerRef = useRef<AbortController | null>(null);
  const inspectionControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const detectedSourceType = detectPluginSourceInput(source);
  const activeSourceType: PluginSourceInputKind = detectedSourceType ?? sourceType;
  const activeRegistry = registryChoice === "china" ? "https://registry.npmmirror.com/" : registryChoice === "official" ? "https://registry.npmjs.org/" : customRegistry.trim();
  const visiblePluginTabs = useMemo(() => pluginTabEntries
    .filter(entry => entry.id && entry.label)
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.index - b.index), [pluginTabEntries]);
  const wallpaperEngineInstalled = hasWallpaperEnginePlugin(plugins);
  const navigationGroups = useMemo<SecondaryNavigationGroup[]>(() => {
    const items = PLUGIN_MANAGER_WORKSPACE_TABS
      .filter(({ id }) => id !== "wallpaper" || wallpaperEngineInstalled)
      .map(({ id, label }) => ({
        id,
        label,
        icon: pluginWorkspaceTabIcons[id],
        active: workspaceTab === id && (id !== "plugins" || selectedPluginTab === null),
        domId: `plugin-manager-${id}-tab`,
        onSelect: () => {
          setWorkspaceTab(id);
          const nextAddress = new URL(window.location.href);
          if (id === "all") nextAddress.searchParams.delete("view");
          else nextAddress.searchParams.set("view", id);
          window.history.replaceState(window.history.state, "", `${nextAddress.pathname}${nextAddress.search}${nextAddress.hash}`);
          if (id === "plugins") setSelectedPluginTab(null);
          if (layout.mode === "mobile") setLeftCollapsed(true);
        }
      }));
    const groups: SecondaryNavigationGroup[] = [{ id: "plugin-manager-nav-workspace", label: "工作区", collapsible: false, items }];
    if (workspaceTab === "plugins" && visiblePluginTabs.length) {
      groups.push({
        id: "plugin-manager-nav-contributed",
        label: "插件扩展",
        collapsible: false,
        items: visiblePluginTabs.map(entry => ({
          id: `contributed:${entry.id}`,
          domId: `plugin-manager-contributed-${encodeURIComponent(entry.id)}-tab`,
          label: entry.label ?? entry.id,
          active: selectedPluginTab === entry.id,
          onSelect: () => {
            setWorkspaceTab("plugins");
            setSelectedPluginTab(entry.id);
            if (layout.mode === "mobile") setLeftCollapsed(true);
          }
        }))
      });
    }
    return groups;
  }, [layout.mode, selectedPluginTab, visiblePluginTabs, wallpaperEngineInstalled, workspaceTab]);
  const selectedPlugin = plugins.find(plugin => plugin.id === selectedPluginDetailsId) ?? null;
  const selectedConfigItem = pluginItemEntries.find(entry => entry.id === selectedPluginItemId) ?? null;
  const selectedBundleConfig = bundleConfigEntries.find(entry => entry.key === selectedBundleConfigKey) ?? null;
  const selectedRowConfig = rowConfigEntries.find(entry => entry.key === selectedRowConfigKey) ?? null;
  const selectedPluginSubject: PluginsSubject | null = selectedPlugin ? { kind: "bundle", pkg: toPluginPackageRef(selectedPlugin) } : null;
  const selectedPluginRowConfigs = selectedPlugin
    ? rowConfigEntries.filter(entry => entry.key?.startsWith(rowConfigPrefix(selectedPlugin.name)) ?? false)
    : [];

  const enabledCount = useMemo(() => plugins.filter(plugin => plugin.state === "enabled").length, [plugins]);
  const filteredPlugins = useMemo(() => {
    const query = pluginQuery.trim().toLocaleLowerCase();
    return plugins.filter(plugin => {
      const matchesFilter = pluginFilter === "all" || plugin.state === pluginFilter;
      if (!matchesFilter) return false;
      if (!query) return true;
      return [plugin.name, plugin.description, plugin.id, plugin.source.repository, pluginSourceLabel(plugin), pluginCompatibilityLabel(plugin.compatibility)]
        .some(value => value.toLocaleLowerCase().includes(query));
    });
  }, [pluginFilter, pluginQuery, plugins]);

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
        setInstallationDirectory(result.installationDirectory);
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

  useEffect(() => {
    saveWorkbenchLeftWidth(leftWidth, layout.left);
  }, [layout.left.max, layout.left.min, leftWidth]);

  useEffect(() => {
    if (layout.mode === "mobile") setLeftCollapsed(true);
  }, [layout.mode]);

  useEffect(() => {
    if (!wallpaperEngineInstalled && workspaceTab === "wallpaper") setWorkspaceTab("all");
  }, [wallpaperEngineInstalled, workspaceTab]);

  useEffect(() => {
    if (selectedPluginTab && !visiblePluginTabs.some(entry => entry.id === selectedPluginTab)) setSelectedPluginTab(null);
  }, [selectedPluginTab, visiblePluginTabs]);

  useEffect(() => {
    if (activationPlugin && !activationEntries.some(entry => entry.key === activationPlugin.name)) setActivationPlugin(null);
  }, [activationEntries, activationPlugin]);

  function resetInspection(): void {
    inspectionControllerRef.current?.abort();
    inspectionControllerRef.current = null;
    setInspection(null);
    setInstallerError("");
    setInstallProgress([]);
    setInstallResult(null);
    setInstallDetailsOpen(false);
    setOperation(null);
  }

  function openSourceForm(nextSourceType: PluginSourceType): void {
    setInstallGuideOpen(false);
    setSourceType(nextSourceType);
    setSource("");
    setReference("");
    setRegistryChoice("china");
    setContributedInstall(null);
    resetInspection();
    setInstallerOpen(true);
  }

  function openContributedInstall(target: PluginTabInstall): void {
    const kind = detectPluginSourceInput(target.spec);
    if (!kind) {
      setError(`扩展提供的安装来源无法识别：${target.spec}`);
      setSelectedPluginTab(null);
      return;
    }
    setInstallGuideOpen(false);
    setSourceType(kind);
    setSource(target.spec);
    setReference("");
    setRegistryChoice(target.registry ? "custom" : "china");
    setCustomRegistry(target.registry ?? "");
    setContributedInstall(target);
    resetInspection();
    setInstallerOpen(true);
  }

  function closeInstaller(): void {
    if (operation === "install") return;
    setInstallGuideOpen(false);
    setInstallerOpen(false);
  }

  async function inspectSource(): Promise<void> {
    const value = source.trim();
    if (!canAdmin || !value || operation) return;
    if (!detectedSourceType) { setInstallerError("无法识别来源。请填写 npm 包名（如 dsh-plugin-whale-pet）、GitHub HTTPS 仓库地址或 Host 本机绝对路径。"); return; }
    if (detectedSourceType === "npm" && registryChoice === "custom" && !activeRegistry) { setInstallerError("请填写自定义 NPM registry 地址。"); return; }
    inspectionControllerRef.current?.abort();
    const controller = new AbortController();
    inspectionControllerRef.current = controller;
    setOperation("inspect");
    setInspection(null);
    setInstallerError("");
    setInstallProgress([]);
    setInstallResult(null);
    try {
      const result = await inspectManagedPlugin(value, detectedSourceType === "github" ? reference.trim() || undefined : undefined, controller.signal, detectedSourceType === "npm" ? activeRegistry : undefined);
      if (!controller.signal.aborted && mountedRef.current) setInspection(result.plugin);
    } catch (inspectError) {
      if (!controller.signal.aborted && mountedRef.current) setInstallerError(`来源检查失败：${getErrorMessage(inspectError)}`);
    } finally {
      if (inspectionControllerRef.current === controller) {
        inspectionControllerRef.current = null;
        if (mountedRef.current) setOperation(null);
      }
    }
  }

  async function submitInstall(): Promise<void> {
    if (!canAdmin || !inspection || operation || pendingPluginAction) return;
    if (contributedInstall && inspection.version !== contributedInstall.version) {
      setInstallerError(`扩展请求安装 v${contributedInstall.version}，但来源检查返回 v${inspection.version}；请勿安装不匹配的版本。`);
      return;
    }
    const requestedRegistry = contributedInstall?.registry ?? activeRegistry;
    if (inspection.sourceType === "npm" && inspection.registryUrl !== requestedRegistry) { setInstallerError("NPM registry 已变化，请重新检查来源后再安装。"); setInspection(null); return; }
    setOperation("install");
    setInstallerError("");
    setInstallProgress([]);
    setInstallResult(null);
    setInstallDetailsOpen(true);
    try {
      const result = await installManagedPlugin({
        repositoryUrl: inspection.sourceLocation,
        ref: inspection.sourceType === "github" ? inspection.resolvedCommit : inspection.sourceType === "npm" ? inspection.version : inspection.requestedRef || "local",
        expectedResolvedRef: inspection.resolvedCommit,
        expectedSourceType: inspection.sourceType,
        expectedSourceLocation: inspection.sourceLocation,
        ...(inspection.sourceType === "npm" ? { npmRegistry: inspection.registryUrl ?? requestedRegistry } : {})
      }, progress => {
        if (mountedRef.current) setInstallProgress(current => [...current.slice(-31), progress]);
      });
      if (mountedRef.current) {
        setInstallResult(result.plugin);
        await refresh();
      }
    } catch (requestError) { if (mountedRef.current) setInstallerError(getErrorMessage(requestError)); }
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
      if (mountedRef.current) {
        setPlugins(current => current.map(item => item.id === result.plugin.id ? result.plugin : item));
        setInstallResult(current => current?.id === result.plugin.id ? result.plugin : current);
        if (action === "enable" && result.plugin.state === "enabled") setActivationPlugin(result.plugin);
      }
    } catch (actionError) {
      if (mountedRef.current) {
        const message = `插件${action === "enable" ? "启用" : action === "remove" ? "卸载" : "停用"}失败：${getErrorMessage(actionError)}`;
        setError(message);
        if (installerOpen) setInstallerError(message);
      }
    } finally {
      if (mountedRef.current) setPendingPluginAction(null);
    }
  }

  const permissionDescription = permissionModeLabels[settings.permissions.mode];
  const navigateFromPluginSettings = useCallback((path: string) => {
    if (path === "/plugin-manager") {
      setWorkspaceTab("plugins");
      return;
    }
    onNavigate(path);
  }, [onNavigate]);

  function openContributedPackage(packageName: string): void {
    setWorkspaceTab("plugins");
    setSelectedPluginTab(null);
    const plugin = plugins.find(item => item.name === packageName);
    if (plugin) setSelectedPluginDetailsId(plugin.id);
    else setError(`当前 LFAA Profile 中没有 ${packageName} 的插件记录；已返回插件清单。`);
  }

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
        navigationApplications={navigationApplications}
        showServiceStatus={settings.general.showServiceStatus}
        onHome={() => onNavigate("/work")}
        onToggleApplications={onOpenApplications ?? (() => onNavigate("/work"))}
        onOpenRecentSessions={onOpenRecentSessions}
        onNavigate={onNavigate}
        onOpenApplication={onOpenApplication}
        onOpenWork={() => onNavigate("/work")}
        onOpenFiles={() => onNavigate("/files")}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
      />
      <div ref={layoutRef} className="plugin-manager-layout">
        <ResizableWorkbench
          leftRegionClassName="plugin-manager-navigation-region"
          centerRegionClassName="plugin-manager-content-region"
          storageKey={PLUGIN_MANAGER_LAYOUT_KEY}
          containerWidth={layout.containerWidth}
          left={<aside className="plugin-manager-sidebar">
            <header className="plugin-manager-sidebar__header">
              <Typography.Title level={4}>插件导航</Typography.Title>
              <Button type="text" className="plugin-manager-sidebar__collapse" aria-label="收起插件导航" title="收起插件导航" onClick={() => setLeftCollapsed(true)}><WorkbenchIcon name="panelLeft" size={16} /></Button>
            </header>
            <SecondaryNavigation ariaLabel="插件工作区分类" groups={navigationGroups} activateOnArrow />
          </aside>}
          center={
            <section className={`plugin-manager-page${workspaceTab !== "plugins" ? " plugin-manager-page--extensions" : ""}`} aria-labelledby="plugin-manager-title">
            <div className={`plugin-manager-page__content${workspaceTab !== "plugins" ? " plugin-manager-page__content--extensions" : ""}`}>
              <header className="plugin-manager-page__header">
                <div className="plugin-manager-page__header-main">
                  {leftCollapsed ? <Button type="text" aria-label="展开插件导航" title="展开插件导航" onClick={() => setLeftCollapsed(false)}><WorkbenchIcon name="panelLeft" size={16} />菜单</Button> : null}
                  <div>
                  <Typography.Title id="plugin-manager-title" level={2}>插件</Typography.Title>
                  <p>{wallpaperEngineInstalled ? "管理已安装插件、应用扩展、能力与运行状态。" : "管理已安装插件、应用扩展与 AI 能力。"}</p>
                  </div>
                </div>
              </header>

              <div id="plugin-manager-profile-panel" className="plugin-manager-page__workspace-panel" role="region" aria-labelledby="plugin-manager-plugins-tab" hidden={workspaceTab !== "plugins" || selectedPluginTab !== null}>
              {!canAdmin ? <Alert type="warning" showIcon message="插件管理需要管理员身份。" description="插件清单和来源检查由控制端按当前账户角色授权。" /> : null}
              {error ? <Alert type="error" showIcon closable message={error} onClose={() => setError("")} /> : null}

              {canAdmin ? <>
                <div className="plugin-manager-page__catalog-toolbar">
                  <Input
                    className="plugin-manager-page__search"
                    aria-label="搜索插件"
                    placeholder="搜索插件"
                    prefix={<WorkbenchIcon name="search" size={16} />}
                    allowClear
                    value={pluginQuery}
                    onChange={event => setPluginQuery(event.target.value)}
                  />
                  <div className="plugin-manager-page__catalog-actions">
                    <Button type="text" className="plugin-manager-page__settings-button" aria-label="打开插件设置" title="打开插件设置" onClick={() => onOpenSettings("plugins")}><WorkbenchIcon name="settings" size={16} /></Button>
                    <Button icon={<WorkbenchIcon name="refresh" size={15} />} disabled={loading} loading={loading} onClick={() => void refresh()}>刷新</Button>
                    <span className="plugin-manager-page__add-menu" role="group" aria-label="添加插件">
                      <Button
                        type="primary"
                        aria-haspopup="dialog"
                        icon={<WorkbenchIcon name="plus" size={15} />}
                        disabled={operation === "install" || pendingPluginAction !== null}
                        onClick={() => { setInstallGuideOpen(false); setInstallerOpen(true); }}
                      >添加插件</Button>
                      <Menu
                        open={addActionsOpen}
                        onClose={() => setAddActionsOpen(false)}
                        align="end"
                        side="bottom"
                        portal
                        autoFocus
                        listClassName="plugin-manager-page__add-menu-list"
                        anchor={<Button disabled={operation === "install" || pendingPluginAction !== null} aria-label="更多插件添加操作" aria-haspopup="menu" aria-expanded={addActionsOpen} onClick={() => setAddActionsOpen(open => !open)}><WorkbenchIcon name="dots" size={15} /></Button>}
                      >
                        <MenuItemButton icon={<WorkbenchIcon name="extension" size={14} />} onSelect={() => { setAddActionsOpen(false); setInstallGuideOpen(false); setInstallerOpen(true); }}>
                          <span className="plugin-manager-page__add-menu-item"><span>从来源安装</span><span>检查并安装插件包</span></span>
                        </MenuItemButton>
                        <PluginExtensionSlot name="plugins.add.actions" owner={{ onDismiss: () => setAddActionsOpen(false) }} />
                      </Menu>
                    </span>
                  </div>
                </div>

                <div className="plugin-manager-page__filters" role="group" aria-label="按插件状态筛选">
                  {([
                    { key: "all", label: "全部", count: plugins.length },
                    { key: "enabled", label: "已启用", count: enabledCount },
                    { key: "installed", label: "未启用", count: plugins.filter(plugin => plugin.state === "installed").length },
                    { key: "incompatible", label: "不兼容", count: plugins.filter(plugin => plugin.state === "incompatible").length }
                  ] as const).map(filter => <button
                    key={filter.key}
                    type="button"
                    className={pluginFilter === filter.key ? "is-active" : ""}
                    aria-pressed={pluginFilter === filter.key}
                    onClick={() => setPluginFilter(filter.key)}
                  >{filter.label}<span>{filter.count}</span></button>)}
                </div>

                {selectedPluginTab === null ? <>
                <section className="plugin-manager-page__section" aria-labelledby="plugin-manager-installed-title">
                  <div className="plugin-manager-page__section-heading">
                    <Typography.Title id="plugin-manager-installed-title" level={4}>已安装</Typography.Title>
                    <span>{plugins.length} 项 · {enabledCount} 项已启用{profile ? ` · Profile ${profile}` : ""}</span>
                  </div>
                  {loading && !plugins.length ? <div className="plugin-manager-page__empty"><Spin />正在读取 Profile 插件清单…</div>
                    : filteredPlugins.length ? <div className="plugin-manager-page__plugin-list">
                      {filteredPlugins.map(plugin => {
                        const targetApplicationId = selectedApplications[plugin.id] ?? plugin.applicationIds[0] ?? "workspace";
                        return <PluginCard
                          key={plugin.id}
                          plugin={plugin}
                          targetApplicationId={targetApplicationId}
                          canAdmin={canAdmin && operation === null && pendingPluginAction === null}
                          pendingAction={pendingPluginAction?.id === plugin.id ? pendingPluginAction.action : null}
                          onTargetApplicationChange={applicationId => setSelectedApplications(current => ({ ...current, [plugin.id]: applicationId }))}
                          onAction={submitPluginAction}
                          onOpenDetails={() => setSelectedPluginDetailsId(plugin.id)}
                        />;
                      })}
                    </div> : plugins.length ? <div className="plugin-manager-page__empty plugin-manager-page__empty--compact">没有符合当前搜索和状态筛选的插件。</div>
                      : <div className="plugin-manager-page__empty plugin-manager-page__empty--catalog">
                        <span className="plugin-manager-page__empty-icon"><WorkbenchIcon name="extension" size={22} /></span>
                        <strong>这个 Profile 还没有插件</strong>
                        <span>添加 NPM 包、GitHub 仓库或 Host 本机来源。检查完成后会先显示真实兼容状态。</span>
                      </div>}
            </section>

            {!plugins.length && !loading ? <section className="plugin-manager-page__section" aria-labelledby="plugin-manager-sources-title">
              <div className="plugin-manager-page__section-heading">
                <Typography.Title id="plugin-manager-sources-title" level={4}>支持的安装来源</Typography.Title>
              </div>
              <div className="plugin-manager-page__source-options">
                {pluginSourceChoices.map(choice => <button key={choice.type} type="button" className="plugin-manager-page__source-option" onClick={() => openSourceForm(choice.type)}>
                  <span className="plugin-manager-page__source-option-icon"><WorkbenchIcon name={choice.icon} size={19} /></span>
                  <span className="plugin-manager-page__source-option-copy"><strong>{choice.label}</strong><span>{choice.description}</span></span>
                  <WorkbenchIcon className="plugin-manager-page__source-option-arrow" name="chevron" size={16} />
                </button>)}
              </div>
            </section> : null}

            {pluginItemEntries.length ? <section className="plugin-manager-page__section" aria-labelledby="plugin-manager-contributed-items-title">
              <div className="plugin-manager-page__section-heading">
                <Typography.Title id="plugin-manager-contributed-items-title" level={4}>插件提供的设置页</Typography.Title>
                <span>{pluginItemEntries.length} 项</span>
              </div>
              <div className="plugin-manager-page__contributed-list">
                {pluginItemEntries.map(entry => <article key={entry.id} className="plugin-manager-page__contributed-card">
                  <div><strong>{entry.label ?? entry.id}</strong><p><PluginExtensionSlot name="plugins.item" only={entry.id} owner={{ view: "summary" } satisfies PluginConfigOwner} fallback="此扩展尚未提供摘要。" /></p></div>
                  <Button onClick={() => setSelectedPluginItemId(entry.id)}>设置</Button>
                </article>)}
              </div>
            </section> : null}

            {bundleConfigEntries.length || rowConfigEntries.length ? <section className="plugin-manager-page__section" aria-labelledby="plugin-manager-contributed-config-title">
              <div className="plugin-manager-page__section-heading">
                <Typography.Title id="plugin-manager-contributed-config-title" level={4}>插件配置扩展</Typography.Title>
                <span>{bundleConfigEntries.length + rowConfigEntries.length} 项</span>
              </div>
              <div className="plugin-manager-page__contributed-list">
                {bundleConfigEntries.filter(entry => entry.key).map(entry => <article key={`bundle:${entry.key}`} className="plugin-manager-page__contributed-card">
                  <div><strong>{entry.key}</strong><p>插件包配置页</p></div><Button onClick={() => setSelectedBundleConfigKey(entry.key ?? null)}>打开设置</Button>
                </article>)}
                {rowConfigEntries.filter(entry => entry.key).map(entry => <article key={`row:${entry.key}`} className="plugin-manager-page__contributed-card">
                  <div><strong>{entry.key}</strong><p>插件能力配置页</p></div><Button onClick={() => setSelectedRowConfigKey(entry.key ?? null)}>打开设置</Button>
                </article>)}
              </div>
            </section> : null}

            <p className="plugin-manager-page__management-note">插件启停和卸载受管理员身份及当前 Permission Owner 保护。卸载会清理插件私有数据，不影响账户外观设置和 Steam 壁纸原文件；自然语言操作仍{permissionDescription}。</p>
            </> : null}
          </> : null}
          </div>
          {selectedPluginTab ? <div id="plugin-manager-contributed-tab-panel" className="plugin-manager-page__workspace-panel plugin-manager-page__contributed-tab-panel" role="region" aria-labelledby={`plugin-manager-contributed-${encodeURIComponent(selectedPluginTab)}-tab`} hidden={workspaceTab !== "plugins"}>
            <PluginExtensionSlot name="plugins.tab" only={selectedPluginTab} owner={{ install: openContributedInstall, openPackage: openContributedPackage } satisfies PluginTabOwner} fallback={<Alert type="info" showIcon message="插件扩展标签暂不可用" description="该扩展可能已卸载或尚未完成加载。" />} />
          </div> : null}
          <div id="plugin-manager-extensions-panel" className="plugin-manager-page__workspace-panel plugin-manager-page__workspace-panel--extensions" role="region" aria-labelledby={`plugin-manager-${workspaceTab}-tab`} hidden={!isSettingsWorkspaceTab}>
            {isSettingsWorkspaceTab ? <SettingsPage
              user={user}
              serverState={serverState}
              settings={settings}
              resolvedTheme={resolvedTheme}
              initialSection="plugins"
              applications={applications}
              onOpenApplication={onOpenApplication}
              onOpenApplications={onOpenApplications}
              onOpenRecentSessions={onOpenRecentSessions}
              onBack={() => onNavigate("/work")}
              onNavigate={navigateFromPluginSettings}
              onOpenSettings={onOpenSettings}
              onLogout={onLogout}
              onUserChange={onUserChange}
              onSettingsChange={onSettingsChange}
              standalonePluginWorkspace
              standalonePluginView={workspaceTab}
            /> : null}
          </div>
          {wallpaperEngineInstalled ? <div id="plugin-manager-wallpaper-panel" className="plugin-manager-page__workspace-panel plugin-manager-page__workspace-panel--extensions" role="region" aria-labelledby="plugin-manager-wallpaper-tab" hidden={workspaceTab !== "wallpaper"}>
            {workspaceTab === "wallpaper" ? <SettingsPage
              user={user}
              serverState={serverState}
              settings={settings}
              resolvedTheme={resolvedTheme}
              initialSection="wallpaperEngine"
              standalonePluginSection="wallpaperEngine"
              applications={applications}
              onOpenApplication={onOpenApplication}
              onOpenApplications={onOpenApplications}
              onOpenRecentSessions={onOpenRecentSessions}
              onBack={() => onNavigate("/work")}
              onNavigate={navigateFromPluginSettings}
              onOpenSettings={onOpenSettings}
              onLogout={onLogout}
              onUserChange={onUserChange}
              onSettingsChange={onSettingsChange}
              standalonePluginWorkspace
            /> : null}
          </div> : null}
        </div>
            </section>
          }
          leftLimits={layout.left}
          rightLimits={layout.right}
          bottomLimits={layout.bottom}
          leftWidth={leftWidth}
          onLeftWidthChange={setLeftWidth}
          leftCollapsed={leftCollapsed}
          onLeftCollapsedChange={setLeftCollapsed}
          snapCaptureRatio={layout.snapCaptureRatio}
          snapHysteresis={layout.snapHysteresis}
          minCenterWidth={layout.minCenterWidth}
          layoutMode={layout.mode}
          rightCollapsed
          bottomOpen={false}
        />
      </div>
      <Modal
        className="plugin-manager-install-modal"
        title={<span id="plugin-manager-install-title">{installResult ? (installResult.state === "enabled" ? "已启用" : "已安装") : operation === "install" ? "插件安装中…" : contributedInstall ? `安装 ${contributedInstall.title} v${contributedInstall.version}` : "添加插件"}</span>}
        open={installerOpen}
        centered
        width="min(720px, calc(100vw - 28px))"
        footer={null}
        closable={operation !== "install"}
        keyboard={operation !== "install"}
        maskClosable={operation !== "install"}
        getContainer={() => (document.querySelector(".plugin-manager-stage")?.closest(".workbench-shell") as HTMLElement | null) ?? document.body}
        onCancel={closeInstaller}
      >
        <div className="plugin-manager-install-modal__body" aria-labelledby="plugin-manager-install-title">
          {installResult ? <>
            <div className="plugin-manager-install-modal__result" role="status" aria-live="polite">
              <div className="plugin-manager-install-modal__result-heading">
                <span className={`plugin-manager-install-modal__result-mark${installResult.state === "incompatible" ? " is-warning" : ""}`}><WorkbenchIcon name={installResult.state === "incompatible" ? "shield" : "check"} size={18} /></span>
                <div><strong>{installResult.name}</strong><span>v{installResult.version} · {pluginStateLabel(installResult.state)}</span></div>
              </div>
              <p>{installResult.description || "此插件未提供说明。"}</p>
              <dl>
                <div><dt>安装位置</dt><dd>{installationDirectory}</dd></div>
                <div><dt>安装来源</dt><dd>{pluginSourceLabel(installResult)}</dd></div>
                <div><dt>固定版本</dt><dd title={installResult.source.commit}>{installResult.source.commit}</dd></div>
                <div><dt>SHA-256</dt><dd>{installResult.source.archiveSha256}</dd></div>
              </dl>
              {installResult.reason ? <Alert type="warning" showIcon message={installResult.reason} /> : null}
            </div>
            {installProgress.length ? <section className="plugin-manager-install-modal__progress" aria-label="实际安装步骤">
              <button type="button" aria-expanded={installDetailsOpen} onClick={() => setInstallDetailsOpen(open => !open)}>{installDetailsOpen ? "收起安装详情" : "查看安装详情"}<span>{installDetailsOpen ? "⌃" : "⌄"}</span></button>
              {installDetailsOpen ? <ol aria-live="polite">{installProgress.map((item, index) => <li key={`${item.stage}-${index}`}>
                <span className="plugin-manager-install-modal__step-mark"><WorkbenchIcon name={item.stage === "installed" || item.stage === "already-installed" ? "check" : "extension"} size={13} /></span>
                <div><strong>{installStageLabels[item.stage]}</strong><span>{item.message}</span>
                  {item.stage === "source-verified" ? <small>{item.fileCount ?? 0} 个文件 · {formatByteSize(item.totalBytes ?? 0)} · SHA-256 {item.archiveSha256?.slice(0, 16)}</small> : null}
                </div>
              </li>)}</ol> : null}
            </section> : null}
            <div className="plugin-manager-install-modal__actions">
              {installResult.state === "installed" && inspection?.canEnable ? <Button type="primary" loading={pendingPluginAction?.id === installResult.id && pendingPluginAction.action === "enable"} disabled={!canAdmin || operation !== null || pendingPluginAction !== null} onClick={() => void submitPluginAction(installResult, "enable", "workspace")}>立即启用</Button> : null}
              <Button onClick={closeInstaller}>完成</Button>
            </div>
          </> : <>
            {contributedInstall ? <p className="plugin-manager-install-modal__intro">此版本由插件扩展页指定；来源检查必须与该版本一致，安装前仍需核验固定内容和兼容性。</p> : null}
            <p className="plugin-manager-install-modal__intro">输入插件包名、GitHub 仓库地址或 LFAA Host 上的本机路径，系统会自动识别来源。</p>
            <div className="plugin-manager-install-modal__source-row">
              <Input
                autoFocus
                aria-label="插件包名、GitHub 地址或 Host 本机路径"
                placeholder={pluginSourceInputHint(detectedSourceType ?? (source.trim() ? sourceType : null))}
                value={source}
                disabled={operation !== null || pendingPluginAction !== null}
                maxLength={2048}
                onChange={event => { setSource(event.target.value); setContributedInstall(null); resetInspection(); }}
                onPressEnter={() => void inspectSource()}
              />
              <Tag color={detectedSourceType ? "blue" : undefined}>{detectedSourceType === "npm" ? "NPM 包" : detectedSourceType === "github" ? "GitHub 仓库" : detectedSourceType === "local" ? "Host 本机路径" : source.trim() ? "无法识别" : "自动识别"}</Tag>
            </div>
            {source.trim() && !detectedSourceType ? <Alert type="error" showIcon message="无法识别插件来源" description="请填写 npm 包名（如 dsh-plugin-whale-pet）、GitHub HTTPS 仓库地址，或 LFAA Host 上的本机绝对路径。" /> : null}
            {detectedSourceType === "github" ? <Input aria-label="GitHub 分支、标签或提交" placeholder="分支、标签或提交；留空使用默认分支" value={reference} disabled={operation !== null} maxLength={200} onChange={event => { setReference(event.target.value); resetInspection(); }} /> : null}
            <div className="plugin-manager-install-modal__guide-row">
              <button
                type="button"
                className="plugin-manager-install-modal__guide-toggle"
                aria-expanded={installGuideOpen}
                aria-controls="plugin-manager-install-guide"
                onClick={() => setInstallGuideOpen(open => !open)}
              >
                <span>{installGuideOpen ? "收起引导" : "插件安装引导和示例"}</span>
                <span aria-hidden="true">{installGuideOpen ? "⌃" : "⌄"}</span>
              </button>
              {activeSourceType === "npm" ? <div className="plugin-manager-install-modal__registry">
                <label htmlFor="plugin-manager-npm-registry">安装源</label>
                <Select
                  id="plugin-manager-npm-registry"
                  aria-label="NPM 安装源"
                  value={registryChoice}
                  disabled={operation !== null}
                  options={npmRegistryChoices.map(choice => ({ value: choice.value, label: choice.label }))}
                  onChange={(value: "china" | "official" | "custom") => { setRegistryChoice(value); resetInspection(); }}
                />
                {registryChoice === "custom" ? <Input aria-label="自定义 NPM registry URL" placeholder="https://registry.example.com/" value={customRegistry} disabled={operation !== null} maxLength={512} onChange={event => { setCustomRegistry(event.target.value); resetInspection(); }} /> : null}
                {registryChoice === "custom" ? <small>支持自定义 HTTP(S) registry；HTTP 不加密，需认证的源暂不支持，请勿在地址中填写 token 或密码。</small> : null}
              </div> : null}
            </div>
            <div id="plugin-manager-install-guide" className="plugin-manager-install-modal__guide-content" hidden={!installGuideOpen}>
              {activeSourceType === "npm" || !source.trim() ? <div className="plugin-manager-install-modal__example">
                <div><strong>填入插件 npm 包名</strong><span>npm 包名支持普通包、作用域包和版本后缀。社区插件 README 中 `dsh plugin add` 或 `pnpm add` 后面的内容也可以直接粘贴。</span><code>dsh-plugin-whale-pet</code></div>
                <Button disabled={operation !== null} onClick={() => { setSource("dsh-plugin-whale-pet"); setSourceType("npm"); setReference(""); resetInspection(); }}>填入示例</Button>
              </div> : null}
              <Alert
                className="plugin-manager-install-modal__warning"
                type="warning"
                showIcon
                message="请只安装你信任的插件来源。插件可能以 LFAA Host 的运行权限访问文件和网络。"
                description="来源检查会展示版本、完整性、兼容性和声明脚本；不会运行包内安装脚本。自定义 HTTP registry 未加密，认证型 registry 暂不支持。"
              />
            </div>
            {!installGuideOpen ? <Alert
              className="plugin-manager-install-modal__warning plugin-manager-install-modal__warning--summary"
              type="warning"
              showIcon
              message="请只安装你信任的插件来源。插件可能以 LFAA Host 的运行权限访问文件和网络。"
            /> : null}
            {installerError ? <Alert type="error" showIcon closable message={installerError} onClose={() => setInstallerError("")} /> : null}
            {inspection ? <article className="plugin-manager-install-modal__inspection" aria-label="插件来源检查结果">
              <div className="plugin-manager-install-modal__inspection-heading">
                <div><strong>{inspection.name}</strong><span>v{inspection.version} · {inspection.sourceType === "github" ? "GitHub 固定提交" : inspection.sourceType === "npm" ? "NPM SHA-512 完整性校验" : "Host 内容 SHA-256 快照"}</span></div>
                <Tag color={inspection.canEnable ? "green" : "orange"}>{inspection.canEnable ? "兼容 Runtime" : "安装后保持隔离"}</Tag>
              </div>
              <p>{inspection.description || "来源未提供说明。"}</p>
              <div className="plugin-manager-install-modal__inspection-meta"><span>固定内容：{inspection.resolvedRef}</span><span>SHA-256：{inspection.archiveSha256}</span><span>许可证：{inspection.license ?? "未确认"}</span></div>
              <div className="plugin-manager-install-modal__declared-scripts"><span>声明脚本（不会执行）</span><code>{inspection.requirements.declaredScripts.length ? inspection.requirements.declaredScripts.join(" · ") : "无"}</code></div>
              {inspection.runtimeReason ? <Alert type="warning" showIcon message={inspection.runtimeReason} /> : null}
            </article> : null}
            {installProgress.length ? <section className="plugin-manager-install-modal__progress" aria-label="实际安装步骤" role="status" aria-live="polite">
              <div className="plugin-manager-install-modal__progress-heading">{operation === "install" ? <><Spin size="small" />安装处理中</> : "安装步骤"}<button type="button" aria-expanded={installDetailsOpen} onClick={() => setInstallDetailsOpen(open => !open)}>{installDetailsOpen ? "收起详情" : "查看详情"}</button></div>
              {installDetailsOpen ? <ol>{installProgress.map((item, index) => <li key={`${item.stage}-${index}`}>
                <span className="plugin-manager-install-modal__step-mark"><WorkbenchIcon name={item.stage === "installed" || item.stage === "already-installed" ? "check" : "extension"} size={13} /></span>
                <div><strong>{installStageLabels[item.stage]}</strong><span>{item.message}</span>
                  {item.stage === "source-verified" ? <small>{item.fileCount ?? 0} 个文件 · {formatByteSize(item.totalBytes ?? 0)} · SHA-256 {item.archiveSha256?.slice(0, 16)}</small> : null}
                </div>
              </li>)}</ol> : null}
            </section> : null}
            <div className="plugin-manager-install-modal__actions">
              <span>{inspection && !inspection.canEnable ? "当前没有匹配的 LFAA Runtime；保存后仍会隔离，插件代码不会运行。" : "安装只登记并保存来源快照；启用由匹配的 Runtime 单独执行。"}</span>
              {inspection ? <Button type={inspection.canEnable ? "primary" : "default"} disabled={operation !== null || pendingPluginAction !== null} loading={operation === "install"} onClick={() => void submitInstall()}>{inspection.canEnable ? contributedInstall ? `安装 ${contributedInstall.title}` : "开始安装" : "保存隔离副本"}</Button> : <Button type="primary" disabled={!detectedSourceType || operation !== null || pendingPluginAction !== null || (detectedSourceType === "npm" && registryChoice === "custom" && !activeRegistry)} loading={operation === "inspect"} icon={<WorkbenchIcon name="search" size={15} />} onClick={() => void inspectSource()}>检查来源</Button>}
            </div>
          </>}
        </div>
      </Modal>
      <Modal
        className="plugin-manager-detail-modal"
        title={selectedPlugin ? `${selectedPlugin.name} · 插件详情与设置` : "插件详情与设置"}
        open={selectedPlugin !== null}
        centered
        width="min(760px, calc(100vw - 28px))"
        footer={null}
        getContainer={() => (document.querySelector(".plugin-manager-stage")?.closest(".workbench-shell") as HTMLElement | null) ?? document.body}
        onCancel={() => setSelectedPluginDetailsId(null)}
      >
        {selectedPlugin && selectedPluginSubject ? <div className="plugin-manager-detail-modal__body">
          <header className="plugin-manager-detail-modal__heading">
            <div><strong>{selectedPlugin.name}</strong><span>v{selectedPlugin.version} · {pluginStateLabel(selectedPlugin.state)} · {pluginCompatibilityLabel(selectedPlugin.compatibility)}</span></div>
            <div className="plugin-manager-detail-modal__badges"><PluginExtensionSlot name="plugins.detail.badge" owner={{ subject: selectedPluginSubject } satisfies PluginDetailOwner} /></div>
          </header>
          <p>{selectedPlugin.description || "此插件未提供说明。"}</p>
          {selectedPlugin.reason ? <Alert type="warning" showIcon message={selectedPlugin.reason} /> : null}
          <div className="plugin-manager-detail-modal__actions"><PluginExtensionSlot name="plugins.detail.actions" owner={{ subject: selectedPluginSubject } satisfies PluginDetailOwner} /></div>
          {bundleConfigEntries.some(entry => entry.key === selectedPlugin.name) ? <section className="plugin-manager-detail-modal__section" aria-label="插件包配置">
            <h3>插件包配置</h3>
            <p className="plugin-manager-detail-modal__contract-note">LFAA 呈现扩展提供的页面，但不伪造 DSH Host ConfigForm；需要该表单的数据由扩展自己的受支持设置 Owner 提供。</p>
            <PluginExtensionSlot name="plugins.bundle.config" entryKey={selectedPlugin.name} owner={{ view: "page" } satisfies PluginConfigOwner} fallback={<Alert type="info" showIcon message="扩展已登记，但配置内容未加载。" />} />
          </section> : null}
          {selectedPluginRowConfigs.length ? <section className="plugin-manager-detail-modal__section" aria-label="插件能力配置">
            <h3>插件能力配置</h3>
            <div className="plugin-manager-page__contributed-list">{selectedPluginRowConfigs.map(entry => {
              const key = entry.key ?? "";
              const rowLabel = key.slice(rowConfigPrefix(selectedPlugin.name).length);
              return <article key={key} className="plugin-manager-page__contributed-card"><div><strong>{rowLabel}</strong><p>{key}</p></div><Button onClick={() => setSelectedRowConfigKey(key)}>设置</Button></article>;
            })}</div>
          </section> : null}
          <section className="plugin-manager-detail-modal__section" aria-label="来源与固定版本">
            <h3>来源与固定版本</h3>
            <dl><div><dt>来源</dt><dd>{pluginSourceLabel(selectedPlugin)} · {selectedPlugin.source.repository}</dd></div><div><dt>固定版本</dt><dd>{selectedPlugin.source.commit}</dd></div><div><dt>SHA-256</dt><dd>{selectedPlugin.source.archiveSha256}</dd></div></dl>
          </section>
          <PluginExtensionSlot name="plugins.detail.section" owner={{ subject: selectedPluginSubject } satisfies PluginDetailOwner} />
        </div> : null}
      </Modal>
      <Modal
        className="plugin-manager-detail-modal"
        title={selectedConfigItem ? `${selectedConfigItem.label ?? selectedConfigItem.id} · 设置` : "插件设置"}
        open={selectedConfigItem !== null}
        centered
        width="min(760px, calc(100vw - 28px))"
        footer={null}
        getContainer={() => (document.querySelector(".plugin-manager-stage")?.closest(".workbench-shell") as HTMLElement | null) ?? document.body}
        onCancel={() => setSelectedPluginItemId(null)}
      >
        {selectedConfigItem ? <div className="plugin-manager-detail-modal__body">
          <div className="plugin-manager-detail-modal__badges"><PluginExtensionSlot name="plugins.detail.badge" owner={{ subject: { kind: "item", id: selectedConfigItem.id } } satisfies PluginDetailOwner} /></div>
          <p><PluginExtensionSlot name="plugins.item" only={selectedConfigItem.id} owner={{ view: "summary" } satisfies PluginConfigOwner} fallback="此扩展尚未提供摘要。" /></p>
          <p className="plugin-manager-detail-modal__contract-note">设置页由插件提供。LFAA 不代造 DSH Host ConfigForm；只有扩展接入自己的设置 Owner 时，页面更改才可保存。</p>
          <div className="plugin-manager-detail-modal__actions"><PluginExtensionSlot name="plugins.detail.actions" owner={{ subject: { kind: "item", id: selectedConfigItem.id } } satisfies PluginDetailOwner} /></div>
          <section className="plugin-manager-detail-modal__section" aria-label="插件设置表单"><PluginExtensionSlot name="plugins.item" only={selectedConfigItem.id} owner={{ view: "page" } satisfies PluginConfigOwner} fallback={<Alert type="info" showIcon message="扩展已登记，但设置页面内容未加载。" />} /></section>
          <PluginExtensionSlot name="plugins.detail.section" owner={{ subject: { kind: "item", id: selectedConfigItem.id } } satisfies PluginDetailOwner} />
        </div> : null}
      </Modal>
      <Modal
        className="plugin-manager-detail-modal"
        title={selectedBundleConfig ? `${selectedBundleConfig.key} · 配置` : "插件包配置"}
        open={selectedBundleConfig !== null}
        centered
        width="min(760px, calc(100vw - 28px))"
        footer={null}
        getContainer={() => (document.querySelector(".plugin-manager-stage")?.closest(".workbench-shell") as HTMLElement | null) ?? document.body}
        onCancel={() => setSelectedBundleConfigKey(null)}
      >
        {selectedBundleConfig ? <div className="plugin-manager-detail-modal__body"><p className="plugin-manager-detail-modal__contract-note">设置面板由扩展渲染；LFAA 不提供 DSH Host ConfigForm 或代写插件设置数据。</p><PluginExtensionSlot name="plugins.bundle.config" entryKey={selectedBundleConfig.key} owner={{ view: "page" } satisfies PluginConfigOwner} fallback={<Alert type="info" showIcon message="扩展配置内容未加载。" />} /></div> : null}
      </Modal>
      <Modal
        className="plugin-manager-detail-modal"
        title={selectedRowConfig ? `${selectedRowConfig.key} · 配置` : "插件能力配置"}
        open={selectedRowConfig !== null}
        centered
        width="min(760px, calc(100vw - 28px))"
        footer={null}
        getContainer={() => (document.querySelector(".plugin-manager-stage")?.closest(".workbench-shell") as HTMLElement | null) ?? document.body}
        onCancel={() => setSelectedRowConfigKey(null)}
      >
        {selectedRowConfig ? <div className="plugin-manager-detail-modal__body"><p className="plugin-manager-detail-modal__contract-note">设置面板由扩展渲染；LFAA 不提供 DSH Host ConfigForm 或代写插件设置数据。</p><PluginExtensionSlot name="plugins.row.config" entryKey={selectedRowConfig.key} owner={{ view: "page" } satisfies PluginConfigOwner} fallback={<Alert type="info" showIcon message="扩展配置内容未加载。" />} /></div> : null}
      </Modal>
      <Modal
        className="plugin-manager-detail-modal"
        title={activationPlugin ? `${activationPlugin.name} · 启用引导` : "插件启用引导"}
        open={activationPlugin !== null}
        centered
        width="min(620px, calc(100vw - 28px))"
        footer={null}
        getContainer={() => (document.querySelector(".plugin-manager-stage")?.closest(".workbench-shell") as HTMLElement | null) ?? document.body}
        onCancel={() => setActivationPlugin(null)}
      >
        {activationPlugin ? <div className="plugin-manager-detail-modal__body"><PluginExtensionSlot name="plugins.bundle.activation" entryKey={activationPlugin.name} owner={{
          packageName: activationPlugin.name,
          onDismiss: () => setActivationPlugin(null),
          onOpenDetails: () => { setActivationPlugin(null); setSelectedPluginDetailsId(activationPlugin.id); }
        } satisfies PluginActivationOwner} fallback={<Alert type="info" showIcon message="插件已启用，当前没有提供启用引导内容。" />} /></div> : null}
      </Modal>
    </div>
  );
}

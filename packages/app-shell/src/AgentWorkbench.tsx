/**
 * 文件：AgentWorkbench.tsx
 * 作用：LFAA 共享工作台壳，把左栏、中间工作区、右栏和底部终端组织成一个可交互页面。
 * 负责：工作台壳状态、主题状态、左右栏开合、终端开合、左栏 Hover 预览、快捷键、各区域内容编排。
 * 不负责：分隔条拖拽算法、PTY 创建、Vite 资源扫描、Agent 业务执行。
 * 状态归属：本文件拥有 Shell UI 状态，并把 leftPaneWidth 作为工作台 / Settings / Profile 共用的唯一左栏宽度事实源；具体拖拽算法仍由 ResizableWorkbench 负责。
 * 对外接口：AgentWorkbench(props)。
 * 关联文件：agent-workbench.css、workbench.types.ts、@lfaa/ui/ResizableWorkbench、apps/web/src/App.tsx。
 * 修改注意事项：框架级开合状态只保留一个 Owner；布局拖拽交给 @lfaa/ui；Web 专有桥接不能写入共享 App Shell。
 *
 * 页面结构（v0.0.49）：
 * AgentWorkbench
 * └─ agent-workbench-stage                  整个可缩放工作区
 *    ├─ agent-left-hover-preview            左栏收起后的 Hover 临时预览层
 *    └─ ResizableWorkbench
 *       ├─ LeftSidebar                      左侧导航 / 项目 / 最近任务
 *       ├─ CenterWorkspace                  中间区
 *       │  ├─ agent-center-header           中间区顶部工具栏
 *       │  │  ├─ 左栏按钮 + Web 工作台标题
 *       │  │  └─ 更多 / 分享 /（右栏收起时）终端 + 右栏按钮
 *       │  ├─ agent-conversation            主内容
 *       │  └─ agent-composer-wrap           输入框
 *       ├─ RightSidebar                     右侧区
 *       │  ├─ agent-right-shell-header      右栏展开时承载终端 + 右栏按钮
 *       │  └─ agent-right-body              工具与资源正文
 *       └─ BottomTerminal                   底部终端外壳
 *
 * 关键布局原则：
 * - Shell 按钮属于“区域 Header”，不是正文上方的绝对定位悬浮物。
 * - Desktop：右栏展开时，终端/右栏按钮进入右栏 Header；右栏收起时，按钮回到中间 Header 右侧。
 * - Compact/Mobile：右栏变覆盖式抽屉，Shell 按钮始终留在中间 Header，保证小屏也能看见关闭入口。
 * - 响应式由 ResizeObserver + 统一布局计算器决定，不能用固定 viewport 断点硬挤三栏。
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { AGENT_PERMISSION_PROFILES, type AgentModelBinding, type AgentPermissionProfileId, type AgentRunHandle, type AgentSurfaceMode } from "@lfaa/agent-runtime";
import {
  InfiniteCanvas,
  ResizableWorkbench,
  SettingsPage,
  ThemeModeMenu,
  UserMenu,
  resolveWorkbenchLayoutMetrics,
  type AiSettingsAccountView,
  type AiSettingsDraftInput,
  type AiSettingsProbeView,
  type AiSettingsProviderView,
  type SettingsSectionId,
  type PluginSettingsInstalledView,
  type PluginSettingsInspectionView,
  type PluginSettingsInstallResultView,
  type ThemePreference,
  type InfiniteCanvasEdge,
  type InfiniteCanvasNode,
  type WorkbenchLayoutMetrics,
  type WorkbenchLayoutMode,
} from "@lfaa/ui";
import { builtinAiProviderPlugins, type AiAccountDraft, type AiAccountHostCapabilities, type AiAccountProbeResult, type AiAccountRecord, type AiAccountSnapshot } from "@lfaa/config-system";
import type { InstalledPluginBundle, PluginInstallOutcome, PluginManagerSnapshot, PluginSpecInspection } from "@lfaa/plugin-runtime";
import { WorkbenchIcon } from "./WorkbenchIcon";
import type { AgentWorkbenchProps, DevResourceItem, ResourceKind } from "./workbench.types";
import "./agent-workbench.css";

// ===== 1. Workbench 响应式几何与持久化 Key =====
// 几何尺寸不再在 App Shell 写死 280 / 360 之类固定值。
// 所有比例、上下限和 Mode 计算集中在 @lfaa/ui/workbench-layout.config.ts。
const THEME_KEY = "lfaa.workbench.theme.v1";
const CHROME_KEY = "lfaa.workbench.chrome.v2";
const LEFT_PANE_WIDTH_KEY = "lfaa.shell.left-pane-width.v1";
const LEGACY_WORKBENCH_LAYOUT_KEY = "lfaa.workbench.layout.v5";
const AGENT_SURFACE_KEY = "lfaa.agent.surface.v1";
const AGENT_PERMISSION_KEY = "lfaa.agent.permission-profile.v1";

type ResolvedTheme = "light" | "dark";
type LayoutMode = WorkbenchLayoutMode;
interface ChromeState { leftCollapsed: boolean; rightCollapsed: boolean; terminalOpen: boolean; }
const recentRuns = ["配置系统", "Web 工作台", "热插拔测试", "模型接入规划"];
const resourceLabels: Record<ResourceKind, string> = { skills: "Skills", experts: "Experts", plugins: "Plugins", extensions: "Extensions", mcp: "MCP" };

const INITIAL_WORK_NODES: readonly InfiniteCanvasNode[] = [
  { id: "goal", kind: "goal", title: "一句话目标", description: "用户目标进入同一个 Agent Runtime。", status: "idle", x: 40, y: 70 },
  { id: "agent", kind: "agent", title: "主智能体", description: "使用当前配置模型推理、规划并调度能力。", status: "idle", x: 370, y: 70 },
  { id: "tools", kind: "tool", title: "Tools / Skills", description: "工具、技能、专家、命令与 MCP 按需装配。", status: "idle", x: 700, y: -20 },
  { id: "subagent", kind: "agent", title: "子智能体", description: "按 Harness Provider 委派并行任务。", status: "idle", x: 700, y: 150 },
  { id: "result", kind: "artifact", title: "最终产物", description: "文件、代码、报告与可验证结果回到同一 Run。", status: "idle", x: 1030, y: 70 },
];

const INITIAL_WORK_EDGES: readonly InfiniteCanvasEdge[] = [
  { id: "goal-agent", from: "goal", to: "agent" },
  { id: "agent-tools", from: "agent", to: "tools" },
  { id: "agent-subagent", from: "agent", to: "subagent" },
  { id: "tools-result", from: "tools", to: "result" },
  { id: "subagent-result", from: "subagent", to: "result" },
];

// Config System 拥有 Provider 业务事实；App Shell 只把业务描述投影为 UI ViewModel。
// 认证是否可用由 Auth Method 声明的 hostCapability + Host Snapshot 决定，不按 Provider/认证类型写死。
function buildAiProviderViews(hostCapabilities: AiAccountHostCapabilities): readonly AiSettingsProviderView[] {
  return builtinAiProviderPlugins.map((plugin) => ({
    id: plugin.id,
    name: plugin.displayName,
    description: plugin.description,
    authMethods: plugin.authMethods.map((auth) => {
      const capability = auth.hostCapability ? hostCapabilities[auth.hostCapability] : undefined;
      const available = auth.hostCapability ? capability?.available === true : true;
      return {
        id: auth.id,
        label: auth.label,
        kind: auth.kind,
        ...(auth.description ? { description: auth.description } : {}),
        ...(auth.secretLabel ? { secretLabel: auth.secretLabel } : {}),
        available,
        ...(!available && auth.hostCapability ? { unavailableReason: capability?.reason ?? `当前宿主缺少 ${auth.hostCapability} 能力。` } : {}),
      };
    }),
    fields: plugin.configFields.map((field) => ({
      id: field.id,
      label: field.label,
      kind: field.kind,
      required: field.required,
      ...(field.defaultValue !== undefined ? { defaultValue: field.defaultValue } : {}),
      ...(field.placeholder !== undefined ? { placeholder: field.placeholder } : {}),
      ...(field.options !== undefined ? { options: field.options } : {}),
      ...(field.help !== undefined ? { help: field.help } : {}),
    })),
  }));
}

function mapAiAccount(record: AiAccountRecord): AiSettingsAccountView {
  return {
    id: record.id,
    providerId: record.providerId,
    displayName: record.displayName,
    authMethodId: record.authMethodId,
    selectedModelId: record.selectedModelId,
    modelSettings: record.modelSettings,
    modelCatalog: record.modelCatalog,
    verificationStatus: record.verificationStatus,
    lastVerifiedAt: record.lastVerifiedAt,
  };
}

function mapAiProbe(probe: AiAccountProbeResult): AiSettingsProbeView {
  return {
    status: probe.status,
    message: probe.message,
    models: probe.models,
    ...(probe.manualModelEntry === true ? { manualModelEntry: true } : {}),
    ...(probe.resolvedBaseUrl ? { resolvedBaseUrl: probe.resolvedBaseUrl } : {}),
  };
}

function formatReasoningEffort(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const labels: Readonly<Record<string, string>> = {
    none: "关", disabled: "关", enabled: "开", low: "低", medium: "中", high: "高", xhigh: "极高", max: "最大",
  };
  return labels[value] ?? value;
}

function toAiAccountDraft(draft: AiSettingsDraftInput): AiAccountDraft {
  return {
    ...(draft.accountId ? { accountId: draft.accountId } : {}),
    providerId: draft.providerId as AiAccountDraft["providerId"],
    displayName: draft.displayName,
    authMethodId: draft.authMethodId,
    settings: draft.settings,
    selectedModelId: draft.selectedModelId ?? null,
    modelSettings: draft.modelSettings ?? {},
  };
}

function mapInstalledPlugin(bundle: InstalledPluginBundle): PluginSettingsInstalledView {
  return {
    packageName: bundle.packageName,
    packageVersion: bundle.packageVersion,
    pluginId: bundle.manifest.pluginId,
    displayName: bundle.manifest.displayName,
    ...(bundle.manifest.description ? { description: bundle.manifest.description } : {}),
    enabled: bundle.enabled,
    capabilities: bundle.manifest.capabilities.map((capability) => ({ id: capability.id, kind: capability.kind, displayName: capability.displayName })),
    credentials: (bundle.manifest.credentials ?? []).map((credential) => ({ id: credential.id, displayName: credential.displayName, exposure: credential.exposure })),
  };
}

function mapPluginInspection(inspection: PluginSpecInspection): PluginSettingsInspectionView {
  if (inspection.status === "refused") return { status: "refused", spec: inspection.spec, reason: inspection.reason };
  const permissions = [...new Set(inspection.manifest.capabilities.flatMap((capability) => capability.permissions?.map((item) => item.scope ? `${item.capability}:${item.scope}` : item.capability) ?? []))];
  return {
    status: "accepted",
    sourceKind: inspection.sourceKind,
    spec: inspection.spec,
    packageName: inspection.packageName,
    packageVersion: inspection.packageVersion,
    pluginId: inspection.manifest.pluginId,
    pluginApiVersion: inspection.manifest.pluginApiVersion,
    displayName: inspection.manifest.displayName,
    ...(inspection.description || inspection.manifest.description ? { description: inspection.description ?? inspection.manifest.description } : {}),
    enabled: false,
    permissions,
    capabilities: inspection.manifest.capabilities.map((capability) => ({ id: capability.id, kind: capability.kind, displayName: capability.displayName })),
    credentials: (inspection.manifest.credentials ?? []).map((credential) => ({ id: credential.id, displayName: credential.displayName, exposure: credential.exposure })),
  };
}

function mapPluginInstallOutcome(outcome: PluginInstallOutcome): PluginSettingsInstallResultView {
  return {
    status: outcome.status,
    ...(outcome.bundle ? { packageName: outcome.bundle.packageName, bundleDisplayName: outcome.bundle.manifest.displayName } : {}),
    ...(outcome.failureKind ? { failureKind: outcome.failureKind } : {}),
    ...(outcome.diagnostic ? { diagnostic: outcome.diagnostic } : {}),
    ...(outcome.pendingBuilds?.length ? { pendingBuilds: outcome.pendingBuilds } : {}),
  };
}


function initialLayoutMetrics(): WorkbenchLayoutMetrics {
  if (typeof window === "undefined") return resolveWorkbenchLayoutMetrics(1440, 900);
  return resolveWorkbenchLayoutMetrics(window.innerWidth, window.innerHeight);
}

// 以“工作台容器”而不是整个 window 为响应式依据。
// ResizeObserver 可以正确处理浏览器小窗、桌面宿主、未来嵌入式容器和 DevTools 占宽。
function useWorkbenchLayoutMetrics(containerRef: RefObject<HTMLDivElement | null>): WorkbenchLayoutMetrics {
  const [metrics, setMetrics] = useState<WorkbenchLayoutMetrics>(initialLayoutMetrics);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let frame: number | null = null;
    const update = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const rect = element.getBoundingClientRect();
        const next = resolveWorkbenchLayoutMetrics(rect.width, rect.height);
        setMetrics((current) => {
          const same = current.mode === next.mode
            && current.containerWidth === next.containerWidth
            && current.containerHeight === next.containerHeight
            && current.left.min === next.left.min
            && current.left.initial === next.left.initial
            && current.right.min === next.right.min
            && current.right.initial === next.right.initial
            && current.bottom.min === next.bottom.min
            && current.bottom.initial === next.bottom.initial
            && current.minCenterWidth === next.minCenterWidth
            && current.snapHysteresis === next.snapHysteresis;
          return same ? current : next;
        });
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [containerRef]);

  return metrics;
}

// ===== 2. 本地初始状态 =====
// Theme 和 Chrome 只读取浏览器 localStorage，不参与业务配置系统。
function initialThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "system" || stored === "light" || stored === "dark") return stored;
  return "system";
}

function initialSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function initialLeftPaneWidth(limits: WorkbenchLayoutMetrics["left"]): number {
  const clampWidth = (value: number) => Math.min(limits.max, Math.max(limits.min, value));
  if (typeof window === "undefined") return limits.initial;

  const shared = Number(window.localStorage.getItem(LEFT_PANE_WIDTH_KEY));
  if (Number.isFinite(shared) && shared > 0) return clampWidth(shared);

  // v0.0.70 及更早版本由 ResizableWorkbench 把宽度放在工作台布局记录里；
  // 首次升级时只迁移一次，之后统一使用 Shell 级共享宽度键。
  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_WORKBENCH_LAYOUT_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as { leftWidth?: unknown };
      const legacyWidth = Number(legacy.leftWidth);
      if (Number.isFinite(legacyWidth) && legacyWidth > 0) return clampWidth(legacyWidth);
    }
  } catch {
    // 历史布局损坏时回退当前响应式 initial，不阻断应用。
  }
  return limits.initial;
}

function initialAgentSurface(): AgentSurfaceMode {
  if (typeof window === "undefined") return "chat";
  return window.localStorage.getItem(AGENT_SURFACE_KEY) === "work" ? "work" : "chat";
}

function initialPermissionProfile(): AgentPermissionProfileId {
  if (typeof window === "undefined") return "ask";
  const stored = window.localStorage.getItem(AGENT_PERMISSION_KEY);
  return stored === "approve-for-me" || stored === "full-access" ? stored : "ask";
}

function initialChrome(mode: LayoutMode): ChromeState {
  if (typeof window === "undefined") return mode === "mobile"
    ? { leftCollapsed: true, rightCollapsed: true, terminalOpen: false }
    : mode === "compact"
      ? { leftCollapsed: false, rightCollapsed: true, terminalOpen: true }
      : { leftCollapsed: false, rightCollapsed: false, terminalOpen: true };
  try {
    const raw = window.localStorage.getItem(CHROME_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Partial<ChromeState>;
    const restored = {
      leftCollapsed: Boolean(parsed.leftCollapsed),
      rightCollapsed: Boolean(parsed.rightCollapsed),
      terminalOpen: parsed.terminalOpen === undefined ? true : Boolean(parsed.terminalOpen),
    };
    if (mode === "mobile") return { ...restored, leftCollapsed: true, rightCollapsed: true, terminalOpen: false };
    if (mode === "compact") return { ...restored, rightCollapsed: true };
    return restored;
  } catch {
    if (mode === "mobile") return { leftCollapsed: true, rightCollapsed: true, terminalOpen: false };
    if (mode === "compact") return { leftCollapsed: false, rightCollapsed: true, terminalOpen: true };
    return { leftCollapsed: false, rightCollapsed: false, terminalOpen: true };
  }
}


// ===== 3. Shell Header 按钮 =====
// 所有框架级按钮共用同一视觉与 Tooltip 结构，避免三处分别维护提示文案样式。
function ShellHeaderButton({
  label,
  shortcut,
  active = false,
  expanded,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  tooltipAlign = "center",
  children,
}: {
  label: string;
  shortcut: string;
  active?: boolean;
  expanded?: boolean;
  tooltipAlign?: "start" | "center" | "end";
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  children: ReactNode;
}) {
  // 只保留自定义 Tooltip。不要再加 title，否则浏览器原生 Tooltip 会与自定义提示叠成两层。
  return (
    <button
      className={`agent-shell-button${active ? " is-active" : ""}`}
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label={`${label}，快捷键 ${shortcut}`}
      aria-expanded={expanded}
    >
      {children}
      <span className={`agent-shell-tooltip agent-shell-tooltip--${tooltipAlign}`} role="presentation">
        <span>{label}</span>
        <kbd>{shortcut}</kbd>
      </span>
    </button>
  );
}

// 右侧 Shell Actions 在“右栏展开”和“右栏收起”两种布局里复用。
function RightShellActions({
  terminalOpen,
  rightCollapsed,
  onToggleTerminal,
  onToggleRight,
}: {
  terminalOpen: boolean;
  rightCollapsed: boolean;
  onToggleTerminal: () => void;
  onToggleRight: () => void;
}) {
  return (
    <div className="agent-shell-actions" aria-label="工作台面板控制">
      <ShellHeaderButton
        label="切换底部面板显示"
        shortcut="Ctrl+J"
        active={terminalOpen}
        expanded={terminalOpen}
        onClick={onToggleTerminal}
        tooltipAlign="end"
      >
        <WorkbenchIcon name="terminal" size={16} />
      </ShellHeaderButton>
      <ShellHeaderButton
        label="显示/隐藏侧边面板"
        shortcut="Ctrl+Alt+B"
        expanded={!rightCollapsed}
        onClick={onToggleRight}
        tooltipAlign="end"
      >
        <WorkbenchIcon name="panelRight" size={16} />
      </ShellHeaderButton>
    </div>
  );
}

// ===== 4. 左侧栏内容 =====
// ProfileBar 同时用于正常左栏与个人中心聚焦层。
// 聚焦层复用同一组件，避免为了“保持清晰”复制一套不同尺寸/按钮的 Footer。
function ProfileBar({
  resolvedTheme,
  themePreference,
  onOpenProfile,
  onOpenThemeMenu,
  onRequestUpdate,
}: {
  resolvedTheme: ResolvedTheme;
  themePreference: ThemePreference;
  onOpenProfile: () => void;
  onOpenThemeMenu: () => void;
  onRequestUpdate: () => void;
}) {
  const themeLabel = themePreference === "system" ? "跟随系统" : themePreference === "dark" ? "深色" : "浅色";
  const themeIcon = themePreference === "system" ? "monitor" : resolvedTheme === "dark" ? "moon" : "sun";

  return (
    <div className="agent-profile">
      <button className="agent-profile-main" type="button" onClick={onOpenProfile} aria-haspopup="dialog">
        <span className="agent-avatar">二</span>
        <span><strong>二鱼</strong><small>本地工作区</small></span>
      </button>
      <div className="agent-profile-actions">
        <button className="agent-icon-button" type="button" onClick={onRequestUpdate} aria-label="检查更新" title="检查更新"><WorkbenchIcon name="refresh" /></button>
        <button className="agent-icon-button" type="button" onClick={onOpenThemeMenu} aria-label={`主题：${themeLabel}`} title={`主题：${themeLabel}`}><WorkbenchIcon name={themeIcon} /></button>
      </div>
    </div>
  );
}

// 这里只描述左栏“里面有什么”；左栏宽度和收起逻辑不在这里实现。
function LeftSidebar({
  resolvedTheme,
  themePreference,
  agentSurface,
  onAgentSurfaceChange,
  onOpenProfile,
  onOpenThemeMenu,
  onRequestUpdate,
}: {
  resolvedTheme: ResolvedTheme;
  themePreference: ThemePreference;
  agentSurface: AgentSurfaceMode;
  onAgentSurfaceChange: (surface: AgentSurfaceMode) => void;
  onOpenProfile: () => void;
  onOpenThemeMenu: () => void;
  onRequestUpdate: () => void;
}) {
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);

  return (
    <aside className="agent-side agent-side--left">
      <div className="agent-brand-row">
        <div className="agent-brand-switcher">
          <button className="agent-brand" type="button" aria-label="切换聊天或工作" aria-expanded={brandMenuOpen} onClick={() => setBrandMenuOpen((value) => !value)}>
            <span className="agent-brand__mark">L</span><strong>LFAA</strong><WorkbenchIcon name="chevron" size={15} />
          </button>
          {brandMenuOpen ? (
            <div className="agent-brand-menu" role="menu" aria-label="LFAA 模式">
              <button className={agentSurface === "chat" ? "is-active" : ""} type="button" role="menuitem" onClick={() => { onAgentSurfaceChange("chat"); setBrandMenuOpen(false); }}>
                <span><WorkbenchIcon name="spark" size={17} /><strong>聊天</strong></span><small>一句话直接完成任务</small>
              </button>
              <button className={agentSurface === "work" ? "is-active" : ""} type="button" role="menuitem" onClick={() => { onAgentSurfaceChange("work"); setBrandMenuOpen(false); }}>
                <span><WorkbenchIcon name="grid" size={17} /><strong>工作</strong></span><small>无限画布组织和执行任务</small>
              </button>
            </div>
          ) : null}
        </div>
        <div className="agent-brand-actions">
          <button className="agent-icon-button" type="button" aria-label="搜索"><WorkbenchIcon name="search" /></button>
        </div>
      </div>

      <button className="agent-new-task" type="button"><WorkbenchIcon name="new" />新建任务<span>⌘ K</span></button>
      <nav className="agent-nav" aria-label="主导航">
        <button type="button"><WorkbenchIcon name="tools" />工具与技能</button>
        <button type="button"><WorkbenchIcon name="archive" />知识库</button>
      </nav>
      <div className="agent-section-title"><span>项目</span><button type="button" aria-label="新建项目"><WorkbenchIcon name="plus" size={15} /></button></div>
      <div className="agent-projects"><button type="button"><WorkbenchIcon name="folder" />lfaa</button></div>
      <div className="agent-section-title agent-section-title--recent"><span>最近</span></div>
      <div className="agent-history">{recentRuns.map((item, index) => <button type="button" key={item} className={index === 1 ? "is-current" : ""}>{item}</button>)}</div>

      <ProfileBar
        resolvedTheme={resolvedTheme}
        themePreference={themePreference}
        onOpenProfile={onOpenProfile}
        onOpenThemeMenu={onOpenThemeMenu}
        onRequestUpdate={onRequestUpdate}
      />
    </aside>
  );
}


// ===== 5. 中间主工作区 =====
// Header 是中间区的第一行，Shell Actions 不再 position:absolute 漂在正文上方。
// 右栏收起时，RightShellActions 回到中间 Header；右栏展开时则交给 RightSidebar Header。
function CenterWorkspace({
  layoutMode,
  leftCollapsed,
  rightCollapsed,
  terminalOpen,
  agentSurface,
  permissionProfileId,
  modelLabel,
  runtimeConnected,
  workNodes,
  onWorkNodesChange,
  onPermissionProfileChange,
  onSubmitTask,
  onOpenAiSettings,
  onToggleLeft,
  onToggleRight,
  onToggleTerminal,
  onLeftHoverEnter,
  onLeftHoverLeave,
}: {
  layoutMode: LayoutMode;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  terminalOpen: boolean;
  agentSurface: AgentSurfaceMode;
  permissionProfileId: AgentPermissionProfileId;
  modelLabel: string;
  runtimeConnected: boolean;
  workNodes: readonly InfiniteCanvasNode[];
  onWorkNodesChange: (nodes: readonly InfiniteCanvasNode[]) => void;
  onPermissionProfileChange: (profileId: AgentPermissionProfileId) => void;
  onSubmitTask: (input: string) => Promise<AgentRunHandle>;
  onOpenAiSettings: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleTerminal: () => void;
  onLeftHoverEnter: () => void;
  onLeftHoverLeave: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [runNotice, setRunNotice] = useState<string | null>(null);
  const [permissionMenuOpen, setPermissionMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const submitTask = async () => {
    const input = draft.trim();
    if (!input || !runtimeConnected || modelLabel === "未配置模型" || submitting) return;
    setSubmitting(true);
    setRunNotice(null);
    try {
      const handle = await onSubmitTask(input);
      setDraft("");
      setRunNotice(`Run 已启动 · ${handle.runId}`);
    } catch (error) {
      setRunNotice(error instanceof Error ? error.message : "Runtime 启动失败。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="agent-center" data-agent-surface={agentSurface}>
      <header className="agent-center-header">
        <div className="agent-center-header__left">
          <ShellHeaderButton
            label="切换侧边栏"
            shortcut="Ctrl+B"
            expanded={!leftCollapsed}
            onClick={onToggleLeft}
            onMouseEnter={onLeftHoverEnter}
            onMouseLeave={onLeftHoverLeave}
            onFocus={onLeftHoverEnter}
            onBlur={onLeftHoverLeave}
            tooltipAlign="start"
          >
            <WorkbenchIcon name="panelLeft" size={16} />
          </ShellHeaderButton>
          <div className="agent-center-header__title"><WorkbenchIcon name="folder" size={16} /><strong>{agentSurface === "chat" ? "聊天" : "工作"}</strong></div>
        </div>

        <div className="agent-center-header__right">
          <span className={`agent-runtime-state${runtimeConnected ? " is-connected" : ""}`}>{runtimeConnected ? "Runtime 已连接" : "Runtime 未连接"}</span>
          <button className="agent-icon-button" type="button" aria-label="更多" title="更多"><WorkbenchIcon name="dots" size={16} /></button>
          <button className="agent-ghost-button" type="button">分享</button>
          {rightCollapsed || layoutMode !== "desktop" ? (
            <>
              <span className="agent-header-divider" aria-hidden="true" />
              <RightShellActions
                terminalOpen={terminalOpen}
                rightCollapsed={rightCollapsed}
                onToggleTerminal={onToggleTerminal}
                onToggleRight={onToggleRight}
              />
            </>
          ) : null}
        </div>
      </header>

      {agentSurface === "chat" ? (
        <div className="agent-conversation">
          <div className="agent-conversation-inner">
            <article className="agent-answer agent-answer--welcome">
              <h1>聊天</h1>
              <p>直接说你想完成什么。模型、Skills、Experts、Tools、MCP、Subagents 与权限都由同一个 Agent Runtime 统一调度。</p>
            </article>
          </div>
        </div>
      ) : (
        <div className="agent-work-surface">
          <div className="agent-work-surface__title"><strong>工作</strong><span>无限画布</span></div>
          <InfiniteCanvas nodes={workNodes} edges={INITIAL_WORK_EDGES} onNodesChange={onWorkNodesChange} />
        </div>
      )}

      <div className="agent-composer-wrap">
        <div className="agent-composer">
          <textarea aria-label="输入任务" placeholder={agentSurface === "chat" ? "一句话交代任务" : "描述目标，Runtime 会把执行过程投影到画布"} rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitTask(); } }} />
          <div className="agent-composer-actions">
            <div className="agent-composer-menu-anchor">
              <button className="agent-composer-icon" type="button" aria-label="添加能力或附件" aria-expanded={addMenuOpen} onClick={() => { setAddMenuOpen((value) => !value); setPermissionMenuOpen(false); }}><WorkbenchIcon name="plus" /></button>
              {addMenuOpen ? (
                <div className="agent-composer-popover agent-composer-popover--add" role="menu">
                  {[
                    ["file", "文件", "把文件加入当前任务上下文"],
                    ["folder", "文件夹", "选择工作区资源"],
                    ["tools", "工具与技能", "从 Capability Registry 按需装配"],
                    ["browser", "浏览器", "使用浏览器能力完成任务"],
                  ].map(([icon, label, description]) => (
                    <button key={label} type="button" role="menuitem" onClick={() => { setAddMenuOpen(false); setRunNotice(`${label}入口已就绪；实际能力由 Runtime/Host 提供。`); }}>
                      <WorkbenchIcon name={icon as "file" | "folder" | "tools" | "browser"} size={17} /><span><strong>{label}</strong><small>{description}</small></span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="agent-composer-menu-anchor">
              <button className="agent-permission-button" data-permission-profile={permissionProfileId} type="button" aria-label="权限模式" aria-expanded={permissionMenuOpen} onClick={() => { setPermissionMenuOpen((value) => !value); setAddMenuOpen(false); }}>
                <WorkbenchIcon name={permissionProfileId === "full-access" ? "shield" : permissionProfileId === "approve-for-me" ? "spark" : "review"} size={16} />
                <span>{AGENT_PERMISSION_PROFILES[permissionProfileId].label}</span><WorkbenchIcon name="chevron" size={14} />
              </button>
              {permissionMenuOpen ? (
                <div className="agent-composer-popover agent-permission-menu" role="menu" aria-label="权限模式">
                  <div className="agent-permission-menu__header"><strong>如何审批 LFAA 操作？</strong><span>选择本次任务的执行边界</span></div>
                  {(Object.keys(AGENT_PERMISSION_PROFILES) as AgentPermissionProfileId[]).map((id) => {
                    const profile = AGENT_PERMISSION_PROFILES[id];
                    return (
                      <button className={id === permissionProfileId ? "is-active" : ""} data-permission-profile={id} key={id} type="button" role="menuitemradio" aria-checked={id === permissionProfileId} onClick={() => { onPermissionProfileChange(id); setPermissionMenuOpen(false); }}>
                        <span className="agent-permission-menu__icon"><WorkbenchIcon name={id === "full-access" ? "shield" : id === "approve-for-me" ? "spark" : "review"} size={17} /></span>
                        <span><strong>{profile.label}</strong><small>{profile.description}</small></span>
                        <span className="agent-permission-menu__check">{id === permissionProfileId ? "✓" : ""}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <button className="agent-model" type="button" title="打开模型与思考强度设置" onClick={onOpenAiSettings}>{modelLabel}<WorkbenchIcon name="chevron" size={13} /></button>
            <button className="agent-send" type="button" aria-label="发送" disabled={!runtimeConnected || modelLabel === "未配置模型" || submitting || !draft.trim()} onClick={() => { void submitTask(); }}>{submitting ? "…" : "↑"}</button>
          </div>
        </div>
        {runNotice ? <div className="agent-run-notice" role="status">{runNotice}</div> : null}
      </div>
    </section>
  );
}

// ===== 6. 右侧资源区 =====
// 右栏展开时，第一行是独立 Shell Header；其下 agent-right-body 才是“工具与资源”正文。
function groupResources(resources: readonly DevResourceItem[]) {
  return (Object.keys(resourceLabels) as ResourceKind[]).map((kind) => ({ kind, items: resources.filter((resource) => resource.kind === kind) }));
}

function RightSidebar({
  resources = [],
  resourceBridgeStatus = "offline",
  layoutMode,
  terminalOpen,
  rightCollapsed,
  onToggleTerminal,
  onToggleRight,
}: AgentWorkbenchProps & {
  layoutMode: LayoutMode;
  terminalOpen: boolean;
  rightCollapsed: boolean;
  onToggleTerminal: () => void;
  onToggleRight: () => void;
}) {
  const groups = groupResources(resources);
  const statusText = resourceBridgeStatus === "connected" ? "已连接" : resourceBridgeStatus === "refreshing" ? "刷新中" : "未连接";
  return (
    <aside className="agent-side agent-side--right">
      {layoutMode === "desktop" ? (
        <header className="agent-right-shell-header">
          <RightShellActions
            terminalOpen={terminalOpen}
            rightCollapsed={rightCollapsed}
            onToggleTerminal={onToggleTerminal}
            onToggleRight={onToggleRight}
          />
        </header>
      ) : null}

      <div className="agent-right-body">
        <header className="agent-right-header">
          <div><strong>工具与资源</strong><span>当前项目</span></div>
          <div className="agent-right-header-actions">
            <span className={`agent-bridge agent-bridge--${resourceBridgeStatus}`}><i />{statusText}</span>
          </div>
        </header>
        <div className="agent-tool-list">
          <button type="button"><WorkbenchIcon name="review" /><span>审查</span><kbd>Ctrl+Shift+G</kbd></button>
          <button type="button" className={terminalOpen ? "is-active" : ""} onClick={onToggleTerminal}><WorkbenchIcon name="terminal" /><span>终端</span><kbd>Ctrl+J</kbd></button>
          <button type="button"><WorkbenchIcon name="browser" /><span>浏览器</span><kbd>Ctrl+T</kbd></button>
          <button type="button"><WorkbenchIcon name="file" /><span>文件</span><kbd>Ctrl+P</kbd></button>
        </div>
        <div className="agent-resource-head"><span>项目资源</span><b>{resources.length}</b></div>
        <div className="agent-resource-groups">
          {groups.map(({ kind, items }) => <section key={kind}><header><span>{resourceLabels[kind]}</span><b>{items.length}</b></header>{items.length === 0 ? <p className="agent-empty">.lfaa/{kind}</p> : items.map((item) => <div className="agent-resource" key={`${kind}:${item.relativePath}`}><WorkbenchIcon name={item.entryType === "directory" ? "folder" : "file"} size={15} /><div><strong>{item.name}</strong><small>{item.relativePath}</small></div></div>)}</section>)}
        </div>
        <div className="agent-dev-note"><strong>只读资源桥接</strong><p>资源舱只读；终端是单独的本地开发 PTY，会执行你亲自输入的命令。</p></div>
      </div>
    </aside>
  );
}

// ===== 7. 底部终端外壳 =====
// 这里只提供 Tab/关闭按钮/内容插槽，真实 xterm + PTY 在 apps/web 中实现。
function BottomTerminal({ terminal, onClose }: { terminal: AgentWorkbenchProps["terminal"]; onClose: () => void }) {
  return (
    <section className="agent-terminal-shell">
      <header className="agent-terminal-shell__header">
        <div className="agent-terminal-shell__tab"><WorkbenchIcon name="terminal" size={15} /><strong>终端</strong></div>
        <button className="agent-icon-button" type="button" onClick={onClose} aria-label="关闭终端" title="关闭终端"><WorkbenchIcon name="close" size={15} /></button>
      </header>
      <div className="agent-terminal-shell__content">{terminal ?? <div className="agent-terminal-unavailable">当前宿主没有提供终端后端。</div>}</div>
    </section>
  );
}

// ===== 8. 工作台 Shell 状态与总装配 =====
export function AgentWorkbench(props: AgentWorkbenchProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const layout = useWorkbenchLayoutMetrics(stageRef);
  const layoutMode = layout.mode;
  const [themePreference, setThemePreference] = useState<ThemePreference>(initialThemePreference);
  const [systemDark, setSystemDark] = useState(initialSystemDark);
  const resolvedTheme: ResolvedTheme = themePreference === "system" ? (systemDark ? "dark" : "light") : themePreference;
  const [chrome, setChrome] = useState<ChromeState>(() => initialChrome(layoutMode));
  const [agentSurface, setAgentSurface] = useState<AgentSurfaceMode>(initialAgentSurface);
  const [permissionProfileId, setPermissionProfileId] = useState<AgentPermissionProfileId>(initialPermissionProfile);
  const [workNodes, setWorkNodes] = useState<readonly InfiniteCanvasNode[]>(INITIAL_WORK_NODES);
  const [surface, setSurface] = useState<"workbench" | "settings">("workbench");
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>("general");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [updateNoticeOpen, setUpdateNoticeOpen] = useState(false);
  const [selectedAiProviderId, setSelectedAiProviderId] = useState(builtinAiProviderPlugins[0]?.id ?? "openai");
  const [aiSnapshot, setAiSnapshot] = useState<AiAccountSnapshot>({ accounts: [], activeModel: null, secretPersistence: "memory", hostCapabilities: { "codex-app-server": { available: false, reason: "正在检查 Codex App Server…" } } });
  const [aiHostAvailable, setAiHostAvailable] = useState(Boolean(props.aiSettingsHost));
  const [pluginSnapshot, setPluginSnapshot] = useState<PluginManagerSnapshot>({ installed: [], registry: { generation: 0, plugins: new Map(), capabilities: new Map() } });
  const [pluginHostAvailable, setPluginHostAvailable] = useState(Boolean(props.pluginSettingsHost));
  // Hover Preview 与正式左 Dock 共享同一个“实际宽度”值。默认取当前响应式 initial，随后由 ResizableWorkbench 回传真实宽度。
  const [leftPaneWidth, setLeftPaneWidth] = useState(() => initialLeftPaneWidth(layout.left));
  const [leftPreviewOpen, setLeftPreviewOpen] = useState(false);
  const previewCloseTimerRef = useRef<number | null>(null);
  const appliedLayoutModeRef = useRef<LayoutMode | null>(layoutMode);

  // Hover 预览使用短延迟关闭，让鼠标能从按钮移动到预览浮层而不闪退。
  const clearPreviewTimer = useCallback(() => {
    if (previewCloseTimerRef.current !== null) {
      window.clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
  }, []);

  const openLeftPreview = useCallback(() => {
    if (!chrome.leftCollapsed || layoutMode === "mobile") return;
    clearPreviewTimer();
    setLeftPreviewOpen(true);
  }, [chrome.leftCollapsed, clearPreviewTimer, layoutMode]);

  const closeLeftPreview = useCallback((delay = 120) => {
    clearPreviewTimer();
    if (!chrome.leftCollapsed) {
      setLeftPreviewOpen(false);
      return;
    }
    previewCloseTimerRef.current = window.setTimeout(() => {
      setLeftPreviewOpen(false);
      previewCloseTimerRef.current = null;
    }, delay);
  }, [chrome.leftCollapsed, clearPreviewTimer]);

  // 跨模式时只做一次“安全降级”：
  // Desktop→Compact 关闭右 Dock，防止刚切 Overlay 就遮住内容；进入 Mobile 则关闭左右 Overlay 与终端。
  // 同一模式内用户仍可以主动重新打开，不会被 resize 事件反复强制关闭。
  useEffect(() => {
    if (appliedLayoutModeRef.current === layoutMode) return;
    appliedLayoutModeRef.current = layoutMode;
    clearPreviewTimer();
    setLeftPreviewOpen(false);
    if (layoutMode === "compact") {
      setChrome((value) => ({ ...value, rightCollapsed: true }));
    } else if (layoutMode === "mobile") {
      setChrome((value) => ({ ...value, leftCollapsed: true, rightCollapsed: true, terminalOpen: false }));
    }
  }, [clearPreviewTimer, layoutMode]);

  useEffect(() => { window.localStorage.setItem(THEME_KEY, themePreference); }, [themePreference]);
  useEffect(() => { window.localStorage.setItem(AGENT_SURFACE_KEY, agentSurface); }, [agentSurface]);
  useEffect(() => { window.localStorage.setItem(AGENT_PERMISSION_KEY, permissionProfileId); }, [permissionProfileId]);
  useEffect(() => { window.localStorage.setItem(LEFT_PANE_WIDTH_KEY, String(leftPaneWidth)); }, [leftPaneWidth]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    if (!updateNoticeOpen) return;
    const timer = window.setTimeout(() => setUpdateNoticeOpen(false), 2600);
    return () => window.clearTimeout(timer);
  }, [updateNoticeOpen]);
  useEffect(() => { window.localStorage.setItem(CHROME_KEY, JSON.stringify(chrome)); }, [chrome]);
  useEffect(() => {
    let cancelled = false;
    if (!props.aiSettingsHost) { setAiHostAvailable(false); return; }
    props.aiSettingsHost.snapshot().then((snapshot) => {
      if (cancelled) return;
      setAiSnapshot(snapshot);
      setAiHostAvailable(true);
    }).catch(() => { if (!cancelled) setAiHostAvailable(false); });
    return () => { cancelled = true; };
  }, [props.aiSettingsHost]);
  useEffect(() => {
    let cancelled = false;
    if (!props.pluginSettingsHost) { setPluginHostAvailable(false); return; }
    props.pluginSettingsHost.snapshot().then((snapshot) => {
      if (cancelled) return;
      setPluginSnapshot(snapshot);
      setPluginHostAvailable(true);
    }).catch(() => { if (!cancelled) setPluginHostAvailable(false); });
    return () => { cancelled = true; };
  }, [props.pluginSettingsHost]);
  useEffect(() => {
    if (!chrome.leftCollapsed && leftPreviewOpen) setLeftPreviewOpen(false);
  }, [chrome.leftCollapsed, leftPreviewOpen]);
  useEffect(() => () => clearPreviewTimer(), [clearPreviewTimer]);

  // Shell 快捷键：Ctrl+B 左栏、Ctrl+J 底部终端、Ctrl+Alt+B 右栏。
  // 输入框或 contentEditable 聚焦时不抢占用户文本快捷键。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        setThemeMenuOpen(false);
        return;
      }
      if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key === ",") {
        event.preventDefault();
        setProfileMenuOpen(false);
        setThemeMenuOpen(false);
        setSettingsSection("general");
        setSurface("settings");
        return;
      }

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      if (event.ctrlKey && !event.altKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        clearPreviewTimer();
        setLeftPreviewOpen(false);
        setChrome((value) => ({ ...value, leftCollapsed: !value.leftCollapsed }));
      } else if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setChrome((value) => ({ ...value, rightCollapsed: !value.rightCollapsed }));
      } else if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setChrome((value) => ({ ...value, terminalOpen: !value.terminalOpen }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearPreviewTimer]);

  const toggleLeft = useCallback(() => {
    clearPreviewTimer();
    setLeftPreviewOpen(false);
    setChrome((value) => ({ ...value, leftCollapsed: !value.leftCollapsed }));
  }, [clearPreviewTimer]);
  const toggleRight = () => setChrome((value) => ({ ...value, rightCollapsed: !value.rightCollapsed }));
  const toggleTerminal = () => setChrome((value) => ({ ...value, terminalOpen: !value.terminalOpen }));

  // 同一个 LeftSidebar 实例描述被复用到“正常布局”和“收起后的 Hover 预览”；
  // 二者不会同时可交互，避免维护两套左栏内容。
  const leftSidebar = (
    <LeftSidebar
      resolvedTheme={resolvedTheme}
      themePreference={themePreference}
      agentSurface={agentSurface}
      onAgentSurfaceChange={setAgentSurface}
      onOpenProfile={() => {
        setThemeMenuOpen(false);
        setProfileMenuOpen(true);
      }}
      onOpenThemeMenu={() => {
        setProfileMenuOpen(false);
        setThemeMenuOpen(true);
      }}
      onRequestUpdate={() => setUpdateNoticeOpen(true)}
    />
  );

  const aiProviderViews = buildAiProviderViews(aiSnapshot.hostCapabilities);
  const aiAccounts = aiSnapshot.accounts.map(mapAiAccount);
  const activeAiAccount = aiSnapshot.activeModel
    ? aiSnapshot.accounts.find((account) => account.id === aiSnapshot.activeModel?.accountId)
    : undefined;
  const reasoningEffortLabel = formatReasoningEffort(activeAiAccount?.modelSettings.reasoningEffort);
  const modelLabel = aiSnapshot.activeModel
    ? `${aiSnapshot.activeModel.modelId}${reasoningEffortLabel ? ` · ${reasoningEffortLabel}` : ""}`
    : "未配置模型";
  const activeModelBinding: AgentModelBinding | null = aiSnapshot.activeModel
    ? { accountId: aiSnapshot.activeModel.accountId, providerId: aiSnapshot.activeModel.providerId, modelId: aiSnapshot.activeModel.modelId }
    : null;
  const startAgentRun = async (input: string): Promise<AgentRunHandle> => {
    if (!props.agentRuntimeHost) throw new Error("Agent Runtime Host 未连接。");
    if (!activeModelBinding) throw new Error("请先在设置中配置并选择模型。");
    const handle = await props.agentRuntimeHost.startRun({
      surface: agentSurface,
      input,
      model: activeModelBinding,
      permissionProfileId,
      workspaceId: props.workspaceId ?? "lfaa",
    });
    setWorkNodes((nodes) => nodes.map((node) => {
      if (node.id === "goal") return { ...node, description: input, status: "done" as const };
      if (node.id === "agent") return { ...node, status: "running" as const };
      return node;
    }));
    return handle;
  };
  const requireAiHost = () => {
    if (!props.aiSettingsHost) throw new Error("当前宿主未提供 AI 配置桥。");
    return props.aiSettingsHost;
  };
  const probeAiAccount = async (draft: AiSettingsDraftInput, secret: string) => mapAiProbe(await requireAiHost().probe(toAiAccountDraft(draft), secret));
  const saveAiAccount = async (draft: AiSettingsDraftInput, secret: string) => {
    const result = await requireAiHost().save(toAiAccountDraft(draft), secret);
    setAiSnapshot(result.snapshot);
    return mapAiProbe(result.probe);
  };
  const connectAiSubscription = async (draft: AiSettingsDraftInput) => {
    const result = await requireAiHost().connectSubscription(toAiAccountDraft(draft));
    setAiSnapshot(result.snapshot);
    return mapAiProbe(result.probe);
  };
  const reprobeAiAccount = async (accountId: string) => {
    const result = await requireAiHost().reprobe(accountId);
    setAiSnapshot(result.snapshot);
    return mapAiProbe(result.probe);
  };
  const deleteAiAccount = async (accountId: string) => setAiSnapshot(await requireAiHost().deleteAccount(accountId));
  const selectAiAccountModel = async (accountId: string, modelId: string, modelSettings: Readonly<Record<string, string | number | boolean>>) => setAiSnapshot(await requireAiHost().selectModel(accountId, modelId, modelSettings));
  const activateAiAccountModel = async (accountId: string) => setAiSnapshot(await requireAiHost().activateModel(accountId));
  const requirePluginHost = () => {
    if (!props.pluginSettingsHost) throw new Error("当前宿主未提供 Plugin Manager 桥。");
    return props.pluginSettingsHost;
  };
  const inspectPlugin = async (spec: string) => mapPluginInspection(await requirePluginHost().inspect(spec));
  const installPlugin = async (spec: string, requestId: string, approvedBuilds?: readonly string[]) => {
    const result = await requirePluginHost().install(spec, requestId, approvedBuilds);
    setPluginSnapshot(result.snapshot);
    return mapPluginInstallOutcome(result.outcome);
  };
  const setPluginEnabled = async (packageName: string, enabled: boolean) => setPluginSnapshot(await requirePluginHost().setEnabled(packageName, enabled));
  const removePlugin = async (packageName: string) => setPluginSnapshot(await requirePluginHost().remove(packageName));
  const cancelPlugin = async (requestId: string) => requirePluginHost().cancel(requestId);

  return (
    <div className="agent-theme" data-theme={resolvedTheme} data-theme-preference={themePreference} data-layout-mode={layoutMode}>
      <div
        ref={stageRef}
        className={`agent-workbench-stage${surface === "settings" ? " is-suspended" : ""}`}
        aria-hidden={surface === "settings"}
        style={{
          "--agent-left-preview-width": `${leftPaneWidth}px`,
          "--agent-left-live-width": `${leftPaneWidth}px`,
        } as CSSProperties}
      >
          {/* 左栏收起后才挂载临时预览层；正常展开时由 ResizableWorkbench 渲染正式左栏。 */}
          {chrome.leftCollapsed ? (
            <div
              className={`agent-left-hover-preview${leftPreviewOpen ? " is-visible" : ""}`}
              onMouseEnter={openLeftPreview}
              onMouseLeave={() => closeLeftPreview(120)}
            >
              {leftSidebar}
            </div>
          ) : null}
          {/* ResizableWorkbench 只管理几何布局与拖拽；Shell 开合真值仍由本组件受控。 */}
          <ResizableWorkbench
            left={leftSidebar}
            center={(
              <CenterWorkspace
                layoutMode={layoutMode}
                leftCollapsed={chrome.leftCollapsed}
                rightCollapsed={chrome.rightCollapsed}
                terminalOpen={chrome.terminalOpen}
                agentSurface={agentSurface}
                permissionProfileId={permissionProfileId}
                modelLabel={modelLabel}
                runtimeConnected={Boolean(props.agentRuntimeHost)}
                workNodes={workNodes}
                onWorkNodesChange={setWorkNodes}
                onPermissionProfileChange={setPermissionProfileId}
                onSubmitTask={startAgentRun}
                onOpenAiSettings={() => { setSettingsSection("ai"); setSurface("settings"); }}
                onToggleLeft={toggleLeft}
                onToggleRight={toggleRight}
                onToggleTerminal={toggleTerminal}
                onLeftHoverEnter={openLeftPreview}
                onLeftHoverLeave={() => closeLeftPreview(120)}
              />
            )}
            right={(
              <RightSidebar
                {...props}
                layoutMode={layoutMode}
                terminalOpen={chrome.terminalOpen}
                rightCollapsed={chrome.rightCollapsed}
                onToggleTerminal={toggleTerminal}
                onToggleRight={toggleRight}
              />
            )}
            bottom={<BottomTerminal terminal={props.terminal} onClose={() => setChrome((value) => ({ ...value, terminalOpen: false }))} />}
            bottomOpen={chrome.terminalOpen}
            layoutMode={layoutMode}
            leftWidth={leftPaneWidth}
            leftLimits={layout.left}
            rightLimits={layout.right}
            bottomLimits={layout.bottom}
            snapCaptureRatio={layout.snapCaptureRatio}
        snapHysteresis={layout.snapHysteresis}
            minCenterWidth={layout.minCenterWidth}
            leftCollapsed={chrome.leftCollapsed}
            onLeftWidthChange={setLeftPaneWidth}
            rightCollapsed={chrome.rightCollapsed}
            onLeftCollapsedChange={(leftCollapsed) => {
              clearPreviewTimer();
              setLeftPreviewOpen(false);
              setChrome((value) => value.leftCollapsed === leftCollapsed ? value : { ...value, leftCollapsed });
            }}
            onRightCollapsedChange={(rightCollapsed) => setChrome((value) => value.rightCollapsed === rightCollapsed ? value : { ...value, rightCollapsed })}
            onBottomOpenChange={(terminalOpen) => setChrome((value) => value.terminalOpen === terminalOpen ? value : { ...value, terminalOpen })}
          />

          {profileMenuOpen ? (
            <div className="agent-profile-overlay">
              <button className="agent-profile-backdrop" type="button" aria-label="关闭个人中心" onClick={() => setProfileMenuOpen(false)} />
              <div className="agent-profile-focus-shell">
                <UserMenu
                  displayName="二鱼"
                  subtitle="本地工作区"
                  onOpenSettings={() => {
                    setProfileMenuOpen(false);
                    setSettingsSection("general");
                    setSurface("settings");
                  }}
                  onRequestUpdate={() => {
                    setProfileMenuOpen(false);
                    setUpdateNoticeOpen(true);
                  }}
                />
                <ProfileBar
                  resolvedTheme={resolvedTheme}
                  themePreference={themePreference}
                  onOpenProfile={() => setProfileMenuOpen(false)}
                  onOpenThemeMenu={() => {
                    setProfileMenuOpen(false);
                    setThemeMenuOpen(true);
                  }}
                  onRequestUpdate={() => {
                    setProfileMenuOpen(false);
                    setUpdateNoticeOpen(true);
                  }}
                />
              </div>
            </div>
          ) : null}

          {themeMenuOpen ? (
            <div className="agent-theme-menu-layer">
              <button className="agent-theme-menu-backdrop" type="button" aria-label="关闭主题菜单" onClick={() => setThemeMenuOpen(false)} />
              <div className="agent-theme-menu-anchor">
                <ThemeModeMenu
                  value={themePreference}
                  onChange={(value) => {
                    setThemePreference(value);
                    setThemeMenuOpen(false);
                  }}
                />
              </div>
            </div>
          ) : null}
      </div>

      {surface === "settings" ? (
        <div className="agent-settings-layer">
          <SettingsPage
            activeSection={settingsSection}
            onSectionChange={setSettingsSection}
            onClose={() => setSurface("workbench")}
            leftPaneWidth={leftPaneWidth}
            onLeftPaneWidthChange={setLeftPaneWidth}
            themePreference={themePreference}
            onThemePreferenceChange={setThemePreference}
            aiProviders={aiProviderViews}
            selectedAiProviderId={selectedAiProviderId}
            onSelectAiProvider={setSelectedAiProviderId}
            aiAccounts={aiAccounts}
            activeAiModel={aiSnapshot.activeModel}
            aiSecretPersistence={aiHostAvailable ? aiSnapshot.secretPersistence : "unavailable"}
            aiHostAvailable={aiHostAvailable}
            onProbeAiAccount={probeAiAccount}
            onSaveAiAccount={saveAiAccount}
            onConnectAiSubscription={connectAiSubscription}
            onReprobeAiAccount={reprobeAiAccount}
            onDeleteAiAccount={deleteAiAccount}
            onSelectAiAccountModel={selectAiAccountModel}
            onActivateAiAccountModel={activateAiAccountModel}
            pluginSettings={{
              hostAvailable: pluginHostAvailable,
              registryGeneration: pluginSnapshot.registry.generation,
              installed: pluginSnapshot.installed.map(mapInstalledPlugin),
              onInspectPlugin: inspectPlugin,
              onInstallPlugin: installPlugin,
              onSetPluginEnabled: setPluginEnabled,
              onRemovePlugin: removePlugin,
              onCancelPlugin: cancelPlugin,
            }}
          />
        </div>
      ) : null}

      {updateNoticeOpen ? <div className="agent-update-toast" role="status">当前 Web 开发宿主未接入自动更新；正式更新仍由 Update Adapter / LFAA-Update 管理。</div> : null}
    </div>
  );

}
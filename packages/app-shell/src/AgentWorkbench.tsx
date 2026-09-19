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
import {
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
  type ThemePreference,
  type WorkbenchLayoutMetrics,
  type WorkbenchLayoutMode,
} from "@lfaa/ui";
import { builtinAiProviderPlugins, type AiAccountDraft, type AiAccountProbeResult, type AiAccountRecord, type AiAccountSnapshot } from "@lfaa/config-system";
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

type ResolvedTheme = "light" | "dark";
type LayoutMode = WorkbenchLayoutMode;
interface ChromeState { leftCollapsed: boolean; rightCollapsed: boolean; terminalOpen: boolean; }
const recentRuns = ["配置系统", "Web 工作台", "热插拔测试", "模型接入规划"];
const resourceLabels: Record<ResourceKind, string> = { skills: "Skills", experts: "Experts", plugins: "Plugins", extensions: "Extensions", mcp: "MCP" };

// Config System 拥有 Provider 业务事实；App Shell 只把业务描述投影为 UI ViewModel。
const aiProviderViews: readonly AiSettingsProviderView[] = builtinAiProviderPlugins.map((plugin) => ({
  id: plugin.id,
  name: plugin.displayName,
  description: plugin.description,
  authMethods: plugin.authMethods.map((auth) => ({
    id: auth.id,
    label: auth.label,
    kind: auth.kind,
    ...(auth.description ? { description: auth.description } : {}),
    ...(auth.secretLabel ? { secretLabel: auth.secretLabel } : {}),
    available: auth.kind !== "subscription",
    ...(auth.kind === "subscription" ? { unavailableReason: "ChatGPT 套餐将在下一步通过 Codex App Server 接入。" } : {}),
  })),
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

function mapAiAccount(record: AiAccountRecord): AiSettingsAccountView {
  return {
    id: record.id,
    providerId: record.providerId,
    displayName: record.displayName,
    authMethodId: record.authMethodId,
    selectedModelId: record.selectedModelId,
    verificationStatus: record.verificationStatus,
    lastVerifiedAt: record.lastVerifiedAt,
  };
}

function mapAiProbe(probe: AiAccountProbeResult): AiSettingsProbeView {
  return {
    status: probe.status,
    message: probe.message,
    models: probe.models,
    ...(probe.resolvedBaseUrl ? { resolvedBaseUrl: probe.resolvedBaseUrl } : {}),
  };
}

function toAiAccountDraft(draft: AiSettingsDraftInput): AiAccountDraft {
  return {
    ...(draft.accountId ? { accountId: draft.accountId } : {}),
    providerId: draft.providerId as AiAccountDraft["providerId"],
    displayName: draft.displayName,
    authMethodId: draft.authMethodId,
    settings: draft.settings,
    selectedModelId: draft.selectedModelId ?? null,
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
  return (
    <aside className="agent-side agent-side--left">
      <div className="agent-brand-row">
        <button className="agent-brand" type="button" aria-label="LFAA 工作台">
          <span className="agent-brand__mark">L</span><strong>LFAA</strong><WorkbenchIcon name="chevron" size={15} />
        </button>
        <div className="agent-brand-actions">
          <button className="agent-icon-button" type="button" aria-label="搜索"><WorkbenchIcon name="search" /></button>
        </div>
      </div>

      <button className="agent-new-task" type="button"><WorkbenchIcon name="new" />新建任务<span>⌘ K</span></button>
      <nav className="agent-nav" aria-label="主导航">
        <button className="is-active" type="button"><WorkbenchIcon name="grid" />工作区</button>
        <button type="button"><WorkbenchIcon name="spark" />智能体</button>
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
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleTerminal: () => void;
  onLeftHoverEnter: () => void;
  onLeftHoverLeave: () => void;
}) {
  return (
    <section className="agent-center">
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
          <div className="agent-center-header__title"><WorkbenchIcon name="folder" size={16} /><strong>Web 工作台</strong></div>
        </div>

        <div className="agent-center-header__right">
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

      <div className="agent-conversation">
        <div className="agent-conversation-inner">
          <div className="agent-user-message">把 LFAA 的工作台做成简洁、稳定、适合长时间工作的 Agent 界面。</div>
          <article className="agent-answer">
            <p>工作台继续采用接近 ChatGPT / Codex 的三栏结构。框架级按钮属于区域顶部 Header，而不是悬浮在正文上方：左栏按钮固定在中间 Header 左侧；右栏展开时，终端与右栏按钮进入右栏 Header；右栏收起时，它们回到中间 Header 右侧。</p>
            <h2>当前 UI 目标</h2>
            <ul>
              <li>左侧承载导航、项目和最近任务；</li>
              <li>中间保持主要工作区和对话上下文；</li>
              <li>右侧放工具入口、运行状态和 <code>.lfaa</code> 热插拔资源；</li>
              <li>拖到侧栏最小宽度自动吸附收起，收起后不能从分隔条反向拖开；</li>
              <li>左栏按钮 Hover 只临时预览左栏，Click / Ctrl+B 才正式改变布局；</li>
              <li>顶部 Header 与右栏展开/收起同步重排，不允许按钮漂在正文内容层。</li>
            </ul>
          </article>
        </div>
      </div>
      <div className="agent-composer-wrap">
        <div className="agent-composer">
          <textarea aria-label="输入任务" placeholder="随心输入" rows={1} />
          <div className="agent-composer-actions"><button className="agent-composer-icon" type="button" aria-label="添加"><WorkbenchIcon name="plus" /></button><span className="agent-permission">Ask</span><span className="agent-model">GPT-5.6 Sol</span><button className="agent-send" type="button" aria-label="发送">↑</button></div>
        </div>
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
  const [surface, setSurface] = useState<"workbench" | "settings">("workbench");
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>("general");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [updateNoticeOpen, setUpdateNoticeOpen] = useState(false);
  const [selectedAiProviderId, setSelectedAiProviderId] = useState(aiProviderViews[0]?.id ?? "openai");
  const [aiSnapshot, setAiSnapshot] = useState<AiAccountSnapshot>({ accounts: [], secretPersistence: "memory" });
  const [aiHostAvailable, setAiHostAvailable] = useState(Boolean(props.aiSettingsHost));
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

  const aiAccounts = aiSnapshot.accounts.map(mapAiAccount);
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
  const reprobeAiAccount = async (accountId: string) => mapAiProbe(await requireAiHost().reprobe(accountId));
  const deleteAiAccount = async (accountId: string) => setAiSnapshot(await requireAiHost().deleteAccount(accountId));
  const selectAiAccountModel = async (accountId: string, modelId: string) => setAiSnapshot(await requireAiHost().selectModel(accountId, modelId));

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
            aiSecretPersistence={aiHostAvailable ? aiSnapshot.secretPersistence : "unavailable"}
            aiHostAvailable={aiHostAvailable}
            onProbeAiAccount={probeAiAccount}
            onSaveAiAccount={saveAiAccount}
            onReprobeAiAccount={reprobeAiAccount}
            onDeleteAiAccount={deleteAiAccount}
            onSelectAiAccountModel={selectAiAccountModel}
          />
        </div>
      ) : null}

      {updateNoticeOpen ? <div className="agent-update-toast" role="status">当前 Web 开发宿主未接入自动更新；正式更新仍由 Update Adapter / LFAA-Update 管理。</div> : null}
    </div>
  );

}
import { useCallback, useEffect, useRef, useState } from "react";
import { ResizableWorkbench } from "@lfaa/ui";
import { WorkbenchIcon } from "./WorkbenchIcon";
import type { AgentWorkbenchProps, DevResourceItem, ResourceKind } from "./workbench.types";
import "./agent-workbench.css";

const LEFT_LIMITS = { min: 240, max: 640, initial: 288 } as const;
const RIGHT_LIMITS = { min: 300, max: 760, initial: 360 } as const;
const BOTTOM_LIMITS = { min: 150, max: 560, initial: 270 } as const;
const THEME_KEY = "lfaa.workbench.theme.v1";
const CHROME_KEY = "lfaa.workbench.chrome.v2";

type ThemeMode = "light" | "dark";
interface ChromeState { leftCollapsed: boolean; rightCollapsed: boolean; terminalOpen: boolean; }
const recentRuns = ["配置系统", "Web 工作台", "热插拔测试", "模型接入规划"];
const resourceLabels: Record<ResourceKind, string> = { skills: "Skills", experts: "Experts", plugins: "Plugins", extensions: "Extensions", mcp: "MCP" };

function initialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initialChrome(): ChromeState {
  if (typeof window === "undefined") return { leftCollapsed: false, rightCollapsed: false, terminalOpen: true };
  try {
    const raw = window.localStorage.getItem(CHROME_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Partial<ChromeState>;
    return {
      leftCollapsed: Boolean(parsed.leftCollapsed),
      rightCollapsed: Boolean(parsed.rightCollapsed),
      terminalOpen: parsed.terminalOpen === undefined ? true : Boolean(parsed.terminalOpen),
    };
  } catch {
    return { leftCollapsed: false, rightCollapsed: false, terminalOpen: true };
  }
}

function LeftSidebar({ theme, onToggleTheme }: { theme: ThemeMode; onToggleTheme: () => void }) {
  return (
    <aside className="agent-side agent-side--left">
      <div className="agent-brand-row">
        <button className="agent-brand" type="button" aria-label="LFAA 工作台">
          <span className="agent-brand__mark">L</span><strong>LFAA</strong><WorkbenchIcon name="chevron" size={15} />
        </button>
        <div className="agent-brand-actions">
          <button className="agent-icon-button" type="button" aria-label="搜索"><WorkbenchIcon name="search" /></button>
          <button className="agent-icon-button" type="button" aria-label="设置"><WorkbenchIcon name="settings" /></button>
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
      <div className="agent-profile">
        <button className="agent-profile-main" type="button"><span className="agent-avatar">二</span><span><strong>二鱼</strong><small>本地工作区</small></span></button>
        <button className="agent-icon-button" type="button" onClick={onToggleTheme} aria-label={theme === "light" ? "切换深色主题" : "切换浅色主题"}><WorkbenchIcon name={theme === "light" ? "moon" : "sun"} /></button>
      </div>
    </aside>
  );
}

function CenterWorkspace({
  leftCollapsed,
  rightCollapsed,
  terminalOpen,
  onToggleLeft,
  onToggleRight,
  onToggleTerminal,
  onLeftHoverEnter,
  onLeftHoverLeave,
}: {
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
      <div className="agent-center-floats agent-center-floats--left">
        <button
          className="agent-center-toggle"
          type="button"
          onClick={onToggleLeft}
          onMouseEnter={onLeftHoverEnter}
          onMouseLeave={onLeftHoverLeave}
          onFocus={onLeftHoverEnter}
          onBlur={onLeftHoverLeave}
          aria-label={leftCollapsed ? "切换侧边栏" : "收起侧边栏"}
          aria-expanded={!leftCollapsed}
          title={leftCollapsed ? "切换侧边栏 (Ctrl+B)" : "收起侧边栏 (Ctrl+B)"}
        >
          <WorkbenchIcon name="panelLeft" size={16} />
        </button>
      </div>

      <div className="agent-center-floats agent-center-floats--right">
        <button
          className={`agent-center-toggle${terminalOpen ? " is-active" : ""}`}
          type="button"
          onClick={onToggleTerminal}
          aria-label={terminalOpen ? "切换底部面板显示" : "切换底部面板显示"}
          aria-expanded={terminalOpen}
          title="切换底部面板显示 (Ctrl+J)"
        >
          <WorkbenchIcon name="terminal" size={16} />
        </button>
        <button
          className="agent-center-toggle"
          type="button"
          onClick={onToggleRight}
          aria-label={rightCollapsed ? "显示/隐藏侧边面板" : "显示/隐藏侧边面板"}
          aria-expanded={!rightCollapsed}
          title="显示/隐藏侧边面板 (Ctrl+Alt+B)"
        >
          <WorkbenchIcon name="panelRight" size={16} />
        </button>
      </div>

      <div className="agent-conversation">
        <div className="agent-conversation-inner">
          <div className="agent-user-message">把 LFAA 的工作台做成简洁、稳定、适合长时间工作的 Agent 界面。</div>
          <article className="agent-answer">
            <p>工作台继续采用接近 ChatGPT / Codex 的三栏结构。左侧入口移动到中间主区域左上角，右侧入口与终端入口移动到中间主区域右上角；左侧按钮支持 hover 预览左侧内容区，右侧按钮保持显式点击开合。</p>
            <h2>当前 UI 目标</h2>
            <ul>
              <li>左侧承载导航、项目和最近任务；</li>
              <li>中间保持主要工作区和对话上下文；</li>
              <li>右侧放工具入口、运行状态和 <code>.lfaa</code> 热插拔资源；</li>
              <li>拖到侧栏最小宽度自动吸附收起，收起后不能从分隔条反向拖开；</li>
              <li>左侧按钮固定在中间区域左上角，并在 hover 时淡入淡出预览左栏内容；</li>
              <li>右上角保留终端与右侧面板按钮，并提供快捷键提示。</li>
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

function groupResources(resources: readonly DevResourceItem[]) {
  return (Object.keys(resourceLabels) as ResourceKind[]).map((kind) => ({ kind, items: resources.filter((resource) => resource.kind === kind) }));
}

function RightSidebar({ resources = [], resourceBridgeStatus = "offline", terminalOpen, onToggleTerminal }: AgentWorkbenchProps & { terminalOpen: boolean; onToggleTerminal: () => void }) {
  const groups = groupResources(resources);
  const statusText = resourceBridgeStatus === "connected" ? "已连接" : resourceBridgeStatus === "refreshing" ? "刷新中" : "未连接";
  return (
    <aside className="agent-side agent-side--right">
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
    </aside>
  );
}

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

function WebWorkbenchHeader() {
  return (
    <header className="agent-web-header">
      <div className="agent-web-header__title"><WorkbenchIcon name="folder" /><strong>Web 工作台</strong></div>
      <div className="agent-web-header__actions">
        <button className="agent-icon-button" type="button" aria-label="更多"><WorkbenchIcon name="dots" size={16} /></button>
        <button className="agent-ghost-button" type="button">分享</button>
      </div>
    </header>
  );
}

export function AgentWorkbench(props: AgentWorkbenchProps) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [chrome, setChrome] = useState<ChromeState>(initialChrome);
  const [leftPreviewOpen, setLeftPreviewOpen] = useState(false);
  const previewCloseTimerRef = useRef<number | null>(null);

  const clearPreviewTimer = useCallback(() => {
    if (previewCloseTimerRef.current !== null) {
      window.clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
  }, []);

  const openLeftPreview = useCallback(() => {
    if (!chrome.leftCollapsed) return;
    clearPreviewTimer();
    setLeftPreviewOpen(true);
  }, [chrome.leftCollapsed, clearPreviewTimer]);

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

  useEffect(() => { window.localStorage.setItem(THEME_KEY, theme); }, [theme]);
  useEffect(() => { window.localStorage.setItem(CHROME_KEY, JSON.stringify(chrome)); }, [chrome]);
  useEffect(() => {
    if (!chrome.leftCollapsed && leftPreviewOpen) setLeftPreviewOpen(false);
  }, [chrome.leftCollapsed, leftPreviewOpen]);
  useEffect(() => () => clearPreviewTimer(), [clearPreviewTimer]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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

  const leftSidebar = (
    <LeftSidebar
      theme={theme}
      onToggleTheme={() => setTheme((value) => value === "light" ? "dark" : "light")}
    />
  );

  return (
    <div className="agent-theme" data-theme={theme}>
      <WebWorkbenchHeader />
      <div className="agent-workbench-stage">
        {chrome.leftCollapsed ? (
          <div
            className={`agent-left-hover-preview${leftPreviewOpen ? " is-visible" : ""}`}
            onMouseEnter={openLeftPreview}
            onMouseLeave={() => closeLeftPreview(120)}
          >
            {leftSidebar}
          </div>
        ) : null}
        <ResizableWorkbench
          left={leftSidebar}
          center={(
            <CenterWorkspace
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
          right={<RightSidebar {...props} terminalOpen={chrome.terminalOpen} onToggleTerminal={toggleTerminal} />}
          bottom={<BottomTerminal terminal={props.terminal} onClose={() => setChrome((value) => ({ ...value, terminalOpen: false }))} />}
          bottomOpen={chrome.terminalOpen}
          leftLimits={LEFT_LIMITS}
          rightLimits={RIGHT_LIMITS}
          bottomLimits={BOTTOM_LIMITS}
          snapHysteresis={24}
          minCenterWidth={520}
          leftCollapsed={chrome.leftCollapsed}
          rightCollapsed={chrome.rightCollapsed}
          onLeftCollapsedChange={(leftCollapsed) => {
            clearPreviewTimer();
            setLeftPreviewOpen(false);
            setChrome((value) => value.leftCollapsed === leftCollapsed ? value : { ...value, leftCollapsed });
          }}
          onRightCollapsedChange={(rightCollapsed) => setChrome((value) => value.rightCollapsed === rightCollapsed ? value : { ...value, rightCollapsed })}
          onBottomOpenChange={(terminalOpen) => setChrome((value) => value.terminalOpen === terminalOpen ? value : { ...value, terminalOpen })}
        />
      </div>
    </div>
  );
}

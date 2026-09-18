/**
 * 文件：AgentWorkbench.tsx
 * 作用：组合 LFAA Web/Desktop 共用的三栏 Agent 工作台壳。
 * 负责：工作台页面编排、主题偏好和开发期展示内容。
 * 不负责：Agent、Config、资源 Registry 的事实状态。
 * 状态归属：主题、侧栏开合、终端显隐仅属于本地 UI 状态。
 */
import { useEffect, useState } from "react";
import { ResizableWorkbench } from "@lfaa/ui";
import { WorkbenchIcon } from "./WorkbenchIcon";
import type { AgentWorkbenchProps, DevResourceItem, ResourceKind } from "./workbench.types";
import "./agent-workbench.css";

const LEFT_LIMITS = { min: 240, max: 640, initial: 288 } as const;
const RIGHT_LIMITS = { min: 300, max: 760, initial: 360 } as const;
const THEME_KEY = "lfaa.workbench.theme.v1";
const CHROME_KEY = "lfaa.workbench.chrome.v1";

type ThemeMode = "light" | "dark";

interface ChromeState {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  terminalOpen: boolean;
}

const recentRuns = ["配置系统", "Web 工作台", "热插拔测试", "模型接入规划"];
const resourceLabels: Record<ResourceKind, string> = {
  skills: "Skills",
  experts: "Experts",
  plugins: "Plugins",
  extensions: "Extensions",
  mcp: "MCP",
};
const terminalLines = [
  "$ pnpm dev:web",
  "[lfaa] workspace shell ready",
  "[vite] http://127.0.0.1:5173",
  "[bridge] /__lfaa/dev/resources connected",
  "[ui] terminal dock pinned to center bottom",
];

function initialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initialChrome(): ChromeState {
  if (typeof window === "undefined") {
    return { leftCollapsed: false, rightCollapsed: false, terminalOpen: true };
  }

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
          <span className="agent-brand__mark">L</span>
          <strong>LFAA</strong>
          <WorkbenchIcon name="chevron" size={15} />
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
      <div className="agent-projects">
        <button type="button"><WorkbenchIcon name="folder" />lfaa</button>
      </div>

      <div className="agent-section-title agent-section-title--recent"><span>最近</span></div>
      <div className="agent-history">
        {recentRuns.map((item, index) => <button type="button" key={item} className={index === 1 ? "is-current" : ""}>{item}</button>)}
      </div>

      <div className="agent-profile">
        <button className="agent-profile-main" type="button">
          <span className="agent-avatar">二</span>
          <span><strong>二鱼</strong><small>本地工作区</small></span>
        </button>
        <button className="agent-icon-button" type="button" onClick={onToggleTheme} aria-label={theme === "light" ? "切换深色主题" : "切换浅色主题"} title={theme === "light" ? "深色主题" : "浅色主题"}>
          <WorkbenchIcon name={theme === "light" ? "moon" : "sun"} />
        </button>
      </div>
    </aside>
  );
}

interface CenterWorkspaceProps {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  terminalOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleTerminal: () => void;
}

function CenterWorkspace({ leftCollapsed, rightCollapsed, terminalOpen, onToggleLeft, onToggleRight, onToggleTerminal }: CenterWorkspaceProps) {
  return (
    <section className="agent-center">
      <header className="agent-topbar">
        <div className="agent-topbar-leading">
          <div className="agent-hover-controls">
            <button className="agent-pane-toggle" type="button" onClick={onToggleLeft} aria-label={leftCollapsed ? "展开左侧边栏" : "收起左侧边栏"} title={leftCollapsed ? "展开左侧边栏" : "收起左侧边栏"}>
              <WorkbenchIcon name="panelLeft" size={16} />
            </button>
          </div>
          <div className="agent-topbar-title"><WorkbenchIcon name="folder" /><strong>Web 工作台</strong></div>
        </div>

        <div className="agent-topbar-actions">
          <div className="agent-hover-controls">
            <button className={`agent-pane-toggle ${terminalOpen ? "is-active" : ""}`} type="button" onClick={onToggleTerminal} aria-label={terminalOpen ? "收起终端" : "展开终端"} title={terminalOpen ? "收起终端" : "展开终端"}>
              <WorkbenchIcon name="terminal" size={16} />
            </button>
            <button className="agent-pane-toggle" type="button" onClick={onToggleRight} aria-label={rightCollapsed ? "展开右侧边栏" : "收起右侧边栏"} title={rightCollapsed ? "展开右侧边栏" : "收起右侧边栏"}>
              <WorkbenchIcon name="panelRight" size={16} />
            </button>
          </div>
          <button className="agent-icon-button" type="button" aria-label="更多"><WorkbenchIcon name="dots" size={16} /></button>
          <button className="agent-ghost-button" type="button">分享</button>
        </div>
      </header>

      <div className="agent-center-body">
        <div className="agent-conversation">
          <div className="agent-conversation-inner">
            <div className="agent-user-message">把 LFAA 的工作台做成简洁、稳定、适合长时间工作的 Agent 界面。</div>
            <article className="agent-answer">
              <p>当前 Web 工作台已经切换到更接近 ChatGPT / Codex 的生产力工具布局。重点是信息层级、侧栏收放、拖拽阻尼和底部终端停靠，而不是装饰性视觉。</p>
              <h2>当前 UI 目标</h2>
              <ul>
                <li>左侧承载导航、项目和最近任务；</li>
                <li>中间保持主要工作区和对话上下文；</li>
                <li>右侧放工具入口、运行状态和 <code>.lfaa</code> 热插拔资源；</li>
                <li>侧栏只通过拖拽分隔条完成拉伸 / 吸附，不在分隔条上叠加点击按钮；</li>
                <li>左上 / 右上使用淡入式控制按钮完成展开 / 收起；</li>
                <li>底部中间提供终端停靠区，作为后续 Agent Run / Shell 接入位置。</li>
              </ul>
              <div className="agent-answer-note"><WorkbenchIcon name="spark" size={16} /><span>当前仍是开发壳：后续 Config、Agent Run、真实 Terminal 和文件能力会逐步接入。</span></div>
            </article>
          </div>
        </div>

        <section className={`agent-terminal-dock ${terminalOpen ? "is-open" : "is-closed"}`} aria-label="终端">
          <header className="agent-terminal-header">
            <div className="agent-terminal-title"><WorkbenchIcon name="terminal" size={15} /><strong>终端</strong><span>本地开发</span></div>
            <div className="agent-terminal-actions">
              <span className="agent-terminal-state">idle</span>
              <button className="agent-ghost-button agent-ghost-button--small" type="button" onClick={onToggleTerminal}>{terminalOpen ? "收起" : "展开"}</button>
            </div>
          </header>
          <div className="agent-terminal-body">
            {terminalLines.map((line) => <code key={line}>{line}</code>)}
          </div>
        </section>
      </div>

      <div className="agent-composer-wrap">
        <div className="agent-composer">
          <textarea aria-label="输入任务" placeholder="随心输入" rows={1} />
          <div className="agent-composer-actions">
            <button className="agent-composer-icon" type="button" aria-label="添加"><WorkbenchIcon name="plus" /></button>
            <span className="agent-permission">Ask</span>
            <span className="agent-model">GPT-5.6 Sol</span>
            <button className="agent-send" type="button" aria-label="发送">↑</button>
          </div>
        </div>
        <small>本地开发壳 · UI 状态只保存在浏览器 · Secret 不进入 Web</small>
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
        <span className={`agent-bridge agent-bridge--${resourceBridgeStatus}`}><i />{statusText}</span>
      </header>

      <div className="agent-tool-list" aria-label="工具快捷入口">
        <button type="button"><WorkbenchIcon name="review" /><span>审查</span><kbd>Ctrl+Shift+G</kbd></button>
        <button type="button" className={terminalOpen ? "is-active" : ""} onClick={onToggleTerminal}><WorkbenchIcon name="terminal" /><span>终端</span><kbd>Ctrl+`</kbd></button>
        <button type="button"><WorkbenchIcon name="browser" /><span>浏览器</span><kbd>Ctrl+T</kbd></button>
        <button type="button"><WorkbenchIcon name="file" /><span>文件</span><kbd>Ctrl+P</kbd></button>
      </div>

      <div className="agent-resource-head"><span>项目资源</span><b>{resources.length}</b></div>
      <div className="agent-resource-groups">
        {groups.map(({ kind, items }) => (
          <section key={kind}>
            <header><span>{resourceLabels[kind]}</span><b>{items.length}</b></header>
            {items.length === 0
              ? <p className="agent-empty">.lfaa/{kind}</p>
              : items.map((item) => <div className="agent-resource" key={`${kind}:${item.relativePath}`}><WorkbenchIcon name={item.entryType === "directory" ? "folder" : "file"} size={15} /><div><strong>{item.name}</strong><small>{item.relativePath}</small></div></div>)}
          </section>
        ))}
      </div>

      <div className="agent-dev-note"><strong>只读开发桥接</strong><p>仅显示资源名称与相对路径，不读取正文、Token 或 Secret。</p></div>
    </aside>
  );
}

export function AgentWorkbench(props: AgentWorkbenchProps) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [chrome, setChrome] = useState<ChromeState>(initialChrome);

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(CHROME_KEY, JSON.stringify(chrome));
  }, [chrome]);

  return (
    <div className="agent-theme" data-theme={theme}>
      <ResizableWorkbench
        left={<LeftSidebar theme={theme} onToggleTheme={() => setTheme((value) => value === "light" ? "dark" : "light")} />}
        center={
          <CenterWorkspace
            leftCollapsed={chrome.leftCollapsed}
            rightCollapsed={chrome.rightCollapsed}
            terminalOpen={chrome.terminalOpen}
            onToggleLeft={() => setChrome((value) => ({ ...value, leftCollapsed: !value.leftCollapsed }))}
            onToggleRight={() => setChrome((value) => ({ ...value, rightCollapsed: !value.rightCollapsed }))}
            onToggleTerminal={() => setChrome((value) => ({ ...value, terminalOpen: !value.terminalOpen }))}
          />
        }
        right={<RightSidebar {...props} terminalOpen={chrome.terminalOpen} onToggleTerminal={() => setChrome((value) => ({ ...value, terminalOpen: !value.terminalOpen }))} />}
        leftLimits={LEFT_LIMITS}
        rightLimits={RIGHT_LIMITS}
        snapHysteresis={24}
        minCenterWidth={520}
        leftCollapsed={chrome.leftCollapsed}
        rightCollapsed={chrome.rightCollapsed}
        onLeftCollapsedChange={(leftCollapsed) => setChrome((value) => value.leftCollapsed === leftCollapsed ? value : { ...value, leftCollapsed })}
        onRightCollapsedChange={(rightCollapsed) => setChrome((value) => value.rightCollapsed === rightCollapsed ? value : { ...value, rightCollapsed })}
      />
    </div>
  );
}

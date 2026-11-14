/**
 * 文件：ApplicationWorkbenchTabs.tsx
 * 功能：呈现中心聊天/右侧工具页签、选择和关闭控件。
 * 作用：管理视图事件呈现并调用工作区回调；Tab 与 Browser 数据仍归 Utility Tabs Owner。
 * 关联文件：../../ApplicationWorkspace.tsx、../hooks/useWorkspaceUtilityTabs.ts、../types.ts。
 */
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Popover } from "antd";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { browserAddressForDisplay, browserSiteHost, aiHostTaskShellLabel } from "../pure-utils.js";
import type { BrowserOpenTab, WorkspaceUtilityTab } from "../types.js";
import type { SidebarRightSnapshot } from "../../sidebar-right-runtime.js";
import type { UserSettings } from "lfaa-client-connection/src/api.js";

type BrowserPreviewRequest = { tabId: string; requestId: number };
type BrowserPreviewImage = BrowserPreviewRequest & { dataUrl: string };

export interface ApplicationWorkbenchTabsProps {
  tabs: WorkspaceUtilityTab[];
  activeTab: WorkspaceUtilityTab | null;
  activeCenterCollapsed: boolean;
  activeSessionTitle: string | null;
  browserOpenTabs: BrowserOpenTab[];
  sidebarRight: SidebarRightSnapshot;
  rightPanelSection: "context" | "applications";
  settings: UserSettings;
  previewOpenId: string;
  previewRequest: BrowserPreviewRequest | null;
  previewImage: BrowserPreviewImage | null;
  onChatPreviewOpenChange: (open: boolean) => void;
  onTabPreviewOpen: (tab: WorkspaceUtilityTab, selectedTab: string) => void;
  onPreviewClose: (tabId: string) => void;
  onSelectWorkbenchTab: (tabId: string) => void;
  onSelectRightUtilityTab: (tab: WorkspaceUtilityTab) => void;
  onToggleCenterCollapsed: () => void;
  onCloseUtilityTab: (tabId: string) => void;
  onCreateUtilityTab: () => void;
}

export function ApplicationWorkbenchTabs({ tabs, activeTab, activeCenterCollapsed, activeSessionTitle, browserOpenTabs, sidebarRight, rightPanelSection, settings, previewOpenId, previewRequest, previewImage, onChatPreviewOpenChange, onTabPreviewOpen, onPreviewClose, onSelectWorkbenchTab, onSelectRightUtilityTab, onToggleCenterCollapsed, onCloseUtilityTab, onCreateUtilityTab }: ApplicationWorkbenchTabsProps) {
  const selectedTab = activeCenterCollapsed ? activeTab?.id ?? "chat" : activeTab?.id ?? "";
  const titleFor = (tab: WorkspaceUtilityTab) => {
    if (tab.kind === "new" && tab.browserUrl) {
      const activeBrowserTab = browserOpenTabs.find(item => item.active);
      if (activeBrowserTab?.url === tab.browserUrl && activeBrowserTab.title.trim()) return activeBrowserTab.title.trim();
      return browserSiteHost(tab.browserUrl);
    }
    if (tab.kind === "new") return "新标签页";
    if (tab.kind === "git") return "变更";
    if (tab.kind === "assets") return "资产库";
    if (tab.kind === "applications") return "应用";
    if (tab.kind === "side-chat") return "侧边聊天";
    if (tab.kind === "project-file") return tab.filePath?.split("/").at(-1) || "项目文件";
    if (tab.kind === "session-files") return "会话文件";
    if (tab.kind === "agent-host-task") return `${aiHostTaskShellLabel(tab.hostTaskSnapshot?.shell ?? "system")} 任务`;
    const extension = sidebarRight.tabs.find(item => item.id === tab.extensionId);
    return extension ? (typeof extension.title === "function" ? extension.title() : extension.title) : "扩展面板";
  };
  const renderPreview = (tabId: string, title: string, kind: WorkspaceUtilityTab["kind"], browserUrl?: string) => {
    const activeBrowserTab = browserOpenTabs.find(item => item.active);
    const hasMatchingBrowserPage = Boolean(browserUrl && activeBrowserTab?.url === browserUrl && selectedTab === tabId && rightPanelSection === "context" && sidebarRight.activeId === null);
    const description = tabId === "chat" ? "当前工作区"
      : kind === "new" ? hasMatchingBrowserPage ? browserAddressForDisplay(browserUrl!, settings.browserUse.showFullUrl, false) : "浏览器标签页"
        : kind === "project-file" ? "项目文件"
          : kind === "session-files" ? "当前会话的文件列表"
            : kind === "agent-host-task" ? "真实节点任务输出"
              : kind === "git" ? "项目变更"
                : kind === "assets" ? "项目素材"
                  : kind === "applications" ? "应用列表"
                    : kind === "side-chat" ? "侧边聊天"
                      : kind === "extension" ? "扩展面板" : "工作区";
    const preview = previewImage?.tabId === tabId && previewImage.requestId === previewRequest?.requestId ? previewImage.dataUrl : null;
    const icon = tabId === "chat" ? "spark" : kind === "new" ? "browser" : kind === "git" ? "branch" : kind === "assets" ? "archive" : kind === "applications" ? "grid" : kind === "project-file" || kind === "session-files" ? "file" : kind === "agent-host-task" ? "terminal" : kind === "extension" ? "extension" : kind === "side-chat" ? "help" : "spark";
    return <div className="module-workbench-tab-preview">
      <div className="module-workbench-tab-preview__heading"><WorkbenchIcon name={icon} size={16} /><div><strong>{title}</strong><span>{description}</span></div></div>
      {preview ? <img className="module-workbench-tab-preview__image" src={preview} alt={`${title}页面预览`} />
        : <div className="module-workbench-tab-preview__empty"><WorkbenchIcon name={tabId === "chat" ? "spark" : kind === "new" ? "browser" : "spark"} size={19} /><span>{tabId === "chat" ? "当前会话工作区" : hasMatchingBrowserPage ? "正在载入当前页面预览…" : kind === "new" ? "当前标签暂无网页画面" : "该面板不提供网页缩略图"}</span></div>}
    </div>;
  };
  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, tabId: string) => {
    const order = [...(activeCenterCollapsed ? ["chat"] : []), ...tabs.map(tab => tab.id)];
    const index = order.indexOf(tabId);
    const targetIndex = event.key === "Home" ? 0 : event.key === "End" ? order.length - 1 : event.key === "ArrowRight" ? (index + 1) % order.length : event.key === "ArrowLeft" ? (index - 1 + order.length) % order.length : -1;
    if (targetIndex < 0) return;
    event.preventDefault();
    const target = order[targetIndex];
    document.getElementById(`module-workbench-tab-${target}`)?.focus();
    if (activeCenterCollapsed) onSelectWorkbenchTab(target);
    else { const targetTab = tabs.find(tab => tab.id === target); if (targetTab) onSelectRightUtilityTab(targetTab); }
  };
  const iconFor = (kind: WorkspaceUtilityTab["kind"]) => kind === "new" ? "browser" : kind === "git" ? "branch" : kind === "assets" ? "archive" : kind === "applications" ? "grid" : kind === "side-chat" ? "help" : kind === "extension" ? "extension" : kind === "project-file" || kind === "session-files" ? "file" : kind === "agent-host-task" ? "terminal" : "new";

  return <div className="module-workbench-tabstrip">
    <nav className="module-workbench-tabs module-workbench-tabs--context" role="tablist" aria-label="工作区标签">
      {activeCenterCollapsed ? <Popover arrow={false} content={renderPreview("chat", activeSessionTitle?.trim() || "LFAA 工作台", "new")} open={previewOpenId === "chat"} onOpenChange={onChatPreviewOpenChange} overlayClassName="module-workbench-tab-preview-popover" placement="bottomLeft" trigger={["hover", "focus"]} mouseEnterDelay={0.35} mouseLeaveDelay={0.12}>
        <button id="module-workbench-tab-chat" className="module-workbench-tab" type="button" role="tab" aria-selected={selectedTab === "chat"} aria-controls="module-workbench-tab-panel" tabIndex={selectedTab === "chat" ? 0 : -1} onClick={() => { onPreviewClose("chat"); onSelectWorkbenchTab("chat"); }} onKeyDown={event => handleTabKeyDown(event, "chat")} aria-label={activeSessionTitle?.trim() || "小鱼智能体"} title={activeSessionTitle?.trim() || "小鱼智能体"}><WorkbenchIcon name="spark" size={14} /><span>{activeSessionTitle?.trim() || "小鱼智能体"}</span></button>
      </Popover> : null}
      {tabs.map(tab => {
        const title = titleFor(tab); const selected = selectedTab === tab.id;
        return <Popover key={tab.id} arrow={false} content={renderPreview(tab.id, title, tab.kind, tab.browserUrl)} open={previewOpenId === tab.id} onOpenChange={open => open ? onTabPreviewOpen(tab, selectedTab) : onPreviewClose(tab.id)} overlayClassName="module-workbench-tab-preview-popover" placement="bottomLeft" trigger={["hover", "focus"]} mouseEnterDelay={0.35} mouseLeaveDelay={0.12}>
          <div className={`module-workbench-tab-item${selected ? " is-active" : ""}`} role="presentation">
            <button id={`module-workbench-tab-${tab.id}`} className="module-workbench-tab" type="button" role="tab" aria-selected={selected} aria-controls="module-workbench-tab-panel" tabIndex={selected ? 0 : -1} onClick={() => { onPreviewClose(tab.id); activeCenterCollapsed ? onSelectWorkbenchTab(tab.id) : onSelectRightUtilityTab(tab); }} onDoubleClick={onToggleCenterCollapsed} onKeyDown={event => handleTabKeyDown(event, tab.id)} aria-label={title} title={`${title} · 双击切换中间区`}><WorkbenchIcon name={iconFor(tab.kind)} size={14} /><span>{title}</span></button>
            <button className="module-workbench-tab-close" type="button" aria-label={`关闭${title}`} title={`关闭${title}`} tabIndex={selected ? 0 : -1} onClick={event => { event.stopPropagation(); onCloseUtilityTab(tab.id); }}><WorkbenchIcon name="close" size={12} /></button>
          </div>
        </Popover>;
      })}
    </nav>
    <button className="module-workbench-tab-add" type="button" aria-label="新建标签页" title="新建标签页" onClick={onCreateUtilityTab}><WorkbenchIcon name="plus" size={16} /></button>
  </div>;
}

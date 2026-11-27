// 浏览器工作台的订阅快照，集中描述四栏与插件贡献的公开读取状态。
import type { ReactNode } from "react";
import type {
  WorkbenchAccountActionContribution, WorkbenchBottomPanelContribution, WorkbenchChatProvider,
  WorkbenchChatSessionSummary, WorkbenchContextPanelContribution, WorkbenchProjectItem, WorkbenchProjectProvider,
  WorkbenchSectionItem, WorkbenchSectionProvider, WorkbenchShortcutState, WorkbenchTabContribution,
  WorkbenchTitleActionContribution, WorkbenchViewContribution, WorkbenchWorkspaceActionContribution,
} from "../contract/index";
import type { WorkspaceMode } from "./navigation/navigation";
import type { LibraryTabKey } from "./shell/library-tabs";
import type { LayoutMode } from "./shell/ui-preferences";

export interface WorkbenchSnapshot {
  activeView: string;
  activeProjectId: string | null;
  /** 设置中心关闭后返回的主视图。 */
  settingsReturnView: string | null;
  activeLibraryTab: LibraryTabKey;
  activeDomainItem: string;
  workspaceMode: WorkspaceMode;
  layoutMode: LayoutMode;
  leftSidebarOpen: boolean;
  rightPanelOpen: boolean;
  /** 预览区在左时，预览列可以独立收起。 */
  previewPaneOpen: boolean;
  bottomPanelOpen: boolean;
  bottomPanels: WorkbenchBottomPanelContribution<ReactNode>[];
  rightWorkbenchWide: boolean;
  rightPanelMaximized: boolean;
  views: WorkbenchViewContribution<ReactNode>[];
  tabs: WorkbenchTabContribution<ReactNode>[];
  contextPanels: WorkbenchContextPanelContribution<ReactNode>[];
  accountActions: WorkbenchAccountActionContribution<ReactNode>[];
  titleActions: WorkbenchTitleActionContribution<ReactNode>[];
  workspaceActions: WorkbenchWorkspaceActionContribution<ReactNode>[];
  projectProvider: WorkbenchProjectProvider<ReactNode> | null;
  projects: WorkbenchProjectItem[];
  sectionProvider: WorkbenchSectionProvider<ReactNode> | null;
  sections: WorkbenchSectionItem[];
  chatProvider: WorkbenchChatProvider<ReactNode> | null;
  chatSessions: WorkbenchChatSessionSummary[];
  activeChatSessionId: string | null;
  shortcuts: WorkbenchShortcutState[];
}

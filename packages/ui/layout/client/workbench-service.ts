// 在浏览器 Cordis 上下文中注册并管理四栏工作台服务与插件贡献生命周期。
import { type Context, Service } from "@deepseek-ai/cordis";
import type { ReactNode } from "react";
import type {
  WorkbenchAccountActionContribution,
  WorkbenchChatProvider,
  WorkbenchChatSessionSummary,
  WorkbenchContextPanelContribution,
  WorkbenchProjectItem,
  WorkbenchProjectProvider,
  WorkbenchSectionItem,
  WorkbenchSectionProvider,
  WorkbenchTitleActionContribution,
  WorkbenchViewContribution,
  WorkbenchWorkspaceActionContribution,
} from "../contract/index";
import {
  LEFT_SIDEBAR_STORAGE_KEY,
  LIBRARY_TAB_STORAGE_KEY,
  RIGHT_PANEL_STORAGE_KEY,
  readActiveRoutePref,
  readBooleanPref,
  readSettingsViewPref,
  readStoredJson,
  readWorkspaceModePref,
  writeActiveRoutePref,
  writeBooleanPref,
  writeSettingsViewPref,
  writeStoredJson,
  writeWorkspaceModePref,
} from "./shell/ui-preferences";
import { isSettingsView, type WorkspaceMode } from "./navigation/navigation";

/** 约定资料库分类在工作台中的稳定标识；`media` 为并入资料库的图像（生成素材）分类。 */
export type LibraryTabKey = "all" | "media" | "artifact" | "asset" | "memory";

const LIBRARY_TABS: readonly LibraryTabKey[] = ["all", "media", "artifact", "asset", "memory"];

/** 校验浏览器记忆里的资料库分类，非法值回退到全部。 */
function isLibraryTabKey(value: unknown): value is LibraryTabKey {
  return typeof value === "string" && (LIBRARY_TABS as readonly string[]).includes(value);
}

/** 约定视图树从工作台服务订阅的状态快照。 */
export interface WorkbenchSnapshot {
  activeView: string;
  activeProjectId: string | null;
  /**
   * 设置中心打开时，关闭后要回到的主视图（背景视图）。
   * 刷新恢复设置弹窗时背景路由取自本地偏好，因此需要显式带给 Shell。
   */
  settingsReturnView: string | null;
  activeLibraryTab: LibraryTabKey;
  activeDomainItem: string;
  /** 聊天中心区的「聊天 / 工作」：决定中心区形态与输入栏信息密度，由 service 统一持有。 */
  workspaceMode: WorkspaceMode;
  leftSidebarOpen: boolean;
  rightPanelOpen: boolean;
  rightWorkbenchWide: boolean;
  rightPanelMaximized: boolean;
  views: WorkbenchViewContribution<ReactNode>[];
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
}

// 统一持有四栏导航、折叠状态及插件注册表；注册项随返回的清理函数撤销。
// 资料库分类与当前路由一样写入浏览器偏好，刷新后仍停在左二选中的分类。
export class WorkbenchClientService extends Service {
  private readonly listeners = new Set<() => void>();
  private readonly viewMap = new Map<string, WorkbenchViewContribution<ReactNode>>();
  private readonly panelMap = new Map<string, WorkbenchContextPanelContribution<ReactNode>>();
  private readonly accountActionMap = new Map<string, WorkbenchAccountActionContribution<ReactNode>>();
  private readonly titleActionMap = new Map<string, WorkbenchTitleActionContribution<ReactNode>>();
  private readonly workspaceActionMap = new Map<string, WorkbenchWorkspaceActionContribution<ReactNode>>();
  private projectProviderValue: WorkbenchProjectProvider<ReactNode> | null = null;
  private unsubscribeProjects: (() => void) | null = null;
  private sectionProviderValue: WorkbenchSectionProvider<ReactNode> | null = null;
  private unsubscribeSections: (() => void) | null = null;
  private chatProviderValue: WorkbenchChatProvider<ReactNode> | null = null;
  private unsubscribeChats: (() => void) | null = null;
  private activeViewValue: string;
  private activeProjectIdValue: string | null;
  private settingsReturnViewValue: string | null = null;
  private activeLibraryTabValue: LibraryTabKey = "all";
  private activeDomainItemValue = "";
  private workspaceModeValue: WorkspaceMode = readWorkspaceModePref();
  private leftSidebarOpenValue = readBooleanPref(LEFT_SIDEBAR_STORAGE_KEY, true);
  private rightPanelOpenValue = readBooleanPref(RIGHT_PANEL_STORAGE_KEY, true);
  private rightWorkbenchWideValue = false;
  private rightPanelMaximizedValue = false;
  private cachedSnapshot: WorkbenchSnapshot | null = null;

  constructor(ctx: Context) {
    super(ctx, "workbench");
    // 分类标签已并入左二，刷新后仍恢复上次查看的分类。
    const storedTab = readStoredJson<unknown>(LIBRARY_TAB_STORAGE_KEY, null);
    if (isLibraryTabKey(storedTab)) this.activeLibraryTabValue = storedTab;
    const initialRoute = readActiveRoutePref();
    const mainView = isSettingsView(initialRoute.activeView) ? "workspace" : initialRoute.activeView;
    // 「图像」入口已并入资料库：旧路由恢复时落到资料库的图像分类，并把归一化结果写回偏好。
    if (mainView === "images") {
      this.activeViewValue = "library";
      this.activeProjectIdValue = null;
      this.activeLibraryTabValue = "media";
      writeActiveRoutePref("library", null);
      writeStoredJson(LIBRARY_TAB_STORAGE_KEY, "media");
      return;
    }
    this.activeViewValue = mainView;
    this.activeProjectIdValue = initialRoute.activeProjectId;
    // 设置中心是弹窗：恢复上次停留的设置子页，背景仍是偏好里的主视图与项目上下文。
    const storedSettingsView = readSettingsViewPref();
    if (storedSettingsView) {
      this.activeViewValue = storedSettingsView;
      this.settingsReturnViewValue = mainView;
    } else if (isSettingsView(initialRoute.activeView)) {
      // 旧版本可能把设置视图写进了主路由，这里把它当作已关闭并修正偏好。
      writeActiveRoutePref("workspace", null);
      this.activeProjectIdValue = null;
    }
  }

  private emit(): void {
    this.cachedSnapshot = null;
    for (const listener of this.listeners) listener();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): WorkbenchSnapshot => {
    if (this.cachedSnapshot) return this.cachedSnapshot;
    const contextPanels = [...this.panelMap.values()].sort(
      (left, right) => (left.order ?? 0) - (right.order ?? 0),
    );
    const accountActions = [...this.accountActionMap.values()].sort(
      (left, right) => (left.order ?? 0) - (right.order ?? 0),
    );
    const titleActions = [...this.titleActionMap.values()].sort(
      (left, right) => (left.order ?? 0) - (right.order ?? 0),
    );
    const workspaceActions = [...this.workspaceActionMap.values()].sort(
      (left, right) => (left.order ?? 0) - (right.order ?? 0),
    );
    const chatSessions = this.chatProviderValue ? this.chatProviderValue.getSessions() : [];
    const activeChatSessionId = this.chatProviderValue ? this.chatProviderValue.getActiveSessionId() : null;
    const rawProjects = this.projectProviderValue ? this.projectProviderValue.getProjects() : [];
    const countMap = new Map<string, number>();
    for (const session of chatSessions) {
      if (session.archived || !session.projectId) continue;
      countMap.set(session.projectId, (countMap.get(session.projectId) ?? 0) + 1);
    }
    const projects = rawProjects.map((project) => ({
      ...project,
      chatCount: this.chatProviderValue ? (countMap.get(project.id) ?? 0) : (project.chatCount ?? 0),
    }));

    this.cachedSnapshot = {
      activeView: this.activeViewValue,
      activeProjectId: this.activeProjectIdValue,
      settingsReturnView: this.settingsReturnViewValue,
      activeLibraryTab: this.activeLibraryTabValue,
      activeDomainItem: this.activeDomainItemValue,
      workspaceMode: this.workspaceModeValue,
      leftSidebarOpen: this.leftSidebarOpenValue,
      rightPanelOpen: this.rightPanelOpenValue,
      rightWorkbenchWide: this.rightWorkbenchWideValue,
      rightPanelMaximized: this.rightPanelMaximizedValue,
      views: [...this.viewMap.values()],
      contextPanels,
      accountActions,
      titleActions,
      workspaceActions,
      projectProvider: this.projectProviderValue,
      projects,
      sectionProvider: this.sectionProviderValue,
      sections: this.sectionProviderValue ? this.sectionProviderValue.getSections() : [],
      chatProvider: this.chatProviderValue,
      chatSessions,
      activeChatSessionId,
    };
    return this.cachedSnapshot;
  };

  registerView(contribution: WorkbenchViewContribution<ReactNode>): () => void {
    this.viewMap.set(contribution.id, contribution);
    this.emit();
    return () => {
      if (this.viewMap.get(contribution.id) === contribution) {
        this.viewMap.delete(contribution.id);
        this.emit();
      }
    };
  }

  registerContextPanel(contribution: WorkbenchContextPanelContribution<ReactNode>): () => void {
    this.panelMap.set(contribution.id, contribution);
    this.emit();
    return () => {
      if (this.panelMap.get(contribution.id) === contribution) {
        this.panelMap.delete(contribution.id);
        this.emit();
      }
    };
  }

  registerAccountAction(contribution: WorkbenchAccountActionContribution<ReactNode>): () => void {
    this.accountActionMap.set(contribution.id, contribution);
    this.emit();
    return () => {
      if (this.accountActionMap.get(contribution.id) === contribution) {
        this.accountActionMap.delete(contribution.id);
        this.emit();
      }
    };
  }

  // 标题右侧的状态控件（如会话模式）与右侧动作分开登记，避免挤占工作台按钮位。
  registerTitleAction(contribution: WorkbenchTitleActionContribution<ReactNode>): () => void {
    this.titleActionMap.set(contribution.id, contribution);
    this.emit();
    return () => {
      if (this.titleActionMap.get(contribution.id) === contribution) {
        this.titleActionMap.delete(contribution.id);
        this.emit();
      }
    };
  }

  registerWorkspaceAction(contribution: WorkbenchWorkspaceActionContribution<ReactNode>): () => void {
    this.workspaceActionMap.set(contribution.id, contribution);
    this.emit();
    return () => {
      if (this.workspaceActionMap.get(contribution.id) === contribution) {
        this.workspaceActionMap.delete(contribution.id);
        this.emit();
      }
    };
  }

  // 项目来源发生变化时重算工作台快照，卸载后解除原有订阅。
  registerProjectProvider(provider: WorkbenchProjectProvider<ReactNode>): () => void {
    this.unsubscribeProjects?.();
    this.projectProviderValue = provider;
    this.unsubscribeProjects = provider.subscribe(() => {
      this.emit();
    });
    this.emit();
    return () => {
      if (this.projectProviderValue === provider) {
        this.unsubscribeProjects?.();
        this.unsubscribeProjects = null;
        this.projectProviderValue = null;
        if (this.activeViewValue === "project") {
          this.activeViewValue = "workspace";
          this.activeProjectIdValue = null;
        }
        this.emit();
      }
    };
  }

  registerSectionProvider(provider: WorkbenchSectionProvider<ReactNode>): () => void {
    this.unsubscribeSections?.();
    this.sectionProviderValue = provider;
    this.unsubscribeSections = provider.subscribe(() => {
      this.emit();
    });
    this.emit();
    return () => {
      if (this.sectionProviderValue === provider) {
        this.unsubscribeSections?.();
        this.unsubscribeSections = null;
        this.sectionProviderValue = null;
        this.emit();
      }
    };
  }

  registerChatProvider(provider: WorkbenchChatProvider<ReactNode>): () => void {
    this.unsubscribeChats?.();
    this.chatProviderValue = provider;
    this.unsubscribeChats = provider.subscribe(() => {
      this.emit();
    });
    this.emit();
    return () => {
      if (this.chatProviderValue === provider) {
        this.unsubscribeChats?.();
        this.unsubscribeChats = null;
        this.chatProviderValue = null;
        this.emit();
      }
    };
  }

  navigate(view: string, projectId: string | null = null): void {
    if (isSettingsView(view)) {
      // 设置中心是压在工作区之上的弹窗：只记录子页，背景路由与项目上下文保持不变，
      // 这样 F5 后仍停在同一个设置子页，关闭后也回到原来的工作位置。
      this.activeViewValue = view;
      this.settingsReturnViewValue = this.settingsReturnViewValue ?? this.resolveBackgroundView();
      writeSettingsViewPref(view);
      this.emit();
      return;
    }
    this.activeViewValue = view;
    this.activeProjectIdValue = projectId;
    this.settingsReturnViewValue = null;
    writeActiveRoutePref(view, projectId);
    writeSettingsViewPref(null);
    this.emit();
  }

  /** 设置中心打开前的背景主视图；服务刚启动时回退到偏好里的路由。 */
  private resolveBackgroundView(): string {
    if (!isSettingsView(this.activeViewValue)) return this.activeViewValue;
    const route = readActiveRoutePref();
    return isSettingsView(route.activeView) ? "workspace" : route.activeView;
  }

  openProject(projectId: string): void {
    this.activeViewValue = "project";
    this.activeProjectIdValue = projectId;
    this.settingsReturnViewValue = null;
    writeActiveRoutePref("project", projectId);
    writeSettingsViewPref(null);
    this.emit();
  }

  /** 仅切换当前选中的项目上下文（不跳走视图），并写入路由偏好以便刷新恢复。 */
  setActiveProject(projectId: string | null): void {
    if (this.activeProjectIdValue === projectId) return;
    this.activeProjectIdValue = projectId;
    if (!isSettingsView(this.activeViewValue)) {
      writeActiveRoutePref(this.activeViewValue, projectId);
    }
    this.emit();
  }

  setLeftSidebarOpen(open: boolean, persist = true): void {
    if (this.leftSidebarOpenValue === open) return;
    this.leftSidebarOpenValue = open;
    if (persist) writeBooleanPref(LEFT_SIDEBAR_STORAGE_KEY, open);
    this.emit();
  }

  /** 切换「聊天 / 工作」：中心区据此切换标题、输入栏形态与提示，偏好写入浏览器记忆。 */
  setWorkspaceMode(mode: WorkspaceMode, persist = true): void {
    if (this.workspaceModeValue === mode) return;
    this.workspaceModeValue = mode;
    if (persist) writeWorkspaceModePref(mode);
    this.emit();
  }

  toggleLeftSidebar(): void {
    this.setLeftSidebarOpen(!this.leftSidebarOpenValue);
  }

  setRightPanelOpen(open: boolean, persist = true): void {
    if (this.rightPanelOpenValue === open) return;
    this.rightPanelOpenValue = open;
    if (!open) this.rightPanelMaximizedValue = false;
    if (persist) writeBooleanPref(RIGHT_PANEL_STORAGE_KEY, open);
    this.emit();
  }

  toggleRightPanel(): void {
    this.setRightPanelOpen(!this.rightPanelOpenValue);
  }

  setRightPanelMaximized(maximized: boolean): void {
    if (this.rightPanelMaximizedValue === maximized && (!maximized || this.rightPanelOpenValue)) return;
    this.rightPanelMaximizedValue = maximized;
    if (maximized && !this.rightPanelOpenValue) {
      this.rightPanelOpenValue = true;
      writeBooleanPref(RIGHT_PANEL_STORAGE_KEY, true);
    }
    this.emit();
  }

  toggleRightPanelMaximized(): void {
    this.setRightPanelMaximized(!this.rightPanelMaximizedValue);
  }

  setRightWorkbenchWide(wide: boolean): void {
    if (this.rightWorkbenchWideValue === wide) return;
    this.rightWorkbenchWideValue = wide;
    this.emit();
  }

  setLibraryTab(tab: LibraryTabKey): void {
    if (this.activeLibraryTabValue === tab) return;
    this.activeLibraryTabValue = tab;
    writeStoredJson(LIBRARY_TAB_STORAGE_KEY, tab);
    this.emit();
  }

  setDomainItem(itemId: string): void {
    if (this.activeDomainItemValue === itemId) return;
    this.activeDomainItemValue = itemId;
    this.emit();
  }
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    workbench: WorkbenchClientService;
  }
}

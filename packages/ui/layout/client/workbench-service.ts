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
  WorkbenchViewContribution,
} from "../src/index";
import {
  LEFT_SIDEBAR_STORAGE_KEY,
  RIGHT_PANEL_STORAGE_KEY,
  readActiveRoutePref,
  readBooleanPref,
  writeActiveRoutePref,
  writeBooleanPref,
} from "./ui-preferences";

export type LibraryTabKey = "all" | "artifact" | "asset" | "memory";

export interface WorkbenchSnapshot {
  activeView: string;
  activeProjectId: string | null;
  activeLibraryTab: LibraryTabKey;
  activeDomainItem: string;
  leftSidebarOpen: boolean;
  rightPanelOpen: boolean;
  views: WorkbenchViewContribution<ReactNode>[];
  contextPanels: WorkbenchContextPanelContribution<ReactNode>[];
  accountActions: WorkbenchAccountActionContribution<ReactNode>[];
  projectProvider: WorkbenchProjectProvider<ReactNode> | null;
  projects: WorkbenchProjectItem[];
  sectionProvider: WorkbenchSectionProvider<ReactNode> | null;
  sections: WorkbenchSectionItem[];
  chatProvider: WorkbenchChatProvider<ReactNode> | null;
  chatSessions: WorkbenchChatSessionSummary[];
  activeChatSessionId: string | null;
}

// 统一持有四栏导航、折叠状态及插件注册表；注册项随返回的清理函数撤销。
export class WorkbenchClientService extends Service {
  private readonly listeners = new Set<() => void>();
  private readonly viewMap = new Map<string, WorkbenchViewContribution<ReactNode>>();
  private readonly panelMap = new Map<string, WorkbenchContextPanelContribution<ReactNode>>();
  private readonly accountActionMap = new Map<string, WorkbenchAccountActionContribution<ReactNode>>();
  private projectProviderValue: WorkbenchProjectProvider<ReactNode> | null = null;
  private unsubscribeProjects: (() => void) | null = null;
  private sectionProviderValue: WorkbenchSectionProvider<ReactNode> | null = null;
  private unsubscribeSections: (() => void) | null = null;
  private chatProviderValue: WorkbenchChatProvider<ReactNode> | null = null;
  private unsubscribeChats: (() => void) | null = null;
  private activeViewValue: string;
  private activeProjectIdValue: string | null;
  private activeLibraryTabValue: LibraryTabKey = "all";
  private activeDomainItemValue = "";
  private leftSidebarOpenValue = readBooleanPref(LEFT_SIDEBAR_STORAGE_KEY, true);
  private rightPanelOpenValue = readBooleanPref(RIGHT_PANEL_STORAGE_KEY, true);
  private cachedSnapshot: WorkbenchSnapshot | null = null;

  constructor(ctx: Context) {
    super(ctx, "workbench");
    const initialRoute = readActiveRoutePref();
    this.activeViewValue = initialRoute.activeView;
    this.activeProjectIdValue = initialRoute.activeProjectId;
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
      activeLibraryTab: this.activeLibraryTabValue,
      activeDomainItem: this.activeDomainItemValue,
      leftSidebarOpen: this.leftSidebarOpenValue,
      rightPanelOpen: this.rightPanelOpenValue,
      views: [...this.viewMap.values()],
      contextPanels,
      accountActions,
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
    this.activeViewValue = view;
    this.activeProjectIdValue = projectId;
    writeActiveRoutePref(view, projectId);
    this.emit();
  }

  openProject(projectId: string): void {
    this.activeViewValue = "project";
    this.activeProjectIdValue = projectId;
    writeActiveRoutePref("project", projectId);
    this.emit();
  }

  setLeftSidebarOpen(open: boolean, persist = true): void {
    if (this.leftSidebarOpenValue === open) return;
    this.leftSidebarOpenValue = open;
    if (persist) writeBooleanPref(LEFT_SIDEBAR_STORAGE_KEY, open);
    this.emit();
  }

  toggleLeftSidebar(): void {
    this.setLeftSidebarOpen(!this.leftSidebarOpenValue);
  }

  setRightPanelOpen(open: boolean, persist = true): void {
    if (this.rightPanelOpenValue === open) return;
    this.rightPanelOpenValue = open;
    if (persist) writeBooleanPref(RIGHT_PANEL_STORAGE_KEY, open);
    this.emit();
  }

  toggleRightPanel(): void {
    this.setRightPanelOpen(!this.rightPanelOpenValue);
  }

  setLibraryTab(tab: LibraryTabKey): void {
    if (this.activeLibraryTabValue === tab) return;
    this.activeLibraryTabValue = tab;
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

// 在浏览器 Cordis 上下文中注册并管理四栏工作台服务与插件贡献生命周期。
import { type Context, Service } from "@deepseek-ai/cordis";
import type { ReactNode } from "react";
import type {
  WorkbenchAccountActionContribution,
  WorkbenchBottomPanelContribution,
  WorkbenchChatProvider,
  WorkbenchContextPanelContribution,
  WorkbenchProjectProvider,
  WorkbenchSectionProvider,
  WorkbenchShortcutContribution,
  WorkbenchTitleActionContribution,
  WorkbenchTabContribution,
  WorkbenchViewContribution,
  WorkbenchWorkspaceActionContribution,
} from "../contract/index";
import { BottomPanelState } from "./shell/bottom-panel-state";
import { ShortcutState } from "./shortcut-state";
import {
  LEFT_SIDEBAR_STORAGE_KEY,
  LIBRARY_TAB_STORAGE_KEY,
  PREVIEW_PANE_STORAGE_KEY,
  RIGHT_PANEL_STORAGE_KEY,
  readActiveRoutePref,
  readBooleanPref,
  readLayoutModePref,
  readSettingsViewPref,
  readStoredJson,
  readWorkspaceModePref,
  writeActiveRoutePref,
  writeBooleanPref,
  writeLayoutModePref,
  writeSettingsViewPref,
  writeStoredJson,
  writeWorkspaceModePref,
  type LayoutMode,
} from "./shell/ui-preferences";
import { isSettingsView, type WorkspaceMode } from "./navigation/navigation";
import { runPaneAnimation } from "./shell/use-pane-anim";
import { isLibraryTabKey, type LibraryTabKey } from "./shell/library-tabs";
import type { WorkbenchSnapshot } from "./workbench-snapshot";

export type { LibraryTabKey } from "./shell/library-tabs";
export type { WorkbenchSnapshot } from "./workbench-snapshot";

// 统一持有四栏导航、折叠状态及插件注册表；注册项随返回的清理函数撤销。
// 资料库分类与当前路由一样写入浏览器偏好，刷新后仍停在左二选中的分类。
export class WorkbenchClientService extends Service {
  private readonly listeners = new Set<() => void>();
  private readonly viewMap = new Map<string, WorkbenchViewContribution<ReactNode>>();
  private readonly tabMap = new Map<string, WorkbenchTabContribution<ReactNode>>();
  private readonly panelMap = new Map<string, WorkbenchContextPanelContribution<ReactNode>>();
  private readonly accountActionMap = new Map<string, WorkbenchAccountActionContribution<ReactNode>>();
  private readonly titleActionMap = new Map<string, WorkbenchTitleActionContribution<ReactNode>>();
  private readonly workspaceActionMap = new Map<string, WorkbenchWorkspaceActionContribution<ReactNode>>();
  private readonly shortcutState = new ShortcutState();
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
  private layoutModeValue: LayoutMode = readLayoutModePref();
  private leftSidebarOpenValue = readBooleanPref(LEFT_SIDEBAR_STORAGE_KEY, true);
  private rightPanelOpenValue = readBooleanPref(RIGHT_PANEL_STORAGE_KEY, true);
  private previewPaneOpenValue = readBooleanPref(PREVIEW_PANE_STORAGE_KEY, true);
  private readonly bottomPanel = new BottomPanelState();
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
      layoutMode: this.layoutModeValue,
      leftSidebarOpen: this.leftSidebarOpenValue,
      rightPanelOpen: this.rightPanelOpenValue,
      previewPaneOpen: this.previewPaneOpenValue,
      bottomPanelOpen: this.bottomPanel.open,
      bottomPanels: this.bottomPanel.list,
      rightWorkbenchWide: this.rightWorkbenchWideValue,
      rightPanelMaximized: this.rightPanelMaximizedValue,
      views: [...this.viewMap.values()],
      tabs: [...this.tabMap.values()],
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
      shortcuts: this.shortcutState.list(),
    };
    return this.cachedSnapshot;
  };

  /** 登记一项工作台贡献：按 id 覆盖，撤销时只在自己仍是当前项时删除，热重载不会误删后注册的同名项。 */
  private registerContribution<T extends { id: string }>(map: Map<string, T>, contribution: T): () => void {
    map.set(contribution.id, contribution);
    this.emit();
    return () => {
      if (map.get(contribution.id) === contribution) {
        map.delete(contribution.id);
        this.emit();
      }
    };
  }

  registerView(contribution: WorkbenchViewContribution<ReactNode>): () => void {
    return this.registerContribution(this.viewMap, contribution);
  }

  registerTab(contribution: WorkbenchTabContribution<ReactNode>): () => void {
    return this.registerContribution(this.tabMap, contribution);
  }

  registerContextPanel(contribution: WorkbenchContextPanelContribution<ReactNode>): () => void {
    return this.registerContribution(this.panelMap, contribution);
  }

  registerBottomPanel(contribution: WorkbenchBottomPanelContribution<ReactNode>): () => void {
    this.bottomPanel.register(contribution);
    this.emit();
    return () => {
      this.bottomPanel.unregister(contribution.id);
      this.emit();
    };
  }

  setBottomPanelOpen(open: boolean, persist = true): void {
    if (this.bottomPanel.open === open) return;
    this.bottomPanel.setOpen(open, persist);
    this.emit();
  }

  registerAccountAction(contribution: WorkbenchAccountActionContribution<ReactNode>): () => void {
    return this.registerContribution(this.accountActionMap, contribution);
  }

  // 标题右侧的状态控件（如会话模式）与右侧动作分开登记，避免挤占工作台按钮位。
  registerTitleAction(contribution: WorkbenchTitleActionContribution<ReactNode>): () => void {
    return this.registerContribution(this.titleActionMap, contribution);
  }

  registerWorkspaceAction(contribution: WorkbenchWorkspaceActionContribution<ReactNode>): () => void {
    return this.registerContribution(this.workspaceActionMap, contribution);
  }

  // 快捷键注册：动作与当前生效键位一起进入快照，设置页与右键菜单据此展示与改键。
  registerShortcut(contribution: WorkbenchShortcutContribution): () => void {
    return this.registerContribution(this.shortcutState.map, contribution);
  }
  /** 改写某个动作的键位；null 表示清除绑定（该动作暂时没有快捷键）。 */
  setShortcutKeys(id: string, keys: string | null): void {
    this.shortcutState.setKeys(id, keys);
    this.emit();
  }

  /** 恢复某个动作的默认键位。 */
  resetShortcutKeys(id: string): void {
    this.shortcutState.resetKeys(id);
    this.emit();
  }

  /** 已注册动作的当前键位；动作不存在时返回 null。 */
  getShortcutKeys(id: string): string | null {
    return this.getSnapshot().shortcuts.find((item) => item.id === id)?.keys ?? null;
  }

  /** 执行已注册动作；全局按键与设置页试运行共用这一入口。 */
  runShortcut(id: string): boolean {
    const action = this.shortcutState.map.get(id);
    if (!action) return false;
    action.run();
    return true;
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

  /** 切换页面排版：聊天区在左（默认）或预览区在左；偏好写入浏览器记忆。 */
  setLayoutMode(mode: LayoutMode): void {
    if (this.layoutModeValue === mode) return;
    this.layoutModeValue = mode;
    writeLayoutModePref(mode);
    // 切到「预览区在左」时预览列必须重新展开：否则用户看到的只有会话列，没有打开的落点。
    if (mode === "preview-center" && !this.previewPaneOpenValue) {
      this.previewPaneOpenValue = true;
      writeBooleanPref(PREVIEW_PANE_STORAGE_KEY, true);
    }
    this.emit();
  }

  toggleLeftSidebar(): void {
    this.setLeftSidebarOpen(!this.leftSidebarOpenValue);
  }

  setRightPanelOpen(open: boolean, persist = true): void {
    // 「预览区在左」下右栏位置渲染的是 AI 会话列，工作台在中间列：改动会话列前先保证预览列在场。
    if (this.layoutModeValue === "preview-center" && !this.previewPaneOpenValue) {
      this.setPreviewPaneOpen(true, persist);
    }
    if (this.rightPanelOpenValue === open) return;
    this.rightPanelOpenValue = open;
    if (!open) this.rightPanelMaximizedValue = false;
    if (persist) writeBooleanPref(RIGHT_PANEL_STORAGE_KEY, open);
    this.emit();
  }

  /** 展开/收起预览列（「预览区在左」下承载工作台的那一列）：收起即把宽度全部让给 AI 会话列。 */
  setPreviewPaneOpen(open: boolean, persist = true): void {
    if (this.previewPaneOpenValue === open) return;
    this.previewPaneOpenValue = open;
    if (persist) writeBooleanPref(PREVIEW_PANE_STORAGE_KEY, open);
    // 预览列收起时若会话列也收着，先把会话列放出来，避免只剩背景色。
    if (!open && this.layoutModeValue === "preview-center" && !this.rightPanelOpenValue) {
      this.rightPanelOpenValue = true;
      if (persist) writeBooleanPref(RIGHT_PANEL_STORAGE_KEY, true);
    }
    this.emit();
  }

  /** 收起/展开最右侧的列。预览区在左时分屏才算「展开」：预览列收着时先把分屏补回来。 */
  toggleRightPanel(): void {
    if (this.layoutModeValue === "preview-center" && !this.previewPaneOpenValue) {
      this.setPreviewPaneOpen(true);
      return;
    }
    this.setRightPanelOpen(!this.rightPanelOpenValue);
  }

  setRightPanelMaximized(maximized: boolean): void {
    if (this.rightPanelMaximizedValue === maximized && (!maximized || this.rightPanelOpenValue)) return;
    // 最大化针对的是工作台：预览列收起时先把它放出来，否则只会得到一条 0 宽的会话列。
    if (maximized && this.layoutModeValue === "preview-center" && !this.previewPaneOpenValue) this.setPreviewPaneOpen(true);
    this.rightPanelMaximizedValue = maximized;
    if (maximized && !this.rightPanelOpenValue) {
      this.rightPanelOpenValue = true;
      writeBooleanPref(RIGHT_PANEL_STORAGE_KEY, true);
    }
    // 最大化/还原是整片排版切换：交给编排动画先定格再补间，失败时内部自动退回本次 emit。
    runPaneAnimation(() => this.emit());
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

// 复用同一套左二菜单栏骨架，根据 WorkbenchDomainConfig 切换头部形态与业务菜单内容。
import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  WorkbenchChatProvider,
  WorkbenchChatSessionSummary,
  WorkbenchProjectProvider,
  WorkbenchSectionItem,
  WorkbenchSectionProvider,
  WorkbenchViewContribution,
} from "../../contract/index";
import type { LocaleMessages } from "../locales";
import type { LocalProject, NavigationView, RecentItem, WorkspaceMode } from "./navigation";
import type { WorkbenchDomainConfig } from "./workbench-domains";
import type { LibraryTabKey } from "../workbench-service";
import { DomainSidebarMenu } from "./DomainSidebarMenu";
import { NavigationIcon } from "./NavigationIcon";
import { NavigationGroups } from "./NavigationGroups";
import { SettingsMenu } from "../panels/SettingsMenu";
import { CapsuleBar } from "@lfaa/ui-primitives/client";
import { ToolbarTip } from "./Toolbar-Tip";
import { formatShortcutKeys, readShortcutKeysFor } from "../shortcuts";
import { defaultShortcutKeys } from "../shortcut-defaults";
import styles from "./NavigationSidebar.module.css";

/** 根据业务域装配左栏头部及列表，将设置页和聊天页复用同一栏位。 */
export function NavigationSidebar({
  locale,
  domain,
  activeView,
  activeLibraryTab,
  activeDomainItem,
  pluginViews,
  newChatSelected,
  activeProjectId,
  activeChatSessionId,
  mode,
  projects,
  sections,
  recents,
  chatSessions,
  chatProvider,
  projectProvider,
  sectionProvider,
  searchOpen,
  activityOpen,
  compact = false,
  onCloseDrawer,
  onModeChange,
  onNewChat,
  onNewRecentChat,
  onNewChatInProject,
  onNewChatInSection,
  onSelectProjectContext,
  onSelectChatSession,
  onNavigate,
  onSelectLibraryTab,
  onSelectDomainItem,
  onOpenProject,
  onProjectCreated,
  onProjectUpdated,
  onProjectRemoved,
  onToggleSearch,
  onCloseSearch,
  onToggleActivity,
  onCloseActivity,
  sidebarMode,
  onChangeSidebarMode,
}: {
  locale: LocaleMessages;
  domain: WorkbenchDomainConfig;
  activeView: NavigationView;
  activeLibraryTab: LibraryTabKey;
  activeDomainItem: string;
  pluginViews: WorkbenchViewContribution<ReactNode>[];
  newChatSelected: boolean;
  activeProjectId: string | null;
  activeChatSessionId?: string | null | undefined;
  mode: WorkspaceMode;
  projects: LocalProject[];
  sections: WorkbenchSectionItem[];
  recents: RecentItem[];
  chatSessions?: WorkbenchChatSessionSummary[];
  chatProvider?: WorkbenchChatProvider<ReactNode> | null | undefined;
  projectProvider?: WorkbenchProjectProvider<ReactNode> | null | undefined;
  sectionProvider?: WorkbenchSectionProvider<ReactNode> | null | undefined;
  searchOpen: boolean;
  activityOpen: boolean;
  compact?: boolean;
  /** 左二当前内容：会话列表或项目工作区文件树。 */
  sidebarMode: "chats" | "project";
  onCloseDrawer?: () => void;
  onModeChange: (mode: WorkspaceMode) => void;
  onNewChat: () => void;
  onNewRecentChat?: (() => void) | undefined;
  onNewChatInProject: (project: LocalProject) => void;
  onNewChatInSection: (section: WorkbenchSectionItem) => void;
  onSelectProjectContext?: ((project: LocalProject) => void) | undefined;
  onSelectChatSession?: ((sessionId: string) => void) | undefined;
  onNavigate: (view: NavigationView) => void;
  onSelectLibraryTab: (tab: LibraryTabKey) => void;
  onSelectDomainItem: (id: string) => void;
  onOpenProject: (project: LocalProject) => void;
  onProjectCreated: (project: LocalProject) => void;
  onProjectUpdated: (project: LocalProject) => void;
  onProjectRemoved: (projectId: string) => void;
  onToggleSearch: () => void;
  onCloseSearch: () => void;
  onToggleActivity: () => void;
  onCloseActivity: () => void;
  /** 切换左二内容；两个工具栏按钮互斥切换，收起左二由中间栏按钮负责。 */
  onChangeSidebarMode: (mode: "chats" | "project") => void;
}) {
  const activityHint = formatShortcutKeys(readShortcutKeysFor("global.activity", defaultShortcutKeys("global.activity")));
  const searchHint = formatShortcutKeys(readShortcutKeysFor("global.search", defaultShortcutKeys("global.search")));
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const modeTriggerRef = useRef<HTMLButtonElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const activityTriggerRef = useRef<HTMLButtonElement>(null);
  const activityPanelRef = useRef<HTMLDivElement>(null);
  const wasSearchOpen = useRef(false);
  const wasActivityOpen = useRef(false);

  useEffect(() => {
    if (!modeMenuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setModeMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [modeMenuOpen]);

  useEffect(() => {
    if (!activityOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node
        && !activityPanelRef.current?.contains(event.target)
        && !activityTriggerRef.current?.contains(event.target)) onCloseActivity();
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [activityOpen, onCloseActivity]);

  useEffect(() => {
    if (wasSearchOpen.current && !searchOpen) searchTriggerRef.current?.focus();
    wasSearchOpen.current = searchOpen;
  }, [searchOpen]);

  useEffect(() => {
    if (wasActivityOpen.current && !activityOpen) activityTriggerRef.current?.focus();
    wasActivityOpen.current = activityOpen;
  }, [activityOpen]);

  const header = domain.sidebarHeader;
  const isModeSwitcher = header.kind === "modeSwitcher";
  // 项目工作区跟随当前项目上下文：优先左二高亮项目，其次当前会话所属项目，最后草稿绑定。
  const workspaceProjectId = activeProjectId
    ?? chatSessions?.find((session) => session.id === activeChatSessionId)?.projectId
    ?? null;

  return (
    <aside
      className={styles.sidebar}
      ref={rootRef}
      aria-label={domain.sidebarAriaLabel}
      data-region="section-navigation"
      onKeyDown={(event) => {
        if (event.key === "Escape" && modeMenuOpen) {
          event.stopPropagation();
          setModeMenuOpen(false);
          modeTriggerRef.current?.focus();
        } else if (event.key === "Escape" && activityOpen) {
          event.stopPropagation();
          onCloseActivity();
        }
      }}
    >
      <header className={styles.header} data-variant={isModeSwitcher ? "toolbar" : undefined}>
        {header.kind === "backTitle" ? (
          <div className={styles.settingsHeader}>
            <button
              className={styles.headerButton}
              type="button"
              aria-label={header.backLabel}
              title={header.backLabel}
              onClick={() => onNavigate(header.backView)}
            >
              <NavigationIcon name="arrowLeft" />
            </button>
            <span>{header.title}</span>
          </div>
        ) : header.kind === "sectionTitle" ? (
          <div className={styles.settingsHeader}>
            <span>{header.title}</span>
          </div>
        ) : (
          // 工作区头部改为悬浮工具栏：左侧「模式菜单 / 新聊天 / 收起侧栏」，右侧放「活动 / 搜索」。
          <CapsuleBar className={styles.toolbar}>
            <div className={styles.toolbarGroup}>
              <div className={styles.modeRoot}>
                <ToolbarTip label={`${locale.agentName} · ${locale.workspaceMode}`}>
                  <button
                    ref={modeTriggerRef}
                    className={`${styles.headerButton} ${styles.toolbarButton} ${modeMenuOpen ? styles.headerButtonActive : ""}`}
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={modeMenuOpen}
                    aria-label={locale.workspaceMode}
                    onClick={() => setModeMenuOpen((open) => !open)}
                  >
                    <NavigationIcon name="menu" />
                  </button>
                </ToolbarTip>
                {modeMenuOpen && (
                  <div className={styles.modeMenu} role="menu" aria-label={locale.workspaceMode}>
                    <ModeOption selected={mode === "chatgpt"} title={locale.chatModeTitle} description={locale.chatModeDescription} onClick={() => { onModeChange("chatgpt"); setModeMenuOpen(false); }} />
                    <ModeOption selected={mode === "codex"} title={locale.codexModeTitle} description={locale.codexModeDescription} onClick={() => { onModeChange("codex"); setModeMenuOpen(false); }} />
                  </div>
                )}
              </div>
              <ToolbarTip label={locale.projectWorkspace}>
                <button
                  className={`${styles.headerButton} ${styles.toolbarButton} ${sidebarMode === "project" ? styles.headerButtonActive : ""}`}
                  type="button"
                  aria-label={locale.projectWorkspace}
                  aria-pressed={sidebarMode === "project"}
                  onClick={() => onChangeSidebarMode("project")}
                >
                  <NavigationIcon name="project" />
                </button>
              </ToolbarTip>
              <ToolbarTip label={locale.chatList}>
                <button
                  className={`${styles.headerButton} ${styles.toolbarButton} ${sidebarMode === "chats" ? styles.headerButtonActive : ""}`}
                  type="button"
                  aria-label={locale.chatList}
                  aria-pressed={sidebarMode === "chats"}
                  onClick={() => onChangeSidebarMode("chats")}
                >
                  <NavigationIcon name="sidebarLeft" />
                </button>
              </ToolbarTip>
            </div>
            <div className={styles.toolbarUtility}>
              <ToolbarTip label={`${locale.viewActivity}${activityHint ? ` · ${activityHint}` : ""}`}>
                <button
                  ref={activityTriggerRef}
                  className={`${styles.headerButton} ${styles.toolbarButton} ${activityOpen ? styles.headerButtonActive : ""}`}
                  type="button"
                  aria-label={activityHint ? `${locale.activity} (${activityHint})` : locale.activity}
                  aria-expanded={activityOpen}
                  onClick={onToggleActivity}
                ><NavigationIcon name="bell" /></button>
              </ToolbarTip>
              <ToolbarTip label={`${locale.search}${searchHint ? ` · ${searchHint}` : ""}`}>
                <button
                  ref={searchTriggerRef}
                  className={`${styles.headerButton} ${styles.toolbarButton}`}
                  type="button"
                  aria-label={searchHint ? `${locale.search} (${searchHint})` : locale.search}
                  aria-expanded={searchOpen}
                  onClick={onToggleSearch}
                ><NavigationIcon name="search" /></button>
              </ToolbarTip>
              {compact && onCloseDrawer && (
                <ToolbarTip label={locale.close}>
                  <button
                    className={`${styles.headerButton} ${styles.toolbarButton}`}
                    type="button"
                    aria-label={locale.close}
                    onClick={onCloseDrawer}
                  ><NavigationIcon name="close" /></button>
                </ToolbarTip>
              )}
            </div>
          </CapsuleBar>
        )}
      </header>

      {activityOpen && isModeSwitcher && (
        <div className={styles.activityPanel} ref={activityPanelRef} role="dialog" aria-label={locale.activity}>
          <div className={styles.activityHeading}>
            <strong>{locale.activity}</strong>
            <button type="button" aria-label={locale.close} onClick={onCloseActivity}><NavigationIcon name="close" /></button>
          </div>
          <p>{locale.noActivity}</p>
        </div>
      )}

      <div className={styles.sidebarBody}>
        {domain.id === "settings" ? (
          <SettingsMenu locale={locale} activeView={activeView} onNavigate={onNavigate} />
        ) : domain.id !== "workspace" ? (
          <DomainSidebarMenu
            locale={locale}
            domain={domain}
            activeView={activeView}
            activeLibraryTab={activeLibraryTab}
            activeDomainItem={activeDomainItem}
            pluginViews={pluginViews}
            onSelectLibraryTab={onSelectLibraryTab}
            onSelectDomainItem={onSelectDomainItem}
            onNavigate={onNavigate}
          />
        ) : sidebarMode === "project" ? (
          // 项目工作区：文件树由聊天插件经契约注入，左二只负责切换与容器。
          <div className={styles.projectWorkspace}>
            {chatProvider?.renderProjectWorkspace
              ? chatProvider.renderProjectWorkspace({ projectId: workspaceProjectId, compact })
              : <p className={styles.projectWorkspaceEmpty}>{locale.projectWorkspaceEmpty}</p>}
          </div>
        ) : (
          <NavigationGroups
            locale={locale}
            activeView={activeView}
            newChatSelected={newChatSelected}
            activeProjectId={activeProjectId}
            activeChatSessionId={activeChatSessionId}
            projects={projects}
            sections={sections}
            recents={recents}
            chatSessions={chatSessions}
            chatProvider={chatProvider}
            projectProvider={projectProvider}
            sectionProvider={sectionProvider}
            onNewChat={onNewChat}
            onNewRecentChat={onNewRecentChat}
            onNewChatInProject={onNewChatInProject}
            onNewChatInSection={onNewChatInSection}
            onSelectProjectContext={onSelectProjectContext}
            onSelectChatSession={onSelectChatSession}
            onNavigate={onNavigate}
            onOpenProject={onOpenProject}
            onProjectCreated={onProjectCreated}
            onProjectUpdated={onProjectUpdated}
            onProjectRemoved={onProjectRemoved}
          />
        )}
      </div>
    </aside>
  );
}

function ModeOption({ selected, title, description, onClick }: { selected: boolean; title: string; description: string; onClick: () => void }) {
  return (
    <button className={styles.modeOption} type="button" role="menuitemradio" aria-checked={selected} onClick={onClick}>
      <span><strong>{title}</strong><small>{description}</small></span>
      {selected && <NavigationIcon name="check" className={styles.check} />}
    </button>
  );
}


/**
 * 文件：sidebar-types.ts
 * 功能：定义工作区左侧栏与会话/项目子面板的内部属性合同。
 * 作用：让侧栏壳层只组合展示，Session 和 Workspace 数据继续从原 Owner 进入。
 * 关联文件：./ApplicationSidebar.tsx、./ApplicationSidebarSessions.tsx、../types.ts。
 */
import type { ReactNode } from "react";
import type { AiSession, ApplicationId, ApplicationMode, WorkspaceProject } from "lfaa-client-connection/src/api.js";
import type { AiWorkNotification } from "lfaa-client-resources/src/notification-runtime.js";
import type { ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import type { WorkbenchLayoutMode } from "lfaa-client-ui-dockkit/src/workbench-layout.types.js";
import type { ApplicationSummary } from "../types.js";

export interface ApplicationSidebarSessionsProps {
  userId: string;
  app: ApplicationId;
  mode: ApplicationMode;
  layoutMode: WorkbenchLayoutMode;
  apps: ApplicationSummary[];
  onNavigate: (path: string) => void;
  onToggleLeft: () => void;
  notifications: AiWorkNotification[];
  onMarkSessionNotificationsRead: (appId: ApplicationId, sessionId: string) => void;
  sessions: AiSession[];
  missingSessionDirectoryIds: ReadonlySet<string>;
  aiDraft: string;
  pinnedSessionIds: string[];
  onTogglePinnedSession: (sessionId: string) => void;
  workspaceProjects: WorkspaceProject[];
  workspaceProjectsReady: boolean;
  sessionsDataReady: boolean;
  recentSessionsExpandRequestId: number;
  projectLoadError: string;
  onRetryProjects: () => void;
  activeSessionId: string | null;
  sessionsLoading: boolean;
  sessionsError: string;
  providerStatus: string | null;
  gitSummaryOpen: boolean;
  gitSummaryContent: ReactNode;
  onNewSession: (projectId?: string) => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => Promise<AiSession>;
  onArchiveSession: (session: AiSession) => void;
  onCloseGitSummary: () => void;
}

export interface ApplicationSidebarProps extends ApplicationSidebarSessionsProps {
  section: string;
  gameLibrary?: boolean;
  workspaceTitle?: string;
  applicationNavigationItems: ApplicationNavigationItem[];
  onOpenApplication: (app: ApplicationId, mode: ApplicationMode) => Promise<void>;
  onOpenSelectedApplication: () => Promise<void>;
  onOpenGameFiles?: (app: "minecraft" | "steamcmd") => void;
  onWritingLibraryPortalTargetChange: (target: HTMLDivElement | null) => void;
  onMarkNotificationsRead: () => void;
  onClearNotifications: () => void;
  onOpenNotification: (notification: AiWorkNotification) => void;
  onPreviewMouseLeave: () => void;
  onPreviewBlur: () => void;
}
/**
 * 功能：定义 ApplicationWorkspace 内部的导航、工具页签和 Chrome 数据形状。
 * 作用：供工作区组合组件和纯辅助函数共用，不形成新的包级公开 API。
 */
import type { ReactNode } from "react";
import type { AiActivityFileChange, AiHostTask, ApplicationId, ApplicationMode, UserSettings, UserRole, WorkspaceProjectContextApplicationId } from "lfaa-client-connection/src/api.js";
import type { AiWorkGoalRequest, AiWorkNotification, AiWorkNotificationInput } from "lfaa-client-resources/src/notification-runtime.js";
import type { ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import type { ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";

export type ApplicationSummary = {
  id: ApplicationId;
  title: string;
  initials: string;
  color: "blue" | "green" | "plum";
};

export type BrowserOpenTab = { id: string; title: string; url: string; active: boolean };

export type WorkspaceUtilityTab = {
  id: string;
  kind: "new" | "git" | "assets" | "applications" | "side-chat" | "extension" | "project-file" | "session-files" | "agent-host-task";
  projectId?: string;
  filePath?: string;
  sourceId?: string;
  initialView?: "source" | "diff";
  sessionId?: string;
  sessionFiles?: AiActivityFileChange[];
  hostTaskSnapshot?: AiHostTask;
  hostTaskId?: string;
  browserUrl?: string;
  extensionId?: string;
  browserNavigationRequest?: { id: string; url: string };
  browserActionRequest?: { id: string; action: "back" | "forward" | "reload" };
};

export interface ChromeState {
  leftCollapsed: boolean;
  centerCollapsed: boolean;
  rightCollapsed: boolean;
  terminalOpen: boolean;
}

export type NavigationLayout = UserSettings["general"]["navigationLayout"];

export interface ChromeStorageMetadata {
  hasSavedState: boolean;
  navigationLayout: NavigationLayout | null;
}

export interface ApplicationWorkspaceProps {
  userId: string;
  app: ApplicationId;
  mode: ApplicationMode;
  workContextApplicationId: WorkspaceProjectContextApplicationId | null;
  section: string;
  gameLibrary?: boolean;
  workspaceTitle?: string;
  applicationContent?: ReactNode;
  canvasWorkspace?: {
    applicationId: ApplicationId;
    initialProjectId?: string;
    applications: Array<{ title: string; applicationId: ApplicationId }>;
  };
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
  apps: ApplicationSummary[];
  applicationNavigationItems: ApplicationNavigationItem[];
  username: string;
  role: UserRole;
  serverState: ServiceState;
  error: string | null;
  onNavigate: (path: string) => void;
  onBack: () => void;
  onOpenSelectedApplication: () => Promise<void>;
  onOpenSettings: (section?: "ai" | "permissions", focusTarget?: string) => void;
  onOpenApplication: (app: ApplicationId, mode: ApplicationMode) => Promise<void>;
  recentSessionsOpenRequestId: number | null;
  onRecentSessionsOpenRequestHandled: (requestId: number) => void;
  rightPanelSection: "context" | "applications";
  onRightPanelSectionChange: (section: "context" | "applications") => void;
  applicationsOpenRequestId: number | null;
  onApplicationsOpenRequestHandled: (requestId: number) => void;
  activeAiSessionId: string | null;
  aiDraft: string;
  aiWorkGoal: AiWorkGoalRequest | null;
  notifications: AiWorkNotification[];
  onNotification: (notification: AiWorkNotificationInput) => void;
  onMarkNotificationsRead: () => void;
  onMarkSessionNotificationsRead: (appId: ApplicationId, sessionId: string) => void;
  onClearNotifications: () => void;
  onOpenNotification: (notification: AiWorkNotification) => void;
  onActiveAiSessionChange: (sessionId: string | null) => void;
  onAiDraftChange: (draft: string) => void;
  onAiWorkGoalConsumed: (requestId: string) => void;
  onLogout: () => void;
}

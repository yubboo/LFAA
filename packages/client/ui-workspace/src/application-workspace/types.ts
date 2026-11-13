/**
 * 功能：定义 ApplicationWorkspace 内部的导航、工具页签和 Chrome 数据形状。
 * 作用：供工作区组合组件和纯辅助函数共用，不形成新的包级公开 API。
 */
import type { AiActivityFileChange, AiHostTask, ApplicationId, UserSettings } from "lfaa-client-connection/src/api.js";

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

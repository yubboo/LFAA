/**
 * 功能：兼容聚合入口，重新导出各 Connection 领域 API 与类型。
 * 作用：保持既有 src/api.js 调用路径；认证 HTTP 传输由 http-client.ts 统一处理。
 * 关联文件：packages/client/ui-renderer/src/App.tsx、packages/client/ui-settings-account/src/AuthView.tsx、packages/client/ui-settings-account/src/PasskeyManager.tsx、packages/client/ui-settings-account/src/PasskeySetupPrompt.tsx、packages/client/ui-minecraft/src/MinecraftWorkspace.tsx、packages/client/ui-sidebar-files/src/FileManagerPage.tsx、packages/client/ui-settings-account/src/AdminUsersPage.tsx、packages/client/ui-settings/src/SettingsPage.tsx、apps/desktop-electron/src/preload.cjs、apps/desktop-tauri/src-tauri/src/main.rs、packages/api/gateway/src/index.ts。
 */
export * from "./file-manager-api.js";
export * from "./minecraft-api.js";
export * from "./steamcmd-api.js";
export * from "./connectivity-api.js";
export * from "./identity-api.js";
export * from "./typert-client.js";
export * from "./value-guards.js";
export * from "./ai-video-api.js";
export * from "./workflow-api.js";
export * from "./minecraft-workflow-api.js";
export * from "./github-api.js";
export * from "./daemon-connection-api.js";
export * from "./canvas-api.js";
export * from "./agent-git-api.js";
export * from "./terminal-api.js";
export * from "./account-settings-api.js";
export type { AiUsageSummary, AiActivityFileChange, AiActivityItem, AiActivityToolStage, AiActivityToolUsage, AiMessageFeedbackInput, AiMessageFeedback, AiTextDelta, AiReplyPart, AiMessagePage, AiContextUsage, AiSessionUsageSummary, AiSessionUsageModelSummary, AiMessageUsage, AiMessage, AiSessionBranchSource, AiSession } from "./ai-session-api.js";
export { loadAiUsage, setAiSessionPlanMode, setAiSessionProject, generateAiSessionTitle, renameAiSession, archiveAiSession, openAiSideChatSession, createAiSessionBranchFromMessageInWorktree, forkAiSessionBeforeUserMessage, createAiSessionBranchFromMessage, submitAiMessageFeedback, loadAiMessages, loadAiSessions, setAiSessionContextApplication, setAiSessionAssociations, appendAiTextDelta } from "./ai-session-api.js";
export * from "./storage-location-api.js";
export * from "./desktop-api.js";
export * from "./local-model-api.js";
export * from "./plugin-api.js";
export * from "./capability-api.js";
export * from "./ai-permission-api.js";
export * from "./ai-run-control-api.js";
export { ApiError, request, sessionExpiredEventName } from "./http-client.js";
export * from "./writing-api.js";
export * from "./workspace-api.js";
export * from "./ai-account-api.js";
export * from "./browser-api.js";

export type { AgentAssociations } from "lfaa-util-values/src/agent-associations.js";
export type { ApplicationId } from "lfaa-util-values/src/application-id.js";
export type { WorkspaceProjectContextApplicationId } from "lfaa-util-values/src/application-id.js";
export type { BrowserProviderId } from "lfaa-util-values/src/browser-provider.js";

export type { UserSettings, BrowserUseSettings, AppearanceFonts, AppearanceModeStyle, AppearanceAdvancedSettings, AppearanceSettings, AppearancePreset, AppearancePresetSnapshot, AppearanceTextFont, AppearanceCodeFont } from "lfaa-util-values/src/settings-contract.js";
export { DEFAULT_APPEARANCE_ADVANCED_SETTINGS } from "lfaa-util-values/src/settings-contract.js";

export * from "./ai-account-types.js";
export * from "./local-model-types.js";
export * from "./ai-plugin-types.js";
export * from "./ai-capability-types.js";
export * from "./ai-permission-types.js";
export * from "./workspace-types.js";
export * from "./ai-host-task-api.js";
export * from "./health-api.js";
export * from "./attachment-api.js";
export * from "./ai-office-api.js";

export * from "./ai-run-stream-api.js";

export * from "./errors.js";

import { APPLICATION_IDS, APPLICATION_LABELS, WORKSPACE_PROJECT_CONTEXT_APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { isBuiltinBrowserProvider } from "lfaa-util-values/src/browser-provider.js";
import { setAiSessionAssociations, setAiSessionContextApplication, type AgentAssociations } from "lfaa-client-connection/src/api.js";
/**
 * 文件：AiWorkChat.tsx
 * 功能：提供 SteamCMD、Minecraft 和写作工作区的 小鱼智能体 流式聊天。
 * 作用：调用控制端会话 API，显示持久化历史、可复制消息、可编辑并重新发送的问题、回答反馈、聊天分支、悬停式提问锚点、Provider 输出和真实用量状态；呈现账户级权限选择、模型卡片及其目录确认的思考力度，并把运行事件交给工作台通知中心。
 * 不负责：业务规则、节点任务执行和审批授权；这些由 server 核心及 Daemon 完成。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/store/src/scroll-restoration.ts、packages/api/gateway/src/index.ts。
 * 修改注意事项：只展示 server 发来的真实 Agent、工具、子 Agent、Skill 和审批状态。
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createSnapshotCache } from "lfaa-client-store/src/snapshot-cache.js";
import { Alert, Button, Dropdown, Input, Modal, Popover, Select, Spin, Tooltip, Typography } from "antd";
import { ComposerAttachmentControl, PendingAttachmentList } from "lfaa-client-ui-attachment";
import { useComposerAttachments } from "./hooks/useComposerAttachments.js";
import { appendAiTextDelta, answerAiRunQuestion, appendAiRunInput, applyWritingEditProposal, ApiError, cancelAiRun, createWorkspaceGitWorktree, createAiSessionBranchFromMessage, createAiSessionBranchFromMessageInWorktree, decideAiApproval, forkAiSessionBeforeUserMessage, generateAiSessionTitle, getErrorMessage, loadSettings, loadAiAccounts, loadWritingEditProposal, loadAiMessages, loadAiSessions, loadWritingWorkspace, pauseAiRun, rejectWritingEditProposal, resumeAiRun, saveSettings, selectAiAccountModel, setAiSessionPlanMode, setAiSessionProject, streamAiChat, submitAiMessageFeedback, updateAiAccountReasoningMode, type AiAccount, type AiActivityFileChange, type AiActivityItem, type AiContextUsage, type AiMessage, type AiMessageFeedbackInput, type AiRunPauseState, type AiSession, type AiSessionBranchSource, type AiSessionUsageSummary, type AiWorkbenchView, type ApplicationId, type BrowserProviderId, type UserSettings, type WritingEditProposal, type WritingWorkspace, type WorkspaceDaemonNode, type WorkspaceProject, type WorkspaceProjectApplicationId, type WorkspaceProjectContextApplicationId } from "lfaa-client-connection/src/api.js";
import { notifyAiWorkAction, notifyAiWorkCompletion, type AiWorkGoalRequest, type AiWorkNotificationInput } from "lfaa-client-resources/src/notification-runtime.js";

// 本次请求携带的附件：只用于当前进程把图片显示在用户气泡里（字节仍不写入会话历史）。
const messageAttachmentRefs = new Map<string, Array<{ id: string; name: string }>>();
const MAX_SUBAGENT_STREAM_PREVIEW_CHARS = 4096;
const MAX_SUBAGENT_STREAM_PREVIEWS = 8;
const canvasMutationToolIds = new Set([
  "canvas.projects.create",
  "canvas.nodes.add",
  "canvas.nodes.update",
  "canvas.nodes.remove",
  "canvas.nodes.connect",
  "canvas.nodes.disconnect",
  "canvas.generation.image",
  "aivideo.projects.create",
  "aivideo.projects.update",
  "aivideo.projects.delete",
  "aivideo.shots.generate-image",
  "aivideo.shots.generate-video",
  "aivideo.shots.refresh-video",
  "aivideo.shots.cancel-video"
]);
function appendSubagentStreamPreview(current: Record<string, string>, key: string, delta: string): Record<string, string> {
  const next = { ...current, [key]: `${current[key] ?? ""}${delta}`.slice(-MAX_SUBAGENT_STREAM_PREVIEW_CHARS) };
  const keys = Object.keys(next);
  while (keys.length > MAX_SUBAGENT_STREAM_PREVIEWS) delete next[keys.shift()!];
  return next;
}
function clearSubagentStreamPreviews(current: Record<string, string>, messageId: string): Record<string, string> {
  const prefix = `${messageId}:`;
  const remaining = Object.entries(current).filter(([key]) => !key.startsWith(prefix));
  return remaining.length === Object.keys(current).length ? current : Object.fromEntries(remaining);
}
import { aiActivityClock } from "./activity-clock.js";
import { resolveNewSessionWorkspaceProjectId } from "./new-session-project-selection.js";
import { buildResponseTimeline, splitAiActivityDetail } from "./response-timeline.js";
import { buildConversationAnchors } from "./conversation-anchor-preview.js";
import { buildConversationAnchorLayout } from "./conversation-scroll.js";
import { useAiConversationScroll, useAiConversationScrollLifecycle } from "./hooks/useAiConversationScroll.js";
import { createOutputIdleBlurController } from "./output-idle-blur.js";
import { AI_RUN_CONTROL_GUARD_MS, canControlAiRun } from "./run-stop-guard.js";
import { consumeReplySuggestion, hideSubmittedReplySuggestions, ReplySuggestionSubmissionGate } from "./reply-suggestions.js";
import { AiWorkMessageRow, emptyAiWorkMessageActions } from "./components/AiWorkMessageRow.js";
import { ConversationAnchorRail } from "lfaa-client-ui-conversation";
import { MessageFeedbackDialog, type AiMessageFeedbackRating } from "lfaa-client-ui-message-feedback";
import { ModelSelectionPopover } from "lfaa-client-ui-model-selection";
import { PlanModeBanner } from "lfaa-client-ui-plan";
import { ApprovalRequestCard } from "lfaa-client-ui-approval";
import { UserQuestionPrompt } from "lfaa-client-ui-user-questions";
import { WritingProposalReviewDialog } from "lfaa-client-ui-writing";
import { ComposerTriggerMenu, type ComposerTriggerMenuItem, type ComposerTriggerMenuState } from "lfaa-client-ui-input-trigger";
import type { AiWorkMessageActions, EditingMessage, ExpandedActivitySteps, MessageUsage, PendingAiInteraction } from "./message-types.js";
import { AiUsageFooter, type AiUsageLoadState } from "./AiUsageFooter.js";
import { AiWorkVoiceSurface } from "./components/AiWorkVoiceSurface.js";
import { supportsVoiceInput, supportsVoiceOutput, startVoiceInput, readResponseAloud, stopVoicePlayback } from "./voice.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { shortcutMatches } from "lfaa-client-ui-commands/src/shortcuts.js";
import { DshSlotOutlet } from "lfaa-client-modules/src/client/index.js";
import { WorkspaceProjectPicker } from "./WorkspaceProjectPicker.js";
import { aiModelPickerCatalog, effectiveAiAccount, effectiveReasoningMode, modelOptionVersionTag, reasoningDefaultLabel, reasoningModeLabel, reasoningOptions } from "lfaa-client-ui-settings-models/src/model-options.js";
import "./ai-work-chat.css";

const MODEL_PICKER_RESULT_LIMIT = 60;
const MAX_SESSION_TITLE_GENERATION_ATTEMPTS = 256;
// 无建议消息行共享稳定引用，避免流式正文更新时破坏 memo 边界。
const EMPTY_PROMPT_SUGGESTIONS: readonly string[] = Object.freeze([]);
const sessionTitleGenerationAttemptKeys = new Set<string>();

function rememberSessionTitleGenerationAttempt(key: string): boolean {
  if (sessionTitleGenerationAttemptKeys.has(key)) return false;
  sessionTitleGenerationAttemptKeys.add(key);
  while (sessionTitleGenerationAttemptKeys.size > MAX_SESSION_TITLE_GENERATION_ATTEMPTS) {
    const oldest = sessionTitleGenerationAttemptKeys.values().next().value;
    if (oldest === undefined) break;
    sessionTitleGenerationAttemptKeys.delete(oldest);
  }
  return true;
}

const composerSlashCommands: ComposerTriggerMenuItem[] = [
  { id: "plan", group: "命令", label: "/plan", description: "以计划模式处理接下来的目标", icon: "book", insertText: "/plan " },
  { id: "plan-off", group: "命令", label: "/plan off", description: "退出计划模式", icon: "check", insertText: "/plan off" },
  { id: "side", group: "命令", label: "/side", description: "在临时侧边聊天中继续", icon: "panelRight", insertText: "/side " },
  { id: "model", group: "命令", label: "/model", description: "打开当前模型选择器", icon: "grid", action: "open-model-picker" }
];

const applicationAssociationLabels: Record<ApplicationId, string> = {
  steamcmd: APPLICATION_LABELS.steamcmd,
  minecraft: APPLICATION_LABELS.minecraft,
  connectivity: APPLICATION_LABELS.connectivity,
  writing: APPLICATION_LABELS.writing,
  aivideo: APPLICATION_LABELS.aivideo,
  workspace: APPLICATION_LABELS.workspace
};

function capabilityAssociationGroup(kind: string): string {
  return kind === "skill" ? "技能" : kind === "prompt" ? "提示词" : kind === "expert" ? "专家" : "能力";
}

interface AiWorkChatProps {
  workspaceHeader?: ReactNode;
  userId: string;
  appId: ApplicationId;
  contextApplicationId: WorkspaceProjectContextApplicationId | null;
  workspaceView?: AiWorkbenchView;
  onOpenApplicationCanvas?: () => void;
  capabilities?: Array<{ id: string; name: string; kind: string }>;
  capabilitiesError?: string;
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
  sessions: AiSession[];
  activeSessionId: string | null;
  projectDirectoryMissing: boolean;
  newSessionProjectId: string | null;
  defaultWorkspaceProjectId: string | null;
  newSessionGitRepositoryId: string | null;
  onSelectedProjectChange: (projectId: string | null) => void;
  workspaceProjects: WorkspaceProject[];
  workspaceProjectsLoadStatus: "loading" | "ready" | "error";
  workspaceProjectsTruncated: boolean;
  workspaceNodes: WorkspaceDaemonNode[];
  workspaceProjectsError: string;
  onRetryWorkspaceProjects: () => void;
  onWorkspaceProjectCreated?: () => void;
  onWorkspaceProjectsChange: (projects: WorkspaceProject[]) => void;
  initialDraft: string;
  autoSubmitGoal?: AiWorkGoalRequest | null;
  onAutoSubmitGoalConsumed: (requestId: string) => void;
  newSessionKey: number;
  onSessionsChange: (sessions: AiSession[]) => void;
  onSessionChange: (session: AiSession) => void;
  onActiveSessionChange: (sessionId: string | null) => void;
  onDraftChange: (draft: string) => void;
  onProviderStatusChange: (status: string) => void;
  onBusyChange: (busy: boolean) => void;
  onOpenSettings: (section?: "ai" | "permissions", focusTarget?: string) => void;
  onNotification: (notification: AiWorkNotificationInput) => void;
  onOpenSideChat: (initialQuestion?: string) => void;
  onWritingWorkspaceChange?: (workspace: WritingWorkspace) => void;
  onOpenProjectFile?: (projectId: string, path: string, sourceId?: string, initialView?: "source" | "diff") => void;
  onSessionFileChanges?: (sessionId: string | null, changes: AiActivityFileChange[]) => void;
  onBrowserToolCompleted?: (providerId: BrowserProviderId) => void;
  onCanvasToolsCompleted?: (projectId?: string) => void;
  voiceMode?: boolean;
  onExitVoice?: () => void;
}

const aiAccountSnapshots = createSnapshotCache<AiAccount[]>();
const aiMessageSnapshots = createSnapshotCache<AiMessage[]>(messages => messages.reduce((size, message) => size
  + (message.content.length + message.activity.reduce((length, activity) => length + activity.title.length + activity.detail.length, 0)) * 2, 0));
const pendingInteractionByActivity = new WeakMap<AiActivityItem[], AiActivityItem | null>();

function applicationNameFor(appId: ApplicationId): string {
  return APPLICATION_LABELS[appId];
}

function aiMessageSnapshotKey(userId: string, appId: ApplicationId, sessionId: string): string {
  return `${userId}:${appId}:${sessionId}`;
}

function findPendingAiInteraction(messages: AiMessage[]): PendingAiInteraction | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== "assistant" || message.status !== "streaming") continue;
    const activity = latestPendingInteractionActivity(message.activity);
    if (activity?.status === "approval_required" && activity.approvalId && !activity.approvalAnswer) return { kind: "approval", runId: message.id, activity };
    if (activity?.status === "waiting_input" && activity.questionId && activity.question && activity.options?.length) return { kind: "question", runId: message.id, activity };
  }
  return null;
}

function latestPendingInteractionActivity(activities: AiActivityItem[]): AiActivityItem | null {
  if (pendingInteractionByActivity.has(activities)) return pendingInteractionByActivity.get(activities) ?? null;
  let pending: AiActivityItem | null = null;
  for (let index = activities.length - 1; index >= 0; index -= 1) {
    const activity = activities[index]!;
    if (activity.status === "approval_required" && activity.approvalId && !activity.approvalAnswer
      || activity.status === "waiting_input" && activity.questionId && activity.question && activity.options?.length) {
      pending = activity;
      break;
    }
  }
  pendingInteractionByActivity.set(activities, pending);
  return pending;
}

const welcomeContent: Record<ApplicationId, { title: string; description: string }> = {
  workspace: { title: "小鱼智能体", description: "讨论问题、写代码、处理项目都可以直接开始；长期任务可以关联项目文件夹，方便后续继续。" },
  steamcmd: { title: "Steam 游戏服务器", description: "规划专用服务器的安装、更新、备份和日常维护。" },
  minecraft: { title: "Minecraft 服务端", description: "查询 Minecraft 服务端与工具，也可以让 Agent 帮你搭建专属工作流。" },
  connectivity: { title: "联机管理", description: "查看联机服务配置与运行情况，按当前可用能力继续处理。" },
  writing: { title: "写作空间", description: "梳理故事设定、人物动机与章节节奏，也可以直接贴一段正文来讨论。" },
  aivideo: { title: "AI 漫剧", description: "围绕剧本、角色、场景和镜头继续创作，并用画布组织漫剧流程。" }
};

const suggestions: Record<ApplicationId, string[]> = {
  workspace: ["小鱼有哪些权限模式？怎样先读项目并给我计划？", "画布里怎么让 Agent 按一句话添加节点和连线？", "Minecraft Java：给最近的玩家 64 颗钻石，/give 命令怎么写？"],
  steamcmd: ["给我一份 SteamCMD 部署专用服务器前的检查清单。", "如何用 SteamCMD 更新服务器并先保留可回滚备份？", "怎样规划游戏服务器端口和自动更新？"],
  minecraft: ["Minecraft Java：给最近的玩家 64 颗钻石，/give 命令怎么写？", "升级 Paper 服务端前，先检查插件兼容与备份步骤。", "怎么用 Minecraft 工作流把输入、Agent 处理和结果连起来？"],
  connectivity: ["怎样检查当前联机服务配置和连接状态？", "帮我解释联机服务的节点、端口和凭据分别有什么作用。", "如何安全地排查一次连接失败？先列检查步骤。"],
  writing: ["帮我梳理这个故事的核心设定和待确认问题。", "分析这段正文的节奏、人物动机与表达问题。", "围绕这个角色补出清晰的目标、阻碍与变化。"],
  aivideo: ["把这段剧情拆成镜头画面、时长和对白。", "怎样在漫剧画布里整理角色、场景和镜头关系？", "帮我规划从剧本到分镜、再到镜头素材的创作流程。"]
};

const permissionModeLabels: Record<UserSettings["permissions"]["mode"], string> = {
  ask: "请求审批",
  approve_remembered: "替我审批",
  full_access: "完全权限"
};

const permissionModeOptions: Array<{
  mode: UserSettings["permissions"]["mode"];
  label: string;
  description: string;
  icon: "shield" | "review";
}> = [
  { mode: "ask", label: "请求审批", description: "写入和高风险操作逐项确认。", icon: "shield" },
  { mode: "approve_remembered", label: "替我审批", description: "精确匹配已记住范围后自动执行。", icon: "review" },
  { mode: "full_access", label: "完全权限", description: "模型自主执行项目操作与任意主机命令，不再逐项审批。", icon: "shield" }
];

function getPermissionModeHint(applicationId: ApplicationId, mode: UserSettings["permissions"]["mode"]): string {
  const appContext = applicationId === "writing"
    ? "AI 可围绕当前作品大纲和章节正文工作，并按你的指令选择写入目标。"
    : applicationId === "aivideo"
      ? "AI 可围绕当前漫剧项目的剧本、角色、场景和镜头工作，并通过已接入的漫剧工具管理真实项目与素材。"
      : applicationId === "workspace"
        ? "小鱼可在通用工作区处理代码和项目，并调用当前范围内已登记的项目文件与主机能力。"
        : "AI 可调用当前应用的项目管理、节点、文件及主机终端能力。";
  if (mode === "full_access") return `${appContext}完全权限已开启，模型可在在线 Daemon 上执行任意命令并指定任意工作目录，不再逐项等待审批。`;
  if (mode === "approve_remembered") return `${appContext}匹配已记住的精确范围时自动执行，其他写入和高风险操作会请求审批。`;
  return `${appContext}写入和高风险操作会先请求你的逐项审批。`;
}

function AiWorkChatView({ workspaceHeader, userId, appId, contextApplicationId, workspaceView, onOpenApplicationCanvas, capabilities = [], capabilitiesError = "", settings, onSettingsChange, sessions, activeSessionId, projectDirectoryMissing, newSessionProjectId, defaultWorkspaceProjectId, newSessionGitRepositoryId, onSelectedProjectChange, workspaceProjects, workspaceProjectsLoadStatus, workspaceProjectsTruncated, workspaceNodes, workspaceProjectsError, onRetryWorkspaceProjects, onWorkspaceProjectCreated, onWorkspaceProjectsChange, initialDraft, autoSubmitGoal = null, onAutoSubmitGoalConsumed, newSessionKey, onSessionsChange, onSessionChange, onActiveSessionChange, onDraftChange, onProviderStatusChange, onBusyChange, onOpenSettings, onNotification, onOpenSideChat, onOpenProjectFile, onWritingWorkspaceChange, onSessionFileChanges, onBrowserToolCompleted, onCanvasToolsCompleted, voiceMode = false, onExitVoice = () => undefined }: AiWorkChatProps) {
  const outputFocusRegionElementRef = useRef<HTMLElement | null>(null);
  const setOutputFocusRegionElement = useCallback((node: HTMLElement | null) => {
    outputFocusRegionElementRef.current = node;
  }, []);
  const [permissionModal, permissionModalContext] = Modal.useModal();
  const cachedAccounts = useRef(aiAccountSnapshots.get(userId) ?? null).current;
  const cachedMessages = useRef(activeSessionId ? aiMessageSnapshots.get(aiMessageSnapshotKey(userId, appId, activeSessionId)) ?? null : null).current;
  const [messages, setMessages] = useState<AiMessage[]>(() => cachedMessages ? hideSubmittedReplySuggestions(cachedMessages) : []);
  const [subagentStreamPreviews, setSubagentStreamPreviews] = useState<Record<string, string>>({});
  const [messagesSessionId, setMessagesSessionId] = useState<string | null>(() => cachedMessages ? activeSessionId : null);
  const sessionFileChangesCacheRef = useRef<{ activityLists: AiActivityItem[][]; changes: AiActivityFileChange[] } | null>(null);
  const sessionFileChanges = useMemo(() => {
    const previous = sessionFileChangesCacheRef.current;
    if (previous && previous.activityLists.length === messages.length
      && messages.every((message, index) => previous.activityLists[index] === message.activity)) return previous.changes;
    const activityLists = messages.map(message => message.activity);
    const changes = messages.flatMap(message => message.activity.flatMap(activity => activity.fileChanges ?? []));
    sessionFileChangesCacheRef.current = { activityLists, changes };
    return changes;
  }, [messages]);
  const sessionFileChangesKey = useMemo(() => JSON.stringify(sessionFileChanges), [sessionFileChanges]);
  const reportedSessionFileChangesRef = useRef("");
  useEffect(() => {
    if (messagesSessionId !== activeSessionId) return;
    const key = `${activeSessionId ?? ""}:${sessionFileChangesKey}`;
    if (reportedSessionFileChangesRef.current === key) return;
    reportedSessionFileChangesRef.current = key;
    onSessionFileChanges?.(activeSessionId, sessionFileChanges);
  }, [activeSessionId, messagesSessionId, onSessionFileChanges, sessionFileChanges, sessionFileChangesKey]);
  const [messagePageCursor, setMessagePageCursor] = useState<string | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [branchSourceSnapshot, setBranchSourceSnapshot] = useState<{ sessionId: string; source: AiSessionBranchSource | null } | null>(null);
  const branchSource = branchSourceSnapshot?.sessionId === activeSessionId ? branchSourceSnapshot.source : null;
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const { pendingAttachments, attachmentBusy, attachmentError, pickAttachments, removePendingAttachment, takePendingAttachments } = useComposerAttachments();
  const [composerMenu, setComposerMenu] = useState<ComposerTriggerMenuState | null>(null);
  const [composerMenuMaxHeight, setComposerMenuMaxHeight] = useState<number | null>(null);
  const [composerMenuActiveIndex, setComposerMenuActiveIndex] = useState(0);
  const composerFormRef = useRef<HTMLFormElement | null>(null);
  const pendingComposerCaretRef = useRef<number | null>(null);
  const [composerSelectionRevision, setComposerSelectionRevision] = useState(0);
  const [associations, setAssociations] = useState<AgentAssociations>({ applicationIds: [], capabilityIds: [] });
  const [associationsBusy, setAssociationsBusy] = useState(false);
  const [selectedContextApplicationId, setSelectedContextApplicationId] = useState<WorkspaceProjectContextApplicationId | null>(() => activeSessionId
    ? sessions.find(session => session.id === activeSessionId)?.contextApplicationId ?? contextApplicationId
    : contextApplicationId);
  const contextSelectionOverrideRef = useRef<{ scope: string; value: WorkspaceProjectContextApplicationId | null } | null>(null);
  const contextSelectionScope = `${activeSessionId ?? "new-session"}\u0000${contextApplicationId ?? ""}`;
  const [contextApplicationBusy, setContextApplicationBusy] = useState(false);
  const [composerMoreOpen, setComposerMoreOpen] = useState(false);
  const [composerMoreTooltipOpen, setComposerMoreTooltipOpen] = useState(false);
  const [composerMoreSection, setComposerMoreSection] = useState<"applications" | "capabilities" | null>(null);
  const workspaceProjectAppId: WorkspaceProjectApplicationId | null = appId === "workspace" || appId === "minecraft" ? appId : null;
  const supportsWorkspaceProjectContext = workspaceProjectAppId !== null;
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => activeSessionId ? sessions.find(session => session.id === activeSessionId)?.projectId ?? null : newSessionProjectId ?? defaultWorkspaceProjectId);
  const projectSelectionExplicitRef = useRef(Boolean(newSessionProjectId));
  const projectSelectionSessionKeyRef = useRef(newSessionKey);
  const [projectBusy, setProjectBusy] = useState(false);
  const [planModeBusy, setPlanModeBusy] = useState(false);
  const [planModeOverride, setPlanModeOverride] = useState<{ sessionId: string | null; active: boolean } | null>(null);
  const [messagesReady, setMessagesReady] = useState(() => !activeSessionId || cachedMessages !== null);
  const [usageByMessage, setUsageByMessage] = useState<Record<string, MessageUsage>>({});
  const [sessionUsageSummary, setSessionUsageSummary] = useState<AiSessionUsageSummary | null>(null);
  const [sessionUsageLoadState, setSessionUsageLoadState] = useState<AiUsageLoadState>(() => activeSessionId ? "loading" : "ready");
  const [contextUsage, setContextUsage] = useState<AiContextUsage | null>(null);
  const [accounts, setAccounts] = useState<AiAccount[]>(() => cachedAccounts ?? []);
  // 区分 Provider 尚未返回、成功但没有活动账户与读取失败，避免把加载中的空数组误报为未配置。
  const [accountLoadState, setAccountLoadState] = useState<"loading" | "ready" | "error">(() => cachedAccounts === null ? "loading" : "ready");
  const [loading, setLoading] = useState(() => Boolean(activeSessionId && cachedMessages === null));
  const [busy, setBusy] = useState(false);
  const [stopGuardElapsed, setStopGuardElapsed] = useState(false);
  const [runPauseState, setRunPauseState] = useState<{ runId: string; state: AiRunPauseState } | null>(null);
  const [runPauseBusy, setRunPauseBusy] = useState(false);
  const runPauseEventRevisionRef = useRef(0);
  const [listening, setListening] = useState(false);
  const [voiceSessionActive, setVoiceSessionActive] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [voiceSpeechActivity, setVoiceSpeechActivity] = useState(0);
  const currentSettingsRef = useRef(settings);
  currentSettingsRef.current = settings;
  const voiceSessionActiveRef = useRef(false);
  const voiceReplyInProgressRef = useRef(false);
  const voiceResumePendingRef = useRef(false);
  const voiceTurnDispatchRef = useRef(false);
  const voiceSpeechActivityRef = useRef(0);
  const voiceSpeechActivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopListening = useRef<(() => void) | null>(null);
  const draftRef = useRef(draft); draftRef.current = draft;
  const autoSubmittedGoalRequestRef = useRef<string | null>(null);
  const stopGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopGuardStartedAtRef = useRef<number | null>(null);
  useEffect(() => () => {
    voiceSessionActiveRef.current = false;
    stopListening.current?.();
    stopVoicePlayback();
    if (voiceSpeechActivityTimerRef.current) clearTimeout(voiceSpeechActivityTimerRef.current);
    if (stopGuardTimerRef.current) clearTimeout(stopGuardTimerRef.current);
  }, []);
  useEffect(() => {
    if (!settings.aiRuntime.voiceInputEnabled) {
      if (voiceSessionActiveRef.current) endVoiceSession();
      else { stopListening.current?.(); stopListening.current = null; setListening(false); }
    }
  }, [settings.aiRuntime.voiceInputEnabled]);
  useEffect(() => {
    if (!settings.aiRuntime.readResponsesAloud) {
      stopVoicePlayback();
      if (voiceSpeaking) {
        setVoiceSpeaking(false);
        queueVoiceResume();
      }
    }
  }, [settings.aiRuntime.readResponsesAloud]);
  useEffect(() => { if (!voiceMode && voiceSessionActiveRef.current) endVoiceSession(); }, [voiceMode]);
  const [expandedActivitySteps, setExpandedActivitySteps] = useState<ExpandedActivitySteps | null>(null);
  function toggleActivityStep(messageId: string, activityId: string): void {
    setExpandedActivitySteps(current => {
      const activityIds = new Set(current?.messageId === messageId ? current.activityIds : []);
      if (activityIds.has(activityId)) activityIds.delete(activityId);
      else activityIds.add(activityId);
      return { messageId, activityIds };
    });
  }
  const [error, setError] = useState("");
  const sessionTitleOwnerKey = `${userId}:${appId}`;
  const sessionTitleOwnerKeyRef = useRef(sessionTitleOwnerKey);
  sessionTitleOwnerKeyRef.current = sessionTitleOwnerKey;
  const [toolbarBusy, setToolbarBusy] = useState<"permissions" | "aiRuntime" | null>(null);
  const [permissionMenuOpen, setPermissionMenuOpen] = useState(false);
  const [permissionTooltipOpen, setPermissionTooltipOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [messageActionError, setMessageActionError] = useState("");
  const [feedbackTarget, setFeedbackTarget] = useState<{ messageId: string; rating: AiMessageFeedbackRating } | null>(null);
  const [feedbackReasons, setFeedbackReasons] = useState<string[]>([]);
  const [feedbackDetail, setFeedbackDetail] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [branchTargetMessageId, setBranchTargetMessageId] = useState<string | null>(null);
  const [branchBusy, setBranchBusy] = useState(false);
  const [editingMessage, setEditingMessage] = useState<EditingMessage | null>(null);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelPickerTooltipOpen, setModelPickerTooltipOpen] = useState(false);
  const openModelPicker = useCallback(() => {
    setModelPickerTooltipOpen(false);
    setModelPickerOpen(true);
  }, []);
  const [modelPickerView, setModelPickerView] = useState<"reasoning" | "models">("reasoning");
  const [modelSearch, setModelSearch] = useState("");
  const [modelResultLimit, setModelResultLimit] = useState(MODEL_PICKER_RESULT_LIMIT);
  const [reasoningDraftIndex, setReasoningDraftIndex] = useState<number | null>(null);
  const [interactionBusy, setInteractionBusy] = useState(false);
  const [questionReply, setQuestionReply] = useState("");
  const [writingProposalId, setWritingProposalId] = useState<string | null>(null);
  const [writingProposal, setWritingProposal] = useState<WritingEditProposal | null>(null);
  const [writingProposalLoading, setWritingProposalLoading] = useState(false);
  const [writingProposalBusy, setWritingProposalBusy] = useState(false);
  const [writingProposalError, setWritingProposalError] = useState("");
  const writingProposalLoadSequence = useRef(0);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [anchorViewportHeight, setAnchorViewportHeight] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const loadedMessageSessionKeyRef = useRef<string | null>(null);
  const activeRunRef = useRef<string | null>(null);
  const runRequestGenerationRef = useRef(0);
  const autoFollowAttempt = useRef<string | null>(null);
  const sessionIdForTurn = useRef(activeSessionId);
  const sessionKeyForTurn = useRef(newSessionKey);
  const appIdForTurn = useRef(appId);
  const notifiedTurnEvents = useRef(new Set<string>());
  const canvasMutationObservedRef = useRef(false);
  const workspaceProjectCreatedObservedRef = useRef(false);
  useEffect(() => {
    setCopiedMessageId(null);
    setMessageActionError("");
    setBranchSourceSnapshot(current => current?.sessionId === activeSessionId ? current : null);
    setFeedbackTarget(null);
    setFeedbackReasons([]);
    setFeedbackDetail("");
    setBranchTargetMessageId(null);
    setEditingMessage(null);
    setExpandedActivitySteps(null);
  }, [activeSessionId]);

  async function openWritingProposal(proposalId: string): Promise<void> {
    const loadSequence = ++writingProposalLoadSequence.current;
    setWritingProposalId(proposalId);
    setWritingProposal(null);
    setWritingProposalError("");
    setWritingProposalLoading(true);
    try {
      const result = await loadWritingEditProposal(proposalId);
      if (loadSequence === writingProposalLoadSequence.current) setWritingProposal(result.proposal);
    } catch (loadError: unknown) {
      if (loadSequence === writingProposalLoadSequence.current) setWritingProposalError(getErrorMessage(loadError));
    } finally {
      if (loadSequence === writingProposalLoadSequence.current) setWritingProposalLoading(false);
    }
  }

  async function resolveWritingProposal(decision: "apply" | "reject"): Promise<void> {
    if (!writingProposalId || writingProposalBusy) return;
    setWritingProposalBusy(true);
    setWritingProposalError("");
    try {
      const result = decision === "apply"
        ? await applyWritingEditProposal(writingProposalId)
        : await rejectWritingEditProposal(writingProposalId);
      setWritingProposal((current) => current ? { ...current, status: result.proposal.status, baseContent: null, proposedContent: null } : current);
      if (decision === "apply" && result.proposal.status === "applied" && onWritingWorkspaceChange) {
        try {
          const { workspace } = await loadWritingWorkspace();
          onWritingWorkspaceChange(workspace);
        } catch {
          setWritingProposalError("修改已应用；作品状态刷新失败，请重新打开写作工作区读取最新内容。");
        }
      }
    } catch (decisionError: unknown) {
      setWritingProposalError(getErrorMessage(decisionError));
      try {
        const latest = await loadWritingEditProposal(writingProposalId);
        setWritingProposal(latest.proposal);
      } catch {
        // 服务端状态无法回读时保留现有提案快照，并如实显示本次请求错误。
      }
    } finally {
      setWritingProposalBusy(false);
    }
  }
  useEffect(() => {
    const outputFocusRegion = outputFocusRegionElementRef.current;
    if (!outputFocusRegion) return;
    outputFocusRegion.dataset.outputIdle = "false";
    const focusBlurSettings = settings.appearance.advanced;
    if (!focusBlurSettings.aiWorkOutputFocusBlurEnabled) return;

    const idleController = createOutputIdleBlurController({
      idleDelayMs: focusBlurSettings.aiWorkOutputFocusBlurIdleSeconds * 1000,
      onIdleChange: (idle) => {
        outputFocusRegion.dataset.outputIdle = idle ? "true" : "false";
      }
    });
    let lastPointerPosition: { x: number; y: number } | null = null;
    const handlePointerMove = (event: MouseEvent | PointerEvent) => {
      if (lastPointerPosition && lastPointerPosition.x === event.clientX && lastPointerPosition.y === event.clientY) return;
      lastPointerPosition = { x: event.clientX, y: event.clientY };
      idleController.notifyActivity();
    };
    const handleActivity = () => idleController.notifyActivity();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") idleController.suspend();
      else idleController.resume();
    };
    const handlePageHide = () => idleController.suspend();
    const handlePageShow = () => {
      if (document.visibilityState !== "hidden") idleController.resume();
    };
    window.addEventListener("pointermove", handlePointerMove, { capture: true, passive: true });
    window.addEventListener("mousemove", handlePointerMove, { capture: true, passive: true });
    window.addEventListener("pointerdown", handleActivity, { capture: true, passive: true });
    window.addEventListener("keydown", handleActivity, { capture: true });
    window.addEventListener("wheel", handleActivity, { capture: true, passive: true });
    window.addEventListener("touchstart", handleActivity, { capture: true, passive: true });
    document.addEventListener("focusin", handleActivity, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleActivity);
    if (document.visibilityState === "hidden") idleController.suspend();
    else idleController.resume();
    return () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("mousemove", handlePointerMove, true);
      window.removeEventListener("pointerdown", handleActivity, true);
      window.removeEventListener("keydown", handleActivity, true);
      window.removeEventListener("wheel", handleActivity, true);
      window.removeEventListener("touchstart", handleActivity, true);
      document.removeEventListener("focusin", handleActivity, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleActivity);
      idleController.dispose();
    };
  }, [settings.appearance.advanced.aiWorkOutputFocusBlurEnabled, settings.appearance.advanced.aiWorkOutputFocusBlurIdleSeconds]);
  const conversationScroll = useAiConversationScroll({
    userId,
    appId,
    activeSessionId,
    messagesReady,
    messagesSessionId,
    messages,
    initiallyPrepared: !activeSessionId || cachedMessages !== null,
    busy,
    reducedMotion: settings.appearance.advanced.reducedMotion,
    setShowScrollToLatest,
    setActiveAnchorId,
    setAnchorViewportHeight,
    stopPlayback: stopVoicePlayback
  });
  const {
    messagesElementRef,
    olderMessagesScrollRestoreRef,
    preparedScrollConversationRef,
    followLatestMessageRef,
    responseProcessDetailsRef,
    responseProcessUserScrolledRef,
    setMessagesElement,
    handleResponseProcessClickCapture,
    handleMessagesWheel,
    handleMessagesPointerDown,
    handleMessagesPointerUp,
    handleMessagesScroll,
    scrollToLatest
  } = conversationScroll;
  const activeAccount = accountLoadState === "ready" ? effectiveAiAccount(accounts) : undefined;
  const modelPickerCatalog = useMemo(() => aiModelPickerCatalog(accounts), [accounts]);
  const activeSession = sessions.find(session => session.id === activeSessionId) ?? null;
  useEffect(() => {
    const override = contextSelectionOverrideRef.current;
    setSelectedContextApplicationId(override?.scope === contextSelectionScope
      ? override.value
      : contextApplicationId ?? activeSession?.contextApplicationId ?? null);
  }, [activeSessionId, activeSession?.contextApplicationId, contextApplicationId, contextSelectionScope]);
  const activeSessionHasResolvedAssistant = Boolean(activeSessionId && messagesSessionId === activeSessionId && messagesReady
    && messages.some(message => message.role === "assistant" && message.status !== "queued" && message.status !== "streaming"));
  useEffect(() => {
    if (!activeSessionId || !activeSession || activeSession.archived
      || (activeSession.titleStatus !== "pending" && activeSession.titleStatus !== "legacy")
      || !activeSessionHasResolvedAssistant) return;
    const ownerKey = sessionTitleOwnerKey;
    const attemptKey = `${ownerKey}:${activeSessionId}`;
    let disposed = false;
    let started = false;
    const startGeneration = () => {
      if (disposed || started || document.visibilityState === "hidden") return;
      started = true;
      document.removeEventListener("visibilitychange", startGeneration);
      if (!rememberSessionTitleGenerationAttempt(attemptKey)) return;
      void generateAiSessionTitle(activeSessionId).then(({ session, generated }) => {
        if (!session || sessionTitleOwnerKeyRef.current !== ownerKey) return;
        onSessionChange(session);
        if (!disposed && !generated && session.titleStatus === "pending") {
          setError("自动生成聊天标题未完成，已保留当前短标题。");
        }
      }).catch((titleError: unknown) => {
        if (!disposed && sessionTitleOwnerKeyRef.current === ownerKey) {
          setError(`自动生成聊天标题失败，已保留当前短标题：${getErrorMessage(titleError)}`);
        }
      });
    };
    document.addEventListener("visibilitychange", startGeneration);
    startGeneration();
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", startGeneration);
    };
  }, [activeSession?.archived, activeSession?.titleStatus, activeSessionHasResolvedAssistant, activeSessionId, onSessionChange, sessionTitleOwnerKey]);
  const conversationInputSlotOwner = useMemo(() => ({ sessionId: activeSessionId }), [activeSessionId]);
  const planModeActive = planModeOverride?.sessionId === activeSessionId ? planModeOverride.active : activeSession?.planMode === true;
  const composerMentionCatalog = useMemo<ComposerTriggerMenuItem[]>(() => {
    const applications: ComposerTriggerMenuItem[] = APPLICATION_IDS
      .filter(id => id !== "workspace")
      .map(id => ({
        id: `application:${id}`,
        group: "应用",
        label: applicationAssociationLabels[id],
        description: "关联到本次对话",
        icon: "folder",
        association: { kind: "application", id }
      }));
    const uniqueCapabilities = new Map<string, { id: string; name: string; kind: string }>();
    for (const capability of capabilities) uniqueCapabilities.set(capability.id, capability);
    const availableCapabilities: ComposerTriggerMenuItem[] = Array.from(uniqueCapabilities.values()).map(capability => ({
      id: `capability:${capability.id}`,
      group: capabilityAssociationGroup(capability.kind),
      label: capability.name,
      description: "关联为参考能力；是否读取由小鱼按目标判断",
      icon: capability.kind === "skill" ? "book" : capability.kind === "expert" ? "user" : capability.kind === "prompt" ? "spark" : "tools",
      association: { kind: "capability", id: capability.id }
    }));
    return [...applications, ...availableCapabilities].map(item => ({
      ...item,
      searchText: `${item.label} ${item.group}`.toLocaleLowerCase("zh-CN")
    }));
  }, [capabilities]);
  const composerMenuItems = useMemo<ComposerTriggerMenuItem[]>(() => {
    if (!composerMenu) return [];
    const query = composerMenu.query.trim().toLocaleLowerCase("zh-CN");
    if (composerMenu.trigger === "/") {
      return composerSlashCommands
        .filter(item => item.label.slice(1).toLocaleLowerCase("zh-CN").startsWith(query))
        .map(item => item.action === "open-model-picker"
          ? { ...item, disabled: modelPickerCatalog.length === 0 || modelBusy || busy }
          : item);
    }

    const unavailable = busy || associationsBusy;
    return composerMentionCatalog
      .filter(item => !query || item.searchText?.includes(query))
      .slice(0, 60)
      .map(item => ({ ...item, disabled: unavailable }));
  }, [activeAccount, associationsBusy, busy, composerMenu, composerMentionCatalog, modelBusy, modelPickerCatalog.length]);
  const composerMenuGroups = useMemo(() => Array.from(new Set(composerMenuItems.map(item => item.group))), [composerMenuItems]);
  const composerMenuVisible = Boolean(composerMenu);
  useEffect(() => { setComposerMenu(null); setComposerMenuActiveIndex(0); }, [activeSessionId, newSessionKey]);
  useLayoutEffect(() => {
    const form = composerFormRef.current;
    if (!composerMenuVisible || !form) {
      setComposerMenuMaxHeight(null);
      return;
    }

    const viewport = window.visualViewport;
    const updateAvailableHeight = () => {
      const formTop = form.getBoundingClientRect().top;
      const chatTop = form.closest(".ai-work-chat")?.getBoundingClientRect().top ?? 0;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportTop = window.visualViewport?.offsetTop ?? 0;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const preferredHeight = viewportWidth <= 520
        ? Math.min(360, viewportHeight * 0.44)
        : Math.min(480, viewportHeight * 0.74);
      const availableHeight = Math.max(0, formTop - Math.max(viewportTop, chatTop) - 9);
      setComposerMenuMaxHeight(Math.floor(Math.min(preferredHeight, availableHeight)));
    };

    updateAvailableHeight();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateAvailableHeight);
    observer?.observe(form);
    window.addEventListener("resize", updateAvailableHeight);
    viewport?.addEventListener("resize", updateAvailableHeight);
    viewport?.addEventListener("scroll", updateAvailableHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateAvailableHeight);
      viewport?.removeEventListener("resize", updateAvailableHeight);
      viewport?.removeEventListener("scroll", updateAvailableHeight);
    };
  }, [composerMenuVisible]);
  useLayoutEffect(() => {
    const caret = pendingComposerCaretRef.current;
    if (caret === null) return;
    const textarea = composerFormRef.current?.querySelector("textarea");
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
    pendingComposerCaretRef.current = null;
  }, [composerSelectionRevision]);
  useEffect(() => { setPlanModeOverride(null); }, [activeSessionId]);
  useEffect(() => { setAssociations(activeSession?.associations ?? { applicationIds: [], capabilityIds: [] }); }, [activeSessionId, activeSession?.associations, newSessionKey]);
  async function changeAssociations(next: AgentAssociations): Promise<void> {
    if (busy || associationsBusy) return;
    setAssociationsBusy(true);
    try {
      if (activeSessionId) {
        const { session } = await setAiSessionAssociations(activeSessionId, next);
        onSessionsChange([session, ...sessions.filter(item => item.id !== session.id)]);
      }
      setAssociations(next); setError("");
    } catch (associationError) { setError(getErrorMessage(associationError)); }
    finally { setAssociationsBusy(false); }
  }
  async function changeContextApplication(value: "workspace" | WorkspaceProjectContextApplicationId): Promise<void> {
    if (busy || contextApplicationBusy) return;
    const next = value === "workspace" ? null : value;
    contextSelectionOverrideRef.current = { scope: contextSelectionScope, value: next };
    setSelectedContextApplicationId(next);
    if (!activeSessionId) return;
    setContextApplicationBusy(true);
    try {
      const { session } = await setAiSessionContextApplication(activeSessionId, next);
      onSessionsChange([session, ...sessions.filter(item => item.id !== session.id)]);
      setError("");
    } catch (contextError) {
      setSelectedContextApplicationId(activeSession?.contextApplicationId ?? null);
      setError(getErrorMessage(contextError));
    } finally { setContextApplicationBusy(false); }
  }
  const branchSourceProject = activeSession?.projectId ? workspaceProjects.find(project => project.id === activeSession.projectId) ?? null : null;
  const branchSourceNode = branchSourceProject ? workspaceNodes.find(node => node.id === branchSourceProject.nodeId) ?? null : null;
  const canCreateWorktreeBranch = (appId === "workspace" || appId === "minecraft")
    && Boolean(branchSourceProject && (appId === "workspace" || branchSourceProject.appId === appId) && !branchSourceProject.gitWorktree
      && branchSourceNode?.local);
  const activeModel = activeAccount?.models.find((model) => model.id === activeAccount.modelId);
  const activeModelReasoningOptions = reasoningOptions(activeModel);
  const activeReasoningMode = effectiveReasoningMode(activeModel, activeAccount?.reasoningMode ?? "default");
  const activeReasoningLevels = activeModelReasoningOptions.filter((option) => option.value !== "default");
  const providerDefaultReasoningMode = activeModel?.thinking?.kind === "effort"
    ? activeModel.thinking.defaultValue
    : activeModel?.thinking?.kind === "toggle" && activeModel.thinking.defaultValue === "enabled" ? "enabled" : undefined;
  const activeReasoningIndex = activeReasoningLevels.findIndex((option) => option.value === (activeReasoningMode === "default" ? providerDefaultReasoningMode : activeReasoningMode));
  const activeReasoningLabel = activeReasoningMode === "default"
    ? reasoningDefaultLabel(activeModel).replace(/^跟随/u, "")
    : reasoningModeLabel(activeReasoningMode);
  const matchingModels = useMemo(() => {
    const query = modelSearch.trim().toLocaleLowerCase("zh-CN");
    return modelPickerCatalog.filter(({ account, model }) => !query
      || `${account.displayName} ${account.providerId} ${model.name} ${modelOptionVersionTag(model) ?? ""} ${model.id}`.toLocaleLowerCase("zh-CN").includes(query));
  }, [modelPickerCatalog, modelSearch]);
  const visibleModels = matchingModels.slice(0, modelResultLimit);
  const modelPickerAccountCount = useMemo(() => new Set(modelPickerCatalog.map(({ account }) => account.id)).size, [modelPickerCatalog]);

  useEffect(() => {
    const handleModelPickerShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || !modelPickerCatalog.length || modelBusy || busy) return;
      if (!settings.shortcuts.openModelPicker.some((chord) => chord && shortcutMatches(event, chord))) return;
      event.preventDefault();
      setModelSearch("");
      setModelResultLimit(MODEL_PICKER_RESULT_LIMIT);
      setReasoningDraftIndex(null);
      setModelPickerView("reasoning");
      openModelPicker();
    };
    window.addEventListener("keydown", handleModelPickerShortcut);
    return () => window.removeEventListener("keydown", handleModelPickerShortcut);
  }, [busy, modelBusy, modelPickerCatalog.length, openModelPicker, settings.shortcuts.openModelPicker]);

  useEffect(() => {
    if (projectSelectionSessionKeyRef.current !== newSessionKey) {
      projectSelectionSessionKeyRef.current = newSessionKey;
      projectSelectionExplicitRef.current = Boolean(newSessionProjectId);
    }
    if (!activeSessionId && supportsWorkspaceProjectContext) {
      const projectId = resolveNewSessionWorkspaceProjectId({
        requestedProjectId: newSessionProjectId,
        defaultProjectId: defaultWorkspaceProjectId,
        selectedProjectId,
        selectionIsExplicit: projectSelectionExplicitRef.current
      });
      setSelectedProjectId(projectId);
      if (newSessionProjectId !== null || projectSelectionExplicitRef.current) onSelectedProjectChange(projectId);
    } else if (!activeSessionId) {
      setSelectedProjectId(null);
      onSelectedProjectChange(null);
    } else {
      projectSelectionExplicitRef.current = true;
    }
  }, [activeSessionId, defaultWorkspaceProjectId, newSessionKey, newSessionProjectId, onSelectedProjectChange, selectedProjectId, supportsWorkspaceProjectContext]);

  useEffect(() => {
    if (!activeSessionId) return;
    const session = sessions.find(item => item.id === activeSessionId);
    if (session) {
      setSelectedProjectId(session.projectId ?? null);
      onSelectedProjectChange(session.projectId ?? null);
    }
  }, [activeSessionId, onSelectedProjectChange, sessions]);

  async function changeWorkspaceProject(project: WorkspaceProject | null): Promise<void> {
    if (busy || projectBusy || !workspaceProjectAppId) return;
    projectSelectionExplicitRef.current = true;
    setProjectBusy(true);
    try {
      if (activeSessionId) {
        const { session } = await setAiSessionProject(activeSessionId, project?.id ?? null, workspaceProjectAppId);
        onSessionsChange([session, ...sessions.filter(item => item.id !== session.id)]);
      }
      setSelectedProjectId(project?.id ?? null);
      onSelectedProjectChange(project?.id ?? null);
      setError("");
    } catch (projectError) { setError(getErrorMessage(projectError)); }
    finally { setProjectBusy(false); }
  }
  const pendingInteraction = useMemo(() => findPendingAiInteraction(messages), [messages]);

  useEffect(() => { setQuestionReply(""); }, [pendingInteraction?.activity.questionId]);

  useAiConversationScrollLifecycle({
    scroll: conversationScroll,
    appId,
    activeSessionId,
    busy,
    messagesReady,
    messages,
    setShowScrollToLatest,
    setActiveAnchorId,
    setAnchorViewportHeight
  });

  useEffect(() => {
    let alive = true;
    void loadAiAccounts().then((accountResult) => {
      if (!alive) return;
      aiAccountSnapshots.set(userId, accountResult.accounts);
      setAccounts(accountResult.accounts);
      setAccountLoadState("ready");
      const account = accountResult.accounts.find((item) => item.active);
      onProviderStatusChange(account ? `${account.displayName} · ${account.modelId}` : "未配置模型");
    }).catch((loadError: unknown) => {
      if (alive) {
        setAccountLoadState("error");
        setError(getErrorMessage(loadError));
        onProviderStatusChange("模型状态不可用");
      }
    });
    return () => { alive = false; };
  }, [appId, cachedAccounts, onProviderStatusChange, userId]);

  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  useLayoutEffect(() => {
    if (!busy || sessionIdForTurn.current === activeSessionId && sessionKeyForTurn.current === newSessionKey && appIdForTurn.current === appId) return;
    const controller = controllerRef.current;
    if (!controller) return;

    // 只撤销此页面的事件订阅；服务端 Agent Run 会继续运行，返回会话时再按 Session 记录续订。
    runRequestGenerationRef.current += 1;
    controller.abort();
    controllerRef.current = null;
    activeRunRef.current = null;
    autoFollowAttempt.current = null;
    runPauseEventRevisionRef.current += 1;
    setRunPauseState(null);
    setRunPauseBusy(false);
    setStopGuardElapsed(false);
    if (stopGuardTimerRef.current) clearTimeout(stopGuardTimerRef.current);
    stopGuardTimerRef.current = null;
    stopGuardStartedAtRef.current = null;
    setBusy(false);
  }, [activeSessionId, appId, busy, newSessionKey]);

  useEffect(() => () => {
    const controller = controllerRef.current;
    if (!controller) return;
    runRequestGenerationRef.current += 1;
    controller.abort();
    controllerRef.current = null;
    if (stopGuardTimerRef.current) clearTimeout(stopGuardTimerRef.current);
    stopGuardTimerRef.current = null;
  }, []);

  useEffect(() => {
    if (!busy) return;
    return aiActivityClock.start();
  }, [busy]);

  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  useEffect(() => {
    setMessages([]);
    setSubagentStreamPreviews({});
    setMessagesSessionId(activeSessionId);
    setUsageByMessage({});
    setSessionUsageSummary(null);
    setSessionUsageLoadState(activeSessionId ? "loading" : "ready");
    setContextUsage(null);
    setActiveAnchorId(null);
    setError("");
  }, [newSessionKey]);

  useEffect(() => {
    setError("");
  }, [activeSessionId, appId]);

  useEffect(() => {
    const conversationKey = `${appId}:${activeSessionId ?? "new-session"}`;
    if (busy) {
      preparedScrollConversationRef.current = conversationKey;
      setMessagesReady(true);
      return;
    }
    if (!activeSessionId) {
      preparedScrollConversationRef.current = conversationKey;
      setMessages([]);
      setMessagesSessionId(null);
      setActiveAnchorId(null);
      setMessagesReady(true);
      setLoading(false);
      setSessionUsageLoadState("ready");
      setMessagePageCursor(null);
      setHasOlderMessages(false);
      return;
    }
    const cacheKey = aiMessageSnapshotKey(userId, appId, activeSessionId);
    const messageSessionKey = `${userId}:${conversationKey}`;
    const sessionSnapshot = aiMessageSnapshots.get(cacheKey);
    if (loadedMessageSessionKeyRef.current === messageSessionKey) {
      setMessagesReady(true);
      setLoading(false);
      setSessionUsageLoadState("ready");
      return;
    }
    let alive = true;
    const controller = new AbortController();
    if (sessionSnapshot) {
      preparedScrollConversationRef.current = conversationKey;
      setMessages(hideSubmittedReplySuggestions(sessionSnapshot));
      setMessagesSessionId(activeSessionId);
      setLoading(false);
      setMessagesReady(true);
    } else {
      preparedScrollConversationRef.current = null;
      setLoading(true);
      setMessagesReady(false);
    }
    void loadAiMessages(activeSessionId, undefined, controller.signal).then((result) => {
      if (alive) {
        loadedMessageSessionKeyRef.current = messageSessionKey;
        preparedScrollConversationRef.current = conversationKey;
        const visibleMessages = hideSubmittedReplySuggestions(result.messages);
        aiMessageSnapshots.set(cacheKey, visibleMessages);
        setMessages(visibleMessages);
        setMessagesSessionId(activeSessionId);
        setSessionUsageSummary(result.usageSummary);
        setSessionUsageLoadState("ready");
        setContextUsage(result.contextUsage);
        setBranchSourceSnapshot({ sessionId: activeSessionId, source: result.branchSource ?? null });
        setMessagePageCursor(result.nextCursor);
        setHasOlderMessages(Boolean(result.nextCursor));
        const running = result.messages.find(item => item.role === "assistant" && (item.status === "streaming" || item.status === "queued"));
        if (running && autoFollowAttempt.current !== running.id) { autoFollowAttempt.current = running.id; void sendMessage("", running.id); }
      }
    }).catch((loadError: unknown) => {
      if (alive && !controller.signal.aborted) {
        setError(getErrorMessage(loadError));
        setSessionUsageLoadState("error");
      }
    }).finally(() => {
      if (alive) {
        setLoading(false);
        setMessagesReady(true);
      }
    });
    return () => { alive = false; controller.abort(); };
  }, [activeSessionId, appId, busy, userId]);

  useLayoutEffect(() => {
    const awaitingCreatedSessionSelection = busy && activeSessionId === null && messagesSessionId !== null && messagesSessionId === sessionIdForTurn.current;
    if (messagesSessionId !== activeSessionId && !awaitingCreatedSessionSelection) {
      const snapshot = activeSessionId ? aiMessageSnapshots.get(aiMessageSnapshotKey(userId, appId, activeSessionId)) : null;
      setMessages(snapshot ? hideSubmittedReplySuggestions(snapshot) : []);
      setSubagentStreamPreviews({});
      setMessagesSessionId(activeSessionId);
      setLoading(Boolean(activeSessionId && !snapshot));
      setMessagesReady(!activeSessionId || Boolean(snapshot));
      setActiveAnchorId(null);
      setUsageByMessage({});
    }
    setMessagePageCursor(null);
    setHasOlderMessages(false);
    setSessionUsageSummary(null);
    setSessionUsageLoadState(activeSessionId ? "loading" : "ready");
    setContextUsage(null);
  }, [activeSessionId, appId, busy, messagesSessionId, userId]);

  async function loadEarlierMessages(): Promise<void> {
    if (!activeSessionId || !messagePageCursor || loadingOlderMessages) return;
    const element = messagesElementRef.current;
    olderMessagesScrollRestoreRef.current = element ? { height: element.scrollHeight, top: element.scrollTop } : null;
    setLoadingOlderMessages(true);
    setMessageActionError("");
    try {
      const result = await loadAiMessages(activeSessionId, messagePageCursor);
      if (!result.messages.length) olderMessagesScrollRestoreRef.current = null;
      setMessages(current => {
        const existing = new Set(current.map(message => message.id));
        return hideSubmittedReplySuggestions([...result.messages.filter(message => !existing.has(message.id)), ...current]);
      });
      setMessagePageCursor(result.nextCursor);
      setHasOlderMessages(Boolean(result.nextCursor));
      setSessionUsageSummary(result.usageSummary);
      setContextUsage(result.contextUsage);
    } catch (loadError) {
      olderMessagesScrollRestoreRef.current = null;
      setMessageActionError(`加载更早消息失败：${getErrorMessage(loadError)}`);
    } finally {
      setLoadingOlderMessages(false);
    }
  }

  async function changePlanMode(active: boolean): Promise<void> {
    if (busy || planModeBusy) return;
    setPlanModeBusy(true);
    setError("");
    try {
      if (!activeSessionId) {
        setPlanModeOverride({ sessionId: null, active });
        return;
      }
      const { session } = await setAiSessionPlanMode(activeSessionId, active);
      onSessionsChange([session, ...sessions.filter(item => item.id !== session.id)]);
      setPlanModeOverride({ sessionId: activeSessionId, active: session.planMode });
    } catch (modeError) {
      setError(`计划模式切换失败：${getErrorMessage(modeError)}`);
    } finally {
      setPlanModeBusy(false);
    }
  }

  async function sendMessage(value = draft, followRunId?: string, targetSession?: { session: AiSession; baseMessages: AiMessage[]; onStarted?: () => void }, sendOptions?: { planMode?: boolean }): Promise<void> {
    if (projectDirectoryMissing && !followRunId) {
      setError("项目目录已删除或移动；当前会话仅可查看历史记录，请新建会话后继续工作。 ");
      return;
    }
    if (associationsBusy || projectBusy) return;
    const typed = value.trim();
    // 只带附件也能发送；有活动 Run 时带附件必须阻止（跟进队列不携带附件）。
    if (!typed && pendingAttachments.length === 0 && !followRunId) return;
    if ((busy || activeRunRef.current) && pendingAttachments.length > 0 && !followRunId && !targetSession) {
      setError("附件只能随新消息发送：请等当前任务结束后再发送，或先移除附件。");
      return;
    }
    // 发送即消费附件引用：避免下一次消息重复带上同一张图。
    const sendingAttachments = takePendingAttachments();
    const content = typed || "请看附件。";
    if (editingMessage && !targetSession && !followRunId) return;
    if (!targetSession && !followRunId && /^\/side(?:\s|$)/iu.test(content)) {
      const initialQuestion = content.replace(/^\/side\s*/iu, "").trim();
      setDraft("");
      onDraftChange("");
      onOpenSideChat(initialQuestion || undefined);
      return;
    }
    const planCommand = !targetSession && !followRunId ? /^\/plan(?:\s+([\s\S]*))?$/iu.exec(content) : null;
    if (planCommand) {
      if (busy) { setError("当前任务仍在运行，请等它结束后再切换计划模式。"); return; }
      const planInput = planCommand[1]?.trim() ?? "";
      if (planInput.toLocaleLowerCase("zh-CN") === "off") {
        setDraft(""); onDraftChange("");
        await changePlanMode(false);
        return;
      }
      if (!planInput) {
        setDraft(""); onDraftChange("");
        await changePlanMode(true);
        return;
      }
      return sendMessage(planInput, undefined, undefined, { planMode: true });
    }
    if (!content && !followRunId) return;
    if (projectBusy) return;
    if (busy && !targetSession) {
      if (!activeRunRef.current || !content) return;
      try {
        const result = await appendAiRunInput(activeRunRef.current, content);
        setDraft(""); onDraftChange("");
        setMessages(current => { const incoming = result.mode === "queue" ? [result.userMessage, result.run.message] : [result.userMessage]; return hideSubmittedReplySuggestions([...current.filter(item => !incoming.some(next => next.id === item.id)), ...incoming]); });
      } catch (error) { setError(getErrorMessage(error)); }
      return;
    }
    if (!activeAccount && !followRunId) {
      setError("请先到设置中心的“AI 与模型”添加并启用一个 Provider 账户。");
      return;
    }
    const voiceTurn = voiceMode && voiceSessionActiveRef.current && !followRunId && !targetSession;
    if (voiceTurn) {
      stopListening.current?.();
      stopListening.current = null;
      setListening(false);
      voiceReplyInProgressRef.current = true;
      voiceResumePendingRef.current = false;
    }
    const requestSessionId = targetSession ? targetSession.session.id : activeSessionId;
    const requestProjectId = supportsWorkspaceProjectContext ? targetSession ? targetSession.session.projectId : selectedProjectId : null;
    const requestedPlanMode = sendOptions?.planMode ?? (planModeOverride?.sessionId === requestSessionId ? planModeOverride.active : undefined);
    const requestGeneration = ++runRequestGenerationRef.current;
    followLatestMessageRef.current = true;
    if (!followRunId) { setDraft(""); onDraftChange(""); }
    setError("");
    activeRunRef.current = null;
    runPauseEventRevisionRef.current += 1;
    setRunPauseState(null);
    setStopGuardElapsed(false);
    if (stopGuardTimerRef.current) clearTimeout(stopGuardTimerRef.current);
    stopGuardStartedAtRef.current = Date.now();
    stopGuardTimerRef.current = setTimeout(() => {
      stopGuardTimerRef.current = null;
      if (requestGeneration === runRequestGenerationRef.current) setStopGuardElapsed(true);
    }, AI_RUN_CONTROL_GUARD_MS);
    setBusy(true);
    sessionIdForTurn.current = requestSessionId;
    sessionKeyForTurn.current = newSessionKey;
    appIdForTurn.current = appId;
    notifiedTurnEvents.current.clear();
    const controller = new AbortController();
    controllerRef.current = controller;
    const isCurrentSubscription = () => requestGeneration === runRequestGenerationRef.current && !controller.signal.aborted;
    let spokenContent = "";
    let voiceReplyCompleted = false;
    let followedExistingCompletion = false;
    let runMessageId: string | null = null;
    let runSessionId = requestSessionId;
    // 同一运行的设置失效合并为串行读取；离开会话或换账户后旧响应不更新工作台。
    let settingsRefreshRunning = false, settingsRefreshPending = false;
    const refreshCapabilitySettings = (): void => {
      settingsRefreshPending = true;
      if (settingsRefreshRunning) return;
      settingsRefreshRunning = true;
      void (async () => {
        try {
          while (settingsRefreshPending && !controller.signal.aborted && requestGeneration === runRequestGenerationRef.current) {
            settingsRefreshPending = false;
            const result = await loadSettings(controller.signal);
            if (!controller.signal.aborted && requestGeneration === runRequestGenerationRef.current) onSettingsChange(result.settings);
          }
        } catch (error) {
          if (!controller.signal.aborted && requestGeneration === runRequestGenerationRef.current) setError(`能力设置对账失败：${getErrorMessage(error)}`);
        } finally { settingsRefreshRunning = false; }
      })();
    };
    try {
      await streamAiChat({
        ...(followRunId ? { runId: followRunId } : {}),
        appId,
        contextApplicationId: selectedContextApplicationId,
        sessionId: requestSessionId,
        ...(!requestSessionId && requestProjectId ? { projectId: requestProjectId } : {}),
        ...(!requestSessionId && newSessionGitRepositoryId ? { gitRepositoryId: newSessionGitRepositoryId } : {}),
        ...(!requestSessionId ? { associations } : {}),
        ...(!followRunId && workspaceView ? { workspaceView } : {}),
        content,
        ...(requestedPlanMode === undefined ? {} : { planMode: requestedPlanMode }),
        ...(sendingAttachments.length ? { attachmentIds: sendingAttachments.map(item => item.id), attachments: sendingAttachments.map(item => ({ id: item.id, name: item.name })) } : {}),
        signal: controller.signal,
        onSession: ({ session, userMessage, assistantMessage }) => {
      if (sendingAttachments.length > 0) messageAttachmentRefs.set(userMessage.id, sendingAttachments.map(file => ({ id: file.id, name: file.name })));
          if (!isCurrentSubscription()) return;
          canvasMutationObservedRef.current = false;
          workspaceProjectCreatedObservedRef.current = false;
          spokenContent = assistantMessage.content;
          followedExistingCompletion = assistantMessage.status === "complete";
          runMessageId = assistantMessage.id;
          runSessionId = session.id;
          activeRunRef.current = assistantMessage.id;
          setRunPauseState({ runId: assistantMessage.id, state: "running" });
          autoFollowAttempt.current = assistantMessage.id;
          sessionIdForTurn.current = session.id;
          setPlanModeOverride({ sessionId: session.id, active: session.planMode });
          onActiveSessionChange(session.id);
          onSessionsChange([session, ...sessions.filter((item) => item.id !== session.id)]);
          setMessages((current) => {
            const starting = targetSession?.baseMessages ?? current;
            const incoming = [userMessage, assistantMessage];
            return hideSubmittedReplySuggestions([...starting.map(item => incoming.find(next => next.id === item.id) ?? item), ...incoming.filter(next => !starting.some(item => item.id === next.id))]);
          });
          setMessagesSessionId(session.id);
          targetSession?.onStarted?.();
        },
        onPauseState: ({ runId, state }) => {
          if (!isCurrentSubscription()) return;
          if (!runMessageId || runMessageId === runId) {
            runPauseEventRevisionRef.current += 1;
            setRunPauseState({ runId, state });
          }
        },
        onPlanMode: active => { if (isCurrentSubscription()) setPlanModeOverride({ sessionId: runSessionId, active }); },
        onSettingsInvalidated: refreshCapabilitySettings,
        onInput: (message) => { if (isCurrentSubscription()) setMessages(current => hideSubmittedReplySuggestions([...current.filter(item => item.id !== message.id), message])); },
        onActivity: ({ messageId, activity }) => {
          if (!isCurrentSubscription()) return;
          if (activity.status === "complete" && activity.toolId && canvasMutationToolIds.has(activity.toolId)) canvasMutationObservedRef.current = true;
          if (activity.status === "complete" && activity.toolUsage?.name === "workspace_create_project") workspaceProjectCreatedObservedRef.current = true;
          if (activity.status === "complete" && activity.toolId?.startsWith("browser-use.") && isBuiltinBrowserProvider(activity.browserProviderId)) {
            onBrowserToolCompleted?.(activity.browserProviderId);
          }
          setMessages((current) => current.map((item) => {
            if (item.id !== messageId) return item;
            const nextActivity = item.activity.filter((entry) => entry.id !== activity.id);
            nextActivity.push(activity);
            // 同一条活动后续会多次更新状态，重新按首次开始时间排序以保留真实执行顺序。
            nextActivity.sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt));
            return { ...item, activity: nextActivity };
          }));
          if (activity.status === "approval_required" && settings.general.permissionNotifications) {
            notifySessionAction(`approval:${activity.approvalId ?? activity.id}`, "approval", "需要审批", `${activity.title} 正在等待你的审批。`);
          }
          if (activity.status === "waiting_input" && settings.general.questionNotifications) {
            notifySessionAction(`question:${activity.questionId ?? activity.id}`, "question", "需要你补充信息", activity.question ?? activity.detail);
          }
          if (activity.status === "error") notifySessionIssue("小鱼智能体 步骤未能完成，请打开会话查看活动详情。");
        },
        onPromptSuggestions: ({ messageId, suggestions }) => {
          if (!isCurrentSubscription()) return;
          setMessages(current => hideSubmittedReplySuggestions(current.map(item => item.id === messageId ? { ...item, promptSuggestions: suggestions } : item)));
        },
        onSubagentDelta: ({ messageId, activityId, delta }) => {
          if (!isCurrentSubscription() || (runMessageId && runMessageId !== messageId)) return;
          setSubagentStreamPreviews(current => appendSubagentStreamPreview(current, `${messageId}:${activityId}`, delta));
        },
        onDelta: value => { if (!isCurrentSubscription()) return; spokenContent += value.delta; setMessages(current => current.map(item => item.id === value.messageId ? appendAiTextDelta(item, value) : item)); },
        onPresentation: ({ messageId, parts }) => { if (isCurrentSubscription()) setMessages(current => current.map(item => item.id === messageId ? { ...item, parts } : item)); },
        onUsage: ({ messageId, sessionUsage, ...usage }) => {
          if (!isCurrentSubscription()) return;
          if (messageId) setUsageByMessage((current) => ({ ...current, [messageId]: usage }));
          else setUsageByMessage((current) => {
            const latestAssistant = [...messages].reverse().find((item) => item.role === "assistant");
            return latestAssistant ? { ...current, [latestAssistant.id]: usage } : current;
          });
          if (sessionUsage) setSessionUsageSummary(sessionUsage);
        },
        onUsageProgress: ({ sessionUsage }) => { if (isCurrentSubscription()) setSessionUsageSummary(sessionUsage); },
        onContextUsage: ({ contextUsage: nextContextUsage }) => { if (isCurrentSubscription()) setContextUsage(nextContextUsage); },
        onError: error => { if (isCurrentSubscription()) setError(error); },
        onDone: (status) => {
          if (!isCurrentSubscription()) return;
          if (canvasMutationObservedRef.current) {
            canvasMutationObservedRef.current = false;
            onCanvasToolsCompleted?.(workspaceView?.canvas?.projectId);
          }
          if (workspaceProjectCreatedObservedRef.current) {
            workspaceProjectCreatedObservedRef.current = false;
            onWorkspaceProjectCreated?.();
          }
          if (voiceTurn) {
            voiceReplyCompleted = status === "complete";
            if (status !== "complete") endVoiceSession();
            else if (currentSettingsRef.current.aiRuntime.readResponsesAloud && spokenContent && !followedExistingCompletion) {
              if (supportsVoiceOutput()) {
                setVoiceSpeaking(true);
                try {
                  readResponseAloud(spokenContent, currentSettingsRef.current.general.language, {
                    onEnd: finishVoicePlayback,
                    onError: message => { setError(message); finishVoicePlayback(); }
                  });
                } catch (playbackError) {
                  setError(getErrorMessage(playbackError));
                  queueVoiceResume();
                }
              } else {
                setError("当前宿主不支持语音播报。");
                queueVoiceResume();
              }
            } else queueVoiceResume();
          }
          runPauseEventRevisionRef.current += 1;
          setRunPauseState(current => current?.runId === runMessageId ? null : current);
          const completedMessageId = runMessageId;
          if (completedMessageId) {
            setSubagentStreamPreviews(current => clearSubagentStreamPreviews(current, completedMessageId));
            setExpandedActivitySteps(current => current?.messageId === completedMessageId ? null : current);
            setMessages((current) => current.map((item) => item.id === completedMessageId ? { ...item, status } : item));
          }
          if (status === "error") notifySessionIssue("本轮 小鱼智能体 回复未能完成，请打开会话查看错误详情。");
          if (status === "complete" && runSessionId) {
            if (!voiceTurn && settings.aiRuntime.readResponsesAloud && spokenContent && !followedExistingCompletion) { try { readResponseAloud(spokenContent, settings.general.language); } catch (error) { setError(getErrorMessage(error)); } }
            notifyAiWorkCompletion({
              notification: {
                appId,
                applicationName: applicationNameFor(appId),
                sessionId: runSessionId,
                kind: "complete",
                title: "回复已完成",
                body: `${applicationNameFor(appId)} 会话已完成回复，点击查看。`
              },
              enabled: settings.general.notificationPopupsEnabled,
              policy: settings.general.completionNotification,
              sound: settings.general.notificationSound,
              onNotification
            });
          }
        }
      });
      const sessionResult = await loadAiSessions();
      if (isCurrentSubscription()) onSessionsChange(sessionResult.sessions);
    } catch (sendError) {
      if (requestGeneration !== runRequestGenerationRef.current) return;
      if (voiceTurn) endVoiceSession();
      if (!(sendError instanceof DOMException && sendError.name === "AbortError")) {
        setError(getErrorMessage(sendError));
        notifySessionIssue("本轮 小鱼智能体 回复发生错误，请打开会话查看详情。");
      }
      // 传输错误只代表订阅中断；服务端任务继续运行，不能在本地伪造已停止状态。
    } finally {
      if (requestGeneration === runRequestGenerationRef.current) {
        runPauseEventRevisionRef.current += 1;
        if (stopGuardTimerRef.current) clearTimeout(stopGuardTimerRef.current);
        stopGuardTimerRef.current = null;
        stopGuardStartedAtRef.current = null;
        activeRunRef.current = null;
        setRunPauseState(null);
        setStopGuardElapsed(false);
        if (controllerRef.current === controller) controllerRef.current = null;
        setBusy(false);
        if (voiceTurn) {
          voiceReplyInProgressRef.current = false;
          if (!voiceReplyCompleted) endVoiceSession();
          else if (voiceResumePendingRef.current && voiceSessionActiveRef.current) {
            voiceResumePendingRef.current = false;
            startVoiceCapture();
          }
        }
      }
    }
  }

  useEffect(() => {
    if (!autoSubmitGoal || autoSubmittedGoalRequestRef.current === autoSubmitGoal.requestId) return;
    if (busy || associationsBusy || projectBusy || accountLoadState === "loading") return;
    const content = autoSubmitGoal.prompt.trim();
    if (!content) {
      autoSubmittedGoalRequestRef.current = autoSubmitGoal.requestId;
      onAutoSubmitGoalConsumed(autoSubmitGoal.requestId);
      return;
    }
    setDraft(content);
    onDraftChange(content);
    autoSubmittedGoalRequestRef.current = autoSubmitGoal.requestId;
    onAutoSubmitGoalConsumed(autoSubmitGoal.requestId);
    if (!activeAccount) {
      setError("请先在设置中心的“AI 与模型”添加并启用一个 Provider 账户；操作目标已保留在输入框中。");
      return;
    }
    void sendMessage(content);
  }, [accountLoadState, activeAccount, associationsBusy, autoSubmitGoal, busy, onAutoSubmitGoalConsumed, onDraftChange, projectBusy]);

  async function toggleAiRunPause(): Promise<void> {
    const runId = activeRunRef.current;
    if (!runId || runPauseBusy || !canControlAiRun(runId, stopGuardStartedAtRef.current, Date.now())) return;
    const currentState = runPauseState?.runId === runId ? runPauseState.state : "running";
    const eventRevision = runPauseEventRevisionRef.current;
    setRunPauseBusy(true);
    try {
      const result = currentState === "running" ? await pauseAiRun(runId) : await resumeAiRun(runId);
      if (eventRevision === runPauseEventRevisionRef.current) setRunPauseState({ runId, state: result.pauseState });
    } catch (pauseError) {
      if (!(pauseError instanceof ApiError && pauseError.status === 409)) setError(`任务${currentState === "running" ? "暂停" : "继续"}失败：${getErrorMessage(pauseError)}`);
    } finally {
      setRunPauseBusy(false);
    }
  }

  function startVoiceCapture(): void {
    if (!voiceMode || !voiceSessionActiveRef.current || stopListening.current) return;
    if (!currentSettingsRef.current.aiRuntime.voiceInputEnabled || !supportsVoiceInput()) {
      setError(!currentSettingsRef.current.aiRuntime.voiceInputEnabled ? "请先开启设置中心中的语音输入。" : "当前宿主不支持安全语音识别。");
      endVoiceSession();
      return;
    }
    voiceTurnDispatchRef.current = false;
    setError("");
    setListening(true);
    try {
      stopListening.current = startVoiceInput(currentSettingsRef.current.general.language, text => {
        const content = text.trim().slice(0, 12000);
        if (!content || !voiceSessionActiveRef.current || voiceTurnDispatchRef.current) return;
        voiceTurnDispatchRef.current = true;
        setListening(false);
        setDraft(content);
        onDraftChange(content);
        void sendMessage(content);
      }, message => {
        setError(message);
        endVoiceSession();
      }, () => {
        stopListening.current = null;
        setListening(false);
      }, {
        interimResults: true,
        completeOnEnd: true,
        onActivity: activity => {
          if (!voiceSessionActiveRef.current) return;
          const intensity = Math.max(0.35, Math.min(1, activity));
          voiceSpeechActivityRef.current = intensity;
          setVoiceSpeechActivity(intensity);
          if (voiceSpeechActivityTimerRef.current) clearTimeout(voiceSpeechActivityTimerRef.current);
          voiceSpeechActivityTimerRef.current = setTimeout(() => {
            voiceSpeechActivityRef.current = 0;
            voiceSpeechActivityTimerRef.current = null;
            setVoiceSpeechActivity(0);
          }, 520);
        },
      });
    } catch (error) {
      setListening(false);
      setError(getErrorMessage(error));
      endVoiceSession();
    }
  }

  function endVoiceSession(): void {
    voiceSessionActiveRef.current = false;
    voiceResumePendingRef.current = false;
    voiceTurnDispatchRef.current = false;
    stopListening.current?.();
    stopListening.current = null;
    setListening(false);
    setVoiceSpeaking(false);
    setVoiceSessionActive(false);
    if (voiceSpeechActivityTimerRef.current) clearTimeout(voiceSpeechActivityTimerRef.current);
    voiceSpeechActivityTimerRef.current = null;
    voiceSpeechActivityRef.current = 0;
    setVoiceSpeechActivity(0);
    stopVoicePlayback();
  }

  function queueVoiceResume(): void {
    if (!voiceMode || !voiceSessionActiveRef.current || !currentSettingsRef.current.aiRuntime.voiceInputEnabled) return;
    voiceResumePendingRef.current = true;
    if (voiceReplyInProgressRef.current) return;
    voiceResumePendingRef.current = false;
    startVoiceCapture();
  }

  function finishVoicePlayback(): void {
    setVoiceSpeaking(false);
    queueVoiceResume();
  }

  function toggleVoiceConversation(): void {
    if (!voiceSessionActiveRef.current) {
      if (busy) return;
      if (!settings.aiRuntime.voiceInputEnabled || !supportsVoiceInput()) {
        setError(!settings.aiRuntime.voiceInputEnabled ? "请先开启设置中心中的语音输入。" : "当前宿主不支持安全语音识别。");
        return;
      }
      voiceSessionActiveRef.current = true;
      setVoiceSessionActive(true);
      startVoiceCapture();
      return;
    }
    if (!busy && !voiceSpeaking && !listening) {
      startVoiceCapture();
      return;
    }
    endVoiceSession();
  }

  function toggleVoiceInput(): void {
    if (listening) { stopListening.current?.(); stopListening.current = null; setListening(false); return; }
    try {
      stopVoicePlayback(); setListening(true);
      stopListening.current = startVoiceInput(settings.general.language, text => {
        const next = voiceMode ? text.slice(0, 12000) : `${draftRef.current}${draftRef.current ? "\n" : ""}${text}`.slice(0, 12000);
        setDraft(next);
        onDraftChange(next);
      }, setError, () => { setListening(false); stopListening.current = null; });
    } catch (error) { setListening(false); setError(getErrorMessage(error)); }
  }

  function notifySessionAction(key: string, kind: "approval" | "question" | "issue", title: string, body: string): void {
    const sessionId = sessionIdForTurn.current;
    if (!sessionId || notifiedTurnEvents.current.has(key)) return;
    notifiedTurnEvents.current.add(key);
    notifyAiWorkAction({
      notification: { appId, applicationName: applicationNameFor(appId), sessionId, kind, title, body },
      enabled: settings.general.notificationPopupsEnabled,
      sound: settings.general.notificationSound,
      onNotification
    });
  }

  function notifySessionIssue(body: string): void {
    if (!settings.general.sessionIssueNotifications) return;
    notifySessionAction("issue:turn", "issue", "会话遇到问题", body);
  }

  async function resolvePendingApproval(decision: "approved" | "denied"): Promise<void> {
    const approvalId = pendingInteraction?.kind === "approval" ? pendingInteraction.activity.approvalId : undefined;
    if (!approvalId || interactionBusy) return;
    setInteractionBusy(true);
    setError("");
    try {
      await decideAiApproval(approvalId, decision);
    } catch (approvalError) {
      setError(`审批处理失败：${getErrorMessage(approvalError)}`);
    } finally {
      setInteractionBusy(false);
    }
  }

  async function submitPendingQuestion(answer: string, skipped = false): Promise<void> {
    const question = pendingInteraction?.kind === "question" ? pendingInteraction : null;
    if (!question || interactionBusy || (!skipped && !answer.trim())) return;
    setInteractionBusy(true);
    setError("");
    try {
      await answerAiRunQuestion(question.runId, question.activity.questionId!, answer, skipped);
      const detail = skipped ? "你选择跳过了这条澄清问题。" : `你的回答：${answer.trim()}`;
      const completedAt = new Date().toISOString();
      setMessages(current => current.map(item => item.id !== question.runId ? item : {
        ...item,
        activity: item.activity.map(activity => activity.questionId !== question.activity.questionId ? activity : {
          ...activity,
          status: "complete",
          detail,
          completedAt,
          durationMs: Math.max(0, Date.now() - Date.parse(activity.startedAt))
        })
      }));
      setQuestionReply("");
    } catch (answerError) {
      setError(`回答未能提交：${getErrorMessage(answerError)}`);
    } finally {
      setInteractionBusy(false);
    }
  }

  function updateComposerDraft(value: string, caret: number): void {
    setDraft(value);
    onDraftChange(value);
    const beforeCaret = value.slice(0, caret);
    const slashMatch = /^\s*\/([^\s/]*)$/u.exec(beforeCaret);
    const mentionMatch = /(?:^|\s)@([^\s@]*)$/u.exec(beforeCaret);
    const match = slashMatch ?? mentionMatch;
    if (!match) {
      setComposerMenu(null);
      return;
    }
    const trigger = slashMatch ? "/" : "@";
    setComposerMenu({ trigger, start: caret - match[1].length - 1, end: caret, query: match[1] });
    setComposerMenuActiveIndex(0);
  }

  function applyComposerMenuItem(item: ComposerTriggerMenuItem): void {
    const menu = composerMenu;
    if (!menu || item.disabled) return;
    setComposerMenu(null);
    if (item.action === "open-model-picker") {
      const nextDraft = `${draft.slice(0, menu.start)}${draft.slice(menu.end)}`;
      setDraft(nextDraft);
      onDraftChange(nextDraft);
      pendingComposerCaretRef.current = menu.start;
      setComposerSelectionRevision(revision => revision + 1);
      openModelPicker();
      return;
    }

    if (item.association?.kind === "application" && !associations.applicationIds.includes(item.association.id)) {
      void changeAssociations({ ...associations, applicationIds: [...associations.applicationIds, item.association.id] });
    } else if (item.association?.kind === "capability" && !associations.capabilityIds.includes(item.association.id)) {
      void changeAssociations({ ...associations, capabilityIds: [...associations.capabilityIds, item.association.id] });
    }

    const insertion = item.insertText ?? `@${item.label} `;
    const nextDraft = `${draft.slice(0, menu.start)}${insertion}${draft.slice(menu.end)}`;
    setDraft(nextDraft);
    onDraftChange(nextDraft);
    pendingComposerCaretRef.current = menu.start + insertion.length;
    setComposerSelectionRevision(revision => revision + 1);
  }

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape" && composerMenu) {
      event.preventDefault();
      setComposerMenu(null);
      return;
    }
    if (composerMenu && composerMenuItems.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      for (let offset = 1; offset <= composerMenuItems.length; offset += 1) {
        const index = (composerMenuActiveIndex + direction * offset + composerMenuItems.length) % composerMenuItems.length;
        if (!composerMenuItems[index].disabled) {
          setComposerMenuActiveIndex(index);
          break;
        }
      }
      return;
    }
    if (composerMenu && (event.key === "Enter" || event.key === "Tab") && composerMenuItems.length) {
      event.preventDefault();
      const item = composerMenuItems[composerMenuActiveIndex];
      if (item && !item.disabled) applyComposerMenuItem(item);
      return;
    }
    const shouldSend = settings.general.sendShortcut === "enter"
      ? event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey
      : event.key === "Enter" && (event.ctrlKey || event.metaKey);
    if (!shouldSend) return;
    event.preventDefault();
    void sendMessage();
  };

  async function saveToolbarSetting<K extends "permissions" | "aiRuntime">(category: K, value: UserSettings[K]): Promise<void> {
    setToolbarBusy(category);
    setError("");
    try {
      const result = await saveSettings(category, value);
      onSettingsChange(result.settings);
    } catch (saveError) {
      setError(`设置保存失败：${getErrorMessage(saveError)}`);
    } finally {
      setToolbarBusy(null);
    }
  }

  function selectPermissionMode(mode: UserSettings["permissions"]["mode"]): void {
    if (mode === settings.permissions.mode || toolbarBusy) return;
    const saveMode = () => saveToolbarSetting("permissions", { mode });
    if (mode === "full_access") {
      permissionModal.confirm({
        rootClassName: "lfaa-permission-mode-confirm",
        getContainer: () => document.querySelector<HTMLElement>(".workbench-shell") ?? document.body,
        icon: <WorkbenchIcon name="shield" size={17} />,
        title: "开启项目完全权限？",
        content: "模型将按你的指令自主执行项目操作，可在在线 Daemon 上执行任意终端命令并访问其 OS 账户有权访问的路径；文件、部署和配置操作也不再逐项审批。",
        okText: "开启完全权限",
        cancelText: "取消",
        centered: true,
        width: 400,
        onOk: saveMode
      });
      return;
    }
    void saveMode();
  }

  async function selectModel(accountId: string, modelId: string): Promise<void> {
    const targetAccount = accounts.find((account) => account.id === accountId);
    if (!targetAccount || modelBusy || busy) return;
    if (activeAccount?.id === accountId && targetAccount.modelId === modelId) {
      setModelPickerOpen(false);
      return;
    }
    setModelBusy(true);
    setError("");
    try {
      const result = await selectAiAccountModel(targetAccount.id, modelId);
      const nextAccounts = accounts.map((account) => {
        if (account.id === result.account.id) return result.account;
        if (result.account.scope === "system" && account.scope === "user") return { ...account, active: false };
        return account.scope === result.account.scope ? { ...account, active: false } : account;
      });
      aiAccountSnapshots.set(userId, nextAccounts);
      setAccounts(nextAccounts);
      onProviderStatusChange(`${result.account.displayName} · ${result.account.modelId}`);
      setModelPickerOpen(false);
      setModelPickerView("reasoning");
      setModelSearch("");
      setModelResultLimit(MODEL_PICKER_RESULT_LIMIT);
      setReasoningDraftIndex(null);
    } catch (modelError) {
      setError(`模型切换失败：${getErrorMessage(modelError)}`);
    } finally {
      setModelBusy(false);
    }
  }

  async function selectReasoningMode(reasoningMode: string): Promise<void> {
    if (!activeAccount || modelBusy || busy) return;
    if (activeAccount.reasoningMode === reasoningMode) {
      setReasoningDraftIndex(null);
      return;
    }
    setModelBusy(true);
    setError("");
    try {
      const result = await updateAiAccountReasoningMode(activeAccount.id, reasoningMode);
      const nextAccounts = accounts.map((account) => account.id === result.account.id ? result.account : account);
      aiAccountSnapshots.set(userId, nextAccounts);
      setAccounts(nextAccounts);
    } catch (reasoningError) {
      setError(`思考力度保存失败：${getErrorMessage(reasoningError)}`);
    } finally {
      setReasoningDraftIndex(null);
      setModelBusy(false);
    }
  }

  async function copyMessage(item: AiMessage): Promise<void> {
    if (!item.content) return;
    setMessageActionError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("当前宿主没有可用的剪贴板接口。");
      await navigator.clipboard.writeText(item.role === "assistant" ? buildResponseTimeline(item).finalText || item.content : item.content);
      setCopiedMessageId(item.id);
    } catch (copyError) {
      setMessageActionError(`复制失败：${getErrorMessage(copyError)}。请检查剪贴板权限后重试。`);
    }
  }

  /** 停止运行必须等待服务端终态；仅关闭原 SSE 订阅不会停止 Agent。 */
  async function stopAiRunAndWait(runId: string, sessionId: string): Promise<void> {
    try { await cancelAiRun(runId); }
    catch (cancelError) {
      // 当前运行可能刚好结束；此时继续跟随会话可拿到已提交的终态快照。
      if (!(cancelError instanceof ApiError) || cancelError.status !== 404) throw cancelError;
    }
    const snapshot: { user: AiMessage | null; assistant: AiMessage | null; content: string; status: AiMessage["status"]; done: boolean } = {
      user: null, assistant: null, content: "", status: "interrupted", done: false
    };
    await streamAiChat({
      runId,
      appId,
      sessionId,
      content: "",
      signal: new AbortController().signal,
      onSession: ({ userMessage, assistantMessage }) => {
        snapshot.user = userMessage;
        snapshot.assistant = assistantMessage;
        snapshot.content = assistantMessage.content;
      },
      onActivity: () => undefined,
      onDelta: ({ messageId, delta }) => { if (messageId === runId) snapshot.content += delta; },
      onUsage: () => undefined,
      onError: message => setMessageActionError(`停止当前回复时收到错误：${message}`),
      onDone: status => { snapshot.status = status; snapshot.done = true; }
    });
    if (!snapshot.done) throw new Error("没有收到服务端的任务结束确认，暂不创建编辑分支。");
    if (snapshot.assistant) {
      const finishedAssistant: AiMessage = { ...snapshot.assistant, content: snapshot.content, status: snapshot.status };
      setMessages(current => current.map(message => message.id === runId ? finishedAssistant : message.id === snapshot.user?.id && snapshot.user ? snapshot.user : message));
    }
  }

  async function editUserMessage(item: AiMessage, pairedAssistant: AiMessage): Promise<void> {
    if (!activeSessionId || editingMessage || branchBusy || feedbackBusy || projectBusy || hasQueuedRuns) return;
    setMessageActionError("");
    setEditingMessage({ messageId: item.id, content: item.content, phase: pairedAssistant.status === "streaming" ? "stopping" : "ready" });
    if (pairedAssistant.status !== "streaming") return;
    try {
      await stopAiRunAndWait(pairedAssistant.id, activeSessionId);
      setEditingMessage(current => current?.messageId === item.id ? { ...current, phase: "ready" } : current);
    } catch (stopError) {
      setMessageActionError(`停止当前回复失败：${getErrorMessage(stopError)}。问题仍保留在编辑框中；请重试后再发送。`);
      setEditingMessage(current => current?.messageId === item.id ? { ...current, phase: "ready" } : current);
    }
  }

  async function submitEditedMessage(): Promise<void> {
    if (!activeSessionId || !editingMessage || editingMessage.phase === "stopping" || editingMessage.phase === "sending" || branchBusy || projectBusy) return;
    const content = editingMessage.content.trim();
    if (!content || content.length > 12_000) return;
    const sourceIndex = messages.findIndex(message => message.id === editingMessage.messageId);
    const source = messages[sourceIndex];
    const pairedAssistant = messages[sourceIndex + 1];
    if (!source || source.role !== "user" || !pairedAssistant || pairedAssistant.role !== "assistant") {
      setMessageActionError("这条问题已无法定位到对应回复，请刷新会话后重试。");
      return;
    }
    if (busy && activeRunRef.current !== pairedAssistant.id) {
      setMessageActionError("当前会话的其他任务仍在运行，请等它结束后再编辑问题。");
      return;
    }
    if (hasQueuedRuns) {
      setMessageActionError("会话中还有排队任务，请等它结束后再编辑问题。");
      return;
    }

    const sourceSessionId = activeSessionId;
    setEditingMessage(current => current?.messageId === source.id ? { ...current, phase: "sending" } : current);
    setMessageActionError("");
    try {
      if (pairedAssistant.status === "streaming") await stopAiRunAndWait(pairedAssistant.id, sourceSessionId);
      const { session } = await forkAiSessionBeforeUserMessage(sourceSessionId, source.id);
      const { messages: baseMessages } = await loadAiMessages(session.id);
      onSessionsChange([session, ...sessions.filter(existing => existing.id !== session.id)]);
      await sendMessage(content, undefined, {
        session,
        baseMessages,
        onStarted: () => setEditingMessage(current => current?.messageId === source.id ? null : current)
      });
    } catch (editError) {
      setMessageActionError(`编辑并发送失败：${getErrorMessage(editError)}`);
    } finally {
      setEditingMessage(current => current?.messageId === source.id && current.phase === "sending" ? { ...current, phase: "ready" } : current);
    }
  }

  function cancelMessageEditing(): void {
    if (editingMessage?.phase === "sending") return;
    setEditingMessage(null);
    setMessageActionError("");
  }

  function openMessageFeedback(messageId: string, rating: AiMessageFeedbackRating): void {
    setMessageActionError("");
    setFeedbackReasons([]);
    setFeedbackDetail("");
    setFeedbackTarget({ messageId, rating });
  }

  function toggleFeedbackReason(reason: string): void {
    setFeedbackReasons(current => current.includes(reason)
      ? current.filter(item => item !== reason)
      : current.length < 6 ? [...current, reason] : current);
  }

  async function submitMessageFeedback(): Promise<void> {
    if (!activeSessionId || !feedbackTarget || feedbackBusy) return;
    setFeedbackBusy(true);
    setMessageActionError("");
    try {
      const input: AiMessageFeedbackInput = { rating: feedbackTarget.rating, reasons: feedbackReasons, detail: feedbackDetail.trim() };
      const { feedback } = await submitAiMessageFeedback(activeSessionId, feedbackTarget.messageId, input);
      setMessages(current => current.map(item => item.id === feedbackTarget.messageId ? { ...item, feedback } : item));
      setFeedbackTarget(null);
      setFeedbackReasons([]);
      setFeedbackDetail("");
    } catch (feedbackError) {
      setMessageActionError(`反馈提交失败：${getErrorMessage(feedbackError)}`);
    } finally {
      setFeedbackBusy(false);
    }
  }

  async function createMessageBranch(target: "workspace" | "worktree"): Promise<void> {
    if (!activeSessionId || !branchTargetMessageId || branchBusy) return;
    setBranchBusy(true);
    setMessageActionError("");
    let createdWorktree: WorkspaceProject | null = null;
    try {
      let session: AiSession;
      if (target === "worktree") {
        if (!canCreateWorktreeBranch || !branchSourceProject || (appId !== "workspace" && appId !== "minecraft")) {
          throw new Error("当前会话项目或 Daemon 不满足创建 AI Worktree 的条件。");
        }
        const result = await createWorkspaceGitWorktree(branchSourceProject.id, appId as WorkspaceProjectApplicationId);
        createdWorktree = result.project;
        const nextProjects = [result.project, ...workspaceProjects.filter(project => project.id !== result.project.id)];
        onWorkspaceProjectsChange(nextProjects);
        ({ session } = await createAiSessionBranchFromMessageInWorktree(activeSessionId, branchTargetMessageId, result.project.id, appId as WorkspaceProjectApplicationId));
      } else {
        ({ session } = await createAiSessionBranchFromMessage(activeSessionId, branchTargetMessageId));
      }
      onSessionsChange([session, ...sessions.filter(item => item.id !== session.id)]);
      onSelectedProjectChange(session.projectId ?? null);
      setSelectedProjectId(session.projectId ?? null);
      onDraftChange("");
      setDraft("");
      setBranchTargetMessageId(null);
      onActiveSessionChange(session.id);
    } catch (branchError) {
      if (createdWorktree) {
        setBranchTargetMessageId(null);
        setMessageActionError(`AI Worktree 已创建并加入项目列表，但聊天分支未创建：${getErrorMessage(branchError)}。工作树已保留，可从项目列表继续使用。`);
      } else {
        setMessageActionError(`创建聊天分支失败：${getErrorMessage(branchError)}`);
      }
    } finally {
      setBranchBusy(false);
    }
  }

  const jumpToConversationAnchor = useCallback((messageId: string): void => {
    const container = messagesElementRef.current;
    if (!container) return;
    const anchorElement = Array.from(container.querySelectorAll<HTMLElement>("[data-ai-anchor-id]")).find((element) => element.dataset.aiAnchorId === messageId);
    if (!anchorElement) return;

    followLatestMessageRef.current = false;
    if (responseProcessDetailsRef.current.size > 0) responseProcessUserScrolledRef.current = true;
    const targetTop = anchorElement.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16;
    const reducedMotion = settings.appearance.advanced.reducedMotion === "on"
      || settings.appearance.advanced.reducedMotion === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) container.scrollTop = Math.max(0, targetTop);
    else container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    setActiveAnchorId(messageId);
  }, [settings.appearance.advanced.reducedMotion]);
  const openAiContextSettings = useCallback(() => onOpenSettings("ai", "ai-context-usage-setting"), [onOpenSettings]);

  const conversationAnchors = useMemo(() => buildConversationAnchors(messages), [messages]);
  const hasQueuedRuns = useMemo(() => messages.some(message => message.role === "assistant" && message.status === "queued"), [messages]);
  const messageRowActionsRef = useRef<AiWorkMessageActions>(emptyAiWorkMessageActions);
  const promptSuggestionSubmissionGateRef = useRef<ReplySuggestionSubmissionGate | null>(null);
  promptSuggestionSubmissionGateRef.current ??= new ReplySuggestionSubmissionGate();
  // Keep memoized rows' handlers stable while forwarding each action to its latest state-aware implementation.
  useLayoutEffect(() => {
    messageRowActionsRef.current = {
      copyMessage, editUserMessage, submitEditedMessage, cancelMessageEditing, openMessageFeedback, toggleActivityStep, openWritingProposal,
      submitPromptSuggestion: (messageId, suggestion) => promptSuggestionSubmissionGateRef.current?.submit({
        suggestion,
        canSubmit: () => Boolean(activeAccount) && !busy && !projectDirectoryMissing && !projectBusy && !associationsBusy && !editingMessage && !branchBusy && !hasQueuedRuns,
        consume: () => setMessages(current => consumeReplySuggestion(current, messageId, suggestion)),
        send: value => sendMessage(value)
      })
    };
  }, [copyMessage, editUserMessage, submitEditedMessage, cancelMessageEditing, openMessageFeedback, toggleActivityStep, openWritingProposal, activeAccount, busy, projectDirectoryMissing, projectBusy, associationsBusy, editingMessage, branchBusy, hasQueuedRuns]);
  const messageRowActions = useMemo<AiWorkMessageActions>(() => ({
    copyMessage: message => messageRowActionsRef.current.copyMessage(message),
    editUserMessage: (message, pairedAssistant) => messageRowActionsRef.current.editUserMessage(message, pairedAssistant),
    submitEditedMessage: () => messageRowActionsRef.current.submitEditedMessage(),
    cancelMessageEditing: () => messageRowActionsRef.current.cancelMessageEditing(),
    openMessageFeedback: (messageId, rating) => messageRowActionsRef.current.openMessageFeedback(messageId, rating),
    toggleActivityStep: (messageId, activityId) => messageRowActionsRef.current.toggleActivityStep(messageId, activityId),
    openWritingProposal: proposalId => messageRowActionsRef.current.openWritingProposal(proposalId),
    submitPromptSuggestion: (messageId, suggestion) => messageRowActionsRef.current.submitPromptSuggestion(messageId, suggestion)
  }), []);
  const conversationAnchorLayout = useMemo(
    () => buildConversationAnchorLayout(conversationAnchors.length, anchorViewportHeight),
    [conversationAnchors.length, anchorViewportHeight]
  );
  const selectedReasoningIndex = reasoningDraftIndex ?? activeReasoningIndex;
  const visibleReasoningLabel = reasoningDraftIndex === null
    ? activeReasoningIndex >= 0
      ? activeReasoningLevels[activeReasoningIndex]?.label ?? activeReasoningLabel
      : providerDefaultReasoningMode
        ? reasoningModeLabel(providerDefaultReasoningMode)
        : "默认"
    : activeReasoningLevels[reasoningDraftIndex]?.label ?? activeReasoningLabel;
  const officialDefaultIndex = activeReasoningLevels.findIndex((option) => option.value === providerDefaultReasoningMode);
  const hasResolvedReasoningIndex = selectedReasoningIndex >= 0 || officialDefaultIndex >= 0;
  const displayedReasoningIndex = selectedReasoningIndex >= 0
    ? selectedReasoningIndex
    : officialDefaultIndex >= 0 ? officialDefaultIndex : 0;
  const reasoningProgress = activeReasoningLevels.length > 1
    ? displayedReasoningIndex / (activeReasoningLevels.length - 1) * 100
    : 0;
  const hasEffortSlider = activeModel?.thinking?.kind === "effort" && activeReasoningLevels.length > 1;
  const composerReasoningLabel = activeModel?.thinkingSource === "provider-model-catalog"
    ? activeModel.thinking?.kind === "fixed"
      ? reasoningModeLabel(activeModel.thinking.value)
      : activeReasoningMode === "default"
        ? providerDefaultReasoningMode ? reasoningModeLabel(providerDefaultReasoningMode) : activeReasoningLevels.length ? "默认" : ""
        : activeReasoningLevels.some((option) => option.value === activeReasoningMode) ? reasoningModeLabel(activeReasoningMode) : ""
    : "";
  const composerModelLabel = activeAccount
    ? activeModel
      ? [activeModel.name, composerReasoningLabel].filter(Boolean).join(" ")
      : activeAccount.modelId
    : modelPickerCatalog.length ? "选择模型" : accountLoadState === "loading" ? "读取中…" : accountLoadState === "error" ? "不可用" : "模型未配置";
  const modelPickerShortcutLabel = settings.shortcuts.openModelPicker.filter(Boolean).join(" / ");
  const modelPickerTooltipTitle = activeAccount || modelPickerCatalog.length
    ? <span className="ai-work-chat__model-picker-tooltip"><span>选择推理强度</span>{modelPickerShortcutLabel ? <kbd>{modelPickerShortcutLabel}</kbd> : null}</span>
    : accountLoadState === "loading" ? "模型正在读取当前配置" : accountLoadState === "error" ? "模型状态不可用，请查看错误提示" : "请先在设置中心配置活动模型";
  const modelPickerContent = (
    <ModelSelectionPopover
      view={modelPickerView}
      accountLoadState={accountLoadState}
      modelBusy={modelBusy}
      busy={busy}
      activeAccount={activeAccount}
      activeModel={activeModel}
      visibleReasoningLabel={visibleReasoningLabel}
      activeReasoningLevels={activeReasoningLevels}
      activeReasoningMode={activeReasoningMode}
      hasEffortSlider={hasEffortSlider}
      hasResolvedReasoningIndex={hasResolvedReasoningIndex}
      displayedReasoningIndex={displayedReasoningIndex}
      reasoningProgress={reasoningProgress}
      modelPickerCatalog={modelPickerCatalog}
      modelPickerAccountCount={modelPickerAccountCount}
      modelPickerPageSize={MODEL_PICKER_RESULT_LIMIT}
      modelSearch={modelSearch}
      matchingModels={matchingModels}
      visibleModels={visibleModels}
      onClose={() => setModelPickerOpen(false)}
      onViewChange={(view) => {
        if (view === "models") {
          setModelSearch("");
          setModelResultLimit(MODEL_PICKER_RESULT_LIMIT);
        }
        setModelPickerView(view);
      }}
      onModelSearchChange={(value) => {
        setModelSearch(value);
        setModelResultLimit(MODEL_PICKER_RESULT_LIMIT);
      }}
      onReasoningDraftIndexChange={setReasoningDraftIndex}
      onSelectReasoning={(value) => void selectReasoningMode(value)}
      onSelectModel={(accountId, modelId) => void selectModel(accountId, modelId)}
      onLoadMore={() => setModelResultLimit((limit) => Math.min(limit + MODEL_PICKER_RESULT_LIMIT, matchingModels.length))}
      onManageModels={() => {
        setModelPickerOpen(false);
        onOpenSettings("ai", activeAccount ? `settings-ai-account-${activeAccount.id}` : undefined);
      }}
    />
  );

  const associationPickerListHeight = Math.min(232, Math.max(96, window.innerHeight - 174));
  const composerMoreContent = (
    <div className="ai-work-chat__more-menu" aria-label="更多输入操作">
      {composerMoreSection === null ? <>
        <button className="ai-work-chat__more-menu-item" type="button" onClick={() => setComposerMoreSection("applications")}>
          <WorkbenchIcon name="folder" size={17} />
          <span>关联应用</span>
          <small>{associations.applicationIds.length ? `已选 ${associations.applicationIds.length}` : "可选"}</small>
          <WorkbenchIcon className="ai-work-chat__more-menu-chevron" name="chevron" size={13} />
        </button>
        <button className="ai-work-chat__more-menu-item" type="button" onClick={() => setComposerMoreSection("capabilities")}>
          <WorkbenchIcon name="extension" size={17} />
          <span>Skill / 提示词 / 专家</span>
          <small>{associations.capabilityIds.length ? `已选 ${associations.capabilityIds.length}` : "可选"}</small>
          <WorkbenchIcon className="ai-work-chat__more-menu-chevron" name="chevron" size={13} />
        </button>
      </> : <div className="ai-work-chat__more-menu-picker">
        <button className="ai-work-chat__more-menu-back" type="button" onClick={() => setComposerMoreSection(null)}>
          <WorkbenchIcon name="chevron" size={14} />更多
        </button>
        <strong>{composerMoreSection === "applications" ? "关联应用" : "Skill / 提示词 / 专家"}</strong>
        {composerMoreSection === "applications"
          ? <Select mode="multiple" optionFilterProp="label" allowClear maxCount={APPLICATION_IDS.length} aria-label="关联应用（可选）" aria-description="关联只提供参考，小鱼按目标决定是否加载。" title="关联只提供参考，小鱼按目标决定是否加载。" placeholder="搜索并选择应用" disabled={busy || associationsBusy} value={associations.applicationIds} options={APPLICATION_IDS.filter(id => id !== "workspace").map(id => ({ value: id, label: applicationAssociationLabels[id] }))} getPopupContainer={(trigger: HTMLElement) => (trigger.closest(".workbench-shell") as HTMLElement | null) ?? trigger.parentElement ?? document.body} listHeight={associationPickerListHeight} onChange={applicationIds => void changeAssociations({ ...associations, applicationIds })} />
          : <Select mode="multiple" optionFilterProp="label" allowClear maxCount={16} aria-label="关联能力（可选）" aria-description="关联只提供参考，小鱼按目标决定是否加载。" title="关联只提供参考，小鱼按目标决定是否加载。" placeholder="搜索并选择能力" disabled={busy || associationsBusy || capabilities.length === 0} value={associations.capabilityIds} options={capabilities.map(item => ({ value: item.id, label: item.name }))} getPopupContainer={(trigger: HTMLElement) => (trigger.closest(".workbench-shell") as HTMLElement | null) ?? trigger.parentElement ?? document.body} listHeight={associationPickerListHeight} onChange={capabilityIds => void changeAssociations({ ...associations, capabilityIds })} />}
        <small>关联只提供参考，小鱼按目标决定是否加载。</small>
        {composerMoreSection === "capabilities" && capabilitiesError ? <Typography.Text type="danger">Skill 目录读取失败：{capabilitiesError}</Typography.Text> : null}
      </div>}
    </div>
  );

  function renderPendingComposerInteraction() {
    if (!pendingInteraction) return null;
    const { activity } = pendingInteraction;
    if (pendingInteraction.kind === "approval") {
      const approvalQuestion = activity.approvalQuestion ?? activity.title;
      const additionalDetail = activity.detail.startsWith(approvalQuestion) ? activity.detail.slice(approvalQuestion.length).trim() : "";
      const detail = splitAiActivityDetail(additionalDetail);
      return <ApprovalRequestCard
        question={approvalQuestion}
        summary={detail.summary}
        previewLabel={detail.previewLabel}
        preview={detail.preview}
        busy={interactionBusy}
        onApprove={() => void resolvePendingApproval("approved")}
        onDeny={() => void resolvePendingApproval("denied")}
      />;
    }

    return <UserQuestionPrompt
      question={activity.question ?? activity.detail}
      questionId={activity.questionId}
      options={activity.options ?? []}
      value={questionReply}
      busy={interactionBusy}
      onChange={setQuestionReply}
      onSubmit={(answer, skipped) => void submitPendingQuestion(answer, skipped)}
    />;
  }

  const lastMessage = messages.at(-1);
  const previousMessage = messages.at(-2);
  let latestAssistantMessage = lastMessage?.role === "assistant" ? lastMessage : previousMessage?.role === "assistant" ? previousMessage : undefined;
  if (!latestAssistantMessage) {
    for (let index = messages.length - 3; index >= 0; index -= 1) {
      if (messages[index]?.role === "assistant") { latestAssistantMessage = messages[index]; break; }
    }
  }
  if (voiceMode) {
    return <AiWorkVoiceSurface
      busy={busy}
      voiceSpeaking={voiceSpeaking}
      listening={listening}
      voiceSessionActive={voiceSessionActive}
      voiceSpeechActivity={voiceSpeechActivity}
      draft={draft}
      settings={settings}
      error={error}
      activeAccount={activeAccount}
      onExitVoice={onExitVoice}
      onEndVoiceSession={endVoiceSession}
      onOpenSettings={onOpenSettings}
      onClearError={() => setError("")}
      onToggleVoiceConversation={toggleVoiceConversation}
      onDraftChange={(value) => { setDraft(value); onDraftChange(value); }}
      onSendMessage={(value) => { void sendMessage(value); }}
      onSettingsChange={onSettingsChange}
    />;
  }
  return (
    <section ref={setOutputFocusRegionElement} className={`ai-work-chat ai-work-chat--${appId}${composerMenu ? " ai-work-chat--composer-menu-open" : ""}`} data-output-idle="false" aria-label="小鱼智能体会话">
      {workspaceHeader}
      {permissionModalContext}
      <div className="ai-work-chat__conversation">
        <div className="ai-work-chat__alerts">
          {accountLoadState === "ready" && !activeAccount ? <Alert
            className="ai-work-chat__provider-setup-alert"
            type="warning"
            showIcon
            message="尚未配置大模型"
            description={<Button className="ai-work-chat__provider-setup-action" size="small" onClick={() => onOpenSettings("ai")}>去配置模型</Button>}
          /> : null}
          {error ? <Alert type="error" showIcon closable message={error} onClose={() => setError("")} /> : null}
          {messageActionError ? <Alert type="error" showIcon closable message={messageActionError} onClose={() => setMessageActionError("")} /> : null}
          {!busy && messages.some(item => item.role === "assistant" && (item.status === "streaming" || item.status === "queued")) ? <Button onClick={() => { const run = messages.find(item => item.role === "assistant" && (item.status === "streaming" || item.status === "queued")); if (run) void sendMessage("", run.id); }}>恢复任务跟随</Button> : null}
        </div>
        <div className="ai-work-chat__message-stage">
          <div className="ai-work-chat__navigation-track">
            {conversationAnchors.length ? <ConversationAnchorRail
              anchors={conversationAnchors}
              layout={conversationAnchorLayout}
              activeAnchorId={activeAnchorId}
              onJump={jumpToConversationAnchor}
            /> : null}
          </div>
          <div className="ai-work-chat__stream-track">
            <div ref={setMessagesElement} onScroll={handleMessagesScroll} onWheel={handleMessagesWheel} onClickCapture={handleResponseProcessClickCapture} onPointerDown={handleMessagesPointerDown} onPointerUp={handleMessagesPointerUp} onPointerCancel={handleMessagesPointerUp} className="ai-work-chat__messages" aria-live="polite">
              <div className="ai-work-chat__message-list">
              {hasOlderMessages ? <div className="ai-work-chat__older-messages"><Button loading={loadingOlderMessages} onClick={() => void loadEarlierMessages()}>加载更早消息</Button></div> : null}
              {loading ? <Spin /> : messages.length ? messages.map((item, messageIndex) => {
                const pairedAssistant = item.role === "user" ? messages[messageIndex + 1] : undefined;
                return <AiWorkMessageRow
                  key={item.id}
                  message={item}
                  pairedAssistant={pairedAssistant}
                  usage={usageByMessage[item.id] ?? item.usage}
                  editingMessage={editingMessage?.messageId === item.id ? editingMessage : null}
                  anyMessageEditing={editingMessage !== null}
                  pauseState={runPauseState?.runId === item.id && (runPauseState.state === "paused" || runPauseState.state === "pausing") ? runPauseState.state : null}
                  copied={copiedMessageId === item.id}
                  conversationBusy={busy}
                  activeRunId={activeRunRef.current}
                  liveMessage={busy && item.status === "streaming"}
                  branchBusy={branchBusy}
                  hasQueuedRuns={hasQueuedRuns}
                  feedbackBusy={feedbackBusy}
                  showContextUsage={settings.aiRuntime.showContextUsage}
                  expandedActivitySteps={expandedActivitySteps?.messageId === item.id ? expandedActivitySteps : null}
                  subagentStreamPreviews={item.id === activeRunRef.current ? subagentStreamPreviews : undefined}
                  writingProposalLoading={writingProposalLoading}
                  writingProposalBusy={writingProposalBusy}
                  showPromptSuggestions={settings.aiRuntime.promptSuggestions}
                  promptSuggestionDisabled={!activeAccount || busy || projectDirectoryMissing || associationsBusy || projectBusy || Boolean(editingMessage) || branchBusy || hasQueuedRuns}
                  visiblePromptSuggestions={item.promptSuggestions ?? EMPTY_PROMPT_SUGGESTIONS}
                  actions={messageRowActions}
                  setEditingMessage={setEditingMessage}
                  setMessageActionError={setMessageActionError}
                  setBranchTargetMessageId={setBranchTargetMessageId}
                  onOpenProjectFile={onOpenProjectFile}
                  onBrowserToolCompleted={onBrowserToolCompleted}
                />;
              }) : <div className={`ai-work-chat__welcome${appId === "writing" ? " ai-work-chat__welcome--writing" : ""}`}>
            <div className="ai-work-chat__welcome-hero">
              <span className="ai-work-chat__welcome-mark" aria-hidden="true"><WorkbenchIcon name="spark" size={22} /></span>
              <div className="ai-work-chat__welcome-copy"><span className="ai-work-chat__welcome-app">LFAA · {welcomeContent[appId].title}</span><h1>{welcomeContent[appId].title}</h1><p>{welcomeContent[appId].description}</p></div>
            </div>
            {settings.aiRuntime.promptSuggestions ? <section className="ai-work-chat__welcome-recommendations" aria-label="为你推荐的问答">
              <span className="ai-work-chat__welcome-recommendations-title">为你推荐</span>
              <div className="ai-work-chat__suggestions">{suggestions[appId].map((suggestion) => <button type="button" key={suggestion} disabled={!activeAccount || busy} onClick={() => void sendMessage(suggestion)}>{suggestion}</button>)}</div>
            </section> : null}
            <Typography.Text type="secondary">{getPermissionModeHint(appId, settings.permissions.mode)}</Typography.Text>
              </div>}
              {branchSource ? <div className="ai-work-chat__branch-origin" role="note" aria-label={`接续自 ${branchSource.title}`}>
                <WorkbenchIcon name="branch" size={13} />
                <span>接续自</span>
                {branchSource.session && !branchSource.session.archived && sessions.some(session => session.id === branchSource.session!.id && !session.archived)
                  ? <Button className="ai-work-chat__branch-origin-link" type="link" size="small" aria-label={`返回来源会话：${branchSource.session.title}`} onClick={() => {
                    const source = branchSource.session!;
                    onSessionsChange([source, ...sessions.filter(session => session.id !== source.id)]);
                    onSelectedProjectChange(source.projectId ?? null);
                    setSelectedProjectId(source.projectId ?? null);
                    onActiveSessionChange(source.id);
                  }}>{branchSource.title}</Button>
                  : <span className="ai-work-chat__branch-origin-title">{branchSource.title}</span>}
                {branchSource.session?.archived ? <span className="ai-work-chat__branch-origin-status">已归档</span> : null}
              </div> : null}
              </div>
            </div>
          </div>
          <div className="ai-work-chat__scrollbar-track" aria-hidden="true" />
          {showScrollToLatest ? <Button className="ai-work-chat__scroll-latest" type="default" onClick={() => scrollToLatest(true)} aria-label="回到底部查看最新回复"><WorkbenchIcon name="chevron" size={16} /><span>{busy ? "有新内容 · 回到底部" : "回到底部"}</span></Button> : null}
        </div>
        <div className="ai-work-chat__input-area">
          {planModeActive ? <PlanModeBanner
            busy={busy}
            modeBusy={planModeBusy}
            canApprove={messages.some(item => item.role === "assistant" && item.status === "complete" && item.content.trim())}
            onExit={() => void changePlanMode(false)}
            onApprove={() => void sendMessage("我已批准目前讨论的计划，请按计划开始执行。", undefined, undefined, { planMode: false })}
          /> : null}
          {renderPendingComposerInteraction()}
          <form ref={composerFormRef} className="ai-work-chat__composer" aria-label="小鱼智能体 消息输入" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
          {projectDirectoryMissing && supportsWorkspaceProjectContext ? <Alert className="ai-work-chat__directory-warning" type="warning" showIcon message="项目目录已删除或移动" description="当前会话仍可查看历史记录；如需继续工作，请新建会话并选择可用项目目录。" /> : null}
          <div className="ai-work-chat__composer-context" aria-label="当前对话上下文">
            {workspaceProjectAppId ? <WorkspaceProjectPicker appId={workspaceProjectAppId} applicationName={applicationNameFor(workspaceProjectAppId)} projects={workspaceProjects} projectListStatus={workspaceProjectsLoadStatus} projectListTruncated={workspaceProjectsTruncated} projectLoadError={workspaceProjectsError} onRetryProjects={onRetryWorkspaceProjects} nodes={workspaceNodes} value={selectedProjectId} selectedProjectTitle={activeSessionId ? sessions.find(session => session.id === activeSessionId)?.projectTitle : null} defaultDirectory={settings.general.taskFolder || workspaceProjects.find(project => project.id === defaultWorkspaceProjectId)?.path || ""} disabled={projectDirectoryMissing || busy || projectBusy || associationsBusy || Boolean(editingMessage)} onChange={project => void changeWorkspaceProject(project)} onProjectsChange={onWorkspaceProjectsChange} activeSessionId={activeSessionId} /> : null}

            <Tooltip trigger={["hover"]} placement="top" title={applicationNameFor(appId)}>
              <span className="ai-work-chat__composer-app" aria-label={`${appId === "workspace" ? "当前工作区" : "当前应用"}：${applicationNameFor(appId)}`}><WorkbenchIcon name="spark" size={13} /><span className="ai-work-chat__composer-app-label">{applicationNameFor(appId)}</span></span>
            </Tooltip>
            {appId === "workspace" ? <Tooltip trigger={["hover"]} placement="top" title="选择小鱼当前要协助的应用背景；这不会改变已登记工具或权限范围。">
              <Select
                className="ai-work-chat__composer-context-selector"
                size="small"
                aria-label="当前领域应用上下文"
                value={selectedContextApplicationId ?? "workspace"}
                options={[{ value: "workspace", label: "通用聊天" }, ...WORKSPACE_PROJECT_CONTEXT_APPLICATION_IDS.map(id => ({ value: id, label: applicationNameFor(id) }))]}
                disabled={busy || contextApplicationBusy || projectBusy || Boolean(editingMessage)}
                loading={contextApplicationBusy}
                onChange={value => void changeContextApplication(value as "workspace" | WorkspaceProjectContextApplicationId)}
              />
            </Tooltip> : <Tooltip trigger={["hover"]} placement="top" title={applicationNameFor(appId)}>
              <span className="ai-work-chat__composer-app" aria-label="当前应用"><WorkbenchIcon name="spark" size={13} /><span className="ai-work-chat__composer-app-label">{applicationNameFor(appId)}</span></span>
            </Tooltip>}
            {!workspaceProjectAppId && appId !== "workspace" && appId !== "minecraft" ? (() => {
              const appProject = workspaceView?.applicationProject?.applicationId === appId
                ? workspaceView.applicationProject
                : workspaceView?.canvas?.applicationId === appId ? workspaceView.canvas : undefined;
              return appProject ? <Tooltip trigger={["hover"]} placement="top" title={`当前${applicationNameFor(appId)}项目：${appProject.title}`}>
                <span className="ai-work-chat__composer-app" aria-label={`当前${applicationNameFor(appId)}项目：${appProject.title}`}><WorkbenchIcon name="folder" size={13} /><span className="ai-work-chat__composer-app-label">{appProject.title}</span></span>
              </Tooltip> : onOpenApplicationCanvas ? <Button className="ai-work-chat__composer-project-button" type="text" size="small" icon={<WorkbenchIcon name="grid" size={13} />} onClick={onOpenApplicationCanvas}>选择{applicationNameFor(appId)}项目</Button> : null;
            })() : null}
            <Typography.Text className="ai-work-chat__composer-count" aria-label={`已输入 ${draft.length}，最多 12000 个字符`}>{draft.length}<span>/12000</span></Typography.Text>
          </div>
          <ComposerTriggerMenu
            menu={composerMenu}
            maxHeight={composerMenuMaxHeight}
            items={composerMenuItems}
            groups={composerMenuGroups}
            activeIndex={composerMenuActiveIndex}
            associations={associations}
            capabilitiesError={capabilitiesError}
            onSelect={applyComposerMenuItem}
          />
          <Input.TextArea
            aria-label="输入小鱼消息"
            value={draft}
            onChange={(event) => {
              const value = event.target.value;
              updateComposerDraft(value, event.target.selectionStart);
            }}
            onKeyDown={handleComposerKeyDown}
            onBlur={() => setComposerMenu(null)}
            aria-autocomplete="list"
            aria-controls={composerMenu ? "ai-work-chat-composer-menu" : undefined}
            aria-expanded={Boolean(composerMenu)}
            aria-activedescendant={composerMenuItems[composerMenuActiveIndex] ? `ai-work-chat-composer-option-${encodeURIComponent(composerMenuItems[composerMenuActiveIndex].id)}` : undefined}
            placeholder={pendingInteraction?.kind === "question" ? "请在上方交互卡中回答，或选择跳过…" : busy ? settings.general.followupBehavior === "queue" ? "发送跟进，当前任务完成后继续处理…" : "发送约束，引导当前任务的下一步…" : "向 LFAA AI 提问…"}
            autoSize={{ minRows: 2, maxRows: 7 }}
            maxLength={12000}
            onPaste={(event) => { const files = event.clipboardData?.files; if (files && files.length > 0) { event.preventDefault(); void pickAttachments(files); } }}
            disabled={projectDirectoryMissing || projectBusy || associationsBusy || Boolean(editingMessage) || pendingInteraction?.kind === "question" || !activeAccount && !busy}
          />
          <PendingAttachmentList
            items={pendingAttachments.map(file => ({ ...file, previewUrl: "/api/attachments/" + file.id + "/content" }))}
            onRemove={removePendingAttachment}
          />
          <div className="ai-work-chat__composer-actions">
            <div className="ai-work-chat__composer-actions-group" aria-label="添加、权限与更多操作">
              <ComposerAttachmentControl
                error={attachmentError}
                busy={attachmentBusy}
                pendingCount={pendingAttachments.length}
                onSelectFiles={files => { void pickAttachments(files); }}
              />
              <Dropdown
                trigger={["click"]}
                placement="topLeft"
                overlayClassName="ai-work-chat__permission-overlay"
                open={permissionMenuOpen}
                onOpenChange={(open) => {
                  if (open) setPermissionTooltipOpen(false);
                  setPermissionMenuOpen(open);
                }}
                getPopupContainer={(trigger) => trigger.closest<HTMLElement>(".workbench-shell") ?? trigger.parentElement ?? document.body}
                popupRender={(menu) => (
                  <div className="ai-work-chat__permission-popover">
                    <div className="ai-work-chat__permission-popover-header">
                      <strong>项目权限模式</strong>
                      <Button className="ai-work-chat__permission-help" type="link" onClick={() => onOpenSettings("permissions")}>权限说明</Button>
                    </div>
                    {menu}
                  </div>
                )}
                menu={{
                  items: [
                    ...permissionModeOptions.map((option) => ({
                      key: option.mode,
                      label: (
                        <span className={`ai-work-chat__permission-option ai-work-chat__permission-option--${option.mode}`}>
                          <span className="ai-work-chat__permission-option-icon"><WorkbenchIcon name={option.icon} size={16} /></span>
                          <span className="ai-work-chat__permission-option-copy">
                            <span className="ai-work-chat__permission-option-title">{option.label}</span>
                            <span className="ai-work-chat__permission-option-description">{option.description}</span>
                          </span>
                          {settings.permissions.mode === option.mode && <span className="ai-work-chat__permission-option-selected" aria-label="当前选择">✓</span>}
                        </span>
                      )
                    }))
                  ],
                  className: "ai-work-chat__permission-menu",
                  selectedKeys: [settings.permissions.mode],
                  onClick: ({ key }) => selectPermissionMode(key as UserSettings["permissions"]["mode"])
                }}
              >
                <Tooltip trigger={["hover", "focus"]} placement="top" title={`更改权限 · 当前为${permissionModeLabels[settings.permissions.mode]}`} open={permissionTooltipOpen && !permissionMenuOpen} onOpenChange={setPermissionTooltipOpen}>
                  <span className="ai-work-chat__composer-disabled-wrap" tabIndex={toolbarBusy === "permissions" ? 0 : -1}>
                    <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--permission" type="text" aria-label={`LFAA 权限模式：${permissionModeLabels[settings.permissions.mode]}`} disabled={toolbarBusy === "permissions"}>
                      <WorkbenchIcon name="shield" size={15} />
                      <span className="ai-work-chat__composer-control-label">{permissionModeLabels[settings.permissions.mode]}</span>
                      <WorkbenchIcon className="ai-work-chat__composer-control-chevron" name="chevron" size={12} />
                    </Button>
                  </span>
                </Tooltip>
              </Dropdown>
              <Popover
                trigger="click"
                placement="topLeft"
                arrow={false}
                overlayClassName="ai-work-chat__more-overlay"
                getPopupContainer={(trigger) => trigger.closest<HTMLElement>(".workbench-shell") ?? trigger.parentElement ?? document.body}
                open={composerMoreOpen}
                onOpenChange={(open) => {
                  if (open) setComposerMoreTooltipOpen(false);
                  setComposerMoreOpen(open);
                  if (!open) setComposerMoreSection(null);
                }}
                content={composerMoreContent}
              >
                <Tooltip trigger={["hover", "focus"]} placement="top" title="关联应用、Skill、提示词和专家" open={composerMoreTooltipOpen && !composerMoreOpen} onOpenChange={setComposerMoreTooltipOpen}>
                  <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--more" type="text" aria-haspopup="dialog" aria-expanded={composerMoreOpen} aria-label="更多输入操作" icon={<WorkbenchIcon name="grid" size={15} />}><span className="ai-work-chat__composer-control-label">更多</span></Button>
                </Tooltip>
              </Popover>
            </div>
            <div className="ai-work-chat__composer-actions-group ai-work-chat__composer-actions-group--right" aria-label="模型、推理与发送">
              <DshSlotOutlet name="conversation.input.right" owner={conversationInputSlotOwner} />
              <Popover
                trigger="click"
                placement="top"
                arrow={false}
                overlayClassName="ai-work-chat__model-overlay"
                getPopupContainer={(trigger) => trigger.closest<HTMLElement>(".workbench-shell") ?? trigger.parentElement ?? document.body}
                open={modelPickerOpen}
                onOpenChange={(open) => {
                  if (open) setModelPickerTooltipOpen(false);
                  setModelPickerOpen(open);
                  if (!open) {
                    setModelSearch("");
                    setModelResultLimit(MODEL_PICKER_RESULT_LIMIT);
                    setReasoningDraftIndex(null);
                  }
                }}
                content={modelPickerContent}
              >
                <Tooltip trigger={["hover", "focus"]} placement="top" title={modelPickerTooltipTitle} open={modelPickerTooltipOpen && !modelPickerOpen} onOpenChange={setModelPickerTooltipOpen}>
                  <span className="ai-work-chat__composer-disabled-wrap" tabIndex={!modelPickerCatalog.length || modelBusy || busy ? 0 : -1}>
                    <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--model" type="text" aria-haspopup="dialog" aria-expanded={modelPickerOpen} aria-busy={accountLoadState === "loading" || modelBusy} aria-label={activeAccount ? `当前模型 ${activeModel?.name ?? activeAccount.modelId}${composerReasoningLabel ? ` · 当前档位 ${composerReasoningLabel}` : ""} · 点击选择推理强度` : modelPickerCatalog.length ? "选择模型和推理强度" : accountLoadState === "loading" ? "模型：正在读取当前配置" : accountLoadState === "error" ? "模型：状态不可用" : "模型：未配置"} disabled={!modelPickerCatalog.length || modelBusy || busy}>
                      <WorkbenchIcon className="ai-work-chat__composer-model-icon" name="model" size={18} />
                      <span className="ai-work-chat__composer-control-label">{composerModelLabel}</span>
                      <WorkbenchIcon className="ai-work-chat__composer-control-chevron" name="chevron" size={12} />
                    </Button>
                  </span>
                </Tooltip>
              </Popover>
              <Tooltip trigger={["hover", "focus"]} placement="top" title={!settings.aiRuntime.voiceInputEnabled ? "请在设置中心的语音页面开启语音输入" : !supportsVoiceInput() ? "当前宿主不支持语音识别" : listening ? "停止语音输入" : "语音输入，识别后由你发送"}>
                <span className="ai-work-chat__composer-disabled-wrap">
                  <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--icon" type="text" aria-label={listening ? "停止语音输入" : "语音输入"} aria-pressed={listening} disabled={Boolean(editingMessage) || !settings.aiRuntime.voiceInputEnabled || !supportsVoiceInput()} onClick={toggleVoiceInput} icon={<WorkbenchIcon name="microphone" size={17} />} />
                </span>
              </Tooltip>
            {busy && draft.trim() ? <Button htmlType="submit" disabled={projectDirectoryMissing || Boolean(editingMessage) || !activeRunRef.current}>{settings.general.followupBehavior === "queue" ? "发送跟进" : "引导任务"}</Button> : null}
            {settings.aiRuntime.readResponsesAloud ? <Button type="text" onClick={stopVoicePlayback}>停止播报</Button> : null}
            {busy
                ? <>
                  <Tooltip trigger={["hover", "focus"]} placement="top" title={runPauseState?.state === "pausing" ? "继续运行（取消待暂停请求）" : runPauseState?.state === "paused" ? "继续当前任务" : "暂停任务；当前模型或工具操作完成后会在安全检查点暂停"}>
                    <span className="ai-work-chat__composer-disabled-wrap" tabIndex={Boolean(editingMessage) || runPauseBusy || !canControlAiRun(activeRunRef.current, stopGuardStartedAtRef.current, Date.now()) || !stopGuardElapsed ? 0 : -1}>
                      <Button className="ai-work-chat__composer-submit ai-work-chat__composer-submit--pause" type="primary" shape="circle" aria-label={runPauseState?.state === "running" || runPauseState?.runId !== activeRunRef.current ? "暂停任务" : "继续任务"} aria-pressed={runPauseState?.state === "paused"} disabled={Boolean(editingMessage) || runPauseBusy || !canControlAiRun(activeRunRef.current, stopGuardStartedAtRef.current, Date.now()) || !stopGuardElapsed} icon={<span className={`ai-work-chat__composer-pause-icon${runPauseState?.state === "running" || runPauseState?.runId !== activeRunRef.current ? "" : " ai-work-chat__composer-pause-icon--resume"}`} aria-hidden="true" />} onClick={() => void toggleAiRunPause()} />
                    </span>
                  </Tooltip>
                  <Tooltip trigger={["hover", "focus"]} placement="top" title="停止并终止当前任务">
                    <span className="ai-work-chat__composer-disabled-wrap" tabIndex={Boolean(editingMessage) || !activeRunRef.current ? 0 : -1}>
                      <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--icon" type="text" aria-label="停止并终止当前任务" disabled={Boolean(editingMessage) || !activeRunRef.current} icon={<WorkbenchIcon name="close" size={15} />} onClick={() => { const runId = activeRunRef.current; if (runId) void cancelAiRun(runId).catch(stopError => setError(`停止任务失败：${getErrorMessage(stopError)}`)); }} />
                    </span>
                  </Tooltip>
                </>
                : <Tooltip trigger={["hover", "focus"]} placement="top" title={settings.general.sendShortcut === "enter" ? "发送消息 · Enter" : "发送消息 · Ctrl+Enter"}>
                  <span className="ai-work-chat__composer-disabled-wrap" tabIndex={!draft.trim() && pendingAttachments.length === 0 || !activeAccount || projectDirectoryMissing ? 0 : -1}>
                    <Button className="ai-work-chat__composer-submit" type="primary" shape="circle" htmlType="submit" aria-label="发送消息" title={projectDirectoryMissing ? "项目目录已删除或移动，不能继续执行" : "发送消息"} icon={<WorkbenchIcon name="spark" size={15} />} disabled={projectDirectoryMissing || (!draft.trim() && pendingAttachments.length === 0) || !activeAccount} />
                  </span>
                </Tooltip>}
            </div>
          </div>
          </form>
        </div>
        <AiUsageFooter usageSummary={sessionUsageSummary} contextUsage={contextUsage} showContextUsage={settings.aiRuntime.showContextUsage} busy={busy} usageLoadState={sessionUsageLoadState} hasAssistantMessage={Boolean(latestAssistantMessage)} onOpenContextSettings={openAiContextSettings} />
        <WritingProposalReviewDialog
          open={writingProposalId !== null}
          proposal={writingProposal}
          loading={writingProposalLoading}
          busy={writingProposalBusy}
          error={writingProposalError}
          onCancel={() => {
            if (writingProposalBusy) return;
            writingProposalLoadSequence.current += 1;
            setWritingProposalId(null);
            setWritingProposal(null);
            setWritingProposalError("");
            setWritingProposalLoading(false);
          }}
          onResolve={(decision) => void resolveWritingProposal(decision)}
        />
        <MessageFeedbackDialog
          open={feedbackTarget !== null}
          rating={feedbackTarget?.rating ?? null}
          selectedReasons={feedbackReasons}
          detail={feedbackDetail}
          error={messageActionError}
          busy={feedbackBusy}
          getContainer={() => outputFocusRegionElementRef.current?.closest<HTMLElement>(".workbench-shell") ?? outputFocusRegionElementRef.current ?? document.body}
          onClose={() => {
            if (feedbackBusy) return;
            setFeedbackTarget(null);
            setFeedbackReasons([]);
            setFeedbackDetail("");
            setMessageActionError("");
          }}
          onSubmit={() => void submitMessageFeedback()}
          onToggleReason={toggleFeedbackReason}
          onDetailChange={setFeedbackDetail}
        />
        <Modal
          className="ai-work-chat__branch-modal"
          rootClassName="ai-work-chat__branch-modal-root"
          open={branchTargetMessageId !== null}
          title="从这里创建聊天分支"
          width="min(560px, 100%)"
          getContainer={() => outputFocusRegionElementRef.current?.closest<HTMLElement>(".workbench-shell") ?? outputFocusRegionElementRef.current ?? document.body}
          closable={!branchBusy}
          maskClosable={!branchBusy}
          keyboard={!branchBusy}
          onCancel={() => {
            if (branchBusy) return;
            setBranchTargetMessageId(null);
            setMessageActionError("");
          }}
          footer={<Button disabled={branchBusy} onClick={() => { setBranchTargetMessageId(null); setMessageActionError(""); }}>取消</Button>}
        >
          {messageActionError ? <Alert className="ai-work-chat__branch-error" type="error" showIcon message={messageActionError} /> : null}
          <div className="ai-work-chat__branch-options">
            <button className="ai-work-chat__branch-option" type="button" disabled={branchBusy} onClick={() => void createMessageBranch("workspace")}>
              <span className="ai-work-chat__branch-option-icon"><WorkbenchIcon name="branch" size={18} /></span>
              <span className="ai-work-chat__branch-option-copy"><strong>{branchBusy ? "正在整理对话记忆…" : "在当前工作空间中创建分支"}</strong><small>提炼到此回复为止的关键记忆，在空白新聊天中继续</small></span>
            </button>
            {canCreateWorktreeBranch ? <button className="ai-work-chat__branch-option" type="button" disabled={branchBusy} onClick={() => void createMessageBranch("worktree")}>
              <span className="ai-work-chat__branch-option-icon"><WorkbenchIcon name="branch" size={18} /></span>
              <span className="ai-work-chat__branch-option-copy"><strong>{branchBusy ? "正在创建工作树并整理记忆…" : "在新工作树中创建分支"}</strong><small>创建隔离 AI Worktree，并在空白新聊天中接续关键记忆</small></span>
            </button> : null}
          </div>
        </Modal>
      </div>
    </section>
  );
}

export const AiWorkChat = memo(AiWorkChatView);

/**
 * 文件：AiWorkChat.tsx
 * 功能：提供 SteamCMD、Minecraft 和写作工作区的 AI Work 流式聊天。
 * 作用：调用控制端会话 API，显示持久化历史、可复制消息、可编辑并重新发送的问题、回答反馈、聊天分支、悬停式提问锚点、Provider 输出和真实用量状态；呈现账户级权限选择、模型卡片及其目录确认的思考力度，并把运行事件交给工作台通知中心。
 * 不负责：业务规则、节点任务执行和审批授权；这些由 server 核心及 Daemon 完成。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/store/src/scroll-restoration.ts、packages/api/gateway/src/index.ts。
 * 修改注意事项：只展示 server 发来的真实 Agent、工具、子 Agent、Skill 和审批状态。
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type UIEvent, type WheelEvent as ReactWheelEvent } from "react";
import { createSnapshotCache } from "lfaa-client-store/src/snapshot-cache.js";
import { Alert, Button, Dropdown, Empty, Input, Modal, Popover, Spin, Tag, Tooltip, Typography } from "antd";
import { answerAiRunQuestion, appendAiRunInput, applyWritingEditProposal, ApiError, cancelAiRun, createWorkspaceGitWorktree, decideAiApproval, forkAiSessionBeforeUserMessage, forkAiSessionFromMessage, forkAiSessionFromMessageInWorktree, getErrorMessage, loadAiAccounts, loadWritingEditProposal, loadAiMessages, loadAiSessions, loadWritingWorkspace, rejectWritingEditProposal, saveSettings, setAiSessionPlanMode, setAiSessionProject, streamAiChat, submitAiMessageFeedback, updateAiAccountModel, updateAiAccountReasoningMode, type AiAccount, type AiActivityItem, type AiMessage, type AiMessageFeedbackInput, type AiSession, type ApplicationId, type UserSettings, type WritingEditProposal, type WritingWorkspace, type WorkspaceDaemonNode, type WorkspaceProject, type WorkspaceProjectApplicationId } from "lfaa-client-connection/src/api.js";
import { notifyAiWorkAction, notifyAiWorkCompletion, type AiWorkNotificationInput } from "lfaa-client-resources/src/notification-runtime.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { AiMarkdown } from "./AiMarkdown.js";
import { formatAiActivityDuration, getAiActivityDisplayStatus, getAiActivityDurationSeconds, getAiActivitySummary } from "./activity-duration.js";
import { buildConversationAnchors, conversationAnchorLabel, conversationAnchorReply, type ConversationAnchorPreview } from "./conversation-anchor-preview.js";
import { buildConversationAnchorLayout, createConversationScrollTracker, createFrameCoalescer, findNearestConversationAnchorIndex, shouldAutoScrollToLatest, shouldFollowLatestMessage, shouldShowScrollToLatest, updateConversationAnchorPointerTarget } from "./conversation-scroll.js";
import { createOutputIdleBlurController } from "./output-idle-blur.js";
import { supportsVoiceInput, startVoiceInput, readResponseAloud, stopVoicePlayback } from "./voice.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { WorkspaceProjectPicker } from "./WorkspaceProjectPicker.js";
import { effectiveReasoningMode, fixedThinkingLabel, modelParameterSummary, reasoningDefaultLabel, reasoningModeLabel, reasoningOptions } from "lfaa-client-ui-settings-models/src/model-options.js";
import "./ai-work-chat.css";

const MODEL_PICKER_RESULT_LIMIT = 60;
type AiMessageFeedbackRating = AiMessageFeedbackInput["rating"];
const aiMessageFeedbackReasons: Record<AiMessageFeedbackRating, string[]> = {
  positive: ["解决了我的问题", "遵循了我的指示", "代码/输出质量好", "快速高效", "有帮助的自主行为", "其他"],
  negative: ["没有解决问题", "没有遵循我的指示", "回答不够准确", "代码/输出质量需要改进", "不够有帮助", "其他"]
};

interface AiWorkChatProps {
  userId: string;
  appId: ApplicationId;
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
  sessions: AiSession[];
  activeSessionId: string | null;
  newSessionProjectId: string | null;
  onSelectedProjectChange: (projectId: string | null) => void;
  workspaceProjects: WorkspaceProject[];
  workspaceProjectsTruncated: boolean;
  workspaceNodes: WorkspaceDaemonNode[];
  workspaceProjectsError: string;
  onRetryWorkspaceProjects: () => void;
  onWorkspaceProjectsChange: (projects: WorkspaceProject[]) => void;
  initialDraft: string;
  newSessionKey: number;
  onSessionsChange: (sessions: AiSession[]) => void;
  onActiveSessionChange: (sessionId: string | null) => void;
  onDraftChange: (draft: string) => void;
  onProviderStatusChange: (status: string) => void;
  onBusyChange: (busy: boolean) => void;
  onOpenSettings: (section?: "ai" | "permissions") => void;
  onNotification: (notification: AiWorkNotificationInput) => void;
  onOpenSideChat: (initialQuestion?: string) => void;
  onWritingWorkspaceChange?: (workspace: WritingWorkspace) => void;
}

type MessageUsage = { promptTokens: number | null; completionTokens: number | null; providerId: string; modelId: string };
type PendingAiInteraction = { kind: "approval" | "question"; runId: string; activity: AiActivityItem };

const aiAccountSnapshots = createSnapshotCache<AiAccount[]>();
const aiMessageSnapshots = createSnapshotCache<AiMessage[]>(messages => messages.reduce((size, message) => size
  + (message.content.length + message.activity.reduce((length, activity) => length + activity.title.length + activity.detail.length, 0)) * 2, 0));

function applicationNameFor(appId: ApplicationId): string {
  return appId === "workspace" ? "通用任务" : appId === "steamcmd" ? "SteamCMD" : appId === "minecraft" ? "Minecraft" : "写作";
}

function aiMessageSnapshotKey(userId: string, appId: ApplicationId, sessionId: string): string {
  return `${userId}:${appId}:${sessionId}`;
}

function findPendingAiInteraction(messages: AiMessage[]): PendingAiInteraction | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== "assistant" || message.status !== "streaming") continue;
    for (let activityIndex = message.activity.length - 1; activityIndex >= 0; activityIndex -= 1) {
      const activity = message.activity[activityIndex];
      if (activity.status === "approval_required" && activity.approvalId) return { kind: "approval", runId: message.id, activity };
      if (activity.status === "waiting_input" && activity.questionId && activity.question && activity.options?.length) return { kind: "question", runId: message.id, activity };
    }
  }
  return null;
}

const suggestions: Record<ApplicationId, string[]> = {
  workspace: ["读取我的项目说明，分析需要修复的问题并运行验证。", "先检查当前可用节点和工具，再规划这项任务。"],
  steamcmd: ["帮我列出一份 SteamCMD 部署专用服务器前的检查清单。", "如何规划游戏服务器端口、备份和更新流程？"],
  minecraft: ["给我一份升级 Minecraft Java 服务端前的兼容性检查清单。", "比较 Paper、Fabric 和原版服务端的适用场景。"],
  connectivity: [],
  writing: ["帮我梳理这个故事的核心设定和待确认问题。", "请分析这段正文的节奏、人物动机与表达问题。", "围绕这个角色，帮我补出清晰的目标、阻碍与变化。"]
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
    : "AI 可调用当前应用的项目管理、节点、文件及主机终端能力。";
  if (mode === "full_access") return `${appContext}完全权限已开启，模型可在在线 Daemon 上执行任意命令并指定任意工作目录，不再逐项等待审批。`;
  if (mode === "approve_remembered") return `${appContext}匹配已记住的精确范围时自动执行，其他写入和高风险操作会请求审批。`;
  return `${appContext}写入和高风险操作会先请求你的逐项审批。`;
}

function conversationAnchorPreviewOwner(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const owner = target.closest(".ai-work-chat__anchor-preview")?.closest(".ai-work-chat__anchor");
  return owner instanceof HTMLElement ? owner : null;
}

interface ConversationAnchorRailProps {
  anchors: ConversationAnchorPreview[];
  layout: ReturnType<typeof buildConversationAnchorLayout>;
  activeAnchorId: string | null;
  onJump: (messageId: string) => void;
}

const ConversationAnchorRail = memo(function ConversationAnchorRail({ anchors, layout, activeAnchorId, onJump }: ConversationAnchorRailProps) {
  const navRef = useRef<HTMLElement | null>(null);
  const anchorListRef = useRef<HTMLDivElement | null>(null);
  const pointerActiveElementRef = useRef<HTMLElement | null>(null);
  const latestSelectionDataRef = useRef({ anchors, positions: layout.positions });
  latestSelectionDataRef.current = { anchors, positions: layout.positions };
  const pointerFrameRef = useRef<ReturnType<typeof createFrameCoalescer<number>> | null>(null);
  if (pointerFrameRef.current === null) {
    pointerFrameRef.current = createFrameCoalescer<number>((clientY) => {
      const nav = navRef.current;
      if (!nav) return;
      const { anchors: currentAnchors, positions } = latestSelectionDataRef.current;
      const localY = clientY - nav.getBoundingClientRect().top;
      const index = findNearestConversationAnchorIndex(positions, localY);
      const list = anchorListRef.current;
      const nextElement = index === null || !currentAnchors[index] ? null : list?.children.item(index) as HTMLElement | null ?? null;
      pointerActiveElementRef.current = updateConversationAnchorPointerTarget(pointerActiveElementRef.current, nextElement);
    });
  }

  useEffect(() => () => {
    pointerFrameRef.current?.cancel();
    pointerActiveElementRef.current = updateConversationAnchorPointerTarget(pointerActiveElementRef.current, null);
  }, []);

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>): void {
    if (event.pointerType === "touch") return;
    const previewOwner = conversationAnchorPreviewOwner(event.target);
    if (previewOwner) {
      pointerFrameRef.current?.cancel();
      pointerActiveElementRef.current = updateConversationAnchorPointerTarget(pointerActiveElementRef.current, previewOwner);
      return;
    }

    pointerFrameRef.current?.schedule(event.clientY);
  }

  function handlePointerLeave(event: ReactPointerEvent<HTMLElement>): void {
    const previewOwner = conversationAnchorPreviewOwner(event.relatedTarget);
    if (previewOwner) {
      pointerFrameRef.current?.cancel();
      pointerActiveElementRef.current = updateConversationAnchorPointerTarget(pointerActiveElementRef.current, previewOwner);
      return;
    }
    pointerFrameRef.current?.cancel();
    pointerActiveElementRef.current = updateConversationAnchorPointerTarget(pointerActiveElementRef.current, null);
  }

  return <nav
    ref={navRef}
    className="ai-work-chat__anchors"
    aria-label="本会话对话锚点"
    style={{ height: `${layout.height}px` }}
    data-mark-height={layout.markHeight}
    onPointerMove={handlePointerMove}
    onPointerLeave={handlePointerLeave}
  >
    <div ref={anchorListRef} className="ai-work-chat__anchor-list">
      {anchors.map(({ question, reply }, index) => {
        const label = conversationAnchorLabel(question.content) || "（无内容）";
        const replyPreview = conversationAnchorReply(reply);
        const replyLabel = conversationAnchorLabel(replyPreview) || replyPreview;
        const isActive = question.id === activeAnchorId;
        return <button
          type="button"
          className={`ai-work-chat__anchor${isActive ? " is-active" : ""}`}
          key={question.id}
          style={{ top: `${(layout.positions[index] ?? 0) - Math.floor(layout.hitAreaHeight / 2)}px`, height: `${layout.hitAreaHeight}px` }}
          aria-current={isActive ? "location" : undefined}
          aria-label={`跳转到第 ${index + 1} 条提问：${label}；助手回复：${replyLabel}`}
          onClick={(event) => {
            // 指针点击后释放按钮焦点，避免残留的可见焦点覆盖回复区失焦；键盘激活仍保留焦点。
            if (event.detail > 0) event.currentTarget.blur();
            onJump(question.id);
          }}
        >
          <span className="ai-work-chat__anchor-mark" style={{ top: `${layout.markOffset}px` }} aria-hidden="true" />
          <span className="ai-work-chat__anchor-preview" style={{ top: `${Math.floor(layout.hitAreaHeight / 2)}px` }} aria-hidden="true"><strong>{question.content.trim() || "（无内容）"}</strong><span>{replyPreview}</span></span>
        </button>;
      })}
    </div>
  </nav>;
});

const runtimeSpeedOptions: Array<{ value: UserSettings["aiRuntime"]["speed"]; label: string; description: string }> = [
  { value: "fast", label: "快速", description: "短输出" },
  { value: "balanced", label: "平衡", description: "按设置上限" },
  { value: "deep", label: "深入", description: "长输出" }
];

function AiWorkChatView({ userId, appId, settings, onSettingsChange, sessions, activeSessionId, newSessionProjectId, onSelectedProjectChange, workspaceProjects, workspaceProjectsTruncated, workspaceNodes, workspaceProjectsError, onRetryWorkspaceProjects, onWorkspaceProjectsChange, initialDraft, newSessionKey, onSessionsChange, onActiveSessionChange, onDraftChange, onProviderStatusChange, onBusyChange, onOpenSettings, onNotification, onOpenSideChat, onWritingWorkspaceChange }: AiWorkChatProps) {
  const currentScrollConversationKey = `${appId}:${activeSessionId ?? "new-session"}`;
  const outputFocusRegionElementRef = useRef<HTMLElement | null>(null);
  const setOutputFocusRegionElement = useCallback((node: HTMLElement | null) => {
    outputFocusRegionElementRef.current = node;
  }, []);
  const [permissionModal, permissionModalContext] = Modal.useModal();
  const cachedAccounts = useRef(aiAccountSnapshots.get(userId) ?? null).current;
  const cachedMessages = useRef(activeSessionId ? aiMessageSnapshots.get(aiMessageSnapshotKey(userId, appId, activeSessionId)) ?? null : null).current;
  const [messages, setMessages] = useState<AiMessage[]>(() => cachedMessages ?? []);
  const [draft, setDraft] = useState(initialDraft);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => activeSessionId ? sessions.find(session => session.id === activeSessionId)?.projectId ?? null : newSessionProjectId);
  const [projectBusy, setProjectBusy] = useState(false);
  const [planModeBusy, setPlanModeBusy] = useState(false);
  const [planModeOverride, setPlanModeOverride] = useState<{ sessionId: string | null; active: boolean } | null>(null);
  const [messagesReady, setMessagesReady] = useState(() => !activeSessionId || cachedMessages !== null);
  const [usageByMessage, setUsageByMessage] = useState<Record<string, MessageUsage>>({});
  const [accounts, setAccounts] = useState<AiAccount[]>(() => cachedAccounts ?? []);
  // 区分 Provider 尚未返回、成功但没有活动账户与读取失败，避免把加载中的空数组误报为未配置。
  const [accountLoadState, setAccountLoadState] = useState<"loading" | "ready" | "error">(() => cachedAccounts === null ? "loading" : "ready");
  const [loading, setLoading] = useState(() => Boolean(activeSessionId && cachedMessages === null));
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const stopListening = useRef<(() => void) | null>(null);
  const draftRef = useRef(draft); draftRef.current = draft;
  useEffect(() => () => { stopListening.current?.(); stopVoicePlayback(); }, []);
  useEffect(() => { if (!settings.aiRuntime.voiceInputEnabled) { stopListening.current?.(); stopListening.current = null; setListening(false); } if (!settings.aiRuntime.readResponsesAloud) stopVoicePlayback(); }, [settings.aiRuntime.voiceInputEnabled, settings.aiRuntime.readResponsesAloud]);
  const [activityClock, setActivityClock] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [toolbarBusy, setToolbarBusy] = useState<"permissions" | "aiRuntime" | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [messageActionError, setMessageActionError] = useState("");
  const [feedbackTarget, setFeedbackTarget] = useState<{ messageId: string; rating: AiMessageFeedbackRating } | null>(null);
  const [feedbackReasons, setFeedbackReasons] = useState<string[]>([]);
  const [feedbackDetail, setFeedbackDetail] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [branchTargetMessageId, setBranchTargetMessageId] = useState<string | null>(null);
  const [branchBusy, setBranchBusy] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ messageId: string; content: string; phase: "stopping" | "ready" | "sending" } | null>(null);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
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
  const activeRunRef = useRef<string | null>(null);
  const runRequestGenerationRef = useRef(0);
  const autoFollowAttempt = useRef<string | null>(null);
  const sessionIdForTurn = useRef(activeSessionId);
  const notifiedTurnEvents = useRef(new Set<string>());
  const messagesElementRef = useRef<HTMLDivElement | null>(null);
  const scrollTrackerRef = useRef<ReturnType<typeof createConversationScrollTracker> | null>(null);
  const activeScrollConversationRef = useRef<string | null>(null);
  const initializedScrollConversationRef = useRef<string | null>(null);
  const preparedScrollConversationRef = useRef<string | null>(!activeSessionId || cachedMessages !== null ? currentScrollConversationKey : null);
  const pointerScrollTopRef = useRef<number | null>(null);
  const pointerScrollDirectionRef = useRef<"up" | "down" | null>(null);
  useEffect(() => {
    setCopiedMessageId(null);
    setMessageActionError("");
    setFeedbackTarget(null);
    setFeedbackReasons([]);
    setFeedbackDetail("");
    setBranchTargetMessageId(null);
    setEditingMessage(null);
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
  // 默认展示会话最新消息；用户主动上翻后暂停跟随，回到底部时再恢复。
  const followLatestMessageRef = useRef(true);
  const messagesScroll = useScrollRestoration(
    createScrollRestorationKey(userId, "ai-messages", appId, activeSessionId ?? "new-session"),
    messagesReady
  );
  const setMessagesElement = useCallback((node: HTMLDivElement | null) => {
    messagesElementRef.current = node;
    messagesScroll.ref(node);
  }, [messagesScroll.ref]);
  const updateFollowFromUserScroll = useCallback((element: HTMLDivElement, direction: "up" | "down", projectedDistanceFromBottom?: number) => {
    const distanceFromBottom = projectedDistanceFromBottom ?? element.scrollHeight - element.scrollTop - element.clientHeight;
    followLatestMessageRef.current = shouldFollowLatestMessage(followLatestMessageRef.current, direction, distanceFromBottom);
    setShowScrollToLatest(shouldShowScrollToLatest(distanceFromBottom, messages.length));
  }, [messages.length]);
  const handleMessagesWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0 || event.ctrlKey) return;
    const distanceFromBottom = event.currentTarget.scrollHeight - event.currentTarget.scrollTop - event.currentTarget.clientHeight;
    const projectedDistanceFromBottom = Math.max(0, distanceFromBottom - event.deltaY);
    updateFollowFromUserScroll(event.currentTarget, event.deltaY < 0 ? "up" : "down", projectedDistanceFromBottom);
  }, [updateFollowFromUserScroll]);
  const handleMessagesPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const bounds = element.getBoundingClientRect();
    const pointerOnScrollbar = event.clientX >= bounds.right - Math.max(14, element.offsetWidth - element.clientWidth);
    if (event.pointerType === "touch" || pointerOnScrollbar) {
      pointerScrollTopRef.current = element.scrollTop;
      pointerScrollDirectionRef.current = null;
    }
  }, []);
  const handleMessagesPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerScrollTopRef.current === null) return;
    pointerScrollTopRef.current = null;
    const pointerScrollDirection = pointerScrollDirectionRef.current;
    pointerScrollDirectionRef.current = null;
    const element = event.currentTarget;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (pointerScrollDirection === "down" && distanceFromBottom <= 64 && messages.length > 0) {
      followLatestMessageRef.current = true;
      setShowScrollToLatest(false);
    }
  }, [messages.length]);
  const handleMessagesScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    messagesScroll.onScroll(event);
    const element = event.currentTarget;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    const pointerScrollTop = pointerScrollTopRef.current;
    if (pointerScrollTop !== null && element.scrollTop !== pointerScrollTop) {
      const direction = element.scrollTop < pointerScrollTop ? "up" : "down";
      pointerScrollDirectionRef.current = direction;
      updateFollowFromUserScroll(element, direction);
      pointerScrollTopRef.current = element.scrollTop;
    }
    setShowScrollToLatest(shouldShowScrollToLatest(distanceFromBottom, messages.length));
    scrollTrackerRef.current?.refresh();
  }, [messages.length, messagesScroll.onScroll, updateFollowFromUserScroll]);
  const scrollToLatest = useCallback((smooth = false) => {
    const element = messagesElementRef.current;
    if (!element) return;
    followLatestMessageRef.current = true;
    stopVoicePlayback();
    const reducedMotion = settings.appearance.advanced.reducedMotion === "on"
      || settings.appearance.advanced.reducedMotion === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (smooth && !reducedMotion) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    else element.scrollTop = element.scrollHeight;
    setShowScrollToLatest(false);
  }, [settings.appearance.advanced.reducedMotion]);
  const activeAccount = accounts.find((account) => account.active);
  const activeSession = sessions.find(session => session.id === activeSessionId) ?? null;
  const planModeActive = planModeOverride?.sessionId === activeSessionId ? planModeOverride.active : activeSession?.planMode === true;
  useEffect(() => { setPlanModeOverride(null); }, [activeSessionId]);
  const branchSourceProject = activeSession?.projectId ? workspaceProjects.find(project => project.id === activeSession.projectId) ?? null : null;
  const branchSourceNode = branchSourceProject ? workspaceNodes.find(node => node.id === branchSourceProject.nodeId) ?? null : null;
  const canCreateWorktreeBranch = (appId === "workspace" || appId === "minecraft")
    && Boolean(branchSourceProject && branchSourceProject.appId === appId && !branchSourceProject.gitWorktree
      && branchSourceNode?.status === "online" && branchSourceNode.gitWorkspaceSupported);
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
    return (activeAccount?.models ?? []).filter((model) => !query || `${model.name} ${model.id}`.toLocaleLowerCase("zh-CN").includes(query));
  }, [activeAccount?.models, modelSearch]);
  const visibleModels = matchingModels.slice(0, MODEL_PICKER_RESULT_LIMIT);

  useEffect(() => {
    if (!activeSessionId) {
      setSelectedProjectId(newSessionProjectId);
      onSelectedProjectChange(newSessionProjectId);
    }
  }, [activeSessionId, newSessionKey, newSessionProjectId, onSelectedProjectChange]);

  useEffect(() => {
    if (!activeSessionId) return;
    const session = sessions.find(item => item.id === activeSessionId);
    if (session) {
      setSelectedProjectId(session.projectId ?? null);
      onSelectedProjectChange(session.projectId ?? null);
    }
  }, [activeSessionId, onSelectedProjectChange, sessions]);

  async function changeWorkspaceProject(project: WorkspaceProject | null): Promise<void> {
    if (busy || projectBusy) return;
    if (appId !== "workspace" && appId !== "minecraft") return;
    setProjectBusy(true);
    try {
      if (activeSessionId) {
        const { session } = await setAiSessionProject(activeSessionId, project?.id ?? null, appId);
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

  useLayoutEffect(() => {
    const conversationKey = `${appId}:${activeSessionId ?? "new-session"}`;
    if (activeScrollConversationRef.current !== conversationKey) {
      activeScrollConversationRef.current = conversationKey;
      followLatestMessageRef.current = busy;
      initializedScrollConversationRef.current = null;
      pointerScrollTopRef.current = null;
      pointerScrollDirectionRef.current = null;
      if (busy) initializedScrollConversationRef.current = conversationKey;
    }
    if (!busy && messagesReady && preparedScrollConversationRef.current === conversationKey
      && initializedScrollConversationRef.current !== conversationKey) {
      const element = messagesElementRef.current;
      if (element) {
        const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
        followLatestMessageRef.current = distanceFromBottom <= 64;
        setShowScrollToLatest(shouldShowScrollToLatest(distanceFromBottom, messages.length));
      }
      initializedScrollConversationRef.current = conversationKey;
    }
    scrollTrackerRef.current?.refresh(true);
  }, [activeSessionId, appId, busy, messages, messagesReady]);

  useEffect(() => {
    const element = messagesElementRef.current;
    if (!element || !messagesReady) return;
    const tracker = createConversationScrollTracker(element, ({ viewportHeight, activeId, lastId, layoutChanged }) => {
      setAnchorViewportHeight(current => current === viewportHeight ? current : viewportHeight);
      if (shouldAutoScrollToLatest(followLatestMessageRef.current, layoutChanged)) element.scrollTop = element.scrollHeight;
      if (followLatestMessageRef.current) {
        setActiveAnchorId(current => current === lastId ? current : lastId);
        setShowScrollToLatest(false);
      } else {
        setShowScrollToLatest(shouldShowScrollToLatest(element.scrollHeight - element.scrollTop - element.clientHeight, messages.length));
        setActiveAnchorId(current => current === activeId ? current : activeId);
      }
    });
    scrollTrackerRef.current = tracker;
    return () => { tracker.stop(); if (scrollTrackerRef.current === tracker) scrollTrackerRef.current = null; };
  }, [activeSessionId, appId, messagesReady]);

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
        if (cachedAccounts === null) setAccountLoadState("error");
        setError(getErrorMessage(loadError));
        onProviderStatusChange("模型状态不可用");
      }
    });
    return () => { alive = false; };
  }, [appId, cachedAccounts, onProviderStatusChange, userId]);

  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (!busy) return;
    setActivityClock(Date.now());
    const timer = window.setInterval(() => setActivityClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  useEffect(() => {
    setMessages([]);
    setUsageByMessage({});
    setActiveAnchorId(null);
    setError("");
  }, [newSessionKey]);

  useEffect(() => {
    const conversationKey = `${appId}:${activeSessionId ?? "new-session"}`;
    if (busy) {
      preparedScrollConversationRef.current = conversationKey;
      setMessagesReady(true);
      return;
    }
    setError("");
    if (!activeSessionId) {
      preparedScrollConversationRef.current = conversationKey;
      setMessages([]);
      setActiveAnchorId(null);
      setMessagesReady(true);
      setLoading(false);
      return;
    }
    const cacheKey = aiMessageSnapshotKey(userId, appId, activeSessionId);
    const sessionSnapshot = aiMessageSnapshots.get(cacheKey);
    let alive = true;
    if (sessionSnapshot) {
      preparedScrollConversationRef.current = conversationKey;
      setMessages(sessionSnapshot);
      setLoading(false);
      setMessagesReady(true);
    } else {
      preparedScrollConversationRef.current = null;
      setLoading(true);
      setMessagesReady(false);
    }
    void loadAiMessages(activeSessionId).then((result) => {
      if (alive) {
        preparedScrollConversationRef.current = conversationKey;
        aiMessageSnapshots.set(cacheKey, result.messages);
        setMessages(result.messages);
        const running = result.messages.find(item => item.role === "assistant" && (item.status === "streaming" || item.status === "queued"));
        if (running && autoFollowAttempt.current !== running.id) { autoFollowAttempt.current = running.id; void sendMessage("", running.id); }
      }
    }).catch((loadError: unknown) => {
      if (alive) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (alive) {
        setLoading(false);
        setMessagesReady(true);
      }
    });
    return () => { alive = false; };
  }, [activeSessionId, appId, busy, userId]);

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
    const content = value.trim();
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
        setMessages(current => { const incoming = result.mode === "queue" ? [result.userMessage, result.run.message] : [result.userMessage]; return [...current.filter(item => !incoming.some(next => next.id === item.id)), ...incoming]; });
      } catch (error) { setError(getErrorMessage(error)); }
      return;
    }
    if (!activeAccount && !followRunId) {
      setError("请先到设置中心的“AI 与模型”添加并启用一个 Provider 账户。");
      return;
    }
    const requestSessionId = targetSession ? targetSession.session.id : activeSessionId;
    const requestProjectId = targetSession ? targetSession.session.projectId : selectedProjectId;
    const requestedPlanMode = sendOptions?.planMode ?? (planModeOverride?.sessionId === requestSessionId ? planModeOverride.active : undefined);
    const requestGeneration = ++runRequestGenerationRef.current;
    followLatestMessageRef.current = true;
    if (!followRunId) { setDraft(""); onDraftChange(""); }
    setError("");
    setBusy(true);
    sessionIdForTurn.current = requestSessionId;
    notifiedTurnEvents.current.clear();
    const controller = new AbortController();
    controllerRef.current = controller;
    let spokenContent = "";
    let followedExistingCompletion = false;
    let runMessageId: string | null = null;
    let runSessionId = requestSessionId;
    try {
      await streamAiChat({
        ...(followRunId ? { runId: followRunId } : {}),
        appId,
        sessionId: requestSessionId,
        ...(requestProjectId ? { projectId: requestProjectId } : {}),
        content,
        ...(requestedPlanMode === undefined ? {} : { planMode: requestedPlanMode }),
        signal: controller.signal,
        onSession: ({ session, userMessage, assistantMessage }) => {
          spokenContent = assistantMessage.content;
          followedExistingCompletion = assistantMessage.status === "complete";
          runMessageId = assistantMessage.id;
          runSessionId = session.id;
          activeRunRef.current = assistantMessage.id;
          autoFollowAttempt.current = assistantMessage.id;
          sessionIdForTurn.current = session.id;
          setPlanModeOverride({ sessionId: session.id, active: session.planMode });
          onActiveSessionChange(session.id);
          onSessionsChange([session, ...sessions.filter((item) => item.id !== session.id)]);
          setMessages((current) => {
            const starting = targetSession?.baseMessages ?? current;
            const incoming = [userMessage, assistantMessage];
            return [...starting.map(item => incoming.find(next => next.id === item.id) ?? item), ...incoming.filter(next => !starting.some(item => item.id === next.id))];
          });
          targetSession?.onStarted?.();
        },
        onPlanMode: active => setPlanModeOverride({ sessionId: runSessionId, active }),
        onInput: (message) => setMessages(current => [...current.filter(item => item.id !== message.id), message]),
        onActivity: ({ messageId, activity }) => {
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
          if (activity.status === "error") notifySessionIssue("AI Work 步骤未能完成，请打开会话查看活动详情。");
        },
        onDelta: ({ messageId, delta }) => { spokenContent += delta; setMessages((current) => current.map((item) => item.id === messageId ? { ...item, content: item.content + delta } : item)); },
        onUsage: ({ messageId, ...usage }) => {
          if (messageId) setUsageByMessage((current) => ({ ...current, [messageId]: usage }));
          else setUsageByMessage((current) => {
            const latestAssistant = [...messages].reverse().find((item) => item.role === "assistant");
            return latestAssistant ? { ...current, [latestAssistant.id]: usage } : current;
          });
        },
        onError: setError,
        onDone: (status) => {
          if (runMessageId) setMessages((current) => current.map((item) => item.id === runMessageId ? { ...item, status } : item));
          if (status === "error") notifySessionIssue("本轮 AI Work 回复未能完成，请打开会话查看错误详情。");
          if (status === "complete" && runSessionId) {
            if (settings.aiRuntime.readResponsesAloud && spokenContent && !followedExistingCompletion) { try { readResponseAloud(spokenContent, settings.general.language); } catch (error) { setError(getErrorMessage(error)); } }
            notifyAiWorkCompletion({
              notification: {
                appId,
                applicationName: applicationNameFor(appId),
                sessionId: runSessionId,
                kind: "complete",
                title: "回复已完成",
                body: `${applicationNameFor(appId)} 会话已完成回复，点击查看。`
              },
              policy: settings.general.completionNotification,
              sound: settings.general.notificationSound,
              onNotification
            });
          }
        }
      });
      const sessionResult = await loadAiSessions({ appId });
      onSessionsChange(sessionResult.sessions);
    } catch (sendError) {
      if (!(sendError instanceof DOMException && sendError.name === "AbortError")) {
        setError(getErrorMessage(sendError));
        notifySessionIssue("本轮 AI Work 回复发生错误，请打开会话查看详情。");
      }
      // 传输错误只代表订阅中断；服务端任务继续运行，不能在本地伪造已停止状态。
    } finally {
      if (requestGeneration === runRequestGenerationRef.current) {
        if (controllerRef.current === controller) controllerRef.current = null;
        setBusy(false);
      }
    }
  }

  function toggleVoiceInput(): void {
    if (listening) { stopListening.current?.(); stopListening.current = null; setListening(false); return; }
    try {
      stopVoicePlayback(); setListening(true);
      stopListening.current = startVoiceInput(settings.general.language, text => { const next = `${draftRef.current}${draftRef.current ? "\n" : ""}${text}`.slice(0, 12000); setDraft(next); onDraftChange(next); }, setError, () => { setListening(false); stopListening.current = null; });
    } catch (error) { setListening(false); setError(getErrorMessage(error)); }
  }

  function notifySessionAction(key: string, kind: "approval" | "question" | "issue", title: string, body: string): void {
    const sessionId = sessionIdForTurn.current;
    if (!sessionId || notifiedTurnEvents.current.has(key)) return;
    notifiedTurnEvents.current.add(key);
    notifyAiWorkAction({
      notification: { appId, applicationName: applicationNameFor(appId), sessionId, kind, title, body },
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
      const result = await answerAiRunQuestion(question.runId, question.activity.questionId!, answer, skipped);
      setMessages(current => [...current.filter(item => item.id !== result.userMessage.id), result.userMessage]);
      setQuestionReply("");
    } catch (answerError) {
      setError(`回答未能提交：${getErrorMessage(answerError)}`);
    } finally {
      setInteractionBusy(false);
    }
  }

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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

  async function selectModel(modelId: string): Promise<void> {
    if (!activeAccount || activeAccount.modelId === modelId || modelBusy || busy) return;
    setModelBusy(true);
    setError("");
    try {
      const result = await updateAiAccountModel(activeAccount.id, modelId);
      setAccounts((current) => current.map((account) => account.id === result.account.id ? result.account : account));
      onProviderStatusChange(`${result.account.displayName} · ${result.account.modelId}`);
      setModelPickerOpen(false);
      setModelSearch("");
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
      setAccounts((current) => current.map((account) => account.id === result.account.id ? result.account : account));
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
      await navigator.clipboard.writeText(item.content);
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
        ({ session } = await forkAiSessionFromMessageInWorktree(activeSessionId, branchTargetMessageId, result.project.id, appId as WorkspaceProjectApplicationId));
      } else {
        ({ session } = await forkAiSessionFromMessage(activeSessionId, branchTargetMessageId));
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

  function selectRuntimeSpeed(speed: UserSettings["aiRuntime"]["speed"]): void {
    if (speed === settings.aiRuntime.speed || toolbarBusy) return;
    void saveToolbarSetting("aiRuntime", { ...settings.aiRuntime, speed });
  }

  const jumpToConversationAnchor = useCallback((messageId: string): void => {
    const container = messagesElementRef.current;
    if (!container) return;
    const anchorElement = Array.from(container.querySelectorAll<HTMLElement>("[data-ai-anchor-id]")).find((element) => element.dataset.aiAnchorId === messageId);
    if (!anchorElement) return;

    followLatestMessageRef.current = false;
    const targetTop = anchorElement.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16;
    const reducedMotion = settings.appearance.advanced.reducedMotion === "on"
      || settings.appearance.advanced.reducedMotion === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) container.scrollTop = Math.max(0, targetTop);
    else container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    setActiveAnchorId(messageId);
  }, [settings.appearance.advanced.reducedMotion]);

  const conversationAnchors = useMemo(() => buildConversationAnchors(messages), [messages]);
  const hasQueuedRuns = useMemo(() => messages.some(message => message.role === "assistant" && message.status === "queued"), [messages]);
  const conversationAnchorLayout = useMemo(
    () => buildConversationAnchorLayout(conversationAnchors.length, anchorViewportHeight),
    [conversationAnchors.length, anchorViewportHeight]
  );
  const selectedReasoningIndex = reasoningDraftIndex ?? activeReasoningIndex;
  const visibleReasoningLabel = reasoningDraftIndex === null
    ? activeReasoningLabel
    : activeReasoningLevels[reasoningDraftIndex]?.label ?? activeReasoningLabel;
  const officialDefaultIndex = activeReasoningLevels.findIndex((option) => option.value === providerDefaultReasoningMode);
  const modelPickerContent = (
    <div className="ai-work-chat__model-card" role="dialog" aria-label="模型与推理设置" onKeyDown={(event) => { if (event.key === "Escape") setModelPickerOpen(false); }}>
      <header className="ai-work-chat__model-card-header">
        <span className="ai-work-chat__model-card-eyebrow">{activeAccount?.displayName ?? "AI 模型"} · {activeAccount?.providerId ?? "未配置"}</span>
        <strong>{activeModel?.name ?? activeAccount?.modelId ?? "选择模型"}</strong>
        {activeModel?.name !== activeModel?.id && activeModel?.id ? <span className="ai-work-chat__model-card-id">{activeModel.id}</span> : null}
        <span className="ai-work-chat__model-card-meta">{modelParameterSummary(activeModel)}</span>
      </header>

      <section className="ai-work-chat__model-card-section" aria-label="思考力度设置">
        <div className="ai-work-chat__model-card-section-heading">
          <div><strong>{activeModel?.thinking?.kind === "toggle" ? "思考模式" : "思考力度"}</strong><span>与设置中心共用账户配置</span></div>
          <strong className="ai-work-chat__model-card-value">{modelBusy ? "保存中…" : visibleReasoningLabel}</strong>
        </div>
        {activeReasoningLevels.length > 1 && activeModel?.thinking?.kind === "effort" ? <>
          <input
            className={`ai-work-chat__model-range${selectedReasoningIndex < 0 ? " is-default" : ""}`}
            type="range"
            min={0}
            max={activeReasoningLevels.length - 1}
            step={1}
            value={selectedReasoningIndex >= 0 ? selectedReasoningIndex : officialDefaultIndex >= 0 ? officialDefaultIndex : 0}
            aria-label="模型思考力度"
            aria-valuetext={visibleReasoningLabel}
            disabled={modelBusy || busy}
            onChange={(event) => setReasoningDraftIndex(Number(event.currentTarget.value))}
            onPointerUp={(event) => {
              const option = activeReasoningLevels[Number(event.currentTarget.value)];
              if (option) void selectReasoningMode(option.value);
            }}
            onKeyUp={(event) => {
              if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) return;
              const option = activeReasoningLevels[Number(event.currentTarget.value)];
              if (option) void selectReasoningMode(option.value);
            }}
          />
          <div className="ai-work-chat__model-card-levels">
            {activeReasoningLevels.map((option) => <button
              key={option.value}
              type="button"
              aria-pressed={selectedReasoningIndex >= 0 && activeReasoningLevels[selectedReasoningIndex]?.value === option.value}
              disabled={modelBusy || busy}
              onClick={() => void selectReasoningMode(option.value)}
            >{option.label}</button>)}
          </div>
        </> : activeReasoningLevels.length ? <div className="ai-work-chat__model-card-single-level">
          {activeReasoningLevels.map((option) => <button
            key={option.value}
            type="button"
            aria-pressed={activeReasoningMode === option.value}
            disabled={modelBusy || busy}
            onClick={() => void selectReasoningMode(option.value)}
          >{option.label}</button>)}
        </div> : activeModel?.thinking?.kind === "fixed"
          ? <p className="ai-work-chat__model-card-note">{fixedThinkingLabel(activeModel)}</p>
          : <p className="ai-work-chat__model-card-note">模型目录没有返回可验证的思考力度选项，请求不会添加思考参数。</p>}
        {activeReasoningLevels.length ? <div className="ai-work-chat__model-card-reset">
          <span>{activeModel?.thinking?.kind === "effort" && activeModel.thinking.defaultValue
            ? `默认档位：${reasoningModeLabel(activeModel.thinking.defaultValue)}`
            : "恢复后由 Provider 使用自己的默认行为"}</span>
          <button type="button" disabled={modelBusy || busy || activeAccount?.reasoningMode === "default"} onClick={() => void selectReasoningMode("default")}>恢复默认</button>
        </div> : null}
      </section>

      <section className="ai-work-chat__model-card-section ai-work-chat__model-card-section--output" aria-label="输出长度策略">
        <div className="ai-work-chat__model-card-section-heading"><div><strong>输出长度策略</strong><span>控制回复长度，不改变模型思考力度</span></div></div>
        <div className="ai-work-chat__model-card-speed" role="group" aria-label="输出长度策略">
          {runtimeSpeedOptions.map((option) => <button
            key={option.value}
            type="button"
            aria-pressed={settings.aiRuntime.speed === option.value}
            disabled={toolbarBusy === "aiRuntime" || busy}
            onClick={() => selectRuntimeSpeed(option.value)}
          ><strong>{option.label}</strong><span>{option.description}</span></button>)}
        </div>
      </section>

      <section className="ai-work-chat__model-card-section ai-work-chat__model-card-section--catalog" aria-label="选择模型">
        <div className="ai-work-chat__model-card-section-heading"><div><strong>切换模型</strong><span>{activeAccount?.models.length ?? 0} 个目录模型</span></div></div>
        <Input
          size="small"
          allowClear
          value={modelSearch}
          aria-label="搜索模型名称或 ID"
          placeholder="搜索模型名称或 ID"
          onChange={(event) => setModelSearch(event.target.value)}
        />
        <div className="ai-work-chat__model-card-models" role="group" aria-label="模型目录">
          {visibleModels.map((model) => <button
            key={model.id}
            type="button"
            className={model.id === activeAccount?.modelId ? "is-selected" : ""}
            aria-pressed={model.id === activeAccount?.modelId}
            disabled={modelBusy || busy}
            onClick={() => model.id === activeAccount?.modelId ? setModelPickerOpen(false) : void selectModel(model.id)}
          ><span><strong>{model.name}</strong><small>{model.id}</small></span>{model.id === activeAccount?.modelId ? <span aria-hidden="true">✓</span> : null}</button>)}
          {!visibleModels.length ? <span className="ai-work-chat__model-card-empty">没有匹配的模型</span> : null}
        </div>
        {matchingModels.length > visibleModels.length ? <span className="ai-work-chat__model-card-limit">显示前 {MODEL_PICKER_RESULT_LIMIT} 个匹配结果，请继续输入以缩小范围。</span> : null}
      </section>
    </div>
  );

  return (
    <section ref={setOutputFocusRegionElement} className={`ai-work-chat ai-work-chat--${appId}`} data-output-idle="false" aria-label="AI Work 会话">
      {permissionModalContext}
      <div className="ai-work-chat__conversation">
        <div className="ai-work-chat__alerts">
          {accountLoadState === "ready" && !activeAccount ? <Alert type="warning" showIcon message="尚未配置活动 Provider" description="先在 AI 与模型中添加并启用一个 Provider 账户。" action={<Button size="small" onClick={() => onOpenSettings("ai")}>打开 AI 与模型</Button>} /> : null}
          {error ? <Alert type="error" showIcon closable message={error} onClose={() => setError("")} /> : null}
          {messageActionError ? <Alert type="error" showIcon closable message={messageActionError} onClose={() => setMessageActionError("")} /> : null}
          {!busy && messages.some(item => item.role === "assistant" && (item.status === "streaming" || item.status === "queued")) ? <Button onClick={() => { const run = messages.find(item => item.role === "assistant" && (item.status === "streaming" || item.status === "queued")); if (run) void sendMessage("", run.id); }}>恢复任务跟随</Button> : null}
        </div>
        <div className="ai-work-chat__message-stage">
          {conversationAnchors.length ? <ConversationAnchorRail
            anchors={conversationAnchors}
            layout={conversationAnchorLayout}
            activeAnchorId={activeAnchorId}
            onJump={jumpToConversationAnchor}
          /> : null}
          <div ref={setMessagesElement} onScroll={handleMessagesScroll} onWheel={handleMessagesWheel} onPointerDown={handleMessagesPointerDown} onPointerUp={handleMessagesPointerUp} onPointerCancel={handleMessagesPointerUp} className="ai-work-chat__messages" aria-live="polite">
            <div className="ai-work-chat__message-list">
              {loading ? <Spin /> : messages.length ? messages.map((item, messageIndex) => {
            const usage = usageByMessage[item.id];
            const activitySummary = getAiActivitySummary(item, activityClock);
            const runningActivity = activitySummary.activeActivity;
            const pairedAssistant = item.role === "user" ? messages[messageIndex + 1] : undefined;
            const isEditingMessage = editingMessage?.messageId === item.id;
            const canEditMessage = item.role === "user" && pairedAssistant?.role === "assistant" && pairedAssistant.status !== "queued"
              && (!busy || pairedAssistant.status === "streaming" && activeRunRef.current === pairedAssistant.id)
              && !branchBusy && !hasQueuedRuns
              && (!editingMessage || isEditingMessage);
            return <article className={`ai-work-chat__message ai-work-chat__message--${item.role}`} key={item.id} data-ai-anchor-id={item.role === "user" ? item.id : undefined}>
              {item.status === "queued" || item.status === "streaming" || item.status === "error" || item.status === "interrupted" ? <div className="ai-work-chat__message-meta">{item.status === "queued" ? <Tag>排队中</Tag> : item.status === "streaming" ? <Tag color={activitySummary.isProcessing ? "processing" : undefined}>{activitySummary.messageLabel}</Tag> : item.status === "error" ? <Tag color="error">失败</Tag> : <Tag>已停止</Tag>}</div> : null}
              <div className={`ai-work-chat__message-content${activitySummary.isProcessing ? " ai-work-chat__message-content--streaming" : ""}`}>
                {item.role === "user" && isEditingMessage ? <div className="ai-work-chat__message-edit">
                  <Input.TextArea
                    autoSize={{ minRows: 2, maxRows: 8 }}
                    maxLength={12_000}
                    aria-label="编辑已发送的问题"
                    value={editingMessage.content}
                    disabled={editingMessage.phase === "sending"}
                    onChange={event => setEditingMessage(current => current?.messageId === item.id ? { ...current, content: event.target.value } : current)}
                  />
                  <div className="ai-work-chat__message-edit-actions">
                    <small>{editingMessage.content.length}/12000</small>
                    {editingMessage.phase === "stopping" ? <span role="status">正在停止当前回复…</span> : null}
                    <Button size="small" disabled={editingMessage.phase === "sending"} onClick={cancelMessageEditing}>取消</Button>
                    <Button size="small" type="primary" loading={editingMessage.phase === "sending"} disabled={editingMessage.phase !== "ready" || !editingMessage.content.trim()} onClick={() => void submitEditedMessage()}>发送</Button>
                  </div>
                </div> : item.role === "assistant" ? item.content ? <AiMarkdown content={item.content} /> : activitySummary.isProcessing ? <span className="ai-work-chat__thinking" role="status" aria-label="AI 正在思考"><i /><i /><i /></span> : "" : item.content}
              </div>
              {item.role === "assistant" && item.activity.length ? <details className={`ai-work-chat__activity ai-work-chat__activity--${activitySummary.tone}`}>
                <summary aria-label={`查看工作轨迹：${activitySummary.label}，${activitySummary.durationText}`}>
                  <span className="ai-work-chat__activity-summary-main"><WorkbenchIcon name={activitySummary.tone === "waiting" ? "shield" : activitySummary.tone === "error" ? "close" : activitySummary.tone === "stopped" ? "close" : activitySummary.tone === "complete" ? "review" : "spark"} size={14} /><strong>{activitySummary.label}</strong><span>{activitySummary.durationText}</span></span>
                  <span className="ai-work-chat__activity-summary-state">{runningActivity?.title ?? `本轮共 ${item.activity.length} 个步骤`}</span>
                  <WorkbenchIcon name="chevron" size={14} />
                </summary>
                <div className="ai-work-chat__activity-list">
                  {item.activity.map((activity) => <div className={`ai-work-chat__activity-row ai-work-chat__activity-row--${activity.status}`} key={activity.id}>
                    <WorkbenchIcon name={activity.status === "running" ? "spark" : activity.status === "approval_required" ? "shield" : activity.status === "waiting_input" || activity.status === "unavailable" ? "help" : activity.status === "error" ? "close" : "review"} size={14} />
                    <div className="ai-work-chat__activity-copy">
                      <div className="ai-work-chat__activity-heading"><strong>{activity.title}</strong><span className={`ai-work-chat__activity-status ai-work-chat__activity-status--${activity.status}`}>{getAiActivityDisplayStatus(activity)}</span><span className="ai-work-chat__activity-duration">{formatAiActivityDuration(getAiActivityDurationSeconds(activity, activityClock))}</span></div>
                      {activity.detail ? <span className="ai-work-chat__activity-detail">{activity.detail}</span> : null}
                      {appId === "writing" && activity.writingProposalId ? <Button className="ai-work-chat__writing-review-trigger" type="link" size="small" disabled={writingProposalLoading || writingProposalBusy} onClick={() => void openWritingProposal(activity.writingProposalId!)}>审阅修改</Button> : null}
                    </div>
                  </div>)}
                </div>
              </details> : null}
              {item.role === "assistant" && settings.aiRuntime.showContextUsage && usage ? <small className="ai-work-chat__usage">{`${usage.promptTokens ?? "?"} 输入 · ${usage.completionTokens ?? "?"} 输出 tokens · ${usage.providerId} / ${usage.modelId}`}</small> : null}
              {item.role === "user" && item.content && !isEditingMessage ? <div className="ai-work-chat__message-actions ai-work-chat__message-actions--user">
                <Tooltip title={copiedMessageId === item.id ? "已复制完整提问" : "复制消息"}>
                  <Button className="ai-work-chat__message-action" type="text" size="small" aria-label={copiedMessageId === item.id ? "已复制完整提问" : "复制完整提问"} icon={<WorkbenchIcon name={copiedMessageId === item.id ? "check" : "copy"} size={15} />} onClick={() => void copyMessage(item)} />
                </Tooltip>
                {pairedAssistant?.role === "assistant" ? <Tooltip title="编辑并重新发送">
                  <Button className="ai-work-chat__message-action" type="text" size="small" aria-label="编辑并重新发送问题" disabled={!canEditMessage} icon={<WorkbenchIcon name="new" size={15} />} onClick={() => void editUserMessage(item, pairedAssistant)} />
                </Tooltip> : null}
                <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time>
              </div> : null}
              {item.role === "assistant" && item.status === "complete" && item.content ? <div className="ai-work-chat__message-actions ai-work-chat__message-actions--assistant">
                <Tooltip title={copiedMessageId === item.id ? "已复制完整回复" : "复制回复"}>
                  <Button className="ai-work-chat__message-action" type="text" size="small" aria-label={copiedMessageId === item.id ? "已复制完整回复" : "复制完整回复"} icon={<WorkbenchIcon name={copiedMessageId === item.id ? "check" : "copy"} size={15} />} onClick={() => void copyMessage(item)} />
                </Tooltip>
                {item.feedback ? <span className={`ai-work-chat__feedback-status ai-work-chat__feedback-status--${item.feedback.rating}`} aria-label={item.feedback.rating === "positive" ? "已提交正向反馈" : "已提交改进反馈"} title={item.feedback.detail || item.feedback.reasons.join("、") || "已提交反馈"}><WorkbenchIcon name={item.feedback.rating === "positive" ? "thumbUp" : "thumbDown"} size={15} /><span>已反馈</span></span> : <>
                  <Tooltip title="回答有帮助">
                    <Button className="ai-work-chat__message-action" type="text" size="small" aria-label="评价回复：有帮助" disabled={feedbackBusy} icon={<WorkbenchIcon name="thumbUp" size={15} />} onClick={() => openMessageFeedback(item.id, "positive")} />
                  </Tooltip>
                  <Tooltip title="回答需要改进">
                    <Button className="ai-work-chat__message-action" type="text" size="small" aria-label="评价回复：需要改进" disabled={feedbackBusy} icon={<WorkbenchIcon name="thumbDown" size={15} />} onClick={() => openMessageFeedback(item.id, "negative")} />
                  </Tooltip>
                </>}
                <Tooltip title="分支到新聊天">
                  <Button className="ai-work-chat__message-action" type="text" size="small" aria-label="从此回复分支到新聊天" disabled={branchBusy} icon={<WorkbenchIcon name="branch" size={15} />} onClick={() => { setMessageActionError(""); setBranchTargetMessageId(item.id); }} />
                </Tooltip>
                <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time>
              </div> : null}
            </article>;
            }) : <div className={`ai-work-chat__welcome${appId === "writing" ? " ai-work-chat__welcome--writing" : ""}`}>
            {appId === "writing" ? <>
              <span className="ai-work-chat__welcome-mark" aria-hidden="true"><WorkbenchIcon name="spark" size={22} /></span>
              <div className="ai-work-chat__welcome-copy"><h1>从一个创作目标开始</h1><p>梳理故事设定、人物动机与章节节奏，也可以直接贴一段文字来讨论。</p></div>
              </> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span>{appId === "workspace" ? "告诉 LFAA 你的任务目标" : `开始与 ${appId === "steamcmd" ? "SteamCMD 开服顾问" : "Minecraft 开服顾问"} 对话`}</span>} />}
            {settings.aiRuntime.promptSuggestions ? <div className={`ai-work-chat__suggestions${appId === "writing" ? " ai-work-chat__suggestions--writing" : ""}`}>{suggestions[appId].map((suggestion) => <button type="button" key={suggestion} disabled={!activeAccount || busy} onClick={() => void sendMessage(suggestion)}>{suggestion}</button>)}</div> : null}
            <Typography.Text type="secondary">{getPermissionModeHint(appId, settings.permissions.mode)}</Typography.Text>
              </div>}
            </div>
          </div>
          {showScrollToLatest ? <Button className="ai-work-chat__scroll-latest" type="default" onClick={() => scrollToLatest(true)} aria-label="回到底部查看最新回复"><WorkbenchIcon name="chevron" size={16} /><span>{busy ? "有新内容 · 回到底部" : "回到底部"}</span></Button> : null}
        </div>
        {pendingInteraction ? <section className={`ai-work-chat__interaction-dock ai-work-chat__interaction-dock--${pendingInteraction.kind}`} aria-label={pendingInteraction.kind === "approval" ? "待处理审批" : "待回答问题"}>
          <div className="ai-work-chat__interaction-dock-heading">
            <span className="ai-work-chat__interaction-dock-icon"><WorkbenchIcon name={pendingInteraction.kind === "approval" ? "shield" : "help"} size={15} /></span>
            <strong>{pendingInteraction.kind === "approval" ? "需要审批" : "问题"}</strong>
            <span>{pendingInteraction.kind === "approval" ? "批准仅作用于这一次操作" : "选择一个选项，或补充你的答案"}</span>
          </div>
          {pendingInteraction.kind === "approval" ? <>
            <p className="ai-work-chat__interaction-dock-question">{pendingInteraction.activity.detail}</p>
            <div className="ai-work-chat__interaction-dock-actions">
              <Button type="primary" disabled={interactionBusy} loading={interactionBusy} onClick={() => void resolvePendingApproval("approved")}>批准本次操作</Button>
              <Button danger disabled={interactionBusy} onClick={() => void resolvePendingApproval("denied")}>拒绝</Button>
            </div>
          </> : <>
            <p className="ai-work-chat__interaction-dock-question">{pendingInteraction.activity.question}</p>
            <div className="ai-work-chat__interaction-dock-options" role="group" aria-label="选择回答">
              {pendingInteraction.activity.options!.map((option, index) => <button className="ai-work-chat__interaction-option" type="button" key={`${pendingInteraction.activity.questionId}-${index}`} disabled={interactionBusy} onClick={() => void submitPendingQuestion(option)}>
                <span className="ai-work-chat__interaction-option-number">{index + 1}</span><span>{option}</span><WorkbenchIcon name="chevron" size={14} />
              </button>)}
            </div>
            <div className="ai-work-chat__interaction-dock-reply">
              <Input aria-label="补充回答" value={questionReply} maxLength={12000} placeholder="或自行填写补充回答" disabled={interactionBusy} onChange={(event) => setQuestionReply(event.target.value)} onPressEnter={() => void submitPendingQuestion(questionReply)} />
              <Button type="text" disabled={interactionBusy} onClick={() => void submitPendingQuestion("", true)}>跳过</Button>
              <Button type="primary" disabled={interactionBusy || !questionReply.trim()} loading={interactionBusy} onClick={() => void submitPendingQuestion(questionReply)}>发送</Button>
            </div>
          </>}
        </section> : null}
        {planModeActive ? <section className="ai-work-chat__plan-mode" aria-label="计划讨论模式" aria-live="polite">
          <span className="ai-work-chat__plan-mode-icon"><WorkbenchIcon name="spark" size={15} /></span>
          <div className="ai-work-chat__plan-mode-copy"><strong>计划讨论中</strong><span>当前只允许只读查询；确认计划后才会执行写入操作。</span></div>
          <div className="ai-work-chat__plan-mode-actions">
            <Button size="small" disabled={busy || planModeBusy} loading={planModeBusy} onClick={() => void changePlanMode(false)}>退出计划</Button>
            {messages.some(item => item.role === "assistant" && item.status === "complete" && item.content.trim()) ? <Button size="small" type="primary" disabled={busy || planModeBusy} onClick={() => void sendMessage("我已批准目前讨论的计划，请按计划开始执行。", undefined, undefined, { planMode: false })}>批准并执行</Button> : null}
          </div>
        </section> : null}
        <form className="ai-work-chat__composer" aria-label="AI Work 消息输入" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
          <div className="ai-work-chat__composer-context" aria-label="当前对话上下文">
            {appId === "workspace" || appId === "minecraft" ? <WorkspaceProjectPicker appId={appId} applicationName={applicationNameFor(appId)} projects={workspaceProjects} projectListTruncated={workspaceProjectsTruncated} projectLoadError={workspaceProjectsError} onRetryProjects={onRetryWorkspaceProjects} nodes={workspaceNodes} value={selectedProjectId} selectedProjectTitle={activeSessionId ? sessions.find(session => session.id === activeSessionId)?.projectTitle : null} defaultDirectory={settings.general.taskFolder} disabled={busy || projectBusy || Boolean(editingMessage)} onChange={project => void changeWorkspaceProject(project)} onProjectsChange={onWorkspaceProjectsChange} /> : null}
            <span className="ai-work-chat__composer-app"><WorkbenchIcon name="folder" size={13} />{applicationNameFor(appId)}</span>
            <Typography.Text className="ai-work-chat__composer-count" aria-label={`已输入 ${draft.length}，最多 12000 个字符`}>{draft.length}<span>/12000</span></Typography.Text>
          </div>
          <Input.TextArea
            aria-label="输入 AI Work 消息"
            value={draft}
            onChange={(event) => {
              const value = event.target.value;
              setDraft(value);
              onDraftChange(value);
            }}
            onKeyDown={handleComposerKeyDown}
            placeholder={pendingInteraction?.kind === "question" ? "请先回答上方问题，或选择跳过…" : busy ? settings.general.followupBehavior === "queue" ? "发送跟进，当前任务完成后继续处理…" : "发送约束，引导当前任务的下一步…" : "向 LFAA AI 提问…"}
            autoSize={{ minRows: 2, maxRows: 7 }}
            maxLength={12000}
            disabled={projectBusy || Boolean(editingMessage) || pendingInteraction?.kind === "question" || !activeAccount && !busy}
          />
          <div className="ai-work-chat__composer-actions">
            <div className="ai-work-chat__composer-actions-group" aria-label="添加与权限">
              <Dropdown
                trigger={["click"]}
                placement="topLeft"
                menu={{ items: [{ key: "attachment-unavailable", label: "文件和文件夹 · 暂未接入", disabled: true }] }}
              >
                <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--icon" type="text" aria-label="添加附件；当前未接入" title="文件和文件夹附件尚未接入 AI Work 会话" icon={<WorkbenchIcon name="plus" size={18} />} />
              </Dropdown>
              <Dropdown
                trigger={["click"]}
                placement="topLeft"
                overlayClassName="ai-work-chat__permission-overlay"
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
                <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--permission" type="text" aria-label={`LFAA 权限模式：${permissionModeLabels[settings.permissions.mode]}`} title="切换 LFAA 项目权限模式" disabled={toolbarBusy === "permissions"}>
                  <WorkbenchIcon name="shield" size={15} />
                  <span className="ai-work-chat__composer-control-label">{permissionModeLabels[settings.permissions.mode]}</span>
                  <WorkbenchIcon name="chevron" size={12} />
                </Button>
              </Dropdown>
            </div>
            <div className="ai-work-chat__composer-actions-group ai-work-chat__composer-actions-group--right" aria-label="模型、推理与发送">
              <Popover
                trigger="click"
                placement="topRight"
                arrow={false}
                overlayClassName="ai-work-chat__model-overlay"
                getPopupContainer={(trigger) => trigger.closest<HTMLElement>(".workbench-shell") ?? trigger.parentElement ?? document.body}
                open={modelPickerOpen}
                onOpenChange={(open) => {
                  setModelPickerOpen(open);
                  if (!open) {
                    setModelSearch("");
                    setReasoningDraftIndex(null);
                  }
                }}
                content={modelPickerContent}
              >
                <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--model" type="text" aria-haspopup="dialog" aria-expanded={modelPickerOpen} aria-label={`模型：${activeAccount?.modelId ?? (accountLoadState === "loading" ? "读取中" : accountLoadState === "error" ? "状态不可用" : "未配置")}`} title={activeAccount ? `${activeAccount.displayName} · ${activeAccount.modelId}` : accountLoadState === "loading" ? "正在读取活动模型" : accountLoadState === "error" ? "模型状态不可用，请查看错误提示" : "请先在设置中心配置活动模型"} disabled={!activeAccount || !activeAccount.models.length || modelBusy || busy}>
                  <WorkbenchIcon name="spark" size={14} />
                  <span className="ai-work-chat__composer-control-label">{modelBusy ? "保存中…" : activeModel?.name ?? activeAccount?.modelId ?? (accountLoadState === "loading" ? "模型" : accountLoadState === "error" ? "不可用" : "模型未配置")}</span>
                  <WorkbenchIcon name="chevron" size={12} />
                </Button>
              </Popover>
              <Tooltip title={!settings.aiRuntime.voiceInputEnabled ? "请在设置中心的语音页面开启语音输入" : !supportsVoiceInput() ? "当前宿主不支持语音识别" : listening ? "停止语音输入" : "语音输入，识别后由你发送"}>
                <span className="ai-work-chat__composer-disabled-wrap">
                  <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--icon" type="text" aria-label={listening ? "停止语音输入" : "语音输入"} aria-pressed={listening} disabled={Boolean(editingMessage) || !settings.aiRuntime.voiceInputEnabled || !supportsVoiceInput()} onClick={toggleVoiceInput} icon={<WorkbenchIcon name="microphone" size={17} />} />
                </span>
              </Tooltip>
            {busy && draft.trim() ? <Button htmlType="submit" disabled={Boolean(editingMessage) || !activeRunRef.current}>{settings.general.followupBehavior === "queue" ? "发送跟进" : "引导任务"}</Button> : null}
            {settings.aiRuntime.readResponsesAloud ? <Button type="text" onClick={stopVoicePlayback}>停止播报</Button> : null}
            {busy
                ? <Button className="ai-work-chat__composer-submit ai-work-chat__composer-submit--stop" type="primary" shape="circle" aria-label="停止生成" title="停止生成" disabled={Boolean(editingMessage)} icon={<span className="ai-work-chat__composer-stop-icon" aria-hidden="true" />} onClick={() => { const runId = activeRunRef.current; if (runId) void cancelAiRun(runId).catch(error => setError(getErrorMessage(error))); }} />
                : <Button className="ai-work-chat__composer-submit" type="primary" shape="circle" htmlType="submit" aria-label="发送消息" title={settings.general.sendShortcut === "enter" ? "发送消息 · Enter" : "发送消息 · Ctrl+Enter"} icon={<WorkbenchIcon name="spark" size={15} />} disabled={!draft.trim() || !activeAccount} />}
            </div>
          </div>
        </form>
        <Modal
          className="ai-work-chat__writing-review-modal"
          open={appId === "writing" && writingProposalId !== null}
          title={writingProposal ? `${writingProposal.bookTitle} · ${writingProposal.targetTitle}` : "审阅 AI 修改提案"}
          width={1080}
          getContainer={() => document.querySelector<HTMLElement>(".workbench-shell") ?? document.body}
          closable={!writingProposalBusy}
          maskClosable={!writingProposalBusy}
          keyboard={!writingProposalBusy}
          onCancel={() => {
            if (writingProposalBusy) return;
            writingProposalLoadSequence.current += 1;
            setWritingProposalId(null);
            setWritingProposal(null);
            setWritingProposalError("");
            setWritingProposalLoading(false);
          }}
          footer={writingProposal?.status === "pending" && writingProposal.baseContent !== null && writingProposal.proposedContent !== null ? <div className="ai-work-chat__writing-review-footer">
            <Button danger disabled={writingProposalBusy || writingProposalLoading} loading={writingProposalBusy} onClick={() => void resolveWritingProposal("reject")}>拒绝提案</Button>
            <Button type="primary" disabled={writingProposalBusy || writingProposalLoading} loading={writingProposalBusy} onClick={() => void resolveWritingProposal("apply")}>确认并应用</Button>
          </div> : <Button onClick={() => {
            if (writingProposalBusy) return;
            writingProposalLoadSequence.current += 1;
            setWritingProposalId(null);
            setWritingProposal(null);
            setWritingProposalError("");
            setWritingProposalLoading(false);
          }}>关闭</Button>}
        >
          {writingProposalError ? <Alert className="ai-work-chat__writing-review-error" type="error" showIcon message={writingProposalError} /> : null}
          {writingProposalLoading ? <div className="ai-work-chat__writing-review-loading"><Spin tip="读取提案正文…" /></div> : writingProposal ? <div className="ai-work-chat__writing-review-body">
            <div className="ai-work-chat__writing-review-meta">
              <span>作品：{writingProposal.bookTitle}</span>
              <span>目标：{writingProposal.targetTitle}</span>
              <span>操作：{{ append: "追加", prepend: "前置", insert_before: "锚点前插入", insert_after: "锚点后插入", replace_anchor: "锚点替换", replace: "整体替换" }[writingProposal.operation]}</span>
              <span>状态：{{ pending: "待审阅", applied: "已应用", rejected: "已拒绝", stale: "原文已变化", superseded: "已被新提案替代", expired: "已过期" }[writingProposal.status]}</span>
            </div>
            {writingProposal.status === "pending" && writingProposal.baseContent !== null && writingProposal.proposedContent !== null ? <div className="ai-work-chat__writing-review-columns">
              <section aria-label="修改前正文"><h3>当前正文</h3><Input.TextArea className="ai-work-chat__writing-review-text" value={writingProposal.baseContent} readOnly aria-label="当前正文，只读" /></section>
              <section aria-label="提案正文"><h3>提案正文</h3><Input.TextArea className="ai-work-chat__writing-review-text" value={writingProposal.proposedContent} readOnly aria-label="提案正文，只读" /></section>
            </div> : writingProposal.status === "stale" ? <Alert type="warning" showIcon message="目标正文已在提案生成后发生变化。为保护新内容，此提案不能应用。" />
              : writingProposal.status === "expired" ? <Alert type="warning" showIcon message="提案已超过 24 小时有效期，不能应用。" />
                : writingProposal.status === "superseded" ? <Alert type="info" showIcon message="同一目标已有更新的待审提案，这份提案已失效。" />
                  : writingProposal.status === "rejected" ? <Alert type="info" showIcon message="这份提案已被拒绝，作品正文没有因拒绝而修改。" />
                    : writingProposal.status === "applied" ? <Alert type="success" showIcon message="这份提案已应用到作品正文。" />
                      : <Alert type="warning" showIcon message="提案正文暂不可用，无法应用。" />}
          </div> : null}
        </Modal>
        <Modal
          className="ai-work-chat__feedback-modal"
          open={feedbackTarget !== null}
          title="提交反馈"
          width={760}
          getContainer={() => outputFocusRegionElementRef.current?.closest<HTMLElement>(".workbench-shell") ?? outputFocusRegionElementRef.current ?? document.body}
          closable={!feedbackBusy}
          maskClosable={!feedbackBusy}
          keyboard={!feedbackBusy}
          onCancel={() => {
            if (feedbackBusy) return;
            setFeedbackTarget(null);
            setFeedbackReasons([]);
            setFeedbackDetail("");
            setMessageActionError("");
          }}
          footer={<div className="ai-work-chat__feedback-footer">
            <Button disabled={feedbackBusy} onClick={() => {
              setFeedbackTarget(null);
              setFeedbackReasons([]);
              setFeedbackDetail("");
              setMessageActionError("");
            }}>取消</Button>
            <Button type="primary" loading={feedbackBusy} disabled={!feedbackReasons.length && !feedbackDetail.trim()} onClick={() => void submitMessageFeedback()}>提交</Button>
          </div>}
        >
          {messageActionError ? <Alert className="ai-work-chat__feedback-error" type="error" showIcon message={messageActionError} /> : null}
          <p className="ai-work-chat__feedback-prompt">{feedbackTarget?.rating === "positive" ? "这条回复哪些方面做得好？" : "这条回复哪些方面需要改进？"}</p>
          <div className="ai-work-chat__feedback-reasons" role="group" aria-label="选择反馈原因">
            {feedbackTarget ? aiMessageFeedbackReasons[feedbackTarget.rating].map(reason => <button
              key={reason}
              type="button"
              aria-pressed={feedbackReasons.includes(reason)}
              className={feedbackReasons.includes(reason) ? "is-selected" : ""}
              disabled={feedbackBusy}
              onClick={() => toggleFeedbackReason(reason)}
            ><span aria-hidden="true">+</span>{reason}</button>) : null}
          </div>
          <Input.TextArea
            className="ai-work-chat__feedback-detail"
            value={feedbackDetail}
            maxLength={2000}
            showCount
            rows={5}
            aria-label="反馈详情，可选"
            placeholder="填写详情（选填）"
            disabled={feedbackBusy}
            onChange={event => setFeedbackDetail(event.target.value)}
          />
          <p className="ai-work-chat__feedback-note">可选择一个原因，或直接填写补充说明。反馈会保存在此会话中。</p>
        </Modal>
        <Modal
          className="ai-work-chat__branch-modal"
          open={branchTargetMessageId !== null}
          title="从这里创建聊天分支"
          width={560}
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
              <span className="ai-work-chat__branch-option-copy"><strong>{branchBusy ? "正在创建分支…" : "在当前工作空间中创建分支"}</strong><small>继承所选回答之前的完整聊天上下文，在新聊天中继续</small></span>
            </button>
            {canCreateWorktreeBranch ? <button className="ai-work-chat__branch-option" type="button" disabled={branchBusy} onClick={() => void createMessageBranch("worktree")}>
              <span className="ai-work-chat__branch-option-icon"><WorkbenchIcon name="branch" size={18} /></span>
              <span className="ai-work-chat__branch-option-copy"><strong>{branchBusy ? "正在创建新工作树…" : "在新工作树中创建分支"}</strong><small>为当前项目创建隔离 AI Worktree，并继续所选回答的上下文</small></span>
            </button> : null}
          </div>
        </Modal>
      </div>
    </section>
  );
}

export const AiWorkChat = memo(AiWorkChatView);

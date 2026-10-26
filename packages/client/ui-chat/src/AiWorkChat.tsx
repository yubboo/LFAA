import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { isBuiltinBrowserProvider } from "lfaa-util-values/src/browser-provider.js";
import { setAiSessionAssociations, type AgentAssociations } from "lfaa-client-connection/src/api.js";
/**
 * 文件：AiWorkChat.tsx
 * 功能：提供 SteamCMD、Minecraft 和写作工作区的 小鱼智能体 流式聊天。
 * 作用：调用控制端会话 API，显示持久化历史、可复制消息、可编辑并重新发送的问题、回答反馈、聊天分支、悬停式提问锚点、Provider 输出和真实用量状态；呈现账户级权限选择、模型卡片及其目录确认的思考力度，并把运行事件交给工作台通知中心。
 * 不负责：业务规则、节点任务执行和审批授权；这些由 server 核心及 Daemon 完成。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/store/src/scroll-restoration.ts、packages/api/gateway/src/index.ts。
 * 修改注意事项：只展示 server 发来的真实 Agent、工具、子 Agent、Skill 和审批状态。
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction, type UIEvent, type WheelEvent as ReactWheelEvent } from "react";
import { createSnapshotCache } from "lfaa-client-store/src/snapshot-cache.js";
import { Alert, Button, Dropdown, Empty, Input, Modal, Popover, Select, Spin, Tag, Tooltip, Typography } from "antd";
import { appendAiTextDelta, uploadAttachment, answerAiRunQuestion, appendAiRunInput, applyWritingEditProposal, ApiError, cancelAiRun, createWorkspaceGitWorktree, createAiSessionBranchFromMessage, createAiSessionBranchFromMessageInWorktree, decideAiApproval, forkAiSessionBeforeUserMessage, getErrorMessage, loadSettings, loadAiAccounts, loadWritingEditProposal, loadAiMessages, loadAiSessions, loadWritingWorkspace, pauseAiRun, rejectWritingEditProposal, resumeAiRun, saveSettings, setAiSessionPlanMode, setAiSessionProject, streamAiChat, submitAiMessageFeedback, updateAiAccountModel, updateAiAccountReasoningMode, type AiAccount, type AiActivityFileChange, type AiActivityItem, type AiContextUsage, type AiMessage, type AiMessageFeedbackInput, type AiRunPauseState, type AiSession, type AiSessionBranchSource, type AiSessionUsageSummary, type AiWorkbenchView, type ApplicationId, type BrowserProviderId, type UserSettings, type WritingEditProposal, type WritingWorkspace, type WorkspaceDaemonNode, type WorkspaceProject, type WorkspaceProjectApplicationId } from "lfaa-client-connection/src/api.js";
import { notifyAiWorkAction, notifyAiWorkCompletion, type AiWorkGoalRequest, type AiWorkNotificationInput } from "lfaa-client-resources/src/notification-runtime.js";

// 本次请求携带的附件：只用于当前进程把图片显示在用户气泡里（字节仍不写入会话历史）。
const messageAttachmentRefs = new Map<string, Array<{ id: string; name: string }>>();
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { AiLiveActivityDuration, AiWorkResponse } from "./AiWorkResponse.js";
import { aiActivityClock } from "./activity-clock.js";
import { buildResponseTimeline, splitAiActivityDetail } from "./response-timeline.js";
import { formatAiActivityDuration, getAiActivityDisplayStatus, getAiActivityDurationSeconds, getAiActivitySummary } from "./activity-duration.js";
import { buildConversationAnchors, conversationAnchorLabel, conversationAnchorReply, type ConversationAnchorPreview } from "./conversation-anchor-preview.js";
import { buildConversationAnchorLayout, createConversationScrollTracker, createFrameCoalescer, findNearestConversationAnchorIndex, projectConversationWheelScroll, shouldAutoScrollToLatest, shouldFollowLatestMessage, shouldShowScrollToLatest, updateConversationAnchorPointerTarget } from "./conversation-scroll.js";
import { createOutputIdleBlurController } from "./output-idle-blur.js";
import { AI_RUN_CONTROL_GUARD_MS, canControlAiRun } from "./run-stop-guard.js";
import { AiUsageFooter, type AiUsageLoadState } from "./AiUsageFooter.js";
import { supportsVoiceInput, supportsVoiceOutput, startVoiceInput, readResponseAloud, stopVoicePlayback } from "./voice.js";
import voiceParticleCore from "./assets/voice-particle-core.png";
import { VoiceOrb3D } from "./VoiceOrb3D.js";
import { WorkbenchIcon, type WorkbenchIconName } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { DshSlotOutlet } from "lfaa-client-modules/src/client/index.js";
import { WorkspaceProjectPicker } from "./WorkspaceProjectPicker.js";
import { effectiveReasoningMode, fixedThinkingLabel, modelOptionVersionTag, modelParameterSummary, modelSelectorDisplayLabel, reasoningDefaultLabel, reasoningModeLabel, reasoningOptions } from "lfaa-client-ui-settings-models/src/model-options.js";
import "./ai-work-chat.css";

const MODEL_PICKER_RESULT_LIMIT = 60;
type AiMessageFeedbackRating = AiMessageFeedbackInput["rating"];
type ComposerMenuState = { trigger: "/" | "@"; start: number; end: number; query: string };
type ComposerAssociation = { kind: "application"; id: ApplicationId } | { kind: "capability"; id: string };
type ComposerMenuItem = {
  id: string;
  group: string;
  label: string;
  description: string;
  icon: WorkbenchIconName;
  disabled?: boolean;
  insertText?: string;
  action?: "open-model-picker";
  association?: ComposerAssociation;
  searchText?: string;
};

const composerSlashCommands: ComposerMenuItem[] = [
  { id: "plan", group: "命令", label: "/plan", description: "以计划模式处理接下来的目标", icon: "book", insertText: "/plan " },
  { id: "plan-off", group: "命令", label: "/plan off", description: "退出计划模式", icon: "check", insertText: "/plan off" },
  { id: "side", group: "命令", label: "/side", description: "在临时侧边聊天中继续", icon: "panelRight", insertText: "/side " },
  { id: "model", group: "命令", label: "/model", description: "打开当前模型选择器", icon: "grid", action: "open-model-picker" }
];

const applicationAssociationLabels: Record<ApplicationId, string> = {
  steamcmd: "SteamCMD",
  minecraft: "Minecraft",
  connectivity: "联机服务",
  writing: "写作",
  aivideo: "AI 漫剧",
  workspace: "小鱼智能体"
};

function capabilityAssociationGroup(kind: string): string {
  return kind === "skill" ? "技能" : kind === "prompt" ? "提示词" : kind === "expert" ? "专家" : "能力";
}

const aiMessageFeedbackReasons: Record<AiMessageFeedbackRating, string[]> = {
  positive: ["解决了我的问题", "遵循了我的指示", "代码/输出质量好", "快速高效", "有帮助的自主行为", "其他"],
  negative: ["没有解决问题", "没有遵循我的指示", "回答不够准确", "代码/输出质量需要改进", "不够有帮助", "其他"]
};

interface AiWorkChatProps {
  workspaceHeader?: ReactNode;
  userId: string;
  appId: ApplicationId;
  workspaceView?: AiWorkbenchView;
  capabilities?: Array<{ id: string; name: string; kind: string }>;
  capabilitiesError?: string;
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
  sessions: AiSession[];
  activeSessionId: string | null;
  projectDirectoryMissing: boolean;
  newSessionProjectId: string | null;
  newSessionGitRepositoryId: string | null;
  defaultWorkspaceProjectId: string | null;
  onSelectedProjectChange: (projectId: string | null) => void;
  workspaceProjects: WorkspaceProject[];
  workspaceProjectsLoadStatus: "loading" | "ready" | "error";
  workspaceProjectsTruncated: boolean;
  workspaceNodes: WorkspaceDaemonNode[];
  workspaceProjectsError: string;
  onRetryWorkspaceProjects: () => void;
  onWorkspaceProjectsChange: (projects: WorkspaceProject[]) => void;
  initialDraft: string;
  autoSubmitGoal?: AiWorkGoalRequest | null;
  onAutoSubmitGoalConsumed: (requestId: string) => void;
  newSessionKey: number;
  onSessionsChange: (sessions: AiSession[]) => void;
  onActiveSessionChange: (sessionId: string | null) => void;
  onDraftChange: (draft: string) => void;
  onProviderStatusChange: (status: string) => void;
  onBusyChange: (busy: boolean) => void;
  onOpenSettings: (section?: "ai" | "permissions", focusTarget?: string) => void;
  onNotification: (notification: AiWorkNotificationInput) => void;
  onOpenSideChat: (initialQuestion?: string) => void;
  onWritingWorkspaceChange?: (workspace: WritingWorkspace) => void;
  onOpenProjectFileReview?: (projectId: string, path: string) => void;
  onSessionFileChanges?: (sessionId: string | null, changes: AiActivityFileChange[]) => void;
  onBrowserToolCompleted?: (providerId: BrowserProviderId) => void;
  voiceMode?: boolean;
  onExitVoice?: () => void;
}

type MessageUsage = { promptTokens: number | null; completionTokens: number | null; cacheReadTokens: number | null; providerId: string; modelId: string; models?: Array<{ providerId: string; modelId: string; requestCount: number }> };
type EditingMessage = { messageId: string; content: string; phase: "stopping" | "ready" | "sending" };
type ExpandedActivitySteps = { messageId: string; activityIds: ReadonlySet<string> };
type PendingAiInteraction = { kind: "approval" | "question"; runId: string; activity: AiActivityItem };
type AiWorkMessageActions = {
  copyMessage: (message: AiMessage) => Promise<void>;
  editUserMessage: (message: AiMessage, pairedAssistant: AiMessage) => Promise<void>;
  submitEditedMessage: () => Promise<void>;
  cancelMessageEditing: () => void;
  openMessageFeedback: (messageId: string, rating: AiMessageFeedbackRating) => void;
  toggleActivityStep: (messageId: string, activityId: string) => void;
  openWritingProposal: (proposalId: string) => Promise<void>;
};
const emptyAiWorkMessageActions: AiWorkMessageActions = {
  copyMessage: async () => undefined,
  editUserMessage: async () => undefined,
  submitEditedMessage: async () => undefined,
  cancelMessageEditing: () => undefined,
  openMessageFeedback: () => undefined,
  toggleActivityStep: () => undefined,
  openWritingProposal: async () => undefined
};

interface AiWorkMessageRowProps {
  message: AiMessage;
  pairedAssistant?: AiMessage;
  usage?: MessageUsage;
  editingMessage: EditingMessage | null;
  anyMessageEditing: boolean;
  pauseState: "paused" | "pausing" | null;
  copied: boolean;
  conversationBusy: boolean;
  activeRunId: string | null;
  liveMessage: boolean;
  branchBusy: boolean;
  hasQueuedRuns: boolean;
  feedbackBusy: boolean;
  showContextUsage: boolean;
  expandedActivitySteps: ExpandedActivitySteps | null;
  writingProposalLoading: boolean;
  writingProposalBusy: boolean;
  actions: AiWorkMessageActions;
  setEditingMessage: Dispatch<SetStateAction<EditingMessage | null>>;
  setMessageActionError: Dispatch<SetStateAction<string>>;
  setBranchTargetMessageId: Dispatch<SetStateAction<string | null>>;
  onOpenProjectFileReview?: (projectId: string, path: string) => void;
  onBrowserToolCompleted?: (providerId: BrowserProviderId) => void;
}

const AiWorkMessageRow = memo(function AiWorkMessageRow({ message, pairedAssistant, usage, editingMessage, anyMessageEditing, pauseState, copied, conversationBusy, activeRunId, liveMessage, branchBusy, hasQueuedRuns, feedbackBusy, showContextUsage, expandedActivitySteps, writingProposalLoading, writingProposalBusy, actions, setEditingMessage, setMessageActionError, setBranchTargetMessageId, onOpenProjectFileReview, onBrowserToolCompleted }: AiWorkMessageRowProps) {
  const activitySummary = getAiActivitySummary(message);
  const isEditingMessage = editingMessage?.messageId === message.id;
  const canEditMessage = message.role === "user" && pairedAssistant?.role === "assistant" && pairedAssistant.status !== "queued"
    && (!conversationBusy || pairedAssistant.status === "streaming" && activeRunId === pairedAssistant.id)
    && !branchBusy && !hasQueuedRuns
    && (!anyMessageEditing || isEditingMessage);

  const renderActivity = (activity: AiActivityItem) => {
    const activityDetail = splitAiActivityDetail(activity.detail);
    const activityExpanded = expandedActivitySteps?.messageId === message.id && expandedActivitySteps.activityIds.has(activity.id);
    const activityDetailId = `ai-work-chat-activity-detail-${message.id}-${activity.id}`;
    const liveActivityDuration = liveMessage && activity.status === "running"
      && typeof activity.durationMs !== "number" && !activity.completedAt;
    return <div className={`ai-work-chat__activity-row ai-work-chat__activity-row--${activity.status}`} key={activity.id}>
      <Button className="ai-work-chat__activity-step-toggle" type="text" aria-expanded={activityExpanded} aria-controls={activityDetailId} onClick={() => actions.toggleActivityStep(message.id, activity.id)}>
        <WorkbenchIcon name={activity.status === "running" ? "spark" : activity.status === "approval_required" ? "shield" : activity.status === "waiting_input" || activity.status === "unavailable" ? "help" : activity.status === "error" ? "close" : "review"} size={14} />
        <span className="ai-work-chat__activity-heading"><strong>{activity.title}</strong><span className={`ai-work-chat__activity-status ai-work-chat__activity-status--${activity.status}`}>{getAiActivityDisplayStatus(activity)}</span><span className="ai-work-chat__activity-duration">{liveActivityDuration ? <AiLiveActivityDuration activity={activity} /> : formatAiActivityDuration(getAiActivityDurationSeconds(activity))}</span></span>
        <WorkbenchIcon name="chevron" size={13} />
      </Button>
      {activity.fileChanges?.map((change, index) => {
        const operation = change.operation === "read" ? "读取" : change.operation === "created" ? "新建" : change.operation === "deleted" ? "删除" : "修改";
        const key = `${activity.id}:${index}:${change.path}`;
        return change.operation !== "read" && change.projectId && onOpenProjectFileReview
          ? <Button key={key} className="ai-work-chat__file-change-trigger" type="link" size="small" aria-label={`${operation}文件 ${change.path}，查看 Git 差异和编辑`} onClick={() => onOpenProjectFileReview(change.projectId!, change.path)}>
              <WorkbenchIcon name="file" size={13} />{operation} <code>{change.path}</code><span>查看差异与编辑</span>
            </Button>
          : <span key={key} className="ai-work-chat__file-change-path"><WorkbenchIcon name="file" size={13} />{operation} <code>{change.path}</code></span>;
      })}
      {activityExpanded ? <div className="ai-work-chat__activity-step-detail" id={activityDetailId}>
        {activity.detail && (activity.kind === "command" || activity.kind === "tool") ? <div className={`ai-work-chat__activity-output-card${activity.kind === "command" ? " ai-work-chat__activity-output-card--command" : ""}`}>
          {activityDetail.summary ? <div className="ai-work-chat__activity-output-summary"><strong>执行摘要</strong><p>{activityDetail.summary}</p></div> : null}
          {activityDetail.preview ? <div className="ai-work-chat__activity-output-preview"><strong>{activityDetail.previewLabel}</strong><pre>{activityDetail.preview}</pre></div> : null}
        </div> : activity.detail ? <span className="ai-work-chat__activity-detail">{activity.detail}</span> : null}
        {activity.writingProposalId ? <Button className="ai-work-chat__writing-review-trigger" type="link" size="small" disabled={writingProposalLoading || writingProposalBusy} onClick={() => void actions.openWritingProposal(activity.writingProposalId!)}>审阅修改</Button> : null}
      </div> : null}
    </div>;
  };

  const renderInteraction = (activity: AiActivityItem) => {
    if (activity.approvalId) {
      if (activity.status === "approval_required" && !activity.approvalAnswer) return null;
      const answer = activity.approvalAnswer === "approved" ? "批准本次操作" : activity.approvalAnswer === "denied" ? "拒绝本次操作" : activity.approvalAnswer === "expired" ? "审批已过期" : "未记录审批决定";
      return <section className="ai-work-chat__approval-record" key={activity.id} aria-label="审批记录">
        <strong>{activity.approvalQuestion ?? activity.title}</strong>
        <p className="ai-work-chat__question-inline-answer">{answer}</p>
        {renderActivity(activity)}
      </section>;
    }
    if (activity.status === "waiting_input") return null;
    const questionText = activity.question ?? activity.detail ?? "";
    const skipped = activity.detail?.includes("选择跳过") ?? false;
    const answerText = activity.detail?.startsWith("你的回答：") ? activity.detail.slice("你的回答：".length).trim() : activity.detail;
    if (activity.status === "complete") return <section className="ai-work-chat__question-record" key={activity.id} aria-label="已回答的澄清问题">
      <strong>{questionText}</strong><p className="ai-work-chat__question-inline-answer">{skipped ? "已跳过" : answerText || "未记录文字答案"}</p>
    </section>;
    return <section className="ai-work-chat__question-record" key={activity.id} aria-label="澄清问题记录">
      <strong>{questionText}</strong><p className="ai-work-chat__question-inline-answer">{activity.detail || activity.title}</p>
    </section>;
  };

  return <article className={`ai-work-chat__message ai-work-chat__message--${message.role}`} data-ai-anchor-id={message.role === "user" ? message.id : undefined}>
    {message.role === "user" ? (message.attachments ?? []).map(file => (
      <img key={file.id} className="ai-work-chat__message-image" src={"/api/attachments/" + file.id + "/content"} alt={file.name} loading="lazy" />
    )) : null}
    {message.status === "queued" || message.status === "streaming" || message.status === "error" || message.status === "interrupted" ? (message.role !== "assistant" || message.status !== "streaming") ? <div className="ai-work-chat__message-meta">{message.status === "queued" ? <Tag>{pauseState === "paused" ? "已暂停" : pauseState === "pausing" ? "正在暂停" : "排队中"}</Tag> : message.status === "streaming" ? <Tag color={pauseState === "paused" ? undefined : activitySummary.isProcessing ? "processing" : undefined}>{pauseState === "paused" ? "已暂停" : pauseState === "pausing" ? "正在暂停" : activitySummary.label}</Tag> : message.status === "error" ? <Tag color="error">失败</Tag> : <Tag>已停止</Tag>}</div> : null : null}
    <div className={`ai-work-chat__message-content${activitySummary.isProcessing ? " ai-work-chat__message-content--streaming" : ""}`}>
      {message.role === "user" && isEditingMessage ? <div className="ai-work-chat__message-edit">
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} maxLength={12_000} aria-label="编辑已发送的问题" value={editingMessage.content} disabled={editingMessage.phase === "sending"} onChange={event => setEditingMessage(current => current?.messageId === message.id ? { ...current, content: event.target.value } : current)} />
        <div className="ai-work-chat__message-edit-actions">
          <small>{editingMessage.content.length}/12000</small>
          {editingMessage.phase === "stopping" ? <span role="status">正在停止当前回复…</span> : null}
          <Button size="small" disabled={editingMessage.phase === "sending"} onClick={actions.cancelMessageEditing}>取消</Button>
          <Button size="small" type="primary" loading={editingMessage.phase === "sending"} disabled={editingMessage.phase !== "ready" || !editingMessage.content.trim()} onClick={() => void actions.submitEditedMessage()}>发送</Button>
        </div>
      </div> : message.role === "assistant" ? <AiWorkResponse message={message} pauseLabel={pauseState === "paused" ? "已暂停" : pauseState === "pausing" ? "正在暂停" : undefined} renderActivity={renderActivity} renderInteraction={renderInteraction} onOpenProjectFileReview={onOpenProjectFileReview} onBrowserToolCompleted={onBrowserToolCompleted} /> : message.content}
    </div>
    {message.role === "assistant" && showContextUsage && usage ? <small className="ai-work-chat__usage" title={usage.models?.map(model => `${model.providerId} / ${model.modelId}（${model.requestCount} 次请求）`).join(" → ")}>{`${usage.promptTokens ?? "?"} 输入 · ${usage.completionTokens ?? "?"} 输出 · 缓存命中 ${usage.cacheReadTokens ?? "?"} tokens · ${usage.models?.length ? usage.models.map(model => `${model.providerId} / ${model.modelId}`).join(" → ") : `${usage.providerId} / ${usage.modelId}`}`}</small> : null}
    {message.role === "user" && message.content && !isEditingMessage ? <div className="ai-work-chat__message-actions ai-work-chat__message-actions--user">
      <Tooltip title={copied ? "已复制完整提问" : "复制消息"}>
        <Button className="ai-work-chat__message-action" type="text" size="small" aria-label={copied ? "已复制完整提问" : "复制完整提问"} icon={<WorkbenchIcon name={copied ? "check" : "copy"} size={15} />} onClick={() => void actions.copyMessage(message)} />
      </Tooltip>
      {pairedAssistant?.role === "assistant" ? <Tooltip title="编辑并重新发送">
        <Button className="ai-work-chat__message-action" type="text" size="small" aria-label="编辑并重新发送问题" disabled={!canEditMessage} icon={<WorkbenchIcon name="new" size={15} />} onClick={() => void actions.editUserMessage(message, pairedAssistant)} />
      </Tooltip> : null}
      <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time>
    </div> : null}
    {message.role === "assistant" && message.status === "complete" && message.content ? <div className="ai-work-chat__message-actions ai-work-chat__message-actions--assistant">
      <Tooltip title={copied ? "已复制完整回复" : "复制回复"}>
        <Button className="ai-work-chat__message-action" type="text" size="small" aria-label={copied ? "已复制完整回复" : "复制回复"} icon={<WorkbenchIcon name={copied ? "check" : "copy"} size={15} />} onClick={() => void actions.copyMessage(message)} />
      </Tooltip>
      {message.feedback ? <span className={`ai-work-chat__feedback-status ai-work-chat__feedback-status--${message.feedback.rating}`} aria-label={message.feedback.rating === "positive" ? "已提交正向反馈" : "已提交改进反馈"} title={message.feedback.detail || message.feedback.reasons.join("、") || "已提交反馈"}><WorkbenchIcon name={message.feedback.rating === "positive" ? "thumbUp" : "thumbDown"} size={15} /><span>已反馈</span></span> : <>
        <Tooltip title="回答有帮助"><Button className="ai-work-chat__message-action" type="text" size="small" aria-label="评价回复：有帮助" disabled={feedbackBusy} icon={<WorkbenchIcon name="thumbUp" size={15} />} onClick={() => actions.openMessageFeedback(message.id, "positive")} /></Tooltip>
        <Tooltip title="回答需要改进"><Button className="ai-work-chat__message-action" type="text" size="small" aria-label="评价回复：需要改进" disabled={feedbackBusy} icon={<WorkbenchIcon name="thumbDown" size={15} />} onClick={() => actions.openMessageFeedback(message.id, "negative")} /></Tooltip>
      </>}
      <Tooltip title="分支到新聊天"><Button className="ai-work-chat__message-action" type="text" size="small" aria-label="从此回复分支到新聊天" disabled={branchBusy} icon={<WorkbenchIcon name="branch" size={15} />} onClick={() => { setMessageActionError(""); setBranchTargetMessageId(message.id); }} /></Tooltip>
      <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time>
    </div> : null}
  </article>;
});

const aiAccountSnapshots = createSnapshotCache<AiAccount[]>();
const aiMessageSnapshots = createSnapshotCache<AiMessage[]>(messages => messages.reduce((size, message) => size
  + (message.content.length + message.activity.reduce((length, activity) => length + activity.title.length + activity.detail.length, 0)) * 2, 0));
const pendingInteractionByActivity = new WeakMap<AiActivityItem[], AiActivityItem | null>();

function applicationNameFor(_appId: ApplicationId): string {
  return "小鱼智能体";
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

const suggestions: Record<ApplicationId, string[]> = {
  workspace: ["读取我的项目说明，分析需要修复的问题并运行验证。", "先检查当前可用节点和工具，再规划这项任务。"],
  steamcmd: ["帮我列出一份 SteamCMD 部署专用服务器前的检查清单。", "如何规划游戏服务器端口、备份和更新流程？"],
  minecraft: ["给我一份升级 Minecraft Java 服务端前的兼容性检查清单。", "比较 Paper、Fabric 和原版服务端的适用场景。"],
  connectivity: [],
  writing: ["帮我梳理这个故事的核心设定和待确认问题。", "请分析这段正文的节奏、人物动机与表达问题。", "围绕这个角色，帮我补出清晰的目标、阻碍与变化。"],
  aivideo: ["把这段剧情拆成镜头画面和对白。", "帮我设计一组镜头，并标出镜头之间的顺序关系。"]
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
      ? "AI 可协助编写剧本与镜头文案；分镜画布保存由画布界面完成，视频生成、素材上传和白模导入尚未接入。"
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
  { value: "fast", label: "快速", description: "最多 1024 tokens" },
  { value: "balanced", label: "平衡", description: "跟随模型/自定义上限" },
  { value: "deep", label: "深入", description: "按模型/自定义上限" }
];

function AiWorkChatView({ workspaceHeader, userId, appId, workspaceView, capabilities = [], capabilitiesError = "", settings, onSettingsChange, sessions, activeSessionId, projectDirectoryMissing, newSessionProjectId, newSessionGitRepositoryId, defaultWorkspaceProjectId, onSelectedProjectChange, workspaceProjects, workspaceProjectsLoadStatus, workspaceProjectsTruncated, workspaceNodes, workspaceProjectsError, onRetryWorkspaceProjects, onWorkspaceProjectsChange, initialDraft, autoSubmitGoal = null, onAutoSubmitGoalConsumed, newSessionKey, onSessionsChange, onActiveSessionChange, onDraftChange, onProviderStatusChange, onBusyChange, onOpenSettings, onNotification, onOpenSideChat, onOpenProjectFileReview, onWritingWorkspaceChange, onSessionFileChanges, onBrowserToolCompleted, voiceMode = false, onExitVoice = () => undefined }: AiWorkChatProps) {
  const currentScrollConversationKey = `${appId}:${activeSessionId ?? "new-session"}`;
  const outputFocusRegionElementRef = useRef<HTMLElement | null>(null);
  const setOutputFocusRegionElement = useCallback((node: HTMLElement | null) => {
    outputFocusRegionElementRef.current = node;
  }, []);
  const [permissionModal, permissionModalContext] = Modal.useModal();
  const cachedAccounts = useRef(aiAccountSnapshots.get(userId) ?? null).current;
  const cachedMessages = useRef(activeSessionId ? aiMessageSnapshots.get(aiMessageSnapshotKey(userId, appId, activeSessionId)) ?? null : null).current;
  const [messages, setMessages] = useState<AiMessage[]>(() => cachedMessages ?? []);
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
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<Array<{ id: string; name: string; mediaType: string; bytes: number }>>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [composerMenu, setComposerMenu] = useState<ComposerMenuState | null>(null);
  const [composerMenuMaxHeight, setComposerMenuMaxHeight] = useState<number | null>(null);
  const [composerMenuActiveIndex, setComposerMenuActiveIndex] = useState(0);
  const composerFormRef = useRef<HTMLFormElement | null>(null);
  const pendingComposerCaretRef = useRef<number | null>(null);
  const [composerSelectionRevision, setComposerSelectionRevision] = useState(0);
  const [associations, setAssociations] = useState<AgentAssociations>({ applicationIds: [], capabilityIds: [] });
  const [associationsBusy, setAssociationsBusy] = useState(false);
  const [composerMoreOpen, setComposerMoreOpen] = useState(false);
  const [composerMoreSection, setComposerMoreSection] = useState<"applications" | "capabilities" | null>(null);
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
  const [toolbarBusy, setToolbarBusy] = useState<"permissions" | "aiRuntime" | null>(null);
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
  const loadedMessageSessionKeyRef = useRef<string | null>(null);
  const activeRunRef = useRef<string | null>(null);
  const runRequestGenerationRef = useRef(0);
  const autoFollowAttempt = useRef<string | null>(null);
  const sessionIdForTurn = useRef(activeSessionId);
  const sessionKeyForTurn = useRef(newSessionKey);
  const appIdForTurn = useRef(appId);
  const notifiedTurnEvents = useRef(new Set<string>());
  const messagesElementRef = useRef<HTMLDivElement | null>(null);
  const olderMessagesScrollRestoreRef = useRef<{ height: number; top: number } | null>(null);
  const scrollTrackerRef = useRef<ReturnType<typeof createConversationScrollTracker> | null>(null);
  const activeScrollConversationRef = useRef<string | null>(null);
  const initializedScrollConversationRef = useRef<string | null>(null);
  const preparedScrollConversationRef = useRef<string | null>(!activeSessionId || cachedMessages !== null ? currentScrollConversationKey : null);
  const pointerScrollTopRef = useRef<number | null>(null);
  const pointerScrollDirectionRef = useRef<"up" | "down" | null>(null);
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
  // 默认展示会话最新消息；用户主动上翻后暂停跟随，回到底部时再恢复。
  const followLatestMessageRef = useRef(true);
  const responseHistoryDetailsRef = useRef(new Set<HTMLDetailsElement>());
  const followLatestBeforeResponseHistoryRef = useRef<boolean | null>(null);
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
  const handleResponseHistoryClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const summary = event.target.closest("summary");
    const details = summary?.parentElement;
    if (!(details instanceof HTMLDetailsElement) || !details.classList.contains("ai-work-chat__response-history")) return;
    if (!details.open) {
      if (responseHistoryDetailsRef.current.size === 0) followLatestBeforeResponseHistoryRef.current = followLatestMessageRef.current;
      responseHistoryDetailsRef.current.add(details);
      followLatestMessageRef.current = false;
      return;
    }
    responseHistoryDetailsRef.current.delete(details);
    if (responseHistoryDetailsRef.current.size === 0 && followLatestBeforeResponseHistoryRef.current !== null) {
      followLatestMessageRef.current = followLatestBeforeResponseHistoryRef.current;
      followLatestBeforeResponseHistoryRef.current = null;
    }
  }, []);
  const handleMessagesWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0 || event.ctrlKey) return;
    const element = event.currentTarget;
    const projectedScroll = projectConversationWheelScroll(element.scrollTop, element.scrollHeight, element.clientHeight, event.deltaY);
    if (!projectedScroll) return;
    updateFollowFromUserScroll(element, projectedScroll.direction, projectedScroll.distanceFromBottom);
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

  useLayoutEffect(() => {
    const restore = olderMessagesScrollRestoreRef.current;
    const element = messagesElementRef.current;
    if (!restore || !element) return;
    olderMessagesScrollRestoreRef.current = null;
    element.scrollTop = restore.top + element.scrollHeight - restore.height;
  }, [messages]);
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
  const activeAccount = accountLoadState === "ready" ? accounts.find((account) => account.active) : undefined;
  const activeSession = sessions.find(session => session.id === activeSessionId) ?? null;
  const conversationInputSlotOwner = useMemo(() => ({ sessionId: activeSessionId }), [activeSessionId]);
  const planModeActive = planModeOverride?.sessionId === activeSessionId ? planModeOverride.active : activeSession?.planMode === true;
  const composerMentionCatalog = useMemo<ComposerMenuItem[]>(() => {
    const applications: ComposerMenuItem[] = APPLICATION_IDS
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
    const availableCapabilities: ComposerMenuItem[] = Array.from(uniqueCapabilities.values()).map(capability => ({
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
  const composerMenuItems = useMemo<ComposerMenuItem[]>(() => {
    if (!composerMenu) return [];
    const query = composerMenu.query.trim().toLocaleLowerCase("zh-CN");
    if (composerMenu.trigger === "/") {
      return composerSlashCommands
        .filter(item => item.label.slice(1).toLocaleLowerCase("zh-CN").startsWith(query))
        .map(item => item.action === "open-model-picker"
          ? { ...item, disabled: !activeAccount || activeAccount.models.length === 0 || modelBusy || busy }
          : item);
    }

    const unavailable = busy || associationsBusy;
    return composerMentionCatalog
      .filter(item => !query || item.searchText?.includes(query))
      .slice(0, 60)
      .map(item => ({ ...item, disabled: unavailable }));
  }, [activeAccount, associationsBusy, busy, composerMenu, composerMentionCatalog, modelBusy]);
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
  const branchSourceProject = activeSession?.projectId ? workspaceProjects.find(project => project.id === activeSession.projectId) ?? null : null;
  const branchSourceNode = branchSourceProject ? workspaceNodes.find(node => node.id === branchSourceProject.nodeId) ?? null : null;
  const canCreateWorktreeBranch = (appId === "workspace" || appId === "minecraft")
    && Boolean(branchSourceProject && (appId === "workspace" || branchSourceProject.appId === appId) && !branchSourceProject.gitWorktree
      && branchSourceNode?.local);
  const activeModel = activeAccount?.models.find((model) => model.id === activeAccount.modelId);
  const activeModelVersionTag = activeModel ? modelOptionVersionTag(activeModel) : undefined;
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
    return (activeAccount?.models ?? []).filter((model) => !query || `${model.name} ${modelOptionVersionTag(model) ?? ""} ${model.id}`.toLocaleLowerCase("zh-CN").includes(query));
  }, [activeAccount?.models, modelSearch]);
  const visibleModels = matchingModels.slice(0, MODEL_PICKER_RESULT_LIMIT);

  useEffect(() => {
    if (projectSelectionSessionKeyRef.current !== newSessionKey) {
      projectSelectionSessionKeyRef.current = newSessionKey;
      projectSelectionExplicitRef.current = Boolean(newSessionProjectId);
    }
    if (!activeSessionId) {
      const projectId = newSessionProjectId ?? (projectSelectionExplicitRef.current ? null : defaultWorkspaceProjectId);
      setSelectedProjectId(projectId);
      onSelectedProjectChange(projectId);
    } else {
      projectSelectionExplicitRef.current = true;
    }
  }, [activeSessionId, defaultWorkspaceProjectId, newSessionKey, newSessionProjectId, onSelectedProjectChange]);

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
    projectSelectionExplicitRef.current = true;
    setProjectBusy(true);
    try {
      if (activeSessionId) {
        const { session } = await setAiSessionProject(activeSessionId, project?.id ?? null, "workspace");
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
      responseHistoryDetailsRef.current.clear();
      followLatestBeforeResponseHistoryRef.current = null;
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
      setMessages(sessionSnapshot);
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
        aiMessageSnapshots.set(cacheKey, result.messages);
        setMessages(result.messages);
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
      setMessages(snapshot ?? []);
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
        return [...result.messages.filter(message => !existing.has(message.id)), ...current];
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

  /** 附件上限与字节转换在客户端只做快速反馈；服务端仍会重新校验。 */
  async function pickAttachments(files: FileList | File[] | null) {
    if (!files || attachmentBusy) return;
    const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"];
    const remaining = 4 - pendingAttachments.length;
    const list = Array.from(files).filter(file => allowed.includes(file.type)).slice(0, Math.max(0, remaining));
    if (list.length === 0) { setAttachmentError("只支持 PNG/JPEG/GIF/WebP 图片或纯文本，且最多 4 个附件。"); return; }
    setAttachmentBusy(true);
    setAttachmentError(null);
    try {
      for (const file of list) {
        if (file.size <= 0 || file.size > 8 * 1024 * 1024) throw new Error(file.name + " 超过 8 MiB 上限。");
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        const uploaded = await uploadAttachment({ name: file.name, mediaType: file.type, dataBase64: btoa(binary) });
        setPendingAttachments(current => [...current, uploaded.attachment]);
      }
    } catch (error) {
      setAttachmentError(getErrorMessage(error));
    } finally {
      setAttachmentBusy(false);
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
    const sendingAttachments = pendingAttachments;
    if (sendingAttachments.length > 0) setPendingAttachments([]);
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
        setMessages(current => { const incoming = result.mode === "queue" ? [result.userMessage, result.run.message] : [result.userMessage]; return [...current.filter(item => !incoming.some(next => next.id === item.id)), ...incoming]; });
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
    const requestProjectId = targetSession ? targetSession.session.projectId : selectedProjectId;
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
            return [...starting.map(item => incoming.find(next => next.id === item.id) ?? item), ...incoming.filter(next => !starting.some(item => item.id === next.id))];
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
        onInput: (message) => { if (isCurrentSubscription()) setMessages(current => [...current.filter(item => item.id !== message.id), message]); },
        onActivity: ({ messageId, activity }) => {
          if (!isCurrentSubscription()) return;
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

  function applyComposerMenuItem(item: ComposerMenuItem): void {
    const menu = composerMenu;
    if (!menu || item.disabled) return;
    setComposerMenu(null);
    if (item.action === "open-model-picker") {
      const nextDraft = `${draft.slice(0, menu.start)}${draft.slice(menu.end)}`;
      setDraft(nextDraft);
      onDraftChange(nextDraft);
      pendingComposerCaretRef.current = menu.start;
      setComposerSelectionRevision(revision => revision + 1);
      setModelPickerOpen(true);
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

  async function selectModel(modelId: string): Promise<void> {
    if (!activeAccount || activeAccount.modelId === modelId || modelBusy || busy) return;
    setModelBusy(true);
    setError("");
    try {
      const result = await updateAiAccountModel(activeAccount.id, modelId);
      const nextAccounts = accounts.map((account) => account.id === result.account.id ? result.account : account);
      aiAccountSnapshots.set(userId, nextAccounts);
      setAccounts(nextAccounts);
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
  const openAiContextSettings = useCallback(() => onOpenSettings("ai", "ai-context-usage-setting"), [onOpenSettings]);

  const conversationAnchors = useMemo(() => buildConversationAnchors(messages), [messages]);
  const hasQueuedRuns = useMemo(() => messages.some(message => message.role === "assistant" && message.status === "queued"), [messages]);
  const messageRowActionsRef = useRef<AiWorkMessageActions>(emptyAiWorkMessageActions);
  // Keep memoized rows' handlers stable while forwarding each action to its latest state-aware implementation.
  useLayoutEffect(() => {
    messageRowActionsRef.current = { copyMessage, editUserMessage, submitEditedMessage, cancelMessageEditing, openMessageFeedback, toggleActivityStep, openWritingProposal };
  }, [copyMessage, editUserMessage, submitEditedMessage, cancelMessageEditing, openMessageFeedback, toggleActivityStep, openWritingProposal]);
  const messageRowActions = useMemo<AiWorkMessageActions>(() => ({
    copyMessage: message => messageRowActionsRef.current.copyMessage(message),
    editUserMessage: (message, pairedAssistant) => messageRowActionsRef.current.editUserMessage(message, pairedAssistant),
    submitEditedMessage: () => messageRowActionsRef.current.submitEditedMessage(),
    cancelMessageEditing: () => messageRowActionsRef.current.cancelMessageEditing(),
    openMessageFeedback: (messageId, rating) => messageRowActionsRef.current.openMessageFeedback(messageId, rating),
    toggleActivityStep: (messageId, activityId) => messageRowActionsRef.current.toggleActivityStep(messageId, activityId),
    openWritingProposal: proposalId => messageRowActionsRef.current.openWritingProposal(proposalId)
  }), []);
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
          ><span><strong><span className="ai-work-chat__model-card-model-name">{model.name}</span>{modelOptionVersionTag(model) ? <Tag color="blue">{modelOptionVersionTag(model)}</Tag> : null}</strong><small>{model.id}</small></span>{model.id === activeAccount?.modelId ? <span aria-hidden="true">✓</span> : null}</button>)}
          {!visibleModels.length ? <span className="ai-work-chat__model-card-empty">没有匹配的模型</span> : null}
        </div>
        {matchingModels.length > visibleModels.length ? <span className="ai-work-chat__model-card-limit">显示前 {MODEL_PICKER_RESULT_LIMIT} 个匹配结果，请继续输入以缩小范围。</span> : null}
      </section>
    </div>
  );

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
          ? <Select mode="multiple" optionFilterProp="label" allowClear maxCount={APPLICATION_IDS.length} aria-label="关联应用（可选）" aria-description="关联只提供参考，小鱼按目标决定是否加载。" title="关联只提供参考，小鱼按目标决定是否加载。" placeholder="搜索并选择应用" disabled={busy || associationsBusy} value={associations.applicationIds} options={APPLICATION_IDS.filter(id => id !== "workspace").map(id => ({ value: id, label: applicationAssociationLabels[id] }))} onChange={applicationIds => void changeAssociations({ ...associations, applicationIds })} />
          : <Select mode="multiple" optionFilterProp="label" allowClear maxCount={16} aria-label="关联能力（可选）" aria-description="关联只提供参考，小鱼按目标决定是否加载。" title="关联只提供参考，小鱼按目标决定是否加载。" placeholder="搜索并选择能力" disabled={busy || associationsBusy || capabilities.length === 0} value={associations.capabilityIds} options={capabilities.map(item => ({ value: item.id, label: item.name }))} onChange={capabilityIds => void changeAssociations({ ...associations, capabilityIds })} />}
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
      return <section className="ai-work-chat__interaction-dock ai-work-chat__interaction-dock--approval ai-work-chat__composer-interaction" aria-label="待处理审批">
        <div className="ai-work-chat__interaction-dock-heading">
          <span className="ai-work-chat__interaction-dock-icon"><WorkbenchIcon name="shield" size={15} /></span>
          <strong>需要你审批</strong>
          <span>此决定只适用于当前操作</span>
        </div>
        <p className="ai-work-chat__interaction-dock-question">{approvalQuestion}</p>
        {detail.summary || detail.preview ? <div className="ai-work-chat__activity-output-card ai-work-chat__composer-interaction-detail">
          {detail.summary ? <div className="ai-work-chat__activity-output-summary"><strong>操作说明</strong><p>{detail.summary}</p></div> : null}
          {detail.preview ? <div className="ai-work-chat__activity-output-preview"><strong>{detail.previewLabel}</strong><pre>{detail.preview}</pre></div> : null}
        </div> : null}
        <div className="ai-work-chat__interaction-dock-actions">
          <Button type="primary" disabled={interactionBusy} loading={interactionBusy} onClick={() => void resolvePendingApproval("approved")}>批准本次操作</Button>
          <Button danger disabled={interactionBusy} onClick={() => void resolvePendingApproval("denied")}>拒绝</Button>
        </div>
      </section>;
    }

    const questionText = activity.question ?? activity.detail;
    return <section className="ai-work-chat__interaction-dock ai-work-chat__interaction-dock--question ai-work-chat__composer-interaction" aria-label="待回答的澄清问题">
      <div className="ai-work-chat__interaction-dock-heading">
        <span className="ai-work-chat__interaction-dock-icon"><WorkbenchIcon name="help" size={15} /></span>
        <strong>需要你补充信息</strong>
        <span>选择一个选项，或补充答案</span>
      </div>
      <p className="ai-work-chat__interaction-dock-question">{questionText}</p>
      {activity.options?.length ? <div className="ai-work-chat__interaction-dock-options" role="group" aria-label="选择回答">
        {activity.options.map((option, index) => <button className="ai-work-chat__interaction-option" type="button" key={`${activity.questionId}-${index}`} disabled={interactionBusy} onClick={() => void submitPendingQuestion(option)}>
          <span className="ai-work-chat__interaction-option-number">{index + 1}</span><span>{option}</span><WorkbenchIcon name="chevron" size={14} />
        </button>)}
      </div> : null}
      <div className="ai-work-chat__interaction-dock-reply">
        <Input aria-label="补充回答" value={questionReply} maxLength={12000} placeholder="或自行填写补充回答" disabled={interactionBusy} onChange={(event) => setQuestionReply(event.target.value)} onPressEnter={() => void submitPendingQuestion(questionReply)} />
        <Button type="text" disabled={interactionBusy} onClick={() => void submitPendingQuestion("", true)}>跳过</Button>
        <Button type="primary" disabled={interactionBusy || !questionReply.trim()} loading={interactionBusy} onClick={() => void submitPendingQuestion(questionReply)}>发送</Button>
      </div>
    </section>;
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
    const voiceStatus = voiceSpeaking ? "正在播报" : busy ? "AI 正在思考" : listening ? "正在聆听" : voiceSessionActive ? "语音对话已连接" : draft.trim() ? "语音已识别" : "准备就绪";
    const voiceStatusDetail = voiceSpeaking
        ? "回复播报结束后会自动恢复聆听。"
      : busy
        ? "正在当前 AI Work 会话中生成回复。"
      : listening
        ? "请开始说话；识别完成后会自动发送。"
        : voiceSessionActive
          ? "没有识别到语音；点麦克风继续聆听，或结束语音对话。"
        : draft.trim()
          ? "可以编辑文字后发送，也可以开始语音对话。"
          : settings.aiRuntime.voiceInputEnabled
            ? "点麦克风开始语音对话；回复完成后会自动恢复聆听。"
          : "开启语音输入后，就可以直接和我说话。";
    const voiceHeadline = voiceSpeaking ? "正在播报" : busy ? "正在思考" : listening ? "正在聆听" : voiceSessionActive ? "语音已连接" : draft.trim() ? "语音已识别" : "准备就绪";
    const voiceOrbStatus = voiceSpeaking ? "speaking" : busy ? "thinking" : listening ? "listening" : voiceSessionActive ? "connected" : "ready";
    const voiceInputAvailable = settings.aiRuntime.voiceInputEnabled && supportsVoiceInput();
    return (
      <section className="ai-work-chat ai-work-chat--voice" aria-label="AI 语音主脑">
        <main className="ai-work-voice" data-voice-status={voiceOrbStatus}>
          <header className="ai-work-voice__header">
            <span className="ai-work-voice__brand-mark" aria-label="小鱼 AI 主脑"><WorkbenchIcon name="spark" size={16} /></span>
            <nav className="ai-work-voice__header-actions" aria-label="主脑操作">
              <Tooltip title="返回文字对话"><Button className="ai-work-voice__header-action" type="text" aria-label="返回文字对话" onClick={() => { endVoiceSession(); onExitVoice(); }} icon={<WorkbenchIcon name="history" size={17} />} /></Tooltip>
              <Tooltip title="AI 与模型设置"><Button className="ai-work-voice__header-action" type="text" aria-label="打开 AI 与模型设置" onClick={() => onOpenSettings("ai")} icon={<WorkbenchIcon name="settings" size={17} />} /></Tooltip>
              <Tooltip title={voiceSessionActive ? "结束语音对话" : "语音对话尚未开始"}><Button className="ai-work-voice__header-action" type="text" aria-label="结束语音对话" disabled={!voiceSessionActive} onClick={endVoiceSession} icon={<WorkbenchIcon name="close" size={17} />} /></Tooltip>
            </nav>
          </header>
          <div className="ai-work-voice__body">
            <section className="ai-work-voice__hero" aria-label="语音主脑状态">
              <VoiceOrb3D fallbackSrc={voiceParticleCore} status={voiceOrbStatus} speechActivity={voiceSpeechActivity} reducedMotion={settings.appearance.advanced.reducedMotion} />
              <div className="ai-work-voice__hero-copy" role="status" aria-live="polite">
                <h1>{voiceHeadline}</h1>
                <p>{voiceStatusDetail}</p>
              </div>
            </section>
            <div className="ai-work-voice__control">
              {error ? <Alert className="ai-work-voice__error" type="error" showIcon closable message={error} onClose={() => setError("")} /> : null}
              <div className="ai-work-voice__composer">
                <Tooltip title={!settings.aiRuntime.voiceInputEnabled ? "请先在这里开启语音输入" : !supportsVoiceInput() ? "当前宿主不支持安全语音识别" : listening ? "结束聆听" : "开始语音对话"}>
                  <Button className="ai-work-voice__mic" type="text" aria-label={!voiceSessionActive ? "开始语音对话" : busy || voiceSpeaking || listening ? "结束语音对话" : "继续聆听"} aria-pressed={voiceSessionActive} disabled={!voiceSessionActive && (!voiceInputAvailable || busy)} onClick={toggleVoiceConversation} icon={<WorkbenchIcon name={voiceSessionActive && (busy || voiceSpeaking || listening) ? "close" : "microphone"} size={19} />} />
                </Tooltip>
                <Input.TextArea aria-label="语音识别文本，可编辑" value={draft} maxLength={12000} autoSize={{ minRows: 1, maxRows: 3 }} placeholder="有什么想和我聊的吗…" onChange={event => { setDraft(event.target.value); onDraftChange(event.target.value); }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (draft.trim() && !busy) void sendMessage(draft); } }} />
                <Button className="ai-work-voice__send" type="text" aria-label="发送消息" title="发送消息" disabled={!draft.trim() || busy || !activeAccount} loading={busy} onClick={() => void sendMessage(draft)} icon={<WorkbenchIcon name="arrowRight" size={19} />} />
              </div>
              <section className="ai-work-voice__assistant" aria-label="当前智能助手">
                <span className="ai-work-voice__assistant-icon"><WorkbenchIcon name="browser" size={17} /></span>
                <span className="ai-work-voice__assistant-copy"><strong>智能助手</strong><span>沿用当前 AI Work 会话</span></span>
                <WorkbenchIcon className="ai-work-voice__assistant-spark" name="spark" size={15} />
              </section>
            </div>
            <div className="ai-work-voice__status-bar">
              <span className="ai-work-voice__status-label"><i aria-hidden="true" />AI 主脑 · {voiceStatus}</span>
              <div className="ai-work-voice__settings" aria-label="语音设置">
                {!supportsVoiceInput() ? <span className="ai-work-voice__support-note">当前宿主不支持语音识别</span> : null}
                {settings.aiRuntime.readResponsesAloud && !supportsVoiceOutput() ? <span className="ai-work-voice__support-note">当前宿主不支持语音播报</span> : null}
                <Button className="ai-work-voice__setting-toggle" size="small" type="text" aria-pressed={settings.aiRuntime.voiceInputEnabled} onClick={() => onSettingsChange({ ...settings, aiRuntime: { ...settings.aiRuntime, voiceInputEnabled: !settings.aiRuntime.voiceInputEnabled } })}><WorkbenchIcon name="microphone" size={13} />语音输入 · {settings.aiRuntime.voiceInputEnabled ? "开" : "关"}</Button>
                <span className="ai-work-voice__setting-divider" aria-hidden="true" />
                <Button className="ai-work-voice__setting-toggle" size="small" type="text" aria-pressed={settings.aiRuntime.readResponsesAloud} onClick={() => onSettingsChange({ ...settings, aiRuntime: { ...settings.aiRuntime, readResponsesAloud: !settings.aiRuntime.readResponsesAloud } })}><WorkbenchIcon name="spark" size={13} />回复播报 · {settings.aiRuntime.readResponsesAloud ? "开" : "关"}</Button>
              </div>
            </div>
          </div>
        </main>
      </section>
    );
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
            <div ref={setMessagesElement} onScroll={handleMessagesScroll} onWheel={handleMessagesWheel} onClickCapture={handleResponseHistoryClickCapture} onPointerDown={handleMessagesPointerDown} onPointerUp={handleMessagesPointerUp} onPointerCancel={handleMessagesPointerUp} className="ai-work-chat__messages" aria-live="polite">
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
                  writingProposalLoading={writingProposalLoading}
                  writingProposalBusy={writingProposalBusy}
                  actions={messageRowActions}
                  setEditingMessage={setEditingMessage}
                  setMessageActionError={setMessageActionError}
                  setBranchTargetMessageId={setBranchTargetMessageId}
                  onOpenProjectFileReview={onOpenProjectFileReview}
                  onBrowserToolCompleted={onBrowserToolCompleted}
                />;
              }) : <div className={`ai-work-chat__welcome${appId === "writing" ? " ai-work-chat__welcome--writing" : ""}`}>
            {appId === "writing" ? <>
              <span className="ai-work-chat__welcome-mark" aria-hidden="true"><WorkbenchIcon name="spark" size={22} /></span>
              <div className="ai-work-chat__welcome-copy"><h1>从一个创作目标开始</h1><p>梳理故事设定、人物动机与章节节奏，也可以直接贴一段文字来讨论。</p></div>
              </> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="告诉小鱼你的目标，按需使用应用、技能和专家" />}
            {settings.aiRuntime.promptSuggestions ? <div className={`ai-work-chat__suggestions${appId === "writing" ? " ai-work-chat__suggestions--writing" : ""}`}>{suggestions.workspace.map((suggestion) => <button type="button" key={suggestion} disabled={!activeAccount || busy} onClick={() => void sendMessage(suggestion)}>{suggestion}</button>)}</div> : null}
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
          {planModeActive ? <section className="ai-work-chat__plan-mode" aria-label="计划讨论模式" aria-live="polite">
            <span className="ai-work-chat__plan-mode-icon"><WorkbenchIcon name="spark" size={15} /></span>
            <div className="ai-work-chat__plan-mode-copy"><strong>计划讨论中</strong><span>当前只允许只读查询；确认计划后才会执行写入操作。</span></div>
            <div className="ai-work-chat__plan-mode-actions">
              <Button size="small" disabled={busy || planModeBusy} loading={planModeBusy} onClick={() => void changePlanMode(false)}>退出计划</Button>
              {messages.some(item => item.role === "assistant" && item.status === "complete" && item.content.trim()) ? <Button size="small" type="primary" disabled={busy || planModeBusy} onClick={() => void sendMessage("我已批准目前讨论的计划，请按计划开始执行。", undefined, undefined, { planMode: false })}>批准并执行</Button> : null}
            </div>
          </section> : null}
          {renderPendingComposerInteraction()}
          <form ref={composerFormRef} className="ai-work-chat__composer" aria-label="小鱼智能体 消息输入" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
          {projectDirectoryMissing ? <Alert className="ai-work-chat__directory-warning" type="warning" showIcon message="项目目录已删除或移动" description="当前会话仍可查看历史记录；如需继续工作，请新建会话并选择可用项目目录。" /> : null}
          <div className="ai-work-chat__composer-context" aria-label="当前对话上下文">
            <WorkspaceProjectPicker appId="workspace" applicationName="小鱼智能体" projects={workspaceProjects} projectListStatus={workspaceProjectsLoadStatus} projectListTruncated={workspaceProjectsTruncated} projectLoadError={workspaceProjectsError} onRetryProjects={onRetryWorkspaceProjects} nodes={workspaceNodes} value={selectedProjectId} selectedProjectTitle={activeSessionId ? sessions.find(session => session.id === activeSessionId)?.projectTitle : null} defaultDirectory={settings.general.taskFolder} disabled={projectDirectoryMissing || busy || projectBusy || associationsBusy || Boolean(editingMessage)} onChange={project => void changeWorkspaceProject(project)} onProjectsChange={onWorkspaceProjectsChange} />

            <Tooltip trigger={["hover"]} placement="top" title={applicationNameFor(appId)}>
              <span className="ai-work-chat__composer-app" aria-label={`当前应用：${applicationNameFor(appId)}`}><WorkbenchIcon name="spark" size={13} /><span className="ai-work-chat__composer-app-label">{applicationNameFor(appId)}</span></span>
            </Tooltip>
            <Typography.Text className="ai-work-chat__composer-count" aria-label={`已输入 ${draft.length}，最多 12000 个字符`}>{draft.length}<span>/12000</span></Typography.Text>
          </div>
          {composerMenu ? <div className="ai-work-chat__composer-menu" data-trigger={composerMenu.trigger} style={composerMenuMaxHeight === null ? undefined : { maxHeight: `${composerMenuMaxHeight}px` }} onMouseDown={event => event.preventDefault()}>
            <div className="ai-work-chat__composer-menu-heading">
              <strong>{composerMenu.trigger === "/" ? "命令" : "关联到本次对话"}</strong>
              <span>↑↓ 选择 · Enter 确认 · Esc 关闭</span>
            </div>
            <div id="ai-work-chat-composer-menu" className="ai-work-chat__composer-menu-list" role="listbox" aria-label={composerMenu.trigger === "/" ? "可用聊天命令" : "可关联的应用和能力"}>
              {composerMenuGroups.map(group => <div className="ai-work-chat__composer-menu-group" key={group} role="group" aria-label={group}>
                <span className="ai-work-chat__composer-menu-group-label" role="presentation">{group}</span>
                {composerMenuItems.filter(item => item.group === group).map(item => {
                  const index = composerMenuItems.indexOf(item);
                  const isAssociated = item.association?.kind === "application"
                    ? associations.applicationIds.includes(item.association.id)
                    : item.association?.kind === "capability" && associations.capabilityIds.includes(item.association.id);
                  return <button
                    id={`ai-work-chat-composer-option-${encodeURIComponent(item.id)}`}
                    className="ai-work-chat__composer-menu-option"
                    type="button"
                    role="option"
                    key={item.id}
                    aria-selected={index === composerMenuActiveIndex}
                    aria-disabled={item.disabled || undefined}
                    data-associated={isAssociated || undefined}
                    disabled={item.disabled}
                    onClick={() => applyComposerMenuItem(item)}
                  >
                    <WorkbenchIcon className="ai-work-chat__composer-menu-option-icon" name={item.icon} size={18} />
                    <span className="ai-work-chat__composer-menu-option-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                    {isAssociated ? <span className="ai-work-chat__composer-menu-associated">已关联</span> : null}
                  </button>;
                })}
              </div>)}
              {!composerMenuItems.length ? <div className="ai-work-chat__composer-menu-empty" role="status">{composerMenu.trigger === "@" && capabilitiesError ? `能力目录读取失败：${capabilitiesError}` : "没有匹配项"}</div> : null}
            </div>
          </div> : null}
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
          {pendingAttachments.length > 0 ? (
            <div className="ai-work-chat__attachments" aria-label="待发送附件">
              {pendingAttachments.map(file => (
                <span key={file.id} className="ai-work-chat__attachment">
                  <img className="ai-work-chat__attachment-thumb" src={"/api/attachments/" + file.id + "/content"} alt={file.name} loading="lazy" />
                  <span className="ai-work-chat__attachment-name" title={file.name}>{file.name.length > 18 ? file.name.slice(0, 18) + "…" : file.name}</span>
                  <Button type="text" size="small" aria-label={"移除附件 " + file.name} onClick={() => setPendingAttachments(current => current.filter(item => item.id !== file.id))}>×</Button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="ai-work-chat__composer-actions">
            <div className="ai-work-chat__composer-actions-group" aria-label="添加、权限与更多操作">
              <Tooltip trigger={["hover", "focus"]} placement="bottom" title={attachmentError ?? "添加图片或文本附件（最多 4 个，单个不超过 8 MiB）"}>
                <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--icon" type="text" aria-label="添加附件" loading={attachmentBusy} disabled={attachmentBusy || pendingAttachments.length >= 4} icon={<WorkbenchIcon name="plus" size={18} />} onClick={() => attachmentInputRef.current?.click()} />
              </Tooltip>
              <input ref={attachmentInputRef} type="file" multiple hidden accept="image/png,image/jpeg,image/gif,image/webp,text/plain" onChange={event => { void pickAttachments(event.target.files); event.target.value = ""; }} />
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
                <Tooltip trigger={["hover", "focus"]} placement="bottom" title={`更改权限 · 当前为${permissionModeLabels[settings.permissions.mode]}`}>
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
                getPopupContainer={(trigger) => trigger.closest<HTMLElement>(".ai-work-chat__composer") ?? trigger.closest<HTMLElement>(".workbench-shell") ?? document.body}
                open={composerMoreOpen}
                onOpenChange={(open) => {
                  setComposerMoreOpen(open);
                  if (!open) setComposerMoreSection(null);
                }}
                content={composerMoreContent}
              >
                <Tooltip trigger={["hover", "focus"]} placement="bottom" title="关联应用、Skill、提示词和专家">
                  <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--more" type="text" aria-haspopup="dialog" aria-expanded={composerMoreOpen} aria-label="更多输入操作" icon={<WorkbenchIcon name="grid" size={15} />}><span className="ai-work-chat__composer-control-label">更多</span></Button>
                </Tooltip>
              </Popover>
            </div>
            <div className="ai-work-chat__composer-actions-group ai-work-chat__composer-actions-group--right" aria-label="模型、推理与发送">
              <DshSlotOutlet name="conversation.input.right" owner={conversationInputSlotOwner} />
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
                <Tooltip trigger={["hover", "focus"]} placement="bottom" title={activeAccount ? `选择模型 · ${activeAccount.displayName} · ${activeModel ? `${modelSelectorDisplayLabel(activeModel)} · ${activeAccount.modelId}` : activeAccount.modelId}` : accountLoadState === "loading" ? "模型正在读取当前配置" : accountLoadState === "error" ? "模型状态不可用，请查看错误提示" : "请先在设置中心配置活动模型"}>
                  <span className="ai-work-chat__composer-disabled-wrap" tabIndex={!activeAccount || !activeAccount.models.length || modelBusy || busy ? 0 : -1}>
                    <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--model" type="text" aria-haspopup="dialog" aria-expanded={modelPickerOpen} aria-busy={accountLoadState === "loading" || modelBusy} aria-label={activeAccount ? `模型：${activeModel ? modelSelectorDisplayLabel(activeModel) : activeAccount.modelId} · ${activeAccount.modelId}` : accountLoadState === "loading" ? "模型：正在读取当前配置" : accountLoadState === "error" ? "模型：状态不可用" : "模型：未配置"} disabled={!activeAccount || !activeAccount.models.length || modelBusy || busy}>
                      <WorkbenchIcon name="spark" size={14} />
                      <span className="ai-work-chat__composer-control-label">{activeModel ? <><span className="ai-work-chat__model-name">{activeModel.name}</span>{activeModelVersionTag ? <span className="ai-work-chat__model-version-tag">{activeModelVersionTag}</span> : null}</> : activeAccount?.modelId ?? (accountLoadState === "loading" ? "读取中…" : accountLoadState === "error" ? "不可用" : "模型未配置")}</span>
                      <WorkbenchIcon className="ai-work-chat__composer-control-chevron" name="chevron" size={12} />
                    </Button>
                  </span>
                </Tooltip>
              </Popover>
              <Tooltip trigger={["hover", "focus"]} placement="bottom" title={!settings.aiRuntime.voiceInputEnabled ? "请在设置中心的语音页面开启语音输入" : !supportsVoiceInput() ? "当前宿主不支持语音识别" : listening ? "停止语音输入" : "语音输入，识别后由你发送"}>
                <span className="ai-work-chat__composer-disabled-wrap">
                  <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--icon" type="text" aria-label={listening ? "停止语音输入" : "语音输入"} aria-pressed={listening} disabled={Boolean(editingMessage) || !settings.aiRuntime.voiceInputEnabled || !supportsVoiceInput()} onClick={toggleVoiceInput} icon={<WorkbenchIcon name="microphone" size={17} />} />
                </span>
              </Tooltip>
            {busy && draft.trim() ? <Button htmlType="submit" disabled={projectDirectoryMissing || Boolean(editingMessage) || !activeRunRef.current}>{settings.general.followupBehavior === "queue" ? "发送跟进" : "引导任务"}</Button> : null}
            {settings.aiRuntime.readResponsesAloud ? <Button type="text" onClick={stopVoicePlayback}>停止播报</Button> : null}
            {busy
                ? <>
                  <Tooltip trigger={["hover", "focus"]} placement="bottom" title={runPauseState?.state === "pausing" ? "继续运行（取消待暂停请求）" : runPauseState?.state === "paused" ? "继续当前任务" : "暂停任务；当前模型或工具操作完成后会在安全检查点暂停"}>
                    <span className="ai-work-chat__composer-disabled-wrap" tabIndex={Boolean(editingMessage) || runPauseBusy || !canControlAiRun(activeRunRef.current, stopGuardStartedAtRef.current, Date.now()) || !stopGuardElapsed ? 0 : -1}>
                      <Button className="ai-work-chat__composer-submit ai-work-chat__composer-submit--pause" type="primary" shape="circle" aria-label={runPauseState?.state === "running" || runPauseState?.runId !== activeRunRef.current ? "暂停任务" : "继续任务"} aria-pressed={runPauseState?.state === "paused"} disabled={Boolean(editingMessage) || runPauseBusy || !canControlAiRun(activeRunRef.current, stopGuardStartedAtRef.current, Date.now()) || !stopGuardElapsed} icon={<span className={`ai-work-chat__composer-pause-icon${runPauseState?.state === "running" || runPauseState?.runId !== activeRunRef.current ? "" : " ai-work-chat__composer-pause-icon--resume"}`} aria-hidden="true" />} onClick={() => void toggleAiRunPause()} />
                    </span>
                  </Tooltip>
                  <Tooltip trigger={["hover", "focus"]} placement="bottom" title="停止并终止当前任务">
                    <span className="ai-work-chat__composer-disabled-wrap" tabIndex={Boolean(editingMessage) || !activeRunRef.current ? 0 : -1}>
                      <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--icon" type="text" aria-label="停止并终止当前任务" disabled={Boolean(editingMessage) || !activeRunRef.current} icon={<WorkbenchIcon name="close" size={15} />} onClick={() => { const runId = activeRunRef.current; if (runId) void cancelAiRun(runId).catch(stopError => setError(`停止任务失败：${getErrorMessage(stopError)}`)); }} />
                    </span>
                  </Tooltip>
                </>
                : <Tooltip trigger={["hover", "focus"]} placement="bottom" title={settings.general.sendShortcut === "enter" ? "发送消息 · Enter" : "发送消息 · Ctrl+Enter"}>
                  <span className="ai-work-chat__composer-disabled-wrap" tabIndex={!draft.trim() && pendingAttachments.length === 0 || !activeAccount || projectDirectoryMissing ? 0 : -1}>
                    <Button className="ai-work-chat__composer-submit" type="primary" shape="circle" htmlType="submit" aria-label="发送消息" title={projectDirectoryMissing ? "项目目录已删除或移动，不能继续执行" : "发送消息"} icon={<WorkbenchIcon name="spark" size={15} />} disabled={projectDirectoryMissing || (!draft.trim() && pendingAttachments.length === 0) || !activeAccount} />
                  </span>
                </Tooltip>}
            </div>
          </div>
          </form>
        </div>
        <AiUsageFooter usageSummary={sessionUsageSummary} contextUsage={contextUsage} showContextUsage={settings.aiRuntime.showContextUsage} busy={busy} usageLoadState={sessionUsageLoadState} hasAssistantMessage={Boolean(latestAssistantMessage)} onOpenContextSettings={openAiContextSettings} />
        <Modal
          className="ai-work-chat__writing-review-modal"
          open={writingProposalId !== null}
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

/**
 * 文件：components/AiWorkMessageRow.tsx
 * 功能：呈现一条 AI Work 用户或助手消息及其公开活动和消息级操作。
 * 作用：只消费聊天协调层传入的消息状态、反馈动作和领域回调；保留原消息 DOM 与 memo 边界。
 * 不负责：请求、Session、Run、权限决策或持久化；这些仍由 AiWorkChat 与其服务端 Owner 管理。
 * 关联文件：AiWorkChat.tsx、AiWorkResponse.tsx、response-timeline.ts、activity-duration.ts、ai-work-chat.css。
 */
import { memo, type Dispatch, type SetStateAction } from "react";
import { Button, Input, Tag, Tooltip } from "antd";
import type { AiActivityItem, AiMessage, BrowserProviderId } from "lfaa-client-connection/src/api.js";
import { ApprovalActivityRecord } from "lfaa-client-ui-approval";
import { MessageFeedbackControls } from "lfaa-client-ui-message-feedback";
import { UserQuestionActivityRecord } from "lfaa-client-ui-user-questions";
import { AiActivityToolUsageCard, AiLiveActivityDuration, AiWorkResponse } from "../AiWorkResponse.js";
import { formatAiActivityDuration, getAiActivityDisplayStatus, getAiActivityDurationSeconds, getAiActivitySummary } from "../activity-duration.js";
import type { AiWorkMessageActions, EditingMessage, ExpandedActivitySteps, MessageUsage } from "../message-types.js";
import { splitAiActivityDetail } from "../response-timeline.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

export const emptyAiWorkMessageActions: AiWorkMessageActions = {
  copyMessage: async () => undefined,
  editUserMessage: async () => undefined,
  submitEditedMessage: async () => undefined,
  cancelMessageEditing: () => undefined,
  openMessageFeedback: () => undefined,
  toggleActivityStep: () => undefined,
  openWritingProposal: async () => undefined,
  submitPromptSuggestion: (_messageId, _suggestion) => undefined
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
  subagentStreamPreviews?: Readonly<Record<string, string>>;
  writingProposalLoading: boolean;
  writingProposalBusy: boolean;
  showPromptSuggestions: boolean;
  promptSuggestionDisabled: boolean;
  visiblePromptSuggestions: readonly string[];
  actions: AiWorkMessageActions;
  setEditingMessage: Dispatch<SetStateAction<EditingMessage | null>>;
  setMessageActionError: Dispatch<SetStateAction<string>>;
  setBranchTargetMessageId: Dispatch<SetStateAction<string | null>>;
  onOpenProjectFile?: (projectId: string, path: string, sourceId?: string, initialView?: "source" | "diff") => void;
  onBrowserToolCompleted?: (providerId: BrowserProviderId) => void;
}

export const AiWorkMessageRow = memo(function AiWorkMessageRow({ message, pairedAssistant, usage, editingMessage, anyMessageEditing, pauseState, copied, conversationBusy, activeRunId, liveMessage, branchBusy, hasQueuedRuns, feedbackBusy, showContextUsage, expandedActivitySteps, subagentStreamPreviews, writingProposalLoading, writingProposalBusy, showPromptSuggestions, promptSuggestionDisabled, visiblePromptSuggestions, actions, setEditingMessage, setMessageActionError, setBranchTargetMessageId, onOpenProjectFile, onBrowserToolCompleted }: AiWorkMessageRowProps) {
  const activitySummary = getAiActivitySummary(message);
  const isEditingMessage = editingMessage?.messageId === message.id;
  const canEditMessage = message.role === "user" && pairedAssistant?.role === "assistant" && pairedAssistant.status !== "queued"
    && (!conversationBusy || pairedAssistant.status === "streaming" && activeRunId === pairedAssistant.id)
    && !branchBusy && !hasQueuedRuns
    && (!anyMessageEditing || isEditingMessage);

  const renderActivity = (activity: AiActivityItem) => {
    const activityDetail = splitAiActivityDetail(activity.detail);
    const subagentStreamPreview = subagentStreamPreviews?.[`${message.id}:${activity.id}`];
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
        return change.projectId && onOpenProjectFile
          ? <Button key={key} className="ai-work-chat__file-change-trigger" type="link" size="small" aria-label={`${operation}文件 ${change.path}，在右侧工作区打开`} onClick={() => onOpenProjectFile(change.projectId!, change.path, change.sourceId)}>
              <WorkbenchIcon name="file" size={13} />{operation} <code>{change.path}</code>
            </Button>
          : <span key={key} className="ai-work-chat__file-change-path"><WorkbenchIcon name="file" size={13} />{operation} <code>{change.path}</code></span>;
      })}
      {activityExpanded ? <div className="ai-work-chat__activity-step-detail" id={activityDetailId}>
        {activity.toolUsage && !activity.approvalId ? <AiActivityToolUsageCard usage={activity.toolUsage} stages={activity.toolStages} /> : null}
        {activity.detail && (activity.kind === "command" || activity.kind === "tool") ? <div className={`ai-work-chat__activity-output-card${activity.kind === "command" ? " ai-work-chat__activity-output-card--command" : ""}`}>
          {activityDetail.summary ? <div className="ai-work-chat__activity-output-summary"><strong>执行摘要</strong><p>{activityDetail.summary}</p></div> : null}
          {activityDetail.preview ? <div className="ai-work-chat__activity-output-preview"><strong>{activityDetail.previewLabel}</strong><pre>{activityDetail.preview}</pre></div> : null}
          {subagentStreamPreview ? <div className="ai-work-chat__activity-output-preview"><strong>子 Agent 实时文本（临时预览）</strong><pre>{subagentStreamPreview}</pre></div> : null}
        </div> : activity.detail ? <span className="ai-work-chat__activity-detail">{activity.detail}</span> : null}
        {activity.writingProposalId ? <Button className="ai-work-chat__writing-review-trigger" type="link" size="small" disabled={writingProposalLoading || writingProposalBusy} onClick={() => void actions.openWritingProposal(activity.writingProposalId!)}>审阅修改</Button> : null}
      </div> : null}
    </div>;
  };

  const renderInteraction = (activity: AiActivityItem) => {
    if (activity.approvalId) {
      return <ApprovalActivityRecord key={activity.id} activity={activity}>{renderActivity(activity)}</ApprovalActivityRecord>;
    }
    if (activity.status === "waiting_input") return null;
    return <UserQuestionActivityRecord key={activity.id} activity={activity} />;
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
      </div> : message.role === "assistant" ? <AiWorkResponse message={message} pauseLabel={pauseState === "paused" ? "已暂停" : pauseState === "pausing" ? "正在暂停" : undefined} renderActivity={renderActivity} renderInteraction={renderInteraction} onOpenProjectFile={onOpenProjectFile} onBrowserToolCompleted={onBrowserToolCompleted} /> : message.content}
    </div>
    {message.role === "assistant" && message.status === "complete" && showPromptSuggestions && visiblePromptSuggestions.length ? <section className="ai-work-chat__reply-suggestions" aria-label="基于这次回复的后续建议">
      <span className="ai-work-chat__reply-suggestions-title">接下来可以</span>
      <div className="ai-work-chat__reply-suggestions-list">
        {visiblePromptSuggestions.slice(0, 3).map((suggestion, index) => <button key={`${index}:${suggestion}`} type="button" disabled={promptSuggestionDisabled} aria-label={`发送建议：${suggestion}`} onClick={() => actions.submitPromptSuggestion(message.id, suggestion)}>
          <span>{suggestion}</span><WorkbenchIcon name="arrowRight" size={15} />
        </button>)}
      </div>
    </section> : null}
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
      <MessageFeedbackControls feedback={message.feedback} disabled={feedbackBusy} onRate={rating => actions.openMessageFeedback(message.id, rating)} />
      <Tooltip title="分支到新聊天"><Button className="ai-work-chat__message-action" type="text" size="small" aria-label="从此回复分支到新聊天" disabled={branchBusy} icon={<WorkbenchIcon name="branch" size={15} />} onClick={() => { setMessageActionError(""); setBranchTargetMessageId(message.id); }} /></Tooltip>
      <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time>
    </div> : null}
  </article>;
});


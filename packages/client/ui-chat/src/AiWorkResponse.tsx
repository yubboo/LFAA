/**
 * 功能：在单条 AI Work 回复中按真实落点流式展示正文、工具组和交互。
 * 作用：运行时正文与活动交错；完成后过程收进真实时长折叠行，答案和文件清单保持可见。
 * 关联文件：response-timeline.ts、activity-duration.ts；AiWorkChat 提供原权限/提问/差异交互。
 */
import { memo, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { AiActivityFileChange, AiActivityItem, AiMessage, BrowserProviderId } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { AiMarkdown, AiStreamingMarkdown } from "./AiMarkdown.js";
import { formatAiActivityDuration, getAiActivityActionLabel, getAiActivityDurationSeconds, getAiActivitySummary } from "./activity-duration.js";
import { aiActivityClock } from "./activity-clock.js";
import { buildResponseTimeline, getResponseShimmerHue, latestBrowserPreviewActivity, responseToolGroupLabel, splitAiActivityDetail } from "./response-timeline.js";

export function AiLiveActivityDuration({ activity }: { activity: AiActivityItem }) {
  const now = useSyncExternalStore(aiActivityClock.subscribe, aiActivityClock.getSnapshot, aiActivityClock.getSnapshot);
  return <>{formatAiActivityDuration(getAiActivityDurationSeconds(activity, now))}</>;
}

function AiLiveResponseDuration({ message }: { message: AiMessage }) {
  const now = useSyncExternalStore(aiActivityClock.subscribe, aiActivityClock.getSnapshot, aiActivityClock.getSnapshot);
  return <>{getAiActivitySummary(message, now).durationText}</>;
}

const ResponseText = memo(function ResponseText({ content, streaming }: { content: string; streaming: boolean }) {
  return streaming ? <AiStreamingMarkdown content={content} /> : <AiMarkdown content={content} />;
});

export function AiWorkResponse({ message, pauseLabel, renderActivity, renderInteraction, onOpenProjectFileReview, onBrowserToolCompleted }: {
  message: AiMessage; pauseLabel?: string;
  renderActivity: (activity: AiActivityItem) => ReactNode;
  renderInteraction: (activity: AiActivityItem) => ReactNode;
  onOpenProjectFileReview?: (projectId: string, path: string) => void;
  onBrowserToolCompleted?: (providerId: BrowserProviderId) => void;
}) {
  const summary = getAiActivitySummary(message);
  const presentation = useMemo(() => {
    const activeActivity = summary.activeActivity;
    const hasVisibleContent = Boolean(message.content.trim());
    const replyHasStarted = hasVisibleContent && summary.label === "正在思考" && (!activeActivity || activeActivity.kind === "status");
    const replyIsStreaming = activeActivity?.kind === "status" && summary.label === "正在回复";
    const fallback = replyHasStarted ? "正在回复" : summary.label;
    const currentAction = pauseLabel ?? getAiActivityActionLabel(activeActivity, fallback);
    const shouldShowInlineStatus = Boolean(pauseLabel) || !activeActivity || activeActivity.kind === "status";
    if (!shouldShowInlineStatus) return buildResponseTimeline(message);

    const activeActivityIndex = activeActivity ? message.activity.indexOf(activeActivity) : -1;
    const trailsCurrentText = replyHasStarted || replyIsStreaming;
    const contentOffset = trailsCurrentText || typeof activeActivity?.contentOffset !== "number"
      ? message.content.length
      : activeActivity.contentOffset;
    const order = activeActivity && !trailsCurrentText
      ? activeActivityIndex + (pauseLabel && activeActivity.kind !== "status" ? 0.5 : 0)
      : Number.MAX_SAFE_INTEGER;
    return buildResponseTimeline(message, {
      label: currentAction,
      contentOffset,
      order,
      isProcessing: summary.isProcessing && !pauseLabel
    });
  }, [message.content, message.parts, message.activity, message.status, summary.activeActivity, summary.label, summary.isProcessing, pauseLabel]);
  const streamHue = useMemo(() => getResponseShimmerHue(message.id), [message.id]);
  const [allFilesExpanded, setAllFilesExpanded] = useState(false);
  const finished = message.status !== "streaming" && message.status !== "queued";
  const browserPreviewActivity = useMemo(() => latestBrowserPreviewActivity(message), [message.activity]);
  const browserPreviewDetail = useMemo(() => browserPreviewActivity ? splitAiActivityDetail(browserPreviewActivity.detail) : null, [browserPreviewActivity]);
  // 当前回复的七色流光起点固定由消息 ID 派生，token 增量渲染时不重新随机变色。
  const timeline = <div className="ai-work-chat__response-timeline" style={{ "--ai-work-stream-hue": `${streamHue}deg` } as CSSProperties}>
    {presentation.blocks.map(block => {
      if (block.kind === "text") return <div className="ai-work-chat__response-part" key={block.id}>
        <ResponseText content={block.content} streaming={block.streaming} />
      </div>;
      if (block.kind === "status") return <div
        className={`ai-work-chat__activity-live-status${block.isProcessing ? " ai-work-chat__activity-live-status--processing" : ""}`}
        key={block.id}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      ><span>{block.label}</span></div>;
      if (block.kind === "interaction") {
        const interaction = renderInteraction(block.activity);
        return interaction ? <div className="ai-work-chat__response-interaction" key={block.id}>{interaction}</div> : null;
      }
      if (block.kind === "activity") return <div className="ai-work-chat__response-activity" key={block.id}>{renderActivity(block.activity)}</div>;
      const hasFileChanges = block.activities.some(activity => activity.fileChanges?.some(change => change.operation !== "read"));
      const isCommandGroup = block.activities.every(activity => activity.kind === "command" || activity.title === "执行本机命令" || activity.title === "执行游戏节点命令");
      const isWebGroup = block.activities.some(activity => /搜索|网页|浏览/u.test(activity.title));
      const icon = hasFileChanges ? "file" : isCommandGroup ? "terminal" : isWebGroup ? "browser" : "tools";
      const isRunning = block.activities.some(activity => activity.status === "running");
      return <details className={`ai-work-chat__tool-group${isRunning ? " ai-work-chat__tool-group--running" : ""}`} key={block.id} open={finished}>
        <summary><WorkbenchIcon name={icon} size={14} /><span>{responseToolGroupLabel(block.activities)}</span><WorkbenchIcon name="chevron" size={13} /></summary>
        <div className="ai-work-chat__tool-group-items">{block.activities.map(renderActivity)}</div>
      </details>;
    })}
  </div>;
  const finalAnswer = presentation.finalText ? <div className="ai-work-chat__response-final"><ResponseText content={presentation.finalText} streaming={false} /></div> : null;
  const changedFiles = useMemo(() => {
    const files = new Map<string, AiActivityFileChange>();
    for (const activity of message.activity) {
      for (const change of activity.fileChanges ?? []) {
        if (change.operation === "read") continue;
        files.set(`${change.projectId ?? ""}\u0000${change.path}`, change);
      }
    }
    return [...files.values()];
  }, [message.activity]);
  const operationCounts = changedFiles.reduce((counts, change) => {
    if (change.operation === "created") counts.created++;
    else if (change.operation === "modified") counts.modified++;
    else if (change.operation === "deleted") counts.deleted++;
    return counts;
  }, { created: 0, modified: 0, deleted: 0 });
  const operationSummary = [
    operationCounts.created ? `新建 ${operationCounts.created}` : "",
    operationCounts.modified ? `修改 ${operationCounts.modified}` : "",
    operationCounts.deleted ? `删除 ${operationCounts.deleted}` : ""
  ].filter(Boolean).join(" · ");
  const visibleFiles = allFilesExpanded ? changedFiles : changedFiles.slice(0, 3);
  const hiddenFileCount = changedFiles.length - visibleFiles.length;
  const firstReviewableFile = changedFiles.find(change => change.projectId && onOpenProjectFileReview);
  return <section className={`ai-work-chat__response ai-work-chat__activity--${summary.tone}`}>
    {finished ? <>
      <details className="ai-work-chat__response-history" key={`${message.id}:complete`}>
        <summary>
          <span className="ai-work-chat__response-history-summary">
            <span>{summary.durationText}</span>
            <span className="ai-work-chat__response-history-state" data-tone={summary.tone}>{summary.label}</span>
          </span>
          <WorkbenchIcon name="chevron" size={14} />
        </summary>
        {timeline}
        {!presentation.blocks.length ? <p className="ai-work-chat__response-history-empty">此回复没有保存可展示的过程更新或工具操作。</p> : null}
      </details>
      {/* 正文保持完整且可见；旧记录缺少可靠落点时也不猜测正文与活动的历史顺序。 */}
      {finalAnswer}
      {browserPreviewActivity && browserPreviewDetail?.preview && onBrowserToolCompleted ? <section className="ai-work-chat__response-browser-preview" aria-label="网页预览">
        <span className="ai-work-chat__response-browser-icon" aria-hidden="true"><WorkbenchIcon name="browser" size={18} /></span>
        <span className="ai-work-chat__response-browser-heading"><strong>网页预览</strong><span>{browserPreviewDetail.previewLabel} · {browserPreviewDetail.preview}</span></span>
        <button type="button" className="ai-work-chat__response-browser-open" aria-label="在 LFAA 浏览器中重新打开本轮页面" onClick={() => onBrowserToolCompleted(browserPreviewActivity.browserProviderId!)}>
          <span>打开方式</span><WorkbenchIcon name="chevron" size={14} />
        </button>
      </section> : null}
      {changedFiles.length ? <section className="ai-work-chat__response-file-changes" aria-label="本条回复的文件变更">
        <header>
          <span className="ai-work-chat__response-file-icon" aria-hidden="true"><WorkbenchIcon name="file" size={18} /></span>
          <span className="ai-work-chat__response-file-heading">
            <strong>已更改 {changedFiles.length} 个文件</strong>
            <span>{operationSummary}</span>
          </span>
          {firstReviewableFile ? <button type="button" className="ai-work-chat__response-file-review" aria-label={`查看变更，从 ${firstReviewableFile.path} 开始`} onClick={() => onOpenProjectFileReview?.(firstReviewableFile.projectId!, firstReviewableFile.path)}>查看变更</button> : null}
        </header>
        <ul>{visibleFiles.map((change, index) => {
          const operation = change.operation === "created" ? "新建" : change.operation === "deleted" ? "删除" : "修改";
          const key = `${change.projectId ?? ""}\u0000${change.path}:${index}`;
          return <li key={key}>
            {change.projectId && onOpenProjectFileReview
              ? <button type="button" className="ai-work-chat__response-file-path" aria-label={`${operation}文件 ${change.path}，查看差异与编辑`} onClick={() => onOpenProjectFileReview(change.projectId!, change.path)}><code>{change.path}</code></button>
              : <code className="ai-work-chat__response-file-path">{change.path}</code>}
            <span className={`ai-work-chat__response-file-operation ai-work-chat__response-file-operation--${change.operation}`}>{operation}</span>
          </li>;
        })}</ul>
        {changedFiles.length > 3 ? <button type="button" className="ai-work-chat__response-file-toggle" aria-expanded={allFilesExpanded} onClick={() => setAllFilesExpanded(expanded => !expanded)}>
          <span>{allFilesExpanded ? "收起文件" : `再显示 ${hiddenFileCount} 个文件`}</span>
          <WorkbenchIcon name="chevron" size={14} />
        </button> : null}
      </section> : null}
    </> : <>
      <div className="ai-work-chat__response-duration" role="status"><AiLiveResponseDuration message={message} /></div>
      <div key={`${message.id}:running`}>{timeline}</div>
    </>}
  </section>;
}

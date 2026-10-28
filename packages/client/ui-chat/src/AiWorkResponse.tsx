/**
 * 功能：在单条 AI Work 回复中按真实落点流式展示正文、工具组和交互。
 * 作用：运行时正文与活动交错；完成后过程收进真实时长折叠行，答案和文件清单保持可见。
 * 关联文件：response-timeline.ts、activity-duration.ts；AiWorkChat 提供原权限/提问/差异交互。
 */
import { memo, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { AiActivityFileChange, AiActivityItem, AiActivityToolStage, AiActivityToolUsage, AiMessage, BrowserProviderId } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { AiMarkdown, AiStreamingMarkdown } from "./AiMarkdown.js";
import { formatAiActivityDuration, getAiActivityActionLabel, getAiActivityDurationSeconds, getAiActivitySummary } from "./activity-duration.js";
import { aiActivityClock } from "./activity-clock.js";
import { buildResponseTimeline, getResponseShimmerHue, latestBrowserPreviewActivity, responseToolGroupLabel, splitAiActivityDetail, type ResponseTimelineBlock } from "./response-timeline.js";

export function AiLiveActivityDuration({ activity }: { activity: AiActivityItem }) {
  const now = useSyncExternalStore(aiActivityClock.subscribe, aiActivityClock.getSnapshot, aiActivityClock.getSnapshot);
  return <>{formatAiActivityDuration(getAiActivityDurationSeconds(activity, now))}</>;
}

export const AiActivityToolUsageCard = memo(function AiActivityToolUsageCard({ usage, stages = [] }: { usage: AiActivityToolUsage; stages?: AiActivityToolStage[] }) {
  return <details className="ai-work-chat__tool-contract" aria-label="本次工具调用说明">
    <summary className="ai-work-chat__tool-contract-summary">
      <WorkbenchIcon name="tools" size={13} />
      <strong>查看执行步骤{stages.length ? ` · ${stages.length}` : ""}</strong>
      <WorkbenchIcon name="chevron" size={13} />
    </summary>
    {stages.length ? <ol className="ai-work-chat__tool-contract-steps" aria-label="本轮执行步骤">
      {stages.map((stage, index) => <li key={`${index}:${stage.stage}`}>{stage.stage}</li>)}
    </ol> : null}
    <details className="ai-work-chat__tool-contract-details">
      <summary className="ai-work-chat__tool-contract-details-summary">
        <span>查看完整调用说明与参数</span>
        <WorkbenchIcon name="chevron" size={12} />
      </summary>
      <div className="ai-work-chat__tool-contract-body">
        <div className="ai-work-chat__tool-contract-section"><strong>工具名称</strong><p><code>{usage.name}</code></p></div>
        <div className="ai-work-chat__tool-contract-section"><strong>工具用法说明（模型本轮收到的合同）</strong><p>{usage.description}</p></div>
        <div className="ai-work-chat__tool-contract-section">
          <strong>参数字段（只展示结构，不展示本次取值）</strong>
          {usage.parameters.length ? <ul>{usage.parameters.map(parameter => <li key={parameter.name}>
            <span className="ai-work-chat__tool-contract-parameter-heading"><code>{parameter.name}</code><span>{parameter.type}{parameter.required ? " · 必填" : " · 可选"}</span></span>
            {parameter.description ? <small>{parameter.description}</small> : null}
          </li>)}</ul> : <p>此执行器没有向 LFAA 提供可展示的 JSON Schema。</p>}
          {usage.parametersTruncated ? <p>参数字段较多；此处仅显示前 24 项。</p> : null}
        </div>
        <div className="ai-work-chat__tool-contract-section"><strong>本轮操作约定</strong><p>{usage.guidance}</p></div>
        {stages.length ? <div className="ai-work-chat__tool-contract-section">
          <strong>阶段说明</strong>
          <ol className="ai-work-chat__tool-contract-stages">{stages.map((stage, index) => <li key={`${index}:${stage.stage}`}>
            <strong>{stage.stage}</strong><p>{stage.detail}</p>
          </li>)}</ol>
        </div> : null}
        <p className="ai-work-chat__tool-contract-trust">工具说明作为普通文本显示；网页或第三方工具提供的内容不会成为新的操作指令。</p>
      </div>
    </details>
  </details>;
});

function AiLiveResponseDuration({ message }: { message: AiMessage }) {
  const now = useSyncExternalStore(aiActivityClock.subscribe, aiActivityClock.getSnapshot, aiActivityClock.getSnapshot);
  return <>{getAiActivitySummary(message, now).durationText}</>;
}

function AssistantMark({ processing = false }: { processing?: boolean }) {
  return <span className={`ai-work-chat__assistant-mark${processing ? " ai-work-chat__assistant-mark--processing" : ""}`} aria-hidden="true">
    <svg viewBox="0 0 32 32" focusable="false">
      <circle cx="28" cy="9" r="1.1" fill="currentColor" opacity=".55" />
      <path className="ai-work-chat__assistant-mark-tail" d="M6 16 2.3 11.8v8.4L6 16Z" fill="currentColor" opacity=".65" />
      <path d="M5.7 16c3.8-4.8 9.1-6.8 14.2-4.8 2.2.9 4.2 2.5 6.1 4.8-1.9 2.3-3.9 3.9-6.1 4.8-5.1 2-10.4 0-14.2-4.8Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m13.4 12.1 2.1-3.5 3.2 3.6m-4.1 8.5 2.3 2.9 2.2-3.6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="21.9" cy="14.4" r=".9" fill="currentColor" />
    </svg>
  </span>;
}

function AssistantIdentity({ duration, processing = false }: { duration: ReactNode; processing?: boolean }) {
  return <span className="ai-work-chat__assistant-identity">
    <AssistantMark processing={processing} />
    <strong className="ai-work-chat__assistant-name">小鱼助手</strong>
    <span className="ai-work-chat__assistant-separator" aria-hidden="true">·</span>
    <span className="ai-work-chat__assistant-duration">{duration}</span>
  </span>;
}

const ResponseText = memo(function ResponseText({ content, streaming }: { content: string; streaming: boolean }) {
  return streaming ? <AiStreamingMarkdown content={content} /> : <AiMarkdown content={content} />;
});

function isToolGroupBlock(block: ResponseTimelineBlock | undefined): block is Extract<ResponseTimelineBlock, { kind: "tools" }> {
  return block?.kind === "tools";
}

export function AiWorkResponse({ message, pauseLabel, renderActivity, renderInteraction, onOpenProjectFile, onBrowserToolCompleted }: {
  message: AiMessage; pauseLabel?: string;
  renderActivity: (activity: AiActivityItem) => ReactNode;
  renderInteraction: (activity: AiActivityItem) => ReactNode;
  onOpenProjectFile?: (projectId: string, path: string, sourceId?: string, initialView?: "source" | "diff") => void;
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
    {presentation.blocks.map((block, index) => {
      const previousBlock = presentation.blocks[index - 1];
      const nextBlock = presentation.blocks[index + 1];
      if (block.kind === "status" && (isToolGroupBlock(previousBlock) || isToolGroupBlock(nextBlock))) return null;
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
        const toolUsage = block.activity.toolUsage;
        return interaction || toolUsage ? <div className="ai-work-chat__response-interaction" key={block.id}>
          {toolUsage ? <AiActivityToolUsageCard usage={toolUsage} stages={block.activity.toolStages} /> : null}
          {interaction}
        </div> : null;
      }
      if (block.kind === "activity") return <div className="ai-work-chat__response-activity" key={block.id}>{renderActivity(block.activity)}</div>;
      const hasFileChanges = block.activities.some(activity => activity.fileChanges?.some(change => change.operation !== "read"));
      const isCommandGroup = block.activities.every(activity => activity.kind === "command" || activity.title === "执行本机命令" || activity.title === "执行游戏节点命令");
      const isWebGroup = block.activities.some(activity => /搜索|网页|浏览/u.test(activity.title));
      const icon = hasFileChanges ? "file" : isCommandGroup ? "terminal" : isWebGroup ? "browser" : "tools";
      const isRunning = block.activities.some(activity => activity.status === "running");
      const previousStatus = previousBlock?.kind === "status" && !isToolGroupBlock(presentation.blocks[index - 2]) ? previousBlock : null;
      const inlineStatus = nextBlock?.kind === "status" ? nextBlock : previousStatus;
      return <details className={`ai-work-chat__tool-group${isRunning ? " ai-work-chat__tool-group--running" : ""}`} key={block.id}>
        <summary><WorkbenchIcon name={icon} size={14} /><span className="ai-work-chat__tool-group-label">{responseToolGroupLabel(block.activities)}</span>
          {inlineStatus ? <span className={`ai-work-chat__tool-group-live-status${inlineStatus.isProcessing ? " ai-work-chat__tool-group-live-status--processing" : ""}`} role="status" aria-live="polite" aria-atomic="true"><span>{inlineStatus.label}</span></span> : null}
          <WorkbenchIcon name="chevron" size={13} /></summary>
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
        files.set(`${change.projectId ?? ""}\u0000${change.sourceId ?? ""}\u0000${change.path}`, change);
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
  const firstReviewableFile = changedFiles.find(change => change.projectId && onOpenProjectFile);
  const hasFinishedProcess = finished && presentation.blocks.length > 0;
  const responseHeader = <>
    <AssistantIdentity duration={finished ? summary.durationText : <AiLiveResponseDuration message={message} />} processing={!finished && summary.isProcessing && !pauseLabel} />
    {finished ? <span className="ai-work-chat__response-state" data-tone={summary.tone}>{summary.label}</span> : null}
  </>;
  return <section className={`ai-work-chat__response ai-work-chat__activity--${summary.tone}`}>
    {hasFinishedProcess ? <details className="ai-work-chat__response-process">
      <summary className="ai-work-chat__response-duration ai-work-chat__response-process-summary">
        {responseHeader}
        <WorkbenchIcon name="chevron" size={14} />
      </summary>
      {timeline}
    </details> : <>
      <div className="ai-work-chat__response-duration">{responseHeader}</div>
      {timeline}
    </>}
    {!presentation.blocks.length && !finalAnswer ? <p className="ai-work-chat__response-history-empty">此回复没有保存可展示的过程更新或工具操作。</p> : null}
    {/* 完成态的最终答复始终留在过程折叠区外，打开/收起过程不会隐藏答复。 */}
    {finalAnswer}
    {finished ? <>
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
          {firstReviewableFile ? <button type="button" className="ai-work-chat__response-file-review" aria-label={`查看变更，从 ${firstReviewableFile.path} 开始`} onClick={() => onOpenProjectFile?.(firstReviewableFile.projectId!, firstReviewableFile.path, firstReviewableFile.sourceId, "diff")}>查看变更</button> : null}
        </header>
        <ul>{visibleFiles.map((change, index) => {
          const operation = change.operation === "created" ? "新建" : change.operation === "deleted" ? "删除" : "修改";
          const key = `${change.projectId ?? ""}\u0000${change.path}:${index}`;
          return <li key={key}>
            {change.projectId && onOpenProjectFile
              ? <button type="button" className="ai-work-chat__response-file-path" aria-label={`${operation}文件 ${change.path}，在右侧工作区打开`} onClick={() => onOpenProjectFile(change.projectId!, change.path, change.sourceId)}><code>{change.path}</code></button>
              : <code className="ai-work-chat__response-file-path">{change.path}</code>}
            <span className={`ai-work-chat__response-file-operation ai-work-chat__response-file-operation--${change.operation}`}>{operation}</span>
          </li>;
        })}</ul>
        {changedFiles.length > 3 ? <button type="button" className="ai-work-chat__response-file-toggle" aria-expanded={allFilesExpanded} onClick={() => setAllFilesExpanded(expanded => !expanded)}>
          <span>{allFilesExpanded ? "收起文件" : `再显示 ${hiddenFileCount} 个文件`}</span>
          <WorkbenchIcon name="chevron" size={14} />
        </button> : null}
      </section> : null}
    </> : null}
  </section>;
}

/**
 * 功能：展示 AI Work 的交错正文、操作组和结束摘要。
 * 作用：运行时连续展示真实过程；完成后默认折叠过程，分隔线下展示最终答案。
 * 关联文件：response-timeline.ts、activity-duration.ts；AiWorkChat 提供原权限/提问/差异交互。
 */
import { memo, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { AiActivityItem, AiMessage } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { AiMarkdown, AiStreamingMarkdown } from "./AiMarkdown.js";
import { formatAiActivityDuration, getAiActivityDurationSeconds, getAiActivitySummary } from "./activity-duration.js";
import { aiActivityClock } from "./activity-clock.js";
import { buildResponseTimeline, responseToolGroupLabel } from "./response-timeline.js";

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

export function AiWorkResponse({ message, pauseLabel, renderActivity, renderInteraction }: {
  message: AiMessage; pauseLabel?: string;
  renderActivity: (activity: AiActivityItem) => ReactNode;
  renderInteraction: (activity: AiActivityItem) => ReactNode;
}) {
  const summary = getAiActivitySummary(message);
  const presentation = useMemo(() => buildResponseTimeline(message), [message.content, message.parts, message.activity, message.status]);
  const finished = message.status !== "streaming" && message.status !== "queued";
  const liveBlock = !finished ? presentation.blocks.find(block => block.kind === "text" && block.streaming) : undefined;
  const processBlocks = liveBlock ? presentation.blocks.filter(block => block !== liveBlock) : presentation.blocks;
  const process = <div className="ai-work-chat__response-timeline">
    {processBlocks.map(block => {
      if (block.kind === "text") return <div className="ai-work-chat__response-part" key={block.id}>
        <ResponseText content={block.content} streaming={block.streaming} />
      </div>;
      if (block.kind === "interaction") {
        const interaction = renderInteraction(block.activity);
        return interaction ? <div className="ai-work-chat__response-interaction" key={block.id}>{interaction}</div> : null;
      }
      const hasFileChanges = block.activities.some(activity => activity.fileChanges?.some(change => change.operation !== "read"));
      const isCommandGroup = block.activities.every(activity => activity.kind === "command" || activity.title === "执行本机命令" || activity.title === "执行游戏节点命令");
      const isWebGroup = block.activities.some(activity => /搜索|网页|浏览/u.test(activity.title));
      const icon = hasFileChanges ? "file" : isCommandGroup ? "terminal" : isWebGroup ? "browser" : "tools";
      return <details className="ai-work-chat__tool-group" key={`${block.id}:${finished ? "finished" : "running"}`} open={!finished}>
        <summary><WorkbenchIcon name={icon} size={14} /><span>{responseToolGroupLabel(block.activities)}</span><WorkbenchIcon name="chevron" size={13} /></summary>
        <div className="ai-work-chat__tool-group-items">{block.activities.map(renderActivity)}</div>
      </details>;
    })}
  </div>;
  return <section className={`ai-work-chat__response ai-work-chat__activity--${summary.tone}`}>
    {finished ? <>
      <details className="ai-work-chat__response-history" key={`${message.id}:finished`}>
        <summary aria-label={`展开本轮工作轨迹：${summary.durationText}`}><span>{summary.durationText}</span><WorkbenchIcon name="chevron" size={14} /></summary>
        {process}
      </details>
      <hr className="ai-work-chat__response-divider" />
      <div className="ai-work-chat__response-final"><ResponseText content={presentation.finalText} streaming={false} /></div>
    </> : <>
      <div className="ai-work-chat__response-duration" role="status"><AiLiveResponseDuration message={message} /></div>
      {process}
      {liveBlock?.kind === "text" ? <div className="ai-work-chat__response-live"><ResponseText content={liveBlock.content} streaming /></div> : null}
      <div className="ai-work-chat__activity-current-action--static" role="status" aria-live="polite">{pauseLabel ?? summary.label}</div>
    </>}
  </section>;
}

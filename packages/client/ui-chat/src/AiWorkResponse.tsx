/**
 * 功能：展示 AI Work 的交错正文、操作组和结束摘要。
 * 作用：运行时连续展示真实过程；完成后默认折叠过程，分隔线下展示最终答案。
 * 关联文件：response-timeline.ts、activity-duration.ts；AiWorkChat 提供原权限/提问/差异交互。
 */
import { memo, useMemo, type ReactNode } from "react";
import type { AiActivityItem, AiMessage } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { AiMarkdown, AiStreamingMarkdown } from "./AiMarkdown.js";
import { getAiActivitySummary } from "./activity-duration.js";
import { buildResponseTimeline, responseToolGroupLabel } from "./response-timeline.js";

const ResponseText = memo(function ResponseText({ content, streaming }: { content: string; streaming: boolean }) {
  return streaming ? <AiStreamingMarkdown content={content} /> : <AiMarkdown content={content} />;
});

export function AiWorkResponse({ message, now, pauseLabel, renderActivity, renderInteraction }: {
  message: AiMessage; now: number; pauseLabel?: string;
  renderActivity: (activity: AiActivityItem) => ReactNode;
  renderInteraction: (activity: AiActivityItem) => ReactNode;
}) {
  const summary = getAiActivitySummary(message, now);
  const presentation = useMemo(() => buildResponseTimeline(message), [message.content, message.parts, message.activity, message.status]);
  const finished = message.status !== "streaming" && message.status !== "queued";
  const liveBlock = !finished ? presentation.blocks.find(block => block.kind === "text" && block.streaming) : undefined;
  const processBlocks = liveBlock ? presentation.blocks.filter(block => block !== liveBlock) : presentation.blocks;
  const process = <div className="ai-work-chat__response-timeline">
    {processBlocks.map(block => block.kind === "text" ? <div className="ai-work-chat__response-part" key={block.id}>
      <ResponseText content={block.content} streaming={block.streaming} />
    </div> : block.kind === "interaction" ? <div className="ai-work-chat__response-interaction" key={block.id}>{renderInteraction(block.activity)}</div>
      : <details className="ai-work-chat__tool-group" key={block.id}>
        <summary><WorkbenchIcon name={block.activities.some(activity => activity.fileChanges?.length) ? "file" : "terminal"} size={14} /><span>{responseToolGroupLabel(block.activities)}</span><WorkbenchIcon name="chevron" size={13} /></summary>
        <div className="ai-work-chat__tool-group-items">{block.activities.map(renderActivity)}</div>
      </details>)}
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
      <div className="ai-work-chat__response-duration" role="status">{summary.durationText}</div>
      {process}
      {liveBlock?.kind === "text" ? <div className="ai-work-chat__response-live"><ResponseText content={liveBlock.content} streaming /></div> : null}
      <div className="ai-work-chat__activity-current-action--static" role="status" aria-live="polite">{pauseLabel ?? summary.label}</div>
    </>}
  </section>;
}

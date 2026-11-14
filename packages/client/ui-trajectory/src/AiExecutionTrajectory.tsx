/** 功能：渲染公开执行活动与真实状态。作用：聊天层提供消息块及问题/审批/详情 Owner 插槽。 */
import type { CSSProperties, ReactNode } from "react";
import type { AiActivityItem, AiActivityToolStage, AiActivityToolUsage } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { responseToolGroupLabel, type ResponseTimelineBlock } from "./response-timeline.js";

export interface AiExecutionTrajectoryProps {
  blocks: ResponseTimelineBlock[];
  streamHue: number;
  renderText: (content: string, streaming: boolean) => ReactNode;
  renderActivity: (activity: AiActivityItem) => ReactNode;
  renderInteraction: (activity: AiActivityItem) => ReactNode;
  renderToolUsage?: (usage: AiActivityToolUsage, stages?: AiActivityToolStage[]) => ReactNode;
}

const AI_TOOL_GROUP_SCROLL_MIN_ACTIVITY_COUNT = 6;

function isToolGroupBlock(block: ResponseTimelineBlock | undefined): block is Extract<ResponseTimelineBlock, { kind: "tools" }> {
  return block?.kind === "tools";
}

export function AiExecutionTrajectory({ blocks, streamHue, renderText, renderActivity, renderInteraction, renderToolUsage }: AiExecutionTrajectoryProps) {
  return <div className="ai-work-chat__response-timeline" style={{ "--ai-work-stream-hue": `${streamHue}deg` } as CSSProperties}>
    {blocks.map((block, index) => {
      const previousBlock = blocks[index - 1];
      const nextBlock = blocks[index + 1];
      if (block.kind === "status" && (isToolGroupBlock(previousBlock) || isToolGroupBlock(nextBlock))) return null;
      if (block.kind === "text") return <div className="ai-work-chat__response-part" key={block.id}>
        {renderText(block.content, block.streaming)}
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
          {toolUsage ? renderToolUsage?.(toolUsage, block.activity.toolStages) : null}
          {interaction}
        </div> : null;
      }
      if (block.kind === "activity") return <div className="ai-work-chat__response-activity" key={block.id}>{renderActivity(block.activity)}</div>;
      const hasFileChanges = block.activities.some(activity => activity.fileChanges?.some(change => change.operation !== "read"));
      const isCommandGroup = block.activities.every(activity => activity.kind === "command" || activity.title === "执行本机命令" || activity.title === "执行游戏节点命令");
      const isWebGroup = block.activities.some(activity => /搜索|网页|浏览/u.test(activity.title));
      const icon = hasFileChanges ? "file" : isCommandGroup ? "terminal" : isWebGroup ? "browser" : "tools";
      const isRunning = block.activities.some(activity => activity.status === "running");
      const hasManyActivities = block.activities.length >= AI_TOOL_GROUP_SCROLL_MIN_ACTIVITY_COUNT;
      const previousStatus = previousBlock?.kind === "status" && !isToolGroupBlock(blocks[index - 2]) ? previousBlock : null;
      const inlineStatus = nextBlock?.kind === "status" ? nextBlock : previousStatus;
      return <details className={`ai-work-chat__tool-group${isRunning ? " ai-work-chat__tool-group--running" : ""}`} key={block.id}>
        <summary><WorkbenchIcon name={icon} size={14} /><span className="ai-work-chat__tool-group-label">{responseToolGroupLabel(block.activities)}</span>
          {inlineStatus ? <span className={`ai-work-chat__tool-group-live-status${inlineStatus.isProcessing ? " ai-work-chat__tool-group-live-status--processing" : ""}`} role="status" aria-live="polite" aria-atomic="true"><span>{inlineStatus.label}</span></span> : null}
          <WorkbenchIcon name="chevron" size={13} /></summary>
        <div className={`ai-work-chat__tool-group-items${hasManyActivities ? " ai-work-chat__tool-group-items--scrollable" : ""}`}>{block.activities.map(renderActivity)}</div>
      </details>;
    })}
  </div>;
}

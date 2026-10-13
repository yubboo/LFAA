/**
 * 功能：将真实正文范围和活动落点投影为交错的工作过程。
 * 作用：只保留一份正文，区分阶段说明和最终答案；旧记录不猜测分段。
 * 关联文件：AiWorkResponse.tsx 展示；Connection 和 Session 提供范围及活动。
 */
import type { AiActivityItem, AiMessage, AiReplyPart } from "lfaa-client-connection/src/api.js";

export type ResponseTimelineBlock = { kind: "text"; id: string; content: string; streaming: boolean }
  | { kind: "tools"; id: string; activities: AiActivityItem[] }
  | { kind: "interaction"; id: string; activity: AiActivityItem };

export function buildResponseTimeline(message: AiMessage): { blocks: ResponseTimelineBlock[]; finalText: string } {
  const finished = message.status !== "streaming" && message.status !== "queued";
  const parts = message.parts?.length ? message.parts : undefined;
  // 历史消息没有可靠分段，不根据标点或内容关键词制造过程。
  let finalPart: AiReplyPart | undefined;
  if (finished && parts) finalPart = [...parts].reverse().find(part => part.kind === "final") ?? parts.at(-1);
  const entries: Array<{ offset: number; order: number; block: Exclude<ResponseTimelineBlock, { kind: "tools" }> | { kind: "activity"; id: string; activity: AiActivityItem } }> = [];
  for (const [order, activity] of message.activity.entries()) {
    if (activity.kind === "status" && activity.title !== "上下文管理" && activity.status !== "error" && activity.status !== "unavailable") continue;
    entries.push({ offset: activity.contentOffset ?? 0, order, block: { kind: activity.kind === "question" || activity.approvalId ? "interaction" : "activity", id: activity.id, activity } });
  }
  for (const [index, part] of (parts ?? []).entries()) {
    if (part === finalPart || part.end <= part.start) continue;
    entries.push({ offset: part.start, order: message.activity.length + index, block: { kind: "text", id: part.id, content: message.content.slice(part.start, part.end), streaming: !finished && index === parts!.length - 1 } });
  }
  if (!parts && !finished && message.content) entries.push({ offset: 0, order: -1, block: { kind: "text", id: "legacy", content: message.content, streaming: true } });
  entries.sort((a, b) => a.offset - b.offset || a.order - b.order);
  const blocks: ResponseTimelineBlock[] = [];
  for (const { block } of entries) {
    if (block.kind !== "activity") { blocks.push(block); continue; }
    const previous = blocks.at(-1);
    if (previous?.kind === "tools") previous.activities.push(block.activity);
    else blocks.push({ kind: "tools", id: block.id, activities: [block.activity] });
  }
  return { blocks, finalText: finished ? finalPart ? message.content.slice(finalPart.start, finalPart.end) : message.content : "" };
}

/** 文案只描述活动元数据，不据标签决定或执行业务。 */
export function responseToolGroupLabel(activities: AiActivityItem[]): string {
  const labels = activities.map(activity => activity.fileChanges?.some(change => change.operation !== "read") ? "编辑了文件"
    : activity.kind === "command" || activity.title === "执行本机命令" || activity.title === "执行游戏节点命令" ? "运行了命令"
      : activity.title === "搜索网页" && activity.status === "complete" ? "已搜索网页"
      : /搜索|网页|浏览/u.test(activity.title) ? activity.title
        : activity.title === "上下文管理" ? "已优化对话" : activity.title);
  const unique = [...new Set(labels)];
  return unique.slice(0, 3).join(" · ") + (unique.length > 3 ? ` · 等 ${activities.length} 项操作` : "");
}

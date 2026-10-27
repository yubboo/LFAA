/**
 * 功能：将真实正文范围和活动落点投影为交错的工作过程。
 * 作用：只保留一份正文，区分阶段说明和最终答案；旧记录不猜测分段。
 * 关联文件：AiWorkResponse.tsx 展示；Connection 和 Session 提供范围及活动。
 */
import type { AiActivityItem, AiMessage, AiReplyPart } from "lfaa-client-connection/src/api.js";
import { isBuiltinBrowserProvider } from "lfaa-util-values/src/browser-provider.js";
import { getAiActivityActionLabel } from "./activity-duration.js";

export type ResponseTimelineBlock = { kind: "text"; id: string; content: string; streaming: boolean }
  | { kind: "activity"; id: string; activity: AiActivityItem }
  | { kind: "tools"; id: string; activities: AiActivityItem[] }
  | { kind: "interaction"; id: string; activity: AiActivityItem }
  | { kind: "status"; id: string; label: string; isProcessing: boolean };

export interface ResponseTimelineLiveStatus {
  label: string;
  contentOffset: number;
  order: number;
  isProcessing: boolean;
}

interface CachedTimelineEntry {
  offset: number;
  order: number;
  block: Exclude<ResponseTimelineBlock, { kind: "tools" }>;
  textRange?: { start: number; end: number };
  fullContent?: boolean;
}

interface CachedTimelineStructure {
  finished: boolean;
  entries: CachedTimelineEntry[];
}

// 同一条流的每次文本增量复用已排序的活动/分段结构；活动或 parts 更新时以新数组键重建。
const responseTimelineStructures = new WeakMap<AiActivityItem[], CachedTimelineStructure>();

function timelineStructureFor(message: AiMessage, finished: boolean): CachedTimelineStructure {
  const cached = responseTimelineStructures.get(message.activity);
  if (cached && cached.finished === finished) return cached;

  const entries: CachedTimelineEntry[] = [];
  for (const [order, activity] of message.activity.entries()) {
    // 这两项是 Agent Loop 的能力/权限说明元数据，不代表本轮执行的工作。
    if ((activity.kind === "agent" && activity.title === "小鱼主 Agent") || (activity.kind === "tool" && activity.title === "已登记项目工具")) continue;
    // 模型请求、推理和接收阶段是协议进度，不是用户要回看的工作；只保留真实上下文整理和可操作错误。
    const contextOptimization = activity.kind === "status" && activity.title === "上下文管理" && activity.status === "complete";
    if (activity.kind === "status" && !contextOptimization && activity.status !== "error" && activity.status !== "unavailable") continue;
    const visibleActivity = contextOptimization ? { ...activity, title: "已优化对话" } : activity;
    entries.push({ offset: activity.contentOffset ?? 0, order, block: { kind: activity.kind === "question" || activity.approvalId ? "interaction" : "activity", id: activity.id, activity: visibleActivity } });
  }
  entries.sort((a, b) => a.offset - b.offset || a.order - b.order);
  const structure = { finished, entries };
  responseTimelineStructures.set(message.activity, structure);
  return structure;
}

function compareTimelineEntries(left: CachedTimelineEntry, right: CachedTimelineEntry): number {
  return left.offset - right.offset || left.order - right.order;
}

/** 为每条回复稳定派生彩色流光相位，token 增量渲染时不会重新随机变色。 */
export function getResponseShimmerHue(messageId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < messageId.length; index++) {
    hash = Math.imul(hash ^ messageId.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0) % 360;
}

export function buildResponseTimeline(message: AiMessage, liveStatus?: ResponseTimelineLiveStatus): { blocks: ResponseTimelineBlock[]; finalText: string } {
  const finished = message.status !== "streaming" && message.status !== "queued";
  // 历史消息没有可靠分段，不根据标点或内容关键词制造过程。
  const structure = timelineStructureFor(message, finished);
  const parts = message.parts?.length ? message.parts : undefined;
  let finalPart: AiReplyPart | undefined;
  const textEntries: CachedTimelineEntry[] = [];
  if (parts) {
    if (finished) finalPart = [...parts].reverse().find(part => part.kind === "final") ?? parts.at(-1);
    for (const [index, part] of parts.entries()) {
      if (part === finalPart || part.end <= part.start) continue;
      textEntries.push({
        offset: part.start,
        order: message.activity.length + index,
        block: { kind: "text", id: part.id, content: "", streaming: !finished && index === parts.length - 1 },
        textRange: { start: part.start, end: part.end }
      });
    }
    textEntries.sort(compareTimelineEntries);
  } else if (!finished) {
    textEntries.push({ offset: 0, order: -1, block: { kind: "text", id: "legacy", content: "", streaming: true }, fullContent: true });
  }
  let liveEntry: CachedTimelineEntry | null = null;
  if (!finished && liveStatus) {
    const contentOffset = Math.min(message.content.length, Math.max(0, Math.floor(liveStatus.contentOffset)));
    liveEntry = { offset: contentOffset, order: liveStatus.order, block: {
      kind: "status", id: "live-status", label: liveStatus.label, isProcessing: liveStatus.isProcessing
    } };
  }
  const blocks: ResponseTimelineBlock[] = [];
  const appendEntry = (entry: CachedTimelineEntry) => {
    const { block } = entry;
    if (block.kind === "text") {
      if (entry.fullContent && !message.content) return;
      const content = entry.fullContent ? message.content : message.content.slice(entry.textRange!.start, entry.textRange!.end);
      const previous = blocks.at(-1);
      if (previous?.kind === "text") {
        // Markdown 语法可以跨模型请求分段；没有活动记录隔开时，按一段连续正文渲染。
        previous.content += content;
        previous.streaming ||= block.streaming;
      } else blocks.push({ ...block, content });
      return;
    }
    if (block.kind !== "activity") { blocks.push(block); return; }
    // 上下文整理保留为一条简短独立活动；模型请求阶段不混进用户回复流。
    if (block.activity.kind === "status") { blocks.push(block); return; }
    const previous = blocks.at(-1);
    if (previous?.kind === "tools") previous.activities.push(block.activity);
    else blocks.push({ kind: "tools", id: block.id, activities: [block.activity] });
  };
  let liveInserted = false;
  let activityIndex = 0;
  let textIndex = 0;
  while (activityIndex < structure.entries.length || textIndex < textEntries.length) {
    const activityEntry = structure.entries[activityIndex];
    const textEntry = textEntries[textIndex];
    const entry = !activityEntry ? textEntry! : !textEntry ? activityEntry
      : compareTimelineEntries(activityEntry, textEntry) <= 0 ? activityEntry : textEntry;
    if (entry === activityEntry) activityIndex += 1;
    else textIndex += 1;
    // 已排序活动结构按数组身份复用；正文段和当前状态只做线性归并，不重排整条时间线。
    if (liveEntry && !liveInserted && (liveEntry.offset < entry.offset || liveEntry.offset === entry.offset && liveEntry.order < entry.order)) {
      appendEntry(liveEntry);
      liveInserted = true;
    }
    appendEntry(entry);
  }
  if (liveEntry && !liveInserted) appendEntry(liveEntry);
  return { blocks, finalText: finished ? finalPart ? message.content.slice(finalPart.start, finalPart.end) : message.content : "" };
}

/** 文案只描述活动元数据，不据标签决定或执行业务。 */
export function responseToolGroupLabel(activities: AiActivityItem[]): string {
  const runningActivities = activities.filter(activity => activity.status === "running");
  if (runningActivities.length === 1) return getAiActivityActionLabel(runningActivities[0], "正在思考");
  if (runningActivities.length > 1) return `正在运行 ${runningActivities.length} 项`;
  const changedActivities = activities.filter(activity => activity.fileChanges?.some(change => change.operation !== "read"));
  if (changedActivities.length === activities.length) {
    const paths = new Set(changedActivities.flatMap(activity => activity.fileChanges!.filter(change => change.operation !== "read").map(change => change.path)));
    return paths.size > 1 ? `更改了 ${paths.size} 个文件` : "编辑了文件";
  }
  const commandActivities = activities.filter(activity => activity.kind === "command" || activity.title === "执行本机命令" || activity.title === "执行游戏节点命令");
  if (commandActivities.length === activities.length) return activities.length > 1 ? `运行了 ${activities.length} 条命令` : "运行了命令";
  const labels = activities.map(activity => activity.fileChanges?.some(change => change.operation !== "read") ? "编辑了文件"
    : activity.kind === "command" || activity.title === "执行本机命令" || activity.title === "执行游戏节点命令" ? "运行了命令"
      : activity.title === "搜索网页" && activity.status === "complete" ? "已搜索网页"
      : /搜索|网页|浏览/u.test(activity.title) ? activity.title
        : activity.title === "上下文管理" ? "已优化对话" : activity.title);
  const unique = [...new Set(labels)];
  return unique.slice(0, 3).join(" · ") + (activities.length > 1 ? ` · ${activities.length} 项` : "");
}

/** 从现有活动摘要中拆出已经过 Owner 脱敏/限长的命令或网页预览；不读取或展示原始工具结果。 */
export function splitAiActivityDetail(detail: string): { summary: string; previewLabel?: string; preview?: string } {
  const markers = [
    { label: "本机 PowerShell 命令预览", title: "Shell 命令" },
    { label: "目标节点 Shell 命令预览", title: "Shell 命令" },
    { label: "搜索查询", title: "搜索查询" },
    { label: "读取网页", title: "网页地址" },
    { label: "打开网页", title: "网页地址" },
    { label: "工作区网页", title: "工作区 HTML" }
  ];
  for (const marker of markers) {
    const token = `${marker.label}：\n`;
    const markerIndex = detail.indexOf(token);
    if (markerIndex < 0) continue;
    const previewStart = markerIndex + token.length;
    return {
      summary: detail.slice(0, markerIndex).trim(),
      previewLabel: marker.title,
      preview: detail.slice(previewStart).trim()
    };
  }
  return { summary: detail };
}

/** 仅为本轮成功导航且仍能由内置 Browser Dock 复用的页面提供打开入口。 */
export function latestBrowserPreviewActivity(message: Pick<AiMessage, "activity">): AiActivityItem | null {
  for (let index = message.activity.length - 1; index >= 0; index--) {
    const activity = message.activity[index];
    if (activity.status !== "complete"
      || !isBuiltinBrowserProvider(activity.browserProviderId)
      || (activity.toolId !== "browser-use.navigate" && activity.toolId !== "browser-use.open-workspace-file")) continue;
    if (splitAiActivityDetail(activity.detail).preview) return activity;
  }
  return null;
}

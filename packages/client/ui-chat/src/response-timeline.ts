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
  const parts = message.parts?.length ? message.parts : undefined;
  // 历史消息没有可靠分段，不根据标点或内容关键词制造过程。
  let finalPart: AiReplyPart | undefined;
  if (finished && parts) finalPart = [...parts].reverse().find(part => part.kind === "final") ?? parts.at(-1);
  const entries: Array<{ offset: number; order: number; block: Exclude<ResponseTimelineBlock, { kind: "tools" }> | { kind: "activity"; id: string; activity: AiActivityItem } }> = [];
  for (const [order, activity] of message.activity.entries()) {
    // 这两项是 Agent Loop 的能力/权限说明元数据，不代表本轮执行的工作。
    if ((activity.kind === "agent" && activity.title === "小鱼主 Agent") || (activity.kind === "tool" && activity.title === "已登记项目工具")) continue;
    // 运行中只显示正文与一个当前状态；重复的模型阶段状态留在完成后的可展开记录中。
    if (!finished && activity.kind === "status") continue;
    entries.push({ offset: activity.contentOffset ?? 0, order, block: { kind: activity.kind === "question" || activity.approvalId ? "interaction" : "activity", id: activity.id, activity } });
  }
  for (const [index, part] of (parts ?? []).entries()) {
    if (part === finalPart || part.end <= part.start) continue;
    entries.push({ offset: part.start, order: message.activity.length + index, block: { kind: "text", id: part.id, content: message.content.slice(part.start, part.end), streaming: !finished && index === parts!.length - 1 } });
  }
  if (!parts && !finished && message.content) entries.push({ offset: 0, order: -1, block: { kind: "text", id: "legacy", content: message.content, streaming: true } });
  if (!finished && liveStatus) {
    const contentOffset = Math.min(message.content.length, Math.max(0, Math.floor(liveStatus.contentOffset)));
    entries.push({ offset: contentOffset, order: liveStatus.order, block: {
      kind: "status",
      id: "live-status",
      label: liveStatus.label,
      isProcessing: liveStatus.isProcessing
    } });
  }
  entries.sort((a, b) => a.offset - b.offset || a.order - b.order);
  const blocks: ResponseTimelineBlock[] = [];
  for (const { block } of entries) {
    if (block.kind !== "activity") { blocks.push(block); continue; }
    // 阶段状态逐项显示，展开“用时”即可看见真实执行节点；工具仍按连续操作收组。
    if (block.activity.kind === "status") { blocks.push(block); continue; }
    const previous = blocks.at(-1);
    if (previous?.kind === "tools") previous.activities.push(block.activity);
    else blocks.push({ kind: "tools", id: block.id, activities: [block.activity] });
  }
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

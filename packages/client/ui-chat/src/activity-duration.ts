/**
 * 功能：计算 AI Work 消息活动摘要中显示的状态与持续时间。
 * 作用：用服务端持久化的开始时间恢复刷新后的时长，并明确区分等待用户与等待审批。
 * 关联文件：AiWorkChat.tsx 展示摘要；apps/cli/tests/ai-work-activity-duration.test.mjs 覆盖刷新恢复。
 */
import type { AiActivityItem, AiMessage } from "lfaa-client-connection/src/api.js";

export interface AiActivitySummary {
  label: "排队中" | "正在思考" | "正在回复" | "正在准备工具" | "正在执行工具" | "正在协调子 Agent" | "正在加载能力" | "等待审批" | "等待你补充信息" | "结果待确认" | "已完成" | "已停止" | "未能完成";
  seconds: number;
  durationText: string;
  tone: "processing" | "waiting" | "complete" | "stopped" | "error";
  messageLabel: AiActivitySummary["label"] | null;
  isProcessing: boolean;
  activeActivity: AiActivityItem | null;
}

const activityStatusLabels: Record<AiActivityItem["status"], string> = {
  running: "进行中",
  approval_required: "等待审批",
  waiting_input: "等待你补充",
  complete: "已完成",
  error: "未能完成",
  unavailable: "结果待确认"
};

function elapsedSeconds(startedAt: string, now: number): number {
  const startedAtMs = Date.parse(startedAt);
  return Number.isFinite(startedAtMs) ? Math.max(0, Math.floor((now - startedAtMs) / 1000)) : 0;
}

/** 持久化活动优先使用服务端耗时，未结束的活动才依据真实开始时间累计。 */
export function getAiActivityDurationSeconds(activity: AiActivityItem, now = Date.now()): number {
  if (typeof activity.durationMs === "number" && Number.isFinite(activity.durationMs) && activity.durationMs >= 0) {
    return Math.floor(activity.durationMs / 1000);
  }
  if (activity.completedAt) {
    const startedAt = Date.parse(activity.startedAt);
    const completedAt = Date.parse(activity.completedAt);
    if (Number.isFinite(startedAt) && Number.isFinite(completedAt)) return Math.max(0, Math.floor((completedAt - startedAt) / 1000));
  }
  return elapsedSeconds(activity.startedAt, now);
}

export function getAiActivityStatusLabel(status: AiActivityItem["status"]): string {
  return activityStatusLabels[status];
}

/** 将通用运行状态转换成对用户有意义的实际阶段，不展示模型的隐藏推理内容。 */
export function getAiActivityDisplayStatus(activity: AiActivityItem): string {
  if (activity.status !== "running") return activityStatusLabels[activity.status];
  if (activity.kind === "status" && /^(请求 |模型推理中|模型正在思考)/u.test(activity.title)) return "正在思考";
  if (activity.kind === "status" && /流式接收回答|正在组织回复/u.test(activity.title)) return "正在回复";
  if (activity.kind === "agent") return "正在协调子 Agent";
  if (activity.kind === "skill") return "正在加载能力";
  if (activity.kind === "tool" || activity.kind === "command") {
    return activity.detail.startsWith("正在校验工具参数") ? "正在准备工具" : "正在执行工具";
  }
  return "进行中";
}

export function formatAiActivityDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  if (safeSeconds < 60) return safeSeconds === 0 ? "不足 1 秒" : `${safeSeconds} 秒`;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  if (minutes < 60) return `${minutes} 分钟${remainingSeconds ? ` ${remainingSeconds} 秒` : ""}`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} 小时${remainingMinutes ? ` ${remainingMinutes} 分钟` : ""}${remainingSeconds ? ` ${remainingSeconds} 秒` : ""}`;
}

function summarizeRunningActivity(activity: AiActivityItem | null): { label: AiActivitySummary["label"]; tone: AiActivitySummary["tone"]; isProcessing: boolean } {
  if (!activity) return { label: "正在思考", tone: "processing", isProcessing: true };
  if (activity.status === "approval_required") return { label: "等待审批", tone: "waiting", isProcessing: false };
  if (activity.status === "waiting_input") return { label: "等待你补充信息", tone: "waiting", isProcessing: false };
  if (activity.status === "unavailable") return { label: "结果待确认", tone: "waiting", isProcessing: false };
  if (activity.kind === "status" && /流式接收回答|正在组织回复/u.test(activity.title)) {
    return { label: "正在回复", tone: "processing", isProcessing: true };
  }
  if (activity.kind === "status" && /^(请求 |模型推理中|模型正在思考)/u.test(activity.title)) {
    return { label: "正在思考", tone: "processing", isProcessing: true };
  }
  if (activity.status === "running") {
    if (activity.kind === "agent") return { label: "正在协调子 Agent", tone: "processing", isProcessing: true };
    if (activity.kind === "skill") return { label: "正在加载能力", tone: "processing", isProcessing: true };
    if (activity.kind === "tool" || activity.kind === "command") {
      return { label: activity.detail.startsWith("正在校验工具参数") ? "正在准备工具" : "正在执行工具", tone: "processing", isProcessing: true };
    }
  }
  return { label: "正在思考", tone: "processing", isProcessing: true };
}

/** 处理中优先按当前服务端活动计时；排队与结束摘要按本轮持久化时间计时。 */
export function getAiActivitySummary(message: Pick<AiMessage, "status" | "createdAt" | "activity">, now = Date.now()): AiActivitySummary {
  const activeActivity = [...message.activity].reverse().find((activity: AiActivityItem) =>
    activity.status === "running" || activity.status === "approval_required" || activity.status === "waiting_input" || activity.status === "unavailable") ?? null;

  let label: AiActivitySummary["label"];
  let tone: AiActivitySummary["tone"];
  let isProcessing = false;
  let seconds = 0;

  if (message.status === "queued") {
    label = "排队中";
    tone = "waiting";
    seconds = elapsedSeconds(message.createdAt, now);
  } else if (message.status === "interrupted") {
    label = "已停止";
    tone = "stopped";
  } else if (message.status === "error") {
    label = "未能完成";
    tone = "error";
  } else if (message.status === "complete") {
    label = "已完成";
    tone = "complete";
  } else {
    const summary = summarizeRunningActivity(activeActivity);
    label = summary.label;
    tone = summary.tone;
    isProcessing = summary.isProcessing;
    seconds = activeActivity ? elapsedSeconds(activeActivity.startedAt, now) : elapsedSeconds(message.createdAt, now);
  }

  if (message.status === "complete" || message.status === "interrupted" || message.status === "error") {
    const activityTimes = [Date.parse(message.createdAt), ...message.activity.flatMap(activity => [
      Date.parse(activity.startedAt),
      activity.completedAt ? Date.parse(activity.completedAt) : 0
    ])].filter(value => Number.isFinite(value) && value > 0);
    seconds = activityTimes.length ? Math.max(0, Math.round((Math.max(...activityTimes) - Math.min(...activityTimes)) / 1000)) : 0;
  }

  const durationPrefix = message.status === "queued" ? "已排队" : message.status === "streaming" && !isProcessing ? "已等待" : message.status === "streaming" ? "已用" : "用时";
  return {
    label,
    seconds,
    durationText: `${durationPrefix} ${formatAiActivityDuration(seconds)}`,
    tone,
    messageLabel: message.status === "streaming" ? label : null,
    isProcessing,
    activeActivity
  };
}

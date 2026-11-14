/**
 * 功能：集中维护 ApplicationWorkspace 可脱离 React/浏览器状态验证的纯计算。
 * 作用：保持 tab、Host Task 与地址展示规则唯一，组件只负责调用。
 */
import type { AiHostTask } from "lfaa-client-connection/src/api.js";
import type { WorkbenchLayoutMode } from "lfaa-client-ui-dockkit/src/workbench-layout.types.js";
import type { ChromeState, WorkspaceUtilityTab } from "./types.js";

export function findGitWorkspaceUtilityTab(tabs: WorkspaceUtilityTab[]): WorkspaceUtilityTab | undefined {
  return tabs.find(tab => tab.kind === "git");
}

export function findAssetWorkspaceUtilityTab(tabs: WorkspaceUtilityTab[]): WorkspaceUtilityTab | undefined {
  return tabs.find(tab => tab.kind === "assets");
}

export function sameAiHostTaskSummaries(left: AiHostTask[], right: AiHostTask[]): boolean {
  return left.length === right.length && left.every((task, index) => {
    const candidate = right[index];
    return Boolean(candidate && task.id === candidate.id && task.nodeId === candidate.nodeId && task.appId === candidate.appId
      && task.shell === candidate.shell && task.workingDirectory === candidate.workingDirectory && task.status === candidate.status
      && task.message === candidate.message && task.createdAt === candidate.createdAt && task.startedAt === candidate.startedAt
      && task.finishedAt === candidate.finishedAt && task.cancelRequested === candidate.cancelRequested
      && task.outputSequence === candidate.outputSequence);
  });
}

export function aiHostTaskShellLabel(shell: string): string {
  return shell === "powershell" ? "PowerShell" : shell === "cmd" ? "命令提示符" : shell === "bash" ? "Bash" : shell === "zsh" ? "Zsh" : shell === "project-files" ? "项目文件任务" : "系统 Shell";
}

export function aiHostTaskStatusLabel(task: AiHostTask): string {
  if (task.cancelRequested && task.status === "running") return "等待节点确认停止";
  return task.status === "queued" ? "排队中" : task.status === "running" ? "运行中" : task.status === "succeeded" ? "已完成" : "已结束";
}

export function isAiHostTaskActive(task: AiHostTask): boolean {
  return task.status === "queued" || task.status === "running";
}

export function browserSiteHost(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

export function browserVisitTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  return new Intl.DateTimeFormat(undefined, { ...(sameDay ? {} : { month: "numeric", day: "numeric" }), hour: "2-digit", minute: "2-digit" }).format(date);
}

export function browserAddressForDisplay(address: string, showFullUrl: boolean, focused: boolean): string {
  if (!address || showFullUrl || focused) return address;
  try {
    const parsed = new URL(address);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : address;
  } catch { return address; }
}

export function defaultChrome(mode: WorkbenchLayoutMode): ChromeState {
  if (mode === "mobile") return { leftCollapsed: true, centerCollapsed: false, rightCollapsed: true, terminalOpen: false };
  if (mode === "compact") return { leftCollapsed: false, centerCollapsed: false, rightCollapsed: true, terminalOpen: false };
  return { leftCollapsed: false, centerCollapsed: false, rightCollapsed: false, terminalOpen: false };
}

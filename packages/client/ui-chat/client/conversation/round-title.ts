// 为思维链每轮折叠块生成动态语义标题与图标类型：跟随本轮最新操作灵活变化，告别写死的「已思考」。
import type { AgentStepItem } from "../store/chat-types";
import { getActivityKind, getActivityLabel } from "./activity-label";

export type RoundHeaderIconKind = "brain" | "command" | "file" | "read" | "subagent" | "browser" | "tool";

export interface DynamicRoundHeader {
  label: string;
  iconKind: RoundHeaderIconKind;
  active: boolean;
}

/** 从纯思考正文中提取简短意图摘要（最多 28 字符），避免思考完成后永远写死「已思考」。 */
function extractThoughtHeadline(detail: string | undefined, isZh: boolean): string {
  const lines = (detail ?? "")
    .replace(/^(?:\(Thinking\)|\[Thinking\])\s*/iu, "")
    .split(/\r?\n/u)
    .map((line) => line.replace(/^[-*#>\d.\s`]+/u, "").trim())
    .filter((line) => line.length >= 4);
  const first = lines[0]?.replace(/\s+/gu, " ");
  if (!first) return isZh ? "已完成分析" : "Analysis complete";
  return first.length > 28 ? `${first.slice(0, 27)}…` : first;
}

function stepIconKind(step: AgentStepItem): RoundHeaderIconKind {
  if (step.subagent?.kind === "browser" || step.toolName?.startsWith("browser_")) return "browser";
  if (step.subagent || step.toolName === "invoke_subagent" || step.toolName === "message_subagent") return "subagent";
  const kind = getActivityKind(step);
  if (kind === "command") return "command";
  if (kind === "file") return "file";
  if (kind === "read") return "read";
  return "tool";
}

function summarizeStepAction(step: AgentStepItem, isZh: boolean, live: boolean): string {
  if (step.subagent) {
    const running = live && (step.status === "running" || step.subagent.status === "running");
    if (running) {
      return isZh ? `${step.subagent.role} 正在工作…` : `${step.subagent.role} working…`;
    }
    return isZh ? `${step.subagent.role} 开始工作` : `${step.subagent.role} started`;
  }
  const base = getActivityLabel(step, isZh);
  const target = step.toolTarget?.trim();
  if (target && !base.includes(target)) {
    const shortTarget = target.length > 34 ? `${target.slice(0, 33)}…` : target;
    return `${base} ${shortTarget}`;
  }
  return base;
}

/** 根据本轮最新运行态与工具列表动态生成轮次标题：运行中紧跟当前操作，完成后汇总实际动作而非固定写死「已思考」。 */
export function resolveDynamicRoundHeader(params: {
  thinkStep?: AgentStepItem | undefined;
  thinkDetail?: string | undefined;
  tools: readonly AgentStepItem[];
  thinkActive: boolean;
  isStreaming: boolean;
  isZh: boolean;
  fallbackLabel: string;
}): DynamicRoundHeader {
  const { thinkStep, thinkDetail, tools, thinkActive, isStreaming, isZh, fallbackLabel } = params;

  // 1. 若本轮有正在执行的工具或子智能体，标题实时跟随最新活跃操作！
  const runningTool = [...tools].reverse().find((s) => s.status === "running" || s.status === "preparing");
  if (isStreaming && runningTool) {
    return {
      label: summarizeStepAction(runningTool, isZh, true),
      iconKind: stepIconKind(runningTool),
      active: true,
    };
  }

  // 2. 若本轮仍在纯思考/流式回复阶段，保留精准的语义运行阶段文案（如「正在深度思考」「正在回复」）。
  if (thinkActive) {
    return {
      label: fallbackLabel,
      iconKind: "brain",
      active: true,
    };
  }

  // 3. 若本轮包含工具调用且已执行完成，按实际操作动态命名（不再写死「已思考」）。
  if (tools.length > 0) {
    const subagentSteps = tools.filter((s) => Boolean(s.subagent));
    if (subagentSteps.length === 1 && tools.length <= 2) {
      const sub = subagentSteps[0]!.subagent!;
      return {
        label: isZh ? `${sub.role} 已完成` : `${sub.role} finished`,
        iconKind: sub.kind === "browser" ? "browser" : "subagent",
        active: false,
      };
    }
    if (subagentSteps.length > 1) {
      return {
        label: isZh ? `已协作 ${subagentSteps.length} 个子智能体` : `Collaborated with ${subagentSteps.length} subagents`,
        iconKind: "subagent",
        active: false,
      };
    }
    const latestTool = tools[tools.length - 1]!;
    if (tools.length === 1) {
      return {
        label: summarizeStepAction(latestTool, isZh, false),
        iconKind: stepIconKind(latestTool),
        active: false,
      };
    }
    // 多步工具时汇总类型：如「已读取 2 个文件并运行命令」或突出最后一步显著动作。
    const counts = { read: 0, file: 0, command: 0, other: 0 };
    for (const s of tools) {
      const k = getActivityKind(s);
      if (k === "read") counts.read += 1;
      else if (k === "file") counts.file += 1;
      else if (k === "command") counts.command += 1;
      else counts.other += 1;
    }
    const parts: string[] = [];
    if (counts.read > 0) parts.push(isZh ? `查看 ${counts.read} 项` : `read ${counts.read}`);
    if (counts.file > 0) parts.push(isZh ? `编辑 ${counts.file} 个文件` : `edited ${counts.file} files`);
    if (counts.command > 0) parts.push(isZh ? `运行 ${counts.command} 条命令` : `ran ${counts.command} cmds`);
    if (parts.length > 0 && counts.other === 0) {
      return {
        label: isZh ? `已${parts.join("、")}` : parts.join(", "),
        iconKind: stepIconKind(latestTool),
        active: false,
      };
    }
    return {
      label: summarizeStepAction(latestTool, isZh, false),
      iconKind: stepIconKind(latestTool),
      active: false,
    };
  }

  // 4. 纯思考轮次（无工具）：完成后提取首句意图摘要，不再千篇一律写死「已思考」。
  if (thinkStep?.status === "error") {
    return { label: fallbackLabel, iconKind: "brain", active: false };
  }
  if (thinkDetail?.trim()) {
    return {
      label: extractThoughtHeadline(thinkDetail, isZh),
      iconKind: "brain",
      active: false,
    };
  }
  return {
    label: fallbackLabel,
    iconKind: "brain",
    active: false,
  };
}

// 将 Host 的工具步骤转换为聊天活动摘要，保留可区分的动作和状态。
import type { AgentStepItem } from "./chat-types";
import { fileActivityTools, getActivityArgumentPath, getActivityFilePath, getFileActivityKind } from "./file-activity";
import { activityVerbs, timelineMessages, toolCallNames, toolDisplayNames } from "./locales";

export function getActivityKind(step: AgentStepItem) {
  if (step.subagent) return "subagent";
  const name = step.toolName;
  if (name === "run_command") return "command";
  if (step.id === "skills-loaded" || (name && /(?:^|_)skills?(?:_|$)/u.test(name))) return "skill";
  if (name === "read_file" || name === "list_dir" || name === "search_files") return "read";
  return step.fileChange || (name && fileActivityTools.has(name)) ? "file" : "tool";
}

/** 中性动作主体（正式名词短语），用于「某项活动失败」这类不带完成状态的摘要。 */
export function getActivitySubject(step: AgentStepItem, isZh: boolean): string {
  const language = isZh ? "zh" : "en";
  const name = step.toolName === "patch_file" ? "edit_file" : step.toolName;
  const verbs = name && Object.hasOwn(activityVerbs, name)
    ? activityVerbs[name as keyof typeof activityVerbs][language]
    : undefined;
  const displayName = name ? toolDisplayNames[name]?.[language] : undefined;
  return verbs?.[0] ?? displayName ?? name ?? step.title;
}

/** 一项活动的摘要可带文件名，多项活动的摘要只保留动词。 */
export function getActivityLabel(step: AgentStepItem, isZh: boolean, includePath = false): string {
  const language = isZh ? "zh" : "en";
  const labels = timelineMessages[language];
  if (step.subagent) return labels.subagentStates[step.subagent.status](step.subagent.role);
  const name = step.toolName === "patch_file" ? "edit_file" : step.toolName;
  const verbs = name && Object.hasOwn(activityVerbs, name)
    ? activityVerbs[name as keyof typeof activityVerbs][language]
    : undefined;
  // 未登记动词的工具使用正式显示名，界面上不直接暴露 fetch_url 这类内部工具名。
  const displayName = name ? toolDisplayNames[name]?.[language] : undefined;
  const action = verbs?.[0] ?? displayName ?? name ?? step.title;
  // 准备阶段用「准备调用X」：浏览器统一叫内置浏览器，其余工具用「正式名工具」。
  const prepareName = name
    ? toolCallNames[name]?.[language] ?? (displayName ? (language === "zh" ? `${displayName}工具` : `${displayName} tool`) : name)
    : step.title;
  const path = getActivityFilePath(step) ?? (name === "read_file" || name === "list_dir" ? getActivityArgumentPath(step) : undefined);
  const fileName = includePath && path ? path.split(/[\\/]/u).filter(Boolean).at(-1) : undefined;
  let label: string;
  switch (step.status) {
    case "preparing": label = labels.activityPreparing(prepareName); break;
    case "waiting_approval": label = labels.activityWaiting(action); break;
    case "error": label = labels.activityFailed(action); break;
    case "running": label = verbs?.[1] ?? (isZh ? `正在运行：${action}` : `Running: ${action}`); break;
    case "done":
      // 任务清单优先显示真实进度，方便用户一眼看到「做完几项 / 共几项」。
      if (step.todos && step.todos.length > 0) {
        const done = step.todos.filter((item) => item.status === "completed").length;
        label = isZh
          ? `已更新任务清单（完成 ${done} / 共 ${step.todos.length}）`
          : `Updated task list (${done}/${step.todos.length} done)`;
        break;
      }
      label = step.fileChange
        ? `${labels.fileKinds[getFileActivityKind(step)]}${fileName ? "" : isZh ? "文件" : " file"}`
        : verbs?.[2] ?? (name ? (isZh ? `已完成：${action}` : `Done: ${action}`) : step.title);
      break;
  }
  return fileName ? `${label} ${fileName}` : label;
}

/** 把步骤渲染成一句有信息量的话：思考给出具体计划/判断，动作给出目标或命令。 */
export function describeStep(step: AgentStepItem, isZh: boolean): string {
  if (step.phase === "think") {
    const raw = (step.detail || step.title || "").replace(/^第\s*\d+\s*轮\s*/u, "").trim();
    if (raw) return raw;
    return step.status === "running" ? (isZh ? "思考中" : "Thinking") : (isZh ? "已分析" : "Analyzed");
  }
  if (step.phase === "check") {
    if (step.status === "running") return isZh ? "检查中" : "Checking";
    if (step.status === "done") return isZh ? "已分析" : "Analyzed";
  }
  const label = getActivityLabel(step, isZh, true);
  const command = step.commandTrace?.command?.trim();
  if (command && !label.includes(command)) {
    const short = command.length > 60 ? `${command.slice(0, 60)}…` : command;
    return `${label} · ${short}`;
  }
  const target = step.toolTarget?.trim();
  if (target && !label.includes(target)) return `${label} · ${target}`;
  return label;
}

/** 取当前最值得展示的活跃步骤：审批 > 动作执行 > 检查 > 准备 > 思考。 */
function getLiveStep(steps: AgentStepItem[]): AgentStepItem | undefined {
  const recent = [...steps].reverse();
  return recent.find((step) => step.status === "waiting_approval")
    ?? recent.find((step) => step.phase === "act" && step.status === "running")
    ?? recent.find((step) => step.phase === "check" && step.status === "running")
    ?? recent.find((step) => step.status === "preparing")
    ?? recent.find((step) => step.phase === "think" && step.status === "running");
}

/** 实时阶段键：与 timelineMessages 的阶段文案一一对应。 */
export type LiveStage =
  | "waiting" | "preparing" | "waitingTool" | "exploring" | "executing" | "checking"
  | "starting" | "waitingModel" | "thinking" | "reasoning" | "replying" | "retrying";

/** 用步骤更新时间区分实时阶段：思考 / 深度思考 / 分析 / 运行 / 检查 / 等待。 */
export function getLiveStage(steps: AgentStepItem[], now: number): LiveStage {
  const current = getLiveStep(steps);
  if (current?.status === "waiting_approval") return "waiting";
  if (current?.status === "preparing") return now - current.timestamp >= 15_000 ? "waitingTool" : "preparing";
  if (current?.phase === "act") return current.permissionLevel === "read" ? "exploring" : "executing";
  if (current?.phase === "check") return "checking";
  if (!current) return "starting";
  if (now - current.timestamp >= 15_000) return "waitingModel";
  return current.modelStage ?? "thinking";
}

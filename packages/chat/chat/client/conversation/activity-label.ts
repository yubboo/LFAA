// 将 Host 的工具步骤转换为聊天活动摘要，保留可区分的动作和状态。
import type { AgentStepItem } from "../store/chat-types";
import { fileActivityTools, getActivityArgumentPath, getActivityFilePath, getFileActivityKind } from "../shared/file-activity";
import { activityUnits, activityVerbs, timelineMessages, toolCallNames, toolDisplayNames } from "../locales";

/** 工具动作的三态动词：中性主体、进行中、已完成；未登记的工具没有动词表。 */
function verbForms(step: AgentStepItem, isZh: boolean) {
  const language = isZh ? "zh" : "en";
  const name = step.toolName === "patch_file" ? "edit_file" : step.toolName;
  return name && Object.hasOwn(activityVerbs, name)
    ? activityVerbs[name as keyof typeof activityVerbs][language]
    : undefined;
}

export function getActivityKind(step: AgentStepItem) {
  if (step.subagent) return "subagent";
  const name = step.toolName;
  if (name === "run_command") return "command";
  if (step.id === "skills-loaded" || (name && /(?:^|_)skills?(?:_|$)/u.test(name))) return "skill";
  if (name === "read_file" || name === "list_dir" || name === "search_files" || name === "glob" || name === "grep") return "read";
  return step.fileChange || (name && fileActivityTools.has(name)) ? "file" : "tool";
}

/** 中性动作主体（正式名词短语），用于「某项活动失败」这类不带完成状态的摘要。 */
export function getActivitySubject(step: AgentStepItem, isZh: boolean): string {
  const language = isZh ? "zh" : "en";
  const name = step.toolName === "patch_file" ? "edit_file" : step.toolName;
  const verbs = verbForms(step, isZh);
  const displayName = name ? toolDisplayNames[name]?.[language] : undefined;
  return verbs?.[0] ?? displayName ?? name ?? step.title;
}

/** 一项活动的摘要可带文件名，多项活动的摘要只保留动词。 */
export function getActivityLabel(step: AgentStepItem, isZh: boolean, includePath = false): string {
  const language = isZh ? "zh" : "en";
  const labels = timelineMessages[language];
  if (step.subagent) return labels.subagentStates[step.subagent.status](step.subagent.role);
  const name = step.toolName === "patch_file" ? "edit_file" : step.toolName;
  const verbs = verbForms(step, isZh);
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
  return fileName ? `${label} · ${fileName}` : label;
}

/** 摘要里的动作对象：命令取命令行，文件类取文件名，用户不用展开就能知道做了什么。 */
function getActivityTarget(step: AgentStepItem): string | undefined {
  const command = step.commandTrace?.command?.trim();
  if (command) return command.length > 32 ? `${command.slice(0, 32)}…` : command;
  const path = getActivityFilePath(step) ?? getActivityArgumentPath(step);
  return path?.split(/[\\/]/u).filter(Boolean).at(-1);
}

/** 单步摘要：完整标签，命令再带上真实命令行。失败时退回中性主体，避免和失败徽标自相矛盾。 */
function describeActivityStep(step: AgentStepItem, isZh: boolean): string {
  if (step.status === "error") return getActivitySubject(step, isZh);
  const label = getActivityLabel(step, isZh, true);
  const command = step.commandTrace?.command?.trim();
  if (command && step.status !== "running" && !label.includes(command)) return `${label} · ${command}`;
  return label;
}

/** 同类多步摘要：点名对象或报数量，例如「已读取 · a.ts、b.ts」「已读取 4 个文件」。 */
function describeActivityRun(steps: readonly AgentStepItem[], isZh: boolean, detailed: boolean): string {
  const latest = steps.at(-1);
  if (!latest) return "";
  const labels = timelineMessages[isZh ? "zh" : "en"];
  // detailed 表示这一轮只有一种动作：可以放心点名对象和命令；多种动作并列时只用动词和数量，避免一串小圆点。
  if (steps.length === 1 && detailed) return describeActivityStep(latest, isZh);
  // 有失败项时用中性动作名，避免出现「已完成：…」却挂着失败徽标的矛盾摘要。
  if (steps.some((step) => step.status === "error")) return getActivitySubject(latest, isZh);
  if (latest.status !== "done") return getActivityLabel(latest, isZh);
  const name = latest.toolName === "patch_file" ? "edit_file" : latest.toolName;
  const unit = name ? activityUnits[name] : undefined;
  const verb = verbForms(latest, isZh)?.[2] ?? getActivitySubject(latest, isZh);
  // 清单、技能等没有自然量词的动作只说动作：任务清单保留真实进度，其余用正式动作名。
  if (!unit) {
    if (detailed) return describeActivityStep(latest, isZh);
    if (latest.todos && latest.todos.length > 0) return getActivityLabel(latest, isZh);
    return verb;
  }
  const count = steps.length;
  // 单个动作的动词已经说清做了什么，不再补「1 个」；多个同类动作才报数量。
  const counted = count > 1
    ? isZh ? `${verb} ${count} ${unit.zh}` : `${verb} ${count} ${unit.en[1]}`
    : verb;
  // 多种动作并列时只报动词和数量：再点名会让摘要变成一串小圆点。
  if (!detailed) return counted;
  const targets = [...new Set(steps.map(getActivityTarget).filter((target): target is string => Boolean(target)))];
  // 目标不超过三个时直接点名，用户不用展开就能看清读了什么、改了什么。
  if (targets.length === steps.length && targets.length <= 3) {
    return `${verb} · ${targets.join(labels.activityListSeparator)}`;
  }
  return counted;
}

/**
 * 一轮活动的摘要：单步给对象，多步按真实先后顺序并列动作。
 * 同一轮里既有命令又有文件操作时不再只写最后一步，也不再退回「N 项操作」这种看不出内容的说法。
 */
export function summarizeActivityGroup(steps: readonly AgentStepItem[], isZh: boolean): string | undefined {
  const [only] = steps;
  if (!only) return undefined;
  if (steps.length === 1) return describeActivityStep(only, isZh);
  const labels = timelineMessages[isZh ? "zh" : "en"];
  const runs: { category: string; steps: AgentStepItem[] }[] = [];
  for (const step of steps) {
    const category = step.subagent
      ? `subagent:${step.subagent.role}`
      : step.toolName === "patch_file" ? "edit_file" : step.toolName ?? `step:${step.id}`;
    const last = runs.at(-1);
    if (last?.category === category) last.steps.push(step);
    else runs.push({ category, steps: [step] });
  }
  // 最多并列三种动作，其余用「等」收尾；完整清单仍在展开区。
  const detailed = runs.length === 1;
  const shown = runs.slice(0, 3).map((run) => describeActivityRun(run.steps, isZh, detailed));
  const text = shown.join(labels.activitySeparator);
  if (runs.length <= 3) return text;
  return isZh ? `${text} ${labels.activityEtc}` : `${text}, ${labels.activityEtc}`;
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

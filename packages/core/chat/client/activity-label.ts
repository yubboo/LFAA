// 将 Host 的工具步骤转换为聊天活动摘要，保留可区分的动作和状态。
import type { AgentStepItem } from "./chat-types";
import { fileActivityTools, getActivityArgumentPath, getActivityFilePath, getFileActivityKind } from "./file-activity";
import { activityVerbs, timelineMessages } from "./locales";

export function getActivityKind(step: AgentStepItem) {
  const name = step.toolName;
  if (name === "run_command") return "command";
  if (step.id === "skills-loaded" || (name && /(?:^|_)skills?(?:_|$)/u.test(name))) return "skill";
  if (name === "read_file" || name === "list_dir" || name === "search_files") return "read";
  return step.fileChange || (name && fileActivityTools.has(name)) ? "file" : "tool";
}

/** 一项活动的摘要可带文件名，多项活动的摘要只保留动词。 */
export function getActivityLabel(step: AgentStepItem, isZh: boolean, includePath = false): string {
  const language = isZh ? "zh" : "en";
  const labels = timelineMessages[language];
  const name = step.toolName === "patch_file" ? "edit_file" : step.toolName;
  const verbs = name && Object.hasOwn(activityVerbs, name)
    ? activityVerbs[name as keyof typeof activityVerbs][language]
    : undefined;
  const action = verbs?.[0] ?? name ?? step.title;
  const path = getActivityFilePath(step) ?? (name === "read_file" || name === "list_dir" ? getActivityArgumentPath(step) : undefined);
  const fileName = includePath && path ? path.split(/[\\/]/u).filter(Boolean).at(-1) : undefined;
  let label: string;
  switch (step.status) {
    case "preparing": label = labels.activityPreparing(action); break;
    case "waiting_approval": label = labels.activityWaiting(action); break;
    case "error": label = labels.activityFailed(action); break;
    case "running": label = verbs?.[1] ?? (isZh ? `正在调用 ${action}` : `Calling ${action}`); break;
    case "done":
      label = step.fileChange
        ? `${labels.fileKinds[getFileActivityKind(step)]}${fileName ? "" : isZh ? "文件" : " file"}`
        : verbs?.[2] ?? (name ? (isZh ? `已调用 ${name}` : `Called ${name}`) : step.title);
      break;
  }
  return fileName ? `${label} ${fileName}` : label;
}

// Agent 步骤到右侧工作台自动跟随动作的纯映射：把浏览器/文件/后台任务/子智能体活动转为右栏自动展开与切页指令。
import type { AgentStepTrace } from "@lfaa/memory";

export type AgentWorkbenchAction =
  | { kind: "browser"; devtoolsTab?: "console" | "network"; refreshTabs: boolean; explicit?: true }
  | { kind: "file"; messageId: string; stepId: string; activateStage: boolean }
  | { kind: "terminal" }
  | { kind: "subagents" }
  | { kind: "subagent-tab"; subagentId: string; role: string };

const BROWSER_STAGE_TOOLS = new Set([
  "browser_navigate",
  "browser_tabs",
  "browser_click",
  "browser_type",
  "browser_scroll",
  "browser_hover",
  "browser_press_key",
  "browser_screenshot",
  "browser_visual_check",
  "browser_evaluate",
]);

const FILE_MUTATION_TOOLS = new Set(["write_file", "edit_file"]);

/** 只有可能改变活动标签或页面地址的动作需要重新同步标签。 */
const BROWSER_TAB_CHANGES = new Set(["browser_navigate", "browser_tabs", "browser_click", "browser_type", "browser_press_key"]);

export function isBrowserAutomationStep(step: AgentStepTrace): boolean {
  return step.subagent?.kind === "browser"
    || Boolean(step.subagent?.steps?.some((item) => item.name.startsWith("browser_")))
    || Boolean(step.subagent && step.detail && /\bbrowser_[a-z_]+\b/u.test(step.detail))
    || Boolean(step.toolName && BROWSER_STAGE_TOOLS.has(step.toolName));
}

/** 根据单条 Agent 步骤决定右侧工作台的自动跟随行为；返回 null 表示不打扰当前右栏。 */
export function resolveAgentWorkbenchAction(
  step: AgentStepTrace,
  options: { messageId: string; browserActiveInRun: boolean; previousStep?: AgentStepTrace | undefined },
): AgentWorkbenchAction | null {
  const toolName = step.toolName;
  const previous = options.previousStep;
  if (toolName === "browser_present") {
    return step.status === "done" && previous?.status !== "done"
      ? { kind: "browser", refreshTabs: true, explicit: true }
      : null;
  }
  if (toolName && BROWSER_STAGE_TOOLS.has(toolName)) {
    if (previous?.status === step.status || (step.status !== "running" && step.status !== "done")) return null;
    return { kind: "browser", refreshTabs: step.status === "done" && BROWSER_TAB_CHANGES.has(toolName) };
  }

  if (toolName === "browser_console" || toolName === "browser_network") {
    if (step.status !== "done" || previous?.status === "done") return null;
    return {
      kind: "browser",
      devtoolsTab: toolName === "browser_console" ? "console" : "network",
      refreshTabs: false,
    };
  }

  if (toolName && FILE_MUTATION_TOOLS.has(toolName) && step.status === "done" && step.fileChange) {
    return {
      kind: "file",
      messageId: options.messageId,
      stepId: step.id,
      // 浏览器验收阶段顺手改小文件时仅后台刷新文件标签，不把台前浏览器顶掉。
      activateStage: !options.browserActiveInRun,
    };
  }

  if (toolName === "start_background_task" && step.status === "done") {
    return { kind: "terminal" };
  }

  if (step.subagent && (step.status === "running" || step.status === "done")) {
    if (isBrowserAutomationStep(step)) {
      // 浏览器子智能体首次启动时强制自动展开右侧浏览器舞台，让用户全程可见操控过程；后续步骤尊重用户手动收起。
      if (!previous || !isBrowserAutomationStep(previous)) return { kind: "browser", refreshTabs: true, explicit: true };
      const previousDone = new Set(previous.subagent?.steps?.filter((item) => item.status === "done").map((item) => item.id));
      const changed = step.subagent.steps?.some((item) => item.status === "done"
        && BROWSER_TAB_CHANGES.has(item.name) && !previousDone.has(item.id));
      return changed ? { kind: "browser", refreshTabs: true } : null;
    }
    if (step.status === "running" && previous?.subagent?.id !== step.subagent.id) {
      return { kind: "subagent-tab", subagentId: step.subagent.id, role: step.subagent.role };
    }
    if (step.status === "running") return null;
  }

  return null;
}

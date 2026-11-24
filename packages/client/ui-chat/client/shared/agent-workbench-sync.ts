// Agent 步骤到右侧工作台自动跟随动作的纯映射：把浏览器/文件/后台任务/子智能体活动转为右栏自动展开与切页指令。
import type { AgentStepTrace } from "@lfaa/memory";

export type AgentWorkbenchAction =
  | { kind: "browser"; devtoolsTab?: "console" | "network"; refreshTabs: boolean }
  | { kind: "file"; messageId: string; stepId: string; activateStage: boolean }
  | { kind: "terminal" }
  | { kind: "subagents" };

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

/** 根据单条 Agent 步骤决定右侧工作台的自动跟随行为；返回 null 表示不打扰当前右栏。 */
export function resolveAgentWorkbenchAction(
  step: AgentStepTrace,
  options: { messageId: string; browserActiveInRun: boolean },
): AgentWorkbenchAction | null {
  const toolName = step.toolName;
  if (toolName && BROWSER_STAGE_TOOLS.has(toolName)) {
    if (step.status !== "running" && step.status !== "done") return null;
    return { kind: "browser", refreshTabs: step.status === "done" };
  }

  if (toolName === "browser_console" || toolName === "browser_network") {
    if (step.status !== "done") return null;
    return {
      kind: "browser",
      devtoolsTab: toolName === "browser_console" ? "console" : "network",
      refreshTabs: true,
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
    const isBrowserSub = step.subagent.kind === "browser"
      || step.subagent.steps?.some((item) => item.name.startsWith("browser_"))
      || Boolean(step.detail && /\bbrowser_[a-z_]+\b/u.test(step.detail));
    if (isBrowserSub) {
      return { kind: "browser", refreshTabs: true };
    }
    if (step.status === "running") return { kind: "subagents" };
  }

  return null;
}

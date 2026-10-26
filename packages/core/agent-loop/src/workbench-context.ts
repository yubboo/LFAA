/**
 * 功能：把 Client 当前工作台视图格式化为受限的本轮 Agent 上下文。
 * 作用：只描述所选面板和开合状态；页面内容仍须由 Browser Owner 实时读取。
 * 关联文件：runs.ts、execute-turn.ts、packages/api/remotes/src/route-contracts.ts。
 */

export interface AgentWorkbenchView {
  rightPane: "browser" | "new-tab" | "git" | "applications" | "side-chat" | "extension" | "application-tools";
  rightPaneOpen: boolean;
  bottomTerminalOpen: boolean;
  browserUrl?: string;
}

const RIGHT_PANES = new Set<AgentWorkbenchView["rightPane"]>(["browser", "new-tab", "git", "applications", "side-chat", "extension", "application-tools"]);

function safeBrowserLocation(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2_048) return undefined;
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) return undefined;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch { return undefined; }
}

export function formatAgentWorkbenchContext(view: AgentWorkbenchView | undefined, browserUseEnabled: boolean): string | undefined {
  if (!view || !RIGHT_PANES.has(view.rightPane) || typeof view.rightPaneOpen !== "boolean" || typeof view.bottomTerminalOpen !== "boolean") return undefined;
  const state: Record<string, unknown> = {
    rightPane: view.rightPane,
    rightPaneOpen: view.rightPaneOpen,
    bottomTerminalOpen: view.bottomTerminalOpen
  };
  if (browserUseEnabled && view.rightPane === "browser" && view.rightPaneOpen) {
    const browserUrl = safeBrowserLocation(view.browserUrl);
    if (browserUrl) state.browserUrl = browserUrl;
  }
  return [
    `当前 LFAA 工作台视图（受限 JSON）：${JSON.stringify(state)}`,
    "该视图只帮助识别用户正在看的面板，不代表工具可用或授权。需要网页正文时，使用当前目录中的 Browser Owner 工具实时观察；当前工具目录和执行器回执才是能力与结果依据。"
  ].join("\n");
}

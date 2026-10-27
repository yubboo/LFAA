/**
 * 功能：把当前工作台选择状态裁剪成一次 Agent Run 的 UI 提示。
 * 作用：只包含面板种类和开合状态；网页地址必须来自当前可见 Dock 且允许 Agent Browser Use。
 * 关联文件：ApplicationWorkspace.tsx、packages/client/connection/src/api.ts。
 */
import type { AiWorkbenchView } from "lfaa-client-connection/src/api.js";

export function createAgentWorkbenchView(input: {
  rightPane: AiWorkbenchView["rightPane"];
  rightPaneOpen: boolean;
  bottomTerminalOpen: boolean;
  browserUseEnabled: boolean;
  activeBrowserUrl?: string;
  canvas?: AiWorkbenchView["canvas"];
  workflow?: AiWorkbenchView["workflow"];
}): AiWorkbenchView {
  const result: AiWorkbenchView = {
    rightPane: input.rightPane,
    rightPaneOpen: input.rightPaneOpen,
    bottomTerminalOpen: input.bottomTerminalOpen
  };
  if (input.canvas) result.canvas = input.canvas;
  if (input.workflow) result.workflow = input.workflow;
  if (input.rightPane !== "browser" || !input.rightPaneOpen || !input.browserUseEnabled || !input.activeBrowserUrl) return result;
  try {
    const url = new URL(input.activeBrowserUrl);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) return result;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    result.browserUrl = url.toString();
  } catch {
    // 无效/非 HTTP(S) 页面不进入模型上下文；Browser Owner 可按真实状态提供其他诊断。
  }
  return result;
}

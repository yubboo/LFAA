// 工作台「新建标签页」动作：快捷键与「+」共用同一份展开 + 建标签语义。
// 关键点：快捷键在工作台收起（或预览区在左时预览列收起）也必须生效，所以先展开再建标签。
import { manageBrowserTab } from "@lfaa/client-ui-browser/client";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import type { ChatClientStore } from "../store/chat-store";

/** 展开工作台 → 让宿主建一个浏览器标签 → 请求舞台刷新到浏览器标签页。 */
export function openNewWorkbenchTab(input: {
  workbench: WorkbenchClientService;
  store: ChatClientStore;
}): void {
  const { workbench, store } = input;
  // 右栏在「聊天区在左」时是工作台列，在「预览区在左」时是 AI 会话列；服务会把另一列一起放出来。
  workbench.setRightPanelOpen(true, false);
  const sessionId = store.getSnapshot().activeSession?.id ?? "default";
  const refreshStage = () => store.requestRightPanel("browser", undefined, { refreshBrowser: true });
  // 宿主建标签是异步的：等结果再刷舞台，避免舞台上先看到一个还没同步的旧标签集。
  void manageBrowserTab(sessionId, { action: "new" }).catch(() => {}).finally(refreshStage);
}
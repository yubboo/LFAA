// 底部终端面板注册：把位置偏好、Shell 底部面板与右栏「终端」标签串起来；失败不连累聊天视图。
import type { JSX } from "react";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import type { ChatClientStore } from "../store/chat-store";
import type { ChatLocaleMessages } from "../locales";
import { TerminalSurface } from "./TerminalSurface";
import { readTerminalPlacement } from "./terminal-placement";

/** 注册底部终端；返回注销函数。宿主未升级等异常只记录，不抛出。 */
export function registerTerminalDock(
  workbench: WorkbenchClientService,
  store: ChatClientStore,
  locale: ChatLocaleMessages,
): () => void {
  try {
    // 底部面板暂停启用（等结构重做）：这里只保证位置偏好不报错，不注册贡献。
    if (true) return () => {};
    const unregister = workbench.registerBottomPanel({
      id: "terminal",
      title: locale.isZh ? "终端" : "Terminal",
      render: (): JSX.Element => (
        <TerminalSurface
          sessionId={store.getSnapshot().activeSession?.id ?? "default"}
          isZh={locale.isZh}
          placement="bottom"
          workbench={workbench}
        />
      ),
    });
    // 启动时按上次的位置偏好决定底部面板是否展开；切到右栏时由 setBottomPanelOpen(false) 收起。
    if (readTerminalPlacement() === "bottom") workbench.setBottomPanelOpen(true, true);
    return unregister;
  } catch (error) {
    console.error("[chat] 底部终端面板注册失败", error);
    return () => {};
  }
}
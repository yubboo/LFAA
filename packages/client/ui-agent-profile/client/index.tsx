// @lfaa/agent-profile 浏览器端 Cordis 插件：向 Workbench 注册 Agents 视图，卸载时清理贡献。
import type { Context } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { AgentsView } from "./view/Agents-View";

export { AgentsView } from "./view/Agents-View";

/** 按页面语言选择中/英文案；无 DOM 时按浏览器语言回退。 */
function detectIsZh(): boolean {
  if (typeof document !== "undefined" && document.documentElement.lang) {
    return document.documentElement.lang.toLowerCase().startsWith("zh");
  }
  return typeof navigator === "undefined" ? true : navigator.language.toLowerCase().startsWith("zh");
}

export function agentProfileClientPlugin(context: Context): void {
  const disposeView = context.workbench.registerView({
    id: "agents",
    title: "Agents",
    render: () => <AgentsView isZh={detectIsZh()} />,
  });

  context.effect(() => () => {
    disposeView();
  });
}
agentProfileClientPlugin.inject = ["workbench"] as const;
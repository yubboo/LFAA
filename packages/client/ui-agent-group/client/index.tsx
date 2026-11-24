// @lfaa/agent-group 浏览器端 Cordis 插件：注册群聊视图，卸载时清理贡献。
import type { Context } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { GroupView } from "./view/Group-View";

export { GroupView } from "./view/Group-View";

/** 按页面语言选择中/英文案；无 DOM 时按浏览器语言回退。 */
function detectIsZh(): boolean {
  if (typeof document !== "undefined" && document.documentElement.lang) {
    return document.documentElement.lang.toLowerCase().startsWith("zh");
  }
  return typeof navigator === "undefined" ? true : navigator.language.toLowerCase().startsWith("zh");
}

export function agentGroupClientPlugin(context: Context): void {
  const disposeView = context.workbench.registerView({
    id: "group",
    title: "Group",
    render: () => <GroupView isZh={detectIsZh()} />,
  });

  context.effect(() => () => {
    disposeView();
  });
}
agentGroupClientPlugin.inject = ["workbench"] as const;
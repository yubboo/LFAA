// @lfaa/skills 浏览器端 Cordis 插件：向 Workbench 注册技能中心视图，并在卸载时清理。
import type { Context } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { SkillsView } from "./Skills-View";

export { fetchSkillsList } from "./skills-client";

function detectIsZh(): boolean {
  if (typeof document !== "undefined" && document.documentElement.lang) {
    return document.documentElement.lang.toLowerCase().startsWith("zh");
  }
  return typeof navigator === "undefined" ? true : navigator.language.toLowerCase().startsWith("zh");
}

export function skillsClientPlugin(context: Context): void {
  const isZh = detectIsZh();
  const disposeView = context.workbench.registerView({
    id: "skills",
    title: isZh ? "技能中心" : "Skills",
    render: () => <SkillsView isZh={detectIsZh()} />,
  });

  context.effect(() => () => {
    disposeView();
  });
}
skillsClientPlugin.inject = ["workbench"] as const;

// @lfaa/browser/client 浏览器端导出与设置页插件注册。
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { BrowserSettingsView } from "./BrowserSettingsView";

export * from "./browser-client";
export { RightBrowserPane } from "./RightBrowserPane";
export { BrowserSettingsView } from "./BrowserSettingsView";

export const browserClientPlugin: Plugin.Object<void> = {
  name: "@lfaa/browser/client",
  inject: ["workbench"],
  apply(context: Context) {
    const isZh = typeof navigator === "undefined" || navigator.language.toLowerCase().startsWith("zh");
    const unregister = context.workbench.registerView({
      id: "settings:browser",
      title: isZh ? "浏览器" : "Browser",
      render: () => <BrowserSettingsView isZh={isZh} />,
    });
    context.effect(() => () => {
      unregister();
    });
  },
};

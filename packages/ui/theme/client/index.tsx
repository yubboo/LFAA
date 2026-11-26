// 导出主题包的 Client Cordis 插件入口：启动即同步主题 CSS 变量，并向工作台注册“外观”设置视图。
// tokens.css 是语义变量定义层（浅色/深色/系统主题成对定义），必须随本入口副作用引入；
// scrollbars.css 是全局滚动条基线，让所有滚动容器共用同一套强调色滑块。
import "./tokens.css";
import "./scrollbars.css";
import { useSyncExternalStore } from "react";
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { AppearanceStore } from "./appearance-store";
import { AppearanceSettings } from "./components/AppearanceSettings";
import { ThemeModeQuickSwitch } from "./components/ThemeModeQuickSwitch";
import { getThemeLocale, type ThemeLocaleMessages } from "./locales";

export { AppearanceStore } from "./appearance-store";
export type { AppearanceSnapshot } from "./appearance-store";
// 主题预览与主题网格：可被任何需要"选主题 / 预演主题"的界面直接复用。
export { ThemePreview, type ThemePreviewSample } from "./components/ThemePreview";
export { ThemeGallery, type ThemeTile } from "./components/ThemeGallery";

function AppearanceView({ locale, store }: { locale: ThemeLocaleMessages; store: AppearanceStore }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return <AppearanceSettings locale={locale} store={store} snapshot={snapshot} />;
}

function AccountThemeSwitcher({ locale, store }: { locale: ThemeLocaleMessages; store: AppearanceStore }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return (
    <ThemeModeQuickSwitch
      locale={locale}
      store={store}
      mode={snapshot.config.mode}
      resolvedScheme={snapshot.resolvedScheme}
    />
  );
}

/** 向工作台注册外观设置与快捷切换入口，按插件生命周期移除贡献。 */
export const themeClientPlugin: Plugin.Object<void> = {
  name: "@lfaa/ui-theme/client",
  inject: ["workbench"],
  apply(context: Context) {
    const store = new AppearanceStore();
    store.mount();
    const locale = getThemeLocale();

    const unregister = context.workbench.registerView({
      id: "appearance",
      title: locale.appearance,
      render: () => <AppearanceView locale={locale} store={store} />,
    });

    const unregisterAccountAction = context.workbench.registerAccountAction({
      id: "theme-mode-switch",
      order: 10,
      render: () => <AccountThemeSwitcher locale={locale} store={store} />,
    });

    context.effect(() => () => {
      unregisterAccountAction();
      unregister();
      store.dispose();
    });
  },
};

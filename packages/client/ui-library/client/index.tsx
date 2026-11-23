// 导出 @lfaa/library/client Cordis 插件：注册资料库中心页、右栏检视器与存储设置页。
// 会话状态来自 @lfaa/chat 提供的 chatStore 服务，本包不另建一份。
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { getChatLocale } from "@lfaa/client-ui-chat/client";
import { StorageSettingsView } from "./settings/StorageSettingsView";
import { LibraryInspector } from "./views/LibraryInspector";
import { LibraryView } from "./views/LibraryView";

/** 注册资料库视图与检视器；卸载时撤销全部工作台贡献。 */
export const libraryClientPlugin: Plugin.Object<void> = {
  name: "@lfaa/client-ui-library/client",
  inject: ["workbench", "chatStore"],
  apply(context: Context) {
    const store = context.chatStore;
    const locale = getChatLocale();

    const unregisterLibraryView = context.workbench.registerView({
      id: "library",
      title: locale.libraryTitle,
      render: () => {
        const snap = store.getSnapshot();
        const wbSnap = context.workbench.getSnapshot();
        const boundProjectId = snap.activeSession?.projectId ?? snap.draftProjectId ?? wbSnap.activeProjectId;
        return (
          <LibraryView
            locale={locale}
            store={store}
            boundProjectId={boundProjectId}
            activeTab={wbSnap.activeLibraryTab}
            onSelectTab={(nextTab) => context.workbench.setLibraryTab(nextTab)}
            onShowDetails={() => context.workbench.setRightPanelOpen(true, false)}
            onOpenStorageSettings={() => context.workbench.navigate("settings:storage")}
          />
        );
      },
    });

    // 资料库域右栏为检视器：未选中展示存储概览，选中后展示媒体或资产详情。
    const unregisterLibraryInspector = context.workbench.registerContextPanel({
      id: "library-inspector",
      title: locale.libraryTitle,
      order: 4,
      chrome: "workbench",
      match: (activeView) => activeView === "library",
      render: (renderCtx) => (
        <LibraryInspector
          locale={locale}
          store={store}
          compact={renderCtx?.compact ?? false}
          maximized={renderCtx?.rightPanelMaximized ?? false}
          onToggleMaximize={renderCtx?.onToggleMaximizeRightPanel}
          onCollapse={renderCtx?.onCollapseRightPanel}
          onCloseDrawer={renderCtx?.onCloseDrawer}
          onOpenStorageSettings={() => context.workbench.navigate("settings:storage")}
        />
      ),
    });

    const unregisterStorageView = context.workbench.registerView({
      id: "settings:storage",
      title: locale.storageTitle,
      render: () => {
        const snap = store.getSnapshot();
        const wbSnap = context.workbench.getSnapshot();
        const boundProjectId = snap.activeSession?.projectId ?? snap.draftProjectId ?? wbSnap.activeProjectId;
        return (
          <StorageSettingsView
            locale={locale}
            store={store}
            boundProjectId={boundProjectId}
          />
        );
      },
    });

    context.effect(() => () => {
      unregisterStorageView();
      unregisterLibraryInspector();
      unregisterLibraryView();
    });
  },
};
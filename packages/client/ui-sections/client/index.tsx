// 导出分区包 Client Cordis 插件入口，向工作台注册自定义分区提供方并在删除分区时广播事件。
import { useSyncExternalStore } from "react";
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { SectionDialog } from "./components/SectionDialog";
import { SectionRowActions } from "./components/SectionRowActions";
import { getSectionsLocale, type SectionsLocaleMessages } from "./locales";
import { SectionStore } from "./store/section-store";

declare module "@deepseek-ai/cordis" {
  interface Events {
    "workspace/section-removed"(sectionId: string): void;
  }
}

function SectionsOverlayHost({ locale, store }: { locale: SectionsLocaleMessages; store: SectionStore }) {
  const dialogState = useSyncExternalStore(store.subscribeDialog, store.getDialogState, store.getDialogState);
  if (!dialogState) return null;
  return <SectionDialog locale={locale} store={store} dialogState={dialogState} />;
}

/** 注册自定义分区来源及其操作入口，并协调分区删除通知。 */
export const sectionsClientPlugin: Plugin.Object<void> = {
  name: "@lfaa/client-ui-sections/client",
  inject: ["workbench"],
  apply(context: Context) {
    const store = new SectionStore((sectionId) => {
      context.emit("workspace/section-removed", sectionId);
    });
    const locale = getSectionsLocale();

    const unregister = context.workbench.registerSectionProvider({
      getSections: store.getSections,
      subscribe: store.subscribe,
      openCreateDialog: () => store.openCreateDialog(),
      renderSectionTools: ({ section, onNewChatInSection }) => (
        <SectionRowActions
          locale={locale}
          section={section}
          store={store}
          onNewChatInSection={onNewChatInSection}
        />
      ),
      renderOverlays: () => <SectionsOverlayHost locale={locale} store={store} />,
    });

    context.effect(() => () => {
      unregister();
      store.dispose();
    });
  },
};

// 导出 @lfaa/review/client Cordis 插件：注册内置代码审查工作台视图。
// 会话状态来自 @lfaa/chat 提供的 chatStore 服务，本包只读不写。
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import { getChatLocale } from "@lfaa/chat/client";
import { CodeReviewSettingsView } from "./settings/CodeReviewSettingsView";
import { GitSettingsView } from "./settings/GitSettingsView";
import { CodeReviewView } from "./views/CodeReviewView";

/** 注册代码审查工作台；卸载时撤销视图贡献。 */
export const reviewClientPlugin: Plugin.Object<void> = {
  name: "@lfaa/review/client",
  inject: ["workbench", "chatStore"],
  apply(context: Context) {
    const store = context.chatStore;
    const locale = getChatLocale();

    const unregisterCodeReviewView = context.workbench.registerView({
      id: "codeReview",
      title: locale.isZh ? "代码审查" : "Code Review",
      render: () => {
        const snap = store.getSnapshot();
        const wbSnap = context.workbench.getSnapshot();
        const boundProjectId = snap.activeSession?.projectId ?? snap.draftProjectId ?? wbSnap.activeProjectId;
        return (
          <CodeReviewView
            locale={locale}
            store={store}
            boundProjectId={boundProjectId}
            boundSessionId={store.getSnapshot().activeSession?.id}
            activeDomainItem={wbSnap.activeDomainItem}
            onSelectDomainItem={(item) => context.workbench.setDomainItem(item)}
            onOpenGitSettings={() => context.workbench.navigate("settings:git")}
            onOpenReviewSettings={() => context.workbench.navigate("settings:codeReview")}
            onNavigateToChat={() => context.workbench.navigate("workspace")}
          />
        );
      },
    });

    // 编码相关设置页随代码审查能力一起归位，改动后不再需要回到 chat 包维护。
    const unregisterGitSettingsView = context.workbench.registerView({
      id: "settings:git",
      title: "Git",
      render: () => (
        <GitSettingsView
          locale={locale}
          onOpenCodeReviewWorkbench={() => context.workbench.navigate("codeReview")}
        />
      ),
    });

    const unregisterCodeReviewSettingsView = context.workbench.registerView({
      id: "settings:codeReview",
      title: locale.isZh ? "代码审查" : "Code Review",
      render: () => (
        <CodeReviewSettingsView
          locale={locale}
          onOpenCodeReviewWorkbench={() => context.workbench.navigate("codeReview")}
        />
      ),
    });

    context.effect(() => () => {
      unregisterCodeReviewSettingsView();
      unregisterGitSettingsView();
      unregisterCodeReviewView();
    });
  },
};
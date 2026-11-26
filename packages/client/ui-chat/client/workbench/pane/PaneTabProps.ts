// 舞台顶栏「标签区」对象装配：把 RightWorkbenchPane 里的 tabProps 大对象搬出来，
// 输入只剩一个 deps 对象，舞台容器不再同时持有这么多回调与状态。
import type { ComponentProps } from "react";
import type { ChatClientStore } from "../../store/chat-store";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import type { BrowserTabItem } from "@lfaa/client-ui-browser/client";
import type { FilePreviewTab } from "../../store/chat-types";
import type { RightAuxTab } from "../RightUtilityRail";
import type { RightStageKind } from "../WorkbenchTabs";
import type { SubagentStageTab } from "../useWorkbenchSubagents";
import type { WorkbenchTabs } from "../WorkbenchTabs";

/** 标签区对象的类型直接取组件 props，避免两处手写漂移。 */
export type PaneTabProps = ComponentProps<typeof WorkbenchTabs>;

/** 组装标签区所需的最小依赖集合。 */
export interface PaneTabDeps {
  isZh: boolean;
  stageKind: RightStageKind;
  auxTabs: RightAuxTab[];
  auxTitles: Record<RightAuxTab, string>;
  activeAuxTab: RightAuxTab | null;
  fileTabs: FilePreviewTab[];
  activeFileTab: FilePreviewTab | undefined;
  browserOpen: boolean;
  browserTabs: BrowserTabItem[];
  browserIsBlank: boolean;
  reviewTabOpen: boolean;
  reviewMessageId: string | undefined;
  subagentTabs: SubagentStageTab[];
  activeSubagentTabId: string | null;
  rightStageKind: string | null | undefined;
  store: ChatClientStore;
  workbench?: WorkbenchClientService | undefined;
  hideAuxTab: () => void;
  openAuxTab: (tab: RightAuxTab) => void;
  closeAuxTab: (tab: RightAuxTab) => void;
  closeAuxTabAndMaybeCollapse: (tab: RightAuxTab) => void;
  closeFileTab: (tabId: string) => void;
  closeBrowserTab: (tabId?: string) => void;
  handleActivateBrowserTab: (tabId: string) => void;
  closeReviewTab: () => void;
  setReviewTabOpen: (open: boolean) => void;
  selectSubagentTab: (subagentId: string) => void;
  closeSubagentTab: (subagentId: string, next: () => "file" | "browser" | "review" | null) => void;
  openNewBrowserTab: () => void;
  closeBrowserTabsExcept: (keepTabId?: string) => void;
}

/** 生成标签区 props；纯函数，便于舞台容器按需重建。 */
export function buildPaneTabProps(deps: PaneTabDeps): PaneTabProps {
  const {
    isZh, stageKind, auxTabs, auxTitles, activeAuxTab, fileTabs, activeFileTab,
    browserOpen, browserTabs, browserIsBlank, reviewTabOpen, reviewMessageId,
    subagentTabs, activeSubagentTabId, rightStageKind, store, workbench, hideAuxTab,
    openAuxTab, closeAuxTab, closeAuxTabAndMaybeCollapse, closeFileTab, closeBrowserTab,
    handleActivateBrowserTab, closeReviewTab, setReviewTabOpen, selectSubagentTab,
    closeSubagentTab, openNewBrowserTab, closeBrowserTabsExcept,
  } = deps;

  return {
    isZh,
    stageKind,
    auxTabs: auxTabs.map((id) => ({ id, title: auxTitles[id] })),
    activeAuxTab,
    onSelectAuxTab: (tab) => { openAuxTab(tab); },
    onCloseAuxTab: closeAuxTabAndMaybeCollapse,
    fileTabs,
    activeFileTab,
    browserOpen,
    browserTabs,
    browserIsBlank,
    reviewTabOpen,
    reviewMessageId,
    subagentTabs,
    activeSubagentTabId,
    onSelectFile: (tabId) => { hideAuxTab(); store.selectFilePreview(tabId); },
    onCloseFile: closeFileTab,
    onSelectBrowser: () => { hideAuxTab(); store.setRightStageKind("browser"); },
    onCloseBrowser: () => closeBrowserTab(),
    onActivateBrowserTab: (bTab) => {
      hideAuxTab();
      store.setRightStageKind("browser");
      if (!bTab.active) handleActivateBrowserTab(bTab.tabId);
    },
    onCloseBrowserTab: closeBrowserTab,
    onSelectReview: () => { hideAuxTab(); store.setRightStageKind("review"); },
    onCloseReview: closeReviewTab,
    onSelectSubagentTab: (subId) => { hideAuxTab(); selectSubagentTab(subId); },
    onCloseSubagentTab: (subId) => closeSubagentTab(subId, () => (activeFileTab ? "file" : browserOpen ? "browser" : reviewTabOpen ? "review" : null)),
    onNewBrowserTab: openNewBrowserTab,
    onCloseBrowserTabAny: (tabId) => closeBrowserTab(tabId),
    onCloseFileRaw: (id) => store.closeFilePreview(id),
    onCloseAuxRaw: closeAuxTab,
    onCloseSubagentRaw: (id) => closeSubagentTab(id, () => null),
    onCloseReviewRaw: () => { setReviewTabOpen(false); if (rightStageKind === "review") store.setRightStageKind(null); },
    closeBrowserTabsExcept: (keepTabId) => { void closeBrowserTabsExcept(keepTabId); },
    workbench,
  };
}
// 右侧工作台标签关闭：仅当关闭最后一个标签且没有任何其它标签（含插件标签如无限画布）时，才收起整个右栏。
export function useWorkbenchTabClose<AuxTab extends string>(deps: {
  browserTabs: number;
  fileTabs: number;
  browserOpen: boolean;
  activeFileTab: boolean;
  reviewTabOpen: boolean;
  subagentTabs: number;
  auxTabs: number;
  extensionTabs?: number;
  closeBrowserTab: (tabId?: string) => void;
  closeFileTab: (tabId: string) => void;
  closeReviewTab: () => void;
  closeAuxTab: (tab: AuxTab) => void;
  collapse: (() => void) | undefined;
}) {
  const extCount = deps.extensionTabs ?? 0;

  const closeBrowserTab = (tabId?: string) => {
    const closingLastTab = deps.browserTabs <= 1;
    deps.closeBrowserTab(tabId);
    if (closingLastTab && !deps.activeFileTab && !deps.reviewTabOpen && deps.subagentTabs === 0 && deps.auxTabs === 0 && extCount === 0) {
      deps.collapse?.();
    }
  };

  const closeFileTab = (tabId: string) => {
    const closingLastTab = deps.fileTabs <= 1;
    deps.closeFileTab(tabId);
    if (closingLastTab && !deps.browserOpen && !deps.reviewTabOpen && deps.subagentTabs === 0 && deps.auxTabs === 0 && extCount === 0) {
      deps.collapse?.();
    }
  };

  const closeReviewTab = () => {
    const closingLastTab = deps.reviewTabOpen;
    deps.closeReviewTab();
    if (closingLastTab && !deps.activeFileTab && !deps.browserOpen && deps.subagentTabs === 0 && deps.auxTabs === 0 && extCount === 0) {
      deps.collapse?.();
    }
  };

  const closeAuxTab = (tab: AuxTab) => {
    const closingLastTab = deps.auxTabs <= 1;
    deps.closeAuxTab(tab);
    if (closingLastTab && !deps.activeFileTab && !deps.browserOpen && !deps.reviewTabOpen && deps.subagentTabs === 0 && extCount === 0) {
      deps.collapse?.();
    }
  };

  const closeExtensionTab = (close: () => void) => {
    const closingLastTab = extCount <= 1;
    close();
    if (closingLastTab && !deps.activeFileTab && !deps.browserOpen && !deps.reviewTabOpen && deps.subagentTabs === 0 && deps.auxTabs === 0) {
      deps.collapse?.();
    }
  };

  return { closeBrowserTab, closeFileTab, closeReviewTab, closeAuxTab, closeExtensionTab };
}

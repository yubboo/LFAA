// 右侧工作台顶部标签栏：工作台/辅助面板、文件预览、内置浏览器、变更审查标签与新建浏览器标签按钮。
import { IconFileDiff, IconLayoutGrid, IconPlus, IconWorld, IconX } from "@tabler/icons-react";
import type { BrowserTabItem } from "@lfaa/client-ui-browser/client";
import type { FilePreviewTab } from "../store/chat-types";
import { FileTypeIcon } from "@lfaa/ui-icons/client";
import styles from "./RightWorkbenchPane.module.css";

function baseFileName(filePath: string): string {
  const parts = filePath.replace(/\\/gu, "/").split("/");
  return parts[parts.length - 1] || filePath;
}

export type RightStageKind = "welcome" | "utility" | "file" | "browser" | "review";

export function WorkbenchTabs({
  isZh,
  stageKind,
  auxTitle,
  fileTabs,
  activeFileTab,
  browserOpen,
  browserTabs,
  browserIsBlank,
  reviewTabOpen,
  reviewMessageId,
  onSelectFile,
  onCloseFile,
  onSelectBrowser,
  onCloseBrowser,
  onActivateBrowserTab,
  onCloseBrowserTab,
  onSelectReview,
  onCloseReview,
  onNewBrowserTab,
}: {
  isZh: boolean;
  stageKind: RightStageKind;
  auxTitle: string;
  fileTabs: FilePreviewTab[];
  activeFileTab: FilePreviewTab | undefined;
  browserOpen: boolean;
  browserTabs: BrowserTabItem[];
  browserIsBlank: boolean;
  reviewTabOpen: boolean;
  reviewMessageId: string | undefined;
  onSelectFile: (tabId: string) => void;
  onCloseFile: (tabId: string) => void;
  onSelectBrowser: () => void;
  onCloseBrowser: () => void;
  onActivateBrowserTab: (tab: BrowserTabItem) => void;
  onCloseBrowserTab: (tabId: string) => void;
  onSelectReview: () => void;
  onCloseReview: () => void;
  onNewBrowserTab: () => void;
}) {
  const renderBrowserTabs = () => {
    if (!browserOpen) return null;
    if (browserTabs.length === 0) {
      return (
        <div className={`${styles.tabItem} ${stageKind === "browser" ? styles.tabItemActive : ""}`}>
          <button
            type="button"
            role="tab"
            aria-selected={stageKind === "browser"}
            className={styles.tabBtn}
            onClick={onSelectBrowser}
          >
            <IconWorld size={13} aria-hidden="true" />
            <span>{browserIsBlank ? (isZh ? "新标签页" : "New tab") : (isZh ? "内置浏览器" : "Browser")}</span>
          </button>
          <button type="button" className={styles.tabClose} aria-label={isZh ? "关闭浏览器标签" : "Close browser tab"} onClick={onCloseBrowser}>
            <IconX size={11} />
          </button>
        </div>
      );
    }
    return browserTabs.map((bTab) => {
      const active = stageKind === "browser" && bTab.active;
      const tabLabel = bTab.title && bTab.title !== "about:blank"
        ? bTab.title
        : (bTab.url && bTab.url !== "about:blank" ? bTab.url : (isZh ? "新标签页" : "New Tab"));
      return (
        <div key={bTab.tabId} className={`${styles.tabItem} ${active ? styles.tabItemActive : ""}`}>
          <button
            type="button"
            role="tab"
            aria-selected={active}
            className={styles.tabBtn}
            title={bTab.url && bTab.url !== "about:blank" ? bTab.url : tabLabel}
            onClick={() => onActivateBrowserTab(bTab)}
          >
            <IconWorld size={13} aria-hidden="true" />
            <span>{tabLabel}</span>
          </button>
          <button
            type="button"
            className={styles.tabClose}
            aria-label={isZh ? "关闭浏览器标签" : "Close browser tab"}
            onClick={() => onCloseBrowserTab(bTab.tabId)}
          >
            <IconX size={11} />
          </button>
        </div>
      );
    });
  };

  return (
    <div className={styles.tabBar} role="tablist" aria-label={isZh ? "右侧打开标签" : "Right workbench tabs"}>
      {(stageKind === "welcome" || stageKind === "utility") && (
        <div className={`${styles.tabItem} ${styles.tabItemActive}`}>
          <span className={styles.tabBtn} role="tab" aria-selected="true">
            <IconLayoutGrid size={14} aria-hidden="true" />
            <span>{stageKind === "utility" ? auxTitle : isZh ? "工作台" : "Workbench"}</span>
          </span>
        </div>
      )}
      {fileTabs.map((tab) => {
        const active = stageKind === "file" && tab.id === activeFileTab?.id;
        const fileName = baseFileName(tab.path);
        return (
          <div key={tab.id} className={`${styles.tabItem} ${active ? styles.tabItemActive : ""}`}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className={styles.tabBtn}
              title={tab.path}
              onClick={() => onSelectFile(tab.id)}
            >
              <FileTypeIcon name={fileName} kind="file" />
              <span>{fileName}</span>
            </button>
            <button
              type="button"
              className={styles.tabClose}
              aria-label={isZh ? `关闭 ${baseFileName(tab.path)}` : `Close ${baseFileName(tab.path)}`}
              onClick={() => onCloseFile(tab.id)}
            >
              <IconX size={11} />
            </button>
          </div>
        );
      })}
      {renderBrowserTabs()}
      {reviewTabOpen && (
        <div className={`${styles.tabItem} ${stageKind === "review" ? styles.tabItemActive : ""}`}>
          <button
            type="button"
            role="tab"
            aria-selected={stageKind === "review"}
            className={styles.tabBtn}
            onClick={onSelectReview}
          >
            <IconFileDiff size={13} aria-hidden="true" />
            <span>{reviewMessageId ? (isZh ? "本轮变更" : "Turn changes") : (isZh ? "工作区变更" : "Workspace changes")}</span>
          </button>
          <button
            type="button"
            className={styles.tabClose}
            aria-label={isZh ? "关闭审查标签" : "Close review tab"}
            onClick={onCloseReview}
          >
            <IconX size={11} />
          </button>
        </div>
      )}
      <button
        type="button"
        className={styles.addTabBtn}
        title={isZh ? "新建浏览器标签页" : "New browser tab"}
        aria-label={isZh ? "新建浏览器标签页" : "New browser tab"}
        onClick={onNewBrowserTab}
      >
        <IconPlus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
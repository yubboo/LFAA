// 右侧工作台顶部标签栏：辅助面板、文件预览、子智能体、变更审查与内置浏览器标签，新建按钮固定在行尾。
import { IconCheck, IconFileDiff, IconLayoutGrid, IconLoader2, IconPlus, IconRobot, IconWorld, IconX } from "@tabler/icons-react";
import type { BrowserTabItem } from "@lfaa/client-ui-browser/client";
import type { FilePreviewTab } from "../store/chat-types";
import type { SubagentStageTab } from "./useWorkbenchSubagents";
import type { RightAuxTab } from "./RightUtilityRail";
import { FileTypeIcon } from "@lfaa/ui-icons/client";
import styles from "./RightWorkbenchPane.module.css";

function baseFileName(filePath: string): string {
  const parts = filePath.replace(/\\/gu, "/").split("/");
  return parts[parts.length - 1] || filePath;
}

export type RightStageKind = "welcome" | "utility" | "file" | "browser" | "review" | "subagent";

export function WorkbenchTabs({
  isZh,
  stageKind,
  fileTabs,
  activeFileTab,
  auxTabs,
  activeAuxTab,
  onSelectAuxTab,
  onCloseAuxTab,
  browserOpen,
  browserTabs,
  browserIsBlank,
  reviewTabOpen,
  reviewMessageId,
  subagentTabs,
  activeSubagentTabId,
  onSelectFile,
  onCloseFile,
  onSelectBrowser,
  onCloseBrowser,
  onActivateBrowserTab,
  onCloseBrowserTab,
  onSelectReview,
  onCloseReview,
  onSelectSubagentTab,
  onCloseSubagentTab,
  onNewBrowserTab,
}: {
  isZh: boolean;
  stageKind: RightStageKind;
  fileTabs: FilePreviewTab[];
  activeFileTab: FilePreviewTab | undefined;
  /** 终端、文件树、侧边提问等辅助面板，各自作为独立标签。 */
  auxTabs: Array<{ id: RightAuxTab; title: string }>;
  activeAuxTab: RightAuxTab | null;
  onSelectAuxTab: (tab: RightAuxTab) => void;
  onCloseAuxTab: (tab: RightAuxTab) => void;
  browserOpen: boolean;
  browserTabs: BrowserTabItem[];
  browserIsBlank: boolean;
  reviewTabOpen: boolean;
  reviewMessageId: string | undefined;
  subagentTabs: SubagentStageTab[];
  activeSubagentTabId: string | null;
  onSelectFile: (tabId: string) => void;
  onCloseFile: (tabId: string) => void;
  onSelectBrowser: () => void;
  onCloseBrowser: () => void;
  onActivateBrowserTab: (tab: BrowserTabItem) => void;
  onCloseBrowserTab: (tabId: string) => void;
  onSelectReview: () => void;
  onCloseReview: () => void;
  onSelectSubagentTab: (subagentId: string) => void;
  onCloseSubagentTab: (subagentId: string) => void;
  onNewBrowserTab: () => void;
}) {
  // 浏览器标签始终排在所有标签之后、新建按钮之前，保证新开标签紧挨「+」。
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
      {auxTabs.map(({ id, title }) => {
        const active = stageKind === "utility" && activeAuxTab === id;
        return (
          <div key={id} className={`${styles.tabItem} ${active ? styles.tabItemActive : ""}`}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className={styles.tabBtn}
              onClick={() => onSelectAuxTab(id)}
            >
              <IconLayoutGrid size={13} aria-hidden="true" />
              <span>{title}</span>
            </button>
            <button
              type="button"
              className={styles.tabClose}
              aria-label={isZh ? `关闭 ${title}` : `Close ${title}`}
              onClick={() => onCloseAuxTab(id)}
            >
              <IconX size={11} />
            </button>
          </div>
        );
      })}
      {subagentTabs.map((sTab) => {
        const active = stageKind === "subagent" && sTab.id === activeSubagentTabId;
        return (
          <div key={sTab.id} className={`${styles.tabItem} ${active ? styles.tabItemActive : ""}`}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className={styles.tabBtn}
              title={sTab.role}
              onClick={() => onSelectSubagentTab(sTab.id)}
            >
              {sTab.status === "running" ? (
                <IconLoader2 size={13} aria-hidden="true" />
              ) : sTab.status === "done" ? (
                <IconCheck size={13} aria-hidden="true" />
              ) : (
                <IconRobot size={13} aria-hidden="true" />
              )}
              <span>{sTab.role}</span>
            </button>
            <button
              type="button"
              className={styles.tabClose}
              aria-label={isZh ? `关闭 ${sTab.role}` : `Close ${sTab.role}`}
              onClick={() => onCloseSubagentTab(sTab.id)}
            >
              <IconX size={11} />
            </button>
          </div>
        );
      })}
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
      {renderBrowserTabs()}
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

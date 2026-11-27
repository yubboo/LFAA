// 右侧工作台顶部标签栏：辅助面板、文件预览、子智能体、变更审查与内置浏览器标签，新建按钮固定在行尾。
import { Fragment, useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { IconCheck, IconFileDiff, IconLayoutGrid, IconLoader2, IconPlus, IconRobot, IconWorld, IconX } from "@tabler/icons-react";
import type { BrowserTabItem } from "@lfaa/client-ui-browser/client";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import { shortcutHint } from "@lfaa/ui-layout/client";
import { HoverTip } from "@lfaa/ui-primitives/client";
import type { FilePreviewTab } from "../store/chat-types";
import type { SubagentStageTab } from "./useWorkbenchSubagents";
import type { RightAuxTab } from "./RightUtilityRail";
import { FileTypeIcon } from "@lfaa/ui-icons/client";
import { reconcileTabOrder } from "./tab-order";
import { useWorkbenchTabMenu } from "./useWorkbenchTabMenu";
import { WorkbenchTabMenu } from "./WorkbenchTabMenu";
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
  onCloseBrowserTabAny,
  onCloseFileRaw,
  onCloseAuxRaw,
  onCloseSubagentRaw,
  onCloseReviewRaw,
  closeBrowserTabsExcept,
  workbench,
  extensionTabs = [],
  onLeaveExtension,
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
  /** 关闭任意浏览器标签（含空标签时整体关闭）；右键菜单批量关闭也走它。 */
  onCloseBrowserTabAny: (tabId?: string) => void;
  /** 批量关闭用的非收起版本。 */
  onCloseFileRaw: (id: string) => void;
  onCloseAuxRaw: (tab: RightAuxTab) => void;
  onCloseSubagentRaw: (id: string) => void;
  onCloseReviewRaw: () => void;
  /** 关闭除保留标签外的所有浏览器标签；没有可保留项时整体关闭。 */
  closeBrowserTabsExcept: (keepTabId?: string) => void;
  /** 关闭全部标签后的收尾（右栏收起）。 */
  /** 工作台服务：标签级快捷键注册与菜单键位提示。 */
  workbench?: WorkbenchClientService | undefined;
  extensionTabs?: Array<{ id: string; title: string; active: boolean; select: () => void; close: () => void }>;
  onLeaveExtension?: (() => void) | undefined;
}) {
  const revealed = useRef<HTMLDivElement | null>(null);
  const activeExtension = extensionTabs.find((tab) => tab.active)?.id;
  useEffect(() => {
    if (!activeExtension) return;
    revealed.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    revealed.current?.querySelector("button")?.focus({ preventScroll: true });
  }, [activeExtension]);
  const auxTitleMap = Object.fromEntries(auxTabs.map((tab) => [tab.id, tab.title])) as Record<RightAuxTab, string>;
  // 标签栏自己拥有右键菜单与标签级动作：有序列表与关闭语义都在这里统一，父组件只提供数据与关闭入口。
  const tabMenu = useWorkbenchTabMenu({
    isZh,
    stageKind,
    fileTabs,
    activeFileTab,
    auxTabs: auxTabs.map((tab) => tab.id),
    auxTitles: auxTitleMap,
    activeAuxTab,
    subagentTabs,
    activeSubagentTabId,
    reviewOpen: reviewTabOpen,
    reviewLabel: reviewMessageId ? (isZh ? "本轮变更" : "Turn changes") : (isZh ? "工作区变更" : "Workspace changes"),
    browserOpen,
    browserTabs,
    activeBrowserTabId: browserTabs.find((tab) => tab.active)?.tabId,
    closeFile: onCloseFile,
    closeAux: onCloseAuxTab,
    closeSubagent: onCloseSubagentTab,
    closeReview: onCloseReview,
    closeFileRaw: onCloseFileRaw,
    closeAuxRaw: onCloseAuxRaw,
    closeSubagentRaw: onCloseSubagentRaw,
    closeReviewRaw: onCloseReviewRaw,
    closeBrowser: onCloseBrowserTabAny,
    closeBrowserTabsExcept,
    selectFile: onSelectFile,
    selectAux: onSelectAuxTab,
    selectSubagent: onSelectSubagentTab,
    selectReview: onSelectReview,
    selectBrowser: (tabId) => {
      if (!tabId) { onSelectBrowser(); return; }
      const target = browserTabs.find((tab) => tab.tabId === tabId);
      if (target) onActivateBrowserTab(target);
    },
  }, workbench);
  const newTabHint = shortcutHint("workbench.new-tab");
  const handleContextMenu = (key: string) => (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    tabMenu.openMenu(key, event.clientX, event.clientY);
  };
  const orderRef = useRef<string[]>([]);
  const tabNodes = new Map<string, ReactNode>();

  for (const tab of fileTabs) {
    const active = stageKind === "file" && tab.id === activeFileTab?.id;
    const fileName = baseFileName(tab.path);
    const key = `file:${tab.id}`;
    tabNodes.set(key, (
      <div className={`${styles.tabItem} ${active ? styles.tabItemActive : ""}`} onContextMenu={handleContextMenu(key)}>
        <button type="button" role="tab" aria-selected={active} className={styles.tabBtn} title={tab.path} onClick={() => onSelectFile(tab.id)}>
          <FileTypeIcon name={fileName} kind="file" />
          <span>{fileName}</span>
        </button>
        <button type="button" className={styles.tabClose} aria-label={isZh ? `关闭 ${fileName}` : `Close ${fileName}`} onClick={() => onCloseFile(tab.id)}>
          <IconX size={11} />
        </button>
      </div>
    ));
  }

  for (const { id, title } of auxTabs) {
    const active = stageKind === "utility" && activeAuxTab === id;
    const key = `aux:${id}`;
    tabNodes.set(key, (
      <div className={`${styles.tabItem} ${active ? styles.tabItemActive : ""}`} onContextMenu={handleContextMenu(key)}>
        <button type="button" role="tab" aria-selected={active} className={styles.tabBtn} onClick={() => onSelectAuxTab(id)}>
          <IconLayoutGrid size={13} aria-hidden="true" />
          <span>{title}</span>
        </button>
        <button type="button" className={styles.tabClose} aria-label={isZh ? `关闭 ${title}` : `Close ${title}`} onClick={() => onCloseAuxTab(id)}>
          <IconX size={11} />
        </button>
      </div>
    ));
  }

  for (const sTab of subagentTabs) {
    const active = stageKind === "subagent" && sTab.id === activeSubagentTabId;
    const key = `subagent:${sTab.id}`;
    tabNodes.set(key, (
      <div className={`${styles.tabItem} ${active ? styles.tabItemActive : ""}`} onContextMenu={handleContextMenu(key)}>
        <button type="button" role="tab" aria-selected={active} className={styles.tabBtn} title={sTab.role} onClick={() => onSelectSubagentTab(sTab.id)}>
          {sTab.status === "running" ? <IconLoader2 size={13} aria-hidden="true" /> : sTab.status === "done" ? <IconCheck size={13} aria-hidden="true" /> : <IconRobot size={13} aria-hidden="true" />}
          <span>{sTab.role}</span>
        </button>
        <button type="button" className={styles.tabClose} aria-label={isZh ? `关闭 ${sTab.role}` : `Close ${sTab.role}`} onClick={() => onCloseSubagentTab(sTab.id)}>
          <IconX size={11} />
        </button>
      </div>
    ));
  }

  if (reviewTabOpen) {
    tabNodes.set("review", (
      <div className={`${styles.tabItem} ${stageKind === "review" ? styles.tabItemActive : ""}`} onContextMenu={handleContextMenu("review")}>
        <button type="button" role="tab" aria-selected={stageKind === "review"} className={styles.tabBtn} onClick={onSelectReview}>
          <IconFileDiff size={13} aria-hidden="true" />
          <span>{reviewMessageId ? (isZh ? "本轮变更" : "Turn changes") : (isZh ? "工作区变更" : "Workspace changes")}</span>
        </button>
        <button type="button" className={styles.tabClose} aria-label={isZh ? "关闭审查标签" : "Close review tab"} onClick={onCloseReview}>
          <IconX size={11} />
        </button>
      </div>
    ));
  }

  for (const tab of extensionTabs) {
    const key = `ext:${tab.id}`;
    tabNodes.set(key, (
      <div ref={tab.active ? revealed : undefined} data-extension-tab="" className={`${styles.tabItem} ${tab.active ? styles.tabItemActive : ""}`}>
        <button type="button" role="tab" aria-selected={tab.active} className={styles.tabBtn} onClick={tab.select}>
          <IconLayoutGrid size={13} aria-hidden="true" />
          <span>{tab.title}</span>
        </button>
        <button type="button" className={styles.tabClose} aria-label={isZh ? "关闭" + tab.title : "Close " + tab.title} onClick={tab.close}>
          <IconX size={11} aria-hidden="true" />
        </button>
      </div>
    ));
  }

  if (browserOpen) {
    if (browserTabs.length === 0) {
      tabNodes.set("browser:blank", (
        <div className={`${styles.tabItem} ${stageKind === "browser" ? styles.tabItemActive : ""}`} onContextMenu={handleContextMenu("browser:blank")}>
          <button type="button" role="tab" aria-selected={stageKind === "browser"} className={styles.tabBtn} onClick={onSelectBrowser}>
            <IconWorld size={13} aria-hidden="true" />
            <span>{browserIsBlank ? (isZh ? "新标签页" : "New tab") : (isZh ? "内置浏览器" : "Browser")}</span>
          </button>
          <button type="button" className={styles.tabClose} aria-label={isZh ? "关闭浏览器标签" : "Close browser tab"} onClick={onCloseBrowser}>
            <IconX size={11} />
          </button>
        </div>
      ));
    } else {
      for (const bTab of browserTabs) {
        const active = stageKind === "browser" && bTab.active;
        const tabLabel = bTab.title && bTab.title !== "about:blank"
          ? bTab.title
          : (bTab.url && bTab.url !== "about:blank" ? bTab.url : (isZh ? "新标签页" : "New Tab"));
        const key = `browser:${bTab.tabId}`;
        tabNodes.set(key, (
          <div className={`${styles.tabItem} ${active ? styles.tabItemActive : ""}`} onContextMenu={handleContextMenu(key)}>
            <button type="button" role="tab" aria-selected={active} className={styles.tabBtn} title={bTab.url && bTab.url !== "about:blank" ? bTab.url : tabLabel} onClick={() => onActivateBrowserTab(bTab)}>
              <IconWorld size={13} aria-hidden="true" />
              <span>{tabLabel}</span>
            </button>
            <button type="button" className={styles.tabClose} aria-label={isZh ? "关闭浏览器标签" : "Close browser tab"} onClick={() => onCloseBrowserTab(bTab.tabId)}>
              <IconX size={11} />
            </button>
          </div>
        ));
      }
    }
  }

  const orderedKeys = reconcileTabOrder(orderRef.current, [...tabNodes.keys()]);
  orderRef.current = orderedKeys;

  return (
    <div
      className={styles.tabBar}
      role="tablist"
      aria-label={isZh ? "右侧打开标签" : "Right workbench tabs"}
      onClickCapture={(event) => {
        const target = event.target;
        if (target instanceof Element && !target.closest("[data-extension-tab]") && target.closest('[role="tab"], [data-new-tab]')) onLeaveExtension?.();
      }}
      onDoubleClick={(event) => {
        // 双击任意右栏标签页时切换右栏最大化（收起/还原中间区域）；忽略关闭 × 与新建 + 按钮。
        const target = event.target;
        if (target instanceof Element && target.closest('[role="tab"]')) {
          workbench?.toggleRightPanelMaximized();
        }
      }}
    >
      {orderedKeys.map((key) => <Fragment key={key}>{tabNodes.get(key)}</Fragment>)}
      <HoverTip label={isZh ? "新建浏览器标签页" : "New browser tab"} shortcut={newTabHint}>
        <button
          type="button"
          data-new-tab=""
          className={styles.addTabBtn}
          aria-label={isZh ? "新建浏览器标签页" : "New browser tab"}
          onClick={onNewBrowserTab}
        >
          <IconPlus size={16} aria-hidden="true" />
        </button>
      </HoverTip>
      {workbench && tabMenu.menu && (
        <WorkbenchTabMenu
          isZh={isZh}
          x={tabMenu.menu.x}
          y={tabMenu.menu.y}
          tab={tabMenu.menu.tab}
          tabs={tabMenu.tabs}
          shortcuts={workbench.getSnapshot().shortcuts}
          onClose={tabMenu.closeMenu}
          onCloseTab={tabMenu.closeTab}
          onCloseOthers={tabMenu.closeOthers}
          onCloseRight={tabMenu.closeRightOf}
          onCloseAll={tabMenu.closeAll}
          onNewTab={onNewBrowserTab}
        />
      )}
    </div>
  );
}


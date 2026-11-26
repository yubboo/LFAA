// 右栏标签右键菜单与标签级快捷键：统一有序标签列表、当前舞台识别、单个/其他/右侧/全部关闭与前后切换。
import { useEffect, useRef, useState } from "react";
import type { BrowserTabItem } from "@lfaa/client-ui-browser/client";
import { defaultShortcutKeys, type WorkbenchClientService } from "@lfaa/ui-layout/client";
import type { FilePreviewTab } from "../store/chat-types";
import type { RightAuxTab } from "./RightUtilityRail";
import type { SubagentStageTab } from "./useWorkbenchSubagents";
import type { RightStageKind } from "./WorkbenchTabs";

export type WorkbenchTabKind = "file" | "aux" | "subagent" | "review" | "browser";

/** 标签栏里的一个标签；key 同时是右键菜单的定位标识。 */
export interface WorkbenchOrderedTab {
  key: string;
  kind: WorkbenchTabKind;
  /** 文件 id / 辅助面板 id / 子智能体 id / review / 浏览器 tabId（空标签为 blank）。 */
  id: string;
  label: string;
  path?: string;
  url?: string;
  active: boolean;
}

/** 右键菜单锚点与目标标签。 */
export interface WorkbenchTabMenuState {
  tab: WorkbenchOrderedTab;
  x: number;
  y: number;
}

export interface WorkbenchTabMenuDeps {
  isZh: boolean;
  stageKind: RightStageKind;
  fileTabs: FilePreviewTab[];
  activeFileTab: FilePreviewTab | undefined;
  auxTabs: RightAuxTab[];
  auxTitles: Record<RightAuxTab, string>;
  activeAuxTab: RightAuxTab | null;
  subagentTabs: SubagentStageTab[];
  activeSubagentTabId: string | null;
  reviewOpen: boolean;
  reviewLabel: string;
  browserOpen: boolean;
  browserTabs: BrowserTabItem[];
  activeBrowserTabId: string | undefined;
  closeFile: (id: string) => void;
  closeAux: (tab: RightAuxTab) => void;
  closeSubagent: (id: string) => void;
  closeReview: () => void;
  /** 批量关闭用的非收起版本：关掉多个标签时不希望中途把整个右栏收起。 */
  closeFileRaw: (id: string) => void;
  closeAuxRaw: (tab: RightAuxTab) => void;
  closeSubagentRaw: (id: string) => void;
  closeReviewRaw: () => void;
  closeBrowser: (tabId?: string) => void;
  closeBrowserTabsExcept: (keepTabId?: string) => void;
  selectFile: (id: string) => void;
  selectAux: (tab: RightAuxTab) => void;
  selectSubagent: (id: string) => void;
  selectReview: () => void;
  selectBrowser: (tabId: string | null) => void;
}

/** 取文件名用于标签标题。 */
function baseFileName(filePath: string): string {
  const parts = filePath.replace(/\\/gu, "/").split("/");
  return parts[parts.length - 1] || filePath;
}

/** 组装有序标签列表与关闭/切换动作，并把标签级快捷键注册进工作台注册表。 */
export function useWorkbenchTabMenu(deps: WorkbenchTabMenuDeps, workbench?: WorkbenchClientService) {
  const [menu, setMenu] = useState<WorkbenchTabMenuState | null>(null);
  const isZh = deps.isZh;

  const tabs: WorkbenchOrderedTab[] = [
    ...deps.fileTabs.map((tab): WorkbenchOrderedTab => ({
      key: `file:${tab.id}`,
      kind: "file",
      id: tab.id,
      label: baseFileName(tab.path),
      path: tab.path,
      active: deps.stageKind === "file" && deps.activeFileTab?.id === tab.id,
    })),
    ...deps.auxTabs.map((tab): WorkbenchOrderedTab => ({
      key: `aux:${tab}`,
      kind: "aux",
      id: tab,
      label: deps.auxTitles[tab],
      active: deps.stageKind === "utility" && deps.activeAuxTab === tab,
    })),
    ...deps.subagentTabs.map((tab): WorkbenchOrderedTab => ({
      key: `subagent:${tab.id}`,
      kind: "subagent",
      id: tab.id,
      label: tab.role,
      active: deps.stageKind === "subagent" && deps.activeSubagentTabId === tab.id,
    })),
    ...(deps.reviewOpen ? [{
      key: "review",
      kind: "review" as const,
      id: "review",
      label: deps.reviewLabel,
      active: deps.stageKind === "review",
    }] : []),
    ...(deps.browserOpen ? (deps.browserTabs.length > 0
      ? deps.browserTabs.map((tab): WorkbenchOrderedTab => ({
        key: `browser:${tab.tabId}`,
        kind: "browser",
        id: tab.tabId,
        label: tab.title && tab.title !== "about:blank" ? tab.title : (tab.url && tab.url !== "about:blank" ? tab.url : (isZh ? "新标签页" : "New Tab")),
        ...(tab.url ? { url: tab.url } : {}),
        active: deps.stageKind === "browser" && deps.activeBrowserTabId === tab.tabId,
      }))
      : [{
        key: "browser:blank",
        kind: "browser" as const,
        id: "blank",
        label: isZh ? "新标签页" : "New Tab",
        active: deps.stageKind === "browser",
      }]) : []),
  ];

  const activeKey = tabs.find((tab) => tab.active)?.key ?? null;

  const activate = (tab: WorkbenchOrderedTab) => {
    switch (tab.kind) {
      case "file": deps.selectFile(tab.id); break;
      case "aux": deps.selectAux(tab.id as RightAuxTab); break;
      case "subagent": deps.selectSubagent(tab.id); break;
      case "review": deps.selectReview(); break;
      case "browser": deps.selectBrowser(tab.id === "blank" ? null : tab.id); break;
    }
  };

  const closeTab = (key: string) => {
    const tab = tabs.find((item) => item.key === key);
    if (!tab) return;
    switch (tab.kind) {
      case "file": deps.closeFile(tab.id); break;
      case "aux": deps.closeAux(tab.id as RightAuxTab); break;
      case "subagent": deps.closeSubagent(tab.id); break;
      case "review": deps.closeReview(); break;
      case "browser": deps.closeBrowser(tab.id === "blank" ? undefined : tab.id); break;
    }
  };

  // 批量关闭：普通标签用不收起右栏的版本逐个关；浏览器组按「是否保留某个宿主标签」一次处理。
  const closeMany = (tabList: WorkbenchOrderedTab[], keepBrowserTabId?: string) => {
    for (const tab of tabList) {
      if (tab.kind === "browser") continue;
      if (tab.kind === "file") deps.closeFileRaw(tab.id);
      else if (tab.kind === "aux") deps.closeAuxRaw(tab.id as RightAuxTab);
      else if (tab.kind === "subagent") deps.closeSubagentRaw(tab.id);
      else deps.closeReviewRaw();
    }
    if (tabList.some((tab) => tab.kind === "browser")) deps.closeBrowserTabsExcept(keepBrowserTabId);
  };

  const closeOthers = (key: string) => {
    const target = tabs.find((tab) => tab.key === key);
    closeMany(tabs.filter((tab) => tab.key !== key), target?.kind === "browser" ? target.id : undefined);
  };

  const closeRightOf = (key: string) => {
    const index = tabs.findIndex((tab) => tab.key === key);
    if (index < 0) return;
    const target = tabs[index];
    closeMany(tabs.slice(index + 1), target?.kind === "browser" ? target.id : undefined);
  };

  const closeAll = () => {
    closeMany(tabs);
    // 全部关掉后不留空面板：直接收起右栏，与「关掉最后一个标签」同一收尾。
    workbench?.setRightPanelOpen(false, false);
  };

  const cycle = (delta: number) => {
    if (tabs.length === 0) return;
    const index = activeKey ? tabs.findIndex((tab) => tab.key === activeKey) : -1;
    const next = tabs[(index + delta + tabs.length) % tabs.length] ?? tabs[0];
    if (next) activate(next);
  };

  // 快捷键回调放 ref 里，注册只做一次，避免标签状态变化导致反复注册/注销。
  const actionsRef = useRef({ close: () => {}, cycle: (delta: number) => {} });
  actionsRef.current = {
    close: () => { if (activeKey) closeTab(activeKey); },
    cycle,
  };

  useEffect(() => {
    if (!workbench) return;
    const disposers = [
      workbench.registerShortcut({
        id: "workbench.close-tab",
        group: "workbench",
        title: { zh: "关闭当前标签", en: "Close current tab" },
        description: { zh: "关闭右侧工作台里当前活跃的标签", en: "Close the active workbench tab" },
        defaultKeys: defaultShortcutKeys("workbench.close-tab"),
        run: () => actionsRef.current.close(),
      }),
      workbench.registerShortcut({
        id: "workbench.next-tab",
        group: "workbench",
        title: { zh: "下一个标签", en: "Next tab" },
        description: { zh: "切到右侧工作台的下一个标签", en: "Switch to the next workbench tab" },
        defaultKeys: defaultShortcutKeys("workbench.next-tab"),
        run: () => actionsRef.current.cycle(1),
      }),
      workbench.registerShortcut({
        id: "workbench.prev-tab",
        group: "workbench",
        title: { zh: "上一个标签", en: "Previous tab" },
        description: { zh: "切到右侧工作台的上一个标签", en: "Switch to the previous workbench tab" },
        defaultKeys: defaultShortcutKeys("workbench.prev-tab"),
        run: () => actionsRef.current.cycle(-1),
      }),
    ];
    return () => { for (const dispose of disposers) dispose(); };
  }, [workbench]);

  return {
    tabs,
    activeKey,
    menu,
    openMenu: (key: string, x: number, y: number) => {
      const tab = tabs.find((item) => item.key === key);
      if (tab) setMenu({ tab, x, y });
    },
    closeMenu: () => setMenu(null),
    closeTab,
    closeOthers,
    closeRightOf,
    closeAll,
    activate,
    cycle,
  };
}

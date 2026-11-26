// 四栏 Shell 的全局快捷键：注册壳层/导航动作，并按注册表键位分发；Esc 保持固定语义。
import { useEffect, useRef } from "react";
import type { NavigationView } from "../navigation/navigation";
import type { WorkbenchShortcutState } from "../../contract/index";
import type { WorkbenchClientService } from "../workbench-service";
import { isEditableShortcutTarget, matchesShortcut } from "../shortcuts";
import { defaultShortcutKeys } from "../shortcut-defaults";

/** 注册 Shell 自身的动作并绑定全局按键；动作与按钮共用 service 上的同一实现。 */
export function useShellShortcuts({
  service,
  shortcuts,
  hasRightColumn,
  isCompact,
  toggleRightPanel,
  toggleLeftSidebar,
  navigate,
  setSearchOpen,
  setActivityOpen,
  onEscape,
}: {
  service: WorkbenchClientService;
  shortcuts: WorkbenchShortcutState[];
  hasRightColumn: boolean;
  isCompact: boolean;
  toggleRightPanel: () => void;
  toggleLeftSidebar: () => void;
  navigate: (view: NavigationView) => void;
  setSearchOpen: (open: boolean) => void;
  setActivityOpen: (open: boolean) => void;
  onEscape: () => void;
}) {
  const shortcutRef = useRef(shortcuts);
  shortcutRef.current = shortcuts;

  // 动作回调放 ref：键位或布局变化不导致反复注册，运行时总能拿到最新实现。
  const actionsRef = useRef({ toggleRightPanel, toggleLeftSidebar, navigate, setSearchOpen, setActivityOpen });
  actionsRef.current = { toggleRightPanel, toggleLeftSidebar, navigate, setSearchOpen, setActivityOpen };

  useEffect(() => {
    const disposers = [
      service.registerShortcut({
        id: "global.search",
        group: "global",
        title: { zh: "搜索", en: "Search" },
        description: { zh: "打开全局搜索", en: "Open global search" },
        defaultKeys: defaultShortcutKeys("global.search"),
        run: () => { actionsRef.current.setSearchOpen(true); actionsRef.current.setActivityOpen(false); },
      }),
      service.registerShortcut({
        id: "global.activity",
        group: "global",
        title: { zh: "活动", en: "Activity" },
        description: { zh: "打开活动与通知面板", en: "Open the activity panel" },
        defaultKeys: defaultShortcutKeys("global.activity"),
        run: () => { actionsRef.current.setActivityOpen(true); actionsRef.current.setSearchOpen(false); },
      }),
      service.registerShortcut({
        id: "global.toggle-right-panel",
        group: "global",
        title: { zh: "显示/隐藏右侧菜单栏", en: "Toggle right panel" },
        description: { zh: "展开或收起右侧工作台", en: "Show or hide the right workbench" },
        defaultKeys: defaultShortcutKeys("global.toggle-right-panel"),
        run: () => { if (hasRightColumn) actionsRef.current.toggleRightPanel(); },
      }),
      service.registerShortcut({
        id: "global.maximize-right-panel",
        group: "global",
        title: { zh: "最大化/还原右侧菜单栏", en: "Maximize right panel" },
        description: { zh: "让右侧工作台占满可用宽度", en: "Maximize the right workbench" },
        defaultKeys: defaultShortcutKeys("global.maximize-right-panel"),
        run: () => { if (hasRightColumn && !isCompact) service.toggleRightPanelMaximized(); },
      }),
      service.registerShortcut({
        id: "global.toggle-left-sidebar",
        group: "global",
        title: { zh: "显示/隐藏侧边栏", en: "Toggle sidebar" },
        description: { zh: "展开或收起左二会话项目菜单栏", en: "Show or hide the second sidebar" },
        defaultKeys: defaultShortcutKeys("global.toggle-left-sidebar"),
        run: () => actionsRef.current.toggleLeftSidebar(),
      }),
      service.registerShortcut({
        id: "navigation.shortcuts",
        group: "navigation",
        title: { zh: "键盘快捷键", en: "Keyboard shortcuts" },
        description: { zh: "打开设置中心的键盘快捷键页", en: "Open the keyboard shortcuts settings page" },
        defaultKeys: defaultShortcutKeys("navigation.shortcuts"),
        run: () => { service.navigate("settings:shortcuts"); },
      }),
      service.registerShortcut({
        id: "navigation.settings",
        group: "navigation",
        title: { zh: "打开设置中心", en: "Open settings" },
        description: { zh: "打开设置中心常规页", en: "Open Settings › General" },
        defaultKeys: defaultShortcutKeys("navigation.settings"),
        run: () => { service.navigate("settings:general"); },
      }),
      service.registerShortcut({
        id: "navigation.library",
        group: "navigation",
        title: { zh: "打开资料库", en: "Open library" },
        description: { zh: "跳转到资料库视图", en: "Go to the library view" },
        defaultKeys: defaultShortcutKeys("navigation.library"),
        run: () => actionsRef.current.navigate("library"),
      }),
    ];
    return () => { for (const dispose of disposers) dispose(); };
  }, [hasRightColumn, isCompact, service]);

  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEscapeRef.current();
        return;
      }
      if (event.defaultPrevented) return;
      // 输入框里只放行 Ctrl+Alt 组合（打不出字符，不会抢输入）；单键与纯 Ctrl 组合仍交给输入框。
      if (isEditableShortcutTarget(event.target) && !(event.ctrlKey && event.altKey)) return;
      const hit = shortcutRef.current.find((item) => item.keys !== null && matchesShortcut(item.keys, event));
      if (!hit) return;
      event.preventDefault();
      service.runShortcut(hit.id);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [service]);
}


// 右侧工作台的辅助面板标签：终端、文件树、侧边提问等各自成为可独立关闭、切换的标签。
import { useState } from "react";
import type { RightAuxTab } from "./RightUtilityRail";

export function useWorkbenchAuxTabs() {
  const [tabs, setTabs] = useState<RightAuxTab[]>([]);
  const [active, setActive] = useState<RightAuxTab | null>(null);

  // 打开或聚焦某个辅助标签，重复打开同一个不会产生重复标签。
  const openAuxTab = (tab: RightAuxTab) => {
    setTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]));
    setActive(tab);
  };

  const closeAuxTab = (tab: RightAuxTab) => {
    setTabs((prev) => prev.filter((item) => item !== tab));
    setActive((current) => (current === tab ? null : current));
  };

  // 点击图标轨：已激活则关闭该标签，否则打开/聚焦。
  const toggleAuxTab = (tab: RightAuxTab) => {
    if (active === tab) closeAuxTab(tab);
    else openAuxTab(tab);
  };

  // 切到浏览器/文件等标签时只隐藏辅助面板，不销毁标签。
  const hideAuxTab = () => setActive(null);

  // 会话恢复：持久化仍是单面板语义，恢复成一个标签。
  const restoreAuxTab = (isOpen: boolean, tab: RightAuxTab) => {
    setTabs(isOpen ? [tab] : []);
    setActive(isOpen ? tab : null);
  };

  return { tabs, active, openAuxTab, closeAuxTab, toggleAuxTab, hideAuxTab, restoreAuxTab };
}
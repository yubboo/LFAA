// 右侧工作台辅助面板标题字典：按语言返回文件树、上下文、终端、子智能体、侧边提问与工作详情标题。
import type { RightAuxTab } from "./RightUtilityRail";

export function workbenchAuxTitles(isZh: boolean): Record<RightAuxTab, string> {
  return {
    filesTree: isZh ? "工作区文件" : "Workspace Files",
    workspaceContext: isZh ? "工作区上下文" : "Workspace Context",
    terminal: isZh ? "终端与后台任务" : "Terminal & Tasks",
    subagents: isZh ? "子智能体团队" : "Subagents",
    sideAsk: isZh ? "侧边提问" : "Side Ask",
    details: isZh ? "工作详情" : "Work Details",
  };
}
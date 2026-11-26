// 右侧工作台空白标签策略：空态占位「新标签页」何时自动补齐、何时必须让位给真实内容标签。
// 纯函数，供 RightWorkbenchPane 与单测共用，不依赖 React 与浏览器环境。
import type { RightStageKind } from "./WorkbenchTabs";

/** 右栏标签栏的真实内容标签计数（文件 / 辅助面板 / 子智能体 / 变更审查）。 */
export interface WorkbenchTabCounts {
  fileTabs: number;
  auxTabs: number;
  subagentTabs: number;
  reviewTabOpen: boolean;
}

/** 标签栏是否已有真实内容标签；有内容时空白占位就失去存在意义。 */
export function hasContentTab(counts: WorkbenchTabCounts): boolean {
  return counts.fileTabs > 0 || counts.auxTabs > 0 || counts.subagentTabs > 0 || counts.reviewTabOpen;
}

/** 面板空着且没有浏览器标签时，自动补一个「新标签页」占位，避免只剩一个孤零零的「+」。 */
export function shouldBootstrapBlankTab(input: WorkbenchTabCounts & { browserOpen: boolean }): boolean {
  return !input.browserOpen && !hasContentTab(input);
}

/**
 * 点「+」或按新建标签快捷键时，是否要真的向宿主要一个新标签页。
 * 浏览器还没打开、也没有宿主标签时先露出空态占位；一旦已经打开，就每次都给一个新标签，
 * 不能因为「当前标签正好是空白的」而吞掉点击。
 */
export function shouldCreateHostTab(input: { browserOpen: boolean; browserTabs: number }): boolean {
  return input.browserOpen || input.browserTabs > 0;
}

/**
 * 空白标签何时让位：用户切到文件 / 审查 / 辅助 / 子智能体等真实内容舞台时，空态占位必须收起，
 * 否则标签栏会同时留下「文件标签 + 用户没点过的『新标签页』」，与「一个空白标签就地变身」的约定冲突。
 * 只处理没有宿主页面的纯客户端空白标签（browserTabs === 0），真实浏览器页面一律不动。
 */
export function shouldDropBlankTabForContent(input: {
  stageKind: RightStageKind;
  browserOpen: boolean;
  browserTabs: number;
  browserBlank: boolean;
}): boolean {
  const contentStage = input.stageKind === "file"
    || input.stageKind === "review"
    || input.stageKind === "subagent"
    || input.stageKind === "utility";
  return contentStage && input.browserOpen && input.browserTabs === 0 && input.browserBlank;
}

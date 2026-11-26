// 右栏打开动作：终端、侧边提问与变更审查标签的统一入口，负责替换空白标签与落位。
// 终端被挪到底部面板时，图标轨/快捷键不再另开右栏标签，避免同一个 PTY 在两处各渲染一份。
import type { ChatClientStore } from "../store/chat-store";
import type { RightAuxTab } from "./RightUtilityRail";
import { readTerminalPlacement } from "./terminal-placement";

export function useWorkbenchOpeners(deps: {
  store: ChatClientStore;
  stageKind: string;
  effectiveAuxTab: RightAuxTab | null;
  hideAuxTab: () => void;
  toggleAuxTab: (tab: RightAuxTab) => void;
  openAuxTab: (tab: RightAuxTab) => void;
  dismissBlankTab: () => void;
  setReviewMessageId: (id: string | undefined) => void;
  setReviewTabOpen: (open: boolean) => void;
}) {
  /** 终端在底部时，右栏不再提供同名标签；调用方拿这个判断决定提示还是忽略。 */
  const shellInBottom = (tab: RightAuxTab) => {
    if (tab !== "shell" || readTerminalPlacement() !== "bottom") return false;
    // 终端已经在底部：把焦点交给它，而不是再开一个右栏标签。
    window.dispatchEvent(new CustomEvent("lfaa:terminal-focus"));
    return true;
  };

  const handleToggleAux = (tab: RightAuxTab) => {
    if (shellInBottom(tab)) return;
    deps.dismissBlankTab();
    deps.toggleAuxTab(tab);
  };

  const openAux = (tab: RightAuxTab) => {
    if (shellInBottom(tab)) return;
    deps.dismissBlankTab();
    deps.openAuxTab(tab);
  };

  const openReview = () => {
    deps.hideAuxTab();
    deps.dismissBlankTab();
    deps.setReviewMessageId(undefined); deps.setReviewTabOpen(true);
    deps.store.setRightStageKind("review");
  };

  return { handleToggleAux, openAux, openReview, shellInBottom };
}
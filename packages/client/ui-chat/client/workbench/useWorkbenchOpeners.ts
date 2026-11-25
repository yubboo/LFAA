// 右栏打开动作：终端/文件树/侧边提问与变更审查标签的统一入口，负责替换空白标签与落位。
import type { ChatClientStore } from "../store/chat-store";
import type { RightAuxTab } from "./RightUtilityRail";

export function useWorkbenchOpeners(deps: {
  store: ChatClientStore;
  stageKind: string;
  effectiveAuxTab: RightAuxTab | null;
  setFileTreeOpen: (open: boolean) => void;
  hideAuxTab: () => void;
  toggleAuxTab: (tab: RightAuxTab) => void;
  openAuxTab: (tab: RightAuxTab) => void;
  dismissBlankTab: () => void;
  setReviewMessageId: (id: string | undefined) => void;
  setReviewTabOpen: (open: boolean) => void;
}) {
  const handleToggleAux = (tab: RightAuxTab) => {
    if (tab === "filesTree" && deps.stageKind === "file") {
      deps.setFileTreeOpen(deps.effectiveAuxTab !== "filesTree");
      deps.hideAuxTab();
      return;
    }
    if (tab === "filesTree") deps.store.setRightStageKind(null);
    deps.dismissBlankTab();
    deps.toggleAuxTab(tab);
  };

  const openAux = (tab: RightAuxTab) => {
    if (tab === "filesTree") deps.store.setRightStageKind(null);
    deps.dismissBlankTab();
    deps.openAuxTab(tab);
  };

  const openReview = () => {
    deps.hideAuxTab(); deps.setFileTreeOpen(false);
    deps.dismissBlankTab();
    deps.setReviewMessageId(undefined); deps.setReviewTabOpen(true);
    deps.store.setRightStageKind("review");
  };

  return { handleToggleAux, openAux, openReview };
}
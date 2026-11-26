// 舞台顶栏「动作区」对象装配：把 RightWorkbenchPane 里的 actionProps 大对象搬出来，
// 输入收成一个 deps 对象，舞台容器不用再同时持有这些回调。
import type { ComponentProps } from "react";
import type { ChatClientStore } from "../../store/chat-store";
import type { RightWorkbenchActions } from "../RightWorkbenchActions";
import type { RightAuxTab } from "../RightUtilityRail";
import type { RightSubagentItem } from "../RightSubagentsPane";

/** 动作区对象类型直接取组件 props，避免两处手写漂移。 */
export type PaneActionProps = ComponentProps<typeof RightWorkbenchActions>;

/** 组装动作区所需的最小依赖集合。 */
export interface PaneActionDeps {
  isZh: boolean;
  store: ChatClientStore;
  projectId: string | null;
  projectName: string | undefined;
  jobs: NonNullable<PaneActionProps["jobs"]>;
  subagents: RightSubagentItem[];
  compact: boolean;
  rightPanelMaximized: boolean;
  openReview: () => void;
  setSelectedJobId: (id: string | undefined) => void;
  openAux: (tab: RightAuxTab) => void;
  hideAuxTab: () => void;
  openSubagentTab: (subagentId: string, role?: string) => void;
  openNewBrowserTab: () => void;
  onOpenExtensions?: (() => void) | undefined;
  onToggleMaximizeRightPanel?: (() => void) | undefined;
  hideCollapse: boolean;
  onCloseDrawer?: (() => void) | undefined;
  onCollapseRightPanel?: (() => void) | undefined;
}

/** 生成动作区 props；纯函数，便于舞台容器按需重建。 */
export function buildPaneActionProps(deps: PaneActionDeps): PaneActionProps {
  const {
    isZh, store, projectId, projectName, jobs, subagents, compact, rightPanelMaximized,
    openReview, setSelectedJobId, openAux, hideAuxTab, openSubagentTab, openNewBrowserTab,
    onOpenExtensions, onToggleMaximizeRightPanel, hideCollapse, onCloseDrawer, onCollapseRightPanel,
  } = deps;

  return {
    variant: compact || rightPanelMaximized ? "full" : "workbenchOnly",
    isZh,
    store,
    projectId,
    projectName,
    jobs,
    subagents,
    compact,
    rightPanelMaximized,
    onOpenReviewTab: openReview,
    onOpenTerminal: (jobId) => { setSelectedJobId(jobId); openAux("terminal"); },
    onOpenSubagents: (subId?: string) => {
      if (subId) { hideAuxTab(); openSubagentTab(subId); }
      else { openAux("subagents"); }
    },
    onNewBrowserTab: openNewBrowserTab,
    onOpenExtensions,
    onToggleMaximize: onToggleMaximizeRightPanel,
    onCollapsePanel: hideCollapse ? undefined : () => {
      if (compact && onCloseDrawer) { onCloseDrawer(); return; }
      onCollapseRightPanel?.();
    },
  };
}
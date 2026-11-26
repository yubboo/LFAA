// 右侧工作台辅助面板内容：文件树、工作区上下文、终端任务、子智能体、侧边提问与工作详情。
import type { ReactNode } from "react";
import type { WorkbenchContextPanelContribution } from "@lfaa/ui-layout";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import type { ChatClientStore } from "../store/chat-store";
import type { ChatLocaleMessages } from "../locales";
import { RightFileTreePane } from "./RightFileTreePane";
import { RightSideAskPane } from "./RightSideAskPane";
import { RightSubagentsPane } from "./RightSubagentsPane";
import { RightTerminalPane } from "./RightTerminalPane";
import { TerminalSurface } from "./TerminalSurface";
import { readTerminalPlacement } from "./terminal-placement";
import type { RightAuxTab } from "./RightUtilityRail";
import styles from "./RightWorkbenchPane.module.css";

export function WorkbenchAuxBody({
  tab,
  locale,
  store,
  sessionId,
  boundProjectId,
  boundProjectName,
  boundWorktreeId,
  activeFilePath,
  projectContext,
  utilityPanels,
  activeProfileName,
  activeProfileId,
  memoriesCount,
  activeRulesCount,
  selectedJobId,
  selectedSubagentId,
  onOpenSettings,
  workbench,
}: {
  tab: RightAuxTab;
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  sessionId: string;
  boundProjectId: string | null;
  boundProjectName: string | null;
  boundWorktreeId?: string | undefined;
  activeFilePath: string | undefined;
  projectContext: ReactNode;
  utilityPanels: WorkbenchContextPanelContribution<ReactNode>[];
  activeProfileName: string;
  activeProfileId: string | undefined;
  memoriesCount: number;
  activeRulesCount: number;
  selectedJobId: string | undefined;
  selectedSubagentId: string | undefined;
  onOpenSettings: () => void;
  workbench?: WorkbenchClientService | undefined;
}) {
  if (tab === "shell" && readTerminalPlacement() === "bottom") {
    // 终端已在底部面板：右栏不再渲染第二份，避免同一个 PTY 双开拖慢拖拽。
    return <div className={styles.auxPad}>{locale.isZh ? "终端已在底部面板" : "Terminal is docked below"}</div>;
  }
  if (tab === "shell") {
    // 真实终端：xterm + WebSocket，PTY 在宿主里按聊天会话复用。
    return (
      <TerminalSurface
        sessionId={sessionId}
        isZh={locale.isZh}
        placement="right"
        workbench={workbench}
        onRequestRightTab={() => {}}
      />
    );
  }
  if (tab === "filesTree") {
    return (
      <RightFileTreePane
        projectId={boundProjectId}
        worktreeId={boundWorktreeId}
        projectName={boundProjectName}
        activeFilePath={activeFilePath}
        isZh={locale.isZh}
        store={store}
      />
    );
  }
  if (tab === "workspaceContext") {
    return (
      <div className={styles.auxScroll}>
        {projectContext}
        {utilityPanels.map((p) => (
          <section key={p.id} className={styles.auxCard}>
            <h4 className={styles.auxCardTitle}>{p.title}</h4>
            <div className={styles.auxCardBody}>{p.render()}</div>
          </section>
        ))}
      </div>
    );
  }
  if (tab === "terminal") return <div className={styles.auxPad}><RightTerminalPane sessionId={sessionId} isZh={locale.isZh} selectedJobId={selectedJobId} /></div>;
  if (tab === "subagents") return <div className={styles.auxPad}><RightSubagentsPane sessionId={sessionId} isZh={locale.isZh} selectedSubagentId={selectedSubagentId} /></div>;
  if (tab === "sideAsk") {
    return (
      <div className={styles.auxPad}>
        <RightSideAskPane
          isZh={locale.isZh}
          profileId={activeProfileId}
          contextHint={boundProjectName ? `当前绑定项目：${boundProjectName}` : ""}
        />
      </div>
    );
  }
  return (
    <div className={styles.auxScroll}>
      <div className={styles.auxCard}>
        <div className={styles.detailRow}><span>{locale.brainLabel}</span><strong>{activeProfileName}</strong></div>
        <div className={styles.detailRow}><span>{locale.toolsLabel}</span><strong>{boundProjectName || locale.toolsUnbound}</strong></div>
        <div className={styles.detailRow}><span>{locale.memoryLabel}</span><strong>{`${memoriesCount} ${locale.memoryCountSuffix}`}</strong></div>
        <div className={styles.detailRow}><span>{locale.rulesLabel}</span><strong>{`${activeRulesCount} ${locale.rulesLayersCountSuffix}`}</strong></div>
      </div>
      <button type="button" className={styles.auxActionBtn} onClick={onOpenSettings}>{locale.openAgentSettings}</button>
    </div>
  );
}
// 在四栏右侧上下文面板实时展示当前 Agent 的 LLM 大脑、工具沙箱、记忆条数与规则层级状态。
import { useSyncExternalStore } from "react";
import type { ChatClientStore } from "../chat-store";
import type { ChatLocaleMessages } from "../locales";
import { WorkspaceFileTabs } from "./WorkspaceFileTabs";
import styles from "./AgentContextPanel.module.css";

/** 订阅聊天 Store，在右栏汇总当前模型、工作位置、记忆和规则状态。 */
export function AgentContextPanel({
  locale,
  store,
  boundProjectName,
  showFilePreview,
  onOpenSettings,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  boundProjectName: string | null;
  showFilePreview: boolean;
  onOpenSettings: () => void;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const selection = showFilePreview ? state.filePreviewTabs?.find((tab) => tab.id === state.activeFilePreviewId) : undefined;
  const selectedStep = state.activeSession?.messages.find((message) => message.id === selection?.messageId)
    ?.steps?.find((step) => step.id === selection?.stepId);
  if (selection && selectedStep && state.activeSession) {
    return (
      <WorkspaceFileTabs
        active={selection}
        tabs={state.filePreviewTabs}
        step={selectedStep}
        sessionId={state.activeSession.id}
        projectId={state.activeSession.projectId}
        isZh={locale.isZh}
        store={store}
      />
    );
  }
  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
  const activeRulesCount = state.rules.filter((r) => r.content.trim().length > 0).length;
  const trustedPatternCount = Object.values(state.smartTrustCounts).filter((count) => count >= 3).length;

  const permissionModeName = state.permissionMode === "full"
    ? locale.permissionFullLabel
    : state.permissionMode === "smart"
      ? locale.permissionSmartLabel
      : locale.permissionAskLabel;

  const toolsValue = state.permissionMode === "full"
    ? locale.toolsFullAccess
    : boundProjectName
      ? `${boundProjectName} · ${locale.toolsReady}`
      : locale.toolsUnbound;

  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        <div className={styles.item}>
          <span className={styles.label}>{locale.brainLabel}</span>
          <span className={styles.value}>
            {activeProfile ? `${activeProfile.name} (${activeProfile.model})` : "-"}
          </span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>{locale.toolsLabel}</span>
          <span className={styles.value}>{toolsValue}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>{locale.permissionLabel}</span>
          <span className={`${styles.value} ${state.permissionMode === "full" ? styles.valueDanger : ""}`}>
            {permissionModeName}
            {state.permissionMode === "smart" && trustedPatternCount > 0
              ? ` · ${locale.smartTrustedPrefix} ${trustedPatternCount} ${locale.smartTrustedSuffix}`
              : ""}
          </span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>{locale.memoryLabel}</span>
          <span className={styles.value}>{`${state.memories.length} ${locale.memoryCountSuffix}`}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>{locale.rulesLabel}</span>
          <span className={styles.value}>{`${activeRulesCount} ${locale.rulesLayersCountSuffix}`}</span>
        </div>
      </div>

      {Object.keys(state.smartTrustCounts).length > 0 && (
        <button
          type="button"
          className={styles.settingsBtn}
          onClick={() => void store.resetSmartTrust()}
        >
          {locale.resetSmartTrust}
        </button>
      )}

      <button type="button" className={styles.settingsBtn} onClick={onOpenSettings}>
        {locale.openAgentSettings}
      </button>
    </div>
  );
}

// 在四栏右侧上下文面板实时展示当前 Agent 的 LLM 大脑、工具沙箱、记忆条数与规则层级状态。
import { useSyncExternalStore } from "react";
import type { ChatClientStore } from "../chat-store";
import type { ChatLocaleMessages } from "../locales";
import styles from "./AgentContextPanel.module.css";

export function AgentContextPanel({
  locale,
  store,
  boundProjectName,
  onOpenSettings,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  boundProjectName: string | null;
  onOpenSettings: () => void;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
  const activeRulesCount = state.rules.filter((r) => r.content.trim().length > 0).length;

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
          <span className={styles.value}>
            {boundProjectName ? `${boundProjectName} · ${locale.toolsReady}` : locale.toolsUnbound}
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

      <button type="button" className={styles.settingsBtn} onClick={onOpenSettings}>
        {locale.openAgentSettings}
      </button>
    </div>
  );
}

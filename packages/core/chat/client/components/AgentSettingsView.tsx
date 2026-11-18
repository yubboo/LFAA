// 渲染“模型、规则与记忆配置”页面（注册在 settings:config）：模型管理采用多提供商卡片网格+居中配置弹窗，并支持规则与长期记忆。
import { useEffect, useState, useSyncExternalStore } from "react";
import { StatusBanner } from "@lfaa/ui-primitives/client";
import type { ChatClientStore, PublicLlmProfileItem } from "../chat-store";
import type { ChatLocaleMessages } from "../locales";
import type { ModelProviderPreset } from "../provider-catalog";
import { ModelProviderGrid } from "./ModelProviderGrid";
import { ModelProviderModal } from "./ModelProviderModal";
import styles from "./AgentSettingsView.module.css";

type SettingsTab = "models" | "rules" | "memory";

export function AgentSettingsView({
  locale,
  store,
  boundProjectId,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  boundProjectId: string | null;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [tab, setTab] = useState<SettingsTab>("models");
  const [statusNote, setStatusNote] = useState("");
  const [modalTarget, setModalTarget] = useState<{
    provider: ModelProviderPreset;
    profile?: PublicLlmProfileItem;
  } | null>(null);

  // 规则与记忆表单
  const userRuleDoc = state.rules.find((r) => r.layer === "user");
  const [userRulesDraft, setUserRulesDraft] = useState(userRuleDoc?.content ?? "");
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryScope, setMemoryScope] = useState<"global" | "project">("global");

  useEffect(() => {
    setUserRulesDraft(userRuleDoc?.content ?? "");
  }, [userRuleDoc?.content]);

  return (
    <section className={styles.page} aria-label={locale.settingsTitle}>
      <header className={styles.header}>
        <h1 className={styles.title}>{locale.settingsTitle}</h1>
        <p className={styles.subtitle}>{locale.settingsSubtitle}</p>
      </header>

      <div className={styles.tabs} role="tablist">
        {(
          [
            ["models", locale.tabModels],
            ["rules", locale.tabRules],
            ["memory", locale.tabMemory],
          ] as Array<[SettingsTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`${styles.tabBtn} ${tab === id ? styles.tabBtnActive : ""}`}
            onClick={() => {
              setTab(id);
              setStatusNote("");
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {statusNote && (
        <StatusBanner
          tone="success"
          message={statusNote}
          onDismiss={() => setStatusNote("")}
        />
      )}

      {tab === "models" && (
        <>
          <ModelProviderGrid
            isZh={locale.isZh}
            profiles={state.profiles}
            activeProfileId={state.activeProfileId}
            onSelectProvider={(provider, matched) => {
              setStatusNote("");
              setModalTarget({ provider, ...(matched ? { profile: matched } : {}) });
            }}
          />

          <ModelProviderModal
            open={modalTarget !== null}
            isZh={locale.isZh}
            provider={modalTarget?.provider ?? null}
            profile={modalTarget?.profile}
            canDelete={state.profiles.length > 1}
            store={store}
            onClose={() => setModalTarget(null)}
          />
        </>
      )}

      {tab === "rules" && (
        <div className={styles.panel}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{locale.systemRulesTitle}</span>
            <pre className={styles.readonlyPre}>
              {state.rules.find((r) => r.layer === "system")?.content || ""}
            </pre>
          </div>

          {state.rules.filter((r) => r.layer === "project").length > 0 && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>{locale.projectRulesTitle}</span>
              {state.rules
                .filter((r) => r.layer === "project")
                .map((doc) => (
                  <pre key={doc.id} className={styles.readonlyPre}>{`${doc.source}\n\n${doc.content}`}</pre>
                ))}
            </div>
          )}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{locale.userRulesTitle}</span>
            <textarea
              className={styles.textarea}
              value={userRulesDraft}
              onChange={(e) => setUserRulesDraft(e.target.value)}
              placeholder={locale.userRulesPlaceholder}
            />
          </label>
          <div className={styles.rowActions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void store.saveUserRules(userRulesDraft).then(() => setStatusNote(locale.savedNotice))}
            >
              {locale.saveRules}
            </button>
          </div>
        </div>
      )}

      {tab === "memory" && (
        <div className={styles.panel}>
          <div className={styles.formGrid}>
            <input
              className={styles.input}
              value={memoryDraft}
              onChange={(e) => setMemoryDraft(e.target.value)}
              placeholder={locale.addMemoryPlaceholder}
            />
            <div className={styles.rowActions}>
              <select
                className={styles.input}
                value={memoryScope}
                onChange={(e) => setMemoryScope(e.target.value === "project" ? "project" : "global")}
              >
                <option value="global">{locale.globalScope}</option>
                {boundProjectId && <option value="project">{locale.projectScope}</option>}
              </select>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={!memoryDraft.trim()}
                onClick={() => {
                  const text = memoryDraft.trim();
                  setMemoryDraft("");
                  void store.addLongTermMemory({
                    content: text,
                    scope: memoryScope,
                    projectId: memoryScope === "project" ? boundProjectId : null,
                  });
                }}
              >
                {locale.addMemory}
              </button>
            </div>
          </div>

          {state.memories.length === 0 ? (
            <p className={styles.subtitle}>{locale.emptyMemories}</p>
          ) : (
            state.memories.map((mem) => (
              <div key={mem.id} className={styles.profileRow}>
                <div className={styles.profileMeta}>
                  <span className={styles.profileName}>{mem.content}</span>
                  <span className={styles.profileDetail}>
                    {mem.scope === "project" ? locale.projectScope : locale.globalScope}
                  </span>
                </div>
                <button type="button" className={styles.btnGhost} onClick={() => void store.removeLongTermMemory(mem.id)}>
                  {locale.deleteMemory}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

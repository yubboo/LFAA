// 渲染“模型、规则与记忆配置”页面（注册在 settings:config）：模型管理采用多提供商卡片网格+居中配置弹窗，并支持规则与长期记忆。
import { useEffect, useState, useSyncExternalStore } from "react";
import { StatusBanner } from "@lfaa/ui-primitives/client";
import type { ChatClientStore } from "../chat-store";
import type { ChatLocaleMessages } from "../locales";
import { findProfileForProvider, type ModelProviderPreset } from "../provider-catalog";
import { getProviderPlans } from "../provider-plans";
import { ModelProviderGrid } from "./ModelProviderGrid";
import { ModelProviderModal } from "./ModelProviderModal";
import { ProviderAccess } from "./Provider-Access";
import styles from "./AgentSettingsView.module.css";

type SettingsTab = "models" | "rules" | "memory";
// 选择接入和编辑配置互斥。返回目标保存品牌和刚选过的接入方式。
type ModelDialog =
  | { step: "access"; provider: ModelProviderPreset; previousPresetId?: string }
  | { step: "configure"; provider: ModelProviderPreset; parentProvider?: ModelProviderPreset };

/** 渲染设置中心的模型、规则和记忆页，通过聊天 Store 读写 Host 数据。 */
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
  const [modelDialog, setModelDialog] = useState<ModelDialog | null>(null);
  const modalProvider = modelDialog?.step === "configure" ? modelDialog.provider : null;
  const modalProfile = modalProvider ? findProfileForProvider(state.profiles, modalProvider) : undefined;
  const parentProvider = modelDialog?.step === "configure" ? modelDialog.parentProvider : undefined;

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

      {/* 根据当前品牌是否提供套餐，直接配置或先选择独立的接入方式。 */}
      {tab === "models" && (
        <>
          <ModelProviderGrid
            isZh={locale.isZh}
            profiles={state.profiles}
            activeProfileId={state.activeProfileId}
            onSelectProvider={(provider) => {
              setStatusNote("");
              setModelDialog(getProviderPlans(provider.id).length > 0
                ? { step: "access", provider }
                : { step: "configure", provider });
            }}
          />

          {modelDialog?.step === "access" && (
            <ProviderAccess
              isZh={locale.isZh}
              ordinary={modelDialog.provider}
              profiles={state.profiles}
              focusPresetId={modelDialog.previousPresetId}
              onSelect={(preset) => setModelDialog({ step: "configure", provider: preset, parentProvider: modelDialog.provider })}
              onClose={() => setModelDialog(null)}
            />
          )}

          <ModelProviderModal
            key={modalProvider?.id ?? "closed"}
            open={modalProvider !== null}
            isZh={locale.isZh}
            provider={modalProvider}
            profile={modalProfile}
            canDelete={state.profiles.length > 1}
            store={store}
            onClose={() => setModelDialog(null)}
            {...(parentProvider && modalProvider ? {
              onBack: () => setModelDialog({ step: "access", provider: parentProvider, previousPresetId: modalProvider.id }),
            } : {})}
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

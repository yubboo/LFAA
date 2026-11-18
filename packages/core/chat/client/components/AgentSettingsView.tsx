// 渲染“模型、规则与记忆配置”页面（注册在 settings:config）：支持多模型接入、规则分层查看/编辑与长期记忆管理。
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ChatClientStore, PublicLlmProfileItem } from "../chat-store";
import type { ChatLocaleMessages } from "../locales";
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

  // 模型表单状态
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [kind, setKind] = useState<PublicLlmProfileItem["kind"]>("deepseek");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com/v1");
  const [model, setModel] = useState("deepseek-chat");
  const [apiKey, setApiKey] = useState("");

  // 规则与记忆表单
  const userRuleDoc = state.rules.find((r) => r.layer === "user");
  const [userRulesDraft, setUserRulesDraft] = useState(userRuleDoc?.content ?? "");
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryScope, setMemoryScope] = useState<"global" | "project">("global");

  useEffect(() => {
    setUserRulesDraft(userRuleDoc?.content ?? "");
  }, [userRuleDoc?.content]);

  const loadForEdit = (profile: PublicLlmProfileItem) => {
    setEditId(profile.id);
    setKind(profile.kind);
    setName(profile.name);
    setBaseUrl(profile.baseUrl);
    setModel(profile.model);
    setApiKey("");
  };

  const resetForm = () => {
    setEditId(undefined);
    setKind("openai-compatible");
    setName("");
    setBaseUrl("https://api.openai.com/v1");
    setModel("gpt-4o");
    setApiKey("");
  };

  const handleSaveProfile = async () => {
    try {
      await store.saveLlmProfile({
        ...(editId ? { id: editId } : {}),
        name: name.trim() || model.trim(),
        kind,
        baseUrl,
        model,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setApiKey("");
      setStatusNote(locale.savedNotice);
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : String(error));
    }
  };

  const handleTest = async (profileId: string) => {
    setStatusNote("...");
    try {
      const res = await store.testLlmProfile(profileId);
      setStatusNote(`${res.model}: ${res.replyPreview}`);
    } catch (error) {
      setStatusNote(error instanceof Error ? error.message : String(error));
    }
  };

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

      {statusNote && <p className={styles.statusText} role="status">{statusNote}</p>}

      {tab === "models" && (
        <div className={styles.panel}>
          {state.profiles.map((profile) => (
            <div key={profile.id} className={styles.profileRow}>
              <div className={styles.profileMeta}>
                <span className={styles.profileName}>
                  {profile.name}
                  {profile.id === state.activeProfileId ? ` · ${locale.activeBadge}` : ""}
                </span>
                <span className={styles.profileDetail}>
                  {`${profile.kind} · ${profile.model} · ${profile.baseUrl} · Key: ${profile.hasApiKey ? profile.apiKeyMasked : "-"}`}
                </span>
              </div>
              <div className={styles.rowActions}>
                {profile.id !== state.activeProfileId && (
                  <button type="button" className={styles.btnGhost} onClick={() => void store.setActiveProfile(profile.id)}>
                    {locale.useProfile}
                  </button>
                )}
                <button type="button" className={styles.btnGhost} onClick={() => loadForEdit(profile)}>
                  {locale.saveProfile}
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => void handleTest(profile.id)}>
                  {locale.testConnection}
                </button>
                {state.profiles.length > 1 && (
                  <button type="button" className={styles.btnGhost} onClick={() => void store.deleteLlmProfile(profile.id)}>
                    {locale.deleteProfile}
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{locale.providerLabel}</span>
              <select
                className={styles.input}
                value={kind}
                onChange={(e) => setKind(e.target.value as PublicLlmProfileItem["kind"])}
              >
                <option value="deepseek">DeepSeek</option>
                <option value="openai-compatible">OpenAI Compatible</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{locale.profileNameLabel}</span>
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="DeepSeek Reasoner" />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{locale.baseUrlLabel}</span>
              <input className={styles.input} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{locale.modelIdLabel}</span>
              <input className={styles.input} value={model} onChange={(e) => setModel(e.target.value)} />
            </label>
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{locale.apiKeyLabel}</span>
            <input
              type="password"
              className={styles.input}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={locale.apiKeyKeepPlaceholder}
            />
          </label>
          <div className={styles.rowActions}>
            <button type="button" className={styles.btnPrimary} onClick={() => void handleSaveProfile()}>
              {editId ? locale.saveProfile : locale.addProfile}
            </button>
            {editId && (
              <button type="button" className={styles.btnGhost} onClick={resetForm}>
                {locale.addProfile}
              </button>
            )}
          </div>
        </div>
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

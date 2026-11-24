// 渲染设置中心「模型与规则」页：模型提供商网格、规则与长期记忆；表单按上下排字段组织，删除动作单独成组。
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  SettingDangerGroup,
  SettingFormActions,
  SettingFormBlock,
  SettingFormField,
  SettingGroup,
  SettingRow,
  SettingsPage,
  StatusBanner,
  settingsStyles as baseStyles,
} from "@lfaa/ui-primitives/client";
import type { ChatClientStore } from "../store/chat-store";
import type { ChatLocaleMessages } from "../locales";
import { findProfileForProvider, type ModelProviderPreset } from "../models/provider-catalog";
import { getProviderPlans } from "../models/provider-plans";
import { ModelProviderGrid } from "../models/ModelProviderGrid";
import { ModelProviderModal } from "../models/ModelProviderModal";
import { ProviderAccess } from "../models/Provider-Access";
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
    <SettingsPage title={locale.settingsTitle} description={locale.settingsSubtitle} size="wide">
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
        <StatusBanner tone="success" message={statusNote} onDismiss={() => setStatusNote("")} />
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
        <SettingGroup
          title={locale.userRulesTitle}
          description={locale.isZh
            ? "规则按系统 → 项目 → 用户的顺序叠加；此处只编辑用户层，系统与项目层只读。"
            : "Rules stack system → project → user. Only the user layer is editable here."}
        >
          {state.rules.find((r) => r.layer === "system")?.content && (
            <SettingFormBlock label={locale.systemRulesTitle}>
              <pre className={styles.readonlyPre}>
                {state.rules.find((r) => r.layer === "system")?.content || ""}
              </pre>
            </SettingFormBlock>
          )}

          {state.rules.filter((r) => r.layer === "project").map((doc) => (
            <SettingFormBlock key={doc.id} label={`${locale.projectRulesTitle} · ${doc.source}`}>
              <pre className={styles.readonlyPre}>{doc.content}</pre>
            </SettingFormBlock>
          ))}

          <SettingFormField
            label={locale.userRulesTitle}
            hint={locale.isZh ? "保存后对新一轮对话立即生效。" : "Takes effect from the next turn after saving."}
          >
            <textarea
              className={`${baseStyles.input} ${baseStyles.textarea}`}
              value={userRulesDraft}
              onChange={(e) => setUserRulesDraft(e.target.value)}
              placeholder={locale.userRulesPlaceholder}
            />
          </SettingFormField>
          <SettingFormActions>
            <button
              type="button"
              className={baseStyles.primaryBtn}
              onClick={() => void store.saveUserRules(userRulesDraft).then(() => setStatusNote(locale.savedNotice))}
            >
              {locale.saveRules}
            </button>
          </SettingFormActions>
        </SettingGroup>
      )}

      {tab === "memory" && (
        <>
          <SettingGroup
            title={locale.addMemory}
            description={locale.isZh
              ? "长期记忆会在之后的对话中自动带入；按作用域区分全局与当前项目。"
              : "Long-term memories are injected into later turns, scoped globally or per project."}
          >
            <SettingFormField label={locale.isZh ? "记忆内容" : "Memory"}>
              <input
                className={baseStyles.input}
                value={memoryDraft}
                onChange={(e) => setMemoryDraft(e.target.value)}
                placeholder={locale.addMemoryPlaceholder}
              />
            </SettingFormField>
            <SettingFormField label={locale.isZh ? "作用域" : "Scope"}>
              <select
                className={baseStyles.input}
                value={memoryScope}
                onChange={(e) => setMemoryScope(e.target.value === "project" ? "project" : "global")}
              >
                <option value="global">{locale.globalScope}</option>
                {boundProjectId && <option value="project">{locale.projectScope}</option>}
              </select>
            </SettingFormField>
            <SettingFormActions>
              <button
                type="button"
                className={baseStyles.primaryBtn}
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
            </SettingFormActions>
          </SettingGroup>

          {state.memories.length === 0 ? (
            <p className={baseStyles.pageDesc}>{locale.emptyMemories}</p>
          ) : (
            <SettingDangerGroup title={locale.isZh ? "删除记忆" : "Delete memories"}>
              {state.memories.map((mem) => (
                <SettingRow
                  key={mem.id}
                  title={mem.content}
                  description={mem.scope === "project" ? locale.projectScope : locale.globalScope}
                  control={(
                    <button
                      type="button"
                      className={baseStyles.dangerBtn}
                      onClick={() => void store.removeLongTermMemory(mem.id)}
                    >
                      {locale.deleteMemory}
                    </button>
                  )}
                />
              ))}
            </SettingDangerGroup>
          )}
        </>
      )}
    </SettingsPage>
  );
}
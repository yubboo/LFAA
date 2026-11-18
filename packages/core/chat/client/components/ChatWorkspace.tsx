// 渲染中央聊天工作区：空会话引导、流式回复、Agent 思考/行动/检查轨迹卡片与底部输入栏。
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconArrowUp, IconPlayerStop, IconSettings, IconTrash } from "@tabler/icons-react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { ChatClientStore } from "../chat-store";
import type { ChatLocaleMessages } from "../locales";
import { StepTraceList } from "./StepTraceList";
import styles from "./ChatWorkspace.module.css";

export function ChatWorkspace({
  locale,
  store,
  projects,
  onOpenSettings,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  projects: WorkbenchProjectItem[];
  onOpenSettings: () => void;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const activeSession = state.activeSession;
  const messages = activeSession?.messages ?? [];
  const activeProjectId = activeSession ? activeSession.projectId : state.draftProjectId;
  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
  const needsApiKey = Boolean(activeProfile && activeProfile.kind !== "ollama" && !activeProfile.hasApiKey);
  const isRunning = Boolean(state.runningRunId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, state.runningRunId, state.pendingApproval]);

  const handleSubmit = async (customText?: string) => {
    const content = (customText ?? draft).trim();
    if (!content || isRunning) return;
    if (!customText) setDraft("");
    try {
      await store.sendMessage(content);
    } catch {
      // 错误消息已统一写入 store.errorMessage。
    }
  };

  return (
    <section className={styles.root} aria-label={locale.workspaceTitle}>
      <div className={styles.scrollArea}>
        {messages.length === 0 ? (
          <div className={styles.hero}>
            <h1 className={styles.heroTitle}>{locale.welcomeHeadline}</h1>
            <p className={styles.heroSubtitle}>{locale.welcomeSubtitle}</p>
            <div className={styles.starters}>
              {[locale.starterInspect, locale.starterMemory, locale.starterRules].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className={styles.starterChip}
                  onClick={() => void handleSubmit(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.thread}>
            {messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className={styles.userRow}>
                  <div className={styles.userBubble}>{msg.content}</div>
                </div>
              ) : (
                <article key={msg.id} className={styles.assistantRow}>
                  <StepTraceList
                    locale={locale}
                    steps={msg.steps ?? []}
                    reasoning={msg.reasoning}
                    pendingApproval={msg.status === "streaming" ? state.pendingApproval : null}
                    onResolveApproval={(approved) => void store.resolveApproval(approved)}
                  />
                  <div className={styles.assistantBody}>
                    {msg.content || (msg.status === "streaming" ? "..." : "")}
                  </div>
                  {msg.model && <span className={styles.assistantMeta}>{msg.model}</span>}
                </article>
              ),
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className={styles.composerDock}>
        {state.errorMessage && (
          <div className={styles.errorBanner} role="alert">{state.errorMessage}</div>
        )}
        <div className={styles.composerCard}>
          {needsApiKey && (
            <div className={styles.noticeBar}>
              <span>{locale.modelKeyMissingHint}</span>
              <button type="button" className={styles.noticeLink} onClick={onOpenSettings}>
                {locale.configureModel}
              </button>
            </div>
          )}

          <textarea
            className={styles.textarea}
            placeholder={locale.composerPlaceholder}
            value={draft}
            rows={2}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          />

          <div className={styles.composerBar}>
            <div className={styles.controls}>
              <select
                className={styles.selectPill}
                aria-label={locale.activeModel}
                value={state.activeProfileId}
                onChange={(event) => void store.setActiveProfile(event.target.value)}
              >
                {state.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {`${profile.name} (${profile.model})`}
                  </option>
                ))}
              </select>

              <select
                className={styles.selectPill}
                aria-label={locale.bindProject}
                value={activeProjectId ?? ""}
                onChange={(event) => void store.setActiveProjectBinding(event.target.value || null)}
              >
                <option value="">{locale.noProjectBound}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>

              <button type="button" className={styles.toolBtn} onClick={onOpenSettings}>
                <IconSettings size={14} aria-hidden="true" />
                <span>{locale.configureModel}</span>
              </button>

              {activeSession && (
                <button
                  type="button"
                  className={styles.toolBtn}
                  aria-label={locale.deleteChat}
                  title={locale.deleteChat}
                  onClick={() => void store.deleteSession(activeSession.id)}
                >
                  <IconTrash size={14} aria-hidden="true" />
                </button>
              )}
            </div>

            {isRunning ? (
              <button
                type="button"
                className={styles.stopBtn}
                aria-label={locale.stop}
                title={locale.stop}
                onClick={() => void store.abortActiveRun()}
              >
                <IconPlayerStop size={16} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className={styles.sendBtn}
                aria-label={locale.send}
                title={locale.send}
                disabled={!draft.trim()}
                onClick={() => void handleSubmit()}
              >
                <IconArrowUp size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

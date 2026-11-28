// @lfaa/agent-group 群聊页：SSE 实时流式多成员对话、停止本轮、Markdown/步骤卡片、@ 成员补全、项目绑定与群设置。
// 关联：packages/client/ui-agent-group/client/group/group-api.ts；运行环境：浏览器。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconFolder, IconPlus, IconSettings, IconUsers } from "@tabler/icons-react";
import { groupMessages } from "../locales";
import {
  abortGroupTurn,
  createGroupSession,
  fetchGroupSessions,
  fetchMembers,
  fetchProjectOptions,
  fetchSessionMessages,
  startGroupTurnStream,
  subscribeGroupTurn,
  updateGroupSession,
  type GroupMessageItem,
  type GroupSessionItem,
  type GroupTurnStreamEvent,
  type MemberOption,
  type ProjectOption,
} from "../group/group-api";
import { applyGroupStreamEvent, GroupComposer } from "./Group-Composer";
import { GroupMessageCard } from "./Group-Message-Card";
import { GroupSettingsPanel } from "./Group-Settings-Panel";
import styles from "./Group-View.module.css";

export function GroupView({ isZh }: { isZh: boolean }) {
  const t = groupMessages[isZh ? "zh" : "en"];
  const [groups, setGroups] = useState<GroupSessionItem[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GroupMessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [speakingAgentId, setSpeakingAgentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [panelMode, setPanelMode] = useState<"none" | "create" | "edit">("none");
  const [formTitle, setFormTitle] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formMembers, setFormMembers] = useState<string[]>([]);
  const [formHost, setFormHost] = useState("");
  const unsubRef = useRef<(() => void) | null>(null);
  const streamEndRef = useRef<HTMLDivElement | null>(null);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const activeGroup = useMemo(() => groups.find((g) => g.id === activeId) ?? null, [groups, activeId]);
  const activeMembers = useMemo(
    () => (activeGroup?.group?.agentIds ?? []).map((id) => memberMap.get(id) ?? { id, name: id, kind: "worker" as const, enabled: true, isCli: id.startsWith("cli:") }),
    [activeGroup, memberMap],
  );
  const boundProjectName = useMemo(
    () => (activeGroup?.projectId ? projects.find((p) => p.id === activeGroup.projectId)?.name ?? null : null),
    [activeGroup, projects],
  );

  const report = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : String(cause));
  }, []);

  const loadLists = useCallback(async () => {
    try {
      const [nextGroups, nextMembers, nextProjects] = await Promise.all([
        fetchGroupSessions(),
        fetchMembers(),
        fetchProjectOptions(),
      ]);
      setGroups(nextGroups);
      setMembers(nextMembers);
      setProjects(nextProjects);
      setError("");
    } catch (cause) {
      report(cause);
    }
  }, [report]);

  useEffect(() => {
    void loadLists();
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [loadLists]);

  const refreshMessages = useCallback(async (sessionId: string) => {
    const { messages: next } = await fetchSessionMessages(sessionId);
    setMessages(next);
  }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    void refreshMessages(activeId).catch(report);
  }, [activeId, refreshMessages, report]);

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const openCreate = () => {
    const defaults = members.slice(0, 2).map((m) => m.id);
    setFormTitle("");
    setFormProjectId("");
    setFormMembers(defaults);
    setFormHost(defaults[0] ?? "");
    setPanelMode("create");
  };

  const openEdit = () => {
    if (!activeGroup?.group) return;
    setFormTitle(activeGroup.title);
    setFormProjectId(activeGroup.projectId ?? "");
    setFormMembers([...activeGroup.group.agentIds]);
    setFormHost(activeGroup.group.hostAgentId ?? activeGroup.group.agentIds[0] ?? "");
    setPanelMode("edit");
  };

  const toggleFormMember = (id: string) => {
    setFormMembers((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      if (!next.includes(formHost)) setFormHost(next[0] ?? "");
      return next;
    });
  };

  const submitForm = async () => {
    if (formMembers.length < 2) return;
    setBusy(true);
    try {
      const title = formTitle.trim() || (isZh ? "新建群聊" : "Group Chat");
      const hostAgentId = formHost || formMembers[0];
      if (panelMode === "create") {
        const created = await createGroupSession({
          title,
          projectId: formProjectId || null,
          agentIds: formMembers,
          ...(hostAgentId ? { hostAgentId } : {}),
        });
        await loadLists();
        setActiveId(created.id);
      } else if (panelMode === "edit" && activeGroup) {
        await updateGroupSession(activeGroup.id, {
          title,
          projectId: formProjectId || null,
          group: { agentIds: formMembers, ...(hostAgentId ? { hostAgentId } : {}) },
        });
        await loadLists();
      }
      setPanelMode("none");
      setError("");
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };

  const handleStreamEvent = useCallback((sessionId: string, ev: GroupTurnStreamEvent) => {
    if (ev.type === "speaker_started") setSpeakingAgentId(ev.agentId);
    if (ev.type === "turn_finished") {
      setActiveTurnId(null);
      setSpeakingAgentId(null);
      setBusy(false);
      void refreshMessages(sessionId).catch(() => undefined);
      return;
    }
    setMessages((prev) => applyGroupStreamEvent(prev, ev));
  }, [refreshMessages]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!activeId || !text || busy) return;
    setBusy(true);
    setError("");
    setDraft("");
    setMentionQuery(null);
    const chosenMentions = [...mentions];
    setMentions([]);
    setMessages((prev) => [
      ...prev,
      { id: `local-user-${Date.now()}`, role: "user", content: text, createdAt: Date.now() },
    ]);
    try {
      const started = await startGroupTurnStream({
        sessionId: activeId,
        userMessage: text,
        ...(chosenMentions.length > 0 ? { mentions: chosenMentions } : {}),
      });
      setActiveTurnId(started.turnId);
      unsubRef.current?.();
      unsubRef.current = subscribeGroupTurn(
        started.turnId,
        (ev) => handleStreamEvent(activeId, ev),
        () => {
          setActiveTurnId(null);
          setSpeakingAgentId(null);
          setBusy(false);
          void refreshMessages(activeId).catch(() => undefined);
        },
      );
    } catch (cause) {
      setBusy(false);
      report(cause);
    }
  };

  const stopTurn = async () => {
    if (!activeTurnId) return;
    try {
      await abortGroupTurn(activeTurnId);
    } catch (cause) {
      report(cause);
    }
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    const atMatch = /(?:^|\s)@([^\s@]*)$/u.exec(value);
    setMentionQuery(atMatch ? (atMatch[1] ?? "") : null);
  };

  const pickMentionFromPopup = (member: MemberOption) => {
    setDraft((prev) => prev.replace(/(?:^|\s)@[^\s@]*$/u, (m) => (m.startsWith(" ") ? " " : "")));
    setMentions((prev) => (prev.includes(member.id) ? prev : [...prev, member.id]));
    setMentionQuery(null);
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{t.title}</h2>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.primary} onClick={openCreate}>
            <IconPlus size={14} aria-hidden="true" />
            <span>{t.newGroup}</span>
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.body}>
        <ul className={styles.list}>
          {groups.length === 0 ? <li className={styles.empty}>{t.empty}</li> : null}
          {groups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                className={`${styles.groupRow} ${group.id === activeId ? styles.groupRowActive : ""}`}
                onClick={() => {
                  setPanelMode("none");
                  setActiveId(group.id);
                }}
              >
                <span className={styles.groupAvatar}><IconUsers size={15} aria-hidden="true" /></span>
                <span className={styles.groupText}>
                  <span className={styles.groupName}>{group.title}</span>
                  <span className={styles.groupMeta}>
                    {isZh ? `${group.group?.agentIds.length ?? 0} 位成员` : `${group.group?.agentIds.length ?? 0} members`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {panelMode !== "none" ? (
          <GroupSettingsPanel
            mode={panelMode}
            isZh={isZh}
            title={formTitle}
            projectId={formProjectId}
            selectedMembers={formMembers}
            hostId={formHost}
            members={members}
            projects={projects}
            busy={busy}
            onTitleChange={setFormTitle}
            onProjectChange={setFormProjectId}
            onToggleMember={toggleFormMember}
            onHostChange={setFormHost}
            onSubmit={() => void submitForm()}
            onCancel={() => setPanelMode("none")}
          />
        ) : !activeGroup ? (
          <div className={styles.placeholder}>{t.empty}</div>
        ) : (
          <section className={styles.chat}>
            <div className={styles.chatHeader}>
              <div className={styles.chips}>
                <strong className={styles.chatTitle}>{activeGroup.title}</strong>
                {boundProjectName && (
                  <span className={styles.chip}>
                    <IconFolder size={12} aria-hidden="true" />
                    <span>{boundProjectName}</span>
                  </span>
                )}
                {speakingAgentId && (
                  <span className={`${styles.chip} ${styles.chipOn}`}>
                    {isZh
                      ? `${memberMap.get(speakingAgentId)?.name ?? speakingAgentId} 发言中…`
                      : `${memberMap.get(speakingAgentId)?.name ?? speakingAgentId} speaking…`}
                  </span>
                )}
              </div>
              <button type="button" className={styles.ghost} onClick={openEdit}>
                <IconSettings size={14} aria-hidden="true" />
                <span>{isZh ? "群设置" : "Settings"}</span>
              </button>
            </div>

            <div className={styles.messages}>
              {messages.map((msg) => {
                const author = msg.authorAgentId ? memberMap.get(msg.authorAgentId) : undefined;
                return (
                  <GroupMessageCard
                    key={msg.id}
                    message={msg}
                    authorName={author?.name ?? msg.authorAgentId ?? (isZh ? "助手" : "Assistant")}
                    isCli={Boolean(author?.isCli || msg.authorAgentId?.startsWith("cli:"))}
                    isZh={isZh}
                  />
                );
              })}
              <div ref={streamEndRef} />
            </div>

            <GroupComposer
              isZh={isZh}
              sendLabel={t.send}
              draft={draft}
              mentions={mentions}
              mentionQuery={mentionQuery}
              activeMembers={activeMembers}
              activeTurnId={activeTurnId}
              busy={busy}
              onDraftChange={handleDraftChange}
              onPickMention={pickMentionFromPopup}
              onToggleMention={(id) => setMentions((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))}
              onSend={() => void sendMessage()}
              onStop={() => void stopTurn()}
            />
          </section>
        )}
      </div>
    </div>
  );
}

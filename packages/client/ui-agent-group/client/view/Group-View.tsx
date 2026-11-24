// @lfaa/agent-group 群聊页：左侧群列表与建群，右侧消息流与发送框。
// 消息渲染只做文本 + 说话人 + 模型，完整步骤仍回主会话查看；发送后按 1.2 秒轮询刷新到本轮收口。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconSend, IconUsers, IconX } from "@tabler/icons-react";
import { groupMessages } from "../locales";
import {
  createGroupSession,
  fetchGroupSessions,
  fetchMembers,
  fetchSessionMessages,
  startGroupTurn,
  type GroupMessageItem,
  type GroupSessionItem,
  type MemberOption,
} from "../group/group-api";
import composerStyles from "./Group-Composer.module.css";
import styles from "./Group-View.module.css";

const POLL_MS = 1200;
const POLL_LIMIT = 150;

/** 群聊页主体；isZh 决定文案。 */
export function GroupView({ isZh }: { isZh: boolean }) {
  const t = groupMessages[isZh ? "zh" : "en"];
  const [groups, setGroups] = useState<GroupSessionItem[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GroupMessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMembers, setNewMembers] = useState<string[]>([]);
  const [newHost, setNewHost] = useState("");
  const pollRef = useRef<number | undefined>(undefined);

  const report = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : String(cause));
  }, []);

  const loadLists = useCallback(async () => {
    try {
      const [nextGroups, nextMembers] = await Promise.all([fetchGroupSessions(), fetchMembers()]);
      setGroups(nextGroups);
      setMembers(nextMembers);
      setError("");
    } catch (cause) {
      report(cause);
    }
  }, [report]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const refreshMessages = useCallback(async (sessionId: string) => {
    const { messages: next } = await fetchSessionMessages(sessionId);
    setMessages(next);
    return next;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== undefined) {
      window.clearTimeout(pollRef.current);
      pollRef.current = undefined;
    }
  }, []);

  /** 轮询到没有 streaming 消息为止；上限约 3 分钟，避免异常任务把页面挂死。 */
  const pollUntilIdle = useCallback((sessionId: string) => {
    stopPolling();
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const next = await refreshMessages(sessionId);
        const streaming = next.some((message) => message.status === "streaming");
        if (streaming && attempts < POLL_LIMIT) {
          pollRef.current = window.setTimeout(() => void tick(), POLL_MS);
        } else {
          setBusy(false);
          pollRef.current = undefined;
          await loadLists();
        }
      } catch (cause) {
        setBusy(false);
        report(cause);
      }
    };
    pollRef.current = window.setTimeout(() => void tick(), POLL_MS);
  }, [loadLists, refreshMessages, report, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  const openGroup = async (sessionId: string) => {
    setActiveId(sessionId);
    setMentions([]);
    setError("");
    try {
      await refreshMessages(sessionId);
    } catch (cause) {
      report(cause);
    }
  };

  const send = async () => {
    if (!activeId || !draft.trim() || busy) return;
    setBusy(true);
    setError("");
    const text = draft;
    setDraft("");
    try {
      const started = await startGroupTurn({
        sessionId: activeId,
        userMessage: text,
        ...(mentions.length > 0 ? { mentions } : {}),
      });
      setMentions([]);
      // 计划无效时把原因亮出来：用户需要知道「为什么没按计划来」。
      if (started.planIssues?.length) {
        setError(`${t.planDegraded}（${started.planIssues.join(" / ")}）`);
      } else {
        setError("");
      }
      pollUntilIdle(activeId);
    } catch (cause) {
      setBusy(false);
      report(cause);
    }
  };

  const createGroup = async () => {
    if (newMembers.length < 2) {
      setError(t.membersHint);
      return;
    }
    setBusy(true);
    try {
      const created = await createGroupSession({
        title: newTitle.trim() || t.newGroup,
        agentIds: newMembers,
        ...(newHost ? { hostAgentId: newHost } : {}),
      });
      setCreating(false);
      setNewTitle("");
      setNewMembers([]);
      setNewHost("");
      await loadLists();
      await openGroup(created.id);
      setError("");
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };

  const active = useMemo(() => groups.find((group) => group.id === activeId) ?? null, [groups, activeId]);
  /** 本轮群聊的成本分账：按说话人累计，再给一个总计；未配置单价的消息不计入。 */
  const costByAgent = useMemo(() => {
    const totals = new Map<string, number>();
    let total = 0;
    let currency = "CNY";
    for (const message of messages) {
      const amount = message.cost?.amount;
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) continue;
      const key = message.authorAgentId ?? "";
      totals.set(key, (totals.get(key) ?? 0) + amount);
      total += amount;
      if (message.cost?.currency) currency = message.cost.currency;
    }
    return { totals: [...totals.entries()], total, currency };
  }, [messages]);
  const nameOf = useCallback((agentId?: string): string => {
    if (!agentId) return "";
    return members.find((member) => member.id === agentId)?.name ?? agentId;
  }, [members]);

  const toggleMention = (agentId: string) => {
    setMentions((current) => current.includes(agentId)
      ? current.filter((id) => id !== agentId)
      : [...current, agentId]);
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{t.title}</h2>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.primary} onClick={() => setCreating(true)} disabled={busy}>
            <IconUsers size={14} /> {t.newGroup}
          </button>
        </div>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.body}>
        <ul className={styles.list}>
          {groups.length === 0 ? <li className={styles.empty}>{t.empty}</li> : null}
          {groups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                className={`${styles.groupRow} ${group.id === activeId ? styles.groupRowActive : ""}`}
                onClick={() => void openGroup(group.id)}
              >
                <span className={styles.groupAvatar}><IconUsers size={15} /></span>
                <span className={styles.groupText}>
                  <span className={styles.groupName}>{group.title}</span>
                  <span className={styles.groupMeta}>
                    {group.group ? group.group.agentIds.map((id) => nameOf(id)).join("、") : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {creating ? (
          <section className={styles.panel}>
            <h3 className={styles.panelTitle}>{t.newGroup}</h3>
            <label className={styles.field}>
              <span>{t.groupName}</span>
              <input
                className={styles.input}
                value={newTitle}
                placeholder={t.groupNamePlaceholder}
                onChange={(event) => setNewTitle(event.target.value)}
              />
            </label>
            <div className={styles.field}>
              <span>{t.members}</span>
              <div className={styles.chips}>
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className={`${styles.chip} ${newMembers.includes(member.id) ? styles.chipOn : ""}`}
                    onClick={() => setNewMembers((current) => current.includes(member.id)
                      ? current.filter((id) => id !== member.id)
                      : [...current, member.id])}
                  >
                    {member.name}
                  </button>
                ))}
                {members.length === 0 ? <span className={styles.hint}>{t.noMembers}</span> : null}
              </div>
              <span className={styles.hint}>{t.membersHint}</span>
            </div>
            <label className={styles.field}>
              <span>{t.host}</span>
              <select className={styles.input} value={newHost} onChange={(event) => setNewHost(event.target.value)}>
                <option value="">{t.mentionNone}</option>
                {newMembers.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
              </select>
              <span className={styles.hint}>{t.hostHint}</span>
            </label>
            <div className={styles.rowActions}>
              <button type="button" className={styles.primary} onClick={() => void createGroup()} disabled={busy}>
                {t.create}
              </button>
              <button type="button" className={styles.ghost} onClick={() => setCreating(false)}>{t.cancel}</button>
            </div>
          </section>
        ) : null}

        {active ? (
          <section className={styles.chat}>
            <div className={styles.chatHeader}>
              <span className={styles.chatTitle}>{active.title}</span>
              <span className={styles.chatMembers}>{active.group?.agentIds.map((id) => nameOf(id)).join("、")}</span>
              {costByAgent.total > 0 ? (
                <span className={styles.cost} title={costByAgent.totals.map(([id, amount]) => `${nameOf(id)} ${amount.toFixed(4)}`).join(" · ")}>
                  {t.costLabel} {costByAgent.total.toFixed(4)} {costByAgent.currency}
                </span>
              ) : null}
            </div>
            <div className={styles.messages}>
              {messages.length === 0 ? <div className={styles.empty}>{t.emptyMessages}</div> : null}
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`${styles.message} ${message.role === "user" ? styles.messageUser : ""}`}
                >
                  <div className={styles.messageHead}>
                    <span className={styles.speaker}>
                      {message.role === "user" ? "你" : nameOf(message.authorAgentId)}
                    </span>
                    {message.role === "assistant" && message.model ? (
                      <span className={styles.modelTag}>{message.model}</span>
                    ) : null}
                    {message.status === "streaming" ? <span className={styles.streaming} /> : null}
                    {message.cost && message.cost.amount > 0 ? (
                      <span className={styles.modelTag}>{message.cost.amount.toFixed(4)} {message.cost.currency}</span>
                    ) : null}
                  </div>
                  {message.speakerTask ? <div className={styles.task}>{t.taskLabel}：{message.speakerTask}</div> : null}
                  <div className={styles.messageBody}>
                    {message.content || (message.status === "streaming" ? t.sending : "")}
                  </div>
                </article>
              ))}
            </div>
            <div className={composerStyles.composer}>
              <div className={composerStyles.mentionBar}>
                <span className={styles.hint}>{mentions.length > 0 ? `${t.mentionHint} ${mentions.map((id) => nameOf(id)).join("、")}` : t.mentionNone}</span>
                <div className={styles.chips}>
                  {active.group?.agentIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`${styles.chip} ${mentions.includes(id) ? styles.chipOn : ""}`}
                      onClick={() => toggleMention(id)}
                    >
                      @{nameOf(id)}
                      {mentions.includes(id) ? <IconX size={11} /> : null}
                    </button>
                  ))}
                </div>
              </div>
              <div className={composerStyles.inputRow}>
                <textarea
                  className={styles.textarea}
                  value={draft}
                  placeholder={t.placeholder}
                  rows={2}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button type="button" className={composerStyles.send} onClick={() => void send()} disabled={busy || !draft.trim()}>
                  <IconSend size={15} />
                </button>
              </div>
            </div>
          </section>
        ) : (
          <div className={styles.placeholder}>{t.selectGroup}</div>
        )}
      </div>
    </div>
  );
}
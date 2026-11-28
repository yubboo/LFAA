// 主聊天顶栏「协作 Agent 成员」选择器：1 位即单聊，拉入 ≥2 位即在同一聊天界面升级为多 Agent 协作并支持分工。
// 关联：packages/client/ui-chat/client/conversation/ChatWorkspace.tsx；运行环境：浏览器。
import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconTerminal2, IconUserPlus, IconUsers } from "@tabler/icons-react";
import { fetchJson } from "../store/chat-http";
import { fetchCliAgentsOverview, subscribeCliAgentsChanged } from "../settings/cli-agents-client";
import styles from "./SessionMembersPicker.module.css";

export interface TeamMemberOption {
  id: string;
  name: string;
  isCli: boolean;
}

export interface SessionTeamSelection {
  agentIds: string[];
  memberRoles: Record<string, string>;
}

/** 从当前会话或草稿团队状态解析统一的协作成员与分工（单聊默认小鱼）。 */
export function resolveSessionTeam(
  activeSession: { kind?: "single" | "group"; agentId?: string | null; group?: { agentIds: string[]; memberRoles?: Record<string, string> } } | null,
  draftTeam?: { agentIds: string[]; memberRoles?: Record<string, string> },
): SessionTeamSelection {
  if (activeSession) {
    if (activeSession.kind === "group" && activeSession.group && activeSession.group.agentIds.length >= 2) {
      return { agentIds: activeSession.group.agentIds, memberRoles: activeSession.group.memberRoles ?? {} };
    }
    return { agentIds: [activeSession.agentId || "xiaoyu"], memberRoles: {} };
  }
  if (draftTeam && draftTeam.agentIds.length > 0) {
    return { agentIds: draftTeam.agentIds, memberRoles: draftTeam.memberRoles ?? {} };
  }
  return { agentIds: ["xiaoyu"], memberRoles: {} };
}

/** 格式化消息发言者标签：把 cli:* 或内置 ID 转成易读名称。 */
export function formatSpeakerLabel(agentId: string): { name: string; isCli: boolean } {
  if (agentId === "xiaoyu") return { name: "小鱼", isCli: false };
  if (agentId.startsWith("cli:")) {
    const raw = agentId.slice(4);
    const map: Record<string, string> = {
      claude: "Claude Code",
      codex: "Codex",
      agy: "Antigravity",
      opencode: "OpenCode",
      cursor: "Cursor CLI",
      grok: "Grok CLI",
      qwen: "Qwen Code",
      kimi: "Kimi Code",
    };
    return { name: map[raw] ?? raw, isCli: true };
  }
  return { name: agentId, isCli: false };
}

/** 拉取可选协作 Agent（内置/自定义角色 + 本机已安装且支持聊天的官方 CLI）。 */
export function useTeamMemberOptions(): TeamMemberOption[] {
  const [options, setOptions] = useState<TeamMemberOption[]>([{ id: "xiaoyu", name: "小鱼", isCli: false }]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [agentsRes, cliRes] = await Promise.all([
          fetchJson<{ agents: Array<{ id: string; name: string; enabled: boolean }> }>("/api/agents").catch(() => ({ agents: [] })),
          fetchCliAgentsOverview().catch(() => ({ agents: [] })),
        ]);
        if (!alive) return;
        const roles: TeamMemberOption[] = (agentsRes.agents ?? [])
          .filter((a) => a.enabled)
          .map((a) => ({ id: a.id, name: a.name, isCli: false }));
        const clis: TeamMemberOption[] = (cliRes.agents ?? [])
          .filter((c) => c.installed && c.supportsChat)
          .map((c) => ({ id: `cli:${c.id}`, name: `${c.name}`, isCli: true }));
        const combined = roles.length > 0 ? [...roles, ...clis] : [{ id: "xiaoyu", name: "小鱼", isCli: false }, ...clis];
        setOptions(combined);
      } catch {
        // 保持兜底小鱼
      }
    };
    void load();
    const unsub = subscribeCliAgentsChanged(() => void load());
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return options;
}

export function SessionMembersPicker({
  isZh,
  selectedIds,
  memberRoles,
  disabled = false,
  onApply,
}: {
  isZh: boolean;
  selectedIds: string[];
  memberRoles: Record<string, string>;
  disabled?: boolean;
  onApply: (next: SessionTeamSelection) => void;
}) {
  const options = useTeamMemberOptions();
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);
  const [draftRoles, setDraftRoles] = useState<Record<string, string>>(memberRoles);
  const wrapRef = useRef<HTMLDivElement>(null);

  const optionMap = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const effectiveIds = selectedIds.length > 0 ? selectedIds : ["xiaoyu"];
  const isGroup = effectiveIds.length >= 2;

  useEffect(() => {
    if (!open) return;
    setDraftIds(effectiveIds);
    setDraftRoles(memberRoles);
  }, [open, effectiveIds.join(","), JSON.stringify(memberRoles)]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggleId = (id: string) => {
    setDraftIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const label = isGroup
    ? effectiveIds.slice(0, 2).map((id) => optionMap.get(id)?.name ?? id).join(" + ")
      + (effectiveIds.length > 2 ? ` +${effectiveIds.length - 2}` : "")
    : `${optionMap.get(effectiveIds[0]!)?.name ?? effectiveIds[0]} · ${isZh ? "拉成员协作" : "Collaborate"}`;

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={`${styles.trigger} ${isGroup ? styles.triggerGroup : ""} ${open ? styles.triggerOpen : ""}`}
        disabled={disabled}
        aria-expanded={open}
        aria-label={isZh ? "协作 Agent 成员" : "Collaborating Agents"}
        onClick={() => setOpen((v) => !v)}
      >
        {isGroup ? <IconUsers size={14} aria-hidden="true" /> : <IconUserPlus size={14} aria-hidden="true" />}
        <span>{label}</span>
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label={isZh ? "选择协作 Agent" : "Select Agents"}>
          <div className={styles.head}>
            <span className={styles.title}>{isZh ? "会话协作 Agent" : "Session Agents"}</span>
            <span className={styles.hint}>
              {draftIds.length >= 2
                ? (isZh ? `已选 ${draftIds.length} 位（群协作）` : `${draftIds.length} active (Group)`)
                : (isZh ? "选 2 位及以上即开启多 Agent 协作" : "Pick 2+ for multi-agent")}
            </span>
          </div>

          <div className={styles.list}>
            {options.map((opt) => {
              const checked = draftIds.includes(opt.id);
              return (
                <div key={opt.id} className={`${styles.memberBox} ${checked ? styles.memberBoxActive : ""}`}>
                  <button type="button" className={styles.memberRow} onClick={() => toggleId(opt.id)}>
                    <span className={styles.memberLeft}>
                      {opt.isCli && <IconTerminal2 size={14} aria-hidden="true" />}
                      <span>{opt.name}</span>
                      {opt.isCli && <span className={`${styles.badge} ${styles.badgeCli}`}>CLI</span>}
                    </span>
                    {checked && <IconCheck size={14} stroke={2.2} aria-hidden="true" />}
                  </button>
                  {checked && draftIds.length >= 2 && (
                    <input
                      type="text"
                      className={styles.roleInput}
                      placeholder={isZh ? "分工说明（可选，如：策划 / 写后端 / 审查）" : "Role (optional, e.g. Planner / Coder / Reviewer)"}
                      value={draftRoles[opt.id] ?? ""}
                      onChange={(e) => setDraftRoles((prev) => ({ ...prev, [opt.id]: e.target.value }))}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className={styles.footer}>
            <span className={styles.hint}>
              {isZh ? "消息里打 @名字 可指定顺序" : "Type @name to direct order"}
            </span>
            <button
              type="button"
              className={styles.applyBtn}
              disabled={draftIds.length === 0}
              onClick={() => {
                const cleanedRoles: Record<string, string> = {};
                for (const id of draftIds) {
                  const r = draftRoles[id]?.trim();
                  if (r) cleanedRoles[id] = r;
                }
                onApply({ agentIds: draftIds, memberRoles: cleanedRoles });
                setOpen(false);
              }}
            >
              {isZh ? "应用" : "Apply"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

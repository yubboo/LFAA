// @lfaa/agent-group 群聊编排：把用户一条消息展开成「按顺序逐个 agent 发言」，共享同一份会话历史。
// 有 @ 时按 @ 顺序；没有 @ 时请代理人出一份发言计划，校验通过才照做，否则降级为代理人单答。
import type { AgentService } from "@lfaa/agent";
import type { ChatSessionRecord, MemoryService } from "@lfaa/memory";
import { extractPlanJson, validateSpeakingPlan, type PlanIssue, type SpeakingPlan } from "./speaking-plan";

/** 一次群聊回合的入参。 */
export interface GroupTurnInput {
  sessionId: string;
  userMessage: string;
  /** 用户 @ 的成员，顺序即发言顺序；为空时交给代理人调度。 */
  mentions?: string[];
}

/** 一位成员的发言结果。 */
export interface GroupSpeakerResult {
  agentId: string;
  runId: string;
  task?: string;
}

/** 一回合的结果：回合 id、实际发言者，以及调度与降级信息。 */
export interface GroupTurnResult {
  turnId: string;
  speakers: GroupSpeakerResult[];
  /** 命中的发言计划（仅在代理人调度成功时存在）。 */
  plan?: SpeakingPlan;
  /** 计划作废的原因；为空表示没有降级。 */
  planIssues?: PlanIssue[];
}

/** 成员的展示信息，供调度提示使用。 */
export interface GroupMemberInfo {
  id: string;
  name: string;
  description?: string;
}

/** 编排依赖：会话存储 + Agent 运行入口 + 可选的调度/成员描述注入（便于测试替身）。 */
export interface GroupTurnDeps {
  memory: Pick<MemoryService, "getSession">;
  agent: Pick<AgentService, "startRun" | "waitForRun">;
  /** 请代理人产出一份发言计划（返回原始文本，由本层解析与校验）。 */
  plan?: (input: {
    hostAgentId: string;
    userMessage: string;
    members: GroupMemberInfo[];
    maxSpeakers: number;
  }) => Promise<string>;
  /** 把成员 id 补全为名称与简介；缺省直接用 id 当名称。 */
  describeMembers?: (ids: string[]) => Promise<GroupMemberInfo[]>;
  /** 生成回合 id；测试可注入固定值。 */
  newTurnId?: () => string;
}

const HOST_AGENT_ID = "xiaoyu";

/** 解析本轮发言者：@ 优先；否则请代理人出计划；都不可用时由代理人单答。 */
export async function resolveSpeakers(
  deps: GroupTurnDeps,
  session: ChatSessionRecord,
  userMessage: string,
  mentions: string[],
): Promise<{ speakers: Array<{ agentId: string; task?: string }>; plan?: SpeakingPlan; planIssues?: PlanIssue[] }> {
  const group = session.group!;
  const members = group.agentIds;
  const memberRoles = group.memberRoles ?? {};
  const limit = Math.max(1, group.maxSpeakersPerRound ?? 3);
  const withRole = (agentId: string, task?: string): { agentId: string; task?: string } => {
    const resolvedTask = task?.trim() || memberRoles[agentId]?.trim() || "";
    return resolvedTask ? { agentId, task: resolvedTask } : { agentId };
  };

  if (mentions.length > 0) {
    const ordered = [...new Set(mentions.filter((id) => members.includes(id)))];
    if (ordered.length === 0) throw new Error("被 @ 的 agent 不在群里。");
    return { speakers: ordered.slice(0, limit).map((agentId) => withRole(agentId)) };
  }

  const hostAgentId = group.hostAgentId ?? HOST_AGENT_ID;
  const sequentialFallback = members.slice(0, limit).map((agentId) => withRole(agentId));
  if (deps.plan) {
    const baseRoster: Array<{ id: string; name: string; description?: string }> = deps.describeMembers
      ? await deps.describeMembers(members)
      : members.map((id) => ({ id, name: id }));
    const roster = baseRoster.map((item) => {
      const role = memberRoles[item.id];
      return role ? { ...item, description: [role, item.description].filter(Boolean).join(" · ") } : item;
    });
    try {
      const raw = await deps.plan({
        hostAgentId,
        userMessage,
        members: roster,
        maxSpeakers: limit,
      });
      const validation = validateSpeakingPlan(extractPlanJson(raw), { members, maxSpeakers: limit });
      if (validation.ok && validation.plan) {
        return {
          speakers: validation.plan.speakers.map((speaker) => withRole(speaker.agentId, speaker.task)),
          plan: validation.plan,
        };
      }
      // 计划作废：降级为按群成员顺序（携带分工）依次协作，保证多 Agent 协作不卡死。
      return { speakers: sequentialFallback.length > 0 ? sequentialFallback : [withRole(hostAgentId)], planIssues: validation.issues };
    } catch {
      return { speakers: sequentialFallback.length > 0 ? sequentialFallback : [withRole(hostAgentId)], planIssues: ["not-json"] };
    }
  }
  const hasExplicitRoles = Object.keys(memberRoles).length > 0;
  return { speakers: hasExplicitRoles && sequentialFallback.length > 0 ? sequentialFallback : [withRole(hostAgentId)] };
}

/**
 * 执行一轮群聊：第一位发言者写入用户消息，其余只把指令放进上下文；
 * 每位跑完（waitForRun）再叫下一位，保证工作区同一时刻只有一个写者。
 */
export async function runGroupTurn(deps: GroupTurnDeps, input: GroupTurnInput): Promise<GroupTurnResult> {
  const session = await deps.memory.getSession(input.sessionId);
  if (!session) throw new Error(`找不到聊天会话：${input.sessionId}`);
  if (session.kind !== "group" || !session.group) throw new Error("这条会话不是群聊，请先新建群聊。");
  const userMessage = input.userMessage.trim();
  if (!userMessage) throw new Error("发送内容不能为空。");

  const mentions = (input.mentions ?? []).map((id) => id.trim()).filter((id) => id.length > 0);
  const resolved = await resolveSpeakers(deps, session, userMessage, mentions);
  const turnId = deps.newTurnId?.() ?? crypto.randomUUID();
  const results: GroupSpeakerResult[] = [];
  for (const [index, speaker] of resolved.speakers.entries()) {
    const started = await deps.agent.startRun({
      sessionId: session.id,
      // 第二位起不再重复落用户消息，改为把「接着谁说」写进这一位的指令。
      ...(index === 0 ? { userMessage } : { userMessage: "请基于上面的对话，完成你负责的部分。" }),
      agentId: speaker.agentId,
      authorAgentId: speaker.agentId,
      turnId,
      ...(speaker.task ? { speakerTask: speaker.task } : {}),
      ...(index > 0 ? { skipUserMessage: true } : {}),
      ...(session.group.memberMaxSteps ? { maxSteps: session.group.memberMaxSteps } : {}),
    });
    results.push({ agentId: speaker.agentId, runId: started.runId, ...(speaker.task ? { task: speaker.task } : {}) });
    await deps.agent.waitForRun(started.runId);
  }
  return {
    turnId,
    speakers: results,
    ...(resolved.plan ? { plan: resolved.plan } : {}),
    ...(resolved.planIssues ? { planIssues: resolved.planIssues } : {}),
  };
}

/** 会话是否为可编排的群聊；供接口早期校验与界面判断。 */
export function isGroupSession(session: ChatSessionRecord | null): boolean {
  return Boolean(session && session.kind === "group" && session.group && session.group.agentIds.length >= 2);
}
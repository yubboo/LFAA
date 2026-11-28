// @lfaa/agent-group 实时流式群聊回合管理：支持非阻塞启动、SSE 事件转发与中途一键中止整轮。
// 关联：packages/core/agent-group/src/orchestrator.ts；运行环境：Node Host。
import type { AgentRunEvent, AgentService } from "@lfaa/agent";
import type { ChatSessionRecord, MemoryService } from "@lfaa/memory";
import { resolveSpeakers, type GroupTurnDeps, type GroupTurnInput } from "./orchestrator";
import type { PlanIssue, SpeakingPlan } from "./speaking-plan";

export type GroupTurnEvent =
  | { type: "turn_started"; turnId: string; sessionId: string; speakers: Array<{ agentId: string; task?: string }> }
  | { type: "speaker_started"; turnId: string; agentId: string; runId: string; assistantMessageId: string; task?: string }
  | { type: "delta"; turnId: string; agentId: string; runId: string; kind: "reasoning" | "text"; text: string }
  | { type: "step_update"; turnId: string; agentId: string; runId: string; step: unknown }
  | { type: "speaker_finished"; turnId: string; agentId: string; runId: string; status: "done" | "error" | "aborted"; error?: string }
  | { type: "turn_finished"; turnId: string; sessionId: string; aborted: boolean };

export interface GroupStreamDeps extends GroupTurnDeps {
  memory: Pick<MemoryService, "getSession" | "updateSession">;
  agent: Pick<AgentService, "startRun" | "waitForRun" | "subscribeRun" | "abortRun">;
  resolveWorkspaceRoots?: (projectId: string | null) => Promise<string[]>;
}

interface ActiveGroupTurn {
  turnId: string;
  sessionId: string;
  aborted: boolean;
  finished: boolean;
  currentRunId: string | null;
  buffer: GroupTurnEvent[];
  listeners: Set<(event: GroupTurnEvent) => void>;
}

export interface StartedGroupTurnStream {
  turnId: string;
  sessionId: string;
  speakers: Array<{ agentId: string; task?: string }>;
  plan?: SpeakingPlan;
  planIssues?: PlanIssue[];
}

/** 管理进行中的群聊 SSE 回合：非阻塞返回 turnId，后台串行调度成员并实时推送增量事件。 */
export class GroupTurnHub {
  private readonly turns = new Map<string, ActiveGroupTurn>();

  constructor(private readonly deps: GroupStreamDeps) {}

  private emit(turn: ActiveGroupTurn, event: GroupTurnEvent): void {
    turn.buffer.push(event);
    if (turn.buffer.length > 4000) turn.buffer.splice(0, turn.buffer.length - 4000);
    for (const listener of turn.listeners) {
      try {
        listener(event);
      } catch {
        // 忽略单个断开连接的订阅者异常
      }
    }
  }

  async start(input: GroupTurnInput): Promise<StartedGroupTurnStream> {
    const session = await this.deps.memory.getSession(input.sessionId);
    if (!session) throw new Error(`找不到聊天会话：${input.sessionId}`);
    if (session.kind !== "group" || !session.group) throw new Error("这条会话不是群聊，请先新建群聊。");
    const userMessage = input.userMessage.trim();
    if (!userMessage) throw new Error("发送内容不能为空。");

    const mentions = (input.mentions ?? []).map((id) => id.trim()).filter(Boolean);
    const resolved = await resolveSpeakers(this.deps, session, userMessage, mentions);
    const turnId = this.deps.newTurnId?.() ?? crypto.randomUUID();
    const turn: ActiveGroupTurn = {
      turnId,
      sessionId: session.id,
      aborted: false,
      finished: false,
      currentRunId: null,
      buffer: [],
      listeners: new Set(),
    };
    this.turns.set(turnId, turn);
    this.emit(turn, { type: "turn_started", turnId, sessionId: session.id, speakers: resolved.speakers });

    void this.driveTurn(turn, session, userMessage, resolved.speakers);
    return {
      turnId,
      sessionId: session.id,
      speakers: resolved.speakers,
      ...(resolved.plan ? { plan: resolved.plan } : {}),
      ...(resolved.planIssues ? { planIssues: resolved.planIssues } : {}),
    };
  }

  private async driveTurn(
    turn: ActiveGroupTurn,
    session: ChatSessionRecord,
    userMessage: string,
    speakers: Array<{ agentId: string; task?: string }>,
  ): Promise<void> {
    try {
      for (const [index, speaker] of speakers.entries()) {
        if (turn.aborted) break;
        const started = await this.deps.agent.startRun(
          {
            sessionId: session.id,
            ...(index === 0 ? { userMessage } : { userMessage: "请基于上面的对话，完成你负责的部分。" }),
            agentId: speaker.agentId,
            authorAgentId: speaker.agentId,
            turnId: turn.turnId,
            ...(speaker.task ? { speakerTask: speaker.task } : {}),
            ...(index > 0 ? { skipUserMessage: true } : {}),
            ...(session.group?.memberMaxSteps ? { maxSteps: session.group.memberMaxSteps } : {}),
          },
          this.deps.resolveWorkspaceRoots,
        );
        turn.currentRunId = started.runId;
        this.emit(turn, {
          type: "speaker_started",
          turnId: turn.turnId,
          agentId: speaker.agentId,
          runId: started.runId,
          assistantMessageId: started.assistantMessageId,
          ...(speaker.task ? { task: speaker.task } : {}),
        });

        const unsub = this.deps.agent.subscribeRun(started.runId, (ev: AgentRunEvent) => {
          if (ev.type === "delta") {
            this.emit(turn, {
              type: "delta",
              turnId: turn.turnId,
              agentId: speaker.agentId,
              runId: started.runId,
              kind: ev.kind,
              text: ev.text,
            });
          } else if (ev.type === "step_update") {
            this.emit(turn, {
              type: "step_update",
              turnId: turn.turnId,
              agentId: speaker.agentId,
              runId: started.runId,
              step: ev.step,
            });
          } else if (ev.type === "run_finished") {
            this.emit(turn, {
              type: "speaker_finished",
              turnId: turn.turnId,
              agentId: speaker.agentId,
              runId: started.runId,
              status: ev.status,
              ...(ev.error ? { error: ev.error } : {}),
            });
          }
        });

        try {
          await this.deps.agent.waitForRun(started.runId);
        } finally {
          unsub();
          turn.currentRunId = null;
        }
      }
    } finally {
      turn.finished = true;
      this.emit(turn, { type: "turn_finished", turnId: turn.turnId, sessionId: turn.sessionId, aborted: turn.aborted });
      const timer = setTimeout(() => {
        if (turn.listeners.size === 0) this.turns.delete(turn.turnId);
      }, 60_000);
      timer.unref?.();
    }
  }

  subscribe(turnId: string, listener: (event: GroupTurnEvent) => void): (() => void) | null {
    const turn = this.turns.get(turnId);
    if (!turn) return null;
    for (const past of turn.buffer) listener(past);
    if (turn.finished) return () => {};
    turn.listeners.add(listener);
    return () => {
      turn.listeners.delete(listener);
    };
  }

  abort(turnId: string): boolean {
    const turn = this.turns.get(turnId);
    if (!turn || turn.finished) return false;
    turn.aborted = true;
    if (turn.currentRunId) {
      this.deps.agent.abortRun(turn.currentRunId);
    }
    return true;
  }
}

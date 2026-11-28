// @lfaa/agent-group 浏览器端接口封装：群会话读写、混编成员（角色 + 本机 CLI）、项目绑定与 SSE 实时流式回合。
// 关联：packages/core/agent-group/src/http-handler.ts；运行环境：浏览器。

export interface GroupStepItem {
  id?: string;
  title?: string;
  status?: string;
  detail?: string;
}

/** 群聊里的一条消息（含流式内容、工具步骤与发言者信息）。 */
export interface GroupMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error" | "aborted";
  model?: string;
  authorAgentId?: string;
  turnId?: string;
  speakerTask?: string;
  steps?: GroupStepItem[];
  cost?: { amount: number; currency: string };
  createdAt: number;
}

/** 群会话摘要。 */
export interface GroupSessionItem {
  id: string;
  title: string;
  projectId: string | null;
  updatedAt: number;
  kind?: "single" | "group";
  group?: { agentIds: string[]; hostAgentId?: string; maxSpeakersPerRound?: number; memberMaxSteps?: number };
  messageCount: number;
}

/** 群聊成员候选（同时包含内置/自定义角色与已启用的本机官方 CLI）。 */
export interface MemberOption {
  id: string;
  name: string;
  kind: "assistant" | "worker";
  enabled: boolean;
  isCli?: boolean;
}

export interface ProjectOption {
  id: string;
  name: string;
}

export type GroupTurnStreamEvent =
  | { type: "turn_started"; turnId: string; sessionId: string; speakers: Array<{ agentId: string; task?: string }> }
  | { type: "speaker_started"; turnId: string; agentId: string; runId: string; assistantMessageId: string; task?: string }
  | { type: "delta"; turnId: string; agentId: string; runId: string; kind: "reasoning" | "text"; text: string }
  | { type: "step_update"; turnId: string; agentId: string; runId: string; step: GroupStepItem }
  | { type: "speaker_finished"; turnId: string; agentId: string; runId: string; status: "done" | "error" | "aborted"; error?: string }
  | { type: "turn_finished"; turnId: string; sessionId: string; aborted: boolean };

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const parsed: unknown = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = (parsed as { error?: unknown }).error;
    throw new Error(typeof message === "string" && message.trim() ? message : `请求失败（HTTP ${response.status}）。`);
  }
  return parsed as T;
}

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  return readJson<T>(response);
}

/** 只列出群聊会话，按更新时间倒序。 */
export async function fetchGroupSessions(): Promise<GroupSessionItem[]> {
  const { sessions } = await readJson<{ sessions: GroupSessionItem[] }>(await fetch("/api/chat/sessions"));
  return sessions
    .filter((session) => session.kind === "group" && session.group && session.group.agentIds.length >= 2)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

/** 可在群里出场的成员：合并启用中的自定义角色与已安装且支持聊天的本机 CLI 代理。 */
export async function fetchMembers(): Promise<MemberOption[]> {
  const [agentsRes, cliRes] = await Promise.all([
    readJson<{ agents: MemberOption[] }>(await fetch("/api/agents")),
    fetch("/api/cli-agents")
      .then((res) => (res.ok ? readJson<{ agents: Array<{ id: string; name: string; installed: boolean; enabled: boolean; supportsChat: boolean }> }>(res) : { agents: [] }))
      .catch(() => ({ agents: [] })),
  ]);
  const roleMembers = agentsRes.agents.filter((agent) => agent.enabled);
  const cliMembers: MemberOption[] = (cliRes.agents ?? [])
    .filter((item) => item.installed && item.supportsChat)
    .map((item) => ({
      id: `cli:${item.id}`,
      name: `${item.name} (CLI)`,
      kind: "worker" as const,
      enabled: true,
      isCli: true,
    }));
  return [...roleMembers, ...cliMembers];
}

export async function fetchProjectOptions(): Promise<ProjectOption[]> {
  try {
    const data = await readJson<{ projects: Array<{ id: string; name: string }> }>(await fetch("/api/workspace/projects"));
    return (data.projects ?? []).map((p) => ({ id: p.id, name: p.name }));
  } catch {
    return [];
  }
}

export async function createGroupSession(input: {
  title: string;
  projectId?: string | null;
  agentIds: string[];
  hostAgentId?: string;
  maxSpeakersPerRound?: number;
  memberMaxSteps?: number;
}): Promise<GroupSessionItem> {
  const { session } = await send<{ session: GroupSessionItem }>("/api/chat/sessions", "POST", {
    title: input.title,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    kind: "group",
    group: {
      agentIds: input.agentIds,
      ...(input.hostAgentId ? { hostAgentId: input.hostAgentId } : {}),
      ...(input.maxSpeakersPerRound ? { maxSpeakersPerRound: input.maxSpeakersPerRound } : {}),
      ...(input.memberMaxSteps ? { memberMaxSteps: input.memberMaxSteps } : {}),
    },
  });
  return session;
}

export async function updateGroupSession(
  sessionId: string,
  patch: {
    title?: string;
    projectId?: string | null;
    group?: { agentIds?: string[]; hostAgentId?: string; maxSpeakersPerRound?: number };
  },
): Promise<GroupSessionItem> {
  const { session } = await send<{ session: GroupSessionItem }>(
    `/api/group/sessions/${encodeURIComponent(sessionId)}`,
    "PATCH",
    patch,
  );
  return session;
}

export async function fetchSessionMessages(sessionId: string): Promise<{ messages: GroupMessageItem[]; title: string }> {
  const { session } = await readJson<{ session: { title: string; messages: GroupMessageItem[] } }>(
    await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`),
  );
  return { messages: session.messages, title: session.title };
}

export interface GroupTurnResponse {
  turnId: string;
  sessionId?: string;
  speakers: Array<{ agentId: string; runId?: string; task?: string }>;
  plan?: { speakers: Array<{ agentId: string; task: string }>; reason?: string };
  planIssues?: string[];
}

/** 非阻塞启动一轮 SSE 流式群聊。 */
export async function startGroupTurnStream(input: {
  sessionId: string;
  userMessage: string;
  mentions?: string[];
}): Promise<GroupTurnResponse> {
  return send<GroupTurnResponse>("/api/group/runs", "POST", { ...input, stream: true });
}

export function subscribeGroupTurn(
  turnId: string,
  onEvent: (event: GroupTurnStreamEvent) => void,
  onError?: () => void,
): () => void {
  const es = new EventSource(`/api/group/turns/${encodeURIComponent(turnId)}/events`);
  es.onmessage = (msg) => {
    try {
      const parsed = JSON.parse(msg.data) as GroupTurnStreamEvent;
      onEvent(parsed);
      if (parsed.type === "turn_finished") {
        es.close();
      }
    } catch {
      // 忽略异常帧
    }
  };
  es.onerror = () => {
    es.close();
    onError?.();
  };
  return () => es.close();
}

export async function abortGroupTurn(turnId: string): Promise<void> {
  await send<{ aborted: boolean }>(`/api/group/turns/${encodeURIComponent(turnId)}/abort`, "POST");
}

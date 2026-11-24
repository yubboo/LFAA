// @lfaa/agent-group 浏览器端接口封装：群会话的创建、读取与一轮群聊的启动。
// 只做 HTTP 与视图模型转换；群聊编排在 Host 侧（agent-group/src/orchestrator.ts）。

/** 群聊里的一条消息（只取界面要渲染的字段）。 */
export interface GroupMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error" | "aborted";
  model?: string;
  authorAgentId?: string;
  turnId?: string;
  speakerTask?: string;
  /** 本轮该消息按单价换算的成本；未配置单价时缺省。 */
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

/** 群聊成员候选。 */
export interface MemberOption {
  id: string;
  name: string;
  kind: "assistant" | "worker";
  enabled: boolean;
}

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

/** 可在群里出场的 agent（停用的不出现）。 */
export async function fetchMembers(): Promise<MemberOption[]> {
  const { agents } = await readJson<{ agents: MemberOption[] }>(await fetch("/api/agents"));
  return agents.filter((agent) => agent.enabled);
}

export async function createGroupSession(input: {
  title: string;
  agentIds: string[];
  hostAgentId?: string;
  maxSpeakersPerRound?: number;
  memberMaxSteps?: number;
}): Promise<GroupSessionItem> {
  const { session } = await send<{ session: GroupSessionItem }>("/api/chat/sessions", "POST", {
    title: input.title,
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

export async function fetchSessionMessages(sessionId: string): Promise<{ messages: GroupMessageItem[]; title: string }> {
  const { session } = await readJson<{ session: { title: string; messages: GroupMessageItem[] } }>(
    await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`),
  );
  return { messages: session.messages, title: session.title };
}

/** 启动一轮群聊；返回本轮发言者顺序（后台仍在跑，界面靠轮询刷新）。 */
export interface GroupTurnResponse {
  turnId: string;
  speakers: Array<{ agentId: string; runId: string; task?: string }>;
  /** 命中发言计划时存在。 */
  plan?: { speakers: Array<{ agentId: string; task: string }>; reason?: string };
  /** 计划作废原因；界面据此提示「已降级为代理人直接回答」。 */
  planIssues?: string[];
}

/** 启动一轮群聊；返回本轮发言者顺序与是否降级（后台仍在跑，界面靠轮询刷新）。 */
export async function startGroupTurn(input: {
  sessionId: string;
  userMessage: string;
  mentions?: string[];
}): Promise<GroupTurnResponse> {
  return send<GroupTurnResponse>("/api/group/runs", "POST", input);
}
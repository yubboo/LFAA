/**
 * LFAA Session 内核：不可变、带序号的事件日志，以及从日志派生的请求和消息视图。
 * 该模块只定义会话语义；身份、持久化、API 和 UI 仍由 LFAA 现有 Owner 管理。
 */
import { randomUUID } from "node:crypto";

export type SessionModelMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
};

export interface SessionToolSchema {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export type SessionSurfaceOperation = "append" | { op: "replace"; startSeq: number; endSeq: number };
export type SessionDeveloperBlock = { type: "text"; text: string } | { type: "tool-addition"; toolName: string } | { type: "tool-removal"; toolName: string };
export type SessionSeq = number;
export type SessionLogOffset = number;
export type SessionRequestHeaderReason = "initial" | "resume" | "change" | "series";
export type SessionToolHistory = Readonly<{
  tools: readonly SessionToolSchema[];
  updates: readonly Readonly<{ messageId: string; additions: readonly SessionToolSchema[] }>[];
}>;

export function sessionSeq(value: number): SessionSeq {
  if (!Number.isSafeInteger(value) || value < 1 || Object.is(value, -0)) throw new TypeError("SessionSeq 必须是正安全整数。");
  return value;
}

export function sessionLogOffset(value: number): SessionLogOffset {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new TypeError("SessionLogOffset 必须是非负安全整数。");
  return value;
}

export type EncodedSessionSeq = number | [number, number];
export function encodeSessionSeqRanges(values: readonly SessionSeq[]): EncodedSessionSeq[] {
  const encoded: EncodedSessionSeq[] = [];
  for (let start = 0; start < values.length;) {
    sessionSeq(values[start]!);
    let end = start;
    while (end + 1 < values.length && values[end + 1] === values[end]! + 1) end += 1;
    if (end - start >= 2) encoded.push([values[start]!, values[end]!]);
    else for (let index = start; index <= end; index++) encoded.push(values[index]!);
    start = end + 1;
  }
  return encoded;
}
export function decodeSessionSeqRanges(value: unknown, maximumEntries = Number.MAX_SAFE_INTEGER): SessionSeq[] {
  if (!Array.isArray(value) || !Number.isSafeInteger(maximumEntries) || maximumEntries < 0) throw new TypeError("Session 序号范围无效。");
  const result: SessionSeq[] = [];
  let containsRange = false;
  for (const item of value) {
    if (typeof item === "number") { sessionSeq(item); result.push(item); }
    else {
      if (!Array.isArray(item) || item.length !== 2) throw new TypeError("Session 序号范围必须是二元闭区间。");
      const start = sessionSeq(item[0] as number), end = sessionSeq(item[1] as number);
      if (end < start || end - start + 1 > maximumEntries - result.length) throw new TypeError("Session 序号范围倒置或超出容量。");
      for (let seq = start; seq <= end; seq++) result.push(seq);
      containsRange = true;
    }
    if (result.length > maximumEntries) throw new TypeError("Session 序号范围超出容量。");
  }
  if (containsRange && result.some((seq, index) => index > 0 && seq <= result[index - 1]!)) throw new TypeError("压缩的 Session 序号必须严格递增。");
  return result;
}

export class SessionPreparation {
  private disposed = false;
  private published = false;
  private constructor(readonly session: SessionKernel, private readonly release?: () => void) {}
  static create(session: SessionKernel, release?: () => void): SessionPreparation { return new SessionPreparation(session, release); }
  publish(): SessionKernel {
    if (this.disposed || this.published) throw new Error("SessionPreparation 已结束或已发布。");
    this.published = true;
    return this.session;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (!this.published) this.release?.();
  }
}

export interface SessionEventDataMap {
  "session/created": { ownerId: string; appId: string; createdAt: string };
  "session/title": { title: string };
  "session/project": { projectId: string | null; nodeId: string | null; directory: string | null; title: string | null };
  "session/archived": { archived: boolean };
  "session/plan-mode": { active: boolean };
  "session/side-chat": { parentSessionId: string; snapshotSeq: number };
  "turn/start": { turnId: string; userMessageId: string; assistantMessageId: string };
  "turn/end": { turnId: string; status: "complete" | "interrupted" | "error" | "forked" };
  "step/start": { turnId: string; step: number };
  "step/end": { turnId: string; step: number };
  "user/message": { messageId: string; content: string; runId?: string };
  "developer/message": { content: string; messageId?: string; blocks?: SessionDeveloperBlock[]; headerSeq?: number; runId?: string };
  "system/message": { content: string; runId?: string };
  "assistant/message": { messageId: string; content: string; status: string; runId?: string };
  "message/feedback": { messageId: string; rating: "positive" | "negative"; reasons: string[]; detail: string };
  "assistant/response": { runId: string; message: SessionModelMessage; stream?: string[]; usage?: { promptTokens: number | null; completionTokens: number | null } };
  "assistant/attempt": { runId: string; messages: SessionModelMessage[]; error?: { name: string; message: string }; stream?: string[] };
  "request/header": { runId: string; appId: string; providerId: string; modelId: string; permissionMode: string; settings: Record<string, unknown>; tools?: SessionToolSchema[]; reason?: SessionRequestHeaderReason; startsSeries?: true };
  "request/context": { runId: string; messages: SessionModelMessage[]; contextWindow?: number; systemPromptUpdate?: "in-history" | "out-of-history" };
  "tool/call": { runId: string; callId: string; name: string; arguments: string; dispatched: boolean; headerSeq?: number };
  "tool/result": { runId: string; callId: string; content: string; isError: boolean; executionState: "complete" | "failed" | "unconfirmed" | "not_started"; repaired?: boolean };
  "activity/change": { runId: string; messageId: string; activity: unknown[] };
  "usage/record": { runId: string; providerId: string; modelId: string; promptTokens: number | null; completionTokens: number | null };
  "session/end-seed": { sourceSessionId: string; sourceSeq: number };
}

export type SessionEventType = keyof SessionEventDataMap;
export type SessionEvent<K extends SessionEventType = SessionEventType> = K extends SessionEventType ? {
  id: string;
  sessionId: string;
  seq: number;
  time: string;
  type: K;
  data: SessionEventDataMap[K];
  surfaceOp?: SessionSurfaceOperation;
  sourceEventSeqs?: number[];
} : never;

export type SessionSurfaceItem = Readonly<{
  id: string;
  kind: "user" | "assistant" | "tool";
  sourceType: SessionEventType;
  seq: number;
  data: Record<string, unknown>;
}>;

const knownTypes = new Set<string>([
  "session/created", "session/title", "session/project", "session/archived", "session/plan-mode", "turn/start", "turn/end", "step/start", "step/end",
  "session/side-chat",
  "user/message", "system/message", "developer/message", "assistant/message", "message/feedback", "assistant/response", "assistant/attempt",
  "request/header", "request/context", "tool/call", "tool/result", "activity/change", "usage/record",
  "session/end-seed"
]);

/** 拒绝不可序列化值、循环引用、非普通对象和过深数据，再做无损 JSON 快照。 */
export function snapshotSessionJson<T>(input: T): T {
  const seen = new Set<object>();
  let nodes = 0;
  const copy = (value: unknown, depth: number): unknown => {
    if (++nodes > 250_000 || depth > 128) throw new Error("Session 事件数据过大或嵌套过深。");
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)) return value;
    if (typeof value !== "object") throw new Error("Session 事件只允许 JSON 数据。");
    if (seen.has(value)) throw new Error("Session 事件不能包含循环引用。");
    seen.add(value);
    let result: unknown;
    if (Array.isArray(value)) {
      const array: unknown[] = [];
      for (let index = 0; index < value.length; index++) {
        if (!Object.hasOwn(value, index)) throw new Error("Session 事件不能包含稀疏数组。");
        array.push(copy(value[index], depth + 1));
      }
      result = array;
    }
    else {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) throw new Error("Session 事件只允许普通 JSON 对象。");
      const object: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Session 事件包含不允许的对象键。");
        object[key] = copy(item, depth + 1);
      }
      result = object;
    }
    seen.delete(value);
    return result;
  };
  return copy(input, 0) as T;
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function immutableJson<T>(value: T): T { return freezeDeep(snapshotSessionJson(value)); }

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function string(value: unknown): value is string { return typeof value === "string"; }
function modelMessage(value: unknown): value is SessionModelMessage {
  if (!record(value) || !["system", "user", "assistant", "tool"].includes(String(value.role)) || value.content !== null && !string(value.content)) return false;
  if (value.tool_call_id !== undefined && !string(value.tool_call_id)) return false;
  return value.tool_calls === undefined || Array.isArray(value.tool_calls) && value.tool_calls.every(call => record(call) && string(call.id) && call.type === "function"
    && record(call.function) && string(call.function.name) && string(call.function.arguments));
}

function validatePayload(event: SessionEvent): void {
  const data = event.data as unknown;
  if (!record(data)) throw new Error(`Session 事件载荷无效：${event.type}`);
  const ok = (() => {
    switch (event.type) {
      case "session/created": return string(data.ownerId) && string(data.appId) && string(data.createdAt) && Number.isFinite(Date.parse(data.createdAt));
      case "session/title": return string(data.title) && data.title.length <= 512;
      case "session/project": return [data.projectId, data.nodeId, data.directory, data.title].every(value => value === null || string(value));
      case "session/archived": return typeof data.archived === "boolean";
      case "session/plan-mode": return typeof data.active === "boolean";
      case "session/side-chat": return string(data.parentSessionId) && Number.isSafeInteger(data.snapshotSeq) && Number(data.snapshotSeq) >= 0;
      case "turn/start": return [data.turnId, data.userMessageId, data.assistantMessageId].every(string);
      case "turn/end": return string(data.turnId) && ["complete", "interrupted", "error", "forked"].includes(String(data.status));
      case "step/start":
      case "step/end": return string(data.turnId) && Number.isSafeInteger(data.step) && Number(data.step) > 0;
      case "user/message": return string(data.messageId) && string(data.content) && (data.runId === undefined || string(data.runId));
      case "system/message":
      case "developer/message": return string(data.content)
        && (data.messageId === undefined || string(data.messageId))
        && (data.runId === undefined || string(data.runId))
        && (data.headerSeq === undefined || Number.isSafeInteger(data.headerSeq) && Number(data.headerSeq) > 0)
        && (data.blocks === undefined || Array.isArray(data.blocks) && data.blocks.every(block => record(block)
          && (block.type === "text" && string(block.text) || (block.type === "tool-addition" || block.type === "tool-removal") && string(block.toolName))));
      case "system/message": return string(data.content) && (data.runId === undefined || string(data.runId));
      case "assistant/message": return string(data.messageId) && string(data.content) && string(data.status) && (data.runId === undefined || string(data.runId));
      case "message/feedback": return string(data.messageId) && ["positive", "negative"].includes(String(data.rating))
        && Array.isArray(data.reasons) && data.reasons.length <= 6
        && data.reasons.every(reason => string(reason) && reason.trim().length > 0 && reason.length <= 80)
        && new Set(data.reasons as string[]).size === data.reasons.length
        && string(data.detail) && data.detail.length <= 2000;
      case "assistant/response": return string(data.runId) && modelMessage(data.message)
        && (data.stream === undefined || Array.isArray(data.stream) && data.stream.every(string))
        && (data.usage === undefined || record(data.usage) && [data.usage.promptTokens, data.usage.completionTokens].every(value => value === null || Number.isSafeInteger(value) && Number(value) >= 0));
      case "assistant/attempt": return string(data.runId) && Array.isArray(data.messages) && data.messages.every(modelMessage)
        && (data.error === undefined || record(data.error) && string(data.error.name) && string(data.error.message))
        && (data.stream === undefined || Array.isArray(data.stream) && data.stream.every(string));
      case "request/header": return string(data.runId) && string(data.appId) && string(data.providerId) && string(data.modelId)
        && string(data.permissionMode) && record(data.settings) && (data.reason === undefined || ["initial", "resume", "change", "series"].includes(String(data.reason)))
        && (data.startsSeries === undefined || data.startsSeries === true)
        && (data.tools === undefined || Array.isArray(data.tools) && data.tools.length > 0 && data.tools.every(tool => record(tool) && tool.type === "function"
          && record(tool.function) && string(tool.function.name) && string(tool.function.description) && record(tool.function.parameters)));
      case "request/context": return string(data.runId) && Array.isArray(data.messages) && data.messages.every(modelMessage)
        && (data.contextWindow === undefined || Number.isSafeInteger(data.contextWindow) && Number(data.contextWindow) > 0)
        && (data.systemPromptUpdate === undefined || ["in-history", "out-of-history"].includes(String(data.systemPromptUpdate)));
      case "tool/call": return string(data.runId) && string(data.callId) && string(data.name) && string(data.arguments) && typeof data.dispatched === "boolean"
        && (data.headerSeq === undefined || Number.isSafeInteger(data.headerSeq) && Number(data.headerSeq) > 0);
      case "tool/result": return string(data.runId) && string(data.callId) && string(data.content) && typeof data.isError === "boolean"
        && ["complete", "failed", "unconfirmed", "not_started"].includes(String(data.executionState))
        && (data.repaired === undefined || typeof data.repaired === "boolean");
      case "activity/change": return string(data.runId) && string(data.messageId) && Array.isArray(data.activity);
      case "usage/record": return string(data.runId) && string(data.providerId) && string(data.modelId)
        && [data.promptTokens, data.completionTokens].every(value => value === null || typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
      case "session/end-seed": return string(data.sourceSessionId) && Number.isSafeInteger(data.sourceSeq) && Number(data.sourceSeq) >= 0;
    }
  })();
  if (!ok) throw new Error(`Session 事件载荷无效：${event.type}`);
}

function validateEvent(sessionId: string, event: SessionEvent, expectedSeq: number): SessionEvent {
  if (!event || typeof event !== "object" || event.sessionId !== sessionId || !knownTypes.has(event.type)
    || !Number.isSafeInteger(event.seq) || event.seq !== expectedSeq || typeof event.id !== "string" || !event.id
    || typeof event.time !== "string" || !Number.isFinite(Date.parse(event.time)) || !event.data || typeof event.data !== "object") {
    throw new Error(`Session 日志事件无效：预期序号 ${expectedSeq}。`);
  }
  const normalized = isSurfaceType(event.type) && event.surfaceOp === undefined ? { ...event, surfaceOp: "append" as const } : event;
  const snapshot = immutableJson(normalized);
  validatePayload(snapshot);
  return snapshot;
}

const surfaceTypes = new Set<SessionEventType>(["system/message", "developer/message", "user/message", "assistant/response", "assistant/message", "tool/result"]);
function isSurfaceType(type: SessionEventType): boolean { return surfaceTypes.has(type); }
export function isSurfaceEvent(event: SessionEvent): boolean { return isSurfaceType(event.type); }

export function deriveSessionEventMessage(event: SessionEvent): SessionModelMessage | null {
  if (event.type === "system/message") return event.data.content ? { role: "system", content: event.data.content } : null;
  if (event.type === "developer/message") {
    const content = event.data.blocks?.filter((block): block is Extract<SessionDeveloperBlock, { type: "text" }> => block.type === "text").map(block => block.text).join("") ?? event.data.content;
    return content ? { role: "system", content } : null;
  }
  if (event.type === "user/message") return { role: "user", content: event.data.content };
  if (event.type === "assistant/response") return event.data.message.content || event.data.message.tool_calls?.length ? event.data.message : null;
  if (event.type === "assistant/message") return ["complete", "interrupted"].includes(event.data.status) && event.data.content ? { role: "assistant", content: event.data.content } : null;
  if (event.type === "tool/result") return { role: "tool", tool_call_id: event.data.callId, content: event.data.content };
  return null;
}

export function foldSessionSurface(sessionId: string, events: readonly SessionEvent[]): readonly SessionSurfaceItem[] {
  return new SessionKernel(sessionId, events).surface;
}

export function canonicalSessionRequestHeader(header: SessionEventDataMap["request/header"]): SessionEventDataMap["request/header"] {
  const { reason: _reason, startsSeries: _startsSeries, ...base } = header;
  const tools = base.tools ?? [];
  return immutableJson({ ...base, ...(tools.length ? { tools } : {}) });
}

export function sessionRequestHeadersEqual(left: SessionEventDataMap["request/header"], right: SessionEventDataMap["request/header"]): boolean {
  const { runId: _leftRun, ...canonicalLeft } = canonicalSessionRequestHeader(left);
  const { runId: _rightRun, ...canonicalRight } = canonicalSessionRequestHeader(right);
  return JSON.stringify(canonicalLeft) === JSON.stringify(canonicalRight);
}

export function foldSessionRequestHeader(events: readonly SessionEvent[], from?: SessionEventDataMap["request/header"]): SessionEventDataMap["request/header"] | undefined {
  let current = from;
  for (const event of events) if (event.type === "request/header") current = canonicalSessionRequestHeader(event.data);
  return current === undefined ? undefined : immutableJson(current);
}

class SurfaceProjection {
  private readonly items: SessionSurfaceItem[] = [];
  private readonly knownSeqs = new Set<number>();
  private _replaceGeneration = 0;
  private _contentGeneration = 0;
  private snapshotCache: readonly SessionSurfaceItem[] | undefined;
  validateNext(event: SessionEvent): void {
    const hasMetadata = event.surfaceOp !== undefined || event.sourceEventSeqs !== undefined;
    if (!isSurfaceType(event.type)) {
      if (hasMetadata) throw new Error(`非 Surface 事件不能携带 Surface 元数据：${event.type}`);
      return;
    }
    const operation = event.surfaceOp;
    if (operation === undefined || operation !== "append" && (!record(operation) || operation.op !== "replace"
      || !Number.isSafeInteger(operation.startSeq) || !Number.isSafeInteger(operation.endSeq)
      || Number(operation.startSeq) < 1 || Number(operation.endSeq) < Number(operation.startSeq))) throw new Error(`Surface 操作无效：${event.type}`);
    if ((event.type === "assistant/response" || event.type === "assistant/message") && event.sourceEventSeqs !== undefined) {
      throw new Error("assistant Surface 事件不能声明来源序号。");
    }
    const sources = event.sourceEventSeqs ?? [];
    if (event.sourceEventSeqs !== undefined && !sources.length || new Set(sources).size !== sources.length
      || sources.some(seq => !Number.isSafeInteger(seq) || seq < 1 || seq >= event.seq || !this.knownSeqs.has(seq))) {
      throw new Error("Surface 来源序号必须是唯一、已存在且早于当前事件的事件序号。");
    }
    if (operation !== "append") {
      const replacement = operation as Exclude<SessionSurfaceOperation, "append">;
      const start = this.items.findIndex(item => item.seq === replacement.startSeq);
      const end = this.items.findIndex(item => item.seq === replacement.endSeq);
      if (start < 0 || end < start) throw new Error("Surface replace 边界必须按当前顺序指向现存节点。");
      const shadowed = this.items.slice(start, end + 1).map(item => item.seq);
      if (shadowed.some(seq => !sources.includes(seq))) throw new Error("Surface replace 必须引用被替换的全部节点。");
      if (start === 0 && this.items[0]?.sourceType === "system/message"
        && (event.type !== "system/message" || start !== end)) throw new Error("Surface 首个 system/message 只能由自身做单节点替换。");
    }
  }
  apply(event: SessionEvent): void {
    this.validateNext(event);
    let kind: SessionSurfaceItem["kind"] | undefined;
    let id: string | undefined;
    switch (event.type) {
      case "system/message": kind = "assistant"; id = event.id; break;
      case "developer/message": kind = "assistant"; id = event.data.messageId ?? event.id; break;
      case "user/message": kind = "user"; id = event.data.messageId; break;
      case "assistant/response": kind = "assistant"; id = event.id; break;
      case "assistant/message": kind = "assistant"; id = event.data.messageId; break;
      case "tool/result": kind = "tool"; id = event.data.callId; break;
      default: break;
    }
    if (kind && id) {
      if (isSurfaceType(event.type) && event.surfaceOp !== "append") {
        const replacement = event.surfaceOp as Exclude<SessionSurfaceOperation, "append">;
        const start = this.items.findIndex(item => item.seq === replacement.startSeq);
        const end = this.items.findIndex(item => item.seq === replacement.endSeq);
        this.items.splice(start, end - start + 1);
        this._replaceGeneration += 1;
      }
      this.items.push(immutableJson({ id, kind, sourceType: event.type, seq: event.seq, data: event.data as unknown as Record<string, unknown> }));
      this._contentGeneration += 1;
      this.snapshotCache = undefined;
    }
    this.knownSeqs.add(event.seq);
  }
  snapshot(): readonly SessionSurfaceItem[] { return this.snapshotCache ??= Object.freeze([...this.items]); }
  get replaceGeneration(): number { return this._replaceGeneration; }
  get contentGeneration(): number { return this._contentGeneration; }
}

export type SessionForkErrorCode = "SESSION_NOT_FOUND" | "SESSION_ALREADY_EXISTS" | "INVALID_BOUNDARY";
export class SessionForkError extends Error {
  constructor(message: string, readonly code: SessionForkErrorCode) { super(message); this.name = "SessionForkError"; }
}

/** In-memory DSH-style Session kernel. Durable adapters append each returned event before exposing it. */
export class SessionKernel {
  private readonly log: SessionEvent[] = [];
  private readonly surfaceProjection = new SurfaceProjection();
  private latestHeader?: Extract<SessionEvent, { type: "request/header" }>;
  private latestContext?: Extract<SessionEvent, { type: "request/context" }>;
  private latestContextOffset = 0;
  private readonly latestAttempts = new Map<string, readonly SessionModelMessage[]>();
  private readonly requestHeadersBySeq = new Map<number, readonly SessionToolSchema[]>();
  private readonly toolCallHeaders = new Map<string, number>();
  private readonly toolHeaderHistoryRows: Array<{ seq: number; runId: string; tools: readonly SessionToolSchema[] }> = [];
  private toolHeaderHistorySnapshot: readonly { seq: number; runId: string; tools: readonly SessionToolSchema[] }[] | undefined;
  private toolHistoryBase: readonly SessionToolSchema[] = [];
  private toolHistoryDeclared = new Map<string, SessionToolSchema>();
  private toolHistoryAvailable = new Set<string>();
  private toolHistoryActive: readonly SessionToolSchema[] = [];
  private toolHistoryUpdates: Array<{ messageId: string; additions: readonly SessionToolSchema[] }> = [];
  private toolHistorySnapshot: SessionToolHistory | undefined;
  private hasToolHistoryBase = false;
  private _inheritedEventCount = 0;
  private readonly turnStates = new Map<string, boolean>();
  private readonly stepStates = new Map<string, number>();
  private readonly observers = new Set<(event: SessionEvent) => void>();
  private cachedEventSnapshot: readonly SessionEvent[] | undefined;
  private publishing = false;
  private derivedSurfaceCache: readonly SessionModelMessage[] | undefined;

  constructor(readonly id: string, events: readonly SessionEvent[] = [], private readonly flushBarrier: () => void | Promise<void> = () => undefined) {
    if (!id) throw new Error("Session ID 不能为空。");
    for (let index = 0; index < events.length; index++) {
      const event = validateEvent(id, events[index]!, index + 1);
      this.validateTransition(event);
      this.log.push(event);
      this.applyProjection(event);
    }
    const forkMarker = [...this.log].reverse().find((event): event is Extract<SessionEvent, { type: "session/end-seed" }> => event.type === "session/end-seed");
    if (forkMarker?.type === "session/end-seed") this._inheritedEventCount = Math.min(forkMarker.data.sourceSeq, this.log.length);
  }

  private validateTransition(event: SessionEvent): void {
    this.surfaceProjection.validateNext(event);
    if (event.type === "developer/message") {
      const additions = event.data.blocks?.filter((block): block is Extract<SessionDeveloperBlock, { type: "tool-addition" }> => block.type === "tool-addition") ?? [];
      if (additions.length && event.data.headerSeq === undefined) throw new Error("Tool addition 必须引用定义其 Schema 的 request/header。");
      if (event.data.headerSeq !== undefined) {
        const schemas = this.requestHeadersBySeq.get(event.data.headerSeq);
        if (!schemas || event.data.headerSeq >= event.seq) throw new Error("developer/message 引用了不存在或非历史 request/header。");
        for (const addition of additions) if (schemas.filter(schema => schema.function.name === addition.toolName).length !== 1) {
          throw new Error(`request/header 中缺少唯一工具定义：${addition.toolName}`);
        }
      }
    } else if (event.type === "tool/call" && event.data.headerSeq !== undefined) {
      const schemas = this.requestHeadersBySeq.get(event.data.headerSeq);
      if (!schemas || event.data.headerSeq >= event.seq) throw new Error("tool/call 引用了不存在或非历史 request/header。");
      if (schemas.filter(schema => schema.function.name === event.data.name).length !== 1) throw new Error(`request/header 中缺少唯一工具定义：${event.data.name}`);
    }
  }

  append<K extends SessionEventType>(
    type: K,
    data: SessionEventDataMap[K],
    time = new Date().toISOString(),
    surface?: { surfaceOp?: SessionSurfaceOperation; sourceEventSeqs?: number[] }
  ): SessionEvent<K> {
    if (!knownTypes.has(type)) throw new Error(`未知 Session 事件类型：${type}`);
    if (this.publishing) throw new Error("Session 事件发布期间不能重入追加。");
    const event = validateEvent(this.id, { id: randomUUID(), sessionId: this.id, seq: this.log.length + 1, time, type, data, ...surface } as SessionEvent, this.log.length + 1) as SessionEvent<K>;
    this.validateTransition(event);
    this.log.push(event);
    this.cachedEventSnapshot = undefined;
    this.applyProjection(event);
    this.publishing = true;
    try {
      for (const observer of [...this.observers]) {
        try { observer(event); }
        catch { this.observers.delete(observer); }
      }
    } finally {
      this.publishing = false;
    }
    return event;
  }

  private applyProjection(event: SessionEvent): void {
    const surfaceGeneration = this.surfaceProjection.contentGeneration;
    this.surfaceProjection.apply(event);
    if (surfaceGeneration !== this.surfaceProjection.contentGeneration) this.derivedSurfaceCache = undefined;
    if (event.type === "request/header") {
      this.latestHeader = event;
      const tools = event.data.tools ?? [];
      this.requestHeadersBySeq.set(event.seq, tools);
      this.toolHeaderHistoryRows.push(immutableJson({ seq: event.seq, runId: event.data.runId, tools }));
      this.toolHeaderHistorySnapshot = undefined;
      const redeclared = tools.some(tool => {
        const previous = this.toolHistoryDeclared.get(tool.function.name);
        return previous !== undefined && JSON.stringify(previous) !== JSON.stringify(tool);
      });
      if (!this.hasToolHistoryBase || event.data.reason === "series" || event.data.startsSeries === true || redeclared) {
        this.hasToolHistoryBase = true;
        this.toolHistoryBase = tools;
        this.toolHistoryDeclared = new Map(tools.map(tool => [tool.function.name, tool]));
        this.toolHistoryAvailable = new Set(tools.map(tool => tool.function.name));
        this.toolHistoryUpdates = [];
      }
      this.toolHistoryActive = tools;
      this.toolHistorySnapshot = undefined;
    } else if (event.type === "request/context") {
      this.latestContext = event;
      this.latestContextOffset = event.seq - 1;
    } else if (event.type === "developer/message") {
      const blocks = event.data.blocks ?? [];
      const schemas = event.data.headerSeq === undefined ? [] : this.requestHeadersBySeq.get(event.data.headerSeq) ?? [];
      const additions = blocks.filter((block): block is Extract<SessionDeveloperBlock, { type: "tool-addition" }> => block.type === "tool-addition")
        .map(block => schemas.find(schema => schema.function.name === block.toolName)!)
        .filter((schema): schema is SessionToolSchema => schema !== undefined);
      for (const schema of additions) this.toolHistoryDeclared.set(schema.function.name, schema);
      for (const block of blocks) {
        if (block.type === "tool-addition") this.toolHistoryAvailable.add(block.toolName);
        else if (block.type === "tool-removal") this.toolHistoryAvailable.delete(block.toolName);
      }
      this.toolHistoryUpdates.push(immutableJson({ messageId: event.data.messageId ?? event.id, additions }));
      this.toolHistorySnapshot = undefined;
    } else if (event.type === "tool/call" && event.data.headerSeq !== undefined) {
      this.toolCallHeaders.set(event.data.callId, event.data.headerSeq);
    } else if (event.type === "assistant/attempt") {
      this.latestAttempts.set(event.data.runId, event.data.messages);
    }
    else if (event.type === "turn/start") this.turnStates.set(event.data.turnId, true);
    else if (event.type === "turn/end") this.turnStates.set(event.data.turnId, false);
    else if (event.type === "step/start") this.stepStates.set(event.data.turnId, event.data.step);
    else if (event.type === "step/end" && this.stepStates.get(event.data.turnId) === event.data.step) this.stepStates.delete(event.data.turnId);
  }

  get length(): number { return this.log.length; }
  get seq(): SessionLogOffset { return this.log.length; }
  get inheritedEventCount(): SessionLogOffset { return this._inheritedEventCount; }
  ownEvents(): readonly SessionEvent[] { return this.eventsAfter(this._inheritedEventCount); }
  isOwnSeq(seq: SessionSeq): boolean { return Number.isSafeInteger(seq) && seq > this._inheritedEventCount && seq <= this.log.length; }
  eventAt(seq: SessionSeq): SessionEvent | undefined { return this.log[seq - 1]; }
  snapshotEvents(fromOffset: SessionLogOffset = 0, toOffsetExclusive: SessionLogOffset = this.log.length): readonly SessionEvent[] {
    if (!Number.isSafeInteger(fromOffset) || fromOffset < 0 || !Number.isSafeInteger(toOffsetExclusive) || toOffsetExclusive < fromOffset || toOffsetExclusive > this.log.length) {
      throw new Error("Session 事件快照边界无效。");
    }
    if (fromOffset === 0 && toOffsetExclusive === this.log.length) return this.events;
    return Object.freeze(this.log.slice(fromOffset, toOffsetExclusive));
  }
  eventsAfter(index: number): readonly SessionEvent[] {
    if (!Number.isSafeInteger(index) || index < 0 || index > this.log.length) throw new Error("Session 事件读取边界无效。");
    return Object.freeze(this.log.slice(index));
  }
  latestAttempt(runId: string): readonly SessionModelMessage[] | undefined {
    return this.latestAttempts.get(runId);
  }
  hasOpenTurn(turnId: string): boolean {
    return this.turnStates.get(turnId) === true;
  }
  openStep(turnId: string): number | undefined { return this.stepStates.get(turnId); }
  hasTurn(turnId: string): boolean { return this.turnStates.has(turnId); }
  get events(): readonly SessionEvent[] { return this.cachedEventSnapshot ??= Object.freeze([...this.log]); }
  get surface(): readonly SessionSurfaceItem[] { return this.surfaceProjection.snapshot(); }
  get surfaceReplaceGeneration(): number { return this.surfaceProjection.replaceGeneration; }
  get surfaceContentGeneration(): number { return this.surfaceProjection.contentGeneration; }
  deriveSurfaceMessages(): readonly SessionModelMessage[] {
    if (this.derivedSurfaceCache) return this.derivedSurfaceCache;
    const nodes = this.surfaceProjection.snapshot();
    const responseRuns = new Set(nodes.filter(node => node.sourceType === "assistant/response").map(node => String(node.data.runId)));
    const messages: SessionModelMessage[] = [];
    for (const node of nodes) {
      if (node.sourceType === "system/message") {
        if (node.data.content) messages.push({ role: "system", content: String(node.data.content) });
      } else if (node.sourceType === "developer/message") {
        const blocks = node.data.blocks as SessionDeveloperBlock[] | undefined;
        const content = blocks?.filter((block): block is Extract<SessionDeveloperBlock, { type: "text" }> => block.type === "text").map(block => block.text).join("") ?? String(node.data.content ?? "");
        if (content) messages.push({ role: "system", content });
      } else if (node.sourceType === "user/message") messages.push({ role: "user", content: String(node.data.content ?? "") });
      else if (node.sourceType === "assistant/response") messages.push(immutableJson(node.data.message as SessionModelMessage));
      else if (node.sourceType === "assistant/message" && ["complete", "interrupted"].includes(String(node.data.status)) && !responseRuns.has(String(node.data.runId ?? node.data.messageId))) {
        if (node.data.content) messages.push({ role: "assistant", content: String(node.data.content) });
      } else if (node.sourceType === "tool/result") messages.push({ role: "tool", tool_call_id: String(node.data.callId), content: String(node.data.content ?? "") });
    }
    this.derivedSurfaceCache = immutableJson(messages);
    return this.derivedSurfaceCache;
  }
  deriveEventMessage(event: SessionEvent): SessionModelMessage | null { return deriveSessionEventMessage(event); }
  subscribe(observer: (event: SessionEvent) => void): () => void {
    this.observers.add(observer);
    let active = true;
    return () => { if (active) { active = false; this.observers.delete(observer); } };
  }
  get requestHeader(): Extract<SessionEvent, { type: "request/header" }> | undefined { return this.latestHeader; }
  get requestContext(): readonly SessionModelMessage[] | undefined {
    return this.latestContext?.data.messages;
  }
  get toolHistory(): readonly { seq: number; runId: string; tools: readonly SessionToolSchema[] }[] {
    return this.toolHeaderHistorySnapshot ??= Object.freeze([...this.toolHeaderHistoryRows]);
  }
  get resolvedToolHistory(): SessionToolHistory {
    if (!this.toolHistorySnapshot) {
      const names = new Set(this.toolHistoryActive.map(tool => tool.function.name));
      const fallback = names.size !== this.toolHistoryAvailable.size || [...names].some(name => !this.toolHistoryAvailable.has(name));
      this.toolHistorySnapshot = immutableJson(fallback
        ? { tools: this.toolHistoryActive, updates: [] }
        : { tools: this.toolHistoryBase, updates: this.toolHistoryUpdates });
    }
    return this.toolHistorySnapshot;
  }
  toolDefinitionsForCall(callId: string): readonly SessionToolSchema[] | undefined {
    const seq = this.toolCallHeaders.get(callId);
    const tools = seq === undefined ? undefined : this.requestHeadersBySeq.get(seq);
    return tools;
  }
  deriveMessages(): readonly SessionModelMessage[] { return this.deriveSurfaceMessages(); }
  deriveRequestMessages(): readonly SessionModelMessage[] {
    if (this.latestContext) {
      const messages = [...this.latestContext.data.messages];
      const runId = this.latestContext.data.runId;
      for (const event of this.log.slice(this.latestContextOffset + 1)) {
        if (event.type === "assistant/response" && event.data.runId === runId) messages.push(event.data.message);
        else if (event.type === "tool/result" && event.data.runId === runId) messages.push({ role: "tool", tool_call_id: event.data.callId, content: event.data.content });
        else if (event.type === "user/message" && event.data.runId === runId) messages.push({ role: "user", content: event.data.content });
      }
      return immutableJson(messages);
    }
    const messages: SessionModelMessage[] = [];
    for (const event of this.log) {
      if (event.type === "system/message") messages.push({ role: "system", content: event.data.content });
      else if (event.type === "user/message") messages.push({ role: "user", content: event.data.content });
      else if (event.type === "assistant/message" && event.data.status === "complete") messages.push({ role: "assistant", content: event.data.content });
    }
    return immutableJson(messages);
  }

  /** 构造指定连续前缀的独立分支；源事件保持不变，分支序号从 1 重新连续编号。 */
  fork(sourceSeq: number, forkId = randomUUID()): SessionKernel {
    if (!Number.isSafeInteger(sourceSeq) || sourceSeq < 0 || sourceSeq > this.log.length) throw new SessionForkError("Session fork 边界无效。", "INVALID_BOUNDARY");
    if (!forkId || forkId === this.id) throw new SessionForkError("Session fork 目标 ID 已占用。", "SESSION_ALREADY_EXISTS");
    const fork = new SessionKernel(forkId);
    for (const event of this.log.slice(0, sourceSeq)) fork.append(event.type, event.data as never, event.time, {
      ...(event.surfaceOp === undefined ? {} : { surfaceOp: event.surfaceOp }),
      ...(event.sourceEventSeqs === undefined ? {} : { sourceEventSeqs: event.sourceEventSeqs })
    });
    fork.append("session/end-seed", { sourceSessionId: this.id, sourceSeq }, this.log[Math.max(0, sourceSeq - 1)]?.time ?? new Date().toISOString());
    fork._inheritedEventCount = sourceSeq;
    fork.repairOpenTail("forked");
    return fork;
  }

  /** 崩溃或 fork 在开放工具调用之后结束时，合成 fail-closed 的结果闭合记录。 */
  repairOpenTail(cause: "interrupted" | "forked"): readonly SessionEvent[] {
    const before = this.log.length;
    let openTurn: string | undefined;
    let openStep: number | undefined;
    let time = this.log.at(-1)?.time ?? new Date().toISOString();
    const pending = new Map<string, { runId: string; name: string; started: boolean }>();
    for (const event of this.log) {
      time = event.time;
      if (event.type === "turn/start") { openTurn = event.data.turnId; openStep = undefined; pending.clear(); }
      else if (event.type === "turn/end") { openTurn = undefined; openStep = undefined; pending.clear(); }
      else if (event.type === "step/start") openStep = event.data.step;
      else if (event.type === "step/end") openStep = undefined;
      else if (event.type === "assistant/attempt") {
        for (const message of event.data.messages) {
          for (const call of message.tool_calls ?? []) pending.set(call.id, { runId: event.data.runId, name: call.function.name, started: false });
          if (message.role === "tool" && message.tool_call_id) pending.delete(message.tool_call_id);
        }
      } else if (event.type === "assistant/response") {
        for (const call of event.data.message.tool_calls ?? []) pending.set(call.id, { runId: event.data.runId, name: call.function.name, started: false });
        if (event.data.message.role === "tool" && event.data.message.tool_call_id) pending.delete(event.data.message.tool_call_id);
      } else if (event.type === "tool/call") {
        const call = pending.get(event.data.callId);
        if (call) call.started = event.data.dispatched;
      } else if (event.type === "tool/result") pending.delete(event.data.callId);
    }
    if (!openTurn) return [];
    for (const [callId, call] of pending) {
      const started = call.started;
      this.append("tool/result", {
        runId: call.runId,
        callId,
        content: JSON.stringify({ error: started
          ? `${cause === "forked" ? "分支边界" : "进程中断"}发生在工具已派发之后；结果未持久化，副作用状态未知，禁止盲目重放。`
          : `${cause === "forked" ? "分支边界" : "进程中断"}发生在工具派发之前；该工具没有已记录的执行结果。` }),
        isError: true,
        executionState: started ? "unconfirmed" : "not_started",
        repaired: true
      }, time);
    }
    if (openStep !== undefined) this.append("step/end", { turnId: openTurn, step: openStep }, time);
    this.append("turn/end", { turnId: openTurn, status: cause === "forked" ? "forked" : "interrupted" }, time);
    return immutableJson(this.log.slice(before));
  }

  /** 所有已追加事件由持久层提交并 fsync；flush 明确等待该适配器的持久性屏障。 */
  async flush(): Promise<void> { await this.flushBarrier(); }
}

/** 小型 SessionStore 负责实时对象生命周期；LFAA 持久化适配器负责账户隔离及日志回放。 */
export class SessionStore {
  private readonly sessions = new Map<string, SessionKernel>();
  constructor(private readonly flushBarrier?: (id: string) => void | Promise<void>, private readonly capacity = 32) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error("SessionStore 缓存容量无效。");
  }
  private retain(id: string, session: SessionKernel): void {
    this.sessions.delete(id);
    this.sessions.set(id, session);
    while (this.sessions.size > this.capacity) this.sessions.delete(this.sessions.keys().next().value as string);
  }
  prepare(id: string, events: readonly SessionEvent[] = [], release?: () => void): SessionPreparation {
    if (this.sessions.has(id)) throw new Error("Session 已存在。");
    return SessionPreparation.create(new SessionKernel(id, events, () => this.flushBarrier?.(id)), release);
  }
  publish(preparation: SessionPreparation): SessionKernel {
    const session = preparation.session;
    if (this.sessions.has(session.id)) throw new Error("Session 已存在。");
    preparation.publish();
    this.retain(session.id, session);
    return session;
  }
  create(id: string, events: readonly SessionEvent[] = []): SessionKernel {
    const preparation = this.prepare(id, events);
    try { return this.publish(preparation); }
    catch (error) { preparation.dispose(); throw error; }
  }
  restore(id: string, events: readonly SessionEvent[]): SessionKernel {
    const existing = this.sessions.get(id);
    if (existing) { this.retain(id, existing); return existing; }
    return this.create(id, events);
  }
  fork(sourceId: string, sourceSeq: number, forkId = randomUUID()): SessionKernel {
    const source = this.get(sourceId);
    if (!source) throw new SessionForkError("找不到待 fork 的 Session。", "SESSION_NOT_FOUND");
    if (this.sessions.has(forkId)) throw new SessionForkError("Session fork 目标已存在。", "SESSION_ALREADY_EXISTS");
    const fork = source.fork(sourceSeq, forkId);
    this.retain(forkId, fork);
    return fork;
  }
  get(id: string): SessionKernel | undefined {
    const session = this.sessions.get(id);
    if (session) this.retain(id, session);
    return session;
  }
  list(): readonly string[] { return immutableJson([...this.sessions.keys()]); }
  async flush(target?: string | SessionKernel): Promise<boolean> {
    if (target instanceof SessionKernel) {
      if (this.sessions.get(target.id) !== target) return false;
      await target.flush();
      return true;
    }
    if (target && !this.sessions.has(target)) return false;
    const sessions = target ? [this.sessions.get(target)!] : [...this.sessions.values()];
    await Promise.all(sessions.map(session => session.flush()));
    return true;
  }
  drop(id: string): void { this.sessions.delete(id); }
}

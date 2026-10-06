/**
 * 功能：提供可由插件登记的凭据授权 Flow 生命周期。
 * 作用：按账户和凭据键保证单飞，管理交互回调/取消，并确认本次 Flow 实际提交记录。
 * 关联文件：packages/credentials/credentials/src/index.ts、packages/settings/settings/src/service.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import { randomUUID } from "node:crypto";
import { credentialPluginId, credentialReference, type CredentialRecord, type CredentialReference } from "lfaa-credentials/src/index.js";

export const name = "lfaaCredentialFlows";
export const inject = ["lfaaCredentials"];

const identifierPattern = /^[a-z][a-z0-9-]{0,63}$/u;
const methodPattern = /^[a-z][a-z0-9-]{0,47}$/u;
const maxFlows = 128;
const maxConcurrentAttempts = 128;

export type AuthorizationMethod = Readonly<{ id: string; label: string }>;
export type AuthorizationNotice = Readonly<{ message: string; url?: string; code?: string }>;
export type AuthorizationPrompt = Readonly<{
  kind: "text" | "secret" | "select";
  title: string;
  message: string;
  options?: readonly string[];
}>;

export interface AuthorizationInteraction {
  notify(notice: AuthorizationNotice): void | Promise<void>;
  prompt(prompt: AuthorizationPrompt & { promptId: string }, signal: AbortSignal): Promise<string | null>;
}

export interface AuthorizationSession {
  readonly ownerId: string;
  readonly reference: CredentialReference;
  readonly methodId: string;
  readonly signal: AbortSignal;
  notify(notice: AuthorizationNotice): Promise<void>;
  prompt(prompt: AuthorizationPrompt): Promise<string>;
  commit(record: CredentialRecord): void;
}

export interface AuthorizationFlow {
  readonly referenceId: string;
  readonly label: string;
  readonly methods: readonly AuthorizationMethod[];
  readonly consumers: readonly string[];
  run(session: AuthorizationSession): void | Promise<void>;
}

export interface AuthorizationFlowView {
  readonly reference: CredentialReference;
  readonly label: string;
  readonly methods: readonly AuthorizationMethod[];
  readonly inFlight: boolean;
}

export interface BeginAuthorizationInput {
  readonly ownerId: string;
  readonly reference: CredentialReference;
  readonly methodId?: string;
  readonly signal?: AbortSignal;
  readonly interaction: AuthorizationInteraction;
}

export interface AuthorizationFlowService {
  registerFlow(caller: Context, flow: AuthorizationFlow): () => void;
  list(ownerId: string): readonly AuthorizationFlowView[];
  describe(ownerId: string, reference: CredentialReference): AuthorizationFlowView | null;
  begin(input: BeginAuthorizationInput): Promise<{ readonly status: "authorized" | "cancelled" }>;
  cancel(ownerId: string, reference: CredentialReference): boolean;
}

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaCredentialFlows: AuthorizationFlowService }
}

export class CredentialFlowError extends Error {
  constructor(readonly code: "INVALID_FLOW" | "NO_FLOW" | "ALREADY_IN_FLIGHT" | "UNKNOWN_METHOD" | "NOT_COMMITTED" | "DECLINED" | "SERVICE_CLOSED", message: string) {
    super(message);
    this.name = "CredentialFlowError";
  }
}

export class AuthorizationDeclinedError extends CredentialFlowError {
  constructor() { super("DECLINED", "用户取消了凭据授权问题。"); this.name = "AuthorizationDeclinedError"; }
}

interface FlowEntry {
  readonly ownerPluginId: string;
  readonly ownerContext: Context;
  readonly flow: AuthorizationFlow;
  readonly reference: CredentialReference;
  readonly methods: readonly AuthorizationMethod[];
  readonly unregisterRecordOwner: () => void;
  readonly attempts: Set<Attempt>;
}

interface Attempt {
  readonly ownerId: string;
  readonly key: string;
  readonly entry: FlowEntry;
  readonly controller: AbortController;
  readonly signal: AbortSignal;
  committed: boolean;
  closed: boolean;
}

class CredentialFlowServiceRuntime implements AuthorizationFlowService {
  private readonly flows = new Map<string, FlowEntry>();
  private readonly attempts = new Map<string, Attempt>();
  private closed = false;

  constructor(private readonly context: Context) {}

  registerFlow(caller: Context, rawFlow: AuthorizationFlow): () => void {
    if (this.closed) throw new CredentialFlowError("SERVICE_CLOSED", "凭据授权流程服务已卸载。");
    if (!caller || caller.root !== this.context.root) throw new CredentialFlowError("INVALID_FLOW", "凭据授权 Flow 不能跨 Profile 注册。");
    let ownerPluginId: string;
    try { ownerPluginId = credentialPluginId(caller); }
    catch { throw new CredentialFlowError("INVALID_FLOW", "授权 Flow 必须由其自身的活动插件注册。"); }
    const flow = normalizeFlow(ownerPluginId, rawFlow);
    if (this.flows.size >= maxFlows) throw new CredentialFlowError("INVALID_FLOW", "已登记的凭据授权流程数量超过上限。");
    const reference = credentialReference(ownerPluginId, flow.referenceId);
    const key = referenceKey(reference);
    if (this.flows.has(key)) throw new CredentialFlowError("INVALID_FLOW", `凭据授权流程重复登记：${reference.providerId}/${reference.id}`);
    const unregisterRecordOwner = this.context.lfaaCredentials.registerRecordOwner(caller, flow.consumers);
    const entry: FlowEntry = { ownerPluginId, ownerContext: caller, flow, reference, methods: flow.methods, unregisterRecordOwner, attempts: new Set() };
    this.flows.set(key, entry);
    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      if (this.flows.get(key) === entry) this.flows.delete(key);
      for (const attempt of entry.attempts) attempt.controller.abort();
      entry.attempts.clear();
      unregisterRecordOwner();
    };
  }

  list(ownerId: string): readonly AuthorizationFlowView[] {
    validateOwner(ownerId);
    return Object.freeze([...this.flows.values()]
      .sort((left, right) => compareText(left.reference.providerId, right.reference.providerId) || compareText(left.reference.id, right.reference.id))
      .map(entry => this.view(entry, ownerId)));
  }

  describe(ownerId: string, rawReference: CredentialReference): AuthorizationFlowView | null {
    validateOwner(ownerId);
    const reference = normalizeReference(rawReference);
    const entry = this.flows.get(referenceKey(reference));
    return entry ? this.view(entry, ownerId) : null;
  }

  async begin(input: BeginAuthorizationInput): Promise<{ readonly status: "authorized" | "cancelled" }> {
    if (this.closed) throw new CredentialFlowError("SERVICE_CLOSED", "凭据授权流程服务已卸载。");
    validateOwner(input?.ownerId);
    const reference = normalizeReference(input.reference);
    const entry = this.flows.get(referenceKey(reference));
    if (!entry) throw new CredentialFlowError("NO_FLOW", "此凭据没有可用的授权流程；可能是提供插件未安装或已停用。");
    if (!input.interaction || typeof input.interaction.notify !== "function" || typeof input.interaction.prompt !== "function") {
      throw new CredentialFlowError("INVALID_FLOW", "授权请求必须提供本次调用专属的通知与提问回调。");
    }
    if (input.signal && typeof input.signal.throwIfAborted !== "function") throw new CredentialFlowError("INVALID_FLOW", "授权请求取消信号无效。");
    const methodId = input.methodId ?? entry.methods[0]?.id;
    if (!methodId || !entry.methods.some(method => method.id === methodId)) throw new CredentialFlowError("UNKNOWN_METHOD", "授权流程没有提供所选登录方法。");
    const key = attemptKey(input.ownerId, reference);
    if (this.attempts.has(key)) throw new CredentialFlowError("ALREADY_IN_FLIGHT", "此账户的该凭据已有一条授权尝试正在运行。");
    if (this.attempts.size >= maxConcurrentAttempts) throw new CredentialFlowError("INVALID_FLOW", "并发凭据授权尝试数量超过上限。");

    const controller = new AbortController();
    const combined = combineSignals(controller.signal, input.signal);
    const attempt: Attempt = { ownerId: input.ownerId, key, entry, controller, signal: combined.signal, committed: false, closed: false };
    this.attempts.set(key, attempt);
    entry.attempts.add(attempt);
    const removeCommitListener = this.context.on("credentials/record-updated", (ownerId, updatedReference, operation) => {
      if (operation === "set" && ownerId === attempt.ownerId && sameReference(updatedReference, entry.reference)) attempt.committed = true;
    }, { global: true });

    const session: AuthorizationSession = Object.freeze({
      ownerId: input.ownerId,
      reference: entry.reference,
      methodId,
      signal: combined.signal,
      notify: async (notice: AuthorizationNotice) => {
        ensureAttemptActive(attempt);
        await input.interaction.notify(normalizeNotice(notice));
      },
      prompt: async (prompt: AuthorizationPrompt) => {
        ensureAttemptActive(attempt);
        const normalized = normalizePrompt(prompt);
        const answer = await input.interaction.prompt({ ...normalized, promptId: cryptoRandomId() }, combined.signal);
        ensureAttemptActive(attempt);
        if (answer === null) throw new AuthorizationDeclinedError();
        if (typeof answer !== "string" || !answer.trim() || answer.length > 12_000 || answer.includes("\0")) {
          throw new CredentialFlowError("INVALID_FLOW", "用户返回的授权回答无效。");
        }
        return answer;
      },
      commit: (record: CredentialRecord) => {
        ensureAttemptActive(attempt);
        this.context.lfaaCredentials.commitRecord(entry.ownerContext, attempt.ownerId, entry.reference, record);
        attempt.committed = true;
      }
    });

    try {
      const running = Promise.resolve().then(() => entry.flow.run(session));
      await raceWithAbort(running, combined.signal);
      ensureAttemptActive(attempt);
      if (!attempt.committed) throw new CredentialFlowError("NOT_COMMITTED", "授权流程结束时没有提交本次凭据记录。");
      return Object.freeze({ status: "authorized" });
    } catch (error) {
      if (combined.signal.aborted || error instanceof AuthorizationDeclinedError) return Object.freeze({ status: "cancelled" });
      throw error;
    } finally {
      attempt.closed = true;
      removeCommitListener();
      combined.dispose();
      if (this.attempts.get(key) === attempt) this.attempts.delete(key);
      entry.attempts.delete(attempt);
    }
  }

  cancel(ownerId: string, rawReference: CredentialReference): boolean {
    validateOwner(ownerId);
    const reference = normalizeReference(rawReference);
    const attempt = this.attempts.get(attemptKey(ownerId, reference));
    if (!attempt) return false;
    attempt.controller.abort();
    return true;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const attempt of this.attempts.values()) attempt.controller.abort();
    for (const entry of this.flows.values()) entry.unregisterRecordOwner();
    this.attempts.clear();
    this.flows.clear();
  }

  private view(entry: FlowEntry, ownerId: string): AuthorizationFlowView {
    return Object.freeze({
      reference: entry.reference,
      label: entry.flow.label,
      methods: entry.methods,
      inFlight: this.attempts.has(attemptKey(ownerId, entry.reference))
    });
  }
}

function normalizeFlow(ownerPluginId: string, input: AuthorizationFlow): AuthorizationFlow {
  if (!identifierPattern.test(ownerPluginId) || !input || typeof input !== "object"
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(input.referenceId)
    || typeof input.label !== "string" || !input.label.trim() || input.label.length > 120
    || !Array.isArray(input.methods) || input.methods.length < 1 || input.methods.length > 32
    || !Array.isArray(input.consumers) || input.consumers.length < 1 || input.consumers.length > 64
    || input.consumers.some(consumer => !identifierPattern.test(consumer))
    || typeof input.run !== "function") {
    throw new CredentialFlowError("INVALID_FLOW", "凭据授权 Flow 描述无效。");
  }
  const ids = new Set<string>();
  const methods = input.methods.map(method => {
    if (!method || !methodPattern.test(method.id) || typeof method.label !== "string" || !method.label.trim() || method.label.length > 80 || ids.has(method.id)) {
      throw new CredentialFlowError("INVALID_FLOW", "凭据授权方法必须具有不重复的标识和名称。");
    }
    ids.add(method.id);
    return Object.freeze({ id: method.id, label: method.label.trim() });
  });
  return Object.freeze({
    referenceId: input.referenceId,
    label: input.label.trim(),
    methods: Object.freeze(methods),
    consumers: Object.freeze([...new Set(input.consumers)]),
    run: input.run
  });
}

function normalizeReference(input: CredentialReference): CredentialReference {
  if (!input || typeof input !== "object") throw new CredentialFlowError("INVALID_FLOW", "凭据引用格式无效。");
  return credentialReference(input.providerId, input.id);
}

function normalizeNotice(input: AuthorizationNotice): AuthorizationNotice {
  if (!input || typeof input.message !== "string" || !input.message.trim() || input.message.length > 1200) {
    throw new CredentialFlowError("INVALID_FLOW", "授权通知格式无效。");
  }
  let url: string | undefined;
  if (input.url !== undefined) {
    if (typeof input.url !== "string" || input.url.length > 2048) throw new CredentialFlowError("INVALID_FLOW", "授权网址无效。");
    let parsed: URL;
    try { parsed = new URL(input.url); } catch { throw new CredentialFlowError("INVALID_FLOW", "授权网址无效。"); }
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))) {
      throw new CredentialFlowError("INVALID_FLOW", "授权网址必须使用 HTTPS 或本机回调地址。");
    }
    url = parsed.toString();
  }
  if (input.code !== undefined && (typeof input.code !== "string" || !input.code.trim() || input.code.length > 128 || input.code.includes("\0"))) {
    throw new CredentialFlowError("INVALID_FLOW", "授权验证码无效。");
  }
  return Object.freeze({ message: input.message.trim(), ...(url ? { url } : {}), ...(input.code ? { code: input.code } : {}) });
}

function normalizePrompt(input: AuthorizationPrompt): AuthorizationPrompt {
  if (!input || !["text", "secret", "select"].includes(input.kind)
    || typeof input.title !== "string" || !input.title.trim() || input.title.length > 120
    || typeof input.message !== "string" || !input.message.trim() || input.message.length > 1200) {
    throw new CredentialFlowError("INVALID_FLOW", "授权提问格式无效。");
  }
  if (input.kind === "select") {
    if (!Array.isArray(input.options) || input.options.length < 1 || input.options.length > 24
      || input.options.some(option => typeof option !== "string" || !option.trim() || option.length > 240)) {
      throw new CredentialFlowError("INVALID_FLOW", "选择型授权问题的选项数量或内容无效。");
    }
    return Object.freeze({ kind: input.kind, title: input.title.trim(), message: input.message.trim(), options: Object.freeze([...input.options]) });
  }
  if (input.options !== undefined) throw new CredentialFlowError("INVALID_FLOW", "只有选择型授权问题可以包含选项。");
  return Object.freeze({ kind: input.kind, title: input.title.trim(), message: input.message.trim() });
}

function validateOwner(ownerId: string): void {
  if (typeof ownerId !== "string" || !ownerId.trim() || ownerId.length > 160 || /[\u0000-\u001f\u007f]/u.test(ownerId)) {
    throw new CredentialFlowError("INVALID_FLOW", "凭据账户标识无效。");
  }
}

function ensureAttemptActive(attempt: Attempt): void {
  if (attempt.closed || attempt.signal.aborted) throw abortError();
}

function referenceKey(reference: CredentialReference): string { return `${reference.providerId}\0${reference.id}`; }
function attemptKey(ownerId: string, reference: CredentialReference): string { return `${ownerId}\0${referenceKey(reference)}`; }
function sameReference(left: CredentialReference, right: CredentialReference): boolean { return left.providerId === right.providerId && left.id === right.id; }
function compareText(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function cryptoRandomId(): string { return randomUUID(); }

function abortError(): Error { return new DOMException("操作已取消。", "AbortError"); }

function combineSignals(primary: AbortSignal, secondary?: AbortSignal): { signal: AbortSignal; dispose(): void } {
  if (!secondary) return { signal: primary, dispose() {} };
  const controller = new AbortController();
  const abortPrimary = () => controller.abort(primary.reason);
  const abortSecondary = () => controller.abort(secondary.reason);
  if (primary.aborted) abortPrimary(); else primary.addEventListener("abort", abortPrimary, { once: true });
  if (secondary.aborted) abortSecondary(); else secondary.addEventListener("abort", abortSecondary, { once: true });
  return {
    signal: controller.signal,
    dispose() { primary.removeEventListener("abort", abortPrimary); secondary.removeEventListener("abort", abortSecondary); }
  };
}

function raceWithAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      action();
    };
    const onAbort = () => finish(() => reject(abortError()));
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
  });
}

export function apply(ctx: Context): void {
  const service = new CredentialFlowServiceRuntime(ctx);
  ctx.provide(name, service);
  ctx.effect(() => () => service.close());
}

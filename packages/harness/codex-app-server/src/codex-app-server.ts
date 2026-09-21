/**
 * 文件：codex-app-server.ts
 * 作用：把官方 Codex App Server stdio JSONL 协议适配为 LFAA 的托管认证与文本对话 Runtime。
 * 负责：进程生命周期、initialize/initialized、ChatGPT 登录、account/model 读取、thread/turn、多轮文本、流式 Agent Message 与取消。
 * 不负责：读取 Codex 私有认证文件、保存 OAuth Token、LFAA Tool/Skill/MCP、审批 UI、生产 Server。
 * 状态归属：CodexAppServerHost 持有一个 App Server 子进程；Text Runtime 持有 sessionKey→threadId 的内存映射。
 * 对外接口：CodexAppServerHost、CodexAppServerManagedAuth、CodexAppServerTextRuntime。
 * 关联文件：packages/api/settings-controller、packages/api/agent-controller、packages/bundle/web-app。
 * 修改注意事项：只能调用官方 App Server RPC；禁止读取 ~/.codex/auth.json；审批 UI 未接入前 Text Runtime 必须保持 readOnly。
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import type {
  AiAccountModel,
  AiAccountProbeResult,
  AiAccountUsageSnapshot,
  AiHostCapabilityStatus,
  AiManagedAuthPort,
  AiManagedLoginStart,
  AiManagedLoginStatus,
  AiModelCapabilities,
  AiModelSettingOption,
} from "@lfaa/config-system";

const REQUEST_TIMEOUT_MS = 20_000;
const INITIALIZE_TIMEOUT_MS = 8_000;
const TURN_TIMEOUT_MS = 10 * 60_000;
const MAX_MODEL_PAGES = 10;
const MODEL_PAGE_SIZE = 100;
const CHECKED_AT = "2026-09-20";
const MODEL_LIST_DOC = "https://developers.openai.com/codex/app-server#list-models";
const MODEL_SOURCE = {
  kind: "runtime-model-api",
  label: "Codex App Server model/list",
  url: MODEL_LIST_DOC,
  checkedAt: CHECKED_AT,
} as const;
/** App Server initialize 元数据集中定义，避免 name/title/version 散落在握手逻辑。 */
const APP_SERVER_CLIENT_INFO = { name: "lfaa_web_dev", title: "Little Fish AI Agent", version: "0.1.4" } as const;

export interface CodexTextRunInput {
  readonly sessionKey: string;
  readonly modelId: string;
  readonly input: string;
  readonly cwd: string;
  readonly reasoningEffort?: string;
  readonly signal: AbortSignal;
  readonly onTextDelta?: (delta: string) => void;
}

export interface CodexTextRunResult {
  readonly threadId: string;
  readonly turnId: string;
  readonly text: string;
}

type RpcId = number;
type JsonRecord = Record<string, unknown>;
type NotificationListener = (method: string, params: JsonRecord) => void;

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeText(value: unknown, fallback: string): string {
  const raw = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[REDACTED]")
    .replace(/(?:sk|tp)-[A-Za-z0-9_-]{6,}/g, "[REDACTED]")
    .slice(0, 420);
}

function safeRpcError(value: unknown): Error {
  if (!isRecord(value)) return new Error("Codex App Server 请求失败。");
  return new Error(safeText(value.message, "Codex App Server 请求失败。"));
}

function stringField(value: JsonRecord, key: string): string | null {
  return typeof value[key] === "string" && value[key] ? value[key] as string : null;
}

function nestedRecord(value: JsonRecord, key: string): JsonRecord | null {
  return isRecord(value[key]) ? value[key] as JsonRecord : null;
}

function numberField(value: JsonRecord, key: string): number | null {
  return typeof value[key] === "number" && Number.isFinite(value[key]) ? value[key] as number : null;
}

function parseReasoningOptions(value: unknown): readonly AiModelSettingOption[] {
  if (!Array.isArray(value)) return [];
  const output: AiModelSettingOption[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const effort = stringField(item, "reasoningEffort");
    if (!effort || output.some((option) => option.value === effort)) continue;
    output.push({ value: effort, label: effort });
  }
  return output;
}

function parseInputModalities(value: unknown): readonly ("text" | "image" | "audio" | "video")[] {
  // 官方兼容规则：旧目录未返回 inputModalities 时按 text + image 处理。
  if (!Array.isArray(value)) return ["text", "image"];
  const allowed = new Set(["text", "image", "audio", "video"] as const);
  return value.filter((item): item is "text" | "image" | "audio" | "video" => typeof item === "string" && allowed.has(item as "text" | "image" | "audio" | "video"));
}

function mapModel(value: unknown): AiAccountModel | null {
  if (!isRecord(value)) return null;
  const id = stringField(value, "id") ?? stringField(value, "model");
  if (!id) return null;
  const reasoningOptions = parseReasoningOptions(value.supportedReasoningEfforts);
  const defaultReasoningEffort = stringField(value, "defaultReasoningEffort");
  const settings = reasoningOptions.length ? [{
    id: "reasoningEffort",
    label: "思考强度",
    kind: "select" as const,
    requestPath: "effort",
    ...(defaultReasoningEffort && reasoningOptions.some((option) => option.value === defaultReasoningEffort) ? { defaultValue: defaultReasoningEffort } : {}),
    options: reasoningOptions,
    help: "来自当前 Codex App Server model/list；运行时通过 turn/start.effort 应用。",
  }] : [];
  const capabilities: AiModelCapabilities = {
    source: MODEL_SOURCE,
    inputModalities: parseInputModalities(value.inputModalities),
    settings,
    ...(value.supportsPersonality === true ? { notes: ["当前 Codex 目录标记该模型支持 personality。"] } : {}),
  };
  return {
    id,
    ...(stringField(value, "displayName") ? { name: stringField(value, "displayName")! } : {}),
    discoverySource: MODEL_SOURCE,
    capabilities,
  };
}

class CodexAppServerClient {
  #process: ChildProcessWithoutNullStreams | null = null;
  #reader: readline.Interface | null = null;
  #startPromise: Promise<void> | null = null;
  #requestId = 0;
  #generation = 0;
  #pending = new Map<RpcId, PendingRequest>();
  #loginStatuses = new Map<string, AiManagedLoginStatus>();
  #notifications = new Set<NotificationListener>();

  get generation(): number { return this.#generation; }

  async ensureStarted(): Promise<void> {
    // 启动握手期间必须复用同一个 Promise；不能仅因为子进程已存在就让并发请求越过 initialize。
    if (this.#startPromise) return this.#startPromise;
    if (this.#process && !this.#process.killed) return;
    this.#startPromise = this.#start().finally(() => { this.#startPromise = null; });
    return this.#startPromise;
  }

  async #start(): Promise<void> {
    const childProcess = spawn("codex", ["app-server"], {
      windowsHide: true,
      // Windows 的 npm 全局 bin 是 codex.cmd；Node raw spawn 不会解析 .cmd，需交给系统 shell。
      // 命令与参数均为固定常量，没有拼接用户输入。
      shell: process.platform === "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.#process = childProcess;
    // stderr 只排空，不拼进错误，避免未来 CLI 日志把任何认证信息带回应用层。
    childProcess.stderr.resume();
    this.#reader = readline.createInterface({ input: childProcess.stdout });
    this.#reader.on("line", (line) => this.#onLine(line));
    childProcess.once("error", (error) => this.#onProcessFailure(new Error(error.message.includes("ENOENT") ? "未找到 Codex CLI。请先安装 Codex CLI，并确认 codex 命令已加入 PATH。" : `Codex App Server 启动失败：${error.message}`)));
    childProcess.once("exit", (code, signal) => this.#onProcessFailure(new Error(`Codex App Server 已退出（code=${code ?? "null"}, signal=${signal ?? "null"}）。`)));

    try {
      await this.request("initialize", { clientInfo: APP_SERVER_CLIENT_INFO }, INITIALIZE_TIMEOUT_MS);
      this.notify("initialized", {});
      this.#generation += 1;
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  #onLine(line: string): void {
    let message: unknown;
    try { message = JSON.parse(line); }
    catch { return; }
    if (!isRecord(message)) return;

    // App Server 也会主动向客户端发 JSON-RPC 请求。当前 LFAA 尚未接入审批/elicitation UI，
    // 因此必须安全拒绝，不能把这些请求误当成普通响应后静默挂起。
    if (typeof message.id === "number" && typeof message.method === "string") {
      this.#handleServerRequest(message.id, message.method, isRecord(message.params) ? message.params : {});
      return;
    }

    if (typeof message.id === "number") {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.#pending.delete(message.id);
      if (message.error !== undefined) pending.reject(safeRpcError(message.error));
      else pending.resolve(message.result);
      return;
    }

    if (typeof message.method !== "string") return;
    const params = isRecord(message.params) ? message.params : {};
    if (message.method === "account/login/completed") {
      const loginId = stringField(params, "loginId");
      if (loginId) {
        if (params.success === true) this.#loginStatuses.set(loginId, { state: "succeeded" });
        else this.#loginStatuses.set(loginId, { state: "failed", error: safeText(params.error, "ChatGPT 登录未完成。") });
      }
    }
    for (const listener of this.#notifications) listener(message.method, params);
  }

  #handleServerRequest(id: number, method: string, _params: JsonRecord): void {
    if (method === "item/commandExecution/requestApproval" || method === "item/fileChange/requestApproval") {
      this.respond(id, { decision: "decline" });
      return;
    }
    if (method === "item/permissions/requestApproval") {
      this.respond(id, { permissions: [], scope: "turn" });
      return;
    }
    if (method === "mcpServer/elicitation/request") {
      this.respond(id, { action: "decline", content: null });
      return;
    }
    this.respondError(id, -32601, `LFAA 尚未接入 Codex 客户端请求：${method}`);
  }

  #onProcessFailure(error: Error): void {
    for (const [loginId, status] of this.#loginStatuses) {
      if (status.state === "pending") this.#loginStatuses.set(loginId, { state: "failed", error: error.message });
    }
    for (const [id, pending] of this.#pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.#pending.delete(id);
    }
    this.#reader?.close();
    this.#reader = null;
    this.#process = null;
    for (const listener of this.#notifications) listener("__process/failure", { error: error.message });
  }

  async request(method: string, params?: JsonRecord, timeoutMs = REQUEST_TIMEOUT_MS): Promise<unknown> {
    // initialize 本身负责启动阶段，因此只有其他请求才递归确保已启动。
    if (method !== "initialize") await this.ensureStarted();
    const process = this.#process;
    if (!process?.stdin.writable) throw new Error("Codex App Server 当前不可写。");
    const id = ++this.#requestId;
    const response = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`Codex App Server 请求超时：${method}`));
      }, timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
    });
    process.stdin.write(`${JSON.stringify({ method, id, ...(params ? { params } : {}) })}\n`);
    return response;
  }

  notify(method: string, params: JsonRecord): void {
    const process = this.#process;
    if (!process?.stdin.writable) return;
    process.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  respond(id: number, result: unknown): void {
    const process = this.#process;
    if (!process?.stdin.writable) return;
    process.stdin.write(`${JSON.stringify({ id, result })}\n`);
  }

  respondError(id: number, code: number, message: string): void {
    const process = this.#process;
    if (!process?.stdin.writable) return;
    process.stdin.write(`${JSON.stringify({ id, error: { code, message: safeText(message, "Unsupported request") } })}\n`);
  }

  subscribe(listener: NotificationListener): () => void {
    this.#notifications.add(listener);
    return () => this.#notifications.delete(listener);
  }

  setLoginPending(loginId: string): void {
    if (!this.#loginStatuses.has(loginId)) this.#loginStatuses.set(loginId, { state: "pending" });
  }

  loginStatus(loginId: string): AiManagedLoginStatus {
    return this.#loginStatuses.get(loginId) ?? { state: "failed", error: "登录会话不存在或 Codex App Server 已重启。" };
  }

  markLoginFailed(loginId: string, error: string): void {
    this.#loginStatuses.set(loginId, { state: "failed", error });
  }

  dispose(): void {
    const process = this.#process;
    this.#process = null;
    this.#reader?.close();
    this.#reader = null;
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Codex App Server 已关闭。"));
    }
    this.#pending.clear();
    this.#notifications.clear();
    if (process && !process.killed) {
      // 先关闭 stdin，让 app-server 正常收到 EOF；随后终止包装进程，避免 Vite 关闭后留下宿主会话。
      try { process.stdin.end(); } catch { /* already closed */ }
      process.kill();
    }
  }
}

export class CodexAppServerManagedAuth implements AiManagedAuthPort {
  readonly kind = "codex-app-server" as const;
  readonly #client: CodexAppServerClient;
  readonly #ownsClient: boolean;

  constructor(client?: CodexAppServerClient) {
    this.#client = client ?? new CodexAppServerClient();
    this.#ownsClient = !client;
  }

  async status(): Promise<AiHostCapabilityStatus> {
    try {
      await this.#client.ensureStarted();
      return { available: true };
    } catch (error) {
      return { available: false, reason: error instanceof Error ? error.message : "Codex App Server 不可用。" };
    }
  }

  async startLogin(): Promise<AiManagedLoginStart> {
    const result = await this.#client.request("account/login/start", {
      type: "chatgpt",
      useHostedLoginSuccessPage: true,
      appBrand: "chatgpt",
    });
    if (!isRecord(result) || result.type !== "chatgpt") throw new Error("Codex App Server 返回了未知 ChatGPT 登录响应。");
    const loginId = stringField(result, "loginId");
    const authUrl = stringField(result, "authUrl");
    if (!loginId || !authUrl) throw new Error("Codex App Server 未返回 loginId / authUrl。");
    this.#client.setLoginPending(loginId);
    return { loginId, authUrl };
  }

  async loginStatus(loginId: string): Promise<AiManagedLoginStatus> {
    await this.#client.ensureStarted();
    return this.#client.loginStatus(loginId);
  }

  async cancelLogin(loginId: string): Promise<void> {
    try { await this.#client.request("account/login/cancel", { loginId }); }
    finally { this.#client.markLoginFailed(loginId, "登录已取消。"); }
  }

  async probe(): Promise<AiAccountProbeResult> {
    const accountResult = await this.#client.request("account/read", { refreshToken: false });
    if (!isRecord(accountResult)) throw new Error("Codex App Server account/read 响应无效。");
    const account = isRecord(accountResult.account) ? accountResult.account : null;
    if (!account || account.type !== "chatgpt") throw new Error("Codex 当前未登录 ChatGPT 套餐账户。请先完成 ChatGPT 登录。");

    const models: AiAccountModel[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_MODEL_PAGES; page += 1) {
      const result = await this.#client.request("model/list", {
        limit: MODEL_PAGE_SIZE,
        includeHidden: false,
        ...(cursor ? { cursor } : {}),
      });
      if (!isRecord(result) || !Array.isArray(result.data)) throw new Error("Codex App Server model/list 响应无效。");
      for (const item of result.data) {
        const model = mapModel(item);
        if (model) models.push(model);
      }
      cursor = stringField(result, "nextCursor");
      if (!cursor) break;
      if (page === MAX_MODEL_PAGES - 1) throw new Error("Codex 模型目录分页超过安全上限，请升级 LFAA 后重试。");
    }

    const email = stringField(account, "email");
    const planType = stringField(account, "planType");
    const identity = [email, planType].filter(Boolean).join(" · ");
    return {
      status: "connected",
      message: `ChatGPT 已连接${identity ? `（${identity}）` : ""}，Codex App Server 返回 ${models.length} 个可用模型。`,
      models,
    };
  }

  async usage(): Promise<AiAccountUsageSnapshot> {
    const accountResult = await this.#client.request("account/read", { refreshToken: false });
    if (!isRecord(accountResult)) throw new Error("Codex App Server account/read 响应无效。");
    const account = isRecord(accountResult.account) ? accountResult.account : null;
    if (!account || account.type !== "chatgpt") throw new Error("Codex 当前未登录 ChatGPT 套餐账户。");

    const [limitsRaw, usageRaw] = await Promise.all([
      this.#client.request("account/rateLimits/read", {}),
      this.#client.request("account/usage/read", {}).catch(() => null),
    ]);
    const limitsResult = isRecord(limitsRaw) ? limitsRaw : {};
    const byId = isRecord(limitsResult.rateLimitsByLimitId) ? limitsResult.rateLimitsByLimitId : null;
    const fallback = isRecord(limitsResult.rateLimits) ? limitsResult.rateLimits : null;
    const buckets: JsonRecord[] = byId
      ? Object.values(byId).filter(isRecord)
      : fallback ? [fallback] : [];
    const rateLimits = buckets.flatMap((bucket) => {
      const primary = nestedRecord(bucket, "primary");
      const usedPercent = primary ? numberField(primary, "usedPercent") : null;
      if (usedPercent === null) return [];
      const limitId = stringField(bucket, "limitId") ?? "codex";
      const limitName = stringField(bucket, "limitName");
      const planType = stringField(bucket, "planType") ?? stringField(account, "planType");
      return [{
        id: limitId,
        ...(limitName ? { label: limitName } : {}),
        usedPercent,
        ...(numberField(primary!, "windowDurationMins") !== null ? { windowDurationMins: numberField(primary!, "windowDurationMins")! } : {}),
        ...(numberField(primary!, "resetsAt") !== null ? { resetsAt: numberField(primary!, "resetsAt")! } : {}),
        ...(planType ? { planType } : {}),
      }];
    });
    const resetCredits = isRecord(limitsResult.rateLimitResetCredits) ? limitsResult.rateLimitResetCredits : null;
    const usageResult = isRecord(usageRaw) ? usageRaw : {};
    const summary = isRecord(usageResult.summary) ? usageResult.summary : null;
    const tokenUsage = summary ? {
      lifetimeTokens: numberField(summary, "lifetimeTokens"),
      peakDailyTokens: numberField(summary, "peakDailyTokens"),
      longestRunningTurnSec: numberField(summary, "longestRunningTurnSec"),
      currentStreakDays: numberField(summary, "currentStreakDays"),
      longestStreakDays: numberField(summary, "longestStreakDays"),
    } : undefined;
    const planType = stringField(account, "planType") ?? undefined;
    return {
      status: "available",
      scope: "codex-work",
      source: {
        kind: "official-runtime",
        label: "Codex App Server account/rateLimits/read + account/usage/read",
        url: "https://developers.openai.com/codex/app-server",
        checkedAt: "2026-09-21",
      },
      checkedAt: new Date().toISOString(),
      message: "官方返回的是 Codex / ChatGPT Work 计量域；它与标准 ChatGPT Chat 的消息额度分开，LFAA 不会把两者合并。",
      ...(planType ? { planType } : {}),
      rateLimits,
      ...(tokenUsage ? { tokenUsage } : {}),
      ...(resetCredits && numberField(resetCredits, "availableCount") !== null ? { resetCreditsAvailable: numberField(resetCredits, "availableCount")! } : {}),
    };
  }

  dispose(): void { if (this.#ownsClient) this.#client.dispose(); }
}

interface RuntimeThread {
  readonly threadId: string;
  readonly generation: number;
}

function turnStatus(turn: JsonRecord): string | null {
  return stringField(turn, "status");
}

function turnErrorMessage(turn: JsonRecord): string | null {
  const error = nestedRecord(turn, "error");
  return error ? safeText(error.message, "Codex Turn 执行失败。") : null;
}

export class CodexAppServerTextRuntime {
  readonly #client: CodexAppServerClient;
  readonly #threads = new Map<string, RuntimeThread>();
  readonly #sessionTails = new Map<string, Promise<void>>();

  constructor(client?: CodexAppServerClient) {
    this.#client = client ?? new CodexAppServerClient();
  }

  async runText(options: CodexTextRunInput): Promise<CodexTextRunResult> {
    const previous = this.#sessionTails.get(options.sessionKey) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const tail = previous.catch(() => undefined).then(() => gate);
    this.#sessionTails.set(options.sessionKey, tail);
    await previous.catch(() => undefined);
    try {
      return await this.#runText(options);
    } finally {
      release();
      if (this.#sessionTails.get(options.sessionKey) === tail) this.#sessionTails.delete(options.sessionKey);
    }
  }

  async #ensureThread(options: CodexTextRunInput): Promise<string> {
    await this.#client.ensureStarted();
    const existing = this.#threads.get(options.sessionKey);
    if (existing?.generation === this.#client.generation) return existing.threadId;
    const result = await this.#client.request("thread/start", {
      model: options.modelId,
      cwd: options.cwd,
      serviceName: "lfaa",
    });
    if (!isRecord(result) || !isRecord(result.thread)) throw new Error("Codex thread/start 响应无效。");
    const threadId = stringField(result.thread, "id");
    if (!threadId) throw new Error("Codex thread/start 未返回 thread.id。");
    this.#threads.set(options.sessionKey, { threadId, generation: this.#client.generation });
    return threadId;
  }

  async #runText(options: CodexTextRunInput): Promise<CodexTextRunResult> {
    if (!options.input.trim()) throw new Error("Codex Run 输入为空。");
    const threadId = await this.#ensureThread(options);
    let expectedTurnId: string | null = null;
    let deltaText = "";
    let finalAnswer = "";
    const completedMessages: string[] = [];
    let observedError: string | null = null;
    let settled = false;

    let resolveCompletion!: (value: { turnId: string; text: string }) => void;
    let rejectCompletion!: (error: Error) => void;
    const completion = new Promise<{ turnId: string; text: string }>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });
    // turn/start 尚未返回时也可能收到取消；立即登记拒绝处理，最终仍由下方 await 传播错误。
    void completion.catch(() => undefined);

    const finish = (turnId: string, status: string, error: string | null) => {
      if (settled) return;
      settled = true;
      if (status === "interrupted") {
        rejectCompletion(new DOMException("Codex Run 已取消。", "AbortError"));
        return;
      }
      if (status !== "completed") {
        rejectCompletion(new Error(error ?? observedError ?? `Codex Turn 结束状态异常：${status}`));
        return;
      }
      const text = (finalAnswer || completedMessages.join("\n\n") || deltaText).trim();
      if (!text) {
        rejectCompletion(new Error("Codex Turn 已完成，但没有返回可显示文本。"));
        return;
      }
      resolveCompletion({ turnId, text });
    };

    const unsubscribe = this.#client.subscribe((method, params) => {
      const eventThreadId = stringField(params, "threadId");
      const eventTurnId = stringField(params, "turnId");
      if (eventThreadId && eventThreadId !== threadId) return;
      if (expectedTurnId && eventTurnId && eventTurnId !== expectedTurnId) return;

      if (method === "item/agentMessage/delta") {
        const delta = stringField(params, "delta");
        if (!delta) return;
        deltaText += delta;
        options.onTextDelta?.(delta);
        return;
      }

      if (method === "item/completed") {
        const item = nestedRecord(params, "item");
        if (!item || stringField(item, "type") !== "agentMessage") return;
        const text = stringField(item, "text");
        if (!text) return;
        if (stringField(item, "phase") === "final_answer") finalAnswer = text;
        else completedMessages.push(text);
        return;
      }

      if (method === "error") {
        const error = nestedRecord(params, "error");
        if (error) observedError = safeText(error.message, "Codex Runtime 报告错误。");
        return;
      }

      if (method === "__process/failure") {
        if (!settled) {
          settled = true;
          rejectCompletion(new Error(safeText(params.error, "Codex App Server 已退出。")));
        }
        return;
      }

      if (method === "turn/completed") {
        const turn = nestedRecord(params, "turn");
        if (!turn) return;
        const turnId = stringField(turn, "id");
        if (!turnId) return;
        if (expectedTurnId && turnId !== expectedTurnId) return;
        if (!expectedTurnId) expectedTurnId = turnId;
        finish(turnId, turnStatus(turn) ?? "failed", turnErrorMessage(turn));
      }
    });

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let aborted = options.signal.aborted;
    const interrupt = () => {
      aborted = true;
      if (!settled) {
        settled = true;
        const error = new Error("Codex Run 已取消。");
        error.name = "AbortError";
        rejectCompletion(error);
      }
      if (expectedTurnId) {
        void this.#client.request("turn/interrupt", { threadId, turnId: expectedTurnId }).catch(() => undefined);
      }
    };
    options.signal.addEventListener("abort", interrupt, { once: true });

    try {
      const result = await this.#client.request("turn/start", {
        threadId,
        input: [{ type: "text", text: options.input.trim() }],
        cwd: options.cwd,
        model: options.modelId,
        ...(options.reasoningEffort ? { effort: options.reasoningEffort } : {}),
        // P2 审批 UI 尚未接入前，Codex Text Runtime 硬限制为只读；避免设置页“请求审批”没有真正宿主时发生隐式写入。
        approvalPolicy: "never",
        sandboxPolicy: { type: "readOnly", access: { type: "fullAccess" } },
      });
      if (!isRecord(result) || !isRecord(result.turn)) throw new Error("Codex turn/start 响应无效。");
      expectedTurnId = stringField(result.turn, "id");
      if (!expectedTurnId) throw new Error("Codex turn/start 未返回 turn.id。");
      if (aborted) interrupt();
      timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        void this.#client.request("turn/interrupt", { threadId, turnId: expectedTurnId! }).catch(() => undefined);
        rejectCompletion(new Error("Codex Turn 等待完成超时。"));
      }, TURN_TIMEOUT_MS);
      const completed = await completion;
      return { threadId, turnId: completed.turnId, text: completed.text };
    } finally {
      if (timeout) clearTimeout(timeout);
      options.signal.removeEventListener("abort", interrupt);
      unsubscribe();
    }
  }

  dispose(): void {
    this.#threads.clear();
    this.#sessionTails.clear();
    this.#client.dispose();
  }
}

/**
 * Web Bundle 的组合单元：一个 Codex App Server 进程同时服务设置页认证与 Agent Runtime。
 * Controller 只消费 managedAuth / textRuntime，不自行启动第二个 Codex 进程。
 */
export class CodexAppServerHost {
  readonly #client = new CodexAppServerClient();
  readonly managedAuth = new CodexAppServerManagedAuth(this.#client);
  readonly textRuntime = new CodexAppServerTextRuntime(this.#client);

  dispose(): void {
    this.#client.dispose();
  }
}

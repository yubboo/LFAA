/**
 * 文件：codex-app-server.ts
 * 作用：把官方 Codex App Server stdio JSONL 协议适配为 Config System 的托管认证 Host Port。
 * 负责：进程生命周期、initialize/initialized、ChatGPT 浏览器登录、账户读取、官方 model/list 能力映射。
 * 不负责：保存/读取 ChatGPT Token、读取 Codex auth 文件、Provider UI、账户元数据持久化、推理线程执行。
 * 状态归属：Vite 开发宿主进程持有一个惰性 Codex App Server 子进程与待响应请求 Map。
 * 对外接口：CodexAppServerManagedAuth。
 * 关联文件：ai-config-bridge.ts、@lfaa/config-system host-ports.ts。
 * 修改注意事项：只能调用官方 App Server RPC；禁止读取 ~/.codex/auth.json 或把 OAuth Token 带回 LFAA。
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import type {
  AiAccountModel,
  AiAccountProbeResult,
  AiHostCapabilityStatus,
  AiManagedAuthPort,
  AiManagedLoginStart,
  AiManagedLoginStatus,
  AiModelCapabilities,
  AiModelSettingOption,
} from "@lfaa/config-system";

const REQUEST_TIMEOUT_MS = 20_000;
const INITIALIZE_TIMEOUT_MS = 8_000;
const MAX_MODEL_PAGES = 10;
const MODEL_PAGE_SIZE = 100;
const CHECKED_AT = "2026-09-19";
const MODEL_LIST_DOC = "https://developers.openai.com/codex/app-server#list-models";
const MODEL_SOURCE = {
  kind: "runtime-model-api",
  label: "Codex App Server model/list",
  url: MODEL_LIST_DOC,
  checkedAt: CHECKED_AT,
} as const;
/** App Server initialize 元数据集中定义，避免 name/title/version 散落在握手逻辑。 */
const APP_SERVER_CLIENT_INFO = { name: "lfaa_web_dev", title: "Little Fish AI Agent", version: "0.0.77" } as const;

type RpcId = number;
type JsonRecord = Record<string, unknown>;

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeRpcError(value: unknown): Error {
  if (!isRecord(value)) return new Error("Codex App Server 请求失败。");
  const raw = typeof value.message === "string" ? value.message : "Codex App Server 请求失败。";
  // App Server 正常错误不应包含 Token；仍做兜底脱敏，避免错误链把 Bearer/JWT 带到 UI。
  const message = raw
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[REDACTED]")
    .slice(0, 320);
  return new Error(message);
}

function stringField(value: JsonRecord, key: string): string | null {
  return typeof value[key] === "string" && value[key] ? value[key] as string : null;
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
    requestPath: "reasoningEffort",
    ...(defaultReasoningEffort && reasoningOptions.some((option) => option.value === defaultReasoningEffort) ? { defaultValue: defaultReasoningEffort } : {}),
    options: reasoningOptions,
    help: "来自当前 Codex App Server model/list；保存后供后续 Codex Runtime 使用。",
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
  #pending = new Map<RpcId, PendingRequest>();
  #loginStatuses = new Map<string, AiManagedLoginStatus>();

  async ensureStarted(): Promise<void> {
    // 启动握手期间必须复用同一个 Promise；不能仅因为子进程已存在就让并发请求越过 initialize。
    if (this.#startPromise) return this.#startPromise;
    if (this.#process && !this.#process.killed) return;
    this.#startPromise = this.#start().finally(() => { this.#startPromise = null; });
    return this.#startPromise;
  }

  async #start(): Promise<void> {
    const process = spawn("codex", ["app-server"], {
      windowsHide: true,
      // Windows 的 npm 全局 bin 是 codex.cmd；Node raw spawn 不会解析 .cmd，需交给系统 shell。
      // 命令与参数均为固定常量，没有拼接用户输入。
      shell: process.platform === "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.#process = process;
    // stderr 只排空，不拼进错误，避免未来 CLI 日志把任何认证信息带回应用层。
    process.stderr.resume();
    this.#reader = readline.createInterface({ input: process.stdout });
    this.#reader.on("line", (line) => this.#onLine(line));
    process.once("error", (error) => this.#onProcessFailure(new Error(error.message.includes("ENOENT") ? "未找到 Codex CLI。请先安装 Codex CLI，并确认 codex 命令已加入 PATH。" : `Codex App Server 启动失败：${error.message}`)));
    process.once("exit", (code, signal) => this.#onProcessFailure(new Error(`Codex App Server 已退出（code=${code ?? "null"}, signal=${signal ?? "null"}）。`)));

    try {
      await this.request("initialize", {
        clientInfo: APP_SERVER_CLIENT_INFO,
      }, INITIALIZE_TIMEOUT_MS);
      this.notify("initialized", {});
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

    if (typeof message.id === "number") {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.#pending.delete(message.id);
      if (message.error !== undefined) pending.reject(safeRpcError(message.error));
      else pending.resolve(message.result);
      return;
    }

    if (message.method === "account/login/completed" && isRecord(message.params)) {
      const loginId = stringField(message.params, "loginId");
      if (!loginId) return;
      if (message.params.success === true) this.#loginStatuses.set(loginId, { state: "succeeded" });
      else this.#loginStatuses.set(loginId, { state: "failed", error: typeof message.params.error === "string" ? message.params.error.slice(0, 320) : "ChatGPT 登录未完成。" });
    }
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
    if (process && !process.killed) {
      // 先关闭 stdin，让 app-server 正常收到 EOF；随后终止包装进程，避免 Vite 关闭后留下宿主会话。
      try { process.stdin.end(); } catch { /* already closed */ }
      process.kill();
    }
  }
}

export class CodexAppServerManagedAuth implements AiManagedAuthPort {
  readonly kind = "codex-app-server" as const;
  readonly #client = new CodexAppServerClient();

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

  dispose(): void { this.#client.dispose(); }
}

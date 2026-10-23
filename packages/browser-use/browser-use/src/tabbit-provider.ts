/**
 * 功能：通过 Tabbit 官方稳定 CLI 提供显式选用的个人浏览器 Provider。
 * 作用：隔离每个 LFAA 用户/Session 的任务工作区；仅传固定 Playwright 脚本，不执行模型生成的 JS。
 * 关联文件：session-manager.ts、browser-tools.ts、Tabbit LocalAgent 稳定 CLI。
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { BrowserSnapshot } from "./session-manager.js";

const FRAME_TIMEOUT_MS = 35_000;
const MAX_LINE_BYTES = 6 * 1024 * 1024;
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
const SESSION_IDLE_TTL_MS = 30 * 60_000;
const MAX_TABS = 8;
const MAX_TEXT = 16_000;
const MAX_CONTROLS = 80;
const SENSITIVE = /(?:password|passcode|secret|token|api[\s_-]?key|authorization|验证码|密码|密钥|令牌)/iu;

export interface TabbitTabSummary { tabId: number; title: string; url: string; active: boolean; state: string }
export interface TabbitPanelRevision { revision: number; url: string; title: string }

interface LineWaiter { resolve: (line: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
interface TabbitSession {
  id: string;
  ownerId: string;
  sourceSessionId: string;
  taskName: string;
  child: ChildProcessWithoutNullStreams;
  output: ReadlineInterface;
  queuedLines: string[];
  waiters: LineWaiter[];
  closed: boolean;
  closing: boolean;
  initialized: boolean;
  tabInventory: TabbitTabSummary[] | null;
  lastUsedAt: number;
  revision: number;
  pageFingerprint: string;
  pageUrl: string;
  pageTitle: string;
  snapshot: BrowserSnapshot | null;
  operationTail: Promise<void>;
  requestCounter: number;
}

function sessionKey(ownerId: string, sourceSessionId: string): string {
  return createHash("sha256").update(`${ownerId}\0${sourceSessionId}\0tabbit-personal`).digest("hex");
}

function launcherPath(): string | null {
  if (process.platform === "win32" && process.env.LOCALAPPDATA) return join(process.env.LOCALAPPDATA, "Tabbit", "LocalAgent", "bin", "tabbit-cli.exe");
  if (process.platform === "darwin" && process.env.HOME) return join(process.env.HOME, ".local", "bin", "tabbit-cli");
  return null;
}

function jsString(value: string): string {
  return JSON.stringify(value).replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

const READ_SNAPSHOT = `
const title = (await page.title().catch(() => "")).slice(0, 300);
const url = page.url().slice(0, 2048);
const pageText = (await page.locator("body").innerText({ timeout: 4000 }).catch(() => "")).slice(0, ${MAX_TEXT});
const controls = await page.locator("a,button,input,textarea,select,[role=button],[role=link],[role=textbox]").evaluateAll(elements => elements.slice(0, ${MAX_CONTROLS}).map(element => {
 const node = element; const input = node instanceof HTMLInputElement ? node : null;
 const label = node.getAttribute("aria-label") || node.innerText || input?.placeholder || node.getAttribute("title") || "";
 const name = label.replace(/[\\u0000-\\u001f\\u007f]/gu, " ").trim().slice(0, 160);
 const role = node.getAttribute("role") || ({A:"link",BUTTON:"button",INPUT:input?.type === "checkbox" ? "checkbox" : input?.type === "radio" ? "radio" : "textbox",TEXTAREA:"textbox",SELECT:"combobox"})[node.tagName] || node.tagName.toLowerCase();
 return {role, name: input?.type === "password" || /password|secret|token|api[\\s_-]?key|验证码|密码|密钥|令牌/iu.test(name) ? "受保护的敏感字段" : name, ...(input?.type && input.type !== "password" ? {type:input.type} : {}), disabled: node.disabled === true || node.getAttribute("aria-disabled") === "true"};
}).filter(item => item.name).slice(0, ${MAX_CONTROLS}));
const ownedPages = pages().slice(0, ${MAX_TABS});
const tabs = await Promise.all(ownedPages.map(async (tab, index) => ({id:String(index), title:(await tab.title().catch(() => "")).slice(0,300), url:tab.url().slice(0,2048), active:tab === page})));
const size = page.viewportSize() || {width:1280,height:800};
let image = await page.screenshot({type:"jpeg",quality:68,animations:"disabled",timeout:5000}).catch(() => null);
if(image && image.byteLength > ${MAX_SCREENSHOT_BYTES}) image = await page.screenshot({type:"jpeg",quality:55,animations:"disabled",timeout:5000}).catch(() => null);
return {title,url,pageText,controls,tabs,screenshotBase64:image ? image.toString("base64") : "",screenshotWidth:size.width,screenshotHeight:size.height};`;
const READ_SNAPSHOT_WITHOUT_IMAGE = READ_SNAPSHOT.replace(`let image = await page.screenshot({type:"jpeg",quality:68,animations:"disabled",timeout:5000}).catch(() => null);\nif(image && image.byteLength > ${MAX_SCREENSHOT_BYTES}) image = await page.screenshot({type:"jpeg",quality:55,animations:"disabled",timeout:5000}).catch(() => null);`, "const image = null;");

export class TabbitBrowserProvider {
  private readonly sessions = new Map<string, Promise<TabbitSession>>();
  private readonly sessionIds = new Map<string, string>();
  constructor(private readonly enabled: boolean) {}

  isAvailable(): boolean {
    const path = launcherPath();
    return this.enabled && path !== null && existsSync(path);
  }

  async listTabs(ownerId: string, sourceSessionId: string, signal?: AbortSignal): Promise<TabbitTabSummary[]> {
    const session = await this.getSession(ownerId, sourceSessionId, signal);
    return this.exclusive(session, async () => {
      if (!session.tabInventory) {
        const receipt = await this.sendFrame(session, { op: "tabs", requestId: this.nextRequestId(session) });
        session.tabInventory = this.readTabInventory(this.receiptValue(receipt));
      } else if (session.initialized) {
        const receipt = await this.sendFrame(session, { op: "tabs", requestId: this.nextRequestId(session) });
        session.tabInventory = this.readTabInventory(this.receiptValue(receipt));
      }
      this.touch(session);
      return session.tabInventory.map(tab => ({ ...tab }));
    }, signal);
  }

  async claimTab(ownerId: string, sourceSessionId: string, tabId: number, signal?: AbortSignal): Promise<BrowserSnapshot> {
    if (!Number.isSafeInteger(tabId) || tabId < 0) throw new Error("Tabbit 标签 ID 无效。");
    const session = await this.getSession(ownerId, sourceSessionId, signal);
    return this.exclusive(session, async () => {
      if (session.initialized) throw new Error("当前 LFAA Session 已经连接 Tabbit 标签。");
      if (!session.tabInventory) {
        const receipt = await this.sendFrame(session, { op: "tabs", requestId: this.nextRequestId(session) });
        session.tabInventory = this.readTabInventory(this.receiptValue(receipt));
      }
      const target = session.tabInventory.find(tab => tab.tabId === tabId && tab.state === "available");
      if (!target) throw new Error("该 Tabbit 标签已失效、正被其他任务占用或不可连接；请重新查看标签列表。");
      const requestId = this.nextRequestId(session);
      const receipt = await this.sendFrame(session, { op: "bootstrap", taskName: session.taskName, requestId, claimTabIds: [tabId], code: READ_SNAPSHOT });
      session.initialized = true;
      return this.saveSnapshot(session, this.receiptValue(receipt));
    }, signal);
  }

  async navigate(ownerId: string, sourceSessionId: string, value: string, signal?: AbortSignal): Promise<BrowserSnapshot> {
    const session = await this.getSession(ownerId, sourceSessionId, signal);
    return this.exclusive(session, async () => {
      const url = new URL(value);
      if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password || value.length > 2048) throw new Error("Tabbit 浏览器只接受不含账号密码的 HTTP(S) 地址。");
      const code = `await page.goto(${jsString(url.toString())},{waitUntil:"domcontentloaded",timeout:20000});${READ_SNAPSHOT}`;
      const requestId = this.nextRequestId(session);
      const receipt = session.initialized
        ? await this.sendFrame(session, { op: "run", requestId, mutation: "possible", code })
        : await this.sendFrame(session, { op: "bootstrap", taskName: session.taskName, requestId, code });
      session.initialized = true;
      session.tabInventory = null;
      return this.saveSnapshot(session, this.receiptValue(receipt));
    }, signal);
  }

  async observe(ownerId: string, sourceSessionId: string, signal?: AbortSignal): Promise<BrowserSnapshot> {
    const session = await this.getSession(ownerId, sourceSessionId, signal);
    return this.exclusive(session, async () => {
      if (!session.initialized) throw new Error("请先查看 Tabbit 标签并连接目标标签，或在浏览器工作区地址栏输入网址。");
      const receipt = await this.sendFrame(session, { op: "run", requestId: this.nextRequestId(session), code: READ_SNAPSHOT });
      return this.saveSnapshot(session, this.receiptValue(receipt));
    }, signal);
  }

  async action(ownerId: string, sourceSessionId: string, operation: "back" | "forward" | "reload" | "click" | "fill" | "press-key" | "scroll" | "clickAt" | "dragAt" | "type-text", args: Record<string, unknown> = {}, signal?: AbortSignal, includeScreenshot = true): Promise<BrowserSnapshot> {
    const session = await this.getSession(ownerId, sourceSessionId, signal);
    return this.exclusive(session, async () => {
      if (!session.initialized) throw new Error("Tabbit 尚未连接当前 LFAA Session 的浏览器标签。");
      const code = this.actionCode(operation, args, includeScreenshot);
      const receipt = await this.sendFrame(session, { op: "run", requestId: this.nextRequestId(session), mutation: operation === "back" || operation === "forward" || operation === "reload" || operation === "scroll" ? "possible" : "possible", code });
      return this.saveSnapshot(session, this.receiptValue(receipt));
    }, signal);
  }

  async getPanelSnapshot(ownerId: string, sourceSessionId: string, includeScreenshot = true): Promise<BrowserSnapshot | null> {
    const key = sessionKey(ownerId, sourceSessionId), id = this.sessionIds.get(key), pending = id ? this.sessions.get(id) : undefined;
    if (!pending) return null;
    const session = await pending;
    if (!session.initialized || session.closed) return null;
    this.touch(session);
    if (includeScreenshot) {
      return this.exclusive(session, async () => {
        const receipt = await this.sendFrame(session, { op: "run", requestId: this.nextRequestId(session), code: READ_SNAPSHOT });
        return this.saveSnapshot(session, this.receiptValue(receipt));
      });
    }
    return session.snapshot ? structuredClone(session.snapshot) : null;
  }

  async getPanelRevision(ownerId: string, sourceSessionId: string, signal?: AbortSignal): Promise<TabbitPanelRevision | null> {
    const key = sessionKey(ownerId, sourceSessionId), id = this.sessionIds.get(key), pending = id ? this.sessions.get(id) : undefined;
    if (!pending) return null;
    const session = await pending;
    if (!session.initialized || session.closed) return null;
    return this.exclusive(session, async () => {
      const code = `const title=(await page.title().catch(()=>"")).slice(0,300);const url=page.url().slice(0,2048);const body=(await page.locator("body").innerText({timeout:3000}).catch(()=>"")).slice(0,4000);return {title,url,fingerprint:title+"\\n"+url+"\\n"+body};`;
      const receipt = await this.sendFrame(session, { op: "run", requestId: this.nextRequestId(session), code });
      const value = this.asRecord(this.receiptValue(receipt));
      const fingerprint = typeof value.fingerprint === "string" ? value.fingerprint : "";
      const url = typeof value.url === "string" ? value.url.slice(0, 2048) : session.pageUrl;
      const title = typeof value.title === "string" ? value.title.slice(0, 300) : session.pageTitle;
      if (fingerprint !== session.pageFingerprint || url !== session.pageUrl || title !== session.pageTitle) {
        session.pageFingerprint = fingerprint;
        session.pageUrl = url;
        session.pageTitle = title;
        session.revision += 1;
      }
      this.touch(session);
      return { revision: session.revision, url: session.pageUrl, title: session.pageTitle };
    }, signal);
  }

  async closeSession(ownerId: string, sourceSessionId: string): Promise<void> {
    const key = sessionKey(ownerId, sourceSessionId), id = this.sessionIds.get(key), pending = id ? this.sessions.get(id) : undefined;
    if (!pending) return;
    await this.dispose(await pending);
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.sessions.values()].map(async item => this.dispose(await item.catch(() => null))));
    this.sessions.clear();
    this.sessionIds.clear();
  }

  async closeOwnerSessions(ownerId: string): Promise<void> {
    const owned = await Promise.all([...this.sessions.values()].map(item => item.catch(() => null)));
    await Promise.all(owned.flatMap(session => session?.ownerId === ownerId ? [this.dispose(session)] : []));
  }

  async sweepExpired(now = Date.now()): Promise<void> {
    for (const pending of this.sessions.values()) {
      const session = await pending.catch(() => null);
      if (session && now - session.lastUsedAt > SESSION_IDLE_TTL_MS) await this.dispose(session);
    }
  }

  private actionCode(operation: string, args: Record<string, unknown>, includeScreenshot: boolean): string {
    const stringArg = (key: string) => typeof args[key] === "string" ? args[key] as string : "";
    const snapshot = includeScreenshot ? READ_SNAPSHOT : READ_SNAPSHOT_WITHOUT_IMAGE;
    if (operation === "back") return `await page.goBack({waitUntil:"domcontentloaded",timeout:10000});${snapshot}`;
    if (operation === "forward") return `await page.goForward({waitUntil:"domcontentloaded",timeout:10000});${snapshot}`;
    if (operation === "reload") return `await page.reload({waitUntil:"domcontentloaded",timeout:15000});${snapshot}`;
    if (operation === "click") return `await page.getByRole(${jsString(stringArg("role"))},{name:${jsString(stringArg("name"))},exact:true}).first().click({timeout:8000});${snapshot}`;
    if (operation === "fill") {
      const label = stringArg("label"), value = stringArg("value");
      if (SENSITIVE.test(label)) throw new Error("密码、验证码、令牌和密钥需由用户自行输入，LFAA 不代填或读取。");
      return `const target=page.getByRole("textbox",{name:${jsString(label)},exact:true}).first();const type=await target.getAttribute("type",{timeout:8000}).catch(()=>null);if(type==="password"||/password|secret|token|api[\\s_-]?key|验证码|密码|密钥|令牌/iu.test(${jsString(label)}))throw new Error("protected field");await target.fill(${jsString(value)},{timeout:8000});${snapshot}`;
    }
    if (operation === "type-text") return `await page.keyboard.insertText(${jsString(stringArg("text"))});${snapshot}`;
    if (operation === "press-key") return `await page.keyboard.press(${jsString(stringArg("key"))});${snapshot}`;
    if (operation === "scroll") return `await page.mouse.wheel(0,${stringArg("direction") === "down" ? 1 : -1}*${Number(args.amount) || 0});${snapshot}`;
    if (operation === "clickAt") return `await page.mouse.click(${Number(args.x) || 0},${Number(args.y) || 0});${snapshot}`;
    if (operation === "dragAt") {
      const startX = Number(args.x), startY = Number(args.y);
      const points = Array.isArray(args.points) ? args.points as Array<Record<string, unknown>> : [];
      if (!Number.isFinite(startX) || !Number.isFinite(startY) || points.length < 1 || points.length > 128) throw new Error("网页拖动路径无效。");
      let totalDelay = 0;
      const moves = points.map(point => {
        const x = Number(point.x), y = Number(point.y), delayMs = Number(point.delayMs);
        if (![x, y, delayMs].every(Number.isFinite) || x < 0 || y < 0 || x > 4096 || y > 4096 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 1000) throw new Error("网页拖动路径点无效。");
        totalDelay += delayMs;
        return `${delayMs ? `await page.waitForTimeout(${delayMs});` : ""}await page.mouse.move(${x},${y});`;
      }).join("");
      if (totalDelay > 15_000) throw new Error("网页拖动路径超出时长限制。");
      return `await page.mouse.move(${startX},${startY});await page.mouse.down();try{${moves}}finally{await page.mouse.up();}${snapshot}`;
    }
    throw new Error("Tabbit 浏览器动作不受支持。");
  }

  private async getSession(ownerId: string, sourceSessionId: string, signal?: AbortSignal): Promise<TabbitSession> {
    signal?.throwIfAborted();
    if (!this.isAvailable()) throw new Error("未发现当前账户可用的 Tabbit LocalAgent 稳定启动器。");
    if (!sourceSessionId || sourceSessionId.length > 160) throw new Error("浏览器会话必须绑定当前 LFAA Session。");
    const key = sessionKey(ownerId, sourceSessionId), existingId = this.sessionIds.get(key), existing = existingId ? this.sessions.get(existingId) : undefined;
    if (existing) { signal?.throwIfAborted(); return existing; }
    if (this.sessions.size >= 8) throw new Error("Tabbit 浏览器连接达到当前 Host 并发上限；先关闭不再使用的浏览器会话。");
    const id = randomUUID();
    const taskName = `LFAA Browser ${createHash("sha256").update(key).digest("hex").slice(0, 8)}`;
    const pending = this.startSession(id, ownerId, sourceSessionId, taskName);
    this.sessions.set(id, pending);
    this.sessionIds.set(key, id);
    try {
      const session = await pending;
      if (signal?.aborted) { void this.dispose(session); signal.throwIfAborted(); }
      return session;
    } catch (error) { this.sessions.delete(id); this.sessionIds.delete(key); throw error; }
  }

  private async startSession(id: string, ownerId: string, sourceSessionId: string, taskName: string): Promise<TabbitSession> {
    const path = launcherPath();
    if (!path) throw new Error("Tabbit LocalAgent 仅支持当前 Windows/macOS 本机账户。");
    const child = spawn(path, ["persistent"], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true, shell: false });
    const output = createInterface({ input: child.stdout, crlfDelay: Infinity });
    const session: TabbitSession = { id, ownerId, sourceSessionId, taskName, child, output, queuedLines: [], waiters: [], closed: false, closing: false, initialized: false, tabInventory: null, lastUsedAt: Date.now(), revision: 0, pageFingerprint: "", pageUrl: "", pageTitle: "", snapshot: null, operationTail: Promise.resolve(), requestCounter: 0 };
    output.on("line", line => {
      if (Buffer.byteLength(line, "utf8") > MAX_LINE_BYTES) { this.failSession(session, new Error("Tabbit 浏览器回执超过 LFAA 接收上限。")); return; }
      const waiter = session.waiters.shift();
      if (waiter) { clearTimeout(waiter.timer); waiter.resolve(line); }
      else if (session.queuedLines.length < 4) session.queuedLines.push(line);
      else this.failSession(session, new Error("Tabbit 浏览器产生了未请求的额外回执。"));
    });
    output.on("close", () => this.failSession(session, new Error("Tabbit 浏览器连接已关闭。")));
    child.on("error", () => this.failSession(session, new Error("Tabbit LocalAgent 稳定启动器无法启动。")));
    child.on("exit", () => this.failSession(session, new Error("Tabbit 浏览器连接已退出。")));
    child.stderr.on("data", () => { /* CLI stderr 可能含本地运行上下文；不保存、不输出。 */ });
    return session;
  }

  private async sendFrame(session: TabbitSession, frame: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (session.closed || session.child.exitCode !== null) throw new Error("Tabbit 浏览器连接不可用；请重新选择 Tabbit 提供方。");
    const line = `${JSON.stringify(frame)}\n`;
    if (Buffer.byteLength(line, "utf8") > 32 * 1024) throw new Error("Tabbit 浏览器请求超过 LFAA 长度限制。");
    await new Promise<void>((resolve, reject) => session.child.stdin.write(line, error => error ? reject(new Error("Tabbit 浏览器请求无法写入。")) : resolve()));
    let responseLine = session.queuedLines.shift();
    if (!responseLine) responseLine = await this.readLine(session);
    let receipt: unknown;
    try { receipt = JSON.parse(responseLine) as unknown; } catch { throw new Error("Tabbit 浏览器返回了无法识别的回执。"); }
    let result = this.asRecord(receipt);
    if (result.status === "queued") {
      const requestId = frame.requestId;
      const inspect = await this.sendFrame(session, { op: "inspect", requestId, waitMs: Math.min(30_000, FRAME_TIMEOUT_MS - 1000) });
      result = inspect;
    }
    const status = typeof result.status === "string" ? result.status.toLowerCase() : "";
    if (["failed", "failure", "error", "blocked", "denied", "aborted"].includes(status) || result.ok === false) {
      const code = typeof result.code === "string" && /^[A-Z0-9_-]{1,64}$/u.test(result.code) ? ` (${result.code})` : "";
      throw new Error(`Tabbit 浏览器操作未完成${code}。`);
    }
    this.touch(session);
    return result;
  }

  private async readLine(session: TabbitSession): Promise<string> {
    if (session.closed) throw new Error("Tabbit 浏览器连接已关闭。");
    return new Promise<string>((resolve, reject) => {
      const waiter: LineWaiter = { resolve, reject, timer: setTimeout(() => {
        this.failSession(session, new Error("Tabbit 浏览器在规定时间内没有返回结果。"));
        reject(new Error("Tabbit 浏览器在规定时间内没有返回结果。"));
      }, FRAME_TIMEOUT_MS) };
      session.waiters.push(waiter);
    });
  }

  private receiptValue(receipt: Record<string, unknown>): unknown {
    const result = receipt.result;
    if (result && typeof result === "object" && !Array.isArray(result) && "value" in result) return (result as Record<string, unknown>).value;
    return result ?? receipt.value ?? receipt;
  }

  private readTabInventory(value: unknown): TabbitTabSummary[] {
    const object = this.asRecord(value);
    const list = Array.isArray(value) ? value : Array.isArray(object.tabs) ? object.tabs : [];
    return list.slice(0, 64).flatMap(item => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const tab = item as Record<string, unknown>;
      const id = typeof tab.tabId === "number" ? tab.tabId : Number(tab.tabId);
      if (!Number.isSafeInteger(id) || id < 0) return [];
      let url = typeof tab.url === "string" ? tab.url.slice(0, 2048) : "";
      try { const parsed = new URL(url); parsed.username = ""; parsed.password = ""; parsed.search = ""; parsed.hash = ""; url = parsed.toString(); } catch { url = ""; }
      return [{ tabId: id, title: typeof tab.title === "string" ? tab.title.replace(/[\u0000-\u001f\u007f]/gu, " ").slice(0, 300) : "", url, active: tab.active === true, state: typeof tab.state === "string" ? tab.state.slice(0, 24) : "unknown" }];
    });
  }

  private saveSnapshot(session: TabbitSession, value: unknown): BrowserSnapshot {
    const record = this.asRecord(value);
    if (typeof record.url !== "string" || typeof record.pageText !== "string") throw new Error("Tabbit Browser 未返回有效页面快照。");
    let screenshot: BrowserSnapshot["screenshot"] = null;
    if (typeof record.screenshotBase64 === "string" && record.screenshotBase64.length > 0 && record.screenshotBase64.length <= Math.ceil(MAX_SCREENSHOT_BYTES * 4 / 3)
      && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(record.screenshotBase64)) {
      screenshot = { mimeType: "image/jpeg", dataBase64: record.screenshotBase64, width: Math.min(Number(record.screenshotWidth) || 1280, 1280), height: Math.min(Number(record.screenshotHeight) || 800, 2400) };
    }
    const controls = Array.isArray(record.controls) ? record.controls.slice(0, MAX_CONTROLS).flatMap(item => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const control = item as Record<string, unknown>;
      return [{ role: typeof control.role === "string" ? control.role.slice(0, 40) : "", name: typeof control.name === "string" ? control.name.slice(0, 160) : "", ...(typeof control.type === "string" ? { type: control.type.slice(0, 40) } : {}), disabled: control.disabled === true }];
    }) : [];
    const tabs = Array.isArray(record.tabs) ? record.tabs.slice(0, MAX_TABS).flatMap((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const tab = item as Record<string, unknown>;
      return [{ id: typeof tab.id === "string" ? tab.id.slice(0, 24) : String(index), title: typeof tab.title === "string" ? tab.title.slice(0, 300) : "", url: typeof tab.url === "string" ? tab.url.slice(0, 2048) : "", active: tab.active === true }];
    }) : [];
    const url = record.url.slice(0, 2048), title = typeof record.title === "string" ? record.title.slice(0, 300) : "";
    const fingerprint = `${title}\0${url}\0${record.pageText.slice(0, 4000)}`;
    if (fingerprint !== session.pageFingerprint || url !== session.pageUrl || title !== session.pageTitle) session.revision += 1;
    session.pageFingerprint = fingerprint;
    session.pageUrl = url;
    session.pageTitle = title;
    this.touch(session);
    const snapshot: BrowserSnapshot = { sessionId: session.id, providerId: "tabbit-personal", revision: session.revision, url, title, loading: record.loading === true, pageText: record.pageText.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ").slice(0, MAX_TEXT), controls, tabs, screenshot };
    session.snapshot = snapshot;
    return structuredClone(snapshot);
  }

  private nextRequestId(session: TabbitSession): string { return `r${++session.requestCounter}`; }
  private asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  private touch(session: TabbitSession): void { session.lastUsedAt = Date.now(); }

  private async exclusive<T>(session: TabbitSession, operation: () => Promise<T>, signal?: AbortSignal, allowClosing = false): Promise<T> {
    signal?.throwIfAborted();
    const pending = session.operationTail.then(async () => {
      if (session.closed || session.closing && !allowClosing) throw new Error("Tabbit 浏览器连接已关闭。");
      signal?.throwIfAborted();
      return operation();
    });
    session.operationTail = pending.then(() => undefined, () => undefined);
    if (!signal) return pending;
    let abortListener: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      abortListener = () => {
        session.closing = true;
        reject(new Error("Tabbit 浏览器操作已取消；正在结束当前受限操作并释放连接。"));
        void session.operationTail.then(() => this.dispose(session), () => this.dispose(session)).catch(() => undefined);
      };
      signal.addEventListener("abort", abortListener, { once: true });
    });
    try { return await Promise.race([pending, aborted]); }
    finally { if (abortListener) signal.removeEventListener("abort", abortListener); }
  }

  private failSession(session: TabbitSession, error: Error): void {
    if (session.closed) return;
    session.closed = true;
    this.sessions.delete(session.id);
    this.sessionIds.delete(sessionKey(session.ownerId, session.sourceSessionId));
    for (const waiter of session.waiters.splice(0)) { clearTimeout(waiter.timer); waiter.reject(error); }
    session.output.close();
    if (session.child.exitCode === null) session.child.kill();
  }

  private async dispose(session: TabbitSession | null): Promise<void> {
    if (!session || session.closed) return;
    session.closing = true;
    try {
      await this.exclusive(session, async () => {
        await this.sendFrame(session, { op: "finish" }).catch(() => undefined);
        session.child.stdin.end();
      }, undefined, true);
    } finally {
      const key = sessionKey(session.ownerId, session.sourceSessionId);
      this.sessionIds.delete(key);
      this.sessions.delete(session.id);
      if (session.child.exitCode === null) {
        const timer = setTimeout(() => { if (!session.closed && session.child.exitCode === null) this.failSession(session, new Error("Tabbit 浏览器会话已结束。")); }, 1500);
        timer.unref?.();
      }
    }
  }
}

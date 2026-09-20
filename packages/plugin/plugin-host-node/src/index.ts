/**
 * 文件：packages/plugin/plugin-host-node/src/index.ts
 * 作用：实现 DSH 风格的 LFAA 插件 Profile 包管理事务。
 * 负责：独立 Profile、spec inspection、pnpm add/remove、失败回滚、build-script 精确审批、启用状态持久化、取消。
 * 不负责：React UI、Tool 执行、第三方插件代码 import、Secret 值读取。
 * 状态归属：用户运行时 Home 中的 Profile package.json/pnpm-lock.yaml 是已安装包事实；lfaa.profile.enabled 是启用事实。
 * 修改注意事项：任何安装写入都必须位于 Profile 锁内；日志必须先脱敏；失败时不得污染 LFAA 根依赖。
 */
import { createHash, randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access, mkdir, mkdtemp, open, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { redactCredentialText } from "@lfaa/credentials";
import { resolveLfaaHomePaths } from "@lfaa/home-paths";
import {
  validatePluginManifest,
  type InstalledPluginBundle,
  type ParsedPluginInstallSpec,
  type PluginInstallFailureKind,
  type PluginInstallOutcome,
  type PluginInstallProgress,
  type PluginPackageHostPort,
  type PluginSpecInspection,
} from "@lfaa/plugin-runtime";
import type { LfaaPluginManifest } from "@lfaa/plugin-sdk";

const PROFILE_MANIFEST = "package.json";
const PROFILE_LOCKFILE = "pnpm-lock.yaml";
const PROFILE_WORKSPACE = "pnpm-workspace.yaml";
const MAX_DIAGNOSTIC_BYTES = 256 * 1024;
const INSPECT_TIMEOUT_MS = 30_000;
const INSTALL_TIMEOUT_MS = 10 * 60_000;
const LOCK_WAIT_MS = 120_000;
const STALE_LOCK_MS = 30 * 60_000;

interface PluginProfileManifest {
  name: string;
  private: true;
  version: string;
  dependencies?: Record<string, string>;
  lfaa?: { profile?: { enabled?: string[] } };
}

interface PackageDocument {
  name?: string;
  version?: string;
  description?: string;
  lfaa?: { plugin?: unknown };
  [key: string]: unknown;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b, "en"));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

function inspectionFingerprint(packageName: string, packageVersion: string, manifest: LfaaPluginManifest): string {
  return createHash("sha256").update(canonicalJson({ packageName, packageVersion, manifest }), "utf8").digest("hex");
}

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
  cause?: unknown;
}

interface InstallControl {
  child: ChildProcessWithoutNullStreams | undefined;
  cancelRequested: boolean;
  settled: Promise<void>;
  resolveSettled: () => void;
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function safeEnv(): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const key of [
    "PATH", "Path", "PATHEXT", "SystemRoot", "WINDIR", "COMSPEC", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA",
    "HOME", "PNPM_HOME", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy",
  ]) if (process.env[key] !== undefined) result[key] = process.env[key];
  return result;
}

/** Windows 的 pnpm 常见为 .cmd；任何进入 cmd.exe 的动态参数先拒绝命令解释器元字符。 */
function assertSafePackageManagerArgs(args: readonly string[]): void {
  if (args.some((arg) => /[\r\n\0]/.test(arg))) throw new Error("包管理参数包含控制字符，已拒绝执行。");
  if (process.platform === "win32" && args.some((arg) => /[&|<>^%!"]/u.test(arg))) {
    throw new Error("Windows 插件来源包含命令解释器元字符；请使用不含 &, |, <, >, ^, %, !, \" 的包名、Git 地址或路径。");
  }
}

function packageManagerSpawn(command: string, args: readonly string[], options: Parameters<typeof spawn>[2]) {
  assertSafePackageManagerArgs(args);
  if (process.platform !== "win32") return spawn(command, [...args], options);
  const commandLine = [command, ...args].map((item) => `"${item}"`).join(" ");
  return spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/v:off", "/c", commandLine], { ...options, shell: false });
}

function pluginWorkspaceYaml(): string {
  return [
    "packages:",
    '  - "."',
    "strictDepBuilds: true",
    "allowBuilds: {}",
    "",
  ].join("\n");
}

function initialProfileManifest(): PluginProfileManifest {
  return { name: "@lfaa/local-plugin-profile", private: true, version: "1.0.0", dependencies: {}, lfaa: { profile: { enabled: [] } } };
}

async function exists(file: string): Promise<boolean> {
  try { await access(file, fsConstants.F_OK); return true; } catch { return false; }
}

async function writeText(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, text, { encoding: "utf8", mode: 0o600 });
}

async function readOptional(file: string): Promise<string | null> {
  try { return await readFile(file, "utf8"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function parseManifestDocument(document: PackageDocument, origin: string): { packageName: string; packageVersion: string; description?: string; inspectionFingerprint: string; manifest: LfaaPluginManifest } {
  if (typeof document.name !== "string" || !document.name) throw new Error(`${origin} 缺少 package name。`);
  if (typeof document.version !== "string" || !document.version) throw new Error(`${origin} 缺少 package version。`);
  const raw = document.lfaa?.plugin;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${origin} 未声明 package.json#lfaa.plugin。`);
  const manifest = validatePluginManifest(raw as LfaaPluginManifest);
  if (manifest.pluginVersion !== document.version) throw new Error(`${origin} 的 lfaa.plugin.pluginVersion 必须与 package version 一致。`);
  return {
    packageName: document.name,
    packageVersion: document.version,
    ...(typeof document.description === "string" && document.description ? { description: document.description } : {}),
    inspectionFingerprint: inspectionFingerprint(document.name, document.version, manifest),
    manifest,
  };
}

function failureKind(result: CommandResult): PluginInstallFailureKind {
  if (result.cancelled) return "cancelled";
  if (result.timedOut) return "timeout";
  const text = `${result.stdout}\n${result.stderr}`;
  if ((result.cause as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return "package-manager-missing";
  if (/ERR_PNPM_IGNORED_BUILDS|Ignored build scripts|set this to true or false/i.test(text)) return "build-blocked";
  if (/ERR_PNPM_FETCH_404|\bE404\b|404 Not Found|Not Found - GET/i.test(text)) return "not-found";
  if (/ERR_PNPM_NO_MATCHING_VERSION|\bETARGET\b|No matching version/i.test(text)) return "no-matching-version";
  if (/\bENOSPC\b|no space left on device/i.test(text)) return "disk-full";
  if (/\bEACCES\b|\bEPERM\b|permission denied/i.test(text)) return "permission";
  if (/ERR_PNPM_TARBALL_INTEGRITY|ERR_PNPM_BAD_TARBALL_SIZE|\bEINTEGRITY\b/i.test(text)) return "integrity";
  if (/\bENOTFOUND\b|\bECONNRESET\b|\bETIMEDOUT\b|\bECONNREFUSED\b|\bEAI_AGAIN\b|ERR_PNPM_META_FETCH_FAIL|ERR_PNPM_FETCH_5\d\d|socket hang up|Could not resolve host/i.test(text)) return "network";
  return "unknown";
}

function trimDiagnostic(result: CommandResult): string {
  return redactCredentialText(`${result.stderr}\n${result.stdout}`.trim(), 12_000);
}

const SAFE_BUILD_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;

/** Plugin Profile 的 build policy 只接受 LFAA 生成的窄格式；不解析/执行锚点、别名、通配符或全局放行。 */
function assertSafePluginWorkspacePolicy(text: string): void {
  if (!/^strictDepBuilds:\s*true\s*$/m.test(text)) throw new Error("Plugin Profile 必须保持 strictDepBuilds: true。");
  if (/^dangerouslyAllowAllBuilds\s*:/mi.test(text)) throw new Error("Plugin Profile 禁止 dangerouslyAllowAllBuilds。");
  if (/(?:^|\s)[&*][A-Za-z0-9_-]+/m.test(text)) throw new Error("Plugin Profile allowBuilds 禁止 YAML anchor/alias。");

  const lines = text.split(/\r?\n/);
  let inBuilds = false;
  for (const line of lines) {
    if (/^allowBuilds:\s*(?:\{\})?\s*$/.test(line)) { inBuilds = true; continue; }
    if (!inBuilds) continue;
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (/^\S/.test(line)) { inBuilds = false; continue; }
    const match = line.match(/^\s{2,}["']?([^"':]+)["']?\s*:\s*(true|false|["']?set this to true or false["']?)\s*$/i);
    if (!match) throw new Error("Plugin Profile allowBuilds 包含不受支持的 YAML 结构。");
    const name = match?.[1]?.trim();
    if (!name || !SAFE_BUILD_NAME.test(name) || /[*?]/.test(name)) throw new Error(`Plugin Profile build approval 包名无效：${name ?? "<missing>"}`);
  }
}

function parsePendingBuilds(text: string): string[] {
  assertSafePluginWorkspacePolicy(text);
  const result: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s{2,}["']?([^"':]+)["']?\s*:\s*["']?set this to true or false["']?\s*$/i);
    const name = match?.[1]?.trim();
    if (name && !name.includes("*") && !name.includes("?")) result.push(name);
  }
  return [...new Set(result)];
}

function approvePendingBuilds(text: string, names: readonly string[]): string {
  if (!names.length) return text;
  const pending = parsePendingBuilds(text);
  for (const name of names) if (!pending.includes(name)) throw new Error(`构建脚本批准已过期：${name}`);
  let next = text;
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^(\\s{2,})["']?${escaped}["']?\\s*:\\s*["']?set this to true or false["']?\\s*$`, "m");
    next = next.replace(pattern, `$1"${name}": true`);
  }
  return next;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function ensureProfile(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const packageFile = path.join(dir, PROFILE_MANIFEST);
  const workspaceFile = path.join(dir, PROFILE_WORKSPACE);
  if (!(await exists(packageFile))) await writeText(packageFile, `${JSON.stringify(initialProfileManifest(), undefined, 2)}\n`);
  if (!(await exists(workspaceFile))) await writeText(workspaceFile, pluginWorkspaceYaml());
}

/** Profile 锁已由调用者持有时更新启用列表，禁止在事务内部再次获取同一把锁。 */
async function writeEnabledStateUnlocked(dir: string, packageName: string, enabled: boolean): Promise<void> {
  const packageFile = path.join(dir, PROFILE_MANIFEST);
  const profile = await readJson<PluginProfileManifest>(packageFile);
  if (!Object.hasOwn(profile.dependencies ?? {}, packageName)) throw new Error(`插件未安装：${packageName}`);
  const names = new Set(profile.lfaa?.profile?.enabled ?? []);
  if (enabled) names.add(packageName); else names.delete(packageName);
  profile.lfaa = { ...profile.lfaa, profile: { ...profile.lfaa?.profile, enabled: [...names].sort() } };
  await writeText(packageFile, `${JSON.stringify(profile, undefined, 2)}\n`);
}

async function withProfileLock<T>(dir: string, operation: () => Promise<T>): Promise<T> {
  await ensureProfile(dir);
  const lockFile = path.join(dir, ".plugin-profile.lock");
  const deadline = Date.now() + LOCK_WAIT_MS;
  let handle;
  while (!handle) {
    try {
      handle = await open(lockFile, "wx", 0o600);
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const info = await stat(lockFile);
        if (Date.now() - info.mtimeMs > STALE_LOCK_MS) {
          // 只清理“足够旧且 owner PID 已不存在”的锁；长安装不得被第二个进程误判成 stale。
          const rawOwner = await readOptional(lockFile);
          const pid = rawOwner ? Number((JSON.parse(rawOwner) as { pid?: unknown }).pid) : Number.NaN;
          let ownerAlive = Number.isInteger(pid) && pid > 0;
          if (ownerAlive) {
            try { process.kill(pid, 0); } catch { ownerAlive = false; }
          }
          if (!ownerAlive) { await unlink(lockFile); continue; }
        }
      } catch { /* another process may have released or rewritten it */ }
      if (Date.now() >= deadline) throw new Error("插件 Profile 正被另一个 LFAA 进程修改，请稍后重试。");
      await sleep(80);
    }
  }
  try { return await operation(); }
  finally {
    await handle.close().catch(() => undefined);
    await unlink(lockFile).catch(() => undefined);
  }
}

export interface NodePluginPackageHostOptions {
  readonly projectRoot: string;
  readonly profileDir?: string;
  readonly pnpmCommand?: string;
}

export class NodePluginPackageHost implements PluginPackageHostPort {
  readonly #projectRoot: string;
  readonly #homeRoot: string;
  readonly #profileDir: string;
  readonly #pnpmCommand: string;
  readonly #installs = new Map<string, InstallControl>();

  constructor(options: NodePluginPackageHostOptions) {
    this.#projectRoot = path.resolve(options.projectRoot);
    const home = resolveLfaaHomePaths();
    this.#homeRoot = home.root;
    this.#profileDir = path.resolve(options.profileDir ?? path.join(home.plugins, "profile"));
    this.#pnpmCommand = options.pnpmCommand ?? "pnpm";
  }

  get profileDir(): string { return this.#profileDir; }

  async #runPnpm(
    args: readonly string[],
    cwd: string,
    options: { timeoutMs: number; control?: InstallControl; signal?: AbortSignal; onOutput?: (text: string) => void },
  ): Promise<CommandResult> {
    let child: ChildProcessWithoutNullStreams | undefined;
    let timedOut = false;
    let cancelled = false;
    let stdout: Buffer = Buffer.alloc(0);
    let stderr: Buffer = Buffer.alloc(0);
    const controller = new AbortController();
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs);
    const onExternalAbort = () => { cancelled = true; controller.abort(); };
    options.signal?.addEventListener("abort", onExternalAbort, { once: true });
    try {
      return await new Promise<CommandResult>((resolve) => {
        try {
          child = packageManagerSpawn(this.#pnpmCommand, args, {
            cwd,
            env: safeEnv(),
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
            signal: controller.signal,
          }) as ChildProcessWithoutNullStreams;
          if (options.control) options.control.child = child;
        } catch (cause) {
          resolve({ exitCode: 127, stdout: "", stderr: "", timedOut, cancelled, cause });
          return;
        }

        const append = (current: Buffer, chunk: Buffer): Buffer => {
          const next = Buffer.concat([current, chunk]);
          return next.length > MAX_DIAGNOSTIC_BYTES ? next.subarray(next.length - MAX_DIAGNOSTIC_BYTES) : next;
        };
        child.stdout.on("data", (chunk: Buffer) => {
          stdout = append(stdout, chunk);
          options.onOutput?.(redactCredentialText(chunk.toString("utf8"), 16_384));
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr = append(stderr, chunk);
          options.onOutput?.(redactCredentialText(chunk.toString("utf8"), 16_384));
        });
        child.on("error", (cause) => resolve({ exitCode: 127, stdout: stdout.toString("utf8"), stderr: stderr.toString("utf8"), timedOut, cancelled, cause }));
        child.on("close", (code) => resolve({
          exitCode: code ?? 1,
          stdout: stdout.toString("utf8"),
          stderr: stderr.toString("utf8"),
          timedOut,
          cancelled: cancelled || options.control?.cancelRequested === true,
        }));
      });
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onExternalAbort);
      if (options.control) options.control.child = undefined;
    }
  }

  async #packageDocumentFromPath(directory: string): Promise<PackageDocument> {
    return readJson<PackageDocument>(path.join(directory, "package.json"));
  }

  async #inspectWithStaging(spec: ParsedPluginInstallSpec, signal?: AbortSignal): Promise<PluginSpecInspection> {
    const tmpRoot = path.join(this.#homeRoot, "tmp");
    await mkdir(tmpRoot, { recursive: true, mode: 0o700 });
    const dir = await mkdtemp(path.join(tmpRoot, "plugin-inspect-"));
    try {
      await writeText(path.join(dir, PROFILE_MANIFEST), `${JSON.stringify({ name: "@lfaa/plugin-inspect", private: true, version: "1.0.0", dependencies: {} }, undefined, 2)}\n`);
      await writeText(path.join(dir, PROFILE_WORKSPACE), pluginWorkspaceYaml());
      const result = await this.#runPnpm(["add", spec.spec, "--save-exact", "--ignore-scripts"], dir, { timeoutMs: INSPECT_TIMEOUT_MS, ...(signal ? { signal } : {}) });
      if (result.exitCode !== 0) {
        const kind = failureKind(result);
        return { status: "refused", sourceKind: spec.kind, spec: spec.spec, problem: kind === "not-found" ? "not-found" : kind === "package-manager-missing" ? "package-manager-unavailable" : "inspection-failed", reason: trimDiagnostic(result) || "无法检查插件包。" };
      }
      const profile = await readJson<PluginProfileManifest>(path.join(dir, PROFILE_MANIFEST));
      const packageName = Object.keys(profile.dependencies ?? {})[0];
      if (!packageName) return { status: "refused", sourceKind: spec.kind, spec: spec.spec, problem: "inspection-failed", reason: "检查完成但没有解析出安装包名。" };
      const document = await this.#packageDocumentFromPath(path.join(dir, "node_modules", ...packageName.split("/")));
      try {
        const parsed = parseManifestDocument(document, packageName);
        return { status: "accepted", sourceKind: spec.kind, spec: spec.spec, ...parsed };
      } catch (error) {
        return { status: "refused", sourceKind: spec.kind, spec: spec.spec, problem: "not-lfaa-plugin", reason: error instanceof Error ? error.message : "不是 LFAA 插件包。" };
      }
    } finally { await rm(dir, { recursive: true, force: true }).catch(() => undefined); }
  }

  async inspect(spec: ParsedPluginInstallSpec, signal?: AbortSignal): Promise<PluginSpecInspection> {
    await ensureProfile(this.#profileDir);
    if (spec.kind === "path") {
      try {
        const document = await this.#packageDocumentFromPath(spec.path);
        const parsed = parseManifestDocument(document, spec.path);
        const current = await this.listInstalled();
        if (current.some((item) => item.packageName === parsed.packageName)) return { status: "refused", sourceKind: spec.kind, spec: spec.spec, problem: "already-installed", reason: `${parsed.packageName} 已安装。` };
        return { status: "accepted", sourceKind: spec.kind, spec: spec.spec, ...parsed };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        return { status: "refused", sourceKind: spec.kind, spec: spec.spec, problem: code === "ENOENT" ? "not-found" : "not-lfaa-plugin", reason: redactCredentialText(error instanceof Error ? error.message : "无法读取本地插件。", 800) };
      }
    }

    if (spec.kind === "registry") {
      const result = await this.#runPnpm(["view", spec.spec, "name", "version", "description", "lfaa", "--json"], this.#profileDir, { timeoutMs: INSPECT_TIMEOUT_MS, ...(signal ? { signal } : {}) });
      if (result.exitCode !== 0) {
        const kind = failureKind(result);
        return { status: "refused", sourceKind: spec.kind, spec: spec.spec, problem: kind === "not-found" || kind === "no-matching-version" ? "not-found" : kind === "package-manager-missing" ? "package-manager-unavailable" : "inspection-failed", reason: trimDiagnostic(result) || "无法查询插件注册表。" };
      }
      try {
        const raw = JSON.parse(result.stdout) as PackageDocument | PackageDocument[];
        const document = Array.isArray(raw) ? raw.at(-1) : raw;
        if (!document) throw new Error("Registry 没有返回 package metadata。");
        const parsed = parseManifestDocument(document, spec.spec);
        const current = await this.listInstalled();
        if (current.some((item) => item.packageName === parsed.packageName)) return { status: "refused", sourceKind: spec.kind, spec: spec.spec, problem: "already-installed", reason: `${parsed.packageName} 已安装。` };
        return { status: "accepted", sourceKind: spec.kind, spec: spec.spec, ...parsed };
      } catch (error) {
        return { status: "refused", sourceKind: spec.kind, spec: spec.spec, problem: "not-lfaa-plugin", reason: redactCredentialText(error instanceof Error ? error.message : "Registry package 不是 LFAA 插件。", 800) };
      }
    }

    return this.#inspectWithStaging(spec, signal);
  }

  async listInstalled(): Promise<readonly InstalledPluginBundle[]> {
    await ensureProfile(this.#profileDir);
    const profile = await readJson<PluginProfileManifest>(path.join(this.#profileDir, PROFILE_MANIFEST));
    const enabled = new Set(profile.lfaa?.profile?.enabled ?? []);
    const bundles: InstalledPluginBundle[] = [];
    for (const packageName of Object.keys(profile.dependencies ?? {})) {
      try {
        const document = await this.#packageDocumentFromPath(path.join(this.#profileDir, "node_modules", ...packageName.split("/")));
        const parsed = parseManifestDocument(document, packageName);
        bundles.push({ packageName, packageVersion: parsed.packageVersion, enabled: enabled.has(packageName), manifest: parsed.manifest });
      } catch { /* 非 LFAA 依赖不进入 Plugin Inventory */ }
    }
    return bundles.sort((a, b) => a.packageName.localeCompare(b.packageName, "en"));
  }

  async install(
    inspection: Extract<PluginSpecInspection, { status: "accepted" }>,
    options: { readonly requestId: string; readonly approvedBuilds?: readonly string[]; readonly onProgress?: (event: PluginInstallProgress) => void },
  ): Promise<PluginInstallOutcome> {
    if (this.#installs.has(options.requestId)) throw new Error("重复的插件安装 requestId。");
    let resolveSettled!: () => void;
    const control: InstallControl = { child: undefined, cancelRequested: false, settled: new Promise<void>((resolve) => { resolveSettled = resolve; }), resolveSettled: () => resolveSettled() };
    this.#installs.set(options.requestId, control);
    const emit = (phase: PluginInstallProgress["phase"], message?: string) => options.onProgress?.({ requestId: options.requestId, phase, ...(message ? { message } : {}) });

    try {
      return await withProfileLock(this.#profileDir, async () => {
        const packageFile = path.join(this.#profileDir, PROFILE_MANIFEST);
        const lockFile = path.join(this.#profileDir, PROFILE_LOCKFILE);
        const workspaceFile = path.join(this.#profileDir, PROFILE_WORKSPACE);
        const beforePackage = await readOptional(packageFile);
        const beforeLock = await readOptional(lockFile);
        const beforeWorkspace = await readOptional(workspaceFile) ?? pluginWorkspaceYaml();
        assertSafePluginWorkspacePolicy(beforeWorkspace);
        const logDir = path.join(this.#homeRoot, "logs", "plugin-manager");
        await mkdir(logDir, { recursive: true, mode: 0o700 });
        const logPath = path.join(logDir, `install-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.log`);

        const rollback = async () => {
          emit("rolling-back");
          if (beforePackage === null) await rm(packageFile, { force: true }); else await writeText(packageFile, beforePackage);
          if (beforeLock === null) await rm(lockFile, { force: true }); else await writeText(lockFile, beforeLock);
          // workspace policy is intentionally not rolled back: exact build approvals/pending decisions belong to this local profile.
        };

        try {
          if (options.approvedBuilds?.length) {
            const currentPolicy = await readOptional(workspaceFile) ?? beforeWorkspace;
            await writeText(workspaceFile, approvePendingBuilds(currentPolicy, options.approvedBuilds));
          }
          emit("installing");
          let logText = "";
          // Registry inspection 已解析到精确版本；安装时固定该版本，避免 inspect/latest 与 commit/latest 漂移。
          const installSpec = inspection.sourceKind === "registry"
            ? `${inspection.packageName}@${inspection.packageVersion}`
            : inspection.spec;
          const result = await this.#runPnpm(["add", installSpec, "--save-exact"], this.#profileDir, {
            timeoutMs: INSTALL_TIMEOUT_MS,
            control,
            onOutput: (text) => { if (logText.length < 512_000) logText += text; },
          });
          await writeText(logPath, redactCredentialText(logText || `${result.stderr}\n${result.stdout}`, 512_000));
          if (result.exitCode !== 0 || control.cancelRequested) {
            const kind = control.cancelRequested ? "cancelled" : failureKind(result);
            const pendingBuilds = parsePendingBuilds(await readOptional(workspaceFile) ?? "");
            await rollback();
            return {
              status: kind === "cancelled" ? "cancelled" : "failed",
              failureKind: kind,
              diagnostic: trimDiagnostic(result) || (kind === "cancelled" ? "安装已取消。" : "插件安装失败。"),
              ...(pendingBuilds.length ? { pendingBuilds } : {}),
              logPath,
            };
          }

          emit("validating");
          const installed = (await this.listInstalled()).find((item) => item.packageName === inspection.packageName);
          if (!installed) {
            await rollback();
            return { status: "failed", failureKind: "invalid-installed-manifest", diagnostic: "pnpm 完成后没有发现可用的 LFAA 插件 Manifest。", logPath };
          }
          const committedFingerprint = inspectionFingerprint(installed.packageName, installed.packageVersion, installed.manifest);
          if (installed.manifest.pluginId !== inspection.manifest.pluginId
            || installed.packageVersion !== inspection.packageVersion
            || committedFingerprint !== inspection.inspectionFingerprint) {
            await rollback();
            return { status: "failed", failureKind: "invalid-installed-manifest", diagnostic: "安装后的包身份/能力声明与安装前 Inspection 不一致，已回滚 Profile。", logPath };
          }

          emit("committing");
          // 安装与启用分两步：新插件必须先保持 disabled，让用户看清能力/权限后再显式启用。
          // 这里已经持有 Profile 锁，绝不能调用会再次加锁的 setEnabled。
          await writeEnabledStateUnlocked(this.#profileDir, installed.packageName, false);
          const committed = (await this.listInstalled()).find((item) => item.packageName === installed.packageName) ?? { ...installed, enabled: false };
          emit("completed");
          return { status: "installed", bundle: committed, logPath };
        } catch (error) {
          await rollback().catch(() => undefined);
          return { status: control.cancelRequested ? "cancelled" : "failed", failureKind: control.cancelRequested ? "cancelled" : "unknown", diagnostic: redactCredentialText(error instanceof Error ? error.message : "插件安装失败。", 1200) };
        }
      });
    } finally {
      this.#installs.delete(options.requestId);
      control.resolveSettled();
    }
  }

  async setEnabled(packageName: string, enabled: boolean): Promise<InstalledPluginBundle> {
    return withProfileLock(this.#profileDir, async () => {
      await writeEnabledStateUnlocked(this.#profileDir, packageName, enabled);
      const bundle = (await this.listInstalled()).find((item) => item.packageName === packageName);
      if (!bundle) throw new Error(`插件 Manifest 不可用：${packageName}`);
      return bundle;
    });
  }

  async remove(packageName: string): Promise<void> {
    await withProfileLock(this.#profileDir, async () => {
      const packageFile = path.join(this.#profileDir, PROFILE_MANIFEST);
      const profile = await readJson<PluginProfileManifest>(packageFile);
      if (!Object.hasOwn(profile.dependencies ?? {}, packageName)) return;
      const enabled = new Set(profile.lfaa?.profile?.enabled ?? []);
      enabled.delete(packageName);
      profile.lfaa = { ...profile.lfaa, profile: { ...profile.lfaa?.profile, enabled: [...enabled].sort() } };
      await writeText(packageFile, `${JSON.stringify(profile, undefined, 2)}\n`);
      const result = await this.#runPnpm(["remove", packageName], this.#profileDir, { timeoutMs: INSTALL_TIMEOUT_MS });
      if (result.exitCode !== 0) throw new Error(trimDiagnostic(result) || `移除插件失败：${packageName}`);
    });
  }

  async cancel(requestId: string): Promise<void> {
    const control = this.#installs.get(requestId);
    if (!control) return;
    control.cancelRequested = true;
    const pid = control.child?.pid;
    if (control.child && !control.child.killed) {
      try { control.child.kill(); } catch { /* child may have just exited */ }
      if (process.platform === "win32" && pid) {
        try { spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch { /* best effort */ }
      }
    }
    await control.settled;
  }
}

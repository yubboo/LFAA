/**
 * 文件：openai-official-runtime.ts
 * 作用：为 ChatGPT 套餐认证 / Runtime 按需准备 OpenAI 官方 App Server 组件。
 * 负责：LFAA_HOME 隔离目录、官方 Release 资产下载与 SHA-256 校验、官方安装器兼容路径、可执行文件定位。
 * 不负责：读取 OAuth Token、解析官方私有认证文件、模型业务、Agent Loop、UI。
 * 状态归属：运行组件与官方认证状态均位于 LFAA_HOME/runtimes/openai-chatgpt；LFAA 只启动官方组件，不读取其中 Secret。
 * 对外接口：ensureOfficialOpenAiRuntime、officialOpenAiRuntimeCapability。
 * 关联文件：codex-app-server.ts、packages/util/home-paths、OpenAI 官方 releases.openai.com Codex/App Server 发行资产。
 * 修改注意事项：Windows 优先直接使用官方 codex-app-server 独立二进制，不要求用户安装全局 Codex CLI；固定资产必须校验 SHA-256。
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveLfaaHome } from "@lfaa/home-paths";

const OFFICIAL_RUNTIME_RELEASE = "0.154.0";
const OFFICIAL_RELEASE_BASE = `https://releases.openai.com/codex/releases/${OFFICIAL_RUNTIME_RELEASE}`;
const OFFICIAL_WINDOWS_INSTALLER = "https://chatgpt.com/codex/install.ps1";
const OFFICIAL_UNIX_INSTALLER = "https://chatgpt.com/codex/install.sh";
const PREPARE_TIMEOUT_MS = 8 * 60_000;
const INSTALLER_DOWNLOAD_TIMEOUT_MS = 45_000;
const ASSET_DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
const MAX_DIAGNOSTIC_CHARS = 1_500;

const WINDOWS_APP_SERVER_ASSETS = {
  x64: {
    name: "codex-app-server-x86_64-pc-windows-msvc.exe",
    sha256: "6fe58c486f793629317d73e66f804dcfad6561aa8ed9b2c9ff647f7843b4b350",
  },
  arm64: {
    name: "codex-app-server-aarch64-pc-windows-msvc.exe",
    sha256: "135890214554604778e76d75395f18731919f4e23269cf28514ebc039af6b0a3",
  },
} as const;

export interface OfficialOpenAiRuntime {
  readonly executable: string;
  readonly launchArgs: readonly string[];
  readonly codexHome: string;
  readonly release: string;
  readonly component: "app-server" | "standalone";
}

export interface OfficialOpenAiRuntimeCapability {
  readonly available: boolean;
  readonly reason?: string;
}

let preparePromise: Promise<OfficialOpenAiRuntime> | null = null;

function supportedPlatform(): boolean {
  return ["win32", "darwin", "linux"].includes(process.platform) && ["x64", "arm64"].includes(process.arch);
}

export function officialOpenAiRuntimeCapability(): OfficialOpenAiRuntimeCapability {
  if (supportedPlatform()) return { available: true };
  return { available: false, reason: `当前平台尚未被 OpenAI 官方运行组件支持：${process.platform}/${process.arch}` };
}

function runtimePaths(env: NodeJS.ProcessEnv = process.env) {
  const root = path.join(resolveLfaaHome(env), "runtimes", "openai-chatgpt");
  const codexHome = path.join(root, "official-runtime");
  const standaloneCurrent = path.join(codexHome, "packages", "standalone", "current");
  const visibleBin = path.join(root, "bin");
  const executableName = process.platform === "win32" ? "codex.exe" : "codex";
  const appServerBinary = path.join(root, "app-server", OFFICIAL_RUNTIME_RELEASE, process.platform === "win32" ? "codex-app-server.exe" : "codex-app-server");
  return {
    root,
    codexHome,
    visibleBin,
    appServerBinary,
    installer: path.join(root, process.platform === "win32" ? "install.ps1" : "install.sh"),
    standaloneCandidates: [
      path.join(standaloneCurrent, "bin", executableName),
      path.join(standaloneCurrent, executableName),
      path.join(visibleBin, executableName),
    ],
  };
}

async function exists(filePath: string): Promise<boolean> {
  try { return (await stat(filePath)).isFile(); }
  catch { return false; }
}

function redactDiagnostic(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[REDACTED]")
    .replace(/(?:sk|tp)-[A-Za-z0-9_-]{6,}/g, "[REDACTED]")
    .trim()
    .slice(-MAX_DIAGNOSTIC_CHARS);
}

async function runProcess(command: string, args: readonly string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}): Promise<{ stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout = `${stdout}${chunk}`.slice(-MAX_DIAGNOSTIC_CHARS); });
    child.stderr.on("data", (chunk: string) => { stderr = `${stderr}${chunk}`.slice(-MAX_DIAGNOSTIC_CHARS); });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`OpenAI 官方运行组件操作超时：${command}`));
    }, options.timeoutMs ?? PREPARE_TIMEOUT_MS);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`无法启动 OpenAI 官方运行组件准备进程：${error.message}`));
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`OpenAI 官方运行组件准备失败（code=${code ?? "null"}, signal=${signal ?? "null"}）。${redactDiagnostic(stderr || stdout) ? `\n${redactDiagnostic(stderr || stdout)}` : ""}`));
    });
  });
}

async function sha256(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function ensureWindowsAppServer(env: NodeJS.ProcessEnv = process.env): Promise<OfficialOpenAiRuntime> {
  const asset = WINDOWS_APP_SERVER_ASSETS[process.arch as keyof typeof WINDOWS_APP_SERVER_ASSETS];
  if (!asset) throw new Error(`当前 Windows 架构尚未提供 OpenAI 官方 App Server 资产：${process.arch}`);
  const paths = runtimePaths(env);
  await Promise.all([
    mkdir(path.dirname(paths.appServerBinary), { recursive: true }),
    mkdir(paths.codexHome, { recursive: true }),
  ]);
  if (await exists(paths.appServerBinary) && await sha256(paths.appServerBinary) === asset.sha256) {
    return { executable: paths.appServerBinary, launchArgs: [], codexHome: paths.codexHome, release: OFFICIAL_RUNTIME_RELEASE, component: "app-server" };
  }

  const response = await fetch(`${OFFICIAL_RELEASE_BASE}/${asset.name}`, { signal: AbortSignal.timeout(ASSET_DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`下载 OpenAI 官方 ChatGPT 账户运行组件失败（HTTP ${response.status}）。`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== asset.sha256) throw new Error("OpenAI 官方 ChatGPT 账户运行组件 SHA-256 校验失败，已停止使用该下载结果。");
  await writeFile(paths.appServerBinary, bytes);
  return { executable: paths.appServerBinary, launchArgs: [], codexHome: paths.codexHome, release: OFFICIAL_RUNTIME_RELEASE, component: "app-server" };
}

async function findStandaloneExecutable(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  for (const candidate of runtimePaths(env).standaloneCandidates) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

async function installedRelease(executable: string, codexHome: string): Promise<string | null> {
  try {
    const result = await runProcess(executable, ["--version"], {
      env: { ...process.env, CODEX_HOME: codexHome },
      timeoutMs: 15_000,
    });
    const match = `${result.stdout}\n${result.stderr}`.match(/([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)\s*$/m);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function downloadOfficialInstaller(installerPath: string): Promise<void> {
  const url = process.platform === "win32" ? OFFICIAL_WINDOWS_INSTALLER : OFFICIAL_UNIX_INSTALLER;
  const response = await fetch(url, { signal: AbortSignal.timeout(INSTALLER_DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`下载 OpenAI 官方运行组件安装器失败（HTTP ${response.status}）。`);
  const content = await response.text();
  const marker = process.platform === "win32" ? "releases.openai.com/codex" : "RELEASES_BASE_URL";
  if (content.length < 2_000 || !content.includes(marker)) throw new Error("OpenAI 官方安装器响应校验失败，已停止执行。请检查网络或稍后重试。");
  await writeFile(installerPath, content, "utf8");
  if (process.platform !== "win32") await chmod(installerPath, 0o700);
}

async function installOfficialStandalone(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const paths = runtimePaths(env);
  await mkdir(paths.root, { recursive: true });
  await downloadOfficialInstaller(paths.installer);
  const installEnv: NodeJS.ProcessEnv = {
    ...env,
    CODEX_HOME: paths.codexHome,
    CODEX_RELEASE: OFFICIAL_RUNTIME_RELEASE,
    CODEX_INSTALL_DIR: paths.visibleBin,
    CODEX_NON_INTERACTIVE: "1",
    CODEX_INSTALLER_USE_RELEASES_OPENAI_COM: "true",
  };
  try {
    if (process.platform === "win32") {
      const powershell = env.SystemRoot
        ? path.join(env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
        : "powershell.exe";
      await runProcess(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", paths.installer, "-Release", OFFICIAL_RUNTIME_RELEASE], { env: installEnv });
    } else {
      await runProcess("sh", [paths.installer, "--release", OFFICIAL_RUNTIME_RELEASE], { env: installEnv });
    }
  } finally {
    await rm(paths.installer, { force: true }).catch(() => undefined);
  }
}

async function prepareOfficialOpenAiRuntime(env: NodeJS.ProcessEnv = process.env): Promise<OfficialOpenAiRuntime> {
  const capability = officialOpenAiRuntimeCapability();
  if (!capability.available) throw new Error(capability.reason ?? "OpenAI 官方运行组件在当前平台不可用。");

  // Windows 直接下载 OpenAI 官方 App Server 独立二进制：LFAA 不要求也不模拟用户安装 Codex CLI。
  if (process.platform === "win32") return ensureWindowsAppServer(env);

  // macOS/Linux 目前复用 OpenAI 官方 standalone installer，但仍完全隔离在 LFAA_HOME，用户无需全局安装。
  const paths = runtimePaths(env);
  let executable = await findStandaloneExecutable(env);
  if (executable && await installedRelease(executable, paths.codexHome) === OFFICIAL_RUNTIME_RELEASE) {
    return { executable, launchArgs: ["app-server"], codexHome: paths.codexHome, release: OFFICIAL_RUNTIME_RELEASE, component: "standalone" };
  }
  await installOfficialStandalone(env);
  executable = await findStandaloneExecutable(env);
  if (!executable) throw new Error("OpenAI 官方运行组件已完成准备，但未找到账户运行服务可执行文件。");
  const release = await installedRelease(executable, paths.codexHome);
  if (release !== OFFICIAL_RUNTIME_RELEASE) throw new Error(`OpenAI 官方运行组件版本校验失败：期望 ${OFFICIAL_RUNTIME_RELEASE}，实际 ${release ?? "unknown"}。`);
  return { executable, launchArgs: ["app-server"], codexHome: paths.codexHome, release, component: "standalone" };
}

export async function ensureOfficialOpenAiRuntime(env: NodeJS.ProcessEnv = process.env): Promise<OfficialOpenAiRuntime> {
  if (preparePromise) return preparePromise;
  preparePromise = prepareOfficialOpenAiRuntime(env).finally(() => { preparePromise = null; });
  return preparePromise;
}

/** 仅供治理/测试读取固定官方事实，不向 UI 暴露内部运行组件实现细节。 */
export const OFFICIAL_OPENAI_RUNTIME_FACTS = {
  release: OFFICIAL_RUNTIME_RELEASE,
  releaseBase: OFFICIAL_RELEASE_BASE,
  windowsAssets: WINDOWS_APP_SERVER_ASSETS,
  windowsInstaller: OFFICIAL_WINDOWS_INSTALLER,
  unixInstaller: OFFICIAL_UNIX_INSTALLER,
} as const;

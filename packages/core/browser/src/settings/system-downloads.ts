// 解析本机系统「下载」目录：Windows 走已知文件夹注册表项（支持用户重定向到其它盘），Linux 走 XDG，其余回退 ~/Downloads。
// 结果按进程缓存；只用于浏览器下载位置的默认值，不写死任何盘符或用户名。
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Windows 已知文件夹 Downloads 的 GUID（FOLDERID_Downloads）。 */
const DOWNLOADS_FOLDER_GUID = "{374DE290-123F-4565-9164-39C4925E467B}";
const USER_SHELL_FOLDERS = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders";

let cachedSystemDownloadsDir: Promise<string> | null = null;

/** 读取并缓存本机默认下载目录；探测失败时回退到用户主目录下的 Downloads。 */
export function getSystemDownloadsDir(): Promise<string> {
  cachedSystemDownloadsDir ??= detectSystemDownloadsDir().catch(() => join(homedir(), "Downloads"));
  return cachedSystemDownloadsDir;
}

/** 仅供测试：丢弃缓存，让下一次调用重新探测。 */
export function resetSystemDownloadsCache(): void {
  cachedSystemDownloadsDir = null;
}

async function detectSystemDownloadsDir(): Promise<string> {
  if (process.platform === "win32") {
    const fromRegistry = await readWindowsDownloadsDir().catch(() => "");
    if (fromRegistry && existsSync(fromRegistry)) return resolve(fromRegistry);
    const fromShell = await readWindowsShellDownloadsDir().catch(() => "");
    if (fromShell) return resolve(fromShell);
  } else if (process.platform === "linux") {
    const fromEnv = process.env.XDG_DOWNLOAD_DIR?.trim();
    if (fromEnv && isAbsolute(fromEnv)) return resolve(fromEnv);
    const fromFile = readXdgDownloadsDir();
    if (fromFile) return resolve(fromFile);
  }
  return join(homedir(), "Downloads");
}

/** 快速路径：读取「用户 Shell 文件夹」中的 Downloads 重定向地址（通常几十毫秒）。 */
async function readWindowsDownloadsDir(): Promise<string> {
  const { stdout } = await execFileAsync(
    "reg.exe",
    ["query", USER_SHELL_FOLDERS, "/v", DOWNLOADS_FOLDER_GUID],
    { timeout: 4000, windowsHide: true, encoding: "utf8" },
  );
  const line = stdout.split(/\r?\n/u).find((item) => item.includes(DOWNLOADS_FOLDER_GUID));
  // 路径含中文用户名时 reg.exe 会按控制台代码页输出，解不出来就交给 PowerShell 兜底。
  if (!line || line.includes("\uFFFD")) return "";
  const value = /REG_(?:EXPAND_)?SZ\s+(.+)$/u.exec(line)?.[1]?.trim() ?? "";
  return value ? expandWindowsEnv(value) : "";
}

/** 兜底路径：用 Shell 已知文件夹解析，能正确处理中文用户名与被移动过的目录。 */
async function readWindowsShellDownloadsDir(): Promise<string> {
  const script = [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "(New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path",
  ].join("; ");
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
    { timeout: 8000, windowsHide: true, encoding: "utf8" },
  );
  return stdout.trim();
}

/** 展开注册表值里的 %USERPROFILE% 一类环境变量；未定义时保留原样。 */
function expandWindowsEnv(value: string): string {
  return value.replace(/%([^%]+)%/gu, (whole, name: string) => {
    const found = process.env[name] ?? process.env[name.toUpperCase()] ?? process.env[name.toLowerCase()];
    return found ?? whole;
  });
}

/** 读取 XDG 的 user-dirs.dirs，取 XDG_DOWNLOAD_DIR（支持 $HOME 前缀）。 */
function readXdgDownloadsDir(): string {
  let content: string;
  try {
    content = readFileSync(join(homedir(), ".config", "user-dirs.dirs"), "utf8");
  } catch {
    return "";
  }
  for (const line of content.split(/\r?\n/u)) {
    const match = /^\s*XDG_DOWNLOAD_DIR\s*=\s*"?([^"\n]+)"?\s*$/u.exec(line);
    if (!match?.[1]) continue;
    const value = match[1].replace(/^\$HOME(?=\/|$)/u, homedir());
    return isAbsolute(value) ? value : "";
  }
  return "";
}
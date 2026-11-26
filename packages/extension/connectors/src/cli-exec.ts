// CLI 连接器的进程层：解析可执行文件、按 argv 直接启动（不经过 shell）、超时或取消时回收进程树并截断输出。
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import { homedir } from "node:os";

/** 单流最大保留字符数：超出只留尾部，避免把整份构建日志塞进模型上下文。 */
const OUTPUT_LIMIT = 256 * 1024;

export interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  truncated: boolean;
}

export interface ProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** 在 PATH（Windows 含 PATHEXT）中解析可执行文件；绝对路径必须真实存在。 */
export function resolveExecutable(name: string): string | null {
  const value = name.trim();
  if (!value || value.includes("\0")) return null;
  if (isAbsolute(value)) return existsSync(value) ? value : null;
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean)
    : [""];
  const directories = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const directory of directories) {
    const direct = join(directory, value);
    if (existsSync(direct)) return direct;
    for (const extension of extensions) {
      const candidate = join(directory, value + extension);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/** 取输出首行作为版本摘要，供列表与探测结果显示。 */
export function firstLine(output: string): string {
  const line = output.split(/\r?\n/u).map((item) => item.trim()).find(Boolean) ?? "";
  return line.length > 200 ? line.slice(0, 200) : line;
}

/** 结束进程树：Windows 用 taskkill /T，其余平台对进程组发信号。 */
function killTree(child: ChildProcess): void {
  const pid = child.pid;
  if (!pid) return;
  if (process.platform === "win32") {
    try {
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }).on("error", () => child.kill());
    } catch {
      child.kill();
    }
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

/** 直接以 argv 启动进程（shell: false），并保证超时、取消与输出上限。 */
export function runProcess(executable: string, argv: readonly string[], options: ProcessOptions = {}): Promise<ProcessResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    let aborted = false;
    let settled = false;
    const append = (current: string, chunk: string): string => {
      const next = current + chunk;
      if (next.length <= OUTPUT_LIMIT) return next;
      truncated = true;
      return next.slice(next.length - OUTPUT_LIMIT);
    };
    const child = spawn(executable, [...argv], {
      cwd: options.cwd && existsSync(options.cwd) ? options.cwd : homedir(),
      env: options.env ?? process.env,
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      resolve({ code, stdout, stderr, timedOut, aborted, truncated });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, Math.max(1_000, options.timeoutMs ?? 60_000));
    const onAbort = () => {
      aborted = true;
      killTree(child);
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => { stdout = append(stdout, chunk); });
    child.stderr?.on("data", (chunk: string) => { stderr = append(stderr, chunk); });
    child.on("error", (error) => {
      stderr = append(stderr, error.message);
      finish(null);
    });
    child.on("close", (code) => finish(code));
  });
}

/** 探测可执行文件：解析路径并运行探测参数，返回版本摘要。 */
export async function probeExecutable(executable: string, args: readonly string[] = ["--version"]): Promise<{ path?: string; version?: string; error?: string }> {
  const path = resolveExecutable(executable);
  if (!path) return { error: `未找到 ${executable}，请先安装或填写完整路径。` };
  const result = await runProcess(path, args, { timeoutMs: 8_000 });
  if (result.timedOut) return { path, error: "探测超时，请检查该命令是否需要交互输入。" };
  const version = firstLine(result.stdout) || firstLine(result.stderr);
  if (result.code !== 0 && !version) return { path, error: `探测失败（退出码 ${result.code ?? "未知"}）。` };
  return version ? { path, version } : { path };
}
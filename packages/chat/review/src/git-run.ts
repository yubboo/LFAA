// Git 命令执行与路径/分支名校验：所有 Git 操作共用的最小底座。
// 从 git-service 拆出：差异读取、状态查询、提交与撤销都复用这里的 runGit 与安全校验。
import { execFile } from "node:child_process";
import { isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** 在指定工作目录执行 git；统一禁用交互提示并固定输出语言，便于解析。 */
export async function runGit(cwd: string, args: string[], timeoutMs = 10000): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
  });
  return stdout;
}

/** 把用户输入的文件路径收敛为仓库内相对路径；越界、绝对或以 `-` 开头一律拒绝。 */
export function validateSafeRelativeFile(repoRoot: string, filePath: string): string {
  const clean = filePath.trim();
  if (!clean || clean.startsWith("-")) {
    throw new Error(`非法文件路径：${filePath}`);
  }
  const abs = resolve(repoRoot, clean);
  const rel = relative(resolve(repoRoot), abs);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`禁止访问仓库目录外的路径：${filePath}`);
  }
  return rel.replace(/\\/gu, "/");
}

/** 校验分支名：拒绝空白、`..`、结尾点/斜杠与 Git 保留字符。 */
export function validateBranchName(rawName: string): string {
  const cleaned = rawName.trim();
  if (
    !cleaned ||
    cleaned.startsWith("-") ||
    cleaned.includes("..") ||
    /[\s~^:?*[\\\x00-\x1f]/u.test(cleaned) ||
    cleaned.endsWith(".") ||
    cleaned.endsWith("/")
  ) {
    throw new Error(`非法 Git 分支名称：${rawName}`);
  }
  return cleaned;
}
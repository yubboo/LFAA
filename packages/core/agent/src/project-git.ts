// Agent Host 在调用模型前准备项目自身的 Git 基线，供内置 Git 工作台读取。
import { execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";

const execGit = promisify(execFile);
const pending = new Map<string, Promise<void>>();

function hasErrorCode(error: unknown, code: string | number): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

async function prepareRepository(root: string): Promise<void> {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" };
  // 本轮工作区以 Host 已解析的目录为准，避免沿用调用进程的仓库或暂存区覆盖。
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_PREFIX"]) {
    delete env[key];
  }
  const git = async (...args: string[]) => {
    const { stdout } = await execGit("git", args, { cwd: root, timeout: 10_000, windowsHide: true, env });
    return stdout.trim();
  };
  const readOptional = (...args: string[]) => git(...args).catch((error: unknown) => {
    if (hasErrorCode(error, 1)) return "";
    throw error;
  });

  try {
    await lstat(join(root, ".git"));
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) throw error;
    await git("init", "--quiet");
  }
  const repoRoot = await realpath(await git("rev-parse", "--show-toplevel"));
  if (relative(root, repoRoot)) throw new Error("Git 工作树与已绑定的项目根目录不一致。");
  if (await readOptional("rev-parse", "--quiet", "--verify", "HEAD")) return;

  if (!await readOptional("config", "--get", "user.name")) await git("config", "--local", "user.name", "LFAA User");
  if (!await readOptional("config", "--get", "user.email")) await git("config", "--local", "user.email", "lfaa@local");
  await git("add", "-A");
  await git("commit", "--quiet", "--allow-empty", "--no-gpg-sign", "-m", "chore: init project repository");
}

/** 同一项目的并发对话共享一次初始化，失败后下一轮可重新尝试。 */
export async function ensureProjectGitRepo(rootPath: string): Promise<void> {
  const root = await realpath(rootPath);
  const current = pending.get(root);
  if (current) return current;
  const operation = prepareRepository(root);
  pending.set(root, operation);
  try {
    await operation;
  } finally {
    pending.delete(root);
  }
}

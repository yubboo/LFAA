// Git 差异读取：按文件、暂存区或指定提交返回 diff/stat，并为未跟踪文件补文本预览。
// 从 git-service 拆出：差异读取有独立的截断与未跟踪文件兜底逻辑，和状态机分开维护。
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { runGit, validateSafeRelativeFile } from "./git-run";

/** 差异读取选项：文件过滤、暂存区、指定提交或只要统计。 */
export interface GitDiffOptions {
  filePath?: string;
  staged?: boolean;
  commitHash?: string;
  statOnly?: boolean;
}

/** 单次 diff 输出上限：超过即截断并标记，避免整份大文件塞进前端。 */
const MAX_DIFF_CHARS = 60000;

/** 按指定文件和变更范围读取差异文本，交给工作台预览。 */
export async function getGitDiff(
  repoRoot: string,
  options?: GitDiffOptions,
): Promise<{ diff: string; stat: string; truncated?: boolean }> {
  const absRoot = resolve(repoRoot);
  if (options?.commitHash) {
    const hash = options.commitHash.trim();
    if (!/^[a-f0-9]{4,40}$/iu.test(hash)) {
      throw new Error("非法提交哈希。");
    }
    const [stat, diff] = await Promise.all([
      runGit(absRoot, ["show", "--stat", "--format=%h %s (%an, %ai)", hash]),
      runGit(absRoot, ["show", "--format=", "--no-color", hash]).catch(() => ""),
    ]);
    return { stat: stat.trim(), diff: diff.slice(0, MAX_DIFF_CHARS), ...(diff.length > MAX_DIFF_CHARS ? { truncated: true } : {}) };
  }

  const fileArgs = options?.filePath ? ["--", validateSafeRelativeFile(absRoot, options.filePath)] : [];
  if (options?.statOnly && !options.staged) {
    const stat = await runGit(absRoot, ["diff", "HEAD", "--shortstat", ...fileArgs]).catch(() =>
      runGit(absRoot, ["diff", "--shortstat", ...fileArgs]).catch(() => ""),
    );
    return { stat: stat.trim(), diff: "" };
  }
  if (options?.staged) {
    const [stat, diff] = await Promise.all([
      runGit(absRoot, ["diff", "--cached", "--stat", ...fileArgs]).catch(() => ""),
      runGit(absRoot, ["diff", "--cached", "--no-color", ...fileArgs]).catch(() => ""),
    ]);
    return { stat: stat.trim(), diff: diff.slice(0, MAX_DIFF_CHARS), ...(diff.length > MAX_DIFF_CHARS ? { truncated: true } : {}) };
  }

  const [statHead, diffUnstaged, diffStaged] = await Promise.all([
    runGit(absRoot, ["diff", "HEAD", "--stat", ...fileArgs]).catch(() =>
      runGit(absRoot, ["diff", "--stat", ...fileArgs]).catch(() => ""),
    ),
    runGit(absRoot, ["diff", "--no-color", ...fileArgs]).catch(() => ""),
    runGit(absRoot, ["diff", "--cached", "--no-color", ...fileArgs]).catch(() => ""),
  ]);

  const combined = [diffStaged && `# Staged Diff\n${diffStaged}`, diffUnstaged && `# Unstaged Diff\n${diffUnstaged}`]
    .filter(Boolean)
    .join("\n\n");
  // 未跟踪文件不会出现在 git diff 中：按文本预览返回新增行，避免前端绕道读文件。
  if (options?.filePath && !combined.trim()) {
    const rel = validateSafeRelativeFile(absRoot, options.filePath);
    const target = resolve(absRoot, rel);
    const info = await stat(target).catch(() => null);
    if (info?.isFile() && info.size <= 256 * 1024) {
      const content = await readFile(target, "utf8").catch(() => "");
      if (content && !content.includes("\u0000")) {
        const lines = content.replace(/\r?\n$/u, "").split(/\r?\n/u);
        return {
          stat: `1 file changed, ${lines.length} insertions(+)`,
          diff: lines.map((line) => `+${line}`).join("\n").slice(0, MAX_DIFF_CHARS),
        };
      }
    }
  }
  return { stat: statHead.trim(), diff: combined.slice(0, MAX_DIFF_CHARS), ...(combined.length > MAX_DIFF_CHARS ? { truncated: true } : {}) };
}
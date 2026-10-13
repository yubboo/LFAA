/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-tool-fs/src/diff.ts。
 * 功能：写/编辑后的行级 diff 计算与渲染。
 * 与 DSH 差异：DSH 用 npm `diff` 库的 structuredPatch；本仓库无该依赖，这里手写基于 LCS 的行级 diff，
 *   产出 {path, oldText, newText}  hunks，每个 hunk 带 DIFF_CONTEXT 行上下文。
 * 关联文件：write.ts、edit.ts。
 */

/** 每个改动块两侧展示的上下文行数。 */
export const DIFF_CONTEXT = 3;

/** 一个 diff hunk。 */
export interface FileDiff {
  readonly path: string;
  readonly oldText: string | null;
  readonly newText: string;
}

/** 计算两版全文之间的 LCS 行级差异序列（'=' 相等 / '-' 删除 / '+' 新增）。 */
function computeLcs(oldLines: string[], newLines: string[]): Array<{ tag: "=" | "-" | "+"; text: string }> {
  const n = oldLines.length;
  const m = newLines.length;
  // DP 表：lcs[i][j] = oldLines[i:] 与 newLines[j:] 的最长公共子序列长度。
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = oldLines[i] === newLines[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: Array<{ tag: "=" | "-" | "+"; text: string }> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      ops.push({ tag: "=", text: oldLines[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ tag: "-", text: oldLines[i] });
      i += 1;
    } else {
      ops.push({ tag: "+", text: newLines[j] });
      j += 1;
    }
  }
  while (i < n) ops.push({ tag: "-", text: oldLines[i++] });
  while (j < m) ops.push({ tag: "+", text: newLines[j++] });
  return ops;
}

/**
 * 计算 before/after 之间的 hunks：把连续变化段加上下文，输出 {oldText, newText}。
 * 纯新增（oldText 为空）时 oldText 为 null。
 */
export function computeHunkDiffs(path: string, before: string, after: string): FileDiff[] {
  if (before === after) return [];
  const oldLines = before.length === 0 ? [] : before.split("\n");
  const newLines = after.split("\n");
  const ops = computeLcs(oldLines, newLines);

  // 找出所有变化段的区间（含上下文扩展）。
  const changedIdx: number[] = [];
  ops.forEach((op, idx) => { if (op.tag !== "=") changedIdx.push(idx); });
  if (changedIdx.length === 0) return [];

  const hunks: FileDiff[] = [];
  let hunkStart = changedIdx[0] - DIFF_CONTEXT;
  let hunkEnd = changedIdx[0] + DIFF_CONTEXT;
  for (let k = 1; k < changedIdx.length; k += 1) {
    if (changedIdx[k] - hunkEnd <= DIFF_CONTEXT * 2) {
      hunkEnd = changedIdx[k] + DIFF_CONTEXT;
    } else {
      hunks.push(buildHunk(path, ops, Math.max(0, hunkStart), Math.min(ops.length - 1, hunkEnd)));
      hunkStart = changedIdx[k] - DIFF_CONTEXT;
      hunkEnd = changedIdx[k] + DIFF_CONTEXT;
    }
  }
  hunks.push(buildHunk(path, ops, Math.max(0, hunkStart), Math.min(ops.length - 1, hunkEnd)));
  return hunks;
}

function buildHunk(path: string, ops: Array<{ tag: "=" | "-" | "+"; text: string }>, start: number, end: number): FileDiff {
  const oldLines: string[] = [];
  const newLines: string[] = [];
  for (let i = start; i <= end; i += 1) {
    const op = ops[i];
    if (op.tag === "-") oldLines.push(op.text);
    else if (op.tag === "+") newLines.push(op.text);
    else { oldLines.push(op.text); newLines.push(op.text); }
  }
  return { path, oldText: oldLines.length > 0 ? oldLines.join("\n") : null, newText: newLines.join("\n") };
}

/** 从不透明 meta 中窄化出 diff 列表；畸形返回 undefined。 */
export function diffsFromMeta(meta: unknown): FileDiff[] | undefined {
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return undefined;
  const diffs = (meta as Record<string, unknown>).diffs;
  if (!Array.isArray(diffs)) return undefined;
  const valid = diffs.every((d) => {
    const item = d as Record<string, unknown>;
    return typeof item === "object" && item !== null
      && typeof item.path === "string"
      && (item.oldText === null || typeof item.oldText === "string")
      && typeof item.newText === "string";
  });
  return valid ? (diffs as FileDiff[]) : undefined;
}

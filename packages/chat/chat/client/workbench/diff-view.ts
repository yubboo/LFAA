// 文件预览 Diff 视图的数据层：把 git 统一 diff 或「修改前/后」片段整理成左右分栏的行模型。
// 纯函数、无 DOM，便于单元测试；渲染由 FileChangePreview 负责。

/** 单侧行的类型：上下文、删除、新增、空占位。 */
export type SplitSideKind = "context" | "del" | "add" | "empty";

/** 分栏中的一侧：行号、文本与类型。 */
export interface SplitSide {
  lineNo: number | null;
  text: string;
  kind: SplitSideKind;
}

/** 一行左右对照；change 行两侧可能各有一行，也可能只有一侧。 */
export interface SplitRow {
  kind: "row";
  left: SplitSide;
  right: SplitSide;
}

/** Hunk 头（`@@ -a,b +c,d @@`）。 */
export interface SplitHeader {
  kind: "header";
  header: string;
}

export type SplitLine = SplitRow | SplitHeader;

/** 防止超大 diff 拖慢渲染：超出后不再继续展开。 */
export const MAX_SPLIT_ROWS = 4000;

const EMPTY_SIDE: SplitSide = { lineNo: null, text: "", kind: "empty" };

function header(row: SplitHeader): SplitHeader {
  return row;
}

/** 把一段连续的删除/新增行按行配对，多出的一侧补空行。 */
function pairChanges(
  dels: Array<{ lineNo: number; text: string }>,
  adds: Array<{ lineNo: number; text: string }>,
): SplitRow[] {
  const rows: SplitRow[] = [];
  const count = Math.max(dels.length, adds.length);
  for (let i = 0; i < count; i += 1) {
    const del = dels[i];
    const add = adds[i];
    rows.push({
      kind: "row",
      left: del ? { lineNo: del.lineNo, text: del.text, kind: "del" } : EMPTY_SIDE,
      right: add ? { lineNo: add.lineNo, text: add.text, kind: "add" } : EMPTY_SIDE,
    });
  }
  return rows;
}

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u;

/** 解析 git 统一 diff 文本；忽略文件头与 `\ No newline` 行，无法解析的内容跳过。 */
export function splitFromUnifiedDiff(text: string): SplitLine[] {
  const lines = text.split(/\r?\n/u);
  const out: SplitLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  let dels: Array<{ lineNo: number; text: string }> = [];
  let adds: Array<{ lineNo: number; text: string }> = [];

  const flush = () => {
    if (dels.length === 0 && adds.length === 0) return;
    out.push(...pairChanges(dels, adds));
    dels = [];
    adds = [];
  };

  for (const line of lines) {
    if (out.length >= MAX_SPLIT_ROWS) break;
    const hunk = HUNK_RE.exec(line);
    if (hunk) {
      flush();
      oldNo = Number(hunk[1] ?? 1);
      newNo = Number(hunk[3] ?? 1);
      out.push(header({ kind: "header", header: line.trimEnd() }));
      continue;
    }
    if (line.startsWith("@@")) continue;
    if (line.startsWith("\\")) continue;
    if (line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("--- ") || line.startsWith("+++ ")) {
      continue;
    }
    if (line.startsWith("-")) {
      dels.push({ lineNo: oldNo, text: line.slice(1) });
      oldNo += 1;
      continue;
    }
    if (line.startsWith("+")) {
      adds.push({ lineNo: newNo, text: line.slice(1) });
      newNo += 1;
      continue;
    }
    if (line.startsWith(" ")) {
      flush();
      out.push({
        kind: "row",
        left: { lineNo: oldNo, text: line.slice(1), kind: "context" },
        right: { lineNo: newNo, text: line.slice(1), kind: "context" },
      });
      oldNo += 1;
      newNo += 1;
    }
  }
  flush();
  return out.slice(0, MAX_SPLIT_ROWS);
}

type DiffOp = { type: "eq" | "del" | "add"; aIndex?: number; bIndex?: number };

/** 行级 LCS；片段过大时退化为按位置对齐，避免二次方开销。 */
function diffOps(a: string[], b: string[]): DiffOp[] {
  if (a.length * b.length > 4_000_000) {
    const ops: DiffOp[] = [];
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i += 1) {
      if (i < a.length && i < b.length) ops.push({ type: "eq", aIndex: i, bIndex: i });
      else if (i < a.length) ops.push({ type: "del", aIndex: i });
      else ops.push({ type: "add", bIndex: i });
    }
    return ops;
  }

  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = a[i] === b[j] ? (dp[i + 1]![j + 1] ?? 0) + 1 : Math.max(dp[i + 1]![j] ?? 0, dp[i]![j + 1] ?? 0);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "eq", aIndex: i, bIndex: j });
      i += 1;
      j += 1;
    } else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      ops.push({ type: "del", aIndex: i });
      i += 1;
    } else {
      ops.push({ type: "add", bIndex: j });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: "del", aIndex: i });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: "add", bIndex: j });
    j += 1;
  }
  return ops;
}

/** 把「修改前/后」片段做行级对照；行号从 firstLine 开始。 */
export function splitFromFragments(before: string, after: string, firstLine: number): SplitLine[] {
  const beforeLines = before ? before.split(/\r?\n/u) : [];
  const afterLines = after ? after.split(/\r?\n/u) : [];
  const ops = diffOps(beforeLines, afterLines);
  const start = Math.max(1, firstLine);
  const rows: SplitLine[] = [
    header({ kind: "header", header: `@@ -${start},${beforeLines.length} +${start},${afterLines.length} @@` }),
  ];
  let oldNo = start;
  let newNo = start;
  let dels: Array<{ lineNo: number; text: string }> = [];
  let adds: Array<{ lineNo: number; text: string }> = [];

  const flush = () => {
    if (dels.length === 0 && adds.length === 0) return;
    rows.push(...pairChanges(dels, adds));
    dels = [];
    adds = [];
  };

  for (const op of ops) {
    if (rows.length >= MAX_SPLIT_ROWS) break;
    if (op.type === "del" && op.aIndex !== undefined) {
      dels.push({ lineNo: oldNo, text: beforeLines[op.aIndex] ?? "" });
      oldNo += 1;
      continue;
    }
    if (op.type === "add" && op.bIndex !== undefined) {
      adds.push({ lineNo: newNo, text: afterLines[op.bIndex] ?? "" });
      newNo += 1;
      continue;
    }
    flush();
    const text = beforeLines[op.aIndex ?? 0] ?? "";
    rows.push({
      kind: "row",
      left: { lineNo: oldNo, text, kind: "context" },
      right: { lineNo: newNo, text, kind: "context" },
    });
    oldNo += 1;
    newNo += 1;
  }
  flush();
  return rows.slice(0, MAX_SPLIT_ROWS);
}

/** 统计新增/删除行数，供标题展示。 */
export function countDiffLines(lines: SplitLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.kind !== "row") continue;
    if (line.left.kind === "del") removed += 1;
    if (line.right.kind === "add") added += 1;
  }
  return { added, removed };
}
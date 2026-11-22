// 验证 Diff 分栏数据层：统一 diff 解析、修改前后片段对照、行号与空占位。
import assert from "node:assert/strict";
import test from "node:test";

const { countDiffLines, splitFromFragments, splitFromUnifiedDiff } = await import("../client/workbench/diff-view");

const SAMPLE = [
  "diff --git a/src/demo.ts b/src/demo.ts",
  "index 1111111..2222222 100644",
  "--- a/src/demo.ts",
  "+++ b/src/demo.ts",
  "@@ -1,3 +1,3 @@",
  " const a = 1;",
  "-const oldName = 2;",
  "+const newName = 2;",
  " const c = 3;",
  "@@ -10,2 +10,3 @@",
  " const keep = 1;",
  "+const added = 2;",
  " const tail = 3;",
].join("\n");

test("统一 diff 解析为左右分栏，并保留 hunk 头与两侧行号", () => {
  const lines = splitFromUnifiedDiff(SAMPLE);
  assert.equal(lines[0]?.kind, "header");
  assert.equal((lines[0] as { header: string }).header, "@@ -1,3 +1,3 @@");
  assert.equal(lines.length, 8);

  const context = lines[1];
  assert.equal(context?.kind, "row");
  assert.deepEqual(context, {
    kind: "row",
    left: { lineNo: 1, text: "const a = 1;", kind: "context" },
    right: { lineNo: 1, text: "const a = 1;", kind: "context" },
  });

  const change = lines[2];
  assert.deepEqual(change, {
    kind: "row",
    left: { lineNo: 2, text: "const oldName = 2;", kind: "del" },
    right: { lineNo: 2, text: "const newName = 2;", kind: "add" },
  });

  const secondHeader = lines[4];
  assert.equal((secondHeader as { header: string }).header, "@@ -10,2 +10,3 @@");
  const addedRow = lines[6];
  assert.deepEqual(addedRow, {
    kind: "row",
    left: { lineNo: null, text: "", kind: "empty" },
    right: { lineNo: 11, text: "const added = 2;", kind: "add" },
  });
  const tail = lines[7];
  assert.deepEqual(tail, {
    kind: "row",
    left: { lineNo: 11, text: "const tail = 3;", kind: "context" },
    right: { lineNo: 12, text: "const tail = 3;", kind: "context" },
  });
});

test("修改前/后片段按行级差异左右配对，行号从 firstLine 起算", () => {
  const lines = splitFromFragments("a\nb\nc", "a\nB\nc", 5);
  assert.equal((lines[0] as { header: string }).header, "@@ -5,3 +5,3 @@");
  assert.deepEqual(lines[2], {
    kind: "row",
    left: { lineNo: 6, text: "b", kind: "del" },
    right: { lineNo: 6, text: "B", kind: "add" },
  });
  assert.deepEqual(lines[3], {
    kind: "row",
    left: { lineNo: 7, text: "c", kind: "context" },
    right: { lineNo: 7, text: "c", kind: "context" },
  });
});

test("新增文件全为右侧新增行，统计新增/删除数量", () => {
  const lines = splitFromFragments("", "x\ny", 1);
  const rows = lines.filter((line) => line.kind === "row");
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.kind === "row" && row.left.kind, "empty");
  }
  assert.deepEqual(countDiffLines(lines), { added: 2, removed: 0 });
});

test("空 diff 不产生分栏行", () => {
  assert.deepEqual(splitFromUnifiedDiff(""), []);
});
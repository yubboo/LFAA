// 回归测试：验证 edit_file 在 CRLF 文件与 LF target 混用时能自动匹配并保留原始行尾。
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { createEditTools } from "./edit-tools";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("edit_file CRLF/LF normalization", () => {
  it("matches LF target against CRLF file and preserves CRLF line endings", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-edit-crlf-"));
    tempDirs.push(root);
    const filePath = join(root, "sample.ts");
    await writeFile(filePath, "const a = 1;\r\nconst b = 2;\r\nconst c = 3;\r\n", "utf8");

    const tool = createEditTools().find((t) => t.name === "edit_file");
    assert.ok(tool, "edit_file tool should exist");
    const res = await tool.execute(
      { path: "sample.ts", target: "const a = 1;\nconst b = 2;", replacement: "const a = 10;\nconst b = 20;" },
      { workspaceRoots: [root], sessionId: "s1", runId: "r1", signal: new AbortController().signal },
    );

    assert.equal(res.ok, true);
    const updated = await readFile(filePath, "utf8");
    assert.equal(updated, "const a = 10;\r\nconst b = 20;\r\nconst c = 3;\r\n");
  });
});

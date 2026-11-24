// 回归测试：验证 grep 工具既支持目录路径也支持单个文件路径（不再对单文件触发 ENOTDIR）。
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSearchTools } from "../src/search-tools";

test("grep 支持直接传入单个文件路径进行正则检索", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-grep-file-"));
  try {
    const filePath = join(root, "sample.ts");
    await writeFile(filePath, "export const alpha = 1;\nexport const sakura = '#FFF6F8';\n", "utf8");
    const grepTool = createSearchTools().find((item) => item.name === "grep");
    assert.ok(grepTool);
    const result = await grepTool.execute(
      { query: "sakura", path: "sample.ts" },
      {
        runId: "test-run",
        sessionId: "test-session",
        workspaceRoots: [root],
        signal: new AbortController().signal,
      },
    );
    assert.equal(result.ok, true);
    assert.match(result.output, /sample\.ts:2: export const sakura/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

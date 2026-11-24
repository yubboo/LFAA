// 验证 read_file 工具透传真实行号元数据，以及 readActivitySource 支持在授权工作区内读取源文件并拦截越界路径。
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createBuiltinWorkspaceTools } from "@lfaa/tools";
import { readActivitySource } from "../src/run/activity-file";

test("read_file 返回真实 startLine/endLine/totalLines/resolvedPath 元数据，且 readActivitySource 按工作区授权读取源码", async () => {
  const root = mkdtempSync(join(tmpdir(), "lfaa-read-activity-"));
  const outside = mkdtempSync(join(tmpdir(), "lfaa-read-outside-"));
  try {
    mkdirSync(join(root, "src", "styles"), { recursive: true });
    const cssFile = join(root, "src", "styles", "cursor-glow.css");
    writeFileSync(cssFile, [".a {}", ".b {}", ".c {}", ".d {}", ".e {}"].join("\n"), "utf8");
    const secretFile = join(outside, "secret.txt");
    writeFileSync(secretFile, "secret", "utf8");

    const readTool = createBuiltinWorkspaceTools().find((tool) => tool.name === "read_file");
    assert.ok(readTool);
    const result = await readTool.execute(
      { path: "src/styles/cursor-glow.css", startLine: 2, endLine: 4 },
      {
        workspaceRoots: [root],
        sessionId: "s1",
        runId: "r1",
        signal: new AbortController().signal,
      },
    );
    assert.equal(result.ok, true);
    assert.equal(result.metadata?.startLine, 2);
    assert.equal(result.metadata?.endLine, 4);
    assert.equal(result.metadata?.totalLines, 5);
    assert.equal(result.metadata?.resolvedPath, cssFile);

    const preview = await readActivitySource(
      { path: "src/styles/cursor-glow.css", resolvedPath: String(result.metadata?.resolvedPath) },
      [root],
    );
    assert.equal(preview.truncated, false);
    assert.match(preview.content, /\.b \{\}/u);

    await assert.rejects(
      () => readActivitySource({ path: secretFile, resolvedPath: secretFile }, [root]),
      /工作区|越界/u,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

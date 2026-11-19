// 验证命令安全拦截与前台命令时限归一化。
import assert from "node:assert/strict";
import test from "node:test";
import { MAX_COMMAND_TIMEOUT_MS } from "@lfaa/shell";
import { findProtectedPathInCommand, normalizeCommandTimeout } from "../src";

test("拦截引用凭据、会话、模型配置与信任记录的命令", () => {
  assert.ok(findProtectedPathInCommand("type %USERPROFILE%\\.lfaa\\llm-config.json")?.includes("模型配置"));
  assert.ok(findProtectedPathInCommand("cat ~/.lfaa/smart-approvals.json")?.includes("审批"));
  assert.ok(findProtectedPathInCommand("ls ~/.lfaa/credentials")?.includes("凭据"));
  assert.ok(findProtectedPathInCommand("Get-Content $env:USERPROFILE\\.lfaa\\sessions\\a.json")?.includes("会话"));
  assert.equal(findProtectedPathInCommand("pnpm build"), undefined);
});

test("命令时限收敛到 5 秒至最大值之间", () => {
  assert.equal(normalizeCommandTimeout(1_000), 5_000);
  assert.equal(normalizeCommandTimeout(60_000), 60_000);
  assert.equal(normalizeCommandTimeout(MAX_COMMAND_TIMEOUT_MS + 1), MAX_COMMAND_TIMEOUT_MS);
  assert.equal(normalizeCommandTimeout(Number.NaN), undefined);
  assert.equal(normalizeCommandTimeout("60000"), undefined);
});

// 验证命令级策略：重定向与写入命令受工作区约束，灾难性命令在任何模式下都拒绝。
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import test from "node:test";
import type { SandboxPolicy } from "@lfaa/sandbox";
import { LocalSandboxEnforcer } from "../src/index";

const workspace = "C:\\work\\project";
const write: SandboxPolicy = { mode: "workspace-write", workspaceRoots: [workspace] };
const full: SandboxPolicy = { mode: "danger-full-access", workspaceRoots: [workspace] };

function enforcer(): LocalSandboxEnforcer {
  return new LocalSandboxEnforcer(new Context());
}

test("重定向写入工作区内放行，越界拒绝", () => {
  const e = enforcer();
  assert.equal(e.checkCommand("echo hi > C:\\work\\project\\a.txt", write).allowed, true);
  const outside = e.checkCommand("echo hi > C:\\Windows\\evil.txt", write);
  assert.equal(outside.allowed, false);
  assert.match(outside.allowed === false ? outside.reason : "", /超出工作区/);
});

test("常见写入命令的目标必须在工作区内", () => {
  const e = enforcer();
  assert.equal(e.checkCommand("touch C:\\work\\project\\b.txt", write).allowed, true);
  const outside = e.checkCommand("cp C:\\work\\project\\a.txt C:\\Windows\\b.txt", write);
  assert.equal(outside.allowed, false);
  assert.match(outside.allowed === false ? outside.reason : "", /超出工作区/);
});

test("无法确定目标的写入命令保守拒绝", () => {
  const e = enforcer();
  const relative = e.checkCommand("echo hi > relative.txt", write);
  assert.equal(relative.allowed, false);
  assert.match(relative.allowed === false ? relative.reason : "", /绝对路径/);
});

test("灾难性命令在全权模式下依然被拒绝", () => {
  const e = enforcer();
  for (const command of [
    "format c:",
    "diskpart",
    "bcdedit /set {default} safeboot minimal",
    "reg delete HKLM\\SOFTWARE\\Foo /f",
    "Stop-Computer -Force",
    "icacls C:\\ /grant Everyone:F",
  ]) {
    const verdict = e.checkCommand(command, full);
    assert.equal(verdict.allowed, false, `必须拒绝：${command}`);
    assert.match(verdict.allowed === false ? verdict.reason : "", /拒绝执行/);
  }
});

test("普通命令在全权与工作区模式下均放行", () => {
  const e = enforcer();
  assert.equal(e.checkCommand("git status", write).allowed, true);
  assert.equal(e.checkCommand("git status", full).allowed, true);
});

test("confine 未实现时抛出拒绝，而不是放行", async () => {
  const e = enforcer();
  await e.confine(["echo", "hi"], write).then(
    () => assert.fail("未实现进程级包装时必须拒绝"),
    (error: Error) => assert.match(error.message, /拒绝以无限制方式执行/),
  );
});

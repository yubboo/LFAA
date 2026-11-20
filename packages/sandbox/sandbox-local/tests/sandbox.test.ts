// 验证本地沙箱后端的三种模式判定：只读拒绝、工作区限制、全权放行。
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import test from "node:test";
import type { SandboxPolicy } from "@lfaa/sandbox";
import { LocalSandboxEnforcer } from "../src/index";

function makeEnforcer(): LocalSandboxEnforcer {
  return new LocalSandboxEnforcer(new Context());
}

const workspace = "C:\\work\\project";
const policyWorkspace: SandboxPolicy = { mode: "workspace-write", workspaceRoots: [workspace] };
const policyReadOnly: SandboxPolicy = { mode: "read-only", workspaceRoots: [workspace] };
const policyFull: SandboxPolicy = { mode: "danger-full-access", workspaceRoots: [workspace] };

test("只读模式拒绝写入与命令执行", () => {
  const enforcer = makeEnforcer();
  const write = enforcer.checkWrite("C:\\work\\project\\a.txt", policyReadOnly);
  assert.equal(write.allowed, false);
  assert.match(write.allowed === false ? write.reason : "", /只读/);

  const command = enforcer.checkCommand("echo hi", policyReadOnly);
  assert.equal(command.allowed, false);
  assert.match(command.allowed === false ? command.reason : "", /只读/);
});

test("工作区可写模式放行工作区内写入，拒绝越界与相对路径", () => {
  const enforcer = makeEnforcer();
  assert.equal(enforcer.checkWrite("C:\\work\\project\\src\\a.ts", policyWorkspace).allowed, true);
  assert.equal(enforcer.checkWrite(workspace, policyWorkspace).allowed, true);

  const outside = enforcer.checkWrite("C:\\work\\other\\a.ts", policyWorkspace);
  assert.equal(outside.allowed, false);
  assert.match(outside.allowed === false ? outside.reason : "", /超出工作区/);

  const travels = enforcer.checkWrite("C:\\work\\project\\..\\escape.txt", policyWorkspace);
  assert.equal(travels.allowed, false, "路径穿越必须被解析后拦截");

  const relativePath = enforcer.checkWrite("src\\a.ts", policyWorkspace);
  assert.equal(relativePath.allowed, false);
  assert.match(relativePath.allowed === false ? relativePath.reason : "", /绝对路径/);
});

test("全权模式放行写入与命令", () => {
  const enforcer = makeEnforcer();
  assert.equal(enforcer.checkWrite("C:\\anywhere\\a.txt", policyFull).allowed, true);
  assert.equal(enforcer.checkCommand("rm -rf build", policyFull).allowed, true);
});

test("空命令一律拒绝，且后端如实声明只有工具层强制", () => {
  const enforcer = makeEnforcer();
  assert.equal(enforcer.checkCommand("   ", policyWorkspace).allowed, false);
  assert.equal(enforcer.enforcement, "policy", "不得把工具层判定声称为操作系统级沙箱");
});

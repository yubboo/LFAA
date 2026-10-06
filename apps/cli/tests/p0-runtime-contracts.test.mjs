/** 功能：覆盖 P0 沙箱策略和受管子进程合同的拒绝路径。作用：验证目标平台路径、参数快照与 fail-closed 核验。关联文件：packages/sandbox/*、packages/subprocess/subprocess/src/index.ts。 */
import test from "node:test";
import assert from "node:assert/strict";

const sandboxPolicy = await import("lfaa-sandbox-policy/src/index.js");
const sandbox = await import("lfaa-sandbox/src/index.js");
const subprocess = await import("lfaa-subprocess/src/index.js");

test("沙箱策略要求显式目标与目标平台绝对工作区", () => {
  const policy = sandboxPolicy.createSandboxExecutionPolicy({
    mode: "workspace-write", platform: "linux", target: { kind: "node", nodeId: "node-a" },
    workspaceRoot: "/srv/lfaa/project", sessionId: "session-a"
  });
  assert.equal(Object.isFrozen(policy), true);
  assert.equal(Object.isFrozen(policy.target), true);
  assert.throws(() => sandboxPolicy.createSandboxExecutionPolicy({
    mode: "workspace-write", platform: "linux", target: { kind: "local" }, workspaceRoot: "C:\\work"
  }), /目标执行主机上的绝对路径/u);
  assert.equal(sandboxPolicy.isSandboxPolicyWidening("read-only", "workspace-write"), true);
  assert.equal(sandboxPolicy.isSandboxPolicyWidening("workspace-write", "read-only"), false);
});

test("受限沙箱拒绝部分执行和模式替换", () => {
  const policy = sandboxPolicy.createSandboxExecutionPolicy({
    mode: "read-only", platform: "win32", target: { kind: "local" }, workspaceRoot: "C:\\work"
  });
  assert.throws(() => sandbox.assertSandboxResult(["tool.exe"], policy, {
    argv: ["tool.exe"], effectiveMode: "read-only", enforcement: "partial", providerId: "windows-acl"
  }), error => error.code === sandbox.SANDBOX_UNAVAILABLE);
  assert.throws(() => sandbox.assertSandboxResult(["tool.exe"], policy, {
    argv: ["tool.exe"], effectiveMode: "danger-full-access", enforcement: "none", providerId: "fallback"
  }), error => error.code === sandbox.SANDBOX_UNAVAILABLE);
  assert.deepEqual(sandbox.assertSandboxResult(["runner.exe", "--", "tool.exe"], policy, {
    argv: ["runner.exe", "--", "tool.exe"], effectiveMode: "read-only", enforcement: "full", providerId: "windows-acl"
  }).argv, ["runner.exe", "--", "tool.exe"]);
});

test("危险模式不得伪装成沙箱执行且必须保持原始 argv", () => {
  const policy = sandboxPolicy.createSandboxExecutionPolicy({
    mode: "danger-full-access", platform: "linux", target: { kind: "local" }, workspaceRoot: "/work"
  });
  assert.throws(() => sandbox.assertSandboxResult(["tool", "--ok"], policy, {
    argv: ["wrapper", "tool", "--ok"], effectiveMode: "danger-full-access", enforcement: "none", providerId: "none"
  }), error => error.code === sandbox.SANDBOX_UNAVAILABLE);
  assert.equal(sandbox.assertSandboxResult(["tool", "--ok"], policy, {
    argv: ["tool", "--ok"], effectiveMode: "danger-full-access", enforcement: "none", providerId: "explicit-bypass"
  }).enforcement, "none");
});

test("进程请求要求绝对工作目录、有界收集输出并冻结 argv 环境", () => {
  const args = ["--version"];
  const env = { LANG: "zh_CN.UTF-8" };
  const spec = subprocess.validateSubprocessSpawnSpec({
    target: { kind: "node", nodeId: "node-a" }, platform: "linux", executable: "java", args,
    cwd: "/srv/project", env, stdin: "discard", output: { stdout: "collect", stderr: "discard", maxBytesPerStream: 1024 }, terminationGraceMs: 500
  });
  args.push("--changed"); env.LANG = "en_US.UTF-8";
  assert.deepEqual(spec.args, ["--version"]);
  assert.equal(spec.env.LANG, "zh_CN.UTF-8");
  assert.equal(Object.isFrozen(spec.args), true);
  assert.throws(() => subprocess.validateSubprocessSpawnSpec({
    target: { kind: "local" }, platform: "linux", executable: "tool", args: [], cwd: "/work",
    stdin: "discard", output: { stdout: "collect", stderr: "discard", maxBytesPerStream: 17 * 1024 * 1024 }, terminationGraceMs: 0
  }), /1 字节至 16 MiB/u);
  assert.throws(() => subprocess.validateSubprocessSpawnSpec({
    target: { kind: "local" }, platform: "linux", executable: "sh", args: ["-c", "true"], cwd: "relative",
    stdin: "discard", output: { stdout: "collect", stderr: "discard" }, terminationGraceMs: 0
  }), /绝对路径/u);
  assert.throws(() => subprocess.validateSubprocessSpawnSpec({
    target: { kind: "local" }, platform: "linux", executable: "sh", args: [], cwd: "/work",
    stdin: "discard", output: { stdout: "collect", stderr: "discard" }, terminationGraceMs: 0
  }), /显式上限/u);
});

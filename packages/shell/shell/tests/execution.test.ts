// 用真实子进程验证 Shell 执行中的输出、非零退出与命令时限。
import assert from "node:assert/strict";
import test from "node:test";
import { executeShell, sanitizeCommandEnv } from "../src/index";

test("Shell 在进程结束前交付输出，并保留最终中文和退出码", async () => {
  const live: string[] = [];
  const result = await executeShell({
    cwd: process.cwd(), signal: new AbortController().signal, command: "test",
    onOutput: (text) => live.push(text),
  }, {
    file: process.execPath,
    args: ["-e", "process.stdout.write('第一段');setTimeout(()=>{process.stderr.write('错误输出');process.exitCode=7},650)"],
  });
  assert.ok(live.includes("第一段"));
  assert.deepEqual(result, { ok: false, exitCode: 7, output: "第一段\n--- stderr ---\n错误输出" });
});

test("命令达到时限时标记 timedOut，供上层转后台任务", async () => {
  const result = await executeShell({
    cwd: process.cwd(), signal: new AbortController().signal, command: "test", timeoutMs: 300,
  }, {
    file: process.execPath,
    args: ["-e", "setTimeout(()=>{}, 5000)"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.timedOut, true);
});

test("子进程环境剔除供应商密钥，保留构建所需变量", () => {
  const env = sanitizeCommandEnv({
    PATH: "x",
    JAVA_HOME: "j",
    OPENAI_API_KEY: "k",
    DEEPSEEK_API_KEY: "k2",
    AWS_SECRET_ACCESS_KEY: "s",
    GITHUB_TOKEN: "t",
    NPM_TOKEN: "n",
  });
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.DEEPSEEK_API_KEY, undefined);
  assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(env.PATH, "x");
  assert.equal(env.JAVA_HOME, "j");
  assert.equal(env.GITHUB_TOKEN, "t");
  assert.equal(env.NPM_TOKEN, "n");
});

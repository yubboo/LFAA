// 用真实子进程验证 Shell 执行中的输出与非零退出。
import assert from "node:assert/strict";
import test from "node:test";
import { executeShell } from "../src/index";

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

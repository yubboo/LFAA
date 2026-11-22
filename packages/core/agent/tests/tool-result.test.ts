// 验证工具结果进入模型上下文前的统一限长与续读提示。
import assert from "node:assert/strict";
import test from "node:test";
import { limitToolResult } from "../src/tools/tool-result";

test("只读工具按头部限长，命令按尾部限长并提示续读", () => {
  const longRead = "const value = 1;\n".repeat(2_000);
  const read = limitToolResult("read_file", longRead);
  assert.ok(read.length < longRead.length);
  assert.match(read, /已截断/u);
  assert.match(read, /续读/u);

  const longCommand = `$ build\n${"错误日志输出\n".repeat(3_000)}`;
  const command = limitToolResult("run_command", longCommand);
  assert.match(command, /仅保留末尾输出/u);
  assert.ok(command.includes("错误日志输出"));

  assert.equal(limitToolResult("read_file", "short"), "short");
  assert.equal(limitToolResult("unknown_tool", "abc"), "abc");
});

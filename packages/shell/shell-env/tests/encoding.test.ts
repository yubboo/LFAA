// 验证各输出流独立识别 Unicode 编码，分段预览保留未完成字符。
import assert from "node:assert/strict";
import test from "node:test";
import { formatCommandOutput } from "../src/index";

test("命令输出同时兼容 UTF-8、UTF-16 和分块的中文字符", async () => {
  const stdout = Buffer.from("终端输出\n", "utf8");
  const stderr = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("错误详情\n", "utf16le")]);
  assert.equal(await formatCommandOutput(stdout, stderr), "终端输出\n--- stderr ---\n错误详情");
  assert.equal(await formatCommandOutput(stdout.subarray(0, 4), undefined, true), "终");
});

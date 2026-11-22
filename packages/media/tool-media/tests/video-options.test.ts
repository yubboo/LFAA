// 验证视频直连参数解析：从描述读取时长，并清掉指令词与时长尾巴。
import assert from "node:assert/strict";
import test from "node:test";
import { cleanVideoPrompt, resolveVideoDuration } from "../src/video-options";

test("视频时长：中文、数字、英文秒都能解析，未写返回 undefined", () => {
  assert.equal(resolveVideoDuration("五秒视频"), 5);
  assert.equal(resolveVideoDuration("帮我生成一个十五秒的短片"), 15);
  assert.equal(resolveVideoDuration("时长 5 秒"), 5);
  assert.equal(resolveVideoDuration("来一条8s视频"), 8);
  assert.equal(resolveVideoDuration("10 seconds clip"), 10);
  assert.equal(resolveVideoDuration("一只猫在跑"), undefined);
  // 超出范围收敛到 1–15。
  assert.equal(resolveVideoDuration("20秒"), 15);
});

test("视频提示词清理：去掉“帮我生成一个”和“五秒视频”，保留画面描述", () => {
  const cleaned = cleanVideoPrompt("帮我生成一个，忧郁美少女趴在窗户，看看窗外，外面下雨，氛围感的五秒视频");
  assert.equal(cleaned, "忧郁美少女趴在窗户，看看窗外，外面下雨，氛围感");
  assert.equal(cleanVideoPrompt("生成一段海边日落，5秒"), "海边日落");
  // 整句都是指令时退回原文，不能把需求清空。
  assert.equal(cleanVideoPrompt("帮我生成一个视频"), "帮我生成一个视频");
});
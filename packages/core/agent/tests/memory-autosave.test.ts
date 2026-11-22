// 验证只把用户明确的偏好/约定沉淀为长期记忆，普通任务描述不命中。
import assert from "node:assert/strict";
import test from "node:test";
import { extractExplicitMemory } from "../src/run/memory-autosave";

test("只沉淀明确的偏好与约定", () => {
  assert.equal(extractExplicitMemory("记住：本项目统一使用 pnpm。"), "本项目统一使用 pnpm");
  assert.equal(extractExplicitMemory("以后都用中文回答"), "以后都用中文回答");
  assert.equal(extractExplicitMemory("请记住：提交前先跑测试。"), "提交前先跑测试");
  assert.equal(extractExplicitMemory("不要再改 src/legacy.ts"), "不要再改 src/legacy.ts");
  assert.equal(extractExplicitMemory("我的偏好：回答尽量简短"), "我的偏好：回答尽量简短");
  assert.equal(extractExplicitMemory("分析一下这个文件的导出结构"), undefined);
  assert.equal(extractExplicitMemory("帮我修复登录接口的报错"), undefined);
  assert.equal(extractExplicitMemory("记住"), undefined);
});

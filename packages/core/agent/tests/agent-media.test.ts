// 验证媒体指引包含「禁止编造链接」约束：Agent 未调用工具时不能声称图片已生成。
import assert from "node:assert/strict";
import test from "node:test";
import { buildMediaHint } from "../src/agent-media";

/** 只提供 getTool 的最小工具服务替身。 */
const tools = { getTool: (name: string) => (name === "generate_image" ? {} : undefined) } as never;

test("媒体指引要求产物链接只能来自工具返回", () => {
  const hint = buildMediaHint(tools);
  assert.match(hint, /generate_image/u);
  assert.match(hint, /严禁编造/u);
  assert.match(hint, /\/api\/media\/file/u);
});

test("没有媒体工具时不写媒体指引", () => {
  assert.equal(buildMediaHint({ getTool: () => undefined } as never), "");
});
// 验证乱码修复：UTF-8 文本被按 GBK 解码后保存的名称能还原，正常中英文名不被误改。
import assert from "node:assert/strict";
import test from "node:test";
import { TextDecoder } from "node:util";
import { repairMojibakeText } from "../src/text-repair";

/** 构造 UTF-8 被按 GBK 解码后的典型乱码，避免手写字形，保证测试输入真实。 */
function mojibake(original: string): string {
  return new TextDecoder("gbk").decode(Buffer.from(original, "utf8"));
}

test("双重编码的模型档案名可还原", () => {
  for (const name of ["千问 Token Plan", "火山方舟 Agent Plan", "智谱 GLM Coding Plan"]) {
    const broken = mojibake(name);
    if (broken === name) continue;
    assert.equal(repairMojibakeText(broken), name, broken);
  }
});

test("正常中英文名称保持不变", () => {
  for (const name of ["千问 Token Plan", "火山方舟 Agent Plan", "DeepSeek Chat", "Ollama 本地模型", "锦江林 Token Plan"]) {
    assert.equal(repairMojibakeText(name), name, name);
  }
});

test("空串与非文本输入原样返回", () => {
  assert.equal(repairMojibakeText(""), "");
  assert.equal(repairMojibakeText("   "), "   ");
  assert.equal(repairMojibakeText("qwen3.7-max"), "qwen3.7-max");
});
// 验证 @lfaa/rules 分层规则加载顺序（系统 > 项目 > 用户）、项目规则自动发现及卸载清理。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { rulesPlugin } from "../src/index";

test("Host rulesPlugin 按系统规则 > 项目规则 > 用户规则顺序拼装提示词并随 dispose 清理", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-rules-test-"));
  const storeFilePath = path.join(tempRoot, "rules.json");
  const projectDir = path.join(tempRoot, "demo-proj");
  await fs.mkdir(path.join(projectDir, ".lfaa"), { recursive: true });
  await fs.writeFile(path.join(projectDir, "AGENTS.md"), "必须运行测试再汇报完成。", "utf8");
  await fs.writeFile(path.join(projectDir, ".lfaa", "rules.md"), "代码保持小函数风格。", "utf8");

  const ctx = new Context();
  const fiber = ctx.plugin(rulesPlugin, { storeFilePath });
  await fiber;

  try {
    await ctx.rules.saveUserRules("回答请始终保持简练中文。");
    const composed = await ctx.rules.composeSystemPrompt({
      projectPaths: [projectDir],
      memoryHints: ["用户偏好 pnpm workspace。"],
    });

    const sysIdx = composed.systemPrompt.indexOf("[系统规则");
    const projIdx = composed.systemPrompt.indexOf("[项目规则: AGENTS.md]");
    const projExtraIdx = composed.systemPrompt.indexOf("[项目规则: .lfaa");
    const userIdx = composed.systemPrompt.indexOf("[用户全局规则]");
    const memIdx = composed.systemPrompt.indexOf("[长期记忆参考]");

    assert.ok(sysIdx >= 0 && projIdx > sysIdx && projExtraIdx > projIdx && userIdx > projExtraIdx && memIdx > userIdx);
    assert.ok(composed.systemPrompt.includes("必须运行测试再汇报完成。"));
    assert.ok(composed.systemPrompt.includes("回答请始终保持简练中文。"));

    await fiber.dispose();
    assert.equal((ctx as { rules?: unknown }).rules, undefined);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

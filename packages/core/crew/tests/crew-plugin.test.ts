// 验证 crew 插件装配：run_crew 工具注册成功，未装配子智能体时给出可读错误而不是崩溃。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { memoryPlugin } from "@lfaa/memory";
import { toolsPlugin } from "@lfaa/tools";
import { crewPlugin } from "../src/index";

test("crew 插件注册 run_crew，缺少子智能体服务时返回可读错误", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-crew-plugin-"));
  const ctx = new Context();
  try {
    await ctx.plugin(memoryPlugin, {
      sessionsDir: path.join(tempRoot, "sessions"),
      memoryFilePath: path.join(tempRoot, "memory.json"),
      memorySettingsFilePath: path.join(tempRoot, "memory-settings.json"),
    });
    await ctx.plugin(toolsPlugin);
    await ctx.plugin(crewPlugin);

    const tool = ctx.tools.getTool("run_crew");
    assert.ok(tool, "run_crew 应已注册");
    assert.equal(tool?.permissionLevel, "read");

    const session = await ctx.memory.createSession({});
    const result = await ctx.tools.executeTool("run_crew", {
      goal: "做一次两段式调研",
      tasks: [
        { id: "research", description: "调研现状", expectedOutput: "调研结论" },
        { id: "draft", description: "写建议", expectedOutput: "建议清单", dependsOn: ["research"] },
      ],
    }, {
      sessionId: session.id,
      workspaceRoots: [tempRoot],
      runId: "run-crew-test",
      signal: new AbortController().signal,
      getPermissionMode: () => "full",
    } as never);

    assert.equal(result.ok, false);
    assert.match(result.output, /未装配子智能体服务/u);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
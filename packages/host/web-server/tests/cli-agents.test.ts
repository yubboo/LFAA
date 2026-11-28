// 验证官方 CLI 代理配置存储、本地隔离账户环境变量注入与 Codex/Claude 流式 JSON 解析。
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CliAgentsStore } from "../src/cli-agents/store";
import { extractClaudeJsonLine, extractCodexJsonLine, splitExtraArgs } from "../src/cli-agents/runner";

describe("CLI agents store & streaming parsers", () => {
  it("persists agent settings and isolates local account homes with env overlays", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "lfaa-cli-agents-"));
    try {
      const store = new CliAgentsStore({
        configPath: join(tempRoot, "cli-agents.json"),
        accountsRoot: join(tempRoot, "cli-accounts"),
      });

      const initial = await store.getOverview();
      assert.ok(initial.agents.some((a) => a.id === "codex" && a.accountEnvVar === "CODEX_HOME"));
      assert.ok(initial.agents.some((a) => a.id === "claude" && a.accountEnvVar === "CLAUDE_CONFIG_DIR"));
      assert.ok(initial.agents.some((a) => a.id === "agy"));

      const enabled = await store.updateAgent("codex", { enabled: true, extraArgs: "--model o3" });
      const codexAfterEnable = enabled.agents.find((a) => a.id === "codex");
      assert.equal(codexAfterEnable?.enabled, true);
      assert.equal(codexAfterEnable?.extraArgs, "--model o3");

      // 默认复用系统登录时，不注入 CODEX_HOME 覆盖。
      const sysExec = await store.resolveAgentExecution("codex");
      assert.deepEqual(sysExec.envOverlay, {});
      assert.equal(sysExec.activeAccount, null);

      // 添加隔离账户后自动创建独立目录并注入 CODEX_HOME。
      const { account } = await store.addAccount("codex", "工作号");
      assert.ok(existsSync(account.homeDir));
      const accExec = await store.resolveAgentExecution("codex");
      assert.equal(accExec.envOverlay.CODEX_HOME, account.homeDir);
      assert.equal(accExec.activeAccount?.label, "工作号");

      // 删除隔离账户后清理目录并自动回退系统默认。
      const afterRemove = await store.removeAccount("codex", account.id);
      assert.equal(existsSync(account.homeDir), false);
      assert.equal(afterRemove.agents.find((a) => a.id === "codex")?.activeAccountId, null);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("parses Codex JSONL and Claude stream-json deltas cleanly", () => {
    assert.deepEqual(splitExtraArgs('--model "gpt-5" --fast'), ["--model", "gpt-5", "--fast"]);

    assert.deepEqual(
      extractCodexJsonLine(JSON.stringify({ type: "item.agent_message.delta", delta: "你好" })),
      { delta: "你好" },
    );
    assert.deepEqual(
      extractCodexJsonLine(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "完成" } })),
      { replace: "完成" },
    );
    assert.deepEqual(
      extractCodexJsonLine(JSON.stringify({ type: "error", message: "未登录" })),
      { error: "未登录" },
    );

    assert.deepEqual(
      extractClaudeJsonLine(JSON.stringify({
        type: "stream_event",
        event: { delta: { type: "text_delta", text: "Hello" } },
      })),
      { delta: "Hello" },
    );
    assert.deepEqual(
      extractClaudeJsonLine(JSON.stringify({ type: "result", is_error: true, result: "auth required" })),
      { error: "auth required" },
    );
  });
});

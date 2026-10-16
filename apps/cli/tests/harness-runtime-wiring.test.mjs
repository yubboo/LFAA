/** 功能：从完整 Web Profile 回归 Harness 接线；隔离数据和合成 Provider 不进入产品。 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

test("完整 Harness：Agent 工具循环、Skill、委派、压缩、节点文件、调度回执与 Workflow 自动化", { timeout: 90000 }, () => {
  const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "harness-runtime-wiring-"));
  try {
    const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "tests/fixtures/harness-runtime-wiring.mjs"], {
      cwd: cli, windowsHide: true, encoding: "utf8", timeout: 85000,
      env: { ...process.env, LFAA_DATA_DIR: data, NODE_ENV: "test", LFAA_LOCAL_MODE: "true", SERVER_HOST: "127.0.0.1", LOG_LEVEL: "error", JWT_SECRET: "" }
    });
    for (const stage of ["settings-migration", "model-output-capability", "skill", "preflight-recovery", "reply-stream", "response-failures", "subagent", "lazy-expert", "compaction", "files", "schedule", "permissions", "workflow-chat-automation", "terminal", "host-task-timeout-migration"]) assert.ok(output.includes(`verified:${stage}`), stage);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    rmSync(data, { recursive: true, force: true });
  }
});

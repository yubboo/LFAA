/** 功能：从完整 Web Profile 回归 Harness 接线；隔离数据和合成 Provider 不进入产品。 */
import test from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";

const tempRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../dist/.tmp");
mkdirSync(tempRoot, { recursive: true });
const data = mkdtempSync(resolve(tempRoot, "lfaa-harness-runtime-wiring-"));
const home = mkdtempSync(resolve(tempRoot, "lfaa-harness-runtime-wiring-home-"));
process.env.LFAA_HOME = home; process.env.LFAA_DATA_DIR = data; process.env.NODE_ENV = "test"; process.env.JWT_SECRET = ""; process.env.LFAA_HARNESS_HOME = "";
delete process.env.LFAA_DATA_DIR_CONFIGURED;
delete process.env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER;
delete process.env.LFAA_DATA_DIR_MANAGED_BY_DESKTOP;
test.after(() => {
  if (dirname(data) !== tempRoot || dirname(home) !== tempRoot) throw new Error("拒绝清理 Harness 测试根以外的路径。");
  rmSync(data, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

test("完整 Harness：Agent 工具循环、Skill、委派、压缩、节点文件、调度回执与 Workflow 自动化", { timeout: 90000 }, () => {
  const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "tests/fixtures/harness-runtime-wiring.mjs"], {
    cwd: cli, windowsHide: true, encoding: "utf8", timeout: 85000,
    env: { ...process.env, LFAA_HOME: process.env.LFAA_HOME, LFAA_DATA_DIR: data, NODE_ENV: "test", LFAA_LOCAL_MODE: "true", SERVER_HOST: "127.0.0.1", LOG_LEVEL: "error", JWT_SECRET: "" }
  });
  for (const stage of ["settings-migration", "model-output-capability", "skill", "preflight-recovery", "reply-stream", "response-failures", "subagent", "lazy-expert", "compaction", "files", "schedule", "permissions", "workflow-chat-automation", "terminal", "host-task-timeout-migration"]) assert.ok(output.includes(`verified:${stage}`), stage);
});

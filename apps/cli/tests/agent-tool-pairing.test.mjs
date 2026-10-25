/** 功能：验证 Agent Loop 停止路径仍为每个 tool_call 回传配对结果。作用：只在隔离 Profile 与合成 Provider 中运行。 */
import test from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";

const tempRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../dist/.tmp");
mkdirSync(tempRoot, { recursive: true });
const data = mkdtempSync(resolve(tempRoot, "lfaa-agent-tool-pairing-data-"));
const home = mkdtempSync(resolve(tempRoot, "lfaa-agent-tool-pairing-home-"));
process.env.LFAA_HOME = home;
process.env.LFAA_DATA_DIR = data;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "";
process.env.LFAA_HARNESS_HOME = "";
delete process.env.LFAA_DATA_DIR_CONFIGURED;
delete process.env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER;
delete process.env.LFAA_DATA_DIR_MANAGED_BY_DESKTOP;

test.after(() => {
  if (dirname(data) !== tempRoot || dirname(home) !== tempRoot) throw new Error("拒绝清理 Agent 工具配对测试根以外的路径。");
  rmSync(data, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

test("Agent Loop 重复被拦调用停止时仍闭合同批剩余工具调用", { timeout: 60000 }, () => {
  const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "tests/fixtures/agent-tool-pairing.mjs"], {
    cwd: cli,
    windowsHide: true,
    encoding: "utf8",
    timeout: 55000,
    env: { ...process.env, LFAA_HOME: home, LFAA_DATA_DIR: data, NODE_ENV: "test", LFAA_LOCAL_MODE: "true", SERVER_HOST: "127.0.0.1", LOG_LEVEL: "error", JWT_SECRET: "" }
  });
  assert.ok(output.includes("verified:agent-tool-pairing"), output);
});

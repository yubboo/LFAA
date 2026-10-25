/** 功能：验证模型臆造未提供的工具名时 Agent 循环可恢复且不产生伪造工具证据。作用：只在隔离 Profile 与合成 Provider 中运行。 */
import test from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";

const tempRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../dist/.tmp");
mkdirSync(tempRoot, { recursive: true });
const data = mkdtempSync(resolve(tempRoot, "lfaa-agent-unknown-tool-data-"));
const home = mkdtempSync(resolve(tempRoot, "lfaa-agent-unknown-tool-home-"));
process.env.LFAA_HOME = home;
process.env.LFAA_DATA_DIR = data;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "";
process.env.LFAA_HARNESS_HOME = "";
delete process.env.LFAA_DATA_DIR_CONFIGURED;
delete process.env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER;
delete process.env.LFAA_DATA_DIR_MANAGED_BY_DESKTOP;

test.after(() => {
  if (dirname(data) !== tempRoot || dirname(home) !== tempRoot) throw new Error("拒绝清理未知工具测试根以外的路径。");
  rmSync(data, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

test("模型臆造未提供的工具名时 Agent 循环让模型重选并完成，而不是致命失败", { timeout: 60000 }, () => {
  const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "tests/fixtures/agent-unknown-tool.mjs"], {
    cwd: cli,
    windowsHide: true,
    encoding: "utf8",
    timeout: 55000,
    env: { ...process.env, LFAA_HOME: home, LFAA_DATA_DIR: data, NODE_ENV: "test", LFAA_LOCAL_MODE: "true", SERVER_HOST: "127.0.0.1", LOG_LEVEL: "error", JWT_SECRET: "" }
  });
  assert.ok(output.includes("verified:agent-unknown-tool"), output);
});

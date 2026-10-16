/** 完整 Profile 的认证能力目录与共享项目回归；子进程数据隔离且不进入产品装配。 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
test("完整 Profile 认证 Skill 目录只返摘要，共享工作可选择同账户历史项目", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "xiaoyu-api-"));
  try {
    const output = execFileSync(process.execPath, [
      "--import", "tsx", "--import", "./register-package-loader.mjs", "tests/fixtures/xiaoyu-shared-api.mjs"
    ], {
      cwd: cli,
      env: { ...process.env, LFAA_DATA_DIR: data, NODE_ENV: "test", JWT_SECRET: "", LFAA_HARNESS_HOME: "" },
      encoding: "utf8",
      timeout: 90000
    });
    assert.match(output, /LFAA 控制端已启动/);
  } finally {
    if (dirname(data) !== parent) throw new Error("invalid cleanup boundary");
    rmSync(data, { recursive: true, force: true });
  }
});

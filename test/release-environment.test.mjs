/**
 * 文件：release-environment.test.mjs
 * 作用：验证发布环境门禁对 Node / pnpm / lockfile 版本漂移会明确失败。
 * 负责：纯函数环境组合测试，不依赖当前机器真实 Node/pnpm 版本。
 * 不负责：安装 pnpm、联网、运行 workspace build。
 * 状态归属：无运行时状态。
 * 对外接口：Node test runner。
 * 关联文件：scripts/release-environment-check.mjs、package.json。
 * 修改注意事项：项目锁定版本变化时应通过 package.json 测试夹具同步更新。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { validateReleaseEnvironment } from "../scripts/release-environment-check.mjs";

const packageJson = {
  packageManager: "pnpm@11.17.0",
  engines: { node: ">=24.0.0 <25", pnpm: "11.17.0" },
};

test("Node 24 + pnpm 11.17.0 + lockfile passes", () => {
  assert.deepEqual(validateReleaseEnvironment({
    nodeVersion: "24.21.0",
    pnpmVersion: "11.17.0",
    packageJson,
    lockfileExists: true,
  }), { nodeVersion: "24.21.0", pnpmVersion: "11.17.0", requiredPnpm: "11.17.0" });
});

test("wrong Node major is rejected", () => {
  assert.throws(() => validateReleaseEnvironment({
    nodeVersion: "22.16.0",
    pnpmVersion: "11.17.0",
    packageJson,
    lockfileExists: true,
  }), /Node\.js 必须为 24\.x/);
});

test("wrong pnpm version is rejected", () => {
  assert.throws(() => validateReleaseEnvironment({
    nodeVersion: "24.21.0",
    pnpmVersion: "10.0.0",
    packageJson,
    lockfileExists: true,
  }), /pnpm 必须为 11\.17\.0/);
});

test("missing lockfile is rejected", () => {
  assert.throws(() => validateReleaseEnvironment({
    nodeVersion: "24.21.0",
    pnpmVersion: "11.17.0",
    packageJson,
    lockfileExists: false,
  }), /缺少 pnpm-lock\.yaml/);
});

test("packageManager and engines.pnpm must agree", () => {
  assert.throws(() => validateReleaseEnvironment({
    nodeVersion: "24.21.0",
    pnpmVersion: "11.17.0",
    packageJson: { ...packageJson, engines: { ...packageJson.engines, pnpm: "11.16.0" } },
    lockfileExists: true,
  }), /不一致/);
});


test("pnpm-only accepts the locked pnpm version", () => {
  const result = spawnSync(process.execPath, ["scripts/pnpm-only.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, npm_config_user_agent: "pnpm/11.17.0 npm/? node/v24.21.0 win32 x64" },
  });
  assert.equal(result.status, 0, result.stderr);
});

test("pnpm-only rejects a different pnpm version", () => {
  const result = spawnSync(process.execPath, ["scripts/pnpm-only.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, npm_config_user_agent: "pnpm/11.16.0 npm/? node/v24.21.0 win32 x64" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /pnpm 版本不匹配/);
});

test("pnpm-only rejects npm/yarn/bun style user agents", () => {
  const result = spawnSync(process.execPath, ["scripts/pnpm-only.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, npm_config_user_agent: "npm/11.0.0 node/v24.21.0 win32 x64" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /只允许使用 pnpm/);
});

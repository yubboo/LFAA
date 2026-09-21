/**
 * 文件：cargo-lock-consistency.test.mjs
 * 作用：锁定 Cargo workspace member 与 Cargo.lock name/version 一致性 Gate。
 * 负责：验证当前仓库通过，并验证旧 crate 版本会被拒绝。
 * 不负责：运行真实 cargo 或联网解析依赖。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateCargoLockConsistency } from "../scripts/cargo-lock-consistency-check.mjs";

test("current Cargo workspace members are represented by the same version in Cargo.lock", () => {
  const result = validateCargoLockConsistency(process.cwd());
  assert.ok(result.members.some((member) => member.name === "lfaa-secret-store"));
});

test("stale workspace crate version in Cargo.lock is rejected", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "lfaa-cargo-lock-"));
  fs.mkdirSync(path.join(temp, "native", "demo"), { recursive: true });
  fs.writeFileSync(path.join(temp, "Cargo.toml"), '[workspace]\nmembers = ["native/demo"]\n');
  fs.writeFileSync(path.join(temp, "native", "demo", "Cargo.toml"), '[package]\nname = "demo"\nversion = "0.1.17"\n');
  fs.writeFileSync(path.join(temp, "Cargo.lock"), 'version = 4\n\n[[package]]\nname = "demo"\nversion = "0.1.16"\n');
  assert.throws(() => validateCargoLockConsistency(temp), /workspace member 漂移/);
});

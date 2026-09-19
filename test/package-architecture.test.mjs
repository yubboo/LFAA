import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const run = () => spawnSync(process.execPath, ["scripts/package-architecture-check.mjs"], { cwd: process.cwd(), encoding: "utf8" });

test("workspace architecture gate accepts the current real-module skeleton", () => {
  const result = run();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /package architecture check passed/i);
});

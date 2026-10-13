import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const resolverScript = resolve(repositoryRoot, "scripts/resolve-data-directory.mjs");

test("data-directory CLI reads LFAA_DATA_DIR without PowerShell inline-eval quoting", () => {
  const configuredDirectory = resolve(repositoryRoot, "dist/.tmp/resolver-data-test");
  const output = execFileSync(process.execPath, [resolverScript, repositoryRoot], {
    cwd: repositoryRoot,
    env: { ...process.env, LFAA_DATA_DIR: configuredDirectory },
    encoding: "utf8"
  });
  assert.equal(output.trim(), configuredDirectory);
});

test("data-directory CLI preserves an explicit configured-path argument", () => {
  const configuredDirectory = resolve(repositoryRoot, "dist/.tmp/resolver-argument-test");
  const output = execFileSync(process.execPath, [resolverScript, repositoryRoot, configuredDirectory], {
    cwd: repositoryRoot,
    env: { ...process.env, LFAA_DATA_DIR: "data" },
    encoding: "utf8"
  });
  assert.equal(output.trim(), configuredDirectory);
});

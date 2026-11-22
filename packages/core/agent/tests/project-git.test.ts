// 验证自动 Git 基线会跳过疑似密钥文件，并仍尊重 .gitignore。
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ensureProjectGitRepo, isSensitiveProjectFile } from "../src/context/project-git";

function hasHead(root: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--quiet", "--verify", "HEAD"], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

test("识别常见密钥与凭据文件名", () => {
  for (const file of [
    ".env",
    "config/.env.local",
    "deploy/app.pem",
    "certs/server.key",
    "credentials/aws.json",
    "secrets/db.txt",
    "id_rsa",
    ".npmrc",
  ]) {
    assert.equal(isSensitiveProjectFile(file), true, file);
  }
  for (const file of ["README.md", "src/app.ts", "docs/env.md", "envs/prod.json", ".env.example", "config/.env.sample"]) {
    assert.equal(isSensitiveProjectFile(file), false, file);
  }
});

test("项目含未忽略的密钥文件时跳过自动 Git 基线", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-git-secret-"));
  try {
    await fs.writeFile(path.join(root, ".env"), "SECRET=1", "utf8");
    await fs.writeFile(path.join(root, "README.md"), "# demo", "utf8");
    await assert.rejects(() => ensureProjectGitRepo(root), /疑似密钥|自动 Git 基线/u);
    assert.equal(hasHead(root), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("密钥文件已被 .gitignore 忽略时仍创建基线且不提交该文件", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-git-ignore-"));
  try {
    await fs.writeFile(path.join(root, ".gitignore"), ".env\n", "utf8");
    await fs.writeFile(path.join(root, ".env"), "SECRET=1", "utf8");
    await fs.writeFile(path.join(root, "README.md"), "# demo", "utf8");
    await ensureProjectGitRepo(root);
    assert.equal(hasHead(root), true);
    const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" });
    const files = tracked.split(/\r?\n/u).filter(Boolean);
    assert.equal(files.includes(".env"), false);
    assert.ok(files.includes("README.md"));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectProjectArtifact, openProjectArtifact } from "../src/project-files.mjs";

test("inspects and streams the original binary bytes from a project file", async t => {
  const tempRoot = await mkdtemp(join(tmpdir(), "lfaa-project-artifact-"));
  const workspace = join(tempRoot, "workspace");
  const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x91, 0x7a]);
  await mkdir(workspace);
  await writeFile(join(workspace, "build.jar"), bytes);
  t.after(() => rm(tempRoot, { recursive: true, force: true }));

  const inspected = await inspectProjectArtifact(workspace, "build.jar");
  assert.equal(inspected.relativePath, "build.jar");
  assert.equal(inspected.fileName, "build.jar");
  assert.equal(inspected.sizeBytes, bytes.length);
  assert.equal(inspected.sha256, createHash("sha256").update(bytes).digest("hex"));

  const opened = await openProjectArtifact(workspace, "build.jar");
  const chunks = [];
  for await (const chunk of opened.stream) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), bytes);
  assert.deepEqual(await readFile(join(workspace, "build.jar")), bytes);
});

test("rejects project traversal and symbolic-link artifact paths", async t => {
  const tempRoot = await mkdtemp(join(tmpdir(), "lfaa-project-artifact-"));
  const workspace = join(tempRoot, "workspace");
  await mkdir(join(workspace, "build"), { recursive: true });
  await writeFile(join(tempRoot, "outside.jar"), "outside");
  await writeFile(join(workspace, "build", "ok.jar"), "inside");
  try {
    await symlink(join(tempRoot, "outside.jar"), join(workspace, "linked.jar"));
    await symlink(join(tempRoot, "outside.jar"), join(workspace, "build-link"), "junction");
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) return t.skip("当前 Windows 环境不允许创建测试符号链接。");
    throw error;
  }
  t.after(() => rm(tempRoot, { recursive: true, force: true }));

  await assert.rejects(inspectProjectArtifact(workspace, "../outside.jar"), /相对|跳出/u);
  await assert.rejects(inspectProjectArtifact(workspace, "linked.jar"), /符号链接/u);
  await assert.rejects(openProjectArtifact(workspace, "build-link/outside.jar"), /符号链接/u);
  await assert.rejects(openProjectArtifact(workspace, "missing.jar"), /ENOENT|no such file/iu);
});

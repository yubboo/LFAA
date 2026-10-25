/**
 * 功能：回归真实项目文件执行器。
 * 作用：在临时目录验证 UTF-8、唯一锚点、摘要冲突、越界拒绝及 Node 标准输入执行，结束后清理夹具。
 * 关联文件：packages/host/project-files/src/project-files.mjs、core/tools/project-tools.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createDefaultWorkspaceDirectory, executeProjectFile, inspectDefaultWorkspaceDirectory, resolveWindowsDocumentsDirectory } from "../../../packages/host/project-files/src/project-files.mjs";

test("Windows 文档目录使用 Unicode 路径并正确展开注册表变量", () => {
  const documents = resolve(tmpdir(), "用户文档");
  const profile = resolve(tmpdir(), "用户配置");
  assert.equal(resolveWindowsDocumentsDirectory(documents, {}), documents);
  assert.equal(resolveWindowsDocumentsDirectory("%USERPROFILE%\\我的文档", { USERPROFILE: profile }), resolve(profile, "我的文档"));
  assert.throws(() => resolveWindowsDocumentsDirectory("%MISSING%\\文档", {}), /路径无效/u);
});

test("首次默认项目目录创建在系统文档下并可安全重复", async () => {
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, "lfaa-default-workspace-"));
  const documents = join(root, "My Documents");
  try {
    mkdirSync(documents, { recursive: true });
    const resolveDocuments = () => documents;
    assert.deepEqual(await inspectDefaultWorkspaceDirectory(resolveDocuments), { path: join(documents, "lfaa", "default-workspace"), directory: false });
    const first = await createDefaultWorkspaceDirectory(resolveDocuments);
    const second = await createDefaultWorkspaceDirectory(resolveDocuments);
    assert.equal(first, join(documents, "lfaa", "default-workspace"));
    assert.equal(second, first);
    assert.deepEqual(await inspectDefaultWorkspaceDirectory(resolveDocuments), { path: first, directory: true });
    const directDocuments = join(root, "Direct Documents");
    const directDataRoot = join(root, "direct-data");
    mkdirSync(directDocuments);
    mkdirSync(directDataRoot);
    const directScript = `import { createDefaultWorkspaceDirectory } from ${JSON.stringify(new URL("../../../packages/host/project-files/src/project-files.mjs", import.meta.url).href)}; process.stdout.write(await createDefaultWorkspaceDirectory(() => ${JSON.stringify(directDocuments)}));`;
    const directCreated = execFileSync(process.execPath, ["--input-type=module", "-e", directScript], {
      encoding: "utf8", windowsHide: true, env: { ...process.env, NODE_OPTIONS: "", LFAA_DAEMON_DATA_ROOT: directDataRoot }
    });
    assert.equal(directCreated, join(directDocuments, "lfaa", "default-workspace"), "Daemon 子进程不加载包解析器时也能创建默认目录");
    const dataRoot = join(root, "protected-data");
    const blockedDocuments = join(dataRoot, "Documents");
    const moduleUrl = new URL("../../../packages/host/project-files/src/project-files.mjs", import.meta.url).href;
    const script = `import { createDefaultWorkspaceDirectory } from ${JSON.stringify(moduleUrl)}; await createDefaultWorkspaceDirectory(() => ${JSON.stringify(blockedDocuments)});`;
    const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const loaderUrl = pathToFileURL(resolve(cli, "register-package-loader.mjs")).href;
    assert.throws(() => execFileSync(process.execPath, ["--import", loaderUrl, "--input-type=module", "-e", script], { encoding: "utf8", windowsHide: true, env: { ...process.env, LFAA_DAEMON_DATA_ROOT: dataRoot } }), /LFAA_DATA_DIR/u);
    assert.equal(existsSync(blockedDocuments), false, "拒绝位于 LFAA_DATA_DIR 内的默认项目路径前不创建目录");
  } finally { assert.equal(dirname(resolve(root)), parent); rmSync(root, { recursive: true, force: true }); }
});

test("默认工作区只在动态系统文档目录创建，不复制乱码旧目录内容", async () => {
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, "lfaa-default-workspace-restore-"));
  const documents = join(root, "系统文档");
  const source = join(root, "ϵͳ", "�ĵ�", "LFAA", "default-workspace");
  try {
    mkdirSync(documents, { recursive: true });
    mkdirSync(join(source, ".git"), { recursive: true });
    writeFileSync(join(source, ".git", "HEAD"), "ref: refs/heads/main\n");
    writeFileSync(join(source, "index.html"), "<!doctype html><title>保留</title>\n");
    const resolveDocuments = () => documents;
    const initialized = await createDefaultWorkspaceDirectory(resolveDocuments);
    assert.equal(initialized, join(documents, "lfaa", "default-workspace"));
    assert.deepEqual(await inspectDefaultWorkspaceDirectory(resolveDocuments), { path: initialized, directory: true });
    assert.equal(existsSync(join(source, ".git", "HEAD")), true, "乱码旧目录保持原样");
    assert.equal(existsSync(join(source, "index.html")), true, "不读取或复制乱码旧目录内容");
    assert.equal(existsSync(join(initialized, ".git", "HEAD")), false, "新默认工作区只创建目录");
    assert.equal(existsSync(join(initialized, "index.html")), false, "新目录不包含旧目录文件");
  } finally { assert.equal(dirname(resolve(root)), parent); rmSync(root, { recursive: true, force: true }); }
});

test("批量目录检查只把不存在或非目录路径报告为不可用", async () => {
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, "lfaa-project-directory-inspection-"));
  const existing = join(root, "existing");
  const regularFile = join(root, "file.txt");
  try {
    mkdirSync(existing);
    writeFileSync(regularFile, "file");
    const result = await executeProjectFile({ operation: "inspect_directories", paths: [existing, join(root, "missing"), regularFile] });
    assert.deepEqual(result, { directories: [true, false, false] });
    await assert.rejects(executeProjectFile({ operation: "inspect_directories", paths: ["relative/path"] }), /项目目录检查列表无效/u);
    await assert.rejects(executeProjectFile({ operation: "inspect_directories", paths: new Array(201).fill(existing) }), /项目目录检查列表无效/u);
  } finally { assert.equal(dirname(resolve(root)), parent); rmSync(root, { recursive: true, force: true }); }
});

test("项目文本操作返回真实证据且拒绝覆盖、重复锚点和越界", async () => {
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, "lfaa-project-files-"));
  const base = { rootDirectory: root, path: "src/example.txt" };
  try {
    const created = await executeProjectFile({ ...base, operation: "create", content: "第一行\r\n修复位置\r\n" });
    assert.equal(created.relativePath, "src/example.txt");
    await assert.rejects(executeProjectFile({ ...base, operation: "create", content: "覆盖" }), /EEXIST/u);
    const initial = await executeProjectFile({ ...base, operation: "read" });
    assert.equal(initial.content, "第一行\r\n修复位置\r\n");
    assert.equal(initial.relativePath, "src/example.txt");
    const replaced = await executeProjectFile({ ...base, operation: "replace", sha256: initial.sha256, oldText: "修复位置", newText: "已修复" });
    assert.equal(replaced.changed, true);
    assert.equal(replaced.relativePath, "src/example.txt");
    await assert.rejects(executeProjectFile({ ...base, operation: "replace", sha256: initial.sha256, oldText: "已修复", newText: "覆盖" }), /文件已变化/u);
    const current = await executeProjectFile({ ...base, operation: "read" });
    await executeProjectFile({ ...base, path: ".agents/skills/reviewer/SKILL.md", operation: "create", content: "---\nname: reviewer\n---\n检查项目差异和测试证据。" });
    const discovered = await executeProjectFile({ ...base, path: ".", operation: "discover_skills" });
    assert.equal(discovered.skills[0].name, "reviewer");
    assert.match((await executeProjectFile({ ...base, path: discovered.skills[0].path, operation: "read" })).content, /检查项目差异/u);
    await assert.rejects(executeProjectFile({ ...base, operation: "replace", sha256: current.sha256, oldText: "\r\n", newText: "\n" }), /不唯一/u);
    assert.equal((await executeProjectFile({ ...base, path: ".", operation: "search", query: "已修复" })).matches[0].line, 2);
    await assert.rejects(executeProjectFile({ ...base, path: "../outside.txt", operation: "create", content: "越界" }), /超出/u);
    writeFileSync(join(root, "bom.txt"), "\ufeff保留 BOM");
    assert.equal((await executeProjectFile({ ...base, path: "bom.txt", operation: "read" })).content, "\ufeff保留 BOM");
    const runner = fileURLToPath(new URL("../../../packages/host/project-files/src/project-files.mjs", import.meta.url));
    const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const loaderUrl = pathToFileURL(resolve(cli, "register-package-loader.mjs")).href;
    const result = execFileSync(process.execPath, ["--import", loaderUrl, runner], { input: JSON.stringify({ ...base, operation: "read" }), encoding: "utf8", windowsHide: true });
    assert.equal(JSON.parse(result).sha256, current.sha256);
    const page = await executeProjectFile({ ...base, operation: "read", offset: 1, limit: 3 });
    assert.equal(page.content, current.content.slice(1, 4));
    assert.equal(page.offset, 1);
    assert.equal(page.truncated, true);
    const saved = await executeProjectFile({ ...base, operation: "write", sha256: current.sha256, content: "保存后的文本🙂\r\n" });
    assert.equal(saved.changed, true);
    assert.equal(saved.relativePath, "src/example.txt");
    assert.equal((await executeProjectFile({ ...base, operation: "read" })).content, "保存后的文本🙂\r\n");
    await assert.rejects(executeProjectFile({ ...base, operation: "write", sha256: current.sha256, content: "不应覆盖" }), /文件已变化/u);
    await assert.rejects(executeProjectFile({ ...base, operation: "write", sha256: saved.sha256, content: "含\0二进制标记" }), /二进制标记/u);
    await assert.rejects(executeProjectFile({ ...base, path: ".", operation: "delete" }), /普通文件路径/u);
    await assert.rejects(executeProjectFile({ ...base, path: "missing.txt", operation: "delete" }), /ENOENT/u);
    mkdirSync(join(root, "folder-to-keep"));
    await assert.rejects(executeProjectFile({ ...base, path: "folder-to-keep", operation: "delete" }), /普通文件/u);
    writeFileSync(join(root, "delete-me.bin"), Buffer.from([0, 1, 2]));
    assert.deepEqual(await executeProjectFile({ ...base, path: "delete-me.bin", operation: "delete" }), { path: join(root, "delete-me.bin"), relativePath: "delete-me.bin", deleted: true });
    await assert.rejects(executeProjectFile({ ...base, path: "../outside.txt", operation: "delete" }), /超出/u);
    try {
      symlinkSync("src/example.txt", join(root, "inside-link.txt"), "file");
      const linked = await executeProjectFile({ ...base, path: "inside-link.txt", operation: "read" });
      await assert.rejects(executeProjectFile({ ...base, path: "inside-link.txt", operation: "write", sha256: linked.sha256, content: "不要替换链接" }), /不支持符号链接/u);
      await assert.rejects(executeProjectFile({ ...base, path: "inside-link.txt", operation: "delete" }), /符号链接/u);
    } catch (error) {
      if (!error || !["EPERM", "EACCES", "ENOSYS"].includes(error.code)) throw error;
    }
  } finally { assert.equal(dirname(resolve(root)), parent); rmSync(root, { recursive: true, force: true }); }
});

test("项目差异支持根目录、已跟踪修改和未跟踪文本文件", async () => {
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, "lfaa-project-diff-"));
  const trackedPath = join(root, "tracked.txt");
  const untrackedPath = "新增 文件/示例.ts";
  try {
    execFileSync("git", ["-C", root, "init", "--quiet"], { windowsHide: true });
    writeFileSync(trackedPath, "原始内容\n");
    execFileSync("git", ["-C", root, "add", "--", "tracked.txt"], { windowsHide: true });
    execFileSync("git", ["-c", "user.name=LFAA Test", "-c", "user.email=lfaa-test@example.invalid", "-C", root, "commit", "--quiet", "-m", "fixture"], { windowsHide: true });
    writeFileSync(trackedPath, "原始内容\n已修改\n");
    await executeProjectFile({ rootDirectory: root, path: untrackedPath, operation: "create", content: "export const answer = 42;\n" });

    const rootDiff = await executeProjectFile({ rootDirectory: root, path: ".", operation: "diff" });
    assert.match(rootDiff.diff, /diff --git a\/tracked\.txt b\/tracked\.txt/u);
    assert.match(rootDiff.diff, /\+已修改/u);
    assert.match(rootDiff.diff, /\+export const answer = 42;/u);
    assert.equal(rootDiff.diffTruncated, false);

    const directoryDiff = await executeProjectFile({ rootDirectory: root, path: "新增 文件", operation: "diff" });
    assert.match(directoryDiff.diff, /\+export const answer = 42;/u);
    assert.equal(directoryDiff.diffTruncated, false);

    const emptyDiff = await executeProjectFile({ rootDirectory: root, operation: "diff" });
    assert.equal(emptyDiff.diff, rootDiff.diff);
  } finally { assert.equal(dirname(resolve(root)), parent); rmSync(root, { recursive: true, force: true }); }
});

test("Skill 文件树只在新目录内原子创建并拒绝路径穿越或覆盖", async () => {
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, "lfaa-project-skill-tree-"));
  const base = { rootDirectory: root, path: ".agents/skills/reviewer", operation: "create_tree" };
  const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
  try {
    const result = await executeProjectFile({ ...base, files: [
      { path: "SKILL.md", content: "---\nname: reviewer\n---\n审阅项目内容。" },
      { path: "references/checklist.md", content: "逐项核对证据。" },
      { path: "参考/核对表.md", content: "确认中文目录和文件名。" },
      { path: "assets/preview.png", content: imageBytes.toString("base64"), encoding: "base64" }
    ] });
    assert.equal(result.created, true);
    assert.equal(result.files.length, 4);
    assert.equal(result.files.find(file => file.path === "SKILL.md").relativePath, ".agents/skills/reviewer/SKILL.md");
    assert.deepEqual(readFileSync(join(root, ".agents", "skills", "reviewer", "assets", "preview.png")), imageBytes, "二进制资源以原字节安全落盘");
    assert.equal((await executeProjectFile({ rootDirectory: root, path: ".", operation: "discover_skills" })).skills[0].name, "reviewer");
    await assert.rejects(executeProjectFile({ ...base, files: [{ path: "../escape.txt", content: "越界" }] }), /不安全的相对路径/u);
    await assert.rejects(executeProjectFile({ ...base, files: [{ path: "SKILL.md", content: "覆盖" }] }), /目标目录已存在/u);
    await assert.rejects(executeProjectFile({ ...base, path: ".agents/skills/duplicate", files: [
      { path: "SKILL.md", content: "a" }, { path: "skill.md", content: "b" }
    ] }), /重复路径/u);
    await assert.rejects(executeProjectFile({ rootDirectory: root, path: ".agents/skills/duplicate", operation: "list" }), /ENOENT/u, "拒绝的文件树没有留下部分目录");
  } finally { assert.equal(dirname(resolve(root)), parent); rmSync(root, { recursive: true, force: true }); }
});

test("项目目录选择只列一级文件夹，且不会暴露或进入 LFAA_DATA_DIR", async () => {
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, "lfaa-project-picker-"));
  const dataRoot = join(root, "lfaa-data");
  mkdirSync(dataRoot);
  writeFileSync(join(dataRoot, "private.txt"), "受保护的数据");
  const runner = fileURLToPath(new URL("../../../packages/host/project-files/src/project-files.mjs", import.meta.url));
  const env = { ...process.env, LFAA_DAEMON_DATA_ROOT: dataRoot };
  const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const loaderUrl = pathToFileURL(resolve(cli, "register-package-loader.mjs")).href;
  const run = input => JSON.parse(execFileSync(process.execPath, ["--import", loaderUrl, runner], { input: JSON.stringify(input), encoding: "utf8", windowsHide: true, env, stdio: ["pipe", "pipe", "pipe"] }));
  const assertProtectedPathRejected = input => {
    let failure;
    try { run(input); } catch (error) { failure = error; }
    assert.ok(failure);
    assert.match(String(failure.stderr), /LFAA_DATA_DIR/u);
  };
  try {
    const home = await executeProjectFile({ operation: "home" });
    assert.ok(home.path);
    assert.ok(Array.isArray(home.roots));
    const listing = run({ operation: "list_directories", path: root });
    assert.equal(listing.entries.includes("lfaa-data"), false);
    const created = run({ operation: "create_directory", path: root, name: "new project" });
    assert.equal(created.created, true);
    assert.equal(run({ operation: "inspect_directory", path: created.path }).directory, true);

    const toolListing = run({ rootDirectory: root, path: ".", operation: "list" });
    assert.equal(toolListing.entries.some(entry => entry.name === "lfaa-data"), false);
    assertProtectedPathRejected({ rootDirectory: root, path: "lfaa-data/private.txt", operation: "read" });
    assertProtectedPathRejected({ operation: "create_directory", path: dataRoot, name: "blocked" });
  } finally { assert.equal(dirname(resolve(root)), parent); rmSync(root, { recursive: true, force: true }); }
});

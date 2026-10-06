/**
 * 功能：执行项目文件的真实读取、检索、创建和唯一锚点修改。
 * 作用：验证规范路径、拒绝越界符号链接，使用文件摘要检测并发修改，返回可核对的内容与差异。
 * 关联文件：daemon.mjs 的 project-files 任务执行器、git-workspace.mjs、core/tools/project-tools.ts；可作为独立 Node 任务运行。
 */
import { readFile, writeFile, realpath, stat, lstat, readdir, mkdir, opendir, rename, rm } from "node:fs/promises";
import { resolve, relative, dirname, isAbsolute, sep, parse } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { executeGitWorkspace } from "./git-workspace.mjs";

const textLimit = 2 * 1024 * 1024;
const digest = text => createHash("sha256").update(text).digest("hex");
const protectedDataRoot = process.env.LFAA_DAEMON_DATA_ROOT ? resolve(process.env.LFAA_DAEMON_DATA_ROOT) : null;
let protectedDataRootRealPath;
function assertWithin(root, path) {
  const value = relative(root, path);
  if (value === ".." || value.startsWith(`..${sep}`) || isAbsolute(value)) throw new Error("文件路径超出本次项目根目录。");
}
async function assertOutsideDataRoot(path) {
  if (!protectedDataRoot) return;
  protectedDataRootRealPath ??= realpath(protectedDataRoot).catch(() => protectedDataRoot);
  let candidate = resolve(path);
  try { candidate = await realpath(candidate); } catch { /* 新建目标在检查前不存在；调用方先校验其现有父目录。 */ }
  const value = relative(await protectedDataRootRealPath, candidate);
  if (value === "" || value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value)) {
    const worktreesRoot = resolve(await protectedDataRootRealPath, "git-worktrees");
    const worktreeRelative = relative(worktreesRoot, candidate);
    const worktreeId = worktreeRelative.split(sep)[0] ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(worktreeId)
      || worktreeRelative === ".." || worktreeRelative.startsWith(`..${sep}`) || isAbsolute(worktreeRelative)) {
      throw new Error("通用项目目录不能读取或修改 LFAA_DATA_DIR。");
    }
  }
}
async function readBoundedDirectory(path, limit = 5000) {
  const directory = await opendir(path);
  const entries = [];
  let truncated = false;
  for await (const entry of directory) {
    if (entries.length >= limit) { truncated = true; break; }
    entries.push(entry);
  }
  return { entries, truncated };
}
async function checkedPath(root, value, create = false) {
  const path = resolve(root, value || ".");
  assertWithin(root, path);
  await assertOutsideDataRoot(path);
  let ancestor = path;
  while (true) {
    try { const canonical = await realpath(ancestor); assertWithin(root, canonical); await assertOutsideDataRoot(canonical); break; }
    catch (error) { if (!create || error.code !== "ENOENT" || dirname(ancestor) === ancestor) throw error; ancestor = dirname(ancestor); }
  }
  return path;
}
async function readText(path) {
  const details = await stat(path);
  if (!details.isFile() || details.size > textLimit) throw new Error("仅支持不超过 2 MiB 的普通文本文件。");
  const bytes = await readFile(path);
  if (bytes.includes(0)) throw new Error("文件包含二进制数据，不能按文本处理。");
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
}

export async function executeProjectFile(input) {
  if (input?.operation === "git-workspace") return executeGitWorkspace({ ...input, operation: input.gitOperation });
  if (input?.operation === "home") {
    const home = await realpath(homedir());
    const roots = process.platform === "win32"
      ? (await Promise.all("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(async letter => {
        const path = `${letter}:\\`;
        try { return (await stat(path)).isDirectory() ? path : null; } catch { return null; }
      }))).filter(Boolean)
      : [parse(home).root];
    return { path: home, home, root: parse(home).root, roots };
  }
  if (input?.operation === "list_directories" || input?.operation === "inspect_directory" || input?.operation === "create_directory") {
    if (typeof input.path !== "string" || !isAbsolute(input.path)) throw new Error("项目目录必须是 Daemon 上的绝对路径。");
    const path = resolve(input.path);
    await assertOutsideDataRoot(path);
    if (input.operation === "create_directory") {
      if (typeof input.name !== "string" || !input.name.trim() || input.name === "." || input.name === ".." || /[\\/]/u.test(input.name) || input.name.length > 120) throw new Error("新文件夹名称无效。");
      const parent = await realpath(path);
      if (!(await stat(parent)).isDirectory()) throw new Error("请选择现有文件夹作为新文件夹的位置。");
      const destination = resolve(parent, input.name.trim());
      await assertOutsideDataRoot(destination);
      let createdNow = true;
      try { await mkdir(destination); }
      catch (error) {
        if (error.code !== "EEXIST") throw error;
        if (!(await stat(destination)).isDirectory()) throw error;
        createdNow = false;
      }
      const created = await realpath(destination);
      await assertOutsideDataRoot(created);
      return { path: created, name: input.name.trim(), created: createdNow };
    }
    const canonical = await realpath(path);
    await assertOutsideDataRoot(canonical);
    if (!(await stat(canonical)).isDirectory()) throw new Error("所选路径不是文件夹。");
    if (input.operation === "inspect_directory") return { path: canonical, root: parse(canonical).root, directory: true };
    const listed = await readBoundedDirectory(canonical);
    const directories = listed.entries
      .filter(entry => entry.isDirectory() && !entry.isSymbolicLink())
      .map(entry => entry.name)
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
    const visible = [];
    const protectedRoot = protectedDataRoot ? await (protectedDataRootRealPath ??= realpath(protectedDataRoot).catch(() => protectedDataRoot)) : null;
    for (const name of directories) {
      const child = resolve(canonical, name);
      const protectedRelative = protectedRoot ? relative(protectedRoot, child) : "..";
      if (protectedRelative === "" || protectedRelative !== ".." && !protectedRelative.startsWith(`..${sep}`) && !isAbsolute(protectedRelative)) continue;
      visible.push(name);
    }
    return { path: canonical, root: parse(canonical).root, entries: visible.slice(0, 500), truncated: listed.truncated || visible.length > 500 };
  }
  if (!input || !["list", "read", "search", "search_markdown", "create", "create_tree", "replace", "write", "diff", "discover_skills"].includes(input.operation) || typeof input.rootDirectory !== "string" || !isAbsolute(input.rootDirectory)) throw new Error("项目操作或绝对根目录无效。");
  const root = await realpath(input.rootDirectory);
  await assertOutsideDataRoot(root);
  const path = await checkedPath(root, input.path, input.operation === "create" || input.operation === "create_tree");
  if (input.operation === "discover_skills") {
    const skills = [];
    // 使用项目内公开约定目录；发现只返回真实路径，模型按任务需要再读取 SKILL.md。
    for (const folder of [".agents/skills", ".lfaa/skills"]) {
      let directory;
      try { directory = await checkedPath(root, folder); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (!entry.isDirectory() || skills.length >= 100) continue;
        try { const skillPath = await checkedPath(root, `${folder}/${entry.name}/SKILL.md`); const details = await stat(skillPath); if (details.isFile()) skills.push({ name: entry.name, path: relative(root, skillPath) }); }
        catch (error) { if (error.code !== "ENOENT") throw error; }
      }
    }
    return { root, skills, limit: 100 };
  }
  if (input.operation === "list") {
    const listed = await readBoundedDirectory(path);
    const visible = [];
    const protectedRoot = protectedDataRoot ? await (protectedDataRootRealPath ??= realpath(protectedDataRoot).catch(() => protectedDataRoot)) : null;
    for (const entry of listed.entries) {
      if (!entry.isDirectory()) { visible.push(entry); continue; }
      const child = resolve(path, entry.name);
      const protectedRelative = protectedRoot ? relative(protectedRoot, child) : "..";
      if (protectedRelative === "" || protectedRelative !== ".." && !protectedRelative.startsWith(`..${sep}`) && !isAbsolute(protectedRelative)) continue;
      visible.push(entry);
    }
    visible.sort((left, right) => Number(right.isDirectory()) - Number(left.isDirectory()) || left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
    return { root, path, entries: visible.slice(0, 1000).map(entry => ({ name: entry.name, directory: entry.isDirectory(), symbolicLink: entry.isSymbolicLink() })), truncated: listed.truncated || visible.length > 1000 };
  }
  if (input.operation === "read") {
    const content = await readText(path);
    const offset = Math.max(0, Number(input.offset) || 0);
    const requestedLimit = Number.isInteger(input.limit) ? input.limit : 40000;
    const limit = Math.max(1, Math.min(requestedLimit, 100000));
    return { path, content: content.slice(offset, offset + limit), offset, totalCharacters: content.length, truncated: offset + limit < content.length, sha256: digest(content) };
  }
  if (input.operation === "search" || input.operation === "search_markdown") {
    if (typeof input.query !== "string" || !input.query.length) throw new Error("检索文本不能为空。");
    const markdownOnly = input.operation === "search_markdown";
    const matches = []; let scanned = 0; let directories = 0; let truncated = false;
    const walk = async directory => {
      if (directories >= 1000) { truncated = true; return; }
      directories += 1;
      const listing = await readBoundedDirectory(directory, 256);
      if (listing.truncated) truncated = true;
      for (const entry of listing.entries) {
        if (scanned >= 2000 || matches.length >= 100) { truncated = true; return; }
        if (entry.isSymbolicLink() || [".git", "node_modules", "dist"].includes(entry.name.toLocaleLowerCase("en-US"))) continue;
        const child = resolve(directory, entry.name);
        try { await assertOutsideDataRoot(child); } catch { continue; }
        if (entry.isDirectory()) await walk(child);
        else if (entry.isFile()) {
          scanned += 1;
          if (markdownOnly && !/\.(?:md|markdown)$/iu.test(entry.name)) continue;
          let content;
          try { content = await readText(child); } catch { continue; }
          const lines = content.split(/\r?\n/u);
          for (let index = 0; index < lines.length && matches.length < 100; index += 1) if (lines[index].includes(input.query)) matches.push({ path: relative(root, child), line: index + 1, text: lines[index].slice(0, 1000) });
        }
      }
    };
    await walk(path); return { root, matches, scanned, truncated };
  }
  if (input.operation === "diff") return { path, diff: execFileSync("git", ["-C", root, "diff", "--", relative(root, path)], { encoding: "utf8", windowsHide: true, maxBuffer: textLimit }) };
  if (input.operation === "create") {
    if (typeof input.content !== "string" || Buffer.byteLength(input.content) > textLimit) throw new Error("文件内容无效或超过允许大小。");
    await mkdir(dirname(path), { recursive: true });
    await checkedPath(root, input.path, true);
    await writeFile(path, input.content, { flag: "wx" });
    return { path, created: true, sha256: digest(input.content) };
  }
  if (input.operation === "create_tree") {
    if (!Array.isArray(input.files) || input.files.length < 1 || input.files.length > 128 || path === root) throw new Error("文件树必须包含 1–128 个文件，并且不能覆盖项目根目录。");
    const seen = new Set();
    let totalBytes = 0;
    const files = input.files.map(file => {
      if (!file || typeof file !== "object" || Array.isArray(file) || typeof file.path !== "string" || typeof file.content !== "string") throw new Error("文件树包含无效条目。");
      const pieces = file.path.replaceAll("\\", "/").split("/");
      if (file.path.length > 512 || file.path.startsWith("/") || pieces.some(part => !part || part === "." || part === ".." || /[<>:"|?*]/u.test(part) || /[ .]$/u.test(part) || !/^[\p{L}\p{N}\p{M}._ -]+$/u.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(part))) throw new Error("文件树包含不安全的相对路径。");
      const normalized = pieces.join("/");
      const collisionKey = normalized.toLocaleLowerCase("en-US");
      if (seen.has(collisionKey)) throw new Error(`文件树包含重复路径：${normalized}`);
      seen.add(collisionKey);
      const bytes = Buffer.byteLength(file.content, "utf8");
      if (bytes > textLimit || file.content.includes("\0")) throw new Error(`文件树只支持不超过 2 MiB 的 UTF-8 文本：${normalized}`);
      totalBytes += bytes;
      if (totalBytes > 8 * 1024 * 1024) throw new Error("文件树总大小超过 8 MiB 安全限制。");
      return { path: normalized, content: file.content, sha256: digest(file.content) };
    });
    const parent = dirname(path);
    await mkdir(parent, { recursive: true });
    const canonicalParent = await realpath(parent);
    assertWithin(root, canonicalParent);
    await assertOutsideDataRoot(canonicalParent);
    const stage = resolve(parent, `.lfaa-stage-${randomUUID()}`);
    await mkdir(stage, { recursive: false, mode: 0o700 });
    try {
      for (const file of files) {
        const destination = resolve(stage, ...file.path.split("/"));
        assertWithin(stage, destination);
        await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
        await checkedPath(root, destination, true);
        await writeFile(destination, file.content, { flag: "wx", mode: 0o600 });
      }
      await checkedPath(root, stage);
      try { await lstat(path); throw new Error("目标目录已存在；未覆盖现有 Skill 或其他文件。"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      await rename(stage, path);
      const installedPath = await realpath(path);
      assertWithin(root, installedPath);
      await assertOutsideDataRoot(installedPath);
      return { path: installedPath, created: true, files: files.map(file => ({ path: file.path, sha256: file.sha256, bytes: Buffer.byteLength(file.content, "utf8") })), totalBytes };
    } catch (error) {
      await rm(stage, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }
  const before = await readText(path);
  if (input.operation === "write") {
    if (typeof input.sha256 !== "string" || digest(before) !== input.sha256) throw new Error("文件已变化，请重新读取后再保存。");
    if (typeof input.content !== "string" || Buffer.byteLength(input.content, "utf8") > textLimit || input.content.includes("\0")) throw new Error("文件内容无效、包含二进制标记或超过 2 MiB。 ");
    const details = await lstat(path);
    if (details.isSymbolicLink() || !details.isFile()) throw new Error("变更审阅仅支持直接编辑普通文本文件，不支持符号链接或特殊文件。 ");
    const temporary = resolve(dirname(path), `.lfaa-edit-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, input.content, { encoding: "utf8", flag: "wx", mode: details.mode & 0o777 });
      await checkedPath(root, input.path);
      if (digest(await readText(path)) !== input.sha256) throw new Error("写入前文件已变化，请重新读取后再保存。");
      await rename(temporary, path);
      return { path, sha256: digest(input.content), changed: before !== input.content, bytes: Buffer.byteLength(input.content, "utf8") };
    } finally { await rm(temporary, { force: true }).catch(() => undefined); }
  }
  if (typeof input.sha256 !== "string" || digest(before) !== input.sha256) throw new Error("文件已变化，请重新读取后再修改。");
  if (typeof input.oldText !== "string" || !input.oldText.length || typeof input.newText !== "string") throw new Error("替换锚点或内容无效。");
  const index = before.indexOf(input.oldText);
  if (index < 0 || before.indexOf(input.oldText, index + 1) >= 0) throw new Error("替换锚点不存在或不唯一，未写入文件。");
  const after = before.slice(0, index) + input.newText + before.slice(index + input.oldText.length);
  if (Buffer.byteLength(after) > textLimit) throw new Error("修改后文件超过允许大小。");
  await checkedPath(root, input.path);
  if (digest(await readText(path)) !== input.sha256) throw new Error("写入前文件已变化，未覆盖其他修改。");
  await writeFile(path, after);
  return { path, sha256: digest(after), change: { oldText: input.oldText, newText: input.newText }, changed: before !== after };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let payload = process.argv[2];
    if (!payload) {
      payload = "";
      process.stdin.setEncoding("utf8");
      for await (const chunk of process.stdin) { payload += chunk; if (Buffer.byteLength(payload) > 8 * 1024 * 1024) throw new Error("项目任务输入过大。"); }
    }
    process.stdout.write(JSON.stringify(await executeProjectFile(JSON.parse(payload))));
  }
  catch (error) { process.stderr.write(error instanceof Error ? error.message : "项目文件操作失败。"); process.exitCode = 1; }
}

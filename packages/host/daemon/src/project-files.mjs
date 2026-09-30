/**
 * 功能：执行项目文件的真实读取、检索、创建和唯一锚点修改。
 * 作用：验证规范路径、拒绝越界符号链接，使用文件摘要检测并发修改，返回可核对的内容与差异。
 * 关联文件：daemon.mjs 的 project-files 任务执行器、core/tools/project-tools.ts；可作为独立 Node 任务运行。
 */
import { readFile, writeFile, realpath, stat, readdir, mkdir } from "node:fs/promises";
import { resolve, relative, dirname, isAbsolute, sep } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const textLimit = 2 * 1024 * 1024;
const digest = text => createHash("sha256").update(text).digest("hex");
function assertWithin(root, path) {
  const value = relative(root, path);
  if (value === ".." || value.startsWith(`..${sep}`) || isAbsolute(value)) throw new Error("文件路径超出本次项目根目录。");
}
async function checkedPath(root, value, create = false) {
  const path = resolve(root, value || ".");
  assertWithin(root, path);
  let ancestor = path;
  while (true) {
    try { const canonical = await realpath(ancestor); assertWithin(root, canonical); break; }
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
  if (!input || !["list", "read", "search", "create", "replace", "diff", "discover_skills"].includes(input.operation) || typeof input.rootDirectory !== "string" || !isAbsolute(input.rootDirectory)) throw new Error("项目操作或绝对根目录无效。");
  const root = await realpath(input.rootDirectory);
  const path = await checkedPath(root, input.path, input.operation === "create");
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
    const entries = await readdir(path, { withFileTypes: true });
    return { root, path, entries: entries.slice(0, 1000).map(entry => ({ name: entry.name, directory: entry.isDirectory(), symbolicLink: entry.isSymbolicLink() })), truncated: entries.length > 1000 };
  }
  if (input.operation === "read") { const content = await readText(path); const offset = Math.max(0, Number(input.offset) || 0); return { path, content: content.slice(offset, offset + 40000), offset, totalCharacters: content.length, truncated: offset + 40000 < content.length, sha256: digest(content) }; }
  if (input.operation === "search") {
    if (typeof input.query !== "string" || !input.query.length) throw new Error("检索文本不能为空。");
    const matches = []; let scanned = 0; let truncated = false;
    const walk = async directory => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink() || [".git", "node_modules", "dist"].includes(entry.name)) continue;
        if (scanned >= 2000 || matches.length >= 100) { truncated = true; return; }
        const child = resolve(directory, entry.name);
        if (entry.isDirectory()) await walk(child);
        else if (entry.isFile()) {
          scanned += 1;
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
  const before = await readText(path);
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

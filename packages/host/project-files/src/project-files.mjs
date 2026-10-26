/**
 * 功能：执行项目文件的真实读取、检索、创建、修改、删除和唯一锚点编辑。
 * 作用：验证规范路径、拒绝越界符号链接，使用文件摘要检测并发修改，返回可核对的内容与差异。
 * 关联文件：daemon.mjs 的 project-files 任务执行器、core/tools/project-tools.ts；可作为独立 Node 任务运行。
 */
import { createReadStream } from "node:fs";
import { readFile, writeFile, realpath, stat, lstat, readdir, mkdir, opendir, rename, rm, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, relative, dirname, basename, join, isAbsolute, sep, parse } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { promisify } from "node:util";

const textLimit = 2 * 1024 * 1024;
const projectDiffLimit = 2 * 1024 * 1024;
const projectDiffUntrackedFileLimit = 200;
const projectDiffUntrackedByteLimit = 1024 * 1024;
const projectPreviewFileLimit = 64 * 1024 * 1024;
const digest = text => createHash("sha256").update(text).digest("hex");
const execFileAsync = promisify(execFile);
let protectedDataRoot = process.env.LFAA_DAEMON_DATA_ROOT?.trim() ? resolve(process.env.LFAA_DAEMON_DATA_ROOT.trim()) : "";
let protectedDataRootPromise;
let protectedDataRootRealPath;
async function getProtectedDataRoot() {
  const daemonDataRoot = process.env.LFAA_DAEMON_DATA_ROOT?.trim();
  if (daemonDataRoot) return resolve(daemonDataRoot);
  if (protectedDataRoot) return protectedDataRoot;
  protectedDataRootPromise ??= import("lfaa-launch-environment/src/config.js").then(({ config }) => resolve(config.dataDirectory));
  protectedDataRoot = await protectedDataRootPromise;
  return protectedDataRoot;
}
function assertWithin(root, path) {
  const value = relative(root, path);
  if (value === ".." || value.startsWith(`..${sep}`) || isAbsolute(value)) throw new Error("文件路径超出本次项目根目录。");
}
async function assertOutsideDataRoot(path) {
  const dataRoot = await getProtectedDataRoot();
  if (!dataRoot) return;
  protectedDataRootRealPath ??= realpath(dataRoot).catch(() => dataRoot);
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
async function assertNearestPathOutsideDataRoot(path) {
  await assertOutsideDataRoot(resolve(path));
  let ancestor = resolve(path);
  while (true) {
    try {
      const canonical = await realpath(ancestor);
      await assertOutsideDataRoot(canonical);
      return;
    } catch (error) {
      if (error.code !== "ENOENT" || dirname(ancestor) === ancestor) throw error;
      ancestor = dirname(ancestor);
    }
  }
}
function readWindowsDocumentsRegistryValue() {
  const script = [
    "$ProgressPreference = 'SilentlyContinue'",
    "$utf8 = [System.Text.UTF8Encoding]::new($false)",
    "$OutputEncoding = $utf8",
    "[Console]::OutputEncoding = $utf8",
    "$value = (Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders').Personal",
    "[Console]::Out.Write([Environment]::ExpandEnvironmentVariables([string]$value))"
  ].join("\n");
  return execFileSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {
    encoding: "utf8", windowsHide: true, timeout: 3000, maxBuffer: 16 * 1024
  }).trim();
}

export function resolveWindowsDocumentsDirectory(value, environment = process.env) {
  const variables = new Map(Object.entries(environment).map(([key, variable]) => [key.toLocaleUpperCase("en-US"), variable ?? ""]));
  let unresolved = false;
  const directory = String(value ?? "").trim().replace(/%([^%]+)%/gu, (_token, name) => {
    const expanded = variables.get(name.toLocaleUpperCase("en-US"));
    if (!expanded) unresolved = true;
    return expanded ?? "";
  });
  if (unresolved || !isAbsolute(directory)) throw new Error("Windows 系统“文档”目录路径无效。 ");
  return resolve(directory);
}

function resolveSystemDocumentsDirectory() {
  if (process.platform === "win32") {
    return resolveWindowsDocumentsDirectory(readWindowsDocumentsRegistryValue());
  }
  if (process.platform === "darwin") return resolve(homedir(), "Documents");
  if (process.platform === "linux") {
    const directory = execFileSync("xdg-user-dir", ["DOCUMENTS"], { encoding: "utf8", windowsHide: true, timeout: 3000 }).trim();
    if (!isAbsolute(directory) || resolve(directory) === resolve(homedir())) throw new Error("系统没有启用“文档”目录，请在项目选择器中手动关联文件夹。 ");
    return resolve(directory);
  }
  throw new Error(`当前平台无法解析系统“文档”目录：${process.platform}`);
}

/** 动态解析系统“文档”目录下 lfaa 默认工作区；解析器仅供隔离回归注入，不接受任务输入。 */
export async function resolveDefaultWorkspaceDirectory(resolveDocuments = resolveSystemDocumentsDirectory) {
  const documents = resolveDocuments();
  if (typeof documents !== "string" || !isAbsolute(documents)) throw new Error("系统“文档”目录必须是绝对路径。 ");
  await assertNearestPathOutsideDataRoot(documents);
  const canonicalDocuments = await realpath(documents);
  await assertOutsideDataRoot(canonicalDocuments);
  const requested = resolve(canonicalDocuments, "lfaa", "default-workspace");
  await assertNearestPathOutsideDataRoot(requested);
  try {
    const details = await lstat(requested);
    if (details.isSymbolicLink()) throw new Error("默认工作区目标不能是符号链接；为保护目录归属，未继续。 ");
    if (!details.isDirectory()) throw new Error("默认工作区路径不是文件夹。 ");
    const canonical = await realpath(requested);
    await assertOutsideDataRoot(canonical);
    if (!samePath(canonical, requested)) throw new Error("默认工作区目标解析到其他位置；为保护目录归属，未继续。 ");
    return requested;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return requested;
  }
}

/** 解析默认工作区路径并报告其是否真实存在；读取路径时不自动创建目录。 */
export async function inspectDefaultWorkspaceDirectory(resolveDocuments = resolveSystemDocumentsDirectory) {
  const path = await resolveDefaultWorkspaceDirectory(resolveDocuments);
  try { return { path, directory: (await stat(path)).isDirectory() }; }
  catch (error) {
    if (error.code === "ENOENT") return { path, directory: false };
    throw error;
  }
}

/** 创建首次默认项目目录；系统“文档”由运行时解析，不接受用户传入的目标绝对路径。 */
export async function createDefaultWorkspaceDirectory(resolveDocuments = resolveSystemDocumentsDirectory) {
  const requested = await resolveDefaultWorkspaceDirectory(resolveDocuments);
  await assertNearestPathOutsideDataRoot(requested);
  await mkdir(dirname(requested), { recursive: true });
  await mkdir(requested, { recursive: true });
  const canonical = await realpath(requested);
  await assertOutsideDataRoot(canonical);
  if (!(await stat(canonical)).isDirectory()) throw new Error("默认工作区路径不是文件夹。 ");
  return requested;
}

function samePath(left, right) {
  const a = resolve(left), b = resolve(right);
  return process.platform === "win32" ? a.toLocaleLowerCase("en-US") === b.toLocaleLowerCase("en-US") : a === b;
}

async function readBoundedDirectory(path, limit = 5000, signal) {
  const directory = await opendir(path);
  const entries = [];
  let truncated = false;
  for await (const entry of directory) {
    signal?.throwIfAborted();
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
// 活动记录只消费经 Daemon 校验后的项目相对路径，避免把节点绝对路径传到浏览器。
function toProjectRelativePath(root, path) {
  return relative(root, path).split(sep).join("/");
}
async function readText(path, signal) {
  signal?.throwIfAborted();
  const details = await stat(path);
  if (!details.isFile() || details.size > textLimit) throw new Error("仅支持不超过 2 MiB 的普通文本文件。");
  const bytes = await readFile(path, signal ? { signal } : undefined);
  signal?.throwIfAborted();
  if (bytes.includes(0)) throw new Error("文件包含二进制数据，不能按文本处理。");
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
}

const projectPreviewContentTypes = new Map([
  [".avif", "image/avif"], [".css", "text/css; charset=utf-8"], [".gif", "image/gif"], [".htm", "text/html; charset=utf-8"],
  [".html", "text/html; charset=utf-8"], [".ico", "image/x-icon"], [".jpeg", "image/jpeg"], [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".mjs", "text/javascript; charset=utf-8"],
  [".mp3", "audio/mpeg"], [".mp4", "video/mp4"], [".png", "image/png"], [".svg", "image/svg+xml"], [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"], [".woff", "font/woff"], [".woff2", "font/woff2"]
]);

/**
 * 为当前已授权的工作区 HTML 建立只读、仅回环可访问的短期预览源。
 * 所有资源路径仍通过 Project Files Owner 校验，服务不提供目录列表或写入方法。
 */
export async function createProjectPreviewServer(rootDirectory, entryPath) {
  if (typeof rootDirectory !== "string" || !isAbsolute(rootDirectory) || typeof entryPath !== "string" || !entryPath.trim()) {
    throw new Error("项目预览必须绑定有效的工作区根目录和 HTML 文件。");
  }
  const root = await realpath(resolve(rootDirectory));
  await assertOutsideDataRoot(root);
  if (!(await stat(root)).isDirectory()) throw new Error("项目预览根目录不是现有文件夹。");
  const entry = await checkedPath(root, entryPath);
  const canonicalEntry = await realpath(entry);
  assertWithin(root, canonicalEntry);
  await assertOutsideDataRoot(canonicalEntry);
  const entryDetails = await stat(canonicalEntry);
  if (!entryDetails.isFile() || !new Set([".html", ".htm"]).has(parse(canonicalEntry).ext.toLowerCase())) {
    throw new Error("项目预览只支持工作区内的普通 HTML/HTM 文件。");
  }

  let port = 0;
  let closed = false;
  const server = createServer((request, response) => {
    void (async () => {
      const host = request.headers.host;
      if (host !== `127.0.0.1:${port}` || !["GET", "HEAD"].includes(request.method ?? "")) {
        response.writeHead(host === `127.0.0.1:${port}` ? 405 : 421, { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        response.end();
        return;
      }
      let pathname;
      try { pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${host}`).pathname); }
      catch { response.writeHead(400, { "Cache-Control": "no-store" }); response.end(); return; }
      const relativePath = pathname.replace(/^\/+/, "");
      if (!relativePath || relativePath.includes("\\") || relativePath.includes("\0")) {
        response.writeHead(404, { "Cache-Control": "no-store" }); response.end(); return;
      }
      let candidate = resolve(root, ...relativePath.split("/"));
      try {
        assertWithin(root, candidate);
        let canonical = await realpath(candidate);
        assertWithin(root, canonical);
        await assertOutsideDataRoot(canonical);
        let details = await stat(canonical);
        if (details.isDirectory()) {
          candidate = resolve(canonical, "index.html");
          canonical = await realpath(candidate);
          assertWithin(root, canonical);
          await assertOutsideDataRoot(canonical);
          details = await stat(canonical);
        }
        if (!details.isFile() || details.size > projectPreviewFileLimit) {
          response.writeHead(details.size > projectPreviewFileLimit ? 413 : 404, { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
          response.end();
          return;
        }
        const headers = {
          "Cache-Control": "no-store",
          "Content-Length": String(details.size),
          "Content-Security-Policy": "default-src 'self' data: blob:; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; form-action 'self'; frame-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
          "Content-Type": projectPreviewContentTypes.get(parse(canonical).ext.toLowerCase()) ?? "application/octet-stream",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff"
        };
        response.writeHead(200, headers);
        if (request.method === "HEAD") { response.end(); return; }
        const stream = createReadStream(canonical);
        stream.on("error", () => { if (!response.headersSent) response.writeHead(404); response.destroy(); });
        stream.pipe(response);
      } catch (error) {
        const status = error?.code === "ENOENT" ? 404 : 403;
        response.writeHead(status, { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        response.end();
      }
    })();
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", rejectListen);
      const address = server.address();
      if (!address || typeof address === "string") { rejectListen(new Error("项目预览服务没有取得有效的本机端口。")); return; }
      port = address.port;
      resolveListen();
    });
  });
  server.unref();
  const relativeEntry = relative(root, canonicalEntry).split(sep).map(encodeURIComponent).join("/");
  return {
    url: `http://127.0.0.1:${port}/${relativeEntry}`,
    async close() {
      if (closed) return;
      closed = true;
      await new Promise(resolveClose => server.close(() => resolveClose()));
    }
  };
}

function projectGitEnvironment() {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (/^GIT_(?:DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|CONFIG(?:_|$)|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NAMESPACE)$/iu.test(name)) delete environment[name];
  }
  environment.GIT_CONFIG_COUNT = "0";
  environment.GIT_TERMINAL_PROMPT = "0";
  environment.GIT_OPTIONAL_LOCKS = "0";
  environment.LC_ALL = "C";
  return environment;
}

async function projectGitOutput(root, args, maxBuffer = projectDiffLimit + 8192, timeout = 12_000) {
  const result = await execFileAsync("git", ["--no-pager", "-c", "core.fsmonitor=false", "-C", root, ...args], {
    encoding: "utf8", windowsHide: true, timeout, maxBuffer, env: projectGitEnvironment()
  });
  return result.stdout;
}

/** `git diff --no-index` returns 1 when it successfully found a difference. */
async function projectGitDiffOutput(root, args, timeout) {
  try { return await projectGitOutput(root, args, projectDiffLimit + 8192, timeout); }
  catch (error) {
    if (error?.code === 1 && typeof error.stdout === "string" && error.stdout.length > 0) return error.stdout;
    throw error;
  }
}

function projectGitPathspec(value) {
  return `:(literal)${value.replaceAll("\\", "/")}`;
}

async function readProjectGitDiff(root, selectedPath) {
  const deadline = Date.now() + 12_000;
  const remainingTime = () => Math.max(1, deadline - Date.now());
  const relativePath = relative(root, selectedPath).split(sep).join("/");
  const selected = relativePath && relativePath !== "." ? projectGitPathspec(relativePath) : "";
  const trackedArgs = ["diff", "--no-ext-diff", "--no-textconv", "--"];
  if (selected) trackedArgs.push(selected);
  let diff = await projectGitOutput(root, trackedArgs, 8 * 1024 * 1024, remainingTime());
  let diffBytes = Buffer.byteLength(diff, "utf8");
  let diffTruncated = false;
  if (diffBytes > projectDiffLimit) {
    diff = Buffer.from(diff, "utf8").subarray(0, projectDiffLimit).toString("utf8");
    diffBytes = Buffer.byteLength(diff, "utf8");
    diffTruncated = true;
  }

  const statusArgs = ["status", "--porcelain=v1", "-z", "--untracked-files=all"];
  if (selected) statusArgs.push("--", selected);
  const status = await projectGitOutput(root, statusArgs, 8 * 1024 * 1024, remainingTime());
  let untrackedFiles = 0;
  let untrackedBytes = 0;
  for (const row of status.split("\0")) {
    if (!row.startsWith("?? ")) continue;
    const file = row.slice(3);
    if (Date.now() >= deadline) { diffTruncated = true; break; }
    untrackedFiles += 1;
    if (untrackedFiles > projectDiffUntrackedFileLimit || untrackedBytes >= projectDiffUntrackedByteLimit || diffBytes >= projectDiffLimit) {
      diffTruncated = true;
      break;
    }
    try {
      const filePath = await checkedPath(root, file);
      const details = await lstat(filePath);
      if (details.isSymbolicLink() || !details.isFile() || details.size > projectDiffUntrackedByteLimit - untrackedBytes) {
        diffTruncated = true;
        continue;
      }
      untrackedBytes += details.size;
      const content = await readText(filePath);
      const piece = await projectGitDiffOutput(root, ["diff", "--no-index", "--no-ext-diff", "--no-textconv", "--unified=3", "--", process.platform === "win32" ? "NUL" : "/dev/null", file.replaceAll("\\", "/")], remainingTime());
      if (/\bBinary files\b/u.test(piece)) {
        diffTruncated = true;
        continue;
      }
      const pieceBytes = Buffer.byteLength(piece, "utf8");
      const remainingDiffBytes = projectDiffLimit - diffBytes;
      if (pieceBytes > remainingDiffBytes || Buffer.byteLength(content, "utf8") !== details.size) diffTruncated = true;
      const outputBytes = Math.min(pieceBytes, remainingDiffBytes);
      diff += Buffer.from(piece, "utf8").subarray(0, outputBytes).toString("utf8");
      diffBytes = Buffer.byteLength(diff, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      diffTruncated = true;
    }
  }
  return { diff, diffTruncated };
}

export async function executeProjectFile(input, { signal } = {}) {
  signal?.throwIfAborted();
  if (input?.operation === "resolve_default_workspace") return await inspectDefaultWorkspaceDirectory();
  if (input?.operation === "initialize_default_workspace") return { path: await createDefaultWorkspaceDirectory() };
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
    const listed = await readBoundedDirectory(canonical, 5000, signal);
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
  if (input?.operation === "inspect_directories") {
    const paths = input.paths;
    if (!Array.isArray(paths) || paths.length > 200 || paths.some(path => typeof path !== "string" || path.length > 32760 || !isAbsolute(path))) {
      throw new Error("项目目录检查列表无效。");
    }
    const directories = new Array(paths.length);
    let nextIndex = 0;
    const inspections = await Promise.allSettled(Array.from({ length: Math.min(8, paths.length) }, async () => {
      while (nextIndex < paths.length) {
        const index = nextIndex++;
        const path = resolve(paths[index]);
        await assertOutsideDataRoot(path);
        try {
          const canonical = await realpath(path);
          await assertOutsideDataRoot(canonical);
          directories[index] = (await stat(canonical)).isDirectory();
        } catch (error) {
          if (error?.code === "ENOENT" || error?.code === "ENOTDIR") directories[index] = false;
          else throw error;
        }
      }
    }));
    const failedInspection = inspections.find(result => result.status === "rejected");
    if (failedInspection) throw failedInspection.reason;
    return { directories };
  }
  if (!input || !["list", "read", "read_lines", "read_image", "search_files", "search", "search_markdown", "create", "create_tree", "replace", "write", "delete", "diff", "discover_skills"].includes(input.operation) || typeof input.rootDirectory !== "string" || !isAbsolute(input.rootDirectory)) throw new Error("项目操作或绝对根目录无效。");
  const root = await realpath(input.rootDirectory);
  await assertOutsideDataRoot(root);
  const path = await checkedPath(root, input.path, input.operation === "create" || input.operation === "create_tree");
  if (input.operation === "delete") {
    if (typeof input.path !== "string" || input.path.trim() === "" || path === root) throw new Error("删除必须指定项目根目录内的普通文件路径。 ");
    const initial = await lstat(path);
    if (initial.isSymbolicLink() || !initial.isFile()) throw new Error("删除仅支持普通文件，不支持符号链接或目录。 ");
    await checkedPath(root, input.path);
    const current = await lstat(path);
    if (current.isSymbolicLink() || !current.isFile() || current.dev !== initial.dev || current.ino !== initial.ino) throw new Error("删除前目标文件已变化；未删除。 ");
    await unlink(path);
    return { path, relativePath: toProjectRelativePath(root, path), deleted: true };
  }
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
    const listed = await readBoundedDirectory(path, 5000, signal);
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
  if (input.operation === "read_image") {
    // 任务输出协议上限 1 MiB，图像字节限制为 512 KiB，为 JSON/base64 留出空间。
    const info = await stat(path);
    if (!info.isFile() || info.size > 512 * 1024) throw new Error("图像必须是 512 KiB 以内的普通 PNG/JPEG/WebP 文件，请先缩小图像。");
    const bytes = await readFile(path, signal ? { signal } : undefined);
    if (bytes.length > 512 * 1024) throw new Error("读取期间图像超过大小限制。");
    const mimeType = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png"
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "image/jpeg"
      : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" ? "image/webp" : null;
    if (!mimeType) throw new Error("文件不是受支持的 PNG/JPEG/WebP 图像。");
    return { path, relativePath: toProjectRelativePath(root, path), bytes: bytes.length, content: [{ type: "image", mimeType, data: bytes.toString("base64") }] };
  }
  if (input.operation === "read_lines") {
    const content = await readText(path, signal);
    const offset = input.lineOffset ?? 1, limit = input.lineLimit ?? 2000;
    if (!Number.isSafeInteger(offset) || offset < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 2000) throw new Error("读取行范围无效。");
    const lines = content.split(/\r?\n/u), selected = []; let size = 0;
    for (let index = offset - 1; index < Math.min(lines.length, offset - 1 + limit); index++) {
      const line = `${index + 1}: ${lines[index].slice(0, 2000)}`;
      size += Buffer.byteLength(line);
      if (size > 40000) break;
      selected.push(line);
    }
    return { path, relativePath: toProjectRelativePath(root, path), content: selected.join("\n"), totalLines: lines.length, nextLine: offset + selected.length, truncated: offset - 1 + selected.length < lines.length, sha256: digest(content) };
  }
  if (input.operation === "read") {
    const content = await readText(path, signal);
    const offset = Math.max(0, Number(input.offset) || 0);
    const requestedLimit = Number.isInteger(input.limit) ? input.limit : 40000;
    const limit = Math.max(1, Math.min(requestedLimit, 100000));
    return { path, relativePath: toProjectRelativePath(root, path), content: content.slice(offset, offset + limit), offset, totalCharacters: content.length, truncated: offset + limit < content.length, sha256: digest(content) };
  }
  if (input.operation === "search" || input.operation === "search_markdown" || input.operation === "search_files") {
    if (typeof input.query !== "string" || !input.query.length) throw new Error("检索文本不能为空。");
    const markdownOnly = input.operation === "search_markdown";
    const filenameOnly = input.operation === "search_files";
    if (input.query.length > 500) throw new Error("检索文本过长。");
    const filePattern = filenameOnly ? new RegExp(`^${input.query.replace(/[.+^${}()|[\]\\]/gu, "\\$&").replaceAll("*", ".*").replaceAll("?", ".")}$`, "iu") : null;
    const matches = []; let scanned = 0; let directories = 0; let truncated = false;
    const walk = async directory => {
      signal?.throwIfAborted();
      if (directories >= 1000) { truncated = true; return; }
      directories += 1;
      const listing = await readBoundedDirectory(directory, 256, signal);
      if (listing.truncated) truncated = true;
      for (const entry of listing.entries) {
        signal?.throwIfAborted();
        if (scanned >= 2000 || matches.length >= 100) { truncated = true; return; }
        if (entry.isSymbolicLink() || [".git", "node_modules", "dist"].includes(entry.name.toLocaleLowerCase("en-US"))) continue;
        const child = resolve(directory, entry.name);
        try { await assertOutsideDataRoot(child); } catch { continue; }
        if (entry.isDirectory()) await walk(child);
        else if (entry.isFile()) {
          scanned += 1;
          if (filenameOnly) { if (filePattern.test(entry.name)) matches.push({ path: relative(root, child) }); continue; }
          if (markdownOnly && !/\.(?:md|markdown)$/iu.test(entry.name)) continue;
          let content;
          try { content = await readText(child, signal); } catch (error) { if (signal?.aborted) throw error; continue; }
          const lines = content.split(/\r?\n/u);
          for (let index = 0; index < lines.length && matches.length < 100; index += 1) if (lines[index].includes(input.query)) matches.push({ path: relative(root, child), line: index + 1, text: lines[index].slice(0, 1000) });
        }
      }
    };
    await walk(path); return { root, matches, scanned, truncated };
  }
  if (input.operation === "diff") return { path, ...(await readProjectGitDiff(root, path)) };
  if (input.operation === "create") {
    if (typeof input.content !== "string" || Buffer.byteLength(input.content) > textLimit) throw new Error("文件内容无效或超过允许大小。");
    await mkdir(dirname(path), { recursive: true });
    await checkedPath(root, input.path, true);
    await writeFile(path, input.content, { flag: "wx" });
    return { path, relativePath: toProjectRelativePath(root, path), created: true, sha256: digest(input.content) };
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
      let contents;
      if (file.encoding === "base64") {
        if (file.content.length > 3 * 1024 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(file.content)) throw new Error(`文件树包含无效或过大的 base64 文件：${normalized}`);
        contents = Buffer.from(file.content, "base64");
        if (contents.toString("base64") !== file.content) throw new Error(`文件树包含非规范 base64 文件：${normalized}`);
      } else {
        if (file.encoding !== undefined) throw new Error(`文件树编码类型无效：${normalized}`);
        if (Buffer.byteLength(file.content, "utf8") > textLimit || file.content.includes("\0")) throw new Error(`文件树 UTF-8 文本超过 2 MiB 或包含二进制标记：${normalized}`);
        contents = Buffer.from(file.content, "utf8");
      }
      const bytes = contents.byteLength;
      if (bytes > textLimit) throw new Error(`文件树单文件超过 2 MiB：${normalized}`);
      totalBytes += bytes;
      if (totalBytes > 8 * 1024 * 1024) throw new Error("文件树总大小超过 8 MiB 安全限制。");
      return { path: normalized, contents, sha256: digest(contents) };
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
        await writeFile(destination, file.contents, { flag: "wx", mode: 0o600 });
      }
      await checkedPath(root, stage);
      try { await lstat(path); throw new Error("目标目录已存在；未覆盖现有 Skill 或其他文件。"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      await rename(stage, path);
      const installedPath = await realpath(path);
      assertWithin(root, installedPath);
      await assertOutsideDataRoot(installedPath);
      const relativeBase = toProjectRelativePath(root, installedPath);
      return { path: installedPath, relativePath: relativeBase, created: true, files: files.map(file => ({ path: file.path, relativePath: `${relativeBase}/${file.path}`, sha256: file.sha256, bytes: file.contents.byteLength })), totalBytes };
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
      return { path, relativePath: toProjectRelativePath(root, path), sha256: digest(input.content), changed: before !== input.content, bytes: Buffer.byteLength(input.content, "utf8") };
    } finally { await rm(temporary, { force: true }).catch(() => undefined); }
  }
  if (typeof input.sha256 !== "string") throw new Error("修改已有文件必须提供最近读取的 sha256 摘要。");
  if (digest(before) !== input.sha256) throw new Error("文件已变化，请重新读取后再修改。");
  if (typeof input.oldText !== "string" || !input.oldText.length || typeof input.newText !== "string") throw new Error("替换锚点或内容无效。");
  const index = before.indexOf(input.oldText);
  if (index < 0 || input.replace_all !== true && before.indexOf(input.oldText, index + 1) >= 0) throw new Error("替换锚点不存在或不唯一，未写入文件。");
  const after = input.replace_all === true ? before.replaceAll(input.oldText, input.newText) : before.slice(0, index) + input.newText + before.slice(index + input.oldText.length);
  if (Buffer.byteLength(after) > textLimit) throw new Error("修改后文件超过允许大小。");
  await checkedPath(root, input.path);
  if (digest(await readText(path)) !== input.sha256) throw new Error("写入前文件已变化，未覆盖其他修改。");
  await writeFile(path, after);
  return { path, relativePath: toProjectRelativePath(root, path), sha256: digest(after), change: { oldText: input.oldText, newText: input.newText }, changed: before !== after };
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

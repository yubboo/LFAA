/**
 * 功能：查询并下载固定到提交号的 GitHub 插件源码。
 * 作用：只访问 GitHub 官方 API 与其源码分发域名，限制响应大小和重定向，绝不执行仓库脚本。
 * 关联文件：index.ts 负责插件合同与持久化；zip-archive.ts 校验源码归档。
 */
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "lfaa-launch-environment/src/config.js";
import { runPackageProcess } from "./package-process.js";
import { packageContentFilter } from "./package-content.js";
import { downloadPublishedFiles, needsPublishedFiles } from "./npm-source.js";
import { readGithubZip, type PluginArchiveFile } from "./zip-archive.js";

const API_ROOT = "https://api.github.com";
const ARCHIVE_ROOT = "https://codeload.github.com";
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;

export interface GitHubRepository { owner: string; name: string; fullName: string; description: string; stars: number; license: string | null; defaultBranch: string; url: string }
export interface GitHubSnapshot { repository: GitHubRepository; requestedRef: string; commit: string; archiveSha256: string; files: PluginArchiveFile[]; skillRoots?: string[] }
export interface GitHubCandidate extends GitHubRepository { updatedAt: string }

/** Skill 来源下载与 Capability Skill 校验共用同一组文件边界。 */
export const GITHUB_SKILL_SOURCE_LIMITS = Object.freeze({ files: 128, totalBytes: 5 * 1024 * 1024, fileBytes: 2 * 1024 * 1024 });
const MAX_GITHUB_TREE_BYTES = 16 * 1024 * 1024;

export function parseGithubRepositoryUrl(value: string): { owner: string; name: string } {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("插件来源必须是 GitHub 仓库 HTTPS 地址。"); }
  if (url.protocol !== "https:" || url.hostname.toLocaleLowerCase("en-US") !== "github.com" || url.port || url.username || url.password || url.search || url.hash) {
    throw new Error("插件来源只允许无凭据的 GitHub HTTPS 仓库地址。");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) throw new Error("插件来源地址必须指向 GitHub 仓库根目录。");
  const owner = parts[0]!;
  const name = parts[1]!.replace(/\.git$/iu, "");
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37})$/u.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/u.test(name) || name === "." || name === "..") {
    throw new Error("GitHub 仓库标识格式无效。");
  }
  return { owner, name };
}

export async function searchGithubRepositories(query: string): Promise<GitHubCandidate[]> {
  const normalized = query.trim();
  if (!normalized || normalized.length > 120 || /[\r\n\0]/u.test(normalized)) throw new Error("插件搜索词长度或格式无效。");
  const url = new URL(`${API_ROOT}/search/repositories`);
  url.searchParams.set("q", normalized);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "8");
  const response = await fetch(url, { headers: githubHeaders(), redirect: "error", signal: AbortSignal.timeout(20_000) });
  const payload = await readJson(response);
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items.flatMap((item: unknown) => {
    if (!isRecord(item) || typeof item.full_name !== "string" || typeof item.html_url !== "string" || typeof item.default_branch !== "string") return [];
    const [owner, name] = item.full_name.split("/");
    if (!owner || !name || !item.html_url.startsWith("https://github.com/")) return [];
    const license = isRecord(item.license) && typeof item.license.spdx_id === "string" && item.license.spdx_id !== "NOASSERTION" ? item.license.spdx_id : null;
    return [{
      owner, name, fullName: item.full_name,
      description: typeof item.description === "string" ? item.description.slice(0, 500) : "",
      stars: typeof item.stargazers_count === "number" ? item.stargazers_count : 0,
      license, defaultBranch: item.default_branch, url: item.html_url,
      updatedAt: typeof item.updated_at === "string" ? item.updated_at : ""
    }];
  });
}

export async function downloadGithubSnapshot(repositoryUrl: string, requestedRef?: string, signal?: AbortSignal): Promise<GitHubSnapshot> {
  return downloadGithubSourceSnapshot(repositoryUrl, requestedRef, signal, "plugin");
}

/** 列出仓库内的 Skill 根目录，并只读取用户选中的固定提交 Skill 子树。 */
export async function downloadGithubRepositorySnapshot(repositoryUrl: string, requestedRef?: string, signal?: AbortSignal, sourcePath?: string): Promise<GitHubSnapshot> {
  return downloadGithubSourceSnapshot(repositoryUrl, requestedRef, signal, "repository", sourcePath);
}

async function downloadGithubSourceSnapshot(repositoryUrl: string, requestedRef: string | undefined, signal: AbortSignal | undefined, purpose: "plugin" | "repository", sourcePath?: string): Promise<GitHubSnapshot> {
  signal?.throwIfAborted();
  parseGithubRepositoryUrl(repositoryUrl);
  if (requestedRef && (requestedRef.length > 200 || requestedRef.startsWith("-") || /[\r\n\0]/u.test(requestedRef))) throw new Error("插件版本或分支标识无效。");
  const sourceSignal = purpose === "repository" ? requestSignal(signal, 120_000) : signal;
  try { return await downloadGithubHttpSnapshot(repositoryUrl, requestedRef, sourceSignal, purpose, sourcePath); }
  catch (error) {
    sourceSignal?.throwIfAborted();
    // GitHub API 限流和 codeload 连接失败不代表仓库不可安装。沿 DSH 的 Git 传输访问原仓库，绝不查找本项目旧副本。
    if (!(error instanceof Error) || !(error.name === "TimeoutError" || error.name === "AbortError" || /fetch failed|请求频率受限|源码快照下载失败/u.test(error.message))) throw error;
    return downloadGithubGitSnapshot(repositoryUrl, requestedRef, sourceSignal, purpose, sourcePath);
  }
}

async function downloadGithubHttpSnapshot(repositoryUrl: string, requestedRef: string | undefined, signal: AbortSignal | undefined, purpose: "plugin" | "repository", sourcePath?: string): Promise<GitHubSnapshot> {
  const { owner, name } = parseGithubRepositoryUrl(repositoryUrl);
  const repositoryResponse = await fetch(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, {
    headers: githubHeaders(), redirect: "error", signal: requestSignal(signal, 20_000)
  });
  const repositoryData = await readJson(repositoryResponse);
  if (typeof repositoryData.default_branch !== "string" || typeof repositoryData.full_name !== "string") throw new Error("GitHub 未返回有效仓库清单。");
  const selectedRef = requestedRef?.trim() || repositoryData.default_branch;
  if (selectedRef.length > 200 || selectedRef.startsWith("-") || /[\r\n\0]/u.test(selectedRef)) throw new Error("插件版本或分支标识无效。");
  const commitResponse = await fetch(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits/${encodeURIComponent(selectedRef)}`, {
    headers: githubHeaders(), redirect: "error", signal: requestSignal(signal, 20_000)
  });
  const commitData = await readJson(commitResponse);
  const commit = commitData.sha;
  if (typeof commit !== "string" || !/^[a-f0-9]{40}$/iu.test(commit)) throw new Error("插件引用没有解析为固定的 Git 提交号。");

  const repository: GitHubRepository = {
    owner, name, fullName: repositoryData.full_name,
    description: typeof repositoryData.description === "string" ? repositoryData.description.slice(0, 500) : "",
    stars: typeof repositoryData.stargazers_count === "number" ? repositoryData.stargazers_count : 0,
    license: isRecord(repositoryData.license) && typeof repositoryData.license.spdx_id === "string" && repositoryData.license.spdx_id !== "NOASSERTION" ? repositoryData.license.spdx_id : null,
    defaultBranch: repositoryData.default_branch,
    url: `https://github.com/${owner}/${name}`
  };
  if (purpose === "repository") return downloadGithubSkillFiles(repository, selectedRef, commit, signal, sourcePath);

  const archiveUrl = `${ARCHIVE_ROOT}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/zip/${commit}`;
  const archiveResponse = await fetch(archiveUrl, { headers: { "User-Agent": "LFAA-Plugin-Manager", Accept: "application/zip" }, redirect: "error", signal: requestSignal(signal, 5_000) });
  if (!archiveResponse.ok) throw new Error(`GitHub 源码快照下载失败（HTTP ${archiveResponse.status}）。`);
  const length = Number(archiveResponse.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_ARCHIVE_BYTES) throw new Error("插件源码快照超过 64 MiB 限制。");
  if (!archiveResponse.body) throw new Error("GitHub 未返回插件源码内容。");
  const reader = archiveResponse.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.length;
      if (size > MAX_ARCHIVE_BYTES) throw new Error("插件源码快照超过 64 MiB 限制。");
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  const archive = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
  if (archive[0] !== 0x50 || archive[1] !== 0x4b) throw new Error("GitHub 返回的内容不是 ZIP 源码快照。");
  const snapshot: GitHubSnapshot = { repository, requestedRef: selectedRef, commit, archiveSha256: createHash("sha256").update(archive).digest("hex"), files: readGithubZip(archive) };
  signal?.throwIfAborted();
  // Some package repositories intentionally omit generated `lib/` outputs from Git;
  // use the published artifact only when NPM proves it belongs to this exact commit.
  return purpose === "plugin" && needsPublishedFiles(snapshot) ? downloadPublishedFiles(snapshot, signal) : snapshot;
}

async function downloadGithubSkillFiles(repository: GitHubRepository, requestedRef: string, commit: string, signal: AbortSignal | undefined, sourcePath?: string): Promise<GitHubSnapshot> {
  const { owner, name } = repository;
  const treeUrl = `${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/trees/${encodeURIComponent(commit)}?recursive=1`;
  const treeResponse = await fetch(treeUrl, { headers: githubHeaders(), redirect: "error", signal: requestSignal(signal, 20_000) });
  const treeData = await readJson(treeResponse, MAX_GITHUB_TREE_BYTES);
  if (!Array.isArray(treeData.tree) || treeData.truncated === true) throw new Error("GitHub 仓库文件树不完整；不能安全检查 Skill。");
  const entries = parseApiTree(treeData.tree);
  const skillRoots = getSkillRoots(entries.map(entry => entry.path));
  if (sourcePath === undefined) return createSkillSnapshot(repository, requestedRef, commit, skillRoots, []);

  const normalizedPath = normalizeRepositoryPath(sourcePath);
  if (!skillRoots.includes(normalizedPath)) throw new Error(normalizedPath ? `仓库中未找到 ${normalizedPath}/SKILL.md。` : "仓库快照中未发现 SKILL.md。");
  const selectedEntries = selectSkillTreeEntries(entries, normalizedPath);
  const files = await downloadGithubSkillTreeFiles(repository, commit, selectedEntries, signal);
  return createSkillSnapshot(repository, requestedRef, commit, skillRoots, files);
}

async function downloadGithubSkillTreeFiles(repository: GitHubRepository, commit: string, entries: GitHubSkillTreeEntry[], signal: AbortSignal | undefined): Promise<PluginArchiveFile[]> {
  const files: PluginArchiveFile[] = [];
  let totalBytes = 0;
  for (const entry of entries) {
    signal?.throwIfAborted();
    const rawPath = entry.path.split("/").map(encodeURIComponent).join("/");
    const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/${commit}/${rawPath}`;
    const response = await fetch(rawUrl, { headers: { "User-Agent": "LFAA-Skill-Source", Accept: "application/octet-stream" }, redirect: "error", signal: requestSignal(signal, 20_000) });
    if (response.status === 403 || response.status === 429) throw new Error("GitHub 请求频率受限；稍后重试。");
    if (!response.ok) throw new Error(`GitHub Skill 文件读取失败（HTTP ${response.status}）：${entry.path}`);
    const contents = await readResponseBytes(response, GITHUB_SKILL_SOURCE_LIMITS.fileBytes, signal);
    if ((entry.size !== null && contents.length !== entry.size) || gitBlobSha(contents) !== entry.sha) throw new Error(`固定提交的 GitHub Skill 文件校验失败：${entry.path}`);
    totalBytes += contents.length;
    if (totalBytes > GITHUB_SKILL_SOURCE_LIMITS.totalBytes) throw new Error("Skill 文件总大小超过 5 MiB 安全限制；没有安装。");
    files.push({ path: entry.path, contents });
  }
  return files;
}

/** Git 只取当前引用；插件按包清单导出，通用资料读取导出有界源码归档。 */
async function downloadGithubGitSnapshot(repositoryUrl: string, requestedRef: string | undefined, signal: AbortSignal | undefined, purpose: "plugin" | "repository", sourcePath?: string): Promise<GitHubSnapshot> {
  signal?.throwIfAborted();
  const { owner, name } = parseGithubRepositoryUrl(repositoryUrl);
  const temporaryRoot = resolve(config.repositoryRoot, "dist", ".tmp", "plugin-downloads");
  mkdirSync(temporaryRoot, { recursive: true });
  const directory = mkdtempSync(resolve(temporaryRoot, "git-"));
  try {
    const git = async (args: string[], limit?: number) => {
      signal?.throwIfAborted();
      const output = await runPackageProcess("git", ["-c", "protocol.file.allow=never", ...args], directory, limit, signal);
      signal?.throwIfAborted();
      return output;
    };
    await git(["init", "--quiet"]);
    await git(["remote", "add", "origin", `https://github.com/${owner}/${name}.git`]);
    await git(["fetch", "--quiet", "--depth=1", "--filter=blob:none", "origin", requestedRef?.trim() || "HEAD"]);
    const commit = (await git(["rev-parse", "FETCH_HEAD"])).toString("utf8").trim();
    if (!/^[a-f0-9]{40}$/u.test(commit)) throw new Error("Git 没有返回固定提交。");
    let archive: Buffer;
    let repository: GitHubRepository;
    if (purpose === "repository") {
      repository = { owner, name, fullName: `${owner}/${name}`, url: `https://github.com/${owner}/${name}`, description: "", stars: 0, license: null, defaultBranch: requestedRef?.trim() || "HEAD" };
      // `-l` asks Git to read every blob size. In blobless mode that triggers a lazy network fetch
      // for each file and can leave Git descendants running after the Agent request times out.
      const treeBuffer = await git(["ls-tree", "-r", "-z", commit], MAX_GITHUB_TREE_BYTES);
      const entries = parseGithubGitTree(treeBuffer);
      const skillRoots = getSkillRoots(entries.map(entry => entry.path));
      if (sourcePath === undefined) return createSkillSnapshot(repository, requestedRef?.trim() || "HEAD", commit, skillRoots, []);
      const normalizedPath = normalizeRepositoryPath(sourcePath);
      if (!skillRoots.includes(normalizedPath)) throw new Error(normalizedPath ? `仓库中未找到 ${normalizedPath}/SKILL.md。` : "仓库快照中未发现 SKILL.md。");
      const selectedEntries = selectSkillTreeEntries(entries, normalizedPath);
      const files = await downloadGithubSkillTreeFiles(repository, commit, selectedEntries, signal);
      return createSkillSnapshot(repository, requestedRef?.trim() || "HEAD", commit, skillRoots, files);
    } else {
      repository = { owner, name, fullName: `${owner}/${name}`, url: `https://github.com/${owner}/${name}`, description: "", stars: 0, license: null, defaultBranch: requestedRef?.trim() || "HEAD" };
      const manifest = JSON.parse((await git(["show", `${commit}:package.json`])).toString("utf8")) as Record<string, unknown>;
      const allPaths = (await git(["ls-tree", "-r", "--name-only", commit])).toString("utf8").trim().split("\n");
      const include = packageContentFilter(manifest);
      const paths = allPaths.filter(path => include(path));
      if (!paths.includes("package.json") || paths.length > 512) throw new Error("Git 插件包内容为空或超过安全文件数量限制。");
      archive = await git(["archive", "--format=zip", "--prefix=package/", commit, "--", ...paths], MAX_ARCHIVE_BYTES);
      repository = { owner, name, fullName: `${owner}/${name}`, url: `https://github.com/${owner}/${name}`, description: typeof manifest.description === "string" ? manifest.description.slice(0, 500) : "", stars: 0, license: typeof manifest.license === "string" ? manifest.license : null, defaultBranch: requestedRef?.trim() || "HEAD" };
    }
    const snapshot: GitHubSnapshot = { repository, requestedRef: requestedRef?.trim() || "HEAD", commit, archiveSha256: createHash("sha256").update(archive).digest("hex"), files: readGithubZip(archive) };
    signal?.throwIfAborted();
    return purpose === "plugin" && needsPublishedFiles(snapshot) ? downloadPublishedFiles(snapshot, signal) : snapshot;
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

function githubHeaders(): Record<string, string> { return { "User-Agent": "LFAA-Plugin-Manager", Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }; }

function requestSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function readJson(response: Response, maximumBytes = 2 * 1024 * 1024): Promise<Record<string, unknown>> {
  if (!response.ok) {
    if (response.status === 404) throw new Error("GitHub 仓库或插件版本不存在。");
    if (response.status === 403 || response.status === 429) throw new Error("GitHub 请求频率受限；稍后重试。");
    throw new Error(`GitHub 清单请求失败（HTTP ${response.status}）。`);
  }
  const body = await readResponseBytes(response, maximumBytes);
  let value: unknown;
  try { value = JSON.parse(body.toString("utf8")); } catch { throw new Error("GitHub 返回的清单不是有效 JSON。"); }
  if (!isRecord(value)) throw new Error("GitHub 返回的清单格式无效。");
  return value;
}

interface GitHubSkillTreeEntry { path: string; sha: string; size: number | null; mode: string }

function parseApiTree(value: unknown[]): GitHubSkillTreeEntry[] {
  return value.flatMap(item => {
    if (!isRecord(item) || item.type !== "blob" || typeof item.path !== "string" || typeof item.sha !== "string" || !/^[a-f0-9]{40}$/iu.test(item.sha) || !Number.isSafeInteger(item.size) || (item.size as number) < 0 || typeof item.mode !== "string") return [];
    return [{ path: item.path, sha: item.sha.toLocaleLowerCase("en-US"), size: item.size as number, mode: item.mode }];
  });
}

export function parseGithubGitTree(input: Buffer): GitHubSkillTreeEntry[] {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  return input.toString("binary").split("\0").filter(Boolean).flatMap(record => {
    const bytes = Buffer.from(record, "binary");
    const separator = bytes.indexOf(0x09);
    if (separator <= 0) throw new Error("GitHub 仓库文件树格式无效。");
    const fields = bytes.subarray(0, separator).toString("ascii").split(" ");
    const sha = fields[2];
    const size = fields[3] === undefined ? null : Number(fields[3]);
    if (fields.length < 3 || !["blob", "commit"].includes(fields[1] ?? "")) throw new Error("GitHub Skill 文件树条目无效。");
    if (fields[1] === "commit") return [];
    if (!sha || !/^[a-f0-9]{40}$/iu.test(sha) || (size !== null && (!Number.isSafeInteger(size) || size < 0)) || !fields[0]) throw new Error("GitHub Skill 文件树条目无效。");
    let path: string;
    try { path = decoder.decode(bytes.subarray(separator + 1)); } catch { throw new Error("GitHub Skill 路径不是有效 UTF-8。"); }
    return [{ path, sha: sha.toLocaleLowerCase("en-US"), size, mode: fields[0] }];
  });
}

function getSkillRoots(paths: string[]): string[] {
  const roots = new Set<string>();
  for (const path of paths) {
    if (path.split("/").at(-1)?.toLocaleLowerCase("en-US") !== "skill.md") continue;
    const root = path.slice(0, path.lastIndexOf("/")).replace(/\/$/u, "");
    try { normalizeRepositoryPath(root); roots.add(root); } catch { /* Ignore unsafe source paths; never make them installable. */ }
  }
  return [...roots].sort((a, b) => a.localeCompare(b));
}

function selectSkillTreeEntries(entries: GitHubSkillTreeEntry[], sourcePath: string): GitHubSkillTreeEntry[] {
  const prefix = sourcePath ? `${sourcePath}/` : "";
  const selected = entries.filter(entry => !prefix || entry.path.startsWith(prefix));
  if (!selected.some(entry => entry.path.toLocaleLowerCase("en-US") === `${prefix}SKILL.md`.toLocaleLowerCase("en-US"))) throw new Error("所选 Skill 缺少 SKILL.md；没有创建安装凭证。");
  if (selected.length === 0 || selected.length > GITHUB_SKILL_SOURCE_LIMITS.files) throw new Error(`所选 Skill 文件数量必须为 1–${GITHUB_SKILL_SOURCE_LIMITS.files}。`);
  let total = 0;
  for (const entry of selected) {
    if (!isSafeRepositoryFilePath(entry.path, sourcePath)) throw new Error(`Skill 包含不安全的源文件路径：${entry.path}`);
    if (entry.mode !== "100644" && entry.mode !== "100755") throw new Error(`Skill 包含链接或特殊文件：${entry.path}`);
    if (entry.size !== null) {
      if (entry.size > GITHUB_SKILL_SOURCE_LIMITS.fileBytes) throw new Error(`Skill 文件过大：${entry.path}`);
      total += entry.size;
    }
    if (total > GITHUB_SKILL_SOURCE_LIMITS.totalBytes) throw new Error("Skill 文件总大小超过 5 MiB 安全限制；没有安装。");
  }
  return selected.sort((a, b) => a.path.localeCompare(b.path));
}

function normalizeRepositoryPath(value: string): string {
  if (value === "." || value === "") return "";
  if (value.length > 512 || value.startsWith("/") || value.includes("\\")) throw new Error("Skill 来源路径无效。");
  const parts = value.split("/");
  if (parts.some(part => !part || part === "." || part === ".." || /[<>:"|?*\0]/u.test(part) || /[ .]$/u.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(part))) throw new Error("Skill 来源路径无效。");
  return parts.join("/");
}

function isSafeRepositoryFilePath(path: string, sourcePath: string): boolean {
  try {
    const prefix = sourcePath ? `${sourcePath}/` : "";
    if (!path.startsWith(prefix)) return false;
    const relative = prefix ? path.slice(prefix.length) : path;
    if (!relative || relative.length > 512) return false;
    normalizeRepositoryPath(relative);
    return true;
  } catch { return false; }
}

function createSkillSnapshot(repository: GitHubRepository, requestedRef: string, commit: string, skillRoots: string[], files: PluginArchiveFile[]): GitHubSnapshot {
  const digest = createHash("sha256");
  digest.update("LFAA-GITHUB-SKILL-SNAPSHOT\0", "utf8");
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const path = Buffer.from(file.path, "utf8");
    digest.update(String(path.length), "ascii").update("\0", "ascii").update(path);
    digest.update(String(file.contents.length), "ascii").update("\0", "ascii").update(file.contents);
  }
  return { repository, requestedRef, commit, archiveSha256: digest.digest("hex"), files, skillRoots };
}

function gitBlobSha(contents: Buffer): string {
  return createHash("sha1").update(`blob ${contents.length}\0`, "utf8").update(contents).digest("hex");
}

async function readResponseBytes(response: Response, maximumBytes: number, signal?: AbortSignal): Promise<Buffer> {
  const declared = response.headers.get("content-length");
  if (declared !== null && Number(declared) > maximumBytes) throw new Error("GitHub 响应超过允许读取大小。");
  if (!response.body) throw new Error("GitHub 未返回响应内容。");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const result = await reader.read();
      if (result.done) break;
      size += result.value.length;
      if (size > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("GitHub 响应超过允许读取大小。");
      }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), size);
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

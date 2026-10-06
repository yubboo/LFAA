/**
 * 功能：查询并下载固定到提交号的 GitHub 插件源码。
 * 作用：只访问 GitHub 官方 API 与其源码分发域名，限制响应大小和重定向，绝不执行仓库脚本。
 * 关联文件：index.ts 负责插件合同与持久化；zip-archive.ts 校验源码归档。
 */
import { createHash } from "node:crypto";
import { downloadPublishedFiles, needsPublishedFiles } from "./npm-source.js";
import { readGithubZip, type PluginArchiveFile } from "./zip-archive.js";

const API_ROOT = "https://api.github.com";
const ARCHIVE_ROOT = "https://codeload.github.com";
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;

export interface GitHubRepository { owner: string; name: string; fullName: string; description: string; stars: number; license: string | null; defaultBranch: string; url: string }
export interface GitHubSnapshot { repository: GitHubRepository; requestedRef: string; commit: string; archiveSha256: string; files: PluginArchiveFile[] }
export interface GitHubCandidate extends GitHubRepository { updatedAt: string }

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

export async function downloadGithubSnapshot(repositoryUrl: string, requestedRef?: string): Promise<GitHubSnapshot> {
  const { owner, name } = parseGithubRepositoryUrl(repositoryUrl);
  const repositoryResponse = await fetch(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, {
    headers: githubHeaders(), redirect: "error", signal: AbortSignal.timeout(20_000)
  });
  const repositoryData = await readJson(repositoryResponse);
  if (typeof repositoryData.default_branch !== "string" || typeof repositoryData.full_name !== "string") throw new Error("GitHub 未返回有效仓库清单。");
  const selectedRef = requestedRef?.trim() || repositoryData.default_branch;
  if (selectedRef.length > 200 || selectedRef.startsWith("-") || /[\r\n\0]/u.test(selectedRef)) throw new Error("插件版本或分支标识无效。");
  const commitResponse = await fetch(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits/${encodeURIComponent(selectedRef)}`, {
    headers: githubHeaders(), redirect: "error", signal: AbortSignal.timeout(20_000)
  });
  const commitData = await readJson(commitResponse);
  const commit = commitData.sha;
  if (typeof commit !== "string" || !/^[a-f0-9]{40}$/iu.test(commit)) throw new Error("插件引用没有解析为固定的 Git 提交号。");

  const archiveUrl = `${ARCHIVE_ROOT}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/zip/${commit}`;
  const archiveResponse = await fetch(archiveUrl, { headers: { "User-Agent": "LFAA-Plugin-Manager", Accept: "application/zip" }, redirect: "error", signal: AbortSignal.timeout(60_000) });
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
  const repository: GitHubRepository = {
    owner, name, fullName: repositoryData.full_name,
    description: typeof repositoryData.description === "string" ? repositoryData.description.slice(0, 500) : "",
    stars: typeof repositoryData.stargazers_count === "number" ? repositoryData.stargazers_count : 0,
    license: isRecord(repositoryData.license) && typeof repositoryData.license.spdx_id === "string" && repositoryData.license.spdx_id !== "NOASSERTION" ? repositoryData.license.spdx_id : null,
    defaultBranch: repositoryData.default_branch,
    url: `https://github.com/${owner}/${name}`
  };
  const snapshot: GitHubSnapshot = { repository, requestedRef: selectedRef, commit, archiveSha256: createHash("sha256").update(archive).digest("hex"), files: readGithubZip(archive) };
  // Some package repositories intentionally omit generated `lib/` outputs from Git;
  // use the published artifact only when NPM proves it belongs to this exact commit.
  return needsPublishedFiles(snapshot) ? downloadPublishedFiles(snapshot) : snapshot;
}

function githubHeaders(): Record<string, string> { return { "User-Agent": "LFAA-Plugin-Manager", Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }; }

async function readJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) {
    if (response.status === 404) throw new Error("GitHub 仓库或插件版本不存在。");
    if (response.status === 403 || response.status === 429) throw new Error("GitHub 请求频率受限；稍后重试。");
    throw new Error(`GitHub 清单请求失败（HTTP ${response.status}）。`);
  }
  let value: unknown;
  try { value = await response.json(); } catch { throw new Error("GitHub 返回的清单不是有效 JSON。"); }
  if (!isRecord(value)) throw new Error("GitHub 返回的清单格式无效。");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

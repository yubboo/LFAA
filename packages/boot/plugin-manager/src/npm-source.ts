/**
 * 功能：为 GitHub 插件源码补齐其官方 NPM 发布包中的已构建入口。
 * 作用：只接受同包名/版本/仓库/固定 Git 提交且 SRI 校验通过的 registry.npmjs.org tarball；不运行任何脚本。
 * 关联文件：github-source.ts 在 GitHub 快照缺少清单声明的发布文件时调用本模块。
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { readNpmTarGzip } from "./npm-archive.js";
import type { GitHubSnapshot } from "./github-source.js";
import type { PluginArchiveFile } from "./zip-archive.js";

const REGISTRY_ROOT = "https://registry.npmjs.org";
const MAX_TARBALL_BYTES = 64 * 1024 * 1024;

interface PackageManifest { name?: unknown; version?: unknown; repository?: unknown; main?: unknown; exports?: unknown; dsh?: unknown }

export function needsPublishedFiles(snapshot: GitHubSnapshot): boolean {
  const manifest = readPackageManifest(snapshot.files);
  const dsh = isRecord(manifest.dsh) ? manifest.dsh : undefined;
  if (!dsh || !isRecord(dsh.bundle) || typeof dsh.bundle.patch !== "string") return false;
  const files = new Set(snapshot.files.map((file) => file.path));
  const expected = [packageRelativeFile(manifest.main), clientExport(manifest.exports)].filter((value): value is string => value !== null);
  return expected.some((file) => !files.has(file));
}

export async function downloadPublishedFiles(snapshot: GitHubSnapshot): Promise<GitHubSnapshot> {
  const sourceManifest = readPackageManifest(snapshot.files);
  if (typeof sourceManifest.name !== "string" || !isNpmPackageName(sourceManifest.name) || typeof sourceManifest.version !== "string" || !isExactVersion(sourceManifest.version)) {
    throw new Error("GitHub 插件缺少可解析的 NPM 包名或固定版本；不能补齐发布产物。");
  }
  const packageName = sourceManifest.name;
  const metadataUrl = `${REGISTRY_ROOT}/${encodeURIComponent(packageName)}/${encodeURIComponent(sourceManifest.version)}`;
  const metadataResponse = await fetch(metadataUrl, { headers: { "User-Agent": "LFAA-Plugin-Manager", Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(20_000) });
  const metadata = await readJson(metadataResponse, "NPM registry");
  if (metadata.name !== packageName || metadata.version !== sourceManifest.version || metadata.gitHead !== snapshot.commit) {
    throw new Error("NPM 发布包未声明与已检查 GitHub 提交一致的 gitHead；拒绝用其他版本产物补齐。");
  }
  const registryManifest = isRecord(metadata.repository) ? metadata.repository : undefined;
  const sourceRepository = readRepositoryUrl(sourceManifest.repository);
  const publishedRepository = readRepositoryUrl(registryManifest);
  if (!sourceRepository || sourceRepository !== readRepositoryUrl(snapshot.repository.url) || publishedRepository !== sourceRepository) {
    throw new Error("NPM 发布包仓库地址与已检查的 GitHub 来源不一致；拒绝补齐。");
  }
  const dist = isRecord(metadata.dist) ? metadata.dist : undefined;
  if (!dist || typeof dist.tarball !== "string" || typeof dist.integrity !== "string") throw new Error("NPM registry 未提供发布 tarball 和 SRI 完整性声明。");
  const tarballUrl = new URL(dist.tarball);
  if (tarballUrl.protocol !== "https:" || tarballUrl.hostname !== "registry.npmjs.org" || tarballUrl.port || tarballUrl.username || tarballUrl.password || tarballUrl.search || tarballUrl.hash) {
    throw new Error("NPM 发布 tarball 必须来自官方 registry.npmjs.org。");
  }
  const tarballResponse = await fetch(tarballUrl, { headers: { "User-Agent": "LFAA-Plugin-Manager", Accept: "application/octet-stream" }, redirect: "error", signal: AbortSignal.timeout(60_000) });
  const tarball = await readBoundedBody(tarballResponse);
  verifyIntegrity(tarball, dist.integrity);
  const files = readNpmTarGzip(tarball);
  const tarManifest = readPackageManifest(files);
  if (tarManifest.name !== packageName || tarManifest.version !== sourceManifest.version) throw new Error("NPM tarball 内部包名或版本与 registry 元数据不一致。");
  if (canonicalJson(tarManifest) !== canonicalJson(sourceManifest)) throw new Error("NPM tarball 的 package.json 与已检查 GitHub 提交不一致。");
  if (!hasExpectedPublishedFiles(sourceManifest, files)) throw new Error("NPM 发布 tarball 仍缺少 package.json 声明的 Host/Client 入口文件。");
  return { ...snapshot, archiveSha256: createHash("sha256").update(tarball).digest("hex"), files };
}

function hasExpectedPublishedFiles(manifest: PackageManifest, files: PluginArchiveFile[]): boolean {
  const actual = new Set(files.map((file) => file.path));
  const expected = [packageRelativeFile(manifest.main), clientExport(manifest.exports)].filter((value): value is string => value !== null);
  return expected.every((path) => actual.has(path));
}

function readPackageManifest(files: PluginArchiveFile[]): PackageManifest {
  const file = files.find((item) => item.path === "package.json");
  if (!file) throw new Error("插件快照根目录缺少 package.json。");
  try {
    const value: unknown = JSON.parse(file.contents.toString("utf8"));
    if (!isRecord(value)) throw new Error();
    return value;
  } catch { throw new Error("插件 package.json 不是有效 JSON。"); }
}

function packageRelativeFile(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512 || value.includes("\\") || value.startsWith("/")) return null;
  const path = value.replace(/^\.\//u, "");
  return path && !path.split("/").some((part) => !part || part === "." || part === "..") ? path : null;
}

function clientExport(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const client = value["./client"];
  if (typeof client === "string") return packageRelativeFile(client);
  if (isRecord(client)) return packageRelativeFile(client.default);
  return null;
}

function readRepositoryUrl(value: unknown): string | null {
  const raw = typeof value === "string" ? value : isRecord(value) && typeof value.url === "string" ? value.url : null;
  if (!raw) return null;
  const cleaned = raw.replace(/^git\+|^git:/u, "").replace(/\.git$/iu, "");
  try {
    const url = new URL(cleaned);
    if (url.protocol !== "https:" || url.hostname.toLocaleLowerCase("en-US") !== "github.com" || url.port || url.username || url.password || url.search || url.hash) return null;
    const pieces = url.pathname.split("/").filter(Boolean);
    if (pieces.length !== 2) return null;
    return `https://github.com/${pieces[0]}/${pieces[1]}`.toLocaleLowerCase("en-US");
  } catch { return null; }
}

async function readJson(response: Response, source: string): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error(`${source} 请求失败（HTTP ${response.status}）；未写入插件文件。`);
  let value: unknown;
  try { value = await response.json(); } catch { throw new Error(`${source} 返回的清单不是有效 JSON。`); }
  if (!isRecord(value)) throw new Error(`${source} 返回的清单格式无效。`);
  return value;
}

async function readBoundedBody(response: Response): Promise<Buffer> {
  if (!response.ok) throw new Error(`NPM 发布 tarball 下载失败（HTTP ${response.status}）。`);
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_TARBALL_BYTES) throw new Error("NPM 插件 tarball 超过 64 MiB 限制。");
  if (!response.body) throw new Error("NPM registry 未返回插件 tarball 内容。");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > MAX_TARBALL_BYTES) throw new Error("NPM 插件 tarball 超过 64 MiB 限制。");
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
}

function verifyIntegrity(tarball: Buffer, integrity: string): void {
  const entries = integrity.trim().split(/\s+/u);
  const accepted = entries.find((entry) => entry.startsWith("sha512-"));
  if (!accepted) throw new Error("NPM registry 未提供可接受的 SHA-512 完整性声明。");
  const expected = Buffer.from(accepted.slice("sha512-".length), "base64");
  const actual = createHash("sha512").update(tarball).digest();
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error("NPM 插件 tarball 的 SHA-512 完整性校验失败。");
}

function isNpmPackageName(value: string): boolean {
  return value.length <= 214 && /^(?:@[a-z0-9][a-z0-9._-]{0,99}\/)?[a-z0-9][a-z0-9._-]{0,99}$/u.test(value);
}

function isExactVersion(value: string): boolean { return value.length <= 100 && /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(value); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

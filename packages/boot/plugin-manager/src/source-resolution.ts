/** 功能：把插件来源解析为受限、固定内容的源码快照。作用：统一 GitHub、NPM 和 Host 本机路径检查；不执行来源代码。 */
import { createHash } from "node:crypto";
import { constants, closeSync, fstatSync, lstatSync, openSync, readdirSync, realpathSync, readSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { downloadGithubSnapshot, type GitHubRepository, type GitHubSnapshot } from "./github-source.js";
import { downloadCompatibleRegistryPluginPackage, downloadRegistryPluginPackage } from "./npm-source.js";
import { PLUGIN_ARCHIVE_LIMITS, readNpmTarGzip } from "./npm-archive.js";
import type { PluginArchiveFile } from "./zip-archive.js";
import { packageContentFilter } from "./package-content.js";

export type PluginSourceType = "github" | "npm" | "local";
export interface PluginSourceSnapshot extends GitHubSnapshot { sourceType: PluginSourceType; sourceLocation: string }

interface LocalManifest { name?: unknown; version?: unknown; description?: unknown; license?: unknown }

/** Resolve one user source to an immutable Git commit, registry artifact, or local content digest. */
export async function resolvePluginSource(sourceValue: string, requestedRef?: string): Promise<PluginSourceSnapshot> {
  const source = sourceValue.trim();
  if (!source || source.length > 2048 || /[\r\n\0]/u.test(source)) throw new Error("插件来源为空或格式无效。");
  if (/^https:\/\//iu.test(source)) {
    const snapshot = await downloadGithubSnapshot(source, requestedRef);
    return { ...snapshot, sourceType: "github", sourceLocation: snapshot.repository.url };
  }
  if (/^(?:local|file|link):/u.test(source) || isAbsolute(source)) return resolveLocalSource(source);

  const spec = parseNpmSpec(source, requestedRef);
  const artifact = /[~^*<>=| ]/u.test(spec.version) ? await downloadCompatibleRegistryPluginPackage(spec.name, spec.version) : await downloadRegistryPluginPackage(spec.name, spec.version);
  const sourceLocation = `npm:${spec.name}`;
  const repository: GitHubRepository = {
    owner: "npm", name: spec.name, fullName: spec.name, description: artifact.description,
    stars: 0, license: artifact.license, defaultBranch: artifact.version,
    url: `https://registry.npmjs.org/${encodeURIComponent(spec.name)}`
  };
  return {
    repository,
    sourceType: "npm",
    sourceLocation,
    requestedRef: spec.version,
    commit: `npm:${spec.name}@${artifact.version}:${artifact.archiveSha256}`,
    archiveSha256: artifact.archiveSha256,
    files: artifact.files
  };
}

function parseNpmSpec(source: string, requestedRef?: string): { name: string; version: string } {
  const value = source.startsWith("npm:") ? source.slice(4) : source;
  const match = /^(@[a-z0-9][a-z0-9._-]{0,99}\/[a-z0-9][a-z0-9._-]{0,99}|[a-z0-9][a-z0-9._-]{0,99})(?:@([^\r\n\0]{1,200}))?$/u.exec(value);
  if (!match) throw new Error("插件来源须为 NPM 包名、GitHub HTTPS 仓库或 Host 本机绝对路径。");
  const embeddedRef = match[2];
  const explicitRef = requestedRef?.trim();
  if (embeddedRef && explicitRef && embeddedRef !== explicitRef) throw new Error("NPM 包规格与单独填写的版本不一致。");
  return { name: match[1]!, version: explicitRef || embeddedRef || "latest" };
}

function resolveLocalSource(source: string): PluginSourceSnapshot {
  const suppliedPath = source.replace(/^(?:local|file|link):/u, "");
  if (!isAbsolute(suppliedPath)) throw new Error("本地插件来源必须是 LFAA Host 上的绝对路径。");
  const selected = resolve(suppliedPath);
  const selectedInfo = lstatSync(selected);
  if (selectedInfo.isSymbolicLink()) throw new Error("本地插件来源不能是符号链接或目录联接。");
  const realRoot = realpathSync(selected);
  const currentInfo = lstatSync(selected);
  if (currentInfo.isSymbolicLink() || currentInfo.dev !== selectedInfo.dev || currentInfo.ino !== selectedInfo.ino || realpathSync(selected) !== realRoot) throw new Error("读取本地插件来源时目录发生变化。");
  let files: PluginArchiveFile[];
  let archiveSha256: string;
  if (selectedInfo.isDirectory()) {
    files = readLocalDirectory(realRoot);
    const digest = createHash("sha256");
    for (const file of files) digest.update(file.path).update("\0").update(String(file.contents.length)).update("\0").update(file.contents);
    archiveSha256 = digest.digest("hex");
  } else if (selectedInfo.isFile() && /\.(?:tgz|tar\.gz)$/iu.test(selected)) {
    const archive = readBoundedLocalFile(realRoot);
    files = readNpmTarGzip(archive);
    archiveSha256 = createHash("sha256").update(archive).digest("hex");
  } else {
    throw new Error("本地插件来源必须是含 package.json 的目录或 .tgz/.tar.gz 压缩包。");
  }
  const manifest = readLocalManifest(files);
  if (typeof manifest.name !== "string" || typeof manifest.version !== "string") throw new Error("本地插件 package.json 缺少包名或版本号。");
  const repository: GitHubRepository = {
    owner: "local", name: manifest.name, fullName: manifest.name,
    description: typeof manifest.description === "string" ? manifest.description.slice(0, 500) : "",
    stars: 0,
    license: typeof manifest.license === "string" && /^[A-Za-z0-9.+-]{1,40}$/u.test(manifest.license) ? manifest.license : null,
    defaultBranch: manifest.version, url: `local:${realRoot}`
  };
  return {
    repository,
    sourceType: "local",
    sourceLocation: realRoot,
    requestedRef: "",
    commit: `local:${archiveSha256}`,
    archiveSha256,
    files
  };
}

function readLocalDirectory(root: string): PluginArchiveFile[] {
  const manifestPath = resolve(root, "package.json");
  const manifestInfo = lstatSync(manifestPath);
  const include = packageContentFilter(JSON.parse(readStableLocalFile(manifestPath, root, manifestInfo.size).toString("utf8")) as Record<string, unknown>);
  const files: PluginArchiveFile[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;
  let visitedEntries = 0;
  const visit = (directory: string, prefix: string, depth: number): void => {
    if (depth > 24) throw new Error("本地插件目录层级超过 24 层。");
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      if (++visitedEntries > PLUGIN_ARCHIVE_LIMITS.files * 4) throw new Error("本地插件目录条目数量超过允许上限。");
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!include(relativePath, entry.isDirectory())) continue;
      validateLocalRelativePath(relativePath);
      const key = relativePath.toLocaleLowerCase("en-US");
      if (seen.has(key)) throw new Error(`本地插件目录包含大小写重复路径：${relativePath}`);
      seen.add(key);
      const path = resolve(directory, entry.name);
      const info = lstatSync(path);
      if (info.isSymbolicLink()) throw new Error(`本地插件目录不能包含符号链接：${relativePath}`);
      if (info.isDirectory()) { visit(path, relativePath, depth + 1); continue; }
      if (!info.isFile()) throw new Error(`本地插件目录包含特殊文件：${relativePath}`);
      if (files.length >= PLUGIN_ARCHIVE_LIMITS.files) throw new Error("本地插件文件数量超过允许上限。");
      if (info.size > PLUGIN_ARCHIVE_LIMITS.fileBytes || totalBytes + info.size > PLUGIN_ARCHIVE_LIMITS.unpackedBytes) throw new Error("本地插件文件总大小超过允许上限。");
      const contents = readStableLocalFile(path, root, info.size);
      totalBytes += contents.length;
      files.push({ path: relativePath, contents });
    }
  };
  visit(root, "", 0);
  if (!files.length) throw new Error("本地插件目录为空。");
  return files;
}

function readBoundedLocalFile(path: string): Buffer {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > PLUGIN_ARCHIVE_LIMITS.archiveBytes) throw new Error("本地插件压缩包不是普通文件或超过 64 MiB 限制。");
  return readStableLocalFile(path, realpathSync(path), info.size, PLUGIN_ARCHIVE_LIMITS.archiveBytes);
}

function readStableLocalFile(path: string, root: string, expectedSize: number, maximumBytes = PLUGIN_ARCHIVE_LIMITS.fileBytes): Buffer {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 0 || expectedSize > maximumBytes) throw new Error(`本地插件文件超过 ${Math.floor(maximumBytes / 1024 / 1024)} MiB 限制。`);
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  const descriptor = openSync(path, constants.O_RDONLY | noFollow);
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.size !== expectedSize || realpathSync(path) !== path) throw new Error("读取本地插件文件时来源发生变化。");
    const inside = relative(root, path);
    if (inside.startsWith(`..${sep}`) || inside === ".." || isAbsolute(inside)) throw new Error("本地插件文件超出所选目录。");
    const contents = Buffer.alloc(expectedSize);
    let offset = 0;
    while (offset < expectedSize) {
      const count = readSync(descriptor, contents, offset, expectedSize - offset, offset);
      if (count === 0) throw new Error("读取本地插件文件时内容被截断。");
      offset += count;
    }
    const extra = Buffer.alloc(1);
    if (readSync(descriptor, extra, 0, 1, expectedSize) !== 0) throw new Error("读取本地插件文件时文件大小发生变化。");
    const latest = lstatSync(path);
    if (latest.isSymbolicLink() || latest.size !== expectedSize) throw new Error("读取本地插件文件时来源发生变化。");
    return contents;
  } finally { closeSync(descriptor); }
}

function validateLocalRelativePath(value: string): void {
  const pieces = value.split("/");
  if (value.length > 240 || value.includes("\\") || pieces.some((piece) => !piece || piece === "." || piece === ".." || /[<>:"|?*\u0000-\u001f]/u.test(piece) || /[ .]$/u.test(piece))) throw new Error(`本地插件路径无效：${value}`);
  if (pieces.some((piece) => /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(piece))) throw new Error(`本地插件路径包含 Windows 保留设备名：${value}`);
}

function readLocalManifest(files: readonly PluginArchiveFile[]): LocalManifest {
  const manifest = files.find((file) => file.path === "package.json");
  if (!manifest) throw new Error("插件来源根目录缺少 package.json。");
  try {
    const value: unknown = JSON.parse(manifest.contents.toString("utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error();
    return value as LocalManifest;
  } catch { throw new Error("插件 package.json 不是有效 JSON。"); }
}

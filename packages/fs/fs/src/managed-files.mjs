/**
 * 功能：提供与游戏节点无关的受管文件执行能力。
 * 作用：系统账户文件库与 Daemon 复用目录、预览、编辑、传输和回收站的唯一安全实现。
 * 关联文件：library.ts、workspace-files API、host/daemon/src/daemon.mjs；根目录和业务写入保护由调用 Owner 注入。
 */
import {randomUUID, createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat, mkdir, opendir, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {basename, dirname, extname, isAbsolute, relative, resolve, sep} from 'node:path';
import {inflateRawSync} from 'node:zlib';

function isSensitivePreviewPath(path) {
  const relativePath = path.split(sep).join("/").toLocaleLowerCase("en-US");
  const name = basename(path).toLocaleLowerCase("en-US");
  return relativePath.split("/").some(segment => ["credentials", "secrets", "private", "certificates"].includes(segment))
    || /(?:^|[._-])(?:secret|credential|password|passwd|token|private-key)(?:[._-]|$)/u.test(name)
    || /^\.env(?:\.|$)/u.test(name)
    || /\.(?:key|pem|p12|pfx|jks|keystore|sqlite|sqlite3|db)$/u.test(name);
}

function containsSensitiveConfiguration(content) {
  return /^\s*["']?[\w.-]*(?:password|passwd|token|secret|credential|private[_-]?key|api[_-]?key|access[_-]?key|client[_-]?secret)[\w.-]*["']?\s*[:=]\s*["']?[^"'\s,}\]]{4,}/imu.test(content);
}

export function assertSafeTextPreview(path, content) {
  if (isSensitivePreviewPath(path) || containsSensitiveConfiguration(content)) throw new Error("敏感文件或包含疑似凭据的内容禁止在线预览和编辑。");
}

// 写入按实际根目录串行，同一账户的多个请求共享锁；结束后删除登记，避免长期增长。
const mutationTails = new Map();
const readOperations = new Set(['list','search','directory-size','preview','read','download','trash-list']);
export function createManagedFileService({root, protectedDirectories = [], assertCanRead = () => {}, assertCanMutate = () => {}, recycleNamespace = ""}) {
const dataDirectory = resolve(root);
const protectedDataDirectories = protectedDirectories;
const managedRecycleBinName = ".lfaa-recycle-bin";
if (recycleNamespace && !/^[a-f0-9]{64}$/u.test(recycleNamespace)) throw new Error("回收站账户标识无效。");
const managedRecycleBinLimit = 5000;
const managedUploadExtensions = new Set([".txt", ".md", ".markdown", ".json", ".jsonc", ".yaml", ".yml", ".toml", ".properties", ".cfg", ".conf", ".ini", ".xml", ".csv", ".css", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf", ".docx", ".xlsx", ".pptx", ".zip"]);
const dangerousManagedFileExtensions = new Set([".exe", ".com", ".msi", ".msp", ".dll", ".scr", ".bat", ".cmd", ".ps1", ".psm1", ".sh", ".bash", ".py", ".pyw", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".vbs", ".vbe", ".wsf", ".jar", ".hta", ".reg"]);
const managedFileMetadataBatchSize = 32;
const managedDirectorySizeMaximumEntries = 20_000;
const managedDirectorySizeMaximumDepth = 64;
async function performFileOperation(operation, payload) {
  const filePath = resolveManagedFilePath(payload.path, ["list", "search", "directory-size", "upload", "trash-list", "trash-restore", "trash-purge"].includes(operation));
  if (operation === "list") return await listManagedFiles(filePath);
  if (operation === "directory-size") return await calculateManagedDirectorySize(filePath);
  if (operation === "search") return await searchManagedFiles(filePath, payload.query);
  if (operation === "preview") return await previewManagedFile(filePath);
  if (operation === "read") return await readManagedTextFile(filePath);
  if (operation === "download") return await downloadManagedFile(filePath);
  if (operation === "write") return await writeManagedTextFile(filePath, payload.content, payload.expectedSha256);
  if (operation === "create-file") return await createManagedFile(filePath);
  if (operation === "create-folder") return await createManagedFolder(filePath);
  if (operation === "rename") return await renameManagedFile(filePath, payload.name);
  if (operation === "move") return await moveManagedFile(filePath, payload.destinationPath);
  if (operation === "delete") return await deleteManagedFile(filePath);
  if (operation === "upload") return await uploadManagedFile(filePath, payload.name, payload.bytes ?? payload.dataBase64, payload.sha256);
  if (operation === "trash-list") return await listManagedTrash();
  if (operation === "trash-restore") return await restoreManagedFile(payload.name);
  if (operation === "trash-purge") return await purgeManagedTrashItem(payload.name);
  throw new Error("Daemon 拒绝执行未登记的文件操作。");
}

function resolveManagedFilePath(value, allowRoot = false) {
  // 所有请求都按数据根目录相对路径解释；拒绝绝对路径、父目录跳转和系统私有目录。
  if (value === "" && allowRoot) return dataDirectory;
  if (typeof value !== "string" || value.length > 1024 || value.includes("\\") || value.startsWith("/") || /^[a-z]:/iu.test(value)) {
    throw new Error("文件路径格式无效；路径必须相对于 LFAA 数据根目录。");
  }
  const segments = value.split("/");
  if (segments.some((segment) => !isSafeManagedFileName(segment))) throw new Error("文件路径包含不安全的目录名称。");
  if (segments[0]?.toLocaleLowerCase() === managedRecycleBinName) throw new Error("回收站是 LFAA 内部目录，不能通过普通路径访问。");
  if (protectedDataDirectories.includes(segments[0]?.toLocaleLowerCase() ?? "")) throw new Error("凭据、数据库、配置和会话目录不开放给文件管理器。");
  const target = resolve(dataDirectory, ...segments);
  const rel = relative(dataDirectory, target);
  if (rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) throw new Error("文件路径越过 LFAA 数据根目录。");
  return target;
}

/** 按段创建数据根目录中的文件夹，并在每一级拒绝符号链接和重解析点。 */
async function ensureManagedDirectory(directory) {
  const relativePath = relative(dataDirectory, directory);
  if (relativePath === "") {
    const rootInfo = await lstat(dataDirectory);
    if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new Error("LFAA 数据根目录状态无效。");
    return dataDirectory;
  }
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error("目录路径越过 LFAA 数据根目录。");
  }
  const rootInfo = await lstat(dataDirectory);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new Error("LFAA 数据根目录状态无效。");
  let current = dataDirectory;
  for (const segment of relativePath.split(sep)) {
    if (!isSafeManagedFileName(segment)) throw new Error("目录路径包含不安全名称。");
    current = resolve(current, segment);
    let info;
    try { info = await lstat(current); }
    catch (error) {
      if (error?.code !== "ENOENT") throw error;
      try { await mkdir(current); } catch (mkdirError) { if (mkdirError?.code !== "EEXIST") throw mkdirError; }
      info = await lstat(current);
    }
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("目标目录包含符号链接或非目录路径，已拒绝访问。");
  }
  return current;
}

function isSafeManagedFileName(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 255
    && value !== "." && value !== ".." && !/[<>:"|?*\\/\u0000-\u001f]/u.test(value)
    && !/[ .]$/u.test(value)
    && !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(value);
}

async function assertManagedPathIsSafe(path, allowMissing = false) {
  assertCanRead(path);
  // 逐层核实真实文件类型，拒绝链接与硬链接，避免受管路径指向数据根目录之外。
  const rel = relative(dataDirectory, path);
  if (rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) throw new Error("文件路径越过 LFAA 数据根目录。");
  const segments = rel ? rel.split(sep) : [];
  let current = dataDirectory;
  const rootInfo = await lstat(current);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new Error("LFAA 数据根目录状态无效。");
  for (let index = 0; index < segments.length; index += 1) {
    current = resolve(current, segments[index]);
    let info;
    try { info = await lstat(current); }
    catch (error) {
      if (allowMissing && error?.code === "ENOENT" && index === segments.length - 1) return null;
      throw error;
    }
    if (info.isSymbolicLink()) throw new Error("文件路径包含符号链接或目录联接，已拒绝访问。");
    if (index < segments.length - 1 && !info.isDirectory()) throw new Error("文件路径中的上级目录无效。");
    if (index === segments.length - 1 && info.isFile() && info.nlink > 1) throw new Error("文件是硬链接，已拒绝访问以避免读取或修改目录之外的数据。");
    if (index === segments.length - 1) return info;
  }
  return rootInfo;
}

function toManagedRelativePath(path) {
  return relative(dataDirectory, path).split(sep).join("/");
}

async function listManagedFiles(directory) {
  const directoryInfo = await assertManagedPathIsSafe(directory);
  if (!directoryInfo.isDirectory()) throw new Error("当前路径不是文件夹。");
  const entries = [];
  const directoryEntries = (await readdir(directory, { withFileTypes: true })).filter(entry => !(directory === dataDirectory && entry.name.toLocaleLowerCase() === managedRecycleBinName));
  let scanned = 0;
  while (scanned < directoryEntries.length && entries.length < 500) {
    const batch = directoryEntries.slice(scanned, scanned + managedFileMetadataBatchSize);
    scanned += batch.length;
    entries.push(...(await inspectManagedFileEntries(directory, batch)).filter(Boolean));
  }
  const truncated = entries.length >= 500 || scanned < directoryEntries.length;
  entries.length = Math.min(entries.length, 500);
  entries.sort((left, right) => Number(right.kind === "directory") - Number(left.kind === "directory") || left.name.localeCompare(right.name, "zh-CN", { sensitivity: "base" }));
  return { path: toManagedRelativePath(directory), entries, truncated };
}

async function calculateManagedDirectorySize(directory) {
  const rootInfo = await assertManagedPathIsSafe(directory);
  if (!rootInfo.isDirectory()) throw new Error("只能计算文件夹大小。");
  const pendingDirectories = [{ path: directory, depth: 0 }];
  let nextDirectoryIndex = 0;
  let inspectedEntries = 0;
  let totalSize = 0;
  let fileCount = 0;
  let directoryCount = 0;
  let skippedEntries = 0;

  while (nextDirectoryIndex < pendingDirectories.length) {
    const current = pendingDirectories[nextDirectoryIndex++];
    const currentInfo = await assertManagedPathIsSafe(current.path);
    if (!currentInfo?.isDirectory()) throw new Error("目录在计算期间发生变化，未返回不完整大小；请重新计算。");
    const handle = await opendir(current.path);
    let batch = [];

    const inspectBatch = async () => {
      const items = batch;
      batch = [];
      const inspected = await Promise.all(items.map(async (entry) => {
        const entryPath = resolve(current.path, entry.name);
        let info;
        try { assertCanRead(entryPath); } catch { return { skipped: true }; }
        try { info = await lstat(entryPath); }
        catch { throw new Error("目录在计算期间发生变化，未返回不完整大小；请重新计算。"); }
        if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile()) || info.isFile() && info.nlink > 1) return { skipped: true };
        return { path: entryPath, info, skipped: false };
      }));

      for (const entry of inspected) {
        if (entry.skipped) {
          skippedEntries += 1;
        } else if (entry.info.isDirectory()) {
          const depth = current.depth + 1;
          if (depth > managedDirectorySizeMaximumDepth) throw new Error(`目录层级超过 ${managedDirectorySizeMaximumDepth} 层，未返回不完整大小。`);
          directoryCount += 1;
          pendingDirectories.push({ path: entry.path, depth });
        } else {
          fileCount += 1;
          totalSize += entry.info.size;
          if (!Number.isSafeInteger(totalSize)) throw new Error("目录总大小超出可安全表示范围，未返回不完整结果。");
        }
      }
    };

    for await (const entry of handle) {
      inspectedEntries += 1;
      if (inspectedEntries > managedDirectorySizeMaximumEntries) throw new Error(`目录项超过 ${managedDirectorySizeMaximumEntries} 个，未返回不完整大小。`);
      if (current.path === dataDirectory && (entry.name.toLocaleLowerCase() === managedRecycleBinName || protectedDataDirectories.includes(entry.name.toLocaleLowerCase()))) continue;
      batch.push(entry);
      if (batch.length >= managedFileMetadataBatchSize) await inspectBatch();
    }
    if (batch.length) await inspectBatch();
  }

  return {
    path: toManagedRelativePath(directory),
    totalSize,
    fileCount,
    directoryCount,
    skippedEntries
  };
}

async function inspectManagedFileEntries(directory, entries) {
  return await Promise.all(entries.map(async entry => {
    if (directory === dataDirectory && entry.name.toLocaleLowerCase() === managedRecycleBinName) return null;
    if (directory === dataDirectory && protectedDataDirectories.includes(entry.name.toLocaleLowerCase())) return null;
    const path = resolve(directory, entry.name);
    let info;
    try { assertCanRead(path); info = await lstat(path); } catch { return null; }
    if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile()) || info.isFile() && info.nlink > 1) return null;
    const relativePath = toManagedRelativePath(path);
    if (relativePath.length > 1024) return null;
    return {
      name: entry.name,
      path: relativePath,
      kind: info.isDirectory() ? "directory" : "file",
      size: info.isFile() ? info.size : 0,
      modifiedAt: info.mtime.toISOString(),
      fileType: info.isDirectory() ? "folder" : extname(entry.name).slice(1).toLocaleLowerCase() || "file"
    };
  }));
}


function readOfficeZipEntries(bytes) {
  const lowerBound = Math.max(0, bytes.length - 65_557);
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= lowerBound; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) { endOffset = offset; break; }
  }
  if (endOffset < 0) throw new Error("Office 文件压缩目录无效。");
  const entryCount = bytes.readUInt16LE(endOffset + 10);
  const directorySize = bytes.readUInt32LE(endOffset + 12);
  let cursor = bytes.readUInt32LE(endOffset + 16);
  if (entryCount > 256 || directorySize > 2 * 1024 * 1024 || cursor + directorySize > bytes.length) throw new Error("Office 文件目录超出预览限制。");
  const entries = new Map();
  let expandedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50 || cursor + 46 > bytes.length) throw new Error("Office 文件目录条目无效。");
    const method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const entryName = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!/^(?:word\/document\.xml|ppt\/slides\/slide\d+\.xml|xl\/(?:sharedStrings|worksheets\/sheet\d+)\.xml)$/u.test(entryName)) continue;
    if (uncompressedSize > 2 * 1024 * 1024 || expandedBytes + uncompressedSize > 4 * 1024 * 1024 || localOffset + 30 > bytes.length) throw new Error("Office 文本内容超过预览限制。");
    if (bytes.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Office 文件数据条目无效。");
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    const content = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed, { maxOutputLength: 2 * 1024 * 1024 }) : null;
    if (!content || content.length !== uncompressedSize) throw new Error("Office 文件压缩格式不受支持或校验失败。");
    expandedBytes += content.length;
    entries.set(entryName, content.toString("utf8"));
  }
  return entries;
}

function officeXmlText(xml) {
  return xml.replace(/<[^>]*>/gu, " ").replace(/&amp;/gu, "&").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"').replace(/&apos;/gu, "'").replace(/&#(\d+);/gu, (_match, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/giu, (_match, hexadecimal) => String.fromCodePoint(Number.parseInt(hexadecimal, 16))).replace(/\s+/gu, " ").trim();
}

async function previewManagedFile(path) {
  const info = await assertManagedPathIsSafe(path);
  if (!info.isFile()) throw new Error("只能预览普通文件。");
  if (isSensitivePreviewPath(path)) throw new Error("此路径按敏感文件策略禁止在线预览；如有需要，请在目标主机本地处理。");
  const extension = extname(path).toLocaleLowerCase("en-US");
  if ([".docx", ".xlsx", ".pptx"].includes(extension)) {
    if (info.size > 12 * 1024 * 1024) throw new Error("Office 文件超过 12 MiB 在线文本预览限制。");
    const entries = readOfficeZipEntries(await readFile(path));
    const ordered = [...entries.entries()].sort(([left], [right]) => left.localeCompare(right, "en-US", { numeric: true }));
    const content = ordered.map(([name, xml]) => `${name}\n${officeXmlText(xml)}`).filter(value => value.trim()).join("\n\n").slice(0, 100_000);
    if (containsSensitiveConfiguration(content)) throw new Error("此 Office 内容包含疑似密码、令牌或密钥字段，已按敏感信息策略禁止预览。 ");
    return { path: toManagedRelativePath(path), previewKind: "text", content, size: info.size };
  }
  if (info.size > 3 * 1024 * 1024) throw new Error("在线预览仅支持 3 MiB 以内的文件。");
  const bytes = await readFile(path);
  const imageKind = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "image/jpeg"
      : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" ? "image/webp"
        : bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a" ? "image/gif" : null;
  if (imageKind) return { path: toManagedRelativePath(path), previewKind: "image", mimeType: imageKind, dataBase64: bytes.toString("base64"), size: info.size };
  if (extension === ".pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-") return { path: toManagedRelativePath(path), previewKind: "pdf", mimeType: "application/pdf", dataBase64: bytes.toString("base64"), size: info.size };
  const isText = [".txt", ".md", ".markdown", ".json", ".jsonc", ".yaml", ".yml", ".toml", ".properties", ".cfg", ".conf", ".ini", ".xml", ".csv", ".html", ".css", ".js", ".mjs", ".ts", ".tsx", ".jsx", ".log"].includes(extension);
  if (!isText) throw new Error("此文件类型暂不支持安全在线预览，可使用下载功能查看。");
  if (info.size > 2 * 1024 * 1024) throw new Error("文本预览仅支持 2 MiB 以内的文件。");
  const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (content.includes("\u0000")) throw new Error("文件包含二进制数据，不能按文本预览。");
  if (containsSensitiveConfiguration(content)) throw new Error("此文件包含疑似密码、令牌或密钥字段，已按敏感信息策略禁止预览。 ");
  return { path: toManagedRelativePath(path), previewKind: "text", content, size: info.size };
}

async function searchManagedFiles(root, query) {
  if (typeof query !== "string" || query.trim().length < 1 || query.length > 100) throw new Error("搜索内容长度无效。");
  const rootInfo = await assertManagedPathIsSafe(root);
  if (!rootInfo.isDirectory()) throw new Error("当前路径不是文件夹。");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const results = [];
  const pending = [{ path: root, depth: 0 }];
  let directoryCursor = 0;
  let scanned = 0;
  const maximumScannedEntries = 10_000;
  while (directoryCursor < pending.length && results.length < 500 && scanned < maximumScannedEntries) {
    const current = pending[directoryCursor++];
    const directoryEntries = await readdir(current.path, { withFileTypes: true });
    for (let offset = 0; offset < directoryEntries.length && results.length < 500 && scanned < maximumScannedEntries; offset += managedFileMetadataBatchSize) {
      const batch = directoryEntries.slice(offset, offset + Math.min(managedFileMetadataBatchSize, maximumScannedEntries - scanned));
      scanned += batch.length;
      const inspected = await inspectManagedFileEntries(current.path, batch);
      for (const entry of inspected) {
        if (!entry) continue;
        if (entry.name.toLocaleLowerCase().includes(normalizedQuery)) results.push(entry);
        if (entry.kind === "directory" && current.depth < 10) pending.push({ path: resolve(current.path, entry.name), depth: current.depth + 1 });
        if (results.length >= 500) break;
      }
    }
  }
  return { path: toManagedRelativePath(root), entries: results, truncated: results.length >= 500 || directoryCursor < pending.length || scanned >= maximumScannedEntries };
}

async function readManagedTextFile(path) {
  const info = await assertManagedPathIsSafe(path);
  if (isSensitivePreviewPath(path)) throw new Error("此路径按敏感文件策略禁止在线读取或编辑。 ");
  if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new Error("仅支持在线编辑 2 MiB 以内的普通文本文件。");
  const buffer = await readFile(path);
  let content;
  try { content = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch { throw new Error("此文件不是有效的 UTF-8 文本；请下载后使用本地程序编辑。"); }
  if (content.includes("\u0000")) throw new Error("此文件包含二进制内容；请下载后使用本地程序编辑。");
  if (containsSensitiveConfiguration(content)) throw new Error("此文件包含疑似密码、令牌或密钥字段，已按敏感信息策略禁止在线读取或编辑。 ");
  return { path: toManagedRelativePath(path), content, size: info.size, sha256: createHash("sha256").update(buffer).digest("hex") };
}

async function downloadManagedFile(path) {
  const info = await assertManagedPathIsSafe(path);
  if (!info.isFile() || info.size > 3 * 1024 * 1024) throw new Error("只支持下载 3 MiB 以内的普通文件。");
  return { path: toManagedRelativePath(path), name: basename(path), dataBase64: (await readFile(path)).toString("base64"), size: info.size };
}

async function writeManagedTextFile(path, content, expectedSha256) {
  const info = await assertManagedPathIsSafe(path);
  if (isSensitivePreviewPath(path)) throw new Error("敏感文件禁止通过文件管理器在线修改。");
  assertCanMutate(path);
  if (!info.isFile() || typeof content !== "string" || Buffer.byteLength(content, "utf8") > 2 * 1024 * 1024) {
    throw new Error("仅支持写入 2 MiB 以内的普通文本文件。");
  }
  if (content.includes("\u0000")) throw new Error("文本内容包含无效的空字符。");
  if (typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(expectedSha256)) throw new Error("编辑前文件摘要缺失，请重新读取后再保存。 ");
  const current = await readFile(path);
  if (createHash("sha256").update(current).digest("hex") !== expectedSha256) throw new Error("文件在编辑期间已被其他操作修改；请重新读取并合并后再保存。 ");
  const temporary = resolve(dirname(path), `.lfaa-edit-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx", mode: info.mode & 0o777 });
    const latestInfo = await assertManagedPathIsSafe(path);
    const latest = await readFile(path);
    if (latestInfo.dev !== info.dev || latestInfo.ino !== info.ino || createHash("sha256").update(latest).digest("hex") !== expectedSha256) throw new Error("文件在保存前已变化；保留了其他操作的内容。 ");
    await rename(temporary, path);
    const bytes = Buffer.byteLength(content, "utf8");
    return { path: toManagedRelativePath(path), size: bytes, sha256: createHash("sha256").update(content).digest("hex") };
  } finally { await rm(temporary, { force: true }).catch(() => undefined); }
}

async function createManagedFile(path) {
  const info = await assertManagedPathIsSafe(path, true);
  if (dangerousManagedFileExtensions.has(extname(path).toLocaleLowerCase("en-US"))) throw new Error("不能在文件管理器中创建可执行文件或脚本。 ");
  assertCanMutate(path);
  if (info) throw new Error("同名文件或文件夹已经存在。");
  const parentInfo = await assertManagedPathIsSafe(dirname(path));
  if (!parentInfo.isDirectory()) throw new Error("目标上级路径不是文件夹。");
  await writeFile(path, "", { encoding: "utf8", flag: "wx" });
  return { path: toManagedRelativePath(path), size: 0 };
}

async function createManagedFolder(path) {
  const info = await assertManagedPathIsSafe(path, true);
  assertCanMutate(path);
  if (info) throw new Error("同名文件或文件夹已经存在。");
  const parentInfo = await assertManagedPathIsSafe(dirname(path));
  if (!parentInfo.isDirectory()) throw new Error("目标上级路径不是文件夹。");
  await mkdir(path);
  return { path: toManagedRelativePath(path) };
}

async function renameManagedFile(path, name) {
  if (relative(dataDirectory, path) === "") throw new Error("不能重命名 LFAA 数据根目录。");
  if (!isSafeManagedFileName(name)) throw new Error("新名称包含不支持的字符。");
  if (dangerousManagedFileExtensions.has(extname(name).toLocaleLowerCase("en-US"))) throw new Error("不能将文件重命名为可执行文件或脚本。 ");
  const sourceInfo = await assertManagedPathIsSafe(path);
  const target = resolve(dirname(path), name);
  assertCanMutate(path);
  assertCanMutate(target);
  const targetRelative = toManagedRelativePath(target).split("/");
  if (protectedDataDirectories.includes(targetRelative[0]?.toLocaleLowerCase() ?? "")) throw new Error("目标名称保留给系统目录使用。");
  if (await assertManagedPathIsSafe(target, true)) throw new Error("同名文件或文件夹已经存在。");
  await rename(path, target);
  return { path: toManagedRelativePath(target), kind: sourceInfo.isDirectory() ? "directory" : "file" };
}

async function moveManagedFile(path, destinationPath) {
  if (relative(dataDirectory, path) === "") throw new Error("不能移动 LFAA 数据根目录。 ");
  const sourceInfo = await assertManagedPathIsSafe(path);
  if (typeof destinationPath !== "string") throw new Error("移动目标目录无效。 ");
  const destinationDirectory = resolveManagedFilePath(destinationPath, true);
  const destinationInfo = await assertManagedPathIsSafe(destinationDirectory);
  if (!destinationInfo.isDirectory()) throw new Error("移动目标必须是现有文件夹。 ");
  const target = resolve(destinationDirectory, basename(path));
  const targetRelative = relative(dataDirectory, target);
  const sourceRelative = relative(dataDirectory, path);
  if (targetRelative === sourceRelative) return { path: toManagedRelativePath(path), moved: false };
  if (sourceInfo.isDirectory() && (targetRelative.startsWith(`${sourceRelative}${sep}`) || targetRelative === sourceRelative)) throw new Error("不能将文件夹移动到自身内部。 ");
  assertCanMutate(path);
  assertCanMutate(target);
  if (await assertManagedPathIsSafe(target, true)) throw new Error("目标目录已存在同名文件或文件夹；未覆盖。 ");
  await rename(path, target);
  return { path: toManagedRelativePath(target), moved: true, kind: sourceInfo.isDirectory() ? "directory" : "file" };
}

async function readManagedTrashManifest() {
  const directory = resolve(dataDirectory, managedRecycleBinName, recycleNamespace);
  try { await assertManagedPathIsSafe(directory); }
  catch (error) { if (error?.code === "ENOENT") return { directory, items: [] }; throw error; }
  const manifestPath = resolve(directory, "manifest.json");
  try {
    const manifestInfo = await assertManagedPathIsSafe(manifestPath);
    if (!manifestInfo.isFile() || manifestInfo.size > 4 * 1024 * 1024) throw new Error("回收站索引超过安全容量。");
    const source = await readFile(manifestPath, "utf8");
    const value = JSON.parse(source);
    if (!Array.isArray(value) || value.length > managedRecycleBinLimit || value.some(item => !item || typeof item.id !== "string" || !/^[0-9a-f-]{36}$/iu.test(item.id) || typeof item.originalPath !== "string" || typeof item.name !== "string")) throw new Error("回收站索引结构无效或已超过容量上限。 ");
    return { directory, items: value };
  } catch (error) {
    if (error?.code === "ENOENT") return { directory, items: [] };
    throw error;
  }
}

async function writeManagedTrashManifest(directory, items) {
  await ensureManagedDirectory(directory);
  const manifestPath = resolve(directory, "manifest.json");
  const temporary = resolve(directory, `.manifest-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(items), { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, manifestPath);
  } finally { await rm(temporary, { force: true }).catch(() => undefined); }
}

async function listManagedTrash() {
  const { directory, items } = await readManagedTrashManifest();
  const entries = [];
  for (const item of items.slice(-500).reverse()) {
    const path = resolve(directory, item.id);
    let info;
    try { info = await lstat(path); } catch { continue; }
    if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) continue;
    entries.push({ name: item.name, path: item.originalPath, trashId: item.id, kind: info.isDirectory() ? "directory" : "file", size: info.isFile() ? info.size : 0, modifiedAt: item.deletedAt });
  }
  return { entries, truncated: items.length > 500 };
}

async function restoreManagedFile(trashId) {
  if (typeof trashId !== "string" || !/^[0-9a-f-]{36}$/iu.test(trashId)) throw new Error("回收站条目标识无效。 ");
  const { directory, items } = await readManagedTrashManifest();
  const item = items.find(entry => entry.id === trashId);
  if (!item) throw new Error("回收站中找不到此条目。 ");
  const original = resolveManagedFilePath(item.originalPath);
  const parent = await assertManagedPathIsSafe(dirname(original));
  if (!parent.isDirectory()) throw new Error("原目录已不存在；请先重新创建目录后恢复。 ");
  if (await assertManagedPathIsSafe(original, true)) throw new Error("原路径已存在同名文件或文件夹；请先重命名或移动现有项目。 ");
  assertCanMutate(original);
  const source = resolve(directory, trashId);
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error("回收站条目不是安全的普通文件或文件夹。 ");
  await rename(source, original);
  await writeManagedTrashManifest(directory, items.filter(entry => entry.id !== trashId));
  return { path: toManagedRelativePath(original), restored: true };
}

async function purgeManagedTrashItem(trashId) {
  if (typeof trashId !== "string" || !/^[0-9a-f-]{36}$/iu.test(trashId)) throw new Error("回收站条目标识无效。 ");
  const { directory, items } = await readManagedTrashManifest();
  if (!items.some(entry => entry.id === trashId)) throw new Error("回收站中找不到此条目。 ");
  const target = resolve(directory, trashId);
  const info = await lstat(target);
  if (info.isSymbolicLink()) throw new Error("回收站条目不是安全的普通文件或文件夹。 ");
  await rm(target, { recursive: info.isDirectory(), force: false });
  await writeManagedTrashManifest(directory, items.filter(entry => entry.id !== trashId));
  return { purged: true };
}

async function deleteManagedFile(path) {
  if (relative(dataDirectory, path) === "") throw new Error("不能删除 LFAA 数据根目录。");
  const info = await assertManagedPathIsSafe(path);
  assertCanMutate(path);
  const { directory, items } = await readManagedTrashManifest();
  if (items.length >= managedRecycleBinLimit) throw new Error("回收站已达到 5000 项上限；请先恢复或彻底清理部分项目。 ");
  const id = randomUUID();
  const originalPath = toManagedRelativePath(path);
  const deletedAt = new Date().toISOString();
  const target = resolve(directory, id);
  await ensureManagedDirectory(directory);
  await rename(path, target);
  try {
    await writeManagedTrashManifest(directory, [...items, { id, originalPath, name: basename(path), deletedAt }]);
  } catch (error) {
    await rename(target, path).catch(() => undefined);
    throw error;
  }
  return { path: originalPath, deleted: true, trashId: id };
}

async function uploadManagedFile(directory, name, dataBase64, expectedSha256) {
  if (!isSafeManagedFileName(name)) throw new Error("上传文件名包含不支持的字符。");
  if (dangerousManagedFileExtensions.has(extname(name).toLocaleLowerCase("en-US")) || !managedUploadExtensions.has(extname(name).toLocaleLowerCase("en-US"))) throw new Error("此文件扩展名不在允许上传列表中；可执行文件和脚本不允许上传。 ");
  if (!Buffer.isBuffer(dataBase64) && (typeof dataBase64 !== "string" || dataBase64.length > 4_194_304 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(dataBase64))) {
    throw new Error("上传文件编码格式无效。");
  }
  const buffer = Buffer.isBuffer(dataBase64) ? dataBase64 : Buffer.from(dataBase64, "base64");
  if (buffer.length > 3 * 1024 * 1024) throw new Error("单个上传文件不能超过 3 MiB。");
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  if (typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(expectedSha256) || sha256 !== expectedSha256) throw new Error("上传文件 SHA-256 校验失败；文件未写入节点磁盘。 ");
  const directoryInfo = await assertManagedPathIsSafe(directory);
  if (!directoryInfo.isDirectory()) throw new Error("上传目标不是文件夹。");
  const path = resolve(directory, name);
  assertCanMutate(path);
  const existing = await assertManagedPathIsSafe(path, true);
  if (existing) {
    if (existing.isFile() && existing.size === buffer.length && createHash("sha256").update(await readFile(path)).digest("hex") === sha256) {
      return { path: toManagedRelativePath(path), size: buffer.length, sha256, duplicate: true };
    }
    throw new Error("同名文件已经存在；请先重命名或移入回收站。 ");
  }
  await writeFile(path, buffer, { flag: "wx" });
  return { path: toManagedRelativePath(path), size: buffer.length, sha256, duplicate: false };
}


async function operate(operation, payload) {
  const previous = mutationTails.get(dataDirectory) ?? Promise.resolve();
  if (readOperations.has(operation)) return previous.then(() => performFileOperation(operation, payload));
  const result = previous.then(() => performFileOperation(operation, payload));
  const settled = result.then(() => undefined, () => undefined);
  mutationTails.set(dataDirectory, settled);
  void settled.finally(() => { if (mutationTails.get(dataDirectory) === settled) mutationTails.delete(dataDirectory); });
  return result;
}
async function openDownload(pathInput) {
  await (mutationTails.get(dataDirectory) ?? Promise.resolve());
  const path = resolveManagedFilePath(pathInput);
  const info = await assertManagedPathIsSafe(path);
  if (!info.isFile() || info.size > 3 * 1024 * 1024) throw new Error('只支持传输 3 MiB 以内的普通文件。');
  return {name: basename(path), size: info.size, stream: createReadStream(path)};
}
return {operate, openDownload, resolvePath: resolveManagedFilePath, ensureDirectory: ensureManagedDirectory, assertPath: assertManagedPathIsSafe};
}

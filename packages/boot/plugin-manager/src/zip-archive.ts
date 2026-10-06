/**
 * 功能：安全读取 GitHub 提供的 ZIP 插件快照。
 * 作用：限制归档尺寸、路径、文件类型和解压总量，校验 CRC 后只返回普通文件内容。
 * 关联文件：index.ts 调用本模块安装固定提交；任何归档路径和符号链接均不直接写入磁盘。
 */
import { inflateRawSync } from "node:zlib";

const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_BYTES = 128 * 1024 * 1024;
const MAX_FILES = 512;
const ZIP_EOCD = 0x06054b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_LOCAL = 0x04034b50;

export interface PluginArchiveFile { path: string; contents: Buffer }

export function readGithubZip(input: Buffer): PluginArchiveFile[] {
  if (input.length < 22 || input.length > MAX_ARCHIVE_BYTES) throw new Error("插件压缩包大小超出允许范围。");
  const eocd = findEndRecord(input);
  const disk = input.readUInt16LE(eocd + 4);
  const centralDisk = input.readUInt16LE(eocd + 6);
  const diskEntries = input.readUInt16LE(eocd + 8);
  const entryCount = input.readUInt16LE(eocd + 10);
  const centralSize = input.readUInt32LE(eocd + 12);
  const centralOffset = input.readUInt32LE(eocd + 16);
  const commentLength = input.readUInt16LE(eocd + 20);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entryCount || entryCount > MAX_FILES + 1 || eocd + 22 + commentLength !== input.length) {
    throw new Error("插件压缩包包含多卷或不受支持的 ZIP 目录格式。");
  }
  if (centralOffset + centralSize !== eocd) throw new Error("插件压缩包目录边界无效或使用了不支持的 ZIP64 格式。");

  const entries: Array<{ path: string; directory: boolean; method: number; flags: number; crc: number; compressed: number; size: number; localOffset: number }> = [];
  let cursor = centralOffset;
  let root = "";
  let totalBytes = 0;
  const seen = new Set<string>();
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > eocd || input.readUInt32LE(cursor) !== ZIP_CENTRAL) throw new Error("插件压缩包目录条目损坏。");
    const versionMadeBy = input.readUInt16LE(cursor + 4);
    const flags = input.readUInt16LE(cursor + 8);
    const method = input.readUInt16LE(cursor + 10);
    const crc = input.readUInt32LE(cursor + 16);
    const compressed = input.readUInt32LE(cursor + 20);
    const size = input.readUInt32LE(cursor + 24);
    const nameLength = input.readUInt16LE(cursor + 28);
    const extraLength = input.readUInt16LE(cursor + 30);
    const entryCommentLength = input.readUInt16LE(cursor + 32);
    const startDisk = input.readUInt16LE(cursor + 34);
    const externalAttributes = input.readUInt32LE(cursor + 38);
    const localOffset = input.readUInt32LE(cursor + 42);
    const end = cursor + 46 + nameLength + extraLength + entryCommentLength;
    if (end > eocd || startDisk !== 0 || !nameLength) throw new Error("插件压缩包目录条目不完整。");
    const encoding = (flags & 0x0800) !== 0 ? "utf8" : "latin1";
    const nameBytes = input.subarray(cursor + 46, cursor + 46 + nameLength);
    const rawPath = input.toString(encoding, cursor + 46, cursor + 46 + nameLength);
    if (encoding === "utf8" && !Buffer.from(rawPath, "utf8").equals(nameBytes)) throw new Error("插件压缩包包含无效 UTF-8 路径。");
    const directory = rawPath.endsWith("/");
    const safePath = normalizeArchivePath(rawPath, directory);
    const pieces = safePath.split("/");
    if (!root) root = pieces[0]!;
    if (pieces[0] !== root) throw new Error("插件压缩包必须只有一个仓库根目录。");
    if (pieces.length === 1 && directory) { cursor = end; continue; }
    const path = pieces.slice(1).join("/");
    if (!path) { cursor = end; continue; }
    const key = path.toLocaleLowerCase("en-US");
    if (seen.has(key)) throw new Error(`插件压缩包包含重复路径：${path}`);
    seen.add(key);
    if (entries.length >= MAX_FILES) throw new Error("插件压缩包文件数量超过允许上限。");
    const hostSystem = versionMadeBy >>> 8;
    const unixMode = externalAttributes >>> 16;
    const unixType = unixMode & 0xf000;
    if (unixType === 0xa000 || hostSystem === 3 && unixType !== 0 && unixType !== (directory ? 0x4000 : 0x8000)) throw new Error(`插件压缩包包含链接或特殊文件：${path}`);
    if (directory && size !== 0) throw new Error(`插件目录条目包含数据：${path}`);
    if (!directory) {
      if (size > MAX_FILE_BYTES || compressed > MAX_ARCHIVE_BYTES) throw new Error(`插件文件过大：${path}`);
      totalBytes += size;
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error("插件解压后总大小超过允许上限。");
      if ((flags & 0x0001) !== 0 || ![0, 8].includes(method)) throw new Error(`插件文件使用不支持的压缩方式：${path}`);
    }
    entries.push({ path, directory, method, flags, crc, compressed, size, localOffset });
    cursor = end;
  }
  if (cursor !== eocd || !root) throw new Error("插件压缩包中央目录长度不匹配。");

  const files: PluginArchiveFile[] = [];
  for (const entry of entries) {
    if (entry.directory) continue;
    const offset = entry.localOffset;
    if (offset + 30 > centralOffset || input.readUInt32LE(offset) !== ZIP_LOCAL) throw new Error(`插件文件头损坏：${entry.path}`);
    const localFlags = input.readUInt16LE(offset + 6);
    const localMethod = input.readUInt16LE(offset + 8);
    const localNameLength = input.readUInt16LE(offset + 26);
    const localExtraLength = input.readUInt16LE(offset + 28);
    const localName = input.toString((entry.flags & 0x0800) !== 0 ? "utf8" : "latin1", offset + 30, offset + 30 + localNameLength);
    if (localName.replaceAll("\\", "/") !== `${root}/${entry.path}` || localFlags !== entry.flags || localMethod !== entry.method) throw new Error(`插件本地文件头与目录不一致：${entry.path}`);
    const dataStart = offset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + entry.compressed;
    if (dataEnd > centralOffset) throw new Error(`插件压缩数据越界：${entry.path}`);
    const compressed = input.subarray(dataStart, dataEnd);
    let contents: Buffer;
    try {
      contents = entry.method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: Math.max(1, entry.size) });
    } catch { throw new Error(`插件文件无法安全解压：${entry.path}`); }
    if (contents.length !== entry.size || crc32(contents) !== entry.crc) throw new Error(`插件文件校验失败：${entry.path}`);
    files.push({ path: entry.path, contents });
  }
  return files;
}

function findEndRecord(input: Buffer): number {
  const minimum = Math.max(0, input.length - 65_557);
  for (let offset = input.length - 22; offset >= minimum; offset -= 1) {
    if (input.readUInt32LE(offset) === ZIP_EOCD && offset + 22 + input.readUInt16LE(offset + 20) === input.length) return offset;
  }
  throw new Error("插件压缩包缺少结束目录记录。");
}

function normalizeArchivePath(value: string, directory: boolean): string {
  if (value.includes("\\") || value.startsWith("/") || /^[a-z]:/iu.test(value) || value.includes("\0")) throw new Error("插件压缩包包含绝对或无效路径。");
  const trimmed = directory ? value.slice(0, -1) : value;
  const pieces = trimmed.split("/");
  if (!trimmed || trimmed.length > 220 || pieces.some((piece) => !piece || piece === "." || piece === ".." || /[<>:"|?*]/u.test(piece) || /[ .]$/u.test(piece))) throw new Error("插件压缩包包含路径穿越或 Windows 不兼容文件名。");
  for (const piece of pieces) if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(piece)) throw new Error("插件压缩包包含 Windows 保留设备名。");
  return pieces.join("/");
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(contents: Buffer): number {
  let value = 0xffffffff;
  for (const byte of contents) value = crcTable[(value ^ byte) & 0xff]! ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

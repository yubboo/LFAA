/**
 * 功能：安全读取 NPM registry 发布的 gzip TAR 包。
 * 作用：验证归档边界、校验和、单一 package/ 根目录及普通文件类型；绝不执行包脚本。
 * 关联文件：npm-source.ts 只接收官方 registry 的完整性校验通过的 tarball。
 */
import { gunzipSync } from "node:zlib";
import type { PluginArchiveFile } from "./zip-archive.js";

const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 128 * 1024 * 1024;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_FILES = 512;
const BLOCK = 512;

export function readNpmTarGzip(input: Buffer): PluginArchiveFile[] {
  if (input.length < 2 || input.length > MAX_ARCHIVE_BYTES || input[0] !== 0x1f || input[1] !== 0x8b) {
    throw new Error("NPM 插件 tarball 尺寸或 gzip 格式无效。");
  }
  let archive: Buffer;
  try { archive = gunzipSync(input, { maxOutputLength: MAX_UNPACKED_BYTES + MAX_FILES * BLOCK }); }
  catch { throw new Error("NPM 插件 tarball 无法安全解压或超过解压上限。"); }
  const files: PluginArchiveFile[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;
  let offset = 0;
  let ended = false;

  while (offset + BLOCK <= archive.length) {
    const header = archive.subarray(offset, offset + BLOCK);
    if (header.every((byte) => byte === 0)) {
      const tail = archive.subarray(offset);
      if (tail.some((byte) => byte !== 0)) throw new Error("NPM 插件 TAR 结束标记后仍包含数据。");
      ended = true;
      break;
    }
    verifyHeaderChecksum(header);
    const name = readTarText(header.subarray(0, 100));
    const prefix = readTarText(header.subarray(345, 500));
    const rawPath = prefix ? `${prefix}/${name}` : name;
    const type = header[156] === 0 ? "0" : String.fromCharCode(header[156]!);
    const size = readTarOctal(header.subarray(124, 136), "文件大小");
    const mode = readTarOctal(header.subarray(100, 108), "文件权限");
    if (rawPath.split("/")[0] !== "package") throw new Error("NPM 插件 TAR 必须仅包含 package/ 根目录。");
    const isDirectory = type === "5";
    if (!isDirectory && type !== "0" && type !== "7") throw new Error(`NPM 插件 TAR 包含链接或特殊文件：${rawPath}`);
    const normalized = normalizeNpmPath(rawPath, isDirectory);
    const path = normalized.slice("package/".length);
    if (!path) {
      if (!isDirectory || size !== 0) throw new Error("NPM 插件 TAR 根目录条目无效。");
    } else if (isDirectory) {
      if (size !== 0) throw new Error(`NPM 插件目录条目包含数据：${path}`);
    } else {
      const key = path.toLocaleLowerCase("en-US");
      if (seen.has(key)) throw new Error(`NPM 插件 TAR 包含重复路径：${path}`);
      seen.add(key);
      if (files.length >= MAX_FILES) throw new Error("NPM 插件 TAR 文件数量超过允许上限。");
      if (size > MAX_FILE_BYTES) throw new Error(`NPM 插件文件过大：${path}`);
      totalBytes += size;
      if (totalBytes > MAX_UNPACKED_BYTES) throw new Error("NPM 插件 TAR 解压后总大小超过允许上限。");
      // 可执行位不影响 Node import；剥除所有上游 mode，安装器一律以受限权限落盘。
      void mode;
      const dataStart = offset + BLOCK;
      const dataEnd = dataStart + size;
      if (dataEnd > archive.length) throw new Error(`NPM 插件 TAR 文件内容越界：${path}`);
      files.push({ path, contents: Buffer.from(archive.subarray(dataStart, dataEnd)) });
    }
    const paddedSize = Math.ceil(size / BLOCK) * BLOCK;
    if (!Number.isSafeInteger(paddedSize) || offset + BLOCK + paddedSize > archive.length) throw new Error(`NPM 插件 TAR 文件边界无效：${rawPath}`);
    offset += BLOCK + paddedSize;
  }
  if (!ended || files.length === 0) throw new Error("NPM 插件 TAR 缺少有效结束标记或文件内容。");
  return files;
}

function verifyHeaderChecksum(header: Buffer): void {
  const expected = readTarOctal(header.subarray(148, 156), "头校验和");
  let actual = 0;
  for (let index = 0; index < BLOCK; index += 1) actual += index >= 148 && index < 156 ? 0x20 : header[index]!;
  if (actual !== expected) throw new Error("NPM 插件 TAR 头校验失败。");
}

function readTarOctal(value: Buffer, label: string): number {
  const text = value.toString("ascii").replace(/\0.*$/u, "").trim();
  if (!/^[0-7]*$/u.test(text)) throw new Error(`NPM 插件 TAR ${label}字段格式无效。`);
  const result = text ? Number.parseInt(text, 8) : 0;
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`NPM 插件 TAR ${label}超出允许范围。`);
  return result;
}

function readTarText(value: Buffer): string {
  const end = value.indexOf(0);
  const text = value.subarray(0, end < 0 ? value.length : end).toString("utf8");
  if (text.includes("\ufffd") || /[\r\n\0]/u.test(text)) throw new Error("NPM 插件 TAR 路径包含无效 UTF-8 文本。");
  return text;
}

function normalizeNpmPath(value: string, directory: boolean): string {
  if (!value || value.length > 240 || value.includes("\\") || value.startsWith("/") || /^[a-z]:/iu.test(value)) throw new Error("NPM 插件 TAR 包含绝对或无效路径。");
  const trimmed = directory ? value.replace(/\/+$/u, "") : value;
  const pieces = trimmed.split("/");
  if (pieces[0] !== "package" || pieces.length < 1 || pieces.some((piece) => !piece || piece === "." || piece === ".." || /[<>:"|?*]/u.test(piece) || /[ .]$/u.test(piece))) {
    throw new Error("NPM 插件 TAR 包含路径穿越或 Windows 不兼容文件名。");
  }
  for (const piece of pieces) if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(piece)) throw new Error("NPM 插件 TAR 包含 Windows 保留设备名。");
  return pieces.join("/");
}

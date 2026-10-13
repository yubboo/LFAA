/**
 * 功能：本机文件系统的真实读写后端（只读/写/列目录/字符串替换）。
 * 作用：被 tool-fs / tool-fs-search / tool-str-replace-editor 直接复用，统一大小上限、二进制拦截与原子写。
 * 安全边界：
 *  - 读文本时硬上限 maxBytes，超过直接报错 FS_TOO_LARGE，绝不把无界大文件整段塞进模型上下文；
 *  - 命中 NUL 字节视为二进制，拒绝按文本返回；
 *  - 写文件先落临时文件再原子改名，避免写一半损坏原文件；
 *  - 所有路径边界由 paths.ts 的 resolveLocalPath 统一把关，本模块只接收已解析的绝对路径。
 * 关联文件：src/paths.ts、packages/fs/tool-fs/src/index.ts。
 */
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { FsLocalError } from "./paths.js";

/** 单次读文本进上下文的默认字节上限（约 256 KiB 文本）。更大文件必须用 offset/limit 分页。 */
export const LOCAL_FS_DEFAULT_READ_BYTES = 262_144;
/** 读文件的硬上限：超过即拒绝，防止误读超大二进制/日志。 */
export const LOCAL_FS_HARD_READ_BYTES = 2 * 1024 * 1024;
/** 单次写文件内容上限，防止一次性写入巨型内容撑爆磁盘。 */
export const LOCAL_FS_MAX_WRITE_BYTES = 2 * 1024 * 1024;

export interface ReadTextResult {
  readonly content: string;
  readonly size: number;
  /** 是否因超过单次上限被截断（分页读取时为 false）。 */
  readonly truncated: boolean;
}

/** 读取普通文本文件；拒绝目录、特殊文件、二进制与超大文件。offset/limit 按字符做软分页提示。 */
export async function readLocalText(absPath: string, maxBytes: number = LOCAL_FS_DEFAULT_READ_BYTES): Promise<ReadTextResult> {
  let info;
  try {
    info = await stat(absPath);
  } catch (error) {
    throw new FsLocalError(`找不到文件：${absPath}`, "FS_NOT_FOUND");
  }
  if (info.isDirectory()) throw new FsLocalError(`这是目录而非文件：${absPath}`, "FS_NOT_REGULAR_FILE");
  if (!info.isFile()) throw new FsLocalError(`不是普通文件（可能是设备/管道/符号链接目标）：${absPath}`, "FS_NOT_REGULAR_FILE");
  if (info.size > LOCAL_FS_HARD_READ_BYTES) {
    // 安全边界：硬上限命中，拒绝整体读取，提示模型改用分页 offset/limit 或搜索工具定位。
    throw new FsLocalError(`文件过大（${info.size} 字节，超过硬上限 ${LOCAL_FS_HARD_READ_BYTES}）。请用 offset/limit 分页读取或先搜索定位。`, "FS_TOO_LARGE");
  }
  const buffer = await readFile(absPath);
  // 二进制拦截：UTF-8 文本不会包含 NUL 字节；命中即拒绝按文本返回。
  if (buffer.includes(0)) {
    throw new FsLocalError("该文件疑似二进制，不按文本返回。", "FS_NOT_TEXT");
  }
  const truncated = buffer.byteLength > maxBytes;
  const slice = truncated ? buffer.subarray(0, maxBytes) : buffer;
  return { content: slice.toString("utf8"), size: info.size, truncated };
}

/** 读取文件的一个字节窗口（offset/limit），供大文件分页；不整体缓冲超出窗口的内容。 */
export async function readLocalByteRange(absPath: string, offset: number, length: number): Promise<{ content: string; size: number; truncated: boolean }> {
  let info;
  try {
    info = await stat(absPath);
  } catch {
    throw new FsLocalError(`找不到文件：${absPath}`, "FS_NOT_FOUND");
  }
  if (!info.isFile()) throw new FsLocalError(`不是普通文件：${absPath}`, "FS_NOT_REGULAR_FILE");
  if (info.size > LOCAL_FS_HARD_READ_BYTES) throw new FsLocalError(`文件过大（${info.size} 字节）。`, "FS_TOO_LARGE");
  const start = Math.max(0, Math.min(offset, info.size));
  const end = Math.min(info.size, start + Math.max(0, length));
  if (start >= end) return { content: "", size: info.size, truncated: false };
  const handle = await (await import("node:fs/promises")).open(absPath, "r");
  try {
    const buf = Buffer.alloc(end - start);
    const { bytesRead } = await handle.read(buf, 0, buf.length, start);
    const slice = buf.subarray(0, bytesRead);
    if (slice.includes(0)) throw new FsLocalError("该文件疑似二进制，不按文本返回。", "FS_NOT_TEXT");
    return { content: slice.toString("utf8"), size: info.size, truncated: end < info.size };
  } finally {
    await handle.close();
  }
}

export interface ListEntry {
  readonly name: string;
  readonly type: "file" | "directory" | "other";
  readonly size: number;
}

/** 列出目录直接子项（稳定名称排序），只返回元数据，绝不读取文件内容。 */
export async function listLocalDir(absPath: string): Promise<ListEntry[]> {
  let info;
  try {
    info = await stat(absPath);
  } catch {
    throw new FsLocalError(`找不到目录：${absPath}`, "FS_NOT_FOUND");
  }
  if (!info.isDirectory()) throw new FsLocalError(`这不是目录：${absPath}`, "FS_NOT_DIRECTORY");
  const entries = await readdir(absPath, { withFileTypes: true });
  const result: ListEntry[] = [];
  for (const entry of entries) {
    let size = 0;
    if (entry.isFile()) {
      try {
        size = (await stat(absPath + "\\" + entry.name)).size;
      } catch {
        size = 0;
      }
    }
    result.push({
      name: entry.name,
      type: entry.isFile() ? "file" : entry.isDirectory() ? "directory" : "other",
      size
    });
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

/** 原子写入文本：先写临时文件再改名覆盖，父目录不存在则递归创建。 */
export async function writeLocalText(absPath: string, content: string): Promise<{ bytesWritten: number; created: boolean }> {
  if (typeof content !== "string") throw new FsLocalError("写入内容必须是字符串。", "FS_INVALID_ARGUMENT");
  if (Buffer.byteLength(content, "utf8") > LOCAL_FS_MAX_WRITE_BYTES) {
    throw new FsLocalError(`写入内容超过上限 ${LOCAL_FS_MAX_WRITE_BYTES} 字节，请分段写入。`, "FS_TOO_LARGE");
  }
  let existed = true;
  try {
    await stat(absPath);
  } catch {
    existed = false;
  }
  await mkdir(dirname(absPath), { recursive: true });
  // 原子写：同目录临时文件 -> 改名目标，避免进程崩溃留下半截文件。
  const tmp = `${absPath}.tmp-${randomUUID()}`;
  try {
    await writeFile(tmp, content, "utf8");
    try {
      await rename(tmp, absPath);
    } catch {
      // Windows 上目标被占用时改名可能失败：先删目标再改名（覆盖窗口极短，可接受）。
      await rm(absPath, { force: true });
      await rename(tmp, absPath);
    }
  } finally {
    await rm(tmp, { force: true });
  }
  return { bytesWritten: Buffer.byteLength(content, "utf8"), created: !existed };
}

export interface ReplaceResult {
  readonly occurrences: number;
  readonly bytesWritten: number;
}

/**
 * 字符串替换编辑：读全文 -> 精确匹配 oldString -> 写回。
 * replaceAll=false 时要求恰好匹配 1 处，匹配 0 或 >1 处都报错，避免误改多处。
 */
export async function replaceInLocalFile(absPath: string, oldString: string, newString: string, replaceAll: boolean): Promise<ReplaceResult> {
  if (typeof oldString !== "string" || oldString.length === 0) {
    throw new FsLocalError("old_string 不能为空；整文件重写请用 write_file。", "FS_EDIT_NOT_FOUND");
  }
  if (typeof newString !== "string") throw new FsLocalError("new_string 必须是字符串。", "FS_INVALID_ARGUMENT");
  const current = await readLocalText(absPath, LOCAL_FS_HARD_READ_BYTES);
  if (current.content.includes("\0")) throw new FsLocalError("文件疑似二进制，拒绝字符串替换。", "FS_NOT_TEXT");

  const occurrences = countOccurrences(current.content, oldString);
  if (occurrences === 0) throw new FsLocalError("在文件中未找到 old_string，请核对原文（注意空白与换行）。", "FS_EDIT_NOT_FOUND");
  if (!replaceAll && occurrences > 1) {
    // 安全边界：非 replaceAll 时必须唯一匹配，防止模型给出的片段在文件里出现多次而误改。
    throw new FsLocalError(`old_string 在文件中出现 ${occurrences} 次，不唯一。请给出更长的上下文片段使其唯一，或显式 replace_all。`, "FS_AMBIGUOUS_EDIT");
  }
  const next = replaceAll ? current.content.split(oldString).join(newString) : current.content.replace(oldString, newString);
  const written = await writeLocalText(absPath, next);
  return { occurrences, bytesWritten: written.bytesWritten };
}

/** 统计非重叠出现次数。 */
function countOccurrences(text: string, search: string): number {
  let count = 0;
  let index = text.indexOf(search);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(search, index + search.length);
  }
  return count;
}

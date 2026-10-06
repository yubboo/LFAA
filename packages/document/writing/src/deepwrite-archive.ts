/**
 * 功能：在内存中安全读写 DeepWrite 项目 ZIP，并把受支持的清单映射为写作导入 DTO。
 * 作用：只解析受限 ZIP32 项目文件，不访问文件系统；Writing Service 负责账户隔离和持久化。
 * 关联文件：service.ts、writing-controller/src/index.ts、docs/PROMPTS.md。
 */
import { deflateRawSync, inflateRawSync } from "node:zlib";
import type { WritingCatalogKind } from "./service.js";
import { getWritingSpecialist, type WritingSpecialistId } from "./writing-specialist-library.js";

export const DEEPWRITE_ZIP_MAX_COMPRESSED_BYTES = 32 * 1024 * 1024;
export const DEEPWRITE_ZIP_MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
export const DEEPWRITE_ZIP_MAX_ENTRIES = 5_000;
export const DEEPWRITE_ZIP_MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const ZIP_EOCD_SEARCH_BYTES = 22 + 65_535;
const MAX_JSON_BYTES = 4 * 1024 * 1024;

export interface DeepWriteZipEntryInput { path: string; data: string | Uint8Array }
export interface DeepWriteCatalogEntryInput { kind: WritingCatalogKind; title: string; content: string }
export interface DeepWriteSkillInput { title: string; description: string; instructions: string; enabled: boolean }
export interface DeepWriteImportChapter { externalId: string; volumeExternalId: string; title: string; order: number; content: string }
export interface DeepWriteImportVolume { externalId: string; title: string; order: number }
export interface DeepWriteImportProject {
  title: string;
  outline: string;
  volumes: DeepWriteImportVolume[];
  chapters: DeepWriteImportChapter[];
  materials: DeepWriteCatalogEntryInput[];
  aiRoleId: WritingSpecialistId;
  skills: DeepWriteSkillInput[];
  catalog: DeepWriteCatalogEntryInput[];
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function assertSafeRelativePath(path: string): string {
  if (!path || path.length > 2_048 || path.startsWith("/") || path.startsWith("\\") || path.includes("\\") || path.includes("\0") || /^[a-z]:/iu.test(path)) {
    throw new Error("ZIP 中包含不安全的项目路径。");
  }
  const directory = path.endsWith("/");
  const segments = (directory ? path.slice(0, -1) : path).split("/");
  if (segments.length === 0 || segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))) {
    throw new Error("ZIP 中包含不安全的项目路径。");
  }
  return path;
}

function push16(target: Buffer, offset: number, value: number): void { target.writeUInt16LE(value, offset); }
function push32(target: Buffer, offset: number, value: number): void { target.writeUInt32LE(value >>> 0, offset); }

/** 创建 ZIP32，逐项使用内存压缩；不会建立临时文件。 */
export function createDeepWriteZip(entries: DeepWriteZipEntryInput[]): Buffer {
  if (entries.length === 0 || entries.length > DEEPWRITE_ZIP_MAX_ENTRIES) throw new Error("导出项目文件数量超出 ZIP 限制。");
  const names = new Set<string>();
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  let centralBytes = 0;
  let expandedTotal = 0;
  for (const entry of entries) {
    const path = assertSafeRelativePath(entry.path);
    const pathKey = path.normalize("NFC").toLocaleLowerCase("en-US");
    if (names.has(pathKey)) throw new Error("导出项目存在重复文件路径。");
    names.add(pathKey);
    const name = Buffer.from(path, "utf8");
    const raw = typeof entry.data === "string" ? Buffer.from(entry.data, "utf8") : Buffer.from(entry.data);
    expandedTotal += raw.byteLength;
    if (raw.byteLength > DEEPWRITE_ZIP_MAX_ENTRY_BYTES || expandedTotal > DEEPWRITE_ZIP_MAX_UNCOMPRESSED_BYTES) throw new Error("作品数据超过 DeepWrite ZIP 文件大小限制。");
    const deflated = raw.byteLength ? deflateRawSync(raw, { level: 6 }) : raw;
    const method = deflated.byteLength < raw.byteLength ? 8 : 0;
    const compressed = method === 8 ? deflated : raw;
    const crc = crc32(raw);
    const local = Buffer.alloc(30 + name.byteLength);
    push32(local, 0, 0x04034b50); push16(local, 4, 20); push16(local, 6, 0x0800); push16(local, 8, method);
    push32(local, 14, crc); push32(local, 18, compressed.byteLength); push32(local, 22, raw.byteLength);
    push16(local, 26, name.byteLength); name.copy(local, 30);
    localParts.push(local, compressed);

    const central = Buffer.alloc(46 + name.byteLength);
    push32(central, 0, 0x02014b50); push16(central, 4, 0x0314); push16(central, 6, 20); push16(central, 8, 0x0800); push16(central, 10, method);
    push32(central, 16, crc); push32(central, 20, compressed.byteLength); push32(central, 24, raw.byteLength);
    push16(central, 28, name.byteLength); push32(central, 38, 0o100644 << 16); push32(central, 42, localOffset); name.copy(central, 46);
    if (localOffset + local.byteLength + compressed.byteLength + centralBytes + central.byteLength + 22 > DEEPWRITE_ZIP_MAX_COMPRESSED_BYTES) throw new Error("压缩后的作品超过 32 MiB，不能导出为单个 DeepWrite ZIP。");
    centralParts.push(central);
    centralBytes += central.byteLength;
    localOffset += local.byteLength + compressed.byteLength;
  }
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  push32(eocd, 0, 0x06054b50); push16(eocd, 8, entries.length); push16(eocd, 10, entries.length);
  push32(eocd, 12, central.byteLength); push32(eocd, 16, localOffset);
  const archive = Buffer.concat([...localParts, central, eocd]);
  if (archive.byteLength > DEEPWRITE_ZIP_MAX_COMPRESSED_BYTES) throw new Error("压缩后的作品超过 32 MiB，不能导出为单个 DeepWrite ZIP。");
  return archive;
}

/** 只读 ZIP32 的 central directory；拒绝 ZIP64、加密、链接、冲突路径和损坏校验和。 */
export function readDeepWriteZip(archiveInput: Uint8Array): Map<string, string> {
  const archive = Buffer.from(archiveInput);
  if (archive.byteLength < 22 || archive.byteLength > DEEPWRITE_ZIP_MAX_COMPRESSED_BYTES) throw new Error("ZIP 文件为空或超过 32 MiB 限制。");
  const searchStart = Math.max(0, archive.byteLength - ZIP_EOCD_SEARCH_BYTES);
  let eocdOffset = -1;
  for (let offset = archive.byteLength - 22; offset >= searchStart; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50 && offset + 22 + archive.readUInt16LE(offset + 20) === archive.byteLength) { eocdOffset = offset; break; }
  }
  if (eocdOffset < 0) throw new Error("ZIP 中缺少有效的 ZIP32 目录结束记录。");
  const disk = archive.readUInt16LE(eocdOffset + 4), directoryDisk = archive.readUInt16LE(eocdOffset + 6);
  const diskCount = archive.readUInt16LE(eocdOffset + 8), count = archive.readUInt16LE(eocdOffset + 10);
  const directoryBytes = archive.readUInt32LE(eocdOffset + 12), directoryOffset = archive.readUInt32LE(eocdOffset + 16);
  if (disk !== 0 || directoryDisk !== 0 || diskCount !== count || count === 0xffff || directoryBytes === 0xffffffff || directoryOffset === 0xffffffff || count > DEEPWRITE_ZIP_MAX_ENTRIES) throw new Error("不支持分卷 ZIP 或 ZIP64，或文件数量超限。");
  if (directoryOffset + directoryBytes !== eocdOffset) throw new Error("ZIP central directory 范围无效。");

  const files = new Map<string, string>();
  const seenPaths = new Set<string>();
  const localOffsets = new Set<number>();
  let expandedTotal = 0;
  let cursor = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > eocdOffset || archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error("ZIP central directory 条目损坏。");
    const madeBy = archive.readUInt16LE(cursor + 4), flags = archive.readUInt16LE(cursor + 8), method = archive.readUInt16LE(cursor + 10);
    const expectedCrc = archive.readUInt32LE(cursor + 16), compressedSize = archive.readUInt32LE(cursor + 20), expandedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28), extraLength = archive.readUInt16LE(cursor + 30), commentLength = archive.readUInt16LE(cursor + 32);
    const startDisk = archive.readUInt16LE(cursor + 34), externalAttributes = archive.readUInt32LE(cursor + 38), localOffset = archive.readUInt32LE(cursor + 42);
    const entryEnd = cursor + 46 + nameLength + extraLength + commentLength;
    if (entryEnd > eocdOffset || startDisk !== 0 || compressedSize === 0xffffffff || expandedSize === 0xffffffff || localOffset === 0xffffffff) throw new Error("ZIP central directory 含越界、分卷或 ZIP64 条目。");
    const nameBytes = archive.subarray(cursor + 46, cursor + 46 + nameLength);
    let path: string;
    try { path = new TextDecoder("utf-8", { fatal: true }).decode(nameBytes); } catch { throw new Error("ZIP 文件名不是有效 UTF-8。"); }
    assertSafeRelativePath(path);
    const key = path.normalize("NFC").toLocaleLowerCase("en-US");
    if (seenPaths.has(key)) throw new Error("ZIP 含重复或大小写冲突的路径。");
    seenPaths.add(key);
    const isDirectory = path.endsWith("/") || Boolean(externalAttributes & 0x10);
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    const unixType = unixMode & 0xf000;
    if ((madeBy >>> 8) === 3 && (unixType === 0xa000 || (unixType !== 0 && unixType !== 0x8000 && unixType !== 0x4000))) throw new Error("ZIP 不允许包含符号链接或特殊文件。");
    if ((flags & 1) !== 0 || (flags & 0x40) !== 0) throw new Error("ZIP 加密条目不受支持。");
    if (method !== 0 && method !== 8) throw new Error("ZIP 使用了不支持的压缩方式。");
    if (compressedSize > DEEPWRITE_ZIP_MAX_ENTRY_BYTES || expandedSize > DEEPWRITE_ZIP_MAX_ENTRY_BYTES) throw new Error("ZIP 单个文件超过 8 MiB 限制。");
    expandedTotal += expandedSize;
    if (expandedTotal > DEEPWRITE_ZIP_MAX_UNCOMPRESSED_BYTES) throw new Error("ZIP 解压后超过 64 MiB 限制。");
    if (localOffsets.has(localOffset) || localOffset + 30 > directoryOffset || archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("ZIP 本地文件头重复或无效。");
    localOffsets.add(localOffset);
    const localFlags = archive.readUInt16LE(localOffset + 6), localMethod = archive.readUInt16LE(localOffset + 8);
    const localNameLength = archive.readUInt16LE(localOffset + 26), localExtraLength = archive.readUInt16LE(localOffset + 28);
    const localNameStart = localOffset + 30, dataOffset = localNameStart + localNameLength + localExtraLength, dataEnd = dataOffset + compressedSize;
    if (dataEnd > directoryOffset || localFlags !== flags || localMethod !== method || localNameLength !== nameLength || !archive.subarray(localNameStart, localNameStart + localNameLength).equals(nameBytes)) throw new Error("ZIP 本地文件头与 central directory 不一致。");
    if ((flags & 8) === 0 && (archive.readUInt32LE(localOffset + 14) !== expectedCrc || archive.readUInt32LE(localOffset + 18) !== compressedSize || archive.readUInt32LE(localOffset + 22) !== expandedSize)) throw new Error("ZIP 本地文件头中的大小或 CRC 不一致。");
    const compressed = archive.subarray(dataOffset, dataEnd);
    let expanded: Buffer;
    try {
      expanded = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: DEEPWRITE_ZIP_MAX_ENTRY_BYTES + 1 });
    } catch { throw new Error("ZIP 文件无法安全解压。"); }
    if (expanded.byteLength !== expandedSize || crc32(expanded) !== expectedCrc) throw new Error("ZIP 文件大小或 CRC 校验失败。");
    if (isDirectory) {
      if (expanded.byteLength !== 0) throw new Error("ZIP 目录条目不能包含正文。");
    } else {
      if (!path.endsWith(".md") && !path.endsWith(".json")) throw new Error("项目 ZIP 只接受 Markdown 与 JSON 文件。");
      if (files.has(path)) throw new Error("ZIP 项目路径重复。");
      try { files.set(path, new TextDecoder("utf-8", { fatal: true }).decode(expanded)); } catch { throw new Error("项目文件不是有效 UTF-8。"); }
    }
    cursor = entryEnd;
  }
  if (cursor !== eocdOffset) throw new Error("ZIP central directory 长度与条目数量不匹配。");
  return trimSingleProjectRoot(files);
}

function trimSingleProjectRoot(files: Map<string, string>): Map<string, string> {
  if (files.has("deepwrite.json")) return files;
  const roots = new Set([...files.keys()].map((path) => path.split("/")[0]!));
  if (roots.size !== 1) return files;
  const root = [...roots][0]!;
  if (!files.has(`${root}/deepwrite.json`)) return files;
  return new Map([...files].map(([path, content]) => [path.slice(root.length + 1), content]));
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("DeepWrite 项目清单结构无效。");
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || value.length > max) throw new Error(`DeepWrite ${label} 缺失或超出长度限制。`);
  return value;
}

function projectText(files: Map<string, string>, pathValue: unknown, label: string): string {
  const path = assertSafeRelativePath(text(pathValue, `${label}路径`, 2_048));
  if (!path.endsWith(".md")) throw new Error(`DeepWrite ${label}路径必须指向 Markdown 文件。`);
  const content = files.get(path);
  if (content === undefined) throw new Error(`DeepWrite 项目缺少${label}文件：${path}`);
  if (Buffer.byteLength(content, "utf8") > DEEPWRITE_ZIP_MAX_ENTRY_BYTES) throw new Error(`DeepWrite ${label}文件超过 8 MiB 限制。`);
  return content;
}

function parseJson(files: Map<string, string>, path: string): Record<string, unknown> {
  const source = files.get(path);
  if (source === undefined || Buffer.byteLength(source, "utf8") > MAX_JSON_BYTES) throw new Error(`DeepWrite 项目缺少或超限的 JSON 文件：${path}`);
  try { return record(JSON.parse(source) as unknown); } catch (error) { if (error instanceof Error && error.message.startsWith("DeepWrite")) throw error; throw new Error(`DeepWrite 项目 JSON 无法解析：${path}`); }
}

function validateIndexedFileReferences(index: Record<string, unknown>, files: Map<string, string>): void {
  const ids = new Set<string>();
  const paths = new Set<string>();
  const visit = (value: unknown, depth: number): void => {
    if (depth > 32 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) { for (const child of value) visit(child, depth + 1); return; }
    const row = value as Record<string, unknown>;
    if (typeof row.path === "string") {
      const path = assertSafeRelativePath(row.path);
      if ((!path.endsWith(".md") && !path.endsWith(".json")) || !files.has(path)) throw new Error(`DeepWrite 文件引用不存在或类型无效：${path}`);
      if (typeof row.id !== "string" || !row.id.trim() || row.id.length > 160 || ids.has(row.id) || paths.has(path)) throw new Error("DeepWrite 文件引用含重复 ID/路径或无效 ID。");
      ids.add(row.id);
      paths.add(path);
    }
    for (const [key, child] of Object.entries(row)) if (key !== "path") visit(child, depth + 1);
  };
  visit(index, 0);
}

function filenameTitle(path: string): string {
  const basename = path.split("/").pop() ?? path;
  const title = basename.replace(/\.md$/iu, "").replace(/[-_]+/gu, " ").trim();
  return [...title].slice(0, 120).join("") || "导入资料";
}

function uniqueById(values: unknown[], label: string): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  for (const item of values) {
    const row = record(item), id = text(row.id, `${label} ID`, 160);
    if (result.has(id)) throw new Error(`DeepWrite ${label}存在重复 ID。`);
    result.set(id, row);
  }
  return result;
}

function collectLongSupportingMaterials(index: Record<string, unknown>, files: Map<string, string>, ignoredPaths: Set<string>): DeepWriteCatalogEntryInput[] {
  const refs = new Map<string, string>();
  const visit = (value: unknown, depth: number): void => {
    if (depth > 32 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) { for (const child of value) visit(child, depth + 1); return; }
    const row = value as Record<string, unknown>;
    if (typeof row.path === "string" && row.path.endsWith(".md")) {
      const path = assertSafeRelativePath(row.path);
      if (!ignoredPaths.has(path) && files.has(path)) refs.set(path, typeof row.id === "string" ? row.id : filenameTitle(path));
    }
    for (const [key, child] of Object.entries(row)) if (key !== "path") visit(child, depth + 1);
  };
  visit(index, 0);
  const materials: DeepWriteCatalogEntryInput[] = [];
  for (const [path, referenceId] of refs) {
    if (path.startsWith("long/chapters/") || path.startsWith("long/continuity/") || path.startsWith("long/ledger/")) continue;
    const content = files.get(path)!;
    if (!content) continue;
    if (content.length > 1_500_000) throw new Error(`DeepWrite 附属资料超过 LFAA 单条资料 1,500,000 字符限制：${path}`);
    materials.push({ kind: "material", title: filenameTitle(path) || referenceId, content });
  }
  return materials;
}

function parseLfaaExtension(files: Map<string, string>, allowedCatalogKinds: readonly string[]): Pick<DeepWriteImportProject, "aiRoleId" | "skills" | "catalog"> {
  let aiRoleId: WritingSpecialistId = "writing-companion";
  let skills: DeepWriteSkillInput[] = [];
  let catalog: DeepWriteCatalogEntryInput[] = [];
  const metadataSource = files.get("lfaa/metadata.json");
  if (metadataSource !== undefined) {
    if (Buffer.byteLength(metadataSource, "utf8") > MAX_JSON_BYTES) throw new Error("LFAA 导出元数据超过 4 MiB。");
    let metadata: Record<string, unknown>;
    try { metadata = record(JSON.parse(metadataSource) as unknown); } catch { throw new Error("LFAA 导出元数据 JSON 无法解析。"); }
    if (metadata.schemaVersion !== 1) throw new Error("LFAA 导出元数据版本不受支持。");
    const candidate = metadata.aiRoleId;
    if (candidate !== undefined) {
      if (typeof candidate !== "string" || !getWritingSpecialist(candidate)) throw new Error("LFAA 导出包含无效的专职角色 ID。");
      aiRoleId = candidate as WritingSpecialistId;
    }
    const rawSkills = metadata.skills === undefined ? [] : metadata.skills;
    if (!Array.isArray(rawSkills) || rawSkills.length > 40) throw new Error("LFAA 导出作品 Skill 数量超出限制。");
    const titles = new Set<string>();
    skills = rawSkills.map((value) => {
      const skill = record(value);
      const title = text(skill.title, "Skill 标题", 120).trim();
      const description = text(skill.description ?? "", "Skill 说明", 300).trim();
      const instructions = text(skill.instructions, "Skill 正文", 12_000);
      if (!title || !instructions.trim() || titles.has(title.toLocaleLowerCase("zh-CN"))) throw new Error("LFAA 导出的 Skill 标题为空或重复，或正文为空。");
      titles.add(title.toLocaleLowerCase("zh-CN"));
      return { title, description, instructions, enabled: skill.enabled === undefined ? true : skill.enabled === true || skill.enabled === 1 };
    });
  }
  const catalogIndexSource = files.get("lfaa/catalog/index.json");
  if (catalogIndexSource !== undefined) {
    if (Buffer.byteLength(catalogIndexSource, "utf8") > MAX_JSON_BYTES) throw new Error("LFAA 导出资料目录索引超过 4 MiB。");
    let index: Record<string, unknown>;
    try { index = record(JSON.parse(catalogIndexSource) as unknown); } catch { throw new Error("LFAA 导出资料目录索引无法解析。"); }
    if (index.schemaVersion !== 1 || !Array.isArray(index.entries) || index.entries.length > 4_900) throw new Error("LFAA 导出资料目录索引版本或条目数量无效。");
    const ids = new Set<string>();
    catalog = index.entries.map((value) => {
      const entry = record(value);
      const id = text(entry.id, "资料 ID", 160), kind = text(entry.kind, "资料类型", 80) as WritingCatalogKind;
      const title = text(entry.title, "资料标题", 120).trim();
      if (ids.has(id) || !allowedCatalogKinds.includes(kind) || !title) throw new Error("LFAA 导出资料目录包含重复 ID 或无效类型/标题。");
      ids.add(id);
      const content = projectText(files, entry.path, "资料正文");
      if (content.length > 1_500_000) throw new Error("LFAA 导出资料正文超过当前作品资料长度上限。");
      return { kind, title, content };
    });
  }
  return { aiRoleId, skills, catalog };
}

/** 将 DeepWrite 长篇或 schema 1–4 短篇/剧本清单解析为不带账户 ID 的新作品 DTO。 */
export function parseDeepWriteProject(files: Map<string, string>, allowedCatalogKinds: readonly string[]): DeepWriteImportProject {
  const manifest = parseJson(files, "deepwrite.json");
  const title = text(manifest.title, "作品标题", 256).trim();
  if (!title || title.length > 80) throw new Error("作品标题超过 LFAA 的 80 字符上限。");
  const extension = parseLfaaExtension(files, allowedCatalogKinds);
  if (manifest.kind === "deepwrite.long-book") {
    if (manifest.schemaVersion !== 1 || manifest.bookType !== "long") throw new Error("DeepWrite 长篇 manifest 版本或作品类型不受支持。");
    const manifestId = text(manifest.id, "作品 ID", 160);
    const ref = record(manifest.workspaceIndexFile);
    if (ref.id !== "file_long-workspace-index" || ref.path !== "long/index.json") throw new Error("DeepWrite 长篇索引引用不符合公开文件合同。");
    const index = parseJson(files, "long/index.json");
    if (index.schemaVersion !== 1 || index.bookId !== manifestId) throw new Error("DeepWrite 长篇索引版本或作品 ID 不匹配。");
    validateIndexedFileReferences(index, files);
    const bookLine = record(index.bookLine);
    if (bookLine.id !== "file_long-book-line") throw new Error("DeepWrite 全书故事线引用无效。");
    const outline = projectText(files, bookLine.path, "全书故事线");
    const plot = record(index.plot);
    if (!Array.isArray(plot.volumes) || !Array.isArray(plot.arcs) || !Array.isArray(plot.chapterCards) || !Array.isArray(index.chapters)) throw new Error("DeepWrite 长篇卷、剧情弧线或章节目录无效。");
    if (plot.volumes.length > 4_900 || plot.chapterCards.length > 4_900 || index.chapters.length > 4_900) throw new Error("DeepWrite 长篇内容数量超过导入限制。");
    const volumesById = uniqueById(plot.volumes, "卷"), arcsById = uniqueById(plot.arcs, "剧情弧线"), cardsById = uniqueById(plot.chapterCards, "章节");
    const chapterFilesById = new Map<string, Record<string, unknown>>();
    for (const value of index.chapters) {
      const row = record(value), chapterId = text(row.chapterCardId, "章节文件 ID", 160);
      if (chapterFilesById.has(chapterId)) throw new Error("DeepWrite 章节文件索引存在重复章节 ID。");
      chapterFilesById.set(chapterId, row);
    }
    if (cardsById.size !== chapterFilesById.size) throw new Error("DeepWrite 长篇章节卡与章节文件索引数量不匹配。");
    const volumeRows: DeepWriteImportVolume[] = [...volumesById].map(([id, row]) => {
      if (!Number.isSafeInteger(row.order) || Number(row.order) < 1) throw new Error("DeepWrite 卷顺序无效。");
      return { externalId: id, title: text(row.title, "卷标题", 256).trim(), order: Number(row.order) - 1 };
    });
    volumeRows.sort((left, right) => left.order - right.order || left.externalId.localeCompare(right.externalId));
    if (volumeRows.some((volume, order) => volume.order !== order)) throw new Error("DeepWrite 卷顺序必须从 1 连续递增。");
    if (!volumeRows.length && cardsById.size) throw new Error("DeepWrite 长篇有章节但没有所属卷。");
    const volumeIds = new Set(volumesById.keys());
    const volumeOrder = new Map(volumeRows.map((volume, order) => [volume.externalId, order]));
    const arcOrdersByVolume = new Map<string, number[]>();
    for (const arc of arcsById.values()) {
      const volumeId = text(arc.volumeId, "剧情弧线卷 ID", 160), order = arc.order;
      if (!volumeIds.has(volumeId) || !Number.isSafeInteger(order) || Number(order) < 1) throw new Error("DeepWrite 剧情弧线卷归属或顺序无效。");
      const orders = arcOrdersByVolume.get(volumeId) ?? [];
      orders.push(Number(order));
      arcOrdersByVolume.set(volumeId, orders);
    }
    for (const orders of arcOrdersByVolume.values()) if ([...orders].sort((left, right) => left - right).some((order, index) => order !== index + 1)) throw new Error("DeepWrite 每卷剧情弧线顺序必须连续且唯一。");
    const chapters: DeepWriteImportChapter[] = [];
    const chapterOrdersByVolume = new Map<string, number[]>();
    const ignoredPaths = new Set<string>([text(bookLine.path, "故事线路径", 2_048)]);
    for (const [id, card] of cardsById) {
      const volumeId = text(card.volumeId, "章节卷 ID", 160);
      if (!volumeIds.has(volumeId)) throw new Error("DeepWrite 章节引用不存在的卷。");
      if (card.primaryArcId !== null && card.primaryArcId !== undefined) {
        const arc = arcsById.get(text(card.primaryArcId, "章节剧情弧线 ID", 160));
        if (!arc || arc.volumeId !== volumeId) throw new Error("DeepWrite 章节引用不存在或跨卷的剧情弧线。");
      }
      const chapterFiles = chapterFilesById.get(id)!;
      if (chapterFiles.chapterCardId !== id) throw new Error("DeepWrite 章节文件索引 ID 不匹配。");
      const body = record(chapterFiles.body);
      const content = projectText(files, body.path, "章节正文");
      ignoredPaths.add(text(body.path, "章节正文路径", 2_048));
      if (!Number.isSafeInteger(card.narrativeOrder) || Number(card.narrativeOrder) < 1) throw new Error("DeepWrite 章节叙事顺序无效。");
      const narrativeOrder = Number(card.narrativeOrder);
      const chapterOrders = chapterOrdersByVolume.get(volumeId) ?? [];
      chapterOrders.push(narrativeOrder);
      chapterOrdersByVolume.set(volumeId, chapterOrders);
      chapters.push({ externalId: id, volumeExternalId: volumeId, title: text(card.title, "章节标题", 256).trim(), order: volumeOrder.get(volumeId)! * 100_000 + narrativeOrder - 1, content });
    }
    for (const orders of chapterOrdersByVolume.values()) if ([...orders].sort((left, right) => left - right).some((order, index) => order !== index + 1)) throw new Error("DeepWrite 每卷章节叙事顺序必须连续且唯一。");
    chapters.sort((left, right) => left.order - right.order || left.externalId.localeCompare(right.externalId));
    const supporting = collectLongSupportingMaterials(index, files, ignoredPaths);
    return { title, outline, volumes: volumeRows, chapters, materials: supporting, ...extension };
  }
  if (manifest.kind !== "deepwrite.book" || manifest.schemaVersion !== 1 && manifest.schemaVersion !== 2 && manifest.schemaVersion !== 3 && manifest.schemaVersion !== 4 || (manifest.bookType !== "short" && manifest.bookType !== "script")) throw new Error("ZIP 不是受支持的 DeepWrite 长篇、短篇或剧本项目。");

  const volumes: DeepWriteImportVolume[] = [{ externalId: "deepwrite-volume-1", title: "第一卷", order: 0 }];
  const chapters: DeepWriteImportChapter[] = [];
  const materials: DeepWriteCatalogEntryInput[] = [];
  const sectionBodies = new Set<string>();
  const draft = manifest.draft;
  const referencedIds = new Set<string>();
  const referencedPaths = new Set<string>();
  const validateMarkdownRef = (value: unknown, label: string): Record<string, unknown> => {
    const reference = record(value);
    const id = text(reference.id, `${label} ID`, 160);
    const path = assertSafeRelativePath(text(reference.path, `${label}路径`, 2_048));
    if (!id.trim() || referencedIds.has(id) || referencedPaths.has(path)) throw new Error(`DeepWrite ${label}引用含重复 ID 或路径。`);
    if (!path.endsWith(".md") || !files.has(path)) throw new Error(`DeepWrite ${label} Markdown 文件缺失：${path}`);
    referencedIds.add(id);
    referencedPaths.add(path);
    return reference;
  };
  if (draft !== undefined) {
    const directory = record(draft);
    if (!Array.isArray(directory.sections) || directory.sections.length > 100) throw new Error("DeepWrite 草稿章节目录无效或超出 100 节限制。");
    const sectionIds = new Set<string>();
    for (const [order, value] of directory.sections.entries()) {
      const section = record(value), sectionId = text(section.id, "草稿章节 ID", 160), body = validateMarkdownRef(section.body, "草稿正文"), characterState = validateMarkdownRef(section.characterState, "人物状态");
      if (sectionIds.has(sectionId)) throw new Error("DeepWrite 草稿章节存在重复 ID。");
      sectionIds.add(sectionId);
      const bodyPath = text(body.path, "草稿正文路径", 2_048);
      const content = projectText(files, bodyPath, "草稿正文");
      sectionBodies.add(bodyPath);
      const titleValue = text(section.title, "草稿章节标题", 256).trim();
      chapters.push({ externalId: text(section.id, "草稿章节 ID", 160), volumeExternalId: volumes[0]!.externalId, title: titleValue, order, content });
      const statePath = text(characterState.path, "人物状态路径", 2_048);
      const stateContent = files.get(assertSafeRelativePath(statePath));
      if (stateContent !== undefined && stateContent.trim()) materials.push({ kind: "material", title: `${titleValue} · 人物状态`, content: stateContent.slice(0, 1_500_000) });
      sectionBodies.add(statePath);
    }
  }
  if (Array.isArray(manifest.documents)) {
    const documents = uniqueById(manifest.documents, "文档");
    for (const document of documents.values()) {
      const reference = validateMarkdownRef(document, "附属文档");
      const path = text(reference.path, "文档路径", 2_048);
      if (sectionBodies.has(path)) continue;
      const content = projectText(files, path, "附属文档");
      if (content.length > 1_500_000) throw new Error(`DeepWrite 附属文档超过 LFAA 单条资料长度上限：${path}`);
      materials.push({ kind: "material", title: text(document.title, "文档标题", 256).trim() || filenameTitle(path), content });
    }
  }
  if (!chapters.length) {
    chapters.push({ externalId: "deepwrite-empty-draft", volumeExternalId: volumes[0]!.externalId, title: "第1章", order: 0, content: "" });
  }
  return { title, outline: "", volumes, chapters, materials, ...extension };
}

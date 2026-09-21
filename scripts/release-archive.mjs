/**
 * 文件：release-archive.mjs
 * 作用：生成 LFAA 发布 ZIP，并显式保证 Unicode 文件名使用 ZIP UTF-8 flag。
 * 负责：收集发布文件、写 Local/Central Directory、UTF-8 bit 11、CRC32、成品 entry 校验。
 * 不负责：版本递增、依赖安装或稳定工作区同步；CLI 只在归档前复用 workspace-preflight 拒绝无效候选。
 * 状态归属：发布归档字节格式由本脚本唯一拥有；lfaa.release.json 仍是版本事实源。
 * 修改注意事项：禁止退回依赖平台默认编码的 zip 命令；中文 entry 必须在 Local Header 与 Central Directory 同时设置 bit 11。
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const UTF8_FLAG = 0x0800;
const METHOD_STORE = 0;
const VERSION_NEEDED = 20;
const VERSION_MADE_BY_UNIX = (3 << 8) | VERSION_NEEDED;
const EXCLUDED_DIR_NAMES = new Set([".git", ".test-runtime-home", "node_modules", "dist", "target"]);
const REQUIRED_UNICODE_ENTRY = "docs/项目结构与代码地图.md";

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date) {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    time: (hours << 11) | (minutes << 5) | seconds,
    date: ((year - 1980) << 9) | (month << 5) | day,
  };
}

function normalizeArchivePath(relativePath, directory = false) {
  const normalized = relativePath.split(path.sep).join("/").replace(/^\.\//u, "");
  return directory && normalized && !normalized.endsWith("/") ? `${normalized}/` : normalized;
}

function shouldExclude(relativePath, outputRelative) {
  const normalized = normalizeArchivePath(relativePath);
  if (!normalized) return false;
  if (outputRelative && normalized === outputRelative) return true;
  // Runtime/developer logs are local machine artifacts. .gitignore already excludes
  // them; release archives must do the same even when the source directory contains
  // historical or untracked log files. Empty log directories are still preserved.
  if (normalized.toLocaleLowerCase().endsWith(".log")) return true;
  return normalized.split("/").some((segment) => EXCLUDED_DIR_NAMES.has(segment));
}

export function collectReleaseEntries(root, outputPath) {
  const rootAbs = path.resolve(root);
  const outputAbs = outputPath ? path.resolve(outputPath) : null;
  const outputRelative = outputAbs && outputAbs.startsWith(`${rootAbs}${path.sep}`)
    ? normalizeArchivePath(path.relative(rootAbs, outputAbs))
    : null;
  const entries = [];

  const walk = (absoluteDir, relativeDir = "") => {
    const children = fs.readdirSync(absoluteDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const child of children) {
      const relative = relativeDir ? path.join(relativeDir, child.name) : child.name;
      if (shouldExclude(relative, outputRelative)) continue;
      const absolute = path.join(absoluteDir, child.name);
      if (child.isDirectory()) {
        // 显式写目录 entry，保证空日志目录等必要空目录在 Windows 解压后仍存在。
        const stat = fs.statSync(absolute);
        entries.push({ name: normalizeArchivePath(relative, true), data: Buffer.alloc(0), mtime: stat.mtime, directory: true });
        walk(absolute, relative);
      } else if (child.isFile()) {
        const stat = fs.statSync(absolute);
        entries.push({ name: normalizeArchivePath(relative), data: fs.readFileSync(absolute), mtime: stat.mtime, directory: false });
      }
    }
  };

  walk(rootAbs);
  return entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
}

function makeLocalHeader(entry, crc, offset) {
  const name = Buffer.from(entry.name, "utf8");
  const { time, date } = toDosDateTime(entry.mtime);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(VERSION_NEEDED, 4);
  header.writeUInt16LE(UTF8_FLAG, 6);
  header.writeUInt16LE(METHOD_STORE, 8);
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(date, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(entry.data.length, 18);
  header.writeUInt32LE(entry.data.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return { bytes: Buffer.concat([header, name, entry.data]), name, time, date, offset };
}

function makeCentralHeader(entry, local, crc) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(VERSION_MADE_BY_UNIX, 4);
  header.writeUInt16LE(VERSION_NEEDED, 6);
  header.writeUInt16LE(UTF8_FLAG, 8);
  header.writeUInt16LE(METHOD_STORE, 10);
  header.writeUInt16LE(local.time, 12);
  header.writeUInt16LE(local.date, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(entry.data.length, 20);
  header.writeUInt32LE(entry.data.length, 24);
  header.writeUInt16LE(local.name.length, 28);
  header.writeUInt16LE(0, 30); // extra length
  header.writeUInt16LE(0, 32); // comment length
  header.writeUInt16LE(0, 34); // disk start
  header.writeUInt16LE(0, 36); // internal attrs
  const mode = entry.directory ? 0o40755 : 0o100644;
  const dosDirectoryFlag = entry.directory ? 0x10 : 0;
  header.writeUInt32LE(((mode << 16) | dosDirectoryFlag) >>> 0, 38);
  header.writeUInt32LE(local.offset, 42);
  return Buffer.concat([header, local.name]);
}

export function buildZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const crc = entry.directory ? 0 : crc32(entry.data);
    const local = makeLocalHeader(entry, crc, offset);
    localParts.push(local.bytes);
    centralParts.push(makeCentralHeader(entry, local, crc));
    offset += local.bytes.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, central, end]);
}

function findEndOfCentralDirectory(buffer) {
  const min = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("ZIP 缺少 End of Central Directory。");
}

export function readCentralDirectoryEntries(zipPath) {
  const buffer = fs.readFileSync(zipPath);
  const endOffset = findEndOfCentralDirectory(buffer);
  const count = buffer.readUInt16LE(endOffset + 10);
  let cursor = buffer.readUInt32LE(endOffset + 16);
  const entries = [];

  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error(`ZIP Central Directory entry #${index + 1} 损坏。`);
    const flags = buffer.readUInt16LE(cursor + 8);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const nameBytes = buffer.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = (flags & UTF8_FLAG) !== 0 ? nameBytes.toString("utf8") : nameBytes.toString("latin1");
    entries.push({ name, flags, utf8: (flags & UTF8_FLAG) !== 0 });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function assertReleaseArchive(zipPath) {
  const entries = readCentralDirectoryEntries(zipPath);
  const unicode = entries.find((entry) => entry.name === REQUIRED_UNICODE_ENTRY);
  if (!unicode) throw new Error(`发布 ZIP 缺少 exact Unicode entry: ${REQUIRED_UNICODE_ENTRY}`);
  if (!unicode.utf8) throw new Error(`发布 ZIP 的 ${REQUIRED_UNICODE_ENTRY} 未设置 UTF-8 filename flag。`);
  for (const entry of entries) {
    if (/[�]|(?:Θí╣|τ¢«|τ╗ô|µ₧ä|Σ╕Ä|σ£░|σ¢╛)/u.test(entry.name)) {
      throw new Error(`发布 ZIP 检测到疑似乱码路径: ${entry.name}`);
    }
  }
  return entries;
}

export function assertReleaseCandidateMetadata(root = process.cwd()) {
  const rootAbs = path.resolve(root);
  const releasePath = path.join(rootAbs, "lfaa.release.json");
  const promptPath = path.join(rootAbs, "docs", "PROMPTS.md");
  if (!fs.existsSync(releasePath)) throw new Error(`不是 LFAA 工作区: ${rootAbs}`);
  if (!fs.existsSync(promptPath)) throw new Error("候选包缺少 docs/PROMPTS.md。");

  const release = JSON.parse(fs.readFileSync(releasePath, "utf8"));
  const version = String(release.displayVersion ?? "").trim();
  const prompt = fs.readFileSync(promptPath, "utf8");
  if (!version) throw new Error("lfaa.release.json 缺少 displayVersion。");
  if (!prompt.includes(`# v${version} Prompt / Requirement Note`)) {
    throw new Error(`docs/PROMPTS.md 缺少当前版本 v${version} 的 Prompt 条目。`);
  }
  const escapedVersion = version.replaceAll(".", "\\.");
  const taskIndex = new RegExp(`\\|\\s*#\\d+(?:\\.\\d+)?\\s*\\|[^\\n]*\\|\\s*v${escapedVersion}\\s*\\|`);
  if (!taskIndex.test(prompt)) {
    throw new Error(`docs/PROMPTS.md 当前任务索引缺少 v${version}。`);
  }
  return { version };
}

export function createReleaseArchive({ root = process.cwd(), output }) {
  if (!output) throw new Error("必须提供 --output <zip-path>。");
  const rootAbs = path.resolve(root);
  const outputAbs = path.resolve(output);
  assertReleaseCandidateMetadata(rootAbs);
  fs.mkdirSync(path.dirname(outputAbs), { recursive: true });
  const entries = collectReleaseEntries(rootAbs, outputAbs);
  fs.writeFileSync(outputAbs, buildZipBuffer(entries));
  const verified = assertReleaseArchive(outputAbs);
  return { output: outputAbs, entries: verified.length, bytes: fs.statSync(outputAbs).size };
}

function parseArgs(argv) {
  let root = process.cwd();
  let output = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") root = argv[++index];
    else if (argv[index] === "--output") output = argv[++index];
  }
  return { root, output };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const rootAbs = path.resolve(options.root);
    const preflightScript = path.join(rootAbs, "scripts", "workspace-preflight.mjs");
    if (!fs.existsSync(preflightScript)) throw new Error("候选工作区缺少 scripts/workspace-preflight.mjs。");
    const preflight = spawnSync(process.execPath, [preflightScript, "--root", rootAbs], {
      cwd: rootAbs,
      encoding: "utf8",
      env: process.env,
      windowsHide: true,
    });
    if (preflight.stdout) process.stdout.write(preflight.stdout);
    if (preflight.status !== 0) {
      if (preflight.stderr) process.stderr.write(preflight.stderr);
      throw new Error("workspace preflight 未通过，拒绝生成发布 ZIP。");
    }
    const result = createReleaseArchive(options);
    console.log(`[LFAA-ARCHIVE] output=${result.output}`);
    console.log(`[LFAA-ARCHIVE] entries=${result.entries}`);
    console.log(`[LFAA-ARCHIVE] bytes=${result.bytes}`);
    console.log(`[LFAA-ARCHIVE] unicode=${REQUIRED_UNICODE_ENTRY} utf8-flag=pass`);
  } catch (error) {
    console.error(`[LFAA-ARCHIVE][FAIL] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

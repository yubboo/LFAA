/**
 * 功能：持久化 Writing 作品正文到账户隔离的本地 Markdown 文件。
 * 作用：数据库只保留关系/元数据；原子写入并在迁移校验后清空旧正文。
 * 关联文件：service.ts、storage-sqlite/src/database.ts、util/home-paths。
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { relative, resolve } from "node:path";
import { atomicWrite, atomicWriteBytes } from "lfaa-storage-json/src/index.js";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { protectPrivateDirectory } from "lfaa-home-paths/src/private-directory.mjs";
import { resolveUserDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import { getProjectStorageDirectoryCandidates } from "lfaa-settings/src/project-storage.js";
import { countWritingWords } from "./content-utils.js";

export type WritingLocalContentRef =
  | { kind: "outline" }
  | { kind: "chapter" | "catalog" | "skill" | "outline-revision"; id: string }
  | { kind: "chapter-revision"; chapterId: string; id: string };

export const WRITING_LOCAL_FILE_MARKER = "lfaa-local-file-v1";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(value: string, label: string): void {
  if (!uuidPattern.test(value)) throw new Error(`${label}标识无效，拒绝访问作品文件。`);
}

function projectLocation(userId: string, bookId: string): { baseDirectory: string; directory: string } {
  assertUuid(bookId, "作品");
  const candidates = getProjectStorageDirectoryCandidates("writing");
  const locations = candidates.map(baseDirectory => {
    const projects = resolveUserDataPaths(baseDirectory, userId).projects;
    const writingRoot = resolve(projects, "writing");
    const directory = resolve(writingRoot, bookId);
    const relativeDirectory = relative(baseDirectory, directory);
    if (!relativeDirectory || relativeDirectory.startsWith("..") || resolve(baseDirectory, relativeDirectory) !== directory) throw new Error("作品文件目录越界，拒绝访问。");
    return { baseDirectory: resolve(baseDirectory), directory };
  });
  const existing = locations.filter(location => existsSync(location.directory));
  if (existing.length > 1) throw new Error("Writing 作品在多个存储位置重复存在；请先核对文件，拒绝选择性覆盖。");
  if (existing.length === 1) return existing[0]!;
  const legacyExists = database.prepare("SELECT 1 FROM writing_books WHERE id = ? AND user_id = ?").get(bookId, userId);
  const localMigrationExists = database.prepare("SELECT 1 FROM writing_local_file_migrations WHERE book_id = ?").get(bookId);
  if (legacyExists && localMigrationExists) throw new Error("Writing 作品目录缺失；原作品文件未迁移，拒绝创建空目录覆盖。");
  const active = locations[0];
  if (!active) throw new Error("Writing 存储位置未配置。");
  return active;
}

function projectDirectory(userId: string, bookId: string): string {
  return projectLocation(userId, bookId).directory;
}

function ensureActualDirectory(path: string): void {
  try { mkdirSync(path, { mode: 0o700 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  const info = lstatSync(path);
  const actual = realpathSync(path);
  const samePath = process.platform === "win32" ? actual.toLocaleLowerCase("en-US") === path.toLocaleLowerCase("en-US") : actual === path;
  if (!info.isDirectory() || info.isSymbolicLink() || !samePath) throw new Error("Writing 作品目录必须是本机实际目录，拒绝符号链接或联接重定向。");
}

function ensureProjectDirectory(userId: string, bookId: string): string {
  const { baseDirectory, directory } = projectLocation(userId, bookId);
  const userPaths = resolveUserDataPaths(baseDirectory, userId);
  const chain = [baseDirectory, resolve(baseDirectory, "users"), userPaths.root, userPaths.projects, resolve(userPaths.projects, "writing"), directory];
  for (const path of chain) ensureActualDirectory(path);
  protectPrivateDirectory(directory);
  ensureActualDirectory(directory);
  return directory;
}

/* Existing Writing content follows the directory where its project folder already exists.
 * New projects use the currently selected storage root, keeping old work readable after a change. */

const manifestFor = (bookId: string) => ({
  format: "lfaa-writing-project",
  formatVersion: 1,
  bookId,
  contentFiles: {
    outline: "outline.md",
    chapter: "chapters/<chapter-uuid>.md",
    catalogEntry: "catalog/<entry-uuid>.md",
    skill: "skills/<skill-uuid>.md",
    outlineRevision: "revisions/outline/<revision-uuid>.md",
    chapterRevision: "revisions/chapters/<chapter-uuid>/<revision-uuid>.md"
  }
});

export function ensureWritingProjectFiles(userId: string, bookId: string): string {
  const directory = ensureProjectDirectory(userId, bookId);
  const manifestPath = resolve(directory, "project.json");
  if (existsSync(manifestPath)) {
    const manifestInfo = lstatSync(manifestPath);
    if (!manifestInfo.isFile() || manifestInfo.isSymbolicLink() || manifestInfo.nlink !== 1) throw new Error("Writing 作品清单必须是独立普通文件，拒绝访问重定向内容。");
    let existing: unknown;
    try { existing = JSON.parse(readFileSync(manifestPath, "utf8")); }
    catch { throw new Error("Writing 作品清单损坏，拒绝覆盖本地作品文件。"); }
    const expected = manifestFor(bookId);
    if (JSON.stringify(existing) !== JSON.stringify(expected)) throw new Error("Writing 作品清单与当前格式不匹配，拒绝覆盖本地作品文件。");
    return directory;
  }
  atomicWrite(manifestPath, manifestFor(bookId));
  return directory;
}

function contentPath(directory: string, ref: WritingLocalContentRef): string {
  let segments: string[];
  if (ref.kind === "outline") segments = ["outline.md"];
  if (ref.kind === "chapter-revision") {
    assertUuid(ref.chapterId, "章节");
    assertUuid(ref.id, "修订");
    segments = ["revisions", "chapters", ref.chapterId, `${ref.id}.md`];
  } else if (ref.kind !== "outline") {
    assertUuid(ref.id, ref.kind === "chapter" ? "章节" : ref.kind === "catalog" ? "资料" : ref.kind === "skill" ? "Skill" : "修订");
    switch (ref.kind) {
      case "chapter": segments = ["chapters", `${ref.id}.md`]; break;
      case "catalog": segments = ["catalog", `${ref.id}.md`]; break;
      case "skill": segments = ["skills", `${ref.id}.md`]; break;
      case "outline-revision": segments = ["revisions", "outline", `${ref.id}.md`]; break;
    }
  }
  if (!segments!) throw new Error("Writing 本地文件类型无效。");
  const target = resolve(directory, ...segments!);
  const parentSegments = segments!.slice(0, -1);
  let parent = directory;
  for (const segment of parentSegments) {
    parent = resolve(parent, segment);
    const pathWithinProject = relative(directory, parent);
    if (!pathWithinProject || pathWithinProject.startsWith("..") || resolve(directory, pathWithinProject) !== parent) throw new Error("Writing 文件目录越界，拒绝访问。");
    try { mkdirSync(parent, { mode: 0o700 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    const info = lstatSync(parent);
    const actual = realpathSync(parent);
    const samePath = process.platform === "win32" ? actual.toLocaleLowerCase("en-US") === parent.toLocaleLowerCase("en-US") : actual === parent;
    if (!info.isDirectory() || info.isSymbolicLink() || !samePath) throw new Error("Writing 文件目录不能是符号链接或重定向目录。");
  }
  return target;
}

export function writeWritingLocalText(userId: string, bookId: string, ref: WritingLocalContentRef, content: string): void {
  if (typeof content !== "string") throw new Error("Writing 正文必须是文本。");
  const directory = ensureWritingProjectFiles(userId, bookId);
  const path = contentPath(directory, ref);
  if (existsSync(path)) {
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error("Writing 正文路径必须是独立普通文件，拒绝覆盖重定向内容。");
  }
  atomicWriteBytes(path, Buffer.from(content, "utf8"));
}

export function readWritingLocalText(userId: string, bookId: string, ref: WritingLocalContentRef): string {
  const directory = ensureWritingProjectFiles(userId, bookId);
  try {
    const path = contentPath(directory, ref);
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error("invalid-file-kind");
    const bytes = readFileSync(path);
    const content = bytes.toString("utf8");
    if (!Buffer.from(content, "utf8").equals(bytes)) throw new Error("invalid-utf8");
    return content;
  } catch {
    throw new Error("Writing 本地作品文件缺失或损坏，拒绝回退到 SQLite 旧正文。");
  }
}

export function removeWritingLocalText(userId: string, bookId: string, ref: WritingLocalContentRef): void {
  const path = contentPath(ensureWritingProjectFiles(userId, bookId), ref);
  try { rmSync(path, { force: true }); }
  catch { throw new Error("无法移除已删除 Writing 内容对应的本地文件。"); }
}

export function removeWritingProjectFiles(userId: string, bookId: string): void {
  const directory = projectDirectory(userId, bookId);
  if (!existsSync(directory)) return;
  protectPrivateDirectory(directory);
  try { rmSync(directory, { recursive: true, force: true }); }
  catch { throw new Error("作品已从目录移除，但本地作品文件清理失败。"); }
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function saveAndVerify(userId: string, bookId: string, ref: WritingLocalContentRef, content: string): void {
  writeWritingLocalText(userId, bookId, ref, content);
  const readBack = readWritingLocalText(userId, bookId, ref);
  if (sha256(readBack) !== sha256(content)) throw new Error("Writing 本地作品文件回读校验失败，旧数据库正文仍会保留。");
}

function migrateRows<T extends { id: string; content: string }>(
  userId: string,
  bookId: string,
  query: (cursor: string) => T[],
  refFor: (row: T) => WritingLocalContentRef,
  onVerified?: (row: T) => void
): number {
  let cursor = "";
  let count = 0;
  while (true) {
    const rows = query(cursor);
    if (!rows.length) return count;
    for (const row of rows) {
      saveAndVerify(userId, bookId, refFor(row), row.content);
      onVerified?.(row);
      cursor = row.id;
      count += 1;
    }
  }
}

/** Idempotent per-book migration. SQLite content is cleared only after every file has been read back and verified. */
export function migrateWritingContentToLocalFiles(): void {
  const table = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'writing_local_file_migrations'").get();
  if (!table) throw new Error("Writing 本地文件迁移结构未初始化；拒绝启动写作服务。");
  let cursor = "";
  const readBatch = <T extends { id: string; content: string }>(sql: string, bookId: string) => (cursor: string): T[] =>
    database.prepare(sql).all(bookId, cursor, 10) as unknown as T[];
  while (true) {
    const books = database.prepare(`
      SELECT b.id, b.user_id FROM writing_books b
      LEFT JOIN writing_local_file_migrations m ON m.book_id = b.id AND m.format_version = 1
      WHERE m.book_id IS NULL AND b.id > ? ORDER BY b.id LIMIT 50
    `).all(cursor) as Array<{ id: string; user_id: string }>;
    if (!books.length) return;
    for (const book of books) {
      cursor = book.id;
      const outline = database.prepare("SELECT outline_content FROM writing_books WHERE id = ? AND user_id = ?").get(book.id, book.user_id) as { outline_content: string } | undefined;
      if (!outline) throw new Error("Writing 作品在迁移期间已变化，数据库正文未清空。");
      ensureWritingProjectFiles(book.user_id, book.id);
      saveAndVerify(book.user_id, book.id, { kind: "outline" }, outline.outline_content);
      const chapterCount = migrateRows(book.user_id, book.id,
      readBatch<{ id: string; content: string }>("SELECT id, content FROM writing_chapters WHERE book_id = ? AND id > ? ORDER BY id LIMIT ?", book.id),
      (row) => ({ kind: "chapter", id: row.id }),
      (row) => database.prepare("UPDATE writing_chapters SET word_count = ? WHERE id = ?").run(countWritingWords(row.content), row.id));
      const catalogCount = migrateRows(book.user_id, book.id,
      readBatch<{ id: string; content: string }>("SELECT id, content FROM writing_catalog_entries WHERE book_id = ? AND id > ? ORDER BY id LIMIT ?", book.id),
      (row) => ({ kind: "catalog", id: row.id }));
      const skillCount = migrateRows(book.user_id, book.id,
      readBatch<{ id: string; content: string }>("SELECT id, instructions AS content FROM writing_book_skills WHERE book_id = ? AND id > ? ORDER BY id LIMIT ?", book.id),
      (row) => ({ kind: "skill", id: row.id }));
      const outlineRevisionCount = migrateRows(book.user_id, book.id,
      readBatch<{ id: string; content: string }>("SELECT id, content FROM writing_book_outline_revisions WHERE book_id = ? AND id > ? ORDER BY id LIMIT ?", book.id),
      (row) => ({ kind: "outline-revision", id: row.id }),
      (row) => database.prepare("UPDATE writing_book_outline_revisions SET word_count = ? WHERE id = ?").run(countWritingWords(row.content), row.id));
      const chapterRevisionCount = migrateRows(book.user_id, book.id,
      readBatch<{ id: string; chapter_id: string; content: string }>("SELECT r.id, r.chapter_id, r.content FROM writing_chapter_revisions r JOIN writing_chapters c ON c.id = r.chapter_id WHERE c.book_id = ? AND r.id > ? ORDER BY r.id LIMIT ?", book.id),
      (row) => {
        return { kind: "chapter-revision", chapterId: row.chapter_id, id: row.id };
      },
      (row) => database.prepare("UPDATE writing_chapter_revisions SET word_count = ? WHERE id = ?").run(countWritingWords(row.content), row.id));
      const expectedCounts = {
      chapters: (database.prepare("SELECT COUNT(*) AS count FROM writing_chapters WHERE book_id = ?").get(book.id) as { count: number }).count,
      catalog: (database.prepare("SELECT COUNT(*) AS count FROM writing_catalog_entries WHERE book_id = ?").get(book.id) as { count: number }).count,
      skills: (database.prepare("SELECT COUNT(*) AS count FROM writing_book_skills WHERE book_id = ?").get(book.id) as { count: number }).count,
      outlineRevisions: (database.prepare("SELECT COUNT(*) AS count FROM writing_book_outline_revisions WHERE book_id = ?").get(book.id) as { count: number }).count,
      chapterRevisions: (database.prepare("SELECT COUNT(*) AS count FROM writing_chapter_revisions r JOIN writing_chapters c ON c.id = r.chapter_id WHERE c.book_id = ?").get(book.id) as { count: number }).count
    };
      if (chapterCount !== expectedCounts.chapters || catalogCount !== expectedCounts.catalog || skillCount !== expectedCounts.skills || outlineRevisionCount !== expectedCounts.outlineRevisions || chapterRevisionCount !== expectedCounts.chapterRevisions) {
        throw new Error("Writing 本地文件迁移记录数校验失败；SQLite 正文未清空。");
      }

      database.exec("BEGIN IMMEDIATE;");
      try {
        if (database.prepare("SELECT 1 FROM writing_local_file_migrations WHERE book_id = ?").get(book.id)) {
          database.exec("ROLLBACK;");
          continue;
        }
        database.prepare("UPDATE writing_books SET outline_content = '' WHERE id = ?").run(book.id);
        database.prepare("UPDATE writing_chapters SET content = '' WHERE book_id = ?").run(book.id);
        database.prepare("UPDATE writing_catalog_entries SET content = '' WHERE book_id = ?").run(book.id);
        database.prepare("UPDATE writing_book_skills SET instructions = ? WHERE book_id = ?").run(WRITING_LOCAL_FILE_MARKER, book.id);
        database.prepare("UPDATE writing_book_outline_revisions SET content = '' WHERE book_id = ?").run(book.id);
        database.prepare(`
          UPDATE writing_chapter_revisions SET content = ''
          WHERE chapter_id IN (SELECT id FROM writing_chapters WHERE book_id = ?)
        `).run(book.id);
        database.prepare("INSERT INTO writing_local_file_migrations (book_id, format_version, content_count) VALUES (?, 1, ?)")
          .run(book.id, 1 + chapterCount + catalogCount + skillCount + outlineRevisionCount + chapterRevisionCount);
        database.exec("COMMIT;");
      } catch (error) {
        if (database.isTransaction) database.exec("ROLLBACK;");
        throw error;
      }
    }
  }
}

export function writingContentWordCount(content: string): number { return countWritingWords(content); }

/**
 * 功能：管理账户自己的写作作品、大纲、卷、章节、设定条目、自动保存修订和当前编辑位置。
 * 作用：为常规写作编辑器与写作 AI Work 提供同一份受账户隔离的持久内容。
 * 不负责：任意文件路径访问或 Daemon 文件操作；作品大纲与章节正文保存在控制端 SQLite。
 * 关联文件：packages/api/gateway/src/index.ts、packages/storage/storage-sqlite/src/database.ts、packages/client/ui-writing/src/normal/WritingWorkspace.tsx。
 */
import { randomUUID } from "node:crypto";
import { database } from "lfaa-storage-sqlite/src/database.js";

export interface WritingBook {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface WritingVolume {
  id: string;
  title: string;
  sortOrder: number;
}

export interface WritingChapterSummary {
  id: string;
  volumeId: string;
  title: string;
  sortOrder: number;
  updatedAt: string;
  wordCount: number;
}

export interface WritingChapter extends WritingChapterSummary {
  bookId: string;
  content: string;
  createdAt: string;
}

export interface WritingChapterRevision {
  id: string;
  title: string;
  createdAt: string;
  wordCount: number;
}

export interface WritingBookOutlineRevision {
  id: string;
  title: string;
  createdAt: string;
  wordCount: number;
}

export type WritingCatalogKind =
  | "world-rule" | "world-faction" | "world-geography" | "world-history" | "world-term" | "world-realm" | "world-item" | "world-reveal"
  | "character-protagonist" | "character-major" | "character-secondary" | "character-extra"
  | "plot-storyline" | "plot-point" | "plot-foreshadow" | "plot-card" | "material";

export interface WritingCatalogSummary {
  id: string;
  kind: WritingCatalogKind;
  title: string;
  updatedAt: string;
  wordCount: number;
}

export interface WritingCatalogEntry extends WritingCatalogSummary {
  bookId: string;
  content: string;
  createdAt: string;
}

export type WritingEditOperation = "append" | "prepend" | "insert_before" | "insert_after" | "replace_anchor" | "replace";

export interface WritingEditInput {
  operation: WritingEditOperation;
  content: string;
  anchor?: string;
}

export interface WritingWorkspace {
  books: WritingBook[];
  volumes: WritingVolume[];
  chapters: WritingChapterSummary[];
  activeBookId: string | null;
  activeBookOutline: string;
  activeChapterId: string | null;
  activeChapter: WritingChapter | null;
  catalogEntries: WritingCatalogSummary[];
}

interface BookRow { id: string; title: string; created_at: string; updated_at: string }
interface VolumeRow { id: string; title: string; sort_order: number }
interface ChapterRow { id: string; book_id: string; volume_id: string; title: string; content: string; sort_order: number; created_at: string; updated_at: string }
interface RevisionRow { id: string; title: string; content: string; created_at: string }
interface OutlineRevisionRow { id: string; content: string; created_at: string }
interface WorkspaceStateRow { active_book_id: string | null; active_chapter_id: string | null }
interface CatalogEntryRow { id: string; book_id: string; kind: WritingCatalogKind; title: string; content: string; created_at: string; updated_at: string }

function mapBook(row: BookRow): WritingBook {
  return { id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapVolume(row: VolumeRow): WritingVolume {
  return { id: row.id, title: row.title, sortOrder: row.sort_order };
}

function countWords(content: string): number {
  const cjkCharacters = [...content.matchAll(/\p{Script=Han}/gu)].length;
  const otherWords = [...content.replace(/\p{Script=Han}/gu, " ").matchAll(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu)].length;
  return cjkCharacters + otherWords;
}

function mapChapterSummary(row: Pick<ChapterRow, "id" | "volume_id" | "title" | "sort_order" | "updated_at" | "content">): WritingChapterSummary {
  return { id: row.id, volumeId: row.volume_id, title: row.title, sortOrder: row.sort_order, updatedAt: row.updated_at, wordCount: countWords(row.content) };
}

function mapChapter(row: ChapterRow): WritingChapter {
  return { ...mapChapterSummary(row), bookId: row.book_id, content: row.content, createdAt: row.created_at };
}

function mapCatalogEntry(row: CatalogEntryRow): WritingCatalogEntry {
  return { id: row.id, bookId: row.book_id, kind: row.kind, title: row.title, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at, wordCount: countWords(row.content) };
}

function mapCatalogSummary(row: CatalogEntryRow): WritingCatalogSummary {
  return { id: row.id, kind: row.kind, title: row.title, updatedAt: row.updated_at, wordCount: countWords(row.content) };
}

function listCatalogRows(bookId: string): CatalogEntryRow[] {
  return database.prepare("SELECT id, book_id, kind, title, content, created_at, updated_at FROM writing_catalog_entries WHERE book_id = ? ORDER BY kind ASC, updated_at DESC, created_at DESC").all(bookId) as unknown as CatalogEntryRow[];
}

function bookRow(userId: string, bookId: string): BookRow | undefined {
  return database.prepare("SELECT id, title, created_at, updated_at FROM writing_books WHERE user_id = ? AND id = ?").get(userId, bookId) as BookRow | undefined;
}

function chapterRow(userId: string, chapterId: string): ChapterRow | undefined {
  return database.prepare(`
    SELECT c.id, c.book_id, c.volume_id, c.title, c.content, c.sort_order, c.created_at, c.updated_at
    FROM writing_chapters c JOIN writing_books b ON b.id = c.book_id
    WHERE b.user_id = ? AND c.id = ?
  `).get(userId, chapterId) as ChapterRow | undefined;
}

export function getWritingBookTarget(userId: string, bookId: string): { id: string; title: string } | null {
  const row = bookRow(userId, bookId);
  return row ? { id: row.id, title: row.title } : null;
}

export function getWritingChapterTarget(userId: string, chapterId: string): { id: string; title: string; bookId: string; bookTitle: string } | null {
  const row = database.prepare(`
    SELECT c.id, c.title, c.book_id, b.title AS book_title
    FROM writing_chapters c JOIN writing_books b ON b.id = c.book_id
    WHERE b.user_id = ? AND c.id = ?
  `).get(userId, chapterId) as { id: string; title: string; book_id: string; book_title: string } | undefined;
  return row ? { id: row.id, title: row.title, bookId: row.book_id, bookTitle: row.book_title } : null;
}

export function createWritingCatalogEntry(userId: string, bookId: string, input: { kind: WritingCatalogKind; title: string }): WritingCatalogEntry | null {
  if (!bookRow(userId, bookId)) return null;
  const id = randomUUID();
  database.prepare("INSERT INTO writing_catalog_entries (id, book_id, kind, title) VALUES (?, ?, ?, ?)").run(id, bookId, input.kind, input.title);
  const row = database.prepare("SELECT id, book_id, kind, title, content, created_at, updated_at FROM writing_catalog_entries WHERE id = ? AND book_id = ?").get(id, bookId) as CatalogEntryRow | undefined;
  return row ? mapCatalogEntry(row) : null;
}

export function getWritingCatalogEntry(userId: string, entryId: string): WritingCatalogEntry | null {
  const row = database.prepare(`
    SELECT e.id, e.book_id, e.kind, e.title, e.content, e.created_at, e.updated_at
    FROM writing_catalog_entries e JOIN writing_books b ON b.id = e.book_id
    WHERE b.user_id = ? AND e.id = ?
  `).get(userId, entryId) as CatalogEntryRow | undefined;
  return row ? mapCatalogEntry(row) : null;
}

export function updateWritingCatalogEntry(userId: string, entryId: string, input: { title: string; content: string }): WritingCatalogEntry | null {
  const current = database.prepare(`
    SELECT e.id, e.book_id, e.kind, e.title, e.content, e.created_at, e.updated_at
    FROM writing_catalog_entries e JOIN writing_books b ON b.id = e.book_id
    WHERE b.user_id = ? AND e.id = ?
  `).get(userId, entryId) as CatalogEntryRow | undefined;
  if (!current) return null;
  if (current.title !== input.title || current.content !== input.content) {
    database.prepare("UPDATE writing_catalog_entries SET title = ?, content = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(input.title, input.content, entryId);
  }
  return getWritingCatalogEntry(userId, entryId);
}

export function deleteWritingCatalogEntry(userId: string, entryId: string): boolean {
  if (!getWritingCatalogEntry(userId, entryId)) return false;
  database.prepare("DELETE FROM writing_catalog_entries WHERE id = ?").run(entryId);
  return true;
}

function joinWritingParagraphs(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  const separator = left.endsWith("\n\n") ? "" : left.endsWith("\n") ? "\n" : "\n\n";
  return `${left}${separator}${right}`;
}

function applyWritingEdit(current: string, input: WritingEditInput): string {
  if (!input.content.trim()) throw new Error("写入内容不能为空。");
  if (input.operation === "replace") return input.content;
  if (input.operation === "append") return joinWritingParagraphs(current, input.content);
  if (input.operation === "prepend") return joinWritingParagraphs(input.content, current);

  const anchor = input.anchor;
  if (!anchor?.trim()) throw new Error("锚点操作必须提供准确的原文锚点。");
  const index = current.indexOf(anchor);
  if (index < 0) throw new Error("找不到指定锚点；内容未修改。请根据当前内容重新确定精确位置。");
  if (current.indexOf(anchor, index + anchor.length) >= 0) throw new Error("指定锚点出现多次，无法确定唯一位置；内容未修改。请提供更完整的原文锚点。");
  if (input.operation === "replace_anchor") return `${current.slice(0, index)}${input.content}${current.slice(index + anchor.length)}`;
  const left = input.operation === "insert_before" ? current.slice(0, index) : current.slice(0, index + anchor.length);
  const right = input.operation === "insert_before" ? current.slice(index) : current.slice(index + anchor.length);
  return joinWritingParagraphs(joinWritingParagraphs(left, input.content), right);
}

export function updateWritingBookOutline(userId: string, bookId: string, content: string): { bookId: string; content: string; updatedAt: string; wordCount: number } | null {
  const current = database.prepare("SELECT id, outline_content FROM writing_books WHERE user_id = ? AND id = ?").get(userId, bookId) as { id: string; outline_content: string } | undefined;
  if (!current) return null;
  if (current.outline_content !== content) {
    database.exec("BEGIN IMMEDIATE;");
    try {
      database.prepare("INSERT INTO writing_book_outline_revisions (id, book_id, content) VALUES (?, ?, ?)").run(randomUUID(), bookId, current.outline_content);
      database.prepare("UPDATE writing_books SET outline_content = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND user_id = ?").run(content, bookId, userId);
      database.prepare(`
        DELETE FROM writing_book_outline_revisions WHERE book_id = ? AND id NOT IN (
          SELECT id FROM writing_book_outline_revisions WHERE book_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50
        )
      `).run(bookId, bookId);
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  }
  const updated = database.prepare("SELECT outline_content, updated_at FROM writing_books WHERE user_id = ? AND id = ?").get(userId, bookId) as { outline_content: string; updated_at: string } | undefined;
  return updated ? { bookId, content: updated.outline_content, updatedAt: updated.updated_at, wordCount: countWords(updated.outline_content) } : null;
}

export function applyWritingBookOutlineEdit(userId: string, bookId: string, input: WritingEditInput): { bookId: string; bookTitle: string; content: string; updatedAt: string; wordCount: number } | null {
  const target = database.prepare("SELECT title, outline_content FROM writing_books WHERE user_id = ? AND id = ?").get(userId, bookId) as { title: string; outline_content: string } | undefined;
  if (!target) return null;
  const content = applyWritingEdit(target.outline_content, input);
  if (content.length > 1_500_000) throw new Error("本次修改会使大纲超过 150 万字符上限，未保存。");
  const updated = updateWritingBookOutline(userId, bookId, content);
  return updated ? { ...updated, bookTitle: target.title } : null;
}

export function applyWritingChapterEdit(userId: string, chapterId: string, input: WritingEditInput): WritingChapter | null {
  const current = chapterRow(userId, chapterId);
  if (!current) return null;
  const content = applyWritingEdit(current.content, input);
  if (content.length > 1_500_000) throw new Error("本次修改会使正文超过 150 万字符上限，未保存。");
  return updateWritingChapter(userId, chapterId, { title: current.title, content });
}

function setWorkspaceState(userId: string, bookId: string | null, chapterId: string | null): void {
  database.prepare(`
    INSERT INTO writing_workspace_state (user_id, active_book_id, active_chapter_id)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET active_book_id = excluded.active_book_id, active_chapter_id = excluded.active_chapter_id,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `).run(userId, bookId, chapterId);
}

export function getWritingWorkspace(userId: string): WritingWorkspace {
  const bookRows = database.prepare("SELECT id, title, created_at, updated_at FROM writing_books WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC").all(userId) as unknown as BookRow[];
  const books = bookRows.map(mapBook);
  const state = database.prepare("SELECT active_book_id, active_chapter_id FROM writing_workspace_state WHERE user_id = ?").get(userId) as WorkspaceStateRow | undefined;
  const selectedBook = state
    ? state.active_book_id ? books.find((book) => book.id === state.active_book_id) ?? books[0] ?? null : null
    : books[0] ?? null;
  const volumeRows = selectedBook
    ? database.prepare("SELECT id, title, sort_order FROM writing_volumes WHERE book_id = ? ORDER BY sort_order ASC, created_at ASC").all(selectedBook.id) as unknown as VolumeRow[]
    : [];
  const volumes = volumeRows.map(mapVolume);
  const chapterRows = selectedBook
    ? database.prepare("SELECT id, book_id, volume_id, title, content, sort_order, created_at, updated_at FROM writing_chapters WHERE book_id = ? ORDER BY sort_order ASC, created_at ASC").all(selectedBook.id) as unknown as ChapterRow[]
    : [];
  const chapters = chapterRows.map(mapChapterSummary);
  const selectedChapter = state
    ? state.active_chapter_id ? chapterRows.find((chapter) => chapter.id === state.active_chapter_id) ?? chapterRows[0] ?? null : null
    : chapterRows[0] ?? null;

  if (!state && selectedBook) setWorkspaceState(userId, selectedBook.id, selectedChapter?.id ?? null);

  return {
    books,
    volumes,
    chapters,
    activeBookId: selectedBook?.id ?? null,
    activeBookOutline: selectedBook
      ? (database.prepare("SELECT outline_content FROM writing_books WHERE id = ? AND user_id = ?").get(selectedBook.id, userId) as { outline_content: string }).outline_content
      : "",
    activeChapterId: selectedChapter?.id ?? null,
    activeChapter: selectedChapter ? mapChapter(selectedChapter) : null,
    catalogEntries: selectedBook ? listCatalogRows(selectedBook.id).map(mapCatalogSummary) : []
  };
}

export function setActiveWritingLocation(userId: string, bookId: string | null, chapterId: string | null): WritingWorkspace | null {
  if (!bookId) {
    if (chapterId) return null;
    setWorkspaceState(userId, null, null);
    return getWritingWorkspace(userId);
  }
  if (!bookRow(userId, bookId)) return null;
  const firstChapterId = chapterId === null
    ? (database.prepare("SELECT id FROM writing_chapters WHERE book_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1").get(bookId) as { id: string } | undefined)?.id ?? null
    : chapterId;
  if (firstChapterId) {
    const chapter = chapterRow(userId, firstChapterId);
    if (!chapter || chapter.book_id !== bookId) return null;
  }
  setWorkspaceState(userId, bookId, firstChapterId);
  return getWritingWorkspace(userId);
}

export function createWritingBook(userId: string, title: string): WritingWorkspace {
  const bookId = randomUUID();
  const volumeId = randomUUID();
  const chapterId = randomUUID();
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.prepare("INSERT INTO writing_books (id, user_id, title) VALUES (?, ?, ?)").run(bookId, userId, title);
    database.prepare("INSERT INTO writing_volumes (id, book_id, title, sort_order) VALUES (?, ?, '第一卷', 0)").run(volumeId, bookId);
    database.prepare("INSERT INTO writing_chapters (id, book_id, volume_id, title, content, sort_order) VALUES (?, ?, ?, '第1章', '', 0)").run(chapterId, bookId, volumeId);
    setWorkspaceState(userId, bookId, chapterId);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
  return getWritingWorkspace(userId);
}

export function createWritingVolume(userId: string, bookId: string, title: string): WritingWorkspace | null {
  if (!bookRow(userId, bookId)) return null;
  const volumeId = randomUUID();
  database.exec("BEGIN IMMEDIATE;");
  try {
    const maxOrder = database.prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM writing_volumes WHERE book_id = ?").get(bookId) as { max_order: number };
    database.prepare("INSERT INTO writing_volumes (id, book_id, title, sort_order) VALUES (?, ?, ?, ?)").run(volumeId, bookId, title, maxOrder.max_order + 1);
    database.prepare("UPDATE writing_books SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(bookId);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
  return getWritingWorkspace(userId);
}

export function renameWritingBook(userId: string, bookId: string, title: string): WritingBook | null {
  database.prepare("UPDATE writing_books SET title = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND id = ?").run(title, userId, bookId);
  const row = bookRow(userId, bookId);
  return row ? mapBook(row) : null;
}

export function deleteWritingBook(userId: string, bookId: string): boolean {
  if (!bookRow(userId, bookId)) return false;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.prepare("DELETE FROM writing_books WHERE user_id = ? AND id = ?").run(userId, bookId);
    const state = database.prepare("SELECT active_book_id FROM writing_workspace_state WHERE user_id = ?").get(userId) as { active_book_id: string | null } | undefined;
    if (state?.active_book_id === bookId) {
      const nextBook = database.prepare("SELECT id FROM writing_books WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1").get(userId) as { id: string } | undefined;
      const nextChapter = nextBook
        ? database.prepare("SELECT id FROM writing_chapters WHERE book_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1").get(nextBook.id) as { id: string } | undefined
        : undefined;
      setWorkspaceState(userId, nextBook?.id ?? null, nextChapter?.id ?? null);
    }
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
  return true;
}

export function createWritingChapter(userId: string, bookId: string, title: string, requestedVolumeId?: string): WritingWorkspace | null {
  if (!bookRow(userId, bookId)) return null;
  const volumeId = requestedVolumeId ?? (database.prepare("SELECT id FROM writing_volumes WHERE book_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1").get(bookId) as { id: string } | undefined)?.id;
  if (!volumeId || !database.prepare("SELECT id FROM writing_volumes WHERE id = ? AND book_id = ?").get(volumeId, bookId)) return null;
  const maxOrder = database.prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM writing_chapters WHERE book_id = ?").get(bookId) as { max_order: number };
  const chapterId = randomUUID();
  database.prepare("INSERT INTO writing_chapters (id, book_id, volume_id, title, content, sort_order) VALUES (?, ?, ?, ?, '', ?)").run(chapterId, bookId, volumeId, title, maxOrder.max_order + 1);
  database.prepare("UPDATE writing_books SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(bookId);
  setWorkspaceState(userId, bookId, chapterId);
  return getWritingWorkspace(userId);
}

export function updateWritingChapter(userId: string, chapterId: string, input: { title: string; content: string }): WritingChapter | null {
  const current = chapterRow(userId, chapterId);
  if (!current) return null;
  if (current.title !== input.title || current.content !== input.content) {
    database.exec("BEGIN IMMEDIATE;");
    try {
      database.prepare("INSERT INTO writing_chapter_revisions (id, chapter_id, title, content) VALUES (?, ?, ?, ?)").run(randomUUID(), chapterId, current.title, current.content);
      database.prepare("UPDATE writing_chapters SET title = ?, content = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(input.title, input.content, chapterId);
      database.prepare("UPDATE writing_books SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(current.book_id);
      database.prepare(`
        DELETE FROM writing_chapter_revisions WHERE chapter_id = ? AND id NOT IN (
          SELECT id FROM writing_chapter_revisions WHERE chapter_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50
        )
      `).run(chapterId, chapterId);
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  }
  const updated = chapterRow(userId, chapterId);
  return updated ? mapChapter(updated) : null;
}

export function deleteWritingChapter(userId: string, chapterId: string): WritingWorkspace | null {
  const current = chapterRow(userId, chapterId);
  if (!current) return null;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.prepare("DELETE FROM writing_chapters WHERE id = ?").run(chapterId);
    database.prepare("UPDATE writing_books SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(current.book_id);
    const next = database.prepare("SELECT id FROM writing_chapters WHERE book_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1").get(current.book_id) as { id: string } | undefined;
    const state = database.prepare("SELECT active_chapter_id FROM writing_workspace_state WHERE user_id = ?").get(userId) as { active_chapter_id: string | null } | undefined;
    if (state?.active_chapter_id === chapterId) setWorkspaceState(userId, current.book_id, next?.id ?? null);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
  return getWritingWorkspace(userId);
}

export function listWritingChapterRevisions(userId: string, chapterId: string): WritingChapterRevision[] | null {
  if (!chapterRow(userId, chapterId)) return null;
  const rows = database.prepare("SELECT id, title, content, created_at FROM writing_chapter_revisions WHERE chapter_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50").all(chapterId) as unknown as RevisionRow[];
  return rows.map((row) => ({ id: row.id, title: row.title, createdAt: row.created_at, wordCount: countWords(row.content) }));
}

export function listWritingBookOutlineRevisions(userId: string, bookId: string): WritingBookOutlineRevision[] | null {
  if (!bookRow(userId, bookId)) return null;
  const rows = database.prepare("SELECT id, content, created_at FROM writing_book_outline_revisions WHERE book_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50").all(bookId) as unknown as OutlineRevisionRow[];
  return rows.map((row) => ({ id: row.id, title: "大纲", createdAt: row.created_at, wordCount: countWords(row.content) }));
}

export function restoreWritingBookOutlineRevision(userId: string, bookId: string, revisionId: string): { bookId: string; content: string; updatedAt: string; wordCount: number } | null {
  if (!bookRow(userId, bookId)) return null;
  const revision = database.prepare(`
    SELECT r.id, r.content, r.created_at FROM writing_book_outline_revisions r
    JOIN writing_books b ON b.id = r.book_id
    WHERE b.user_id = ? AND r.book_id = ? AND r.id = ?
  `).get(userId, bookId, revisionId) as OutlineRevisionRow | undefined;
  if (!revision) return null;
  return updateWritingBookOutline(userId, bookId, revision.content);
}

export function restoreWritingChapterRevision(userId: string, chapterId: string, revisionId: string): WritingChapter | null {
  if (!chapterRow(userId, chapterId)) return null;
  const revision = database.prepare(`
    SELECT r.id, r.title, r.content, r.created_at FROM writing_chapter_revisions r
    JOIN writing_chapters c ON c.id = r.chapter_id JOIN writing_books b ON b.id = c.book_id
    WHERE b.user_id = ? AND r.chapter_id = ? AND r.id = ?
  `).get(userId, chapterId, revisionId) as RevisionRow | undefined;
  if (!revision) return null;
  return updateWritingChapter(userId, chapterId, { title: revision.title, content: revision.content });
}

export function getActiveWritingAiContext(userId: string): {
  bookId: string;
  bookTitle: string;
  outline: string;
  outlineTruncated: boolean;
  chapterId: string | null;
  chapterTitle: string | null;
  content: string;
  chapterTruncated: boolean;
} | null {
  const state = database.prepare("SELECT active_book_id, active_chapter_id FROM writing_workspace_state WHERE user_id = ?").get(userId) as WorkspaceStateRow | undefined;
  if (!state?.active_book_id) return null;
  const book = database.prepare("SELECT id, title, outline_content FROM writing_books WHERE user_id = ? AND id = ?").get(userId, state.active_book_id) as { id: string; title: string; outline_content: string } | undefined;
  if (!book) return null;
  const chapter = state.active_chapter_id
    ? database.prepare("SELECT id, title, content FROM writing_chapters WHERE id = ? AND book_id = ?").get(state.active_chapter_id, book.id) as { id: string; title: string; content: string } | undefined
    : undefined;
  const limit = 12_000;
  return {
    bookId: book.id,
    bookTitle: book.title,
    outline: book.outline_content.slice(0, limit),
    outlineTruncated: book.outline_content.length > limit,
    chapterId: chapter?.id ?? null,
    chapterTitle: chapter?.title ?? null,
    content: chapter?.content.slice(0, limit) ?? "",
    chapterTruncated: (chapter?.content.length ?? 0) > limit
  };
}

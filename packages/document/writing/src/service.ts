/**
 * 功能：管理账户自己的写作作品、大纲、卷、章节、设定条目、自动保存修订和当前编辑位置。
 * 作用：为常规写作编辑器与写作 AI Work 提供同一份受账户隔离的持久内容。
 * 不负责：任意文件路径访问或 Daemon 文件操作；作品大纲与章节正文保存在控制端 SQLite。
 * 关联文件：packages/api/gateway/src/index.ts、packages/storage/storage-sqlite/src/database.ts、packages/client/ui-writing/src/normal/WritingWorkspace.tsx。
 */
import { createHash, randomUUID } from "node:crypto";
import { createDeepWriteZip, parseDeepWriteProject, readDeepWriteZip, DEEPWRITE_ZIP_MAX_COMPRESSED_BYTES, DEEPWRITE_ZIP_MAX_ENTRIES, DEEPWRITE_ZIP_MAX_ENTRY_BYTES, DEEPWRITE_ZIP_MAX_UNCOMPRESSED_BYTES } from "./deepwrite-archive.js";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { WRITING_SPECIALISTS, getWritingSpecialist, type WritingSpecialistId } from "./writing-specialist-library.js";

export interface WritingBook {
  id: string;
  title: string;
  aiRoleId: WritingSpecialistId;
  createdAt: string;
  updatedAt: string;
}

export interface WritingBookSkillSummary {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  updatedAt: string;
}

export interface WritingBookSkill extends WritingBookSkillSummary {
  bookId: string;
  instructions: string;
  createdAt: string;
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

export interface WritingChapterRevisionExcerpt {
  id: string;
  title: string;
  createdAt: string;
  content: string;
  characterCount: number;
  contentTruncated: boolean;
}

export interface WritingBookOutlineRevision {
  id: string;
  title: string;
  createdAt: string;
  wordCount: number;
}

export const WRITING_CATALOG_KINDS = [
  "world-rule", "world-faction", "world-geography", "world-history", "world-term", "world-realm", "world-item", "world-reveal",
  "character-protagonist", "character-major", "character-secondary", "character-extra",
  "plot-storyline", "plot-point", "plot-foreshadow", "plot-card", "material"
] as const;

export type WritingCatalogKind = typeof WRITING_CATALOG_KINDS[number];
export const WRITING_CATALOG_PAGE_SIZE = 40;
export const WRITING_CATALOG_AI_CONTEXT_CHARACTERS = 12_000;

export interface WritingCatalogSummary {
  id: string;
  kind: WritingCatalogKind;
  title: string;
  updatedAt: string;
}

export interface WritingCatalogEntry extends WritingCatalogSummary {
  bookId: string;
  content: string;
  createdAt: string;
  wordCount: number;
}

export interface WritingCatalogPage {
  entries: WritingCatalogSummary[];
  offset: number;
  limit: number;
  total: number;
}

export const WRITING_ANALYSIS_BATCH_CHARACTER_LIMIT = 12_000;
export const WRITING_ANALYSIS_BATCH_CHAPTER_LIMIT = 8;

export interface WritingAnalysisChapterSummary {
  id: string;
  title: string;
  sortOrder: number;
  updatedAt: string;
}

export interface WritingAnalysisChapterPage {
  chapters: WritingAnalysisChapterSummary[];
  offset: number;
  limit: number;
  total: number;
}

export interface WritingAnalysisChapterExcerpt {
  id: string;
  title: string;
  sortOrder: number;
  body: string;
  characterCount: number;
  contentTruncated: boolean;
}

export interface WritingCatalogAiExcerpt extends Omit<WritingCatalogEntry, "content"> {
  content: string;
  characterCount: number;
  contentTruncated: boolean;
}

export interface WritingEditProposalCreated {
  id: string;
  bookId: string;
  targetType: "outline" | "chapter";
  targetId: string;
  bookTitle: string;
  targetTitle: string;
  operation: WritingEditOperation;
  status: "pending";
  proposedWordCount: number;
  createdAt: string;
  expiresAt: string;
}

export interface WritingEditProposalView extends Omit<WritingEditProposalCreated, "proposedWordCount" | "status"> {
  status: "pending" | "applied" | "rejected" | "stale" | "superseded" | "expired";
  baseContent: string | null;
  proposedContent: string | null;
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
  catalogEntriesHasMore: boolean;
  writingRoleOptions: Array<{ id: WritingSpecialistId; name: string; description: string }>;
  bookSkills: WritingBookSkillSummary[];
}

interface BookRow { id: string; title: string; ai_role_id: WritingSpecialistId; created_at: string; updated_at: string }
interface VolumeRow { id: string; title: string; sort_order: number }
interface ChapterRow { id: string; book_id: string; volume_id: string; title: string; content: string; sort_order: number; created_at: string; updated_at: string }
interface RevisionRow { id: string; title: string; content: string; created_at: string }
interface OutlineRevisionRow { id: string; content: string; created_at: string }
interface WorkspaceStateRow { active_book_id: string | null; active_chapter_id: string | null }
interface CatalogEntryRow { id: string; book_id: string; kind: WritingCatalogKind; title: string; content: string; created_at: string; updated_at: string }
interface CatalogSummaryRow { id: string; kind: WritingCatalogKind; title: string; updated_at: string }
interface WritingEditProposalRow {
  id: string; user_id: string; book_id: string; target_type: "outline" | "chapter"; target_id: string;
  operation: WritingEditOperation; base_sha256: string; proposed_content: string; status: WritingEditProposalView["status"];
  created_at: string; expires_at: string; book_title: string;
}

interface WritingBookSkillRow { id: string; book_id: string; title: string; description: string; instructions: string; enabled: number; created_at: string; updated_at: string }
interface WritingBookSkillSummaryRow { id: string; title: string; description: string; enabled: number; updated_at: string }

function mapBook(row: BookRow): WritingBook {
  return { id: row.id, title: row.title, aiRoleId: row.ai_role_id, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapWritingBookSkill(row: WritingBookSkillRow): WritingBookSkill {
  return { id: row.id, bookId: row.book_id, title: row.title, description: row.description, instructions: row.instructions, enabled: row.enabled === 1, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapWritingBookSkillSummary(row: WritingBookSkillSummaryRow): WritingBookSkillSummary {
  return { id: row.id, title: row.title, description: row.description, enabled: row.enabled === 1, updatedAt: row.updated_at };
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
  return { ...mapCatalogSummary(row), bookId: row.book_id, content: row.content, createdAt: row.created_at, wordCount: countWords(row.content) };
}

function mapCatalogSummary(row: CatalogSummaryRow): WritingCatalogSummary {
  return { id: row.id, kind: row.kind, title: row.title, updatedAt: row.updated_at };
}

function listCatalogRows(bookId: string, limit: number): CatalogSummaryRow[] {
  return database.prepare("SELECT id, kind, title, updated_at FROM writing_catalog_entries WHERE book_id = ? ORDER BY kind ASC, updated_at DESC, created_at DESC LIMIT ?").all(bookId, limit) as unknown as CatalogSummaryRow[];
}

function bookRow(userId: string, bookId: string): BookRow | undefined {
  return database.prepare("SELECT id, title, ai_role_id, created_at, updated_at FROM writing_books WHERE user_id = ? AND id = ?").get(userId, bookId) as BookRow | undefined;
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

export function listWritingCatalogEntries(userId: string, bookId: string, input: { kind?: WritingCatalogKind; search?: string; offset: number }): WritingCatalogPage | null {
  if (!bookRow(userId, bookId)) return null;
  if ((input.kind !== undefined && !WRITING_CATALOG_KINDS.includes(input.kind)) || !Number.isSafeInteger(input.offset) || input.offset < 0 || input.offset > 1_000_000) {
    throw new Error("作品资料分页参数无效。");
  }
  const search = input.search?.trim() ?? "";
  if (search.length > 100) throw new Error("作品资料标题搜索最多 100 个字符。");

  const kindClause = input.kind === undefined ? "" : " AND kind = ?";
  const searchClause = search ? " AND instr(lower(title), lower(?)) > 0" : "";
  const parameters: Array<string | number> = [bookId];
  if (input.kind !== undefined) parameters.push(input.kind);
  if (search) parameters.push(search);
  const total = (database.prepare(`SELECT COUNT(*) AS total FROM writing_catalog_entries WHERE book_id = ?${kindClause}${searchClause}`).get(...parameters) as { total: number }).total;
  const rows = database.prepare(`
    SELECT id, kind, title, updated_at
    FROM writing_catalog_entries
    WHERE book_id = ?${kindClause}${searchClause}
    ORDER BY updated_at DESC, created_at DESC, id ASC
    LIMIT ? OFFSET ?
  `).all(...parameters, WRITING_CATALOG_PAGE_SIZE, input.offset) as unknown as CatalogSummaryRow[];
  return { entries: rows.map(mapCatalogSummary), offset: input.offset, limit: WRITING_CATALOG_PAGE_SIZE, total };
}

export function getWritingCatalogEntryForBook(userId: string, bookId: string, entryId: string): WritingCatalogAiExcerpt | null {
  const row = database.prepare(`
    SELECT e.id, e.book_id, e.kind, e.title, substr(e.content, 1, ?) AS content, e.created_at, e.updated_at, length(e.content) AS character_count
    FROM writing_catalog_entries e JOIN writing_books b ON b.id = e.book_id
    WHERE b.user_id = ? AND e.book_id = ? AND e.id = ?
  `).get(WRITING_CATALOG_AI_CONTEXT_CHARACTERS + 1, userId, bookId, entryId) as (CatalogEntryRow & { character_count: number }) | undefined;
  if (!row) return null;
  const characterCount = row.character_count;
  const contentTruncated = characterCount > WRITING_CATALOG_AI_CONTEXT_CHARACTERS;
  const content = contentTruncated ? row.content.slice(0, WRITING_CATALOG_AI_CONTEXT_CHARACTERS) : row.content;
  return {
    ...mapCatalogEntry({ ...row, content }),
    characterCount,
    contentTruncated
  };
}

export function listWritingAnalysisChapters(userId: string, bookId: string, input: { offset: number; limit: number }): WritingAnalysisChapterPage | null {
  if (!bookRow(userId, bookId)) return null;
  if (!Number.isSafeInteger(input.offset) || input.offset < 0 || input.offset > 1_000_000 || !Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 40) throw new Error("章节分析分页参数无效；每页最多 40 章。");
  const total = (database.prepare("SELECT COUNT(*) AS total FROM writing_chapters WHERE book_id = ?").get(bookId) as { total: number }).total;
  const rows = database.prepare(`
    SELECT id, title, sort_order, updated_at FROM writing_chapters WHERE book_id = ?
    ORDER BY sort_order ASC, created_at ASC, id ASC LIMIT ? OFFSET ?
  `).all(bookId, input.limit, input.offset) as unknown as Array<{ id: string; title: string; sort_order: number; updated_at: string }>;
  return { chapters: rows.map((row) => ({ id: row.id, title: row.title, sortOrder: row.sort_order, updatedAt: row.updated_at })), offset: input.offset, limit: input.limit, total };
}

export function getWritingAnalysisChapterExcerpts(userId: string, bookId: string, chapterIds: string[]): { chapters: WritingAnalysisChapterExcerpt[]; characterCount: number; contentTruncated: boolean } | null {
  if (!bookRow(userId, bookId)) return null;
  if (!chapterIds.length || chapterIds.length > WRITING_ANALYSIS_BATCH_CHAPTER_LIMIT || new Set(chapterIds).size !== chapterIds.length) throw new Error(`每批请选择 1–${WRITING_ANALYSIS_BATCH_CHAPTER_LIMIT} 个不同章节。`);
  const read = database.prepare(`
    SELECT c.id, c.title, c.sort_order, substr(c.content, 1, ?) AS body, length(c.content) AS character_count
    FROM writing_chapters c JOIN writing_books b ON b.id = c.book_id
    WHERE b.user_id = ? AND c.book_id = ? AND c.id = ?
  `);
  const rows = chapterIds.map((chapterId) => read.get(WRITING_ANALYSIS_BATCH_CHARACTER_LIMIT + 1, userId, bookId, chapterId) as { id: string; title: string; sort_order: number; body: string; character_count: number } | undefined);
  if (rows.some((row) => !row)) return null;
  let remaining = WRITING_ANALYSIS_BATCH_CHARACTER_LIMIT;
  let characterCount = 0;
  const chapters = rows.map((row) => {
    const actual = row!.character_count;
    const returnedBody = row!.body.slice(0, remaining);
    const truncated = actual > returnedBody.length;
    characterCount += actual;
    remaining = Math.max(0, remaining - returnedBody.length);
    return { id: row!.id, title: row!.title, sortOrder: row!.sort_order, body: returnedBody, characterCount: actual, contentTruncated: truncated };
  });
  return { chapters, characterCount, contentTruncated: characterCount > WRITING_ANALYSIS_BATCH_CHARACTER_LIMIT };
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

function writingContentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function readWritingProposalTarget(userId: string, bookId: string, targetType: "outline" | "chapter", targetId: string): { bookTitle: string; targetTitle: string; content: string } | null {
  if (targetType === "outline") {
    if (targetId !== bookId) return null;
    const row = database.prepare("SELECT title, outline_content FROM writing_books WHERE user_id = ? AND id = ?").get(userId, bookId) as { title: string; outline_content: string } | undefined;
    return row ? { bookTitle: row.title, targetTitle: "作品大纲", content: row.outline_content } : null;
  }
  const chapter = chapterRow(userId, targetId);
  if (!chapter || chapter.book_id !== bookId) return null;
  const book = bookRow(userId, bookId);
  return book ? { bookTitle: book.title, targetTitle: chapter.title, content: chapter.content } : null;
}

export function createWritingEditProposal(userId: string, bookId: string, targetType: "outline" | "chapter", targetId: string, input: WritingEditInput): WritingEditProposalCreated | null {
  database.exec("BEGIN IMMEDIATE;");
  try {
    const target = readWritingProposalTarget(userId, bookId, targetType, targetId);
    if (!target) { database.exec("ROLLBACK;"); return null; }
    const proposedContent = applyWritingEdit(target.content, input);
    if (proposedContent.length > 1_500_000) throw new Error("本次提案会使目标超过 150 万字符上限，未创建提案。");
    if (proposedContent === target.content) throw new Error("本次修改与当前内容相同，没有创建空提案。");
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    database.prepare("UPDATE writing_edit_proposals SET status = 'superseded' WHERE user_id = ? AND target_type = ? AND target_id = ? AND status = 'pending'").run(userId, targetType, targetId);
    database.prepare(`
      INSERT INTO writing_edit_proposals (id, user_id, book_id, target_type, target_id, operation, base_sha256, proposed_content, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, userId, bookId, targetType, targetId, input.operation, writingContentHash(target.content), proposedContent, createdAt, expiresAt);
    database.prepare(`DELETE FROM writing_edit_proposals WHERE user_id = ? AND id NOT IN (
      SELECT id FROM writing_edit_proposals WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50
    )`).run(userId, userId);
    database.exec("COMMIT;");
    return { id, bookId, targetType, targetId, bookTitle: target.bookTitle, targetTitle: target.targetTitle, operation: input.operation, status: "pending", proposedWordCount: countWords(proposedContent), createdAt, expiresAt };
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK;");
    throw error;
  }
}

function proposalRow(userId: string, proposalId: string): WritingEditProposalRow | undefined {
  return database.prepare(`
    SELECT p.id, p.user_id, p.book_id, p.target_type, p.target_id, p.operation, p.base_sha256, p.proposed_content,
      p.status, p.created_at, p.expires_at, b.title AS book_title
    FROM writing_edit_proposals p JOIN writing_books b ON b.id = p.book_id
    WHERE p.user_id = ? AND b.user_id = ? AND p.id = ?
  `).get(userId, userId, proposalId) as WritingEditProposalRow | undefined;
}

function proposalStatusView(row: WritingEditProposalRow, status: WritingEditProposalView["status"], targetTitle: string): WritingEditProposalView {
  return {
    id: row.id, bookId: row.book_id, targetType: row.target_type, targetId: row.target_id,
    bookTitle: row.book_title, targetTitle, operation: row.operation, status,
    createdAt: row.created_at, expiresAt: row.expires_at,
    baseContent: null, proposedContent: null
  };
}

export function getWritingEditProposal(userId: string, proposalId: string): WritingEditProposalView | null {
  const row = proposalRow(userId, proposalId);
  if (!row) return null;
  const target = readWritingProposalTarget(userId, row.book_id, row.target_type, row.target_id);
  const expired = row.status === "pending" && row.expires_at <= new Date().toISOString();
  const stale = row.status === "pending" && !expired && (!target || writingContentHash(target.content) !== row.base_sha256);
  const status = expired ? "expired" : stale ? "stale" : row.status;
  const targetTitle = target?.targetTitle ?? (row.target_type === "outline" ? "作品大纲" : "章节已删除");
  if (status !== "pending" || !target) return proposalStatusView(row, status, targetTitle);
  return { ...proposalStatusView(row, "pending", targetTitle), baseContent: target.content, proposedContent: row.proposed_content };
}

export function resolveWritingEditProposal(userId: string, proposalId: string, decision: "apply" | "reject"): { id: string; status: WritingEditProposalView["status"] } | null {
  database.exec("BEGIN IMMEDIATE;");
  try {
    const row = proposalRow(userId, proposalId);
    if (!row) { database.exec("ROLLBACK;"); return null; }
    if (row.status !== "pending") { database.exec("COMMIT;"); return { id: row.id, status: row.status }; }
    if (decision === "reject") {
      const status = row.expires_at <= new Date().toISOString() ? "expired" : "rejected";
      database.prepare("UPDATE writing_edit_proposals SET status = ? WHERE id = ? AND user_id = ? AND status = 'pending'").run(status, row.id, userId);
      database.exec("COMMIT;");
      return { id: row.id, status };
    }
    if (row.expires_at <= new Date().toISOString()) {
      database.prepare("UPDATE writing_edit_proposals SET status = 'expired' WHERE id = ? AND user_id = ? AND status = 'pending'").run(row.id, userId);
      database.exec("COMMIT;");
      return { id: row.id, status: "expired" };
    }
    const target = readWritingProposalTarget(userId, row.book_id, row.target_type, row.target_id);
    if (!target || writingContentHash(target.content) !== row.base_sha256) {
      database.prepare("UPDATE writing_edit_proposals SET status = 'stale' WHERE id = ? AND user_id = ? AND status = 'pending'").run(row.id, userId);
      database.exec("COMMIT;");
      return { id: row.id, status: "stale" };
    }
    if (row.target_type === "outline") {
      database.prepare("INSERT INTO writing_book_outline_revisions (id, book_id, content) VALUES (?, ?, ?)").run(randomUUID(), row.book_id, target.content);
      database.prepare("UPDATE writing_books SET outline_content = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND user_id = ?").run(row.proposed_content, row.book_id, userId);
      database.prepare(`DELETE FROM writing_book_outline_revisions WHERE book_id = ? AND id NOT IN (
        SELECT id FROM writing_book_outline_revisions WHERE book_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50
      )`).run(row.book_id, row.book_id);
    } else {
      const chapter = chapterRow(userId, row.target_id);
      if (!chapter || chapter.book_id !== row.book_id) {
        database.prepare("UPDATE writing_edit_proposals SET status = 'stale' WHERE id = ? AND user_id = ? AND status = 'pending'").run(row.id, userId);
        database.exec("COMMIT;");
        return { id: row.id, status: "stale" };
      }
      database.prepare("INSERT INTO writing_chapter_revisions (id, chapter_id, title, content) VALUES (?, ?, ?, ?)").run(randomUUID(), chapter.id, chapter.title, chapter.content);
      database.prepare("UPDATE writing_chapters SET content = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(row.proposed_content, chapter.id);
      database.prepare("UPDATE writing_books SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(row.book_id);
      database.prepare(`DELETE FROM writing_chapter_revisions WHERE chapter_id = ? AND id NOT IN (
        SELECT id FROM writing_chapter_revisions WHERE chapter_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50
      )`).run(chapter.id, chapter.id);
    }
    database.prepare("UPDATE writing_edit_proposals SET status = 'applied' WHERE id = ? AND user_id = ? AND status = 'pending'").run(row.id, userId);
    database.exec("COMMIT;");
    return { id: row.id, status: "applied" };
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK;");
    throw error;
  }
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
  const bookRows = database.prepare("SELECT id, title, ai_role_id, created_at, updated_at FROM writing_books WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC").all(userId) as unknown as BookRow[];
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

  const catalogRows = selectedBook ? listCatalogRows(selectedBook.id, WRITING_CATALOG_PAGE_SIZE + 1) : [];
  const skillRows = selectedBook ? database.prepare(`
    SELECT id, title, description, enabled, updated_at
    FROM writing_book_skills WHERE user_id = ? AND book_id = ?
    ORDER BY updated_at DESC, id ASC LIMIT 40
  `).all(userId, selectedBook.id) as unknown as WritingBookSkillSummaryRow[] : [];
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
    catalogEntries: catalogRows.slice(0, WRITING_CATALOG_PAGE_SIZE).map(mapCatalogSummary),
    catalogEntriesHasMore: catalogRows.length > WRITING_CATALOG_PAGE_SIZE,
    writingRoleOptions: WRITING_SPECIALISTS.map(({ id, name, description }) => ({ id, name, description })),
    bookSkills: skillRows.map(mapWritingBookSkillSummary)
  };
}

export function updateWritingBookAiRole(userId: string, bookId: string, roleId: string): WritingWorkspace | null {
  if (!getWritingSpecialist(roleId)) throw new Error("请选择有效的写作专职角色。");
  const result = database.prepare("UPDATE writing_books SET ai_role_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND id = ?").run(roleId, userId, bookId);
  return result.changes ? getWritingWorkspace(userId) : null;
}

export function listWritingBookSkills(userId: string, bookId: string): WritingBookSkillSummary[] | null {
  if (!bookRow(userId, bookId)) return null;
  return (database.prepare(`
    SELECT id, title, description, enabled, updated_at
    FROM writing_book_skills WHERE user_id = ? AND book_id = ?
    ORDER BY updated_at DESC, id ASC LIMIT 40
  `).all(userId, bookId) as unknown as WritingBookSkillSummaryRow[]).map(mapWritingBookSkillSummary);
}

export function getWritingBookSkill(userId: string, bookId: string, skillId: string): WritingBookSkill | null {
  const row = database.prepare(`
    SELECT s.id, s.book_id, s.title, s.description, s.instructions, s.enabled, s.created_at, s.updated_at
    FROM writing_book_skills s JOIN writing_books b ON b.id = s.book_id
    WHERE b.user_id = ? AND s.user_id = ? AND s.book_id = ? AND s.id = ?
  `).get(userId, userId, bookId, skillId) as WritingBookSkillRow | undefined;
  return row ? mapWritingBookSkill(row) : null;
}

export function createWritingBookSkill(userId: string, bookId: string, input: { title: string; description?: string; instructions: string; enabled?: boolean }): WritingBookSkill | null {
  if (!bookRow(userId, bookId)) return null;
  const title = input.title.trim();
  const description = input.description?.trim() ?? "";
  if (!title || title.length > 120 || description.length > 300 || !input.instructions.trim() || input.instructions.length > 12_000) throw new Error("作品 Skill 内容超出有效范围（标题 1–120、说明不超过 300、方法正文 1–12000 字符）。");
  const count = (database.prepare("SELECT COUNT(*) AS count FROM writing_book_skills WHERE user_id = ? AND book_id = ?").get(userId, bookId) as { count: number }).count;
  if (count >= 40) throw new Error("每部作品最多保存 40 个 Skill。");
  const id = randomUUID();
  database.prepare("INSERT INTO writing_book_skills (id, user_id, book_id, title, description, instructions, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, userId, bookId, title, description, input.instructions, input.enabled === false ? 0 : 1);
  return getWritingBookSkill(userId, bookId, id);
}

export function updateWritingBookSkill(userId: string, bookId: string, skillId: string, input: { title: string; description?: string; instructions: string; enabled: boolean }): WritingBookSkill | null {
  const title = input.title.trim();
  const description = input.description?.trim() ?? "";
  if (!title || title.length > 120 || description.length > 300 || !input.instructions.trim() || input.instructions.length > 12_000) throw new Error("作品 Skill 内容超出有效范围（标题 1–120、说明不超过 300、方法正文 1–12000 字符）。");
  database.prepare(`
    UPDATE writing_book_skills SET title = ?, description = ?, instructions = ?, enabled = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE user_id = ? AND book_id = ? AND id = ?
  `).run(title, description, input.instructions, input.enabled ? 1 : 0, userId, bookId, skillId);
  return getWritingBookSkill(userId, bookId, skillId);
}

export function deleteWritingBookSkill(userId: string, bookId: string, skillId: string): boolean {
  return database.prepare("DELETE FROM writing_book_skills WHERE user_id = ? AND book_id = ? AND id = ?").run(userId, bookId, skillId).changes > 0;
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

export function listWritingChapterRevisionsForAi(userId: string, chapterId: string): Array<{ id: string; title: string; createdAt: string }> | null {
  if (!chapterRow(userId, chapterId)) return null;
  const rows = database.prepare("SELECT id, title, created_at FROM writing_chapter_revisions WHERE chapter_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50").all(chapterId) as unknown as Array<{ id: string; title: string; created_at: string }>;
  return rows.map((row) => ({ id: row.id, title: row.title, createdAt: row.created_at }));
}

export function getWritingChapterRevisionForAi(userId: string, chapterId: string, revisionId: string): WritingChapterRevisionExcerpt | null {
  const row = database.prepare(`
    SELECT r.id, r.title, r.created_at, substr(r.content, 1, ?) AS content, length(r.content) AS character_count
    FROM writing_chapter_revisions r
    JOIN writing_chapters c ON c.id = r.chapter_id
    JOIN writing_books b ON b.id = c.book_id
    WHERE b.user_id = ? AND r.chapter_id = ? AND r.id = ?
  `).get(WRITING_ANALYSIS_BATCH_CHARACTER_LIMIT + 1, userId, chapterId, revisionId) as { id: string; title: string; created_at: string; content: string; character_count: number } | undefined;
  if (!row) return null;
  const contentTruncated = row.character_count > WRITING_ANALYSIS_BATCH_CHARACTER_LIMIT;
  return { id: row.id, title: row.title, createdAt: row.created_at, content: row.content.slice(0, WRITING_ANALYSIS_BATCH_CHARACTER_LIMIT), characterCount: row.character_count, contentTruncated };
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
  aiRoleId: WritingSpecialistId;
  outline: string;
  outlineTruncated: boolean;
  chapterId: string | null;
  chapterTitle: string | null;
  content: string;
  chapterTruncated: boolean;
} | null {
  const state = database.prepare("SELECT active_book_id, active_chapter_id FROM writing_workspace_state WHERE user_id = ?").get(userId) as WorkspaceStateRow | undefined;
  if (!state?.active_book_id) return null;
  const book = database.prepare("SELECT id, title, outline_content, ai_role_id FROM writing_books WHERE user_id = ? AND id = ?").get(userId, state.active_book_id) as { id: string; title: string; outline_content: string; ai_role_id: WritingSpecialistId } | undefined;
  if (!book) return null;
  const chapter = state.active_chapter_id
    ? database.prepare("SELECT id, title, content FROM writing_chapters WHERE id = ? AND book_id = ?").get(state.active_chapter_id, book.id) as { id: string; title: string; content: string } | undefined
    : undefined;
  const limit = 12_000;
  return {
    bookId: book.id,
    bookTitle: book.title,
    aiRoleId: book.ai_role_id,
    outline: book.outline_content.slice(0, limit),
    outlineTruncated: book.outline_content.length > limit,
    chapterId: chapter?.id ?? null,
    chapterTitle: chapter?.title ?? null,
    content: chapter?.content.slice(0, limit) ?? "",
    chapterTruncated: (chapter?.content.length ?? 0) > limit
  };
}

/** 导出当前账户的一部作品为 DeepWrite 原生长篇目录 ZIP，不包含提案、修订与会话数据。 */
export function exportWritingBookDeepWriteZip(userId: string, bookId: string): { data: Buffer; filename: string } | null {
  const book = database.prepare("SELECT id, title, outline_content, ai_role_id, created_at, updated_at FROM writing_books WHERE user_id = ? AND id = ?").get(userId, bookId) as (BookRow & { outline_content: string }) | undefined;
  if (!book) return null;
  const volumes = database.prepare("SELECT id, title, sort_order FROM writing_volumes WHERE book_id = ? ORDER BY sort_order ASC, created_at ASC").all(bookId) as unknown as VolumeRow[];
  const chapters = database.prepare("SELECT id, volume_id, title, content, sort_order, updated_at FROM writing_chapters WHERE book_id = ? ORDER BY sort_order ASC, created_at ASC").all(bookId) as Array<{ id: string; volume_id: string; title: string; content: string; sort_order: number; updated_at: string }>;
  const catalog = database.prepare("SELECT id, kind, title, content, created_at, updated_at FROM writing_catalog_entries WHERE book_id = ? ORDER BY kind ASC, created_at ASC, id ASC").all(bookId) as Array<{ id: string; kind: WritingCatalogKind; title: string; content: string; created_at: string; updated_at: string }>;
  const skills = database.prepare("SELECT title, description, instructions, enabled FROM writing_book_skills WHERE user_id = ? AND book_id = ? ORDER BY created_at ASC, id ASC LIMIT 40").all(userId, bookId) as Array<{ title: string; description: string; instructions: string; enabled: number }>;
  if (book.title.length > 256 || book.outline_content.length > 200_000) throw new Error("DeepWrite 长篇格式要求作品标题不超过 256、全书故事线不超过 200,000 字符。");
  if (chapters.length > 4_900 || volumes.length > 4_900 || catalog.length > 4_900) throw new Error("当前作品内容数量超过单个 DeepWrite ZIP 的文件数量限制。");

  const now = book.updated_at;
  const opaque = (): string => randomUUID().replaceAll("-", "");
  const bookExternalId = `longbook_${opaque()}`;
  const volumeRows = volumes.length ? volumes : [{ id: "default-volume", title: "第一卷", sort_order: 0 }];
  if (volumeRows.some((volume) => !volume.title.trim() || volume.title.length > 256)) throw new Error("卷标题无法映射到 DeepWrite 格式。");
  if (chapters.some((chapter) => !chapter.title.trim() || chapter.title.length > 256 || !volumeRows.some((volume) => volume.id === chapter.volume_id))) throw new Error("章节标题或卷归属无法映射到 DeepWrite 格式。");
  const volumeIds = new Map(volumeRows.map((volume) => [volume.id, `volume_${opaque()}`]));
  const arcIds = new Map(volumeRows.map((volume) => [volume.id, `arc_${opaque()}`]));
  const chapterIds = new Map(chapters.map((chapter) => [chapter.id, `chapter_${opaque()}`]));
  const fileRef = (id: string, path: string, updatedAt = now) => ({ id, path, updatedAt });
  const entries: Array<{ path: string; data: string }> = [];
  const addText = (path: string, content: string): void => { entries.push({ path, data: content }); };
  const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
  const chapterFiles = chapters.map((chapter) => {
    const id = chapterIds.get(chapter.id)!;
    const base = `long/chapters/${id}`;
    const bodyPath = `${base}/body.md`, cardPath = `${base}/card.md`, statePath = `${base}/character-state.md`, handoffPath = `${base}/handoff.md`;
    const continuityPath = `long/continuity/chapters/${id}/foreshadowing-changes.md`;
    addText(bodyPath, chapter.content); addText(cardPath, ""); addText(statePath, ""); addText(handoffPath, ""); addText(continuityPath, "");
    return {
      chapterCardId: id,
      body: fileRef(`file_${id}:body`, bodyPath, chapter.updated_at),
      card: fileRef(`file_${id}:card`, cardPath, chapter.updated_at),
      characterState: fileRef(`file_${id}:character-state`, statePath, chapter.updated_at),
      handoff: fileRef(`file_${id}:handoff`, handoffPath, chapter.updated_at),
      foreshadowingChanges: fileRef(`file_${id}:continuity:foreshadowing-changes`, continuityPath, chapter.updated_at),
      worldReveals: null,
      characterContinuity: [],
      bodyStatus: chapter.content.length ? "written" : "empty",
      commitId: null
    };
  });
  const bookLinePath = "long/plot/book-line.md";
  addText(bookLinePath, book.outline_content);
  const chapterOrderByVolume = new Map<string, number>();
  const chapterCards = chapters.map((chapter) => {
    const order = (chapterOrderByVolume.get(chapter.volume_id) ?? 0) + 1;
    chapterOrderByVolume.set(chapter.volume_id, order);
    return { id: chapterIds.get(chapter.id)!, volumeId: volumeIds.get(chapter.volume_id)!, primaryArcId: arcIds.get(chapter.volume_id)!, title: chapter.title, narrativeOrder: order };
  });
  const timestamp = now;
  const index = {
    schemaVersion: 1,
    bookId: bookExternalId,
    updatedAt: timestamp,
    bookLine: fileRef("file_long-book-line", bookLinePath),
    featureSettings: { worldbuildingItemLayout: "right-list", characterAndContinuityItemLayout: "right-list", plotItemLayout: "right-list" },
    worldbuilding: [],
    characterTypes: [
      { id: "protagonist", title: "主角", order: 1 },
      { id: "major_supporting", title: "主要配角", order: 2 },
      { id: "minor_supporting", title: "次要配角", order: 3 },
      { id: "passerby", title: "路人", order: 4 }
    ],
    characters: [],
    characterFiles: [],
    plot: {
      volumes: volumeRows.map((volume, order) => ({ id: volumeIds.get(volume.id)!, title: volume.title, order: order + 1, summary: "" })),
      arcs: volumeRows.map((volume) => ({ id: arcIds.get(volume.id)!, volumeId: volumeIds.get(volume.id)!, title: `${volume.title}·主线`, order: 1, summary: "", outline: "" })),
      chapterCards,
      storyEvents: [], storyPlots: [], eventConnections: [], narrativePlacements: [], foreshadowing: []
    },
    chapters: chapterFiles,
    ledger: { committedThroughChapterId: null, commits: [], projection: { throughCommitId: null, facts: [], knowledge: [], openLoops: [], latestHandoff: null } }
  };
  const manifest = {
    schemaVersion: 1,
    kind: "deepwrite.long-book",
    id: bookExternalId,
    title: book.title,
    bookType: "long",
    genre: "其他",
    status: "editing",
    linkedMaterialIdsByKind: { character: [], gimmick: [], plot: [], draft: [], other: [] },
    linkedSkillIdsByKind: { general: [], plot: [], style: [], other: [] },
    createdAt: book.created_at,
    updatedAt: timestamp,
    workspaceIndexFile: fileRef("file_long-workspace-index", "long/index.json")
  };
  addText("deepwrite.json", json(manifest));
  addText("long/index.json", json(index));

  const catalogIndex = catalog.map((entry, order) => {
    const externalId = `catalog_${opaque()}`;
    const path = `lfaa/catalog/${String(order + 1).padStart(4, "0")}.md`;
    addText(path, entry.content);
    return { id: externalId, kind: entry.kind, title: entry.title, path };
  });
  addText("lfaa/metadata.json", json({ schemaVersion: 1, aiRoleId: getWritingSpecialist(book.ai_role_id) ? book.ai_role_id : "writing-companion", skills: skills.map((skill) => ({ ...skill, enabled: skill.enabled === 1 })) }));
  addText("lfaa/catalog/index.json", json({ schemaVersion: 1, entries: catalogIndex }));
  if (entries.length > DEEPWRITE_ZIP_MAX_ENTRIES) throw new Error("作品卷、章节、资料数量超过 5,000 个 ZIP 文件限制。");
  const expandedBytes = entries.reduce((total, entry) => total + Buffer.byteLength(entry.data, "utf8"), 0);
  if (expandedBytes > DEEPWRITE_ZIP_MAX_UNCOMPRESSED_BYTES) throw new Error("作品 ZIP 解压后会超过 64 MiB。");
  const data = createDeepWriteZip(entries);
  if (data.byteLength > DEEPWRITE_ZIP_MAX_COMPRESSED_BYTES) throw new Error("作品 ZIP 压缩后会超过 32 MiB。");
  return { data, filename: "deepwrite-book.zip" };
}

/** 安全解析并一次性导入为当前账户的新作品；ZIP/清单校验全部在事务开始前完成。 */
export function importWritingBookDeepWriteZip(userId: string, archive: Uint8Array): WritingWorkspace {
  let project: ReturnType<typeof parseDeepWriteProject>;
  try {
    if (archive.byteLength > DEEPWRITE_ZIP_MAX_COMPRESSED_BYTES) throw new Error("ZIP 文件超过 32 MiB 限制。");
    project = parseDeepWriteProject(readDeepWriteZip(archive), WRITING_CATALOG_KINDS);
    if (project.volumes.length > 4_900 || project.chapters.length > 4_900 || project.materials.length + project.catalog.length > 4_900 || project.skills.length > 40) throw new Error("DeepWrite 项目内容数量超过 LFAA 导入限制。");
    if (project.outline.length > 1_500_000) throw new Error("全书故事线超过 LFAA 1,500,000 字符限制。");
    for (const volume of project.volumes) if (!volume.title.trim() || volume.title.length > 80) throw new Error("卷标题超过 LFAA 80 字符限制。");
    for (const chapter of project.chapters) if (!chapter.title.trim() || chapter.title.length > 120 || chapter.content.length > DEEPWRITE_ZIP_MAX_ENTRY_BYTES) throw new Error("章节标题或正文超过 LFAA 导入范围。");
    for (const entry of [...project.materials, ...project.catalog]) if (!entry.title.trim() || entry.title.length > 120 || entry.content.length > 1_500_000) throw new Error("作品资料超过 LFAA 标题或正文长度限制。");
    if (!project.volumes.length) project.volumes.push({ externalId: "deepwrite-volume-default", title: "第一卷", order: 0 });
    if (!project.chapters.length) project.chapters.push({ externalId: "deepwrite-chapter-default", volumeExternalId: project.volumes[0]!.externalId, title: "第1章", order: 0, content: "" });
  } catch (error) {
    throw new DeepWriteImportError(error instanceof Error ? error.message : "DeepWrite ZIP 项目无效。");
  }

  const now = new Date().toISOString();
  const bookId = randomUUID();
  const volumeIds = new Map(project.volumes.map((volume) => [volume.externalId, randomUUID()]));
  const chapterIds = new Map(project.chapters.map((chapter) => [chapter.externalId, randomUUID()]));
  const orderedChapters = [...project.chapters].sort((left, right) => left.order - right.order || left.externalId.localeCompare(right.externalId));
  if (orderedChapters.some((chapter) => !volumeIds.has(chapter.volumeExternalId))) throw new Error("导入章节引用不存在的卷，未写入账户数据。");
  const materials = [...project.materials, ...project.catalog];
  const totalEntries = project.volumes.length + orderedChapters.length + materials.length + project.skills.length + 1;
  if (totalEntries > DEEPWRITE_ZIP_MAX_ENTRIES) throw new Error("导入作品记录数量超过单包事务限制。");

  database.exec("BEGIN IMMEDIATE;");
  try {
    database.prepare("INSERT INTO writing_books (id, user_id, title, outline_content, ai_role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(bookId, userId, project.title, project.outline, project.aiRoleId, now, now);
    const insertVolume = database.prepare("INSERT INTO writing_volumes (id, book_id, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
    project.volumes.sort((left, right) => left.order - right.order || left.externalId.localeCompare(right.externalId)).forEach((volume, order) => insertVolume.run(volumeIds.get(volume.externalId)!, bookId, volume.title, order, now, now));
    const insertChapter = database.prepare("INSERT INTO writing_chapters (id, book_id, volume_id, title, content, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    orderedChapters.forEach((chapter, order) => insertChapter.run(chapterIds.get(chapter.externalId)!, bookId, volumeIds.get(chapter.volumeExternalId)!, chapter.title, chapter.content, order, now, now));
    const insertCatalog = database.prepare("INSERT INTO writing_catalog_entries (id, book_id, kind, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const entry of materials) insertCatalog.run(randomUUID(), bookId, entry.kind, entry.title, entry.content, now, now);
    const insertSkill = database.prepare("INSERT INTO writing_book_skills (id, user_id, book_id, title, description, instructions, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const skill of project.skills) insertSkill.run(randomUUID(), userId, bookId, skill.title, skill.description, skill.instructions, skill.enabled ? 1 : 0, now, now);
    setWorkspaceState(userId, bookId, chapterIds.get(orderedChapters[0]!.externalId)!);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
  return getWritingWorkspace(userId);
}

export class DeepWriteImportError extends Error {
  constructor(message: string) { super(message); this.name = "DeepWriteImportError"; }
}

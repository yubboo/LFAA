/**
 * 功能：持久化账户隔离的 Markdown 知识、Skill、Prompt、专家资料与本地项目链接。
 * 作用：提供有界的清单、搜索、读取、保存和删除；模型正文读取由单独工具按需触发。
 * 关联文件：packages/boot/knowledge-library、packages/api/knowledge-controller、packages/storage/storage-sqlite/src/database.ts。
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { resolveUserDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import { atomicWrite, atomicWriteBytes, decode } from "lfaa-storage-json/src/index.js";
import { withControlLock } from "lfaa-storage-domain/src/control-lock.js";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import { getWorkspaceProject, type WorkspaceProjectApplicationId } from "lfaa-workspace-workspace/src/index.js";

export const KNOWLEDGE_LIBRARY_LIMITS = Object.freeze({
  itemsPerUser: 128,
  projectSourcesPerUser: 8,
  markdownBytes: 64 * 1024,
  searchQueryCharacters: 200,
  searchResults: 4,
  snippetCharacters: 600,
  readCharacters: 12_000
});

export const KNOWLEDGE_LIBRARY_KINDS = ["knowledge", "skill", "prompt", "expert"] as const;
export type KnowledgeLibraryKind = typeof KNOWLEDGE_LIBRARY_KINDS[number];
export type KnowledgeLibraryScope = ApplicationId | "all";
export type KnowledgeLibrarySourceKind = "upload" | "conversation" | "manual";
const FILE_BACKED_MARKER = " ";

export interface KnowledgeLibraryItemSummary {
  id: string;
  applicationId: KnowledgeLibraryScope;
  kind: KnowledgeLibraryKind;
  title: string;
  description: string;
  contentSha256: string;
  sourceKind: KnowledgeLibrarySourceKind;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeLibraryItem extends KnowledgeLibraryItemSummary {
  contentMarkdown: string;
}

export interface KnowledgeLibraryProjectSource {
  id: string;
  applicationId: KnowledgeLibraryScope;
  projectId: string;
  projectApplicationId: WorkspaceProjectApplicationId;
  relativePath: string;
  title: string;
  createdAt: string;
}

export interface KnowledgeLibrarySearchHit extends KnowledgeLibraryItemSummary {
  snippet: string;
  trust: "untrusted";
}

interface ItemRow {
  id: string; user_id: string; application_id: KnowledgeLibraryScope; kind: KnowledgeLibraryKind;
  title: string; description: string; content_markdown: string; content_sha256: string;
  source_kind: KnowledgeLibrarySourceKind; created_at: string; updated_at: string;
}

interface SourceRow {
  id: string; user_id: string; application_id: KnowledgeLibraryScope; project_id: string;
  project_application_id: WorkspaceProjectApplicationId; relative_path: string; title: string; created_at: string;
}

function mapItem(row: ItemRow, contentMarkdown = row.content_markdown): KnowledgeLibraryItem {
  return {
    id: row.id, applicationId: row.application_id, kind: row.kind, title: row.title,
    description: row.description, contentSha256: row.content_sha256, sourceKind: row.source_kind,
    createdAt: row.created_at, updatedAt: row.updated_at, contentMarkdown
  };
}

function mapSummary(row: ItemRow): KnowledgeLibraryItemSummary {
  const { contentMarkdown: _content, ...summary } = mapItem(row);
  return summary;
}

function itemFilePaths(row: Pick<ItemRow, "id" | "user_id" | "application_id">): { markdown: string; metadata: string } {
  const scope = validateScope(row.application_id);
  const directory = resolve(resolveUserDataPaths(config.dataDirectory, row.user_id).knowledge, scope);
  const name = createHash("sha256").update(row.id, "utf8").digest("hex");
  return { markdown: resolve(directory, `${name}.md`), metadata: resolve(directory, `${name}.meta.json`) };
}

function readSafeFile(path: string): Buffer | null {
  if (!existsSync(path)) return null;
  const file = lstatSync(path);
  if (!file.isFile() || file.isSymbolicLink()) throw new Error("资料库文件类型无效；拒绝跟随链接读取。");
  return readFileSync(path);
}

function readKnowledgeMetadata(path: string): { contentSha256: string; updatedAt: string } | null {
  const data = readSafeFile(path);
  if (!data) return null;
  const saved = decode(data.toString("utf8")) as Record<string, unknown> | null;
  if (!saved || saved.version !== 1 || typeof saved.contentSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(saved.contentSha256)
    || typeof saved.updatedAt !== "string" || !Number.isFinite(Date.parse(saved.updatedAt))) throw new Error("资料库正文元数据损坏；原文件已保留。");
  return { contentSha256: saved.contentSha256, updatedAt: saved.updatedAt };
}

/** SQL 正文是尚未迁完或尚未发布的写入来源；单空格占位表示文件已通过校验并接管。 */
function readKnowledgeRow(row: ItemRow): ItemRow | null {
  const paths = itemFilePaths(row);
  const existingBytes = readSafeFile(paths.markdown);
  const existingText = existingBytes?.toString("utf8");
  const existingHash = existingText === undefined ? null : createHash("sha256").update(existingText, "utf8").digest("hex");
  if (row.content_markdown !== FILE_BACKED_MARKER) {
    const databaseHash = createHash("sha256").update(row.content_markdown, "utf8").digest("hex");
    if (databaseHash !== row.content_sha256) throw new Error("SQLite 资料正文摘要不匹配；来源已保留。");
    if (existingHash !== null && existingHash !== databaseHash) {
      const metadata = readKnowledgeMetadata(paths.metadata);
      if (!metadata || metadata.contentSha256 !== existingHash || Date.parse(metadata.updatedAt) >= Date.parse(row.updated_at)) {
        throw new Error("资料文件与待迁移 SQLite 正文冲突；两份来源均保留。");
      }
    }
    if (existingHash !== databaseHash) atomicWriteBytes(paths.markdown, Buffer.from(row.content_markdown, "utf8"));
    const verifiedBytes = readSafeFile(paths.markdown);
    const verifiedText = verifiedBytes?.toString("utf8");
    if (verifiedText !== row.content_markdown || createHash("sha256").update(verifiedText, "utf8").digest("hex") !== databaseHash) {
      throw new Error("资料正文文件回读校验失败；SQLite 来源仍保留。");
    }
    atomicWrite(paths.metadata, { version: 1, contentSha256: databaseHash, updatedAt: row.updated_at });
    withControlLock(database, () => {
      const result = database.prepare("UPDATE knowledge_library_items SET content_markdown = ' ' WHERE user_id = ? AND id = ? AND content_sha256 = ? AND content_markdown = ?")
        .run(row.user_id, row.id, row.content_sha256, row.content_markdown);
      if (Number(result.changes) === 0) {
        const current = database.prepare("SELECT content_markdown, content_sha256 FROM knowledge_library_items WHERE user_id = ? AND id = ?").get(row.user_id, row.id) as { content_markdown?: string; content_sha256?: string } | undefined;
        if (current?.content_markdown !== FILE_BACKED_MARKER || current.content_sha256 !== row.content_sha256) throw new Error("资料正文迁移期间记录发生变化；请重试。");
      }
    });
    return row;
  }
  if (existingText === undefined || existingHash !== row.content_sha256) return null;
  return { ...row, content_markdown: existingText };
}

function mapSource(row: SourceRow): KnowledgeLibraryProjectSource {
  return { id: row.id, applicationId: row.application_id, projectId: row.project_id, projectApplicationId: row.project_application_id, relativePath: row.relative_path, title: row.title, createdAt: row.created_at };
}

function validateScope(value: unknown): KnowledgeLibraryScope {
  if (value === "all" || typeof value === "string" && APPLICATION_IDS.includes(value as ApplicationId)) return value as KnowledgeLibraryScope;
  throw new Error("资料可用范围必须是 all 或有效的 App ID。");
}

function validateKind(value: unknown): KnowledgeLibraryKind {
  if (typeof value === "string" && KNOWLEDGE_LIBRARY_KINDS.includes(value as KnowledgeLibraryKind)) return value as KnowledgeLibraryKind;
  throw new Error("资料类型必须是 knowledge、skill、prompt 或 expert。");
}

function validateText(value: unknown, label: string, max: number, allowEmpty = false): string {
  if (typeof value !== "string") throw new Error(`${label}必须是文本。`);
  const normalized = value.trim();
  if ((!allowEmpty && !normalized) || normalized.length > max || normalized.includes("\0")) throw new Error(`${label}不能为空、不能含 NUL 且长度不能超过 ${max} 个字符。`);
  return normalized;
}

function validateMarkdown(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.includes("\0") || Buffer.byteLength(value, "utf8") > KNOWLEDGE_LIBRARY_LIMITS.markdownBytes) {
    throw new Error("Markdown 正文必须是非空 UTF-8 文本且不能超过 64 KiB。 ");
  }
  return value.replace(/\r\n?/gu, "\n");
}

export function normalizeKnowledgeProjectPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 512 || value.includes("\0")) throw new Error("本地资料目录无效。");
  const normalized = value.trim().replaceAll("\\", "/").replace(/^\.\//u, "").replace(/\/$/u, "");
  if (normalized.startsWith("/") || /^[A-Za-z]:/u.test(normalized)
    || normalized.split("/").some(part => part === ".." || part === "." || [".git", "node_modules", "dist"].includes(part.toLocaleLowerCase("en-US")) || /[<>:"|?*]/u.test(part))) {
    throw new Error("本地资料目录必须是项目根内的相对目录，不能包含根路径、盘符或路径穿越。");
  }
  return normalized;
}

function itemCount(userId: string): number {
  return (database.prepare("SELECT COUNT(*) AS count FROM knowledge_library_items WHERE user_id = ?").get(userId) as { count: number }).count
    + (database.prepare("SELECT COUNT(*) AS count FROM knowledge_library_project_sources WHERE user_id = ?").get(userId) as { count: number }).count;
}

export function getKnowledgeLibraryUsage(userId: string): { resources: number; limit: number } {
  return { resources: itemCount(userId), limit: KNOWLEDGE_LIBRARY_LIMITS.itemsPerUser };
}

export function listKnowledgeLibraryItems(userId: string, applicationId?: ApplicationId): KnowledgeLibraryItemSummary[] {
  const rows = database.prepare(`
    SELECT id, user_id, application_id, kind, title, description, content_markdown, content_sha256, source_kind, created_at, updated_at
    FROM knowledge_library_items
    WHERE user_id = ? AND (? IS NULL OR application_id = 'all' OR application_id = ?)
    ORDER BY updated_at DESC, id LIMIT ?
  `).all(userId, applicationId ?? null, applicationId ?? null, KNOWLEDGE_LIBRARY_LIMITS.itemsPerUser + 1) as unknown as ItemRow[];
  return rows.slice(0, KNOWLEDGE_LIBRARY_LIMITS.itemsPerUser).map(row => mapSummary(readKnowledgeRow(row) ?? row));
}

export function listKnowledgeLibraryProjectSources(userId: string, applicationId?: ApplicationId): KnowledgeLibraryProjectSource[] {
  const rows = database.prepare(`
    SELECT id, user_id, application_id, project_id, project_application_id, relative_path, title, created_at
    FROM knowledge_library_project_sources
    WHERE user_id = ? AND (? IS NULL OR application_id = ?)
    ORDER BY created_at DESC, id LIMIT ?
  `).all(userId, applicationId ?? null, applicationId ?? null, KNOWLEDGE_LIBRARY_LIMITS.projectSourcesPerUser + 1) as unknown as SourceRow[];
  return rows.slice(0, KNOWLEDGE_LIBRARY_LIMITS.projectSourcesPerUser).map(mapSource);
}

export function getKnowledgeLibraryItem(userId: string, id: string, applicationId: ApplicationId): KnowledgeLibraryItem | null {
  const row = database.prepare(`
    SELECT id, user_id, application_id, kind, title, description, content_markdown, content_sha256, source_kind, created_at, updated_at
    FROM knowledge_library_items WHERE user_id = ? AND id = ? AND (application_id = 'all' OR application_id = ?)
  `).get(userId, id, applicationId) as ItemRow | undefined;
  if (!row) return null;
  const readable = readKnowledgeRow(row);
  return readable ? mapItem(readable, readable.content_markdown) : null;
}

export function getKnowledgeLibraryProjectSource(userId: string, id: string, applicationId: ApplicationId): KnowledgeLibraryProjectSource | null {
  const row = database.prepare(`
    SELECT id, user_id, application_id, project_id, project_application_id, relative_path, title, created_at
    FROM knowledge_library_project_sources WHERE user_id = ? AND id = ? AND application_id = ?
  `).get(userId, id, applicationId) as SourceRow | undefined;
  if (!row) return null;
  const project = getWorkspaceProject(userId, row.project_id, row.project_application_id);
  if (!project || project.appId !== null && project.appId !== row.project_application_id) return null;
  return mapSource(row);
}

export function createKnowledgeLibraryItem(userId: string, input: { applicationId: KnowledgeLibraryScope; kind: KnowledgeLibraryKind; title: string; description?: string; contentMarkdown: string; sourceKind: KnowledgeLibrarySourceKind }): KnowledgeLibraryItem {
  const applicationId = validateScope(input.applicationId);
  const kind = validateKind(input.kind);
  const title = validateText(input.title, "标题", 120);
  const description = validateText(input.description ?? "", "说明", 500, true);
  const contentMarkdown = validateMarkdown(input.contentMarkdown);
  if (!["upload", "conversation", "manual"].includes(input.sourceKind)) throw new Error("资料来源类型无效。");
  if (itemCount(userId) >= KNOWLEDGE_LIBRARY_LIMITS.itemsPerUser) throw new Error("当前账户的 Markdown 资料已达到 128 条上限。");
  const id = randomUUID();
  const contentSha256 = createHash("sha256").update(contentMarkdown, "utf8").digest("hex");
  database.prepare(`
    INSERT INTO knowledge_library_items (id, user_id, application_id, kind, title, description, content_markdown, content_sha256, source_kind)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, applicationId, kind, title, description, contentMarkdown, contentSha256, input.sourceKind);
  const row = database.prepare(`
    SELECT id, user_id, application_id, kind, title, description, content_markdown, content_sha256, source_kind, created_at, updated_at
    FROM knowledge_library_items WHERE id = ? AND user_id = ?
  `).get(id, userId) as ItemRow | undefined;
  if (!row) throw new Error("资料库 Owner 未确认文档保存结果。");
  const readable = readKnowledgeRow(row);
  if (!readable) throw new Error("资料库 Owner 未确认正文文件保存结果。");
  return mapItem(readable, contentMarkdown);
}

export function updateKnowledgeLibraryItem(userId: string, id: string, applicationId: ApplicationId, input: { title: string; description: string; contentMarkdown: string; expectedContentSha256: string }): KnowledgeLibraryItem | null {
  const current = getKnowledgeLibraryItem(userId, id, applicationId);
  if (!current) return null;
  if (current.contentSha256 !== input.expectedContentSha256) throw new Error("资料已被其他操作更新，请重新加载后再保存。");
  const title = validateText(input.title, "标题", 120);
  const description = validateText(input.description, "说明", 500, true);
  const contentMarkdown = validateMarkdown(input.contentMarkdown);
  const contentSha256 = createHash("sha256").update(contentMarkdown, "utf8").digest("hex");
  const nextUpdatedAt = new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString();
  const result = database.prepare(`
    UPDATE knowledge_library_items SET title = ?, description = ?, content_markdown = ?, content_sha256 = ?, updated_at = ?
    WHERE user_id = ? AND id = ? AND content_sha256 = ?
  `).run(title, description, contentMarkdown, contentSha256, nextUpdatedAt, userId, id, input.expectedContentSha256);
  if (result.changes === 0) throw new Error("资料已被其他操作更新，请重新加载后再保存。");
  return getKnowledgeLibraryItem(userId, id, applicationId);
}

export function deleteKnowledgeLibraryItem(userId: string, id: string): boolean {
  const row = database.prepare("SELECT id, user_id, application_id FROM knowledge_library_items WHERE user_id = ? AND id = ?").get(userId, id) as Pick<ItemRow, "id" | "user_id" | "application_id"> | undefined;
  if (!row) return false;
  const paths = itemFilePaths(row);
  const removed = database.prepare("DELETE FROM knowledge_library_items WHERE user_id = ? AND id = ?").run(userId, id).changes > 0;
  if (removed) for (const path of [paths.markdown, paths.metadata]) {
    if (!existsSync(path)) continue;
    const file = lstatSync(path);
    if (!file.isFile() || file.isSymbolicLink()) throw new Error("资料库文件类型无效；拒绝删除链接目标。");
    unlinkSync(path);
  }
  return removed;
}

export function createKnowledgeLibraryProjectSource(userId: string, input: { applicationId: KnowledgeLibraryScope; projectId: string; projectApplicationId: WorkspaceProjectApplicationId; relativePath: string; title: string }): KnowledgeLibraryProjectSource {
  const applicationId = validateScope(input.applicationId);
  if (applicationId !== input.projectApplicationId) throw new Error("本地项目来源必须限定在项目所属 App，不能跨 App 共享执行入口。");
  const relativePath = normalizeKnowledgeProjectPath(input.relativePath);
  const title = validateText(input.title, "来源名称", 120);
  const project = getWorkspaceProject(userId, input.projectId, input.projectApplicationId);
  if (!project || project.appId !== null && project.appId !== input.projectApplicationId) throw new Error("本地资料目录必须属于当前账户的 Workspace/Minecraft 项目。");
  if (itemCount(userId) >= KNOWLEDGE_LIBRARY_LIMITS.itemsPerUser) throw new Error("当前账户的 Markdown 资料已达到 128 条上限。");
  const id = randomUUID();
  database.prepare(`
    INSERT INTO knowledge_library_project_sources (id, user_id, application_id, project_id, project_application_id, relative_path, title)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, applicationId, input.projectId, input.projectApplicationId, relativePath, title);
  const row = database.prepare(`
    SELECT id, user_id, application_id, project_id, project_application_id, relative_path, title, created_at
    FROM knowledge_library_project_sources WHERE id = ? AND user_id = ?
  `).get(id, userId) as SourceRow | undefined;
  if (!row) throw new Error("资料库 Owner 未确认本地来源保存结果。");
  return mapSource(row);
}

export function deleteKnowledgeLibraryProjectSource(userId: string, id: string): boolean {
  return database.prepare("DELETE FROM knowledge_library_project_sources WHERE user_id = ? AND id = ?").run(userId, id).changes > 0;
}

export function searchKnowledgeLibrary(userId: string, applicationId: ApplicationId, query: string, kind?: KnowledgeLibraryKind): KnowledgeLibrarySearchHit[] {
  const normalizedQuery = validateText(query, "检索问题", KNOWLEDGE_LIBRARY_LIMITS.searchQueryCharacters);
  const rows = database.prepare(`
    SELECT id, user_id, application_id, kind, title, description, content_markdown, content_sha256, source_kind, created_at, updated_at
    FROM knowledge_library_items
    WHERE user_id = ? AND (application_id = 'all' OR application_id = ?) AND (? IS NULL OR kind = ?)
    ORDER BY updated_at DESC, id LIMIT ?
  `).all(userId, applicationId, kind ?? null, kind ?? null, KNOWLEDGE_LIBRARY_LIMITS.itemsPerUser) as unknown as ItemRow[];
  const queryTerms = queryTokens(normalizedQuery);
  return rows.map(row => readKnowledgeRow(row)).filter((row): row is ItemRow => row !== null).map(row => {
    const title = row.title.toLocaleLowerCase("en-US");
    const description = row.description.toLocaleLowerCase("en-US");
    const content = row.content_markdown.toLocaleLowerCase("en-US");
    const phrase = normalizedQuery.toLocaleLowerCase("en-US");
    let score = title.includes(phrase) ? 12 : 0;
    if (description.includes(phrase)) score += 5;
    if (content.includes(phrase)) score += 3;
    for (const term of queryTerms) {
      if (title.includes(term)) score += 5;
      if (description.includes(term)) score += 2;
      if (content.includes(term)) score += Math.min(4, Math.max(1, countOccurrences(content, term)));
    }
    return { row, score, snippet: makeSnippet(row.content_markdown, queryTerms, normalizedQuery) };
  }).filter(item => item.score > 0 && createHash("sha256").update(item.row.content_markdown, "utf8").digest("hex") === item.row.content_sha256)
    .sort((left, right) => right.score - left.score || right.row.updated_at.localeCompare(left.row.updated_at) || left.row.id.localeCompare(right.row.id))
    .slice(0, KNOWLEDGE_LIBRARY_LIMITS.searchResults)
    .map(({ row, snippet }) => ({ ...mapSummary(row), snippet, trust: "untrusted" as const }));
}

function queryTokens(query: string): string[] {
  const segments = query.toLocaleLowerCase("en-US").match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,}|[\p{L}\p{N}_+-]{2,}/gu) ?? [];
  const result = new Set<string>();
  for (const segment of segments) {
    if (/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+$/u.test(segment) && segment.length > 2) {
      for (let index = 0; index < segment.length - 1; index += 1) result.add(segment.slice(index, index + 2));
    } else result.add(segment);
    if (result.size >= 32) break;
  }
  return [...result].slice(0, 32);
}

function countOccurrences(value: string, term: string): number {
  let count = 0, offset = 0;
  while (count < 4) {
    const index = value.indexOf(term, offset);
    if (index < 0) break;
    count += 1;
    offset = index + term.length;
  }
  return count;
}

function makeSnippet(content: string, terms: string[], phrase: string): string {
  const lowered = content.toLocaleLowerCase("en-US");
  const candidates = [phrase.toLocaleLowerCase("en-US"), ...terms];
  let position = -1;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const found = lowered.indexOf(candidate);
    if (found >= 0 && (position < 0 || found < position)) position = found;
  }
  const max = KNOWLEDGE_LIBRARY_LIMITS.snippetCharacters;
  if (content.length <= max) return content;
  const start = Math.max(0, (position < 0 ? 0 : position) - Math.floor(max / 3));
  const end = Math.min(content.length, start + max);
  return `${start > 0 ? "…" : ""}${content.slice(start, end)}${end < content.length ? "…" : ""}`;
}

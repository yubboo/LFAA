/** 功能：提供写作空间的认证 API 类型与请求适配；作品、章节和提案数据仍由 Writing Owner 持有。 */
import { request, requestBinary } from "./http-client.js";

export interface WritingBook {
  id: string;
  title: string;
    aiRoleId: WritingSpecialistId;
  createdAt: string;
  updatedAt: string;
}

  export type WritingSpecialistId = "writing-companion" | "outline-planner" | "chapter-writer" | "precision-editor" | "continuity-reviewer" | "character-consultant";

  export interface WritingSpecialistOption { id: WritingSpecialistId; name: string; description: string }
  export interface WritingBookSkillSummary { id: string; title: string; description: string; enabled: boolean; updatedAt: string }
  export interface WritingBookSkill extends WritingBookSkillSummary { bookId: string; instructions: string; createdAt: string }

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

export type WritingEditOperation = "append" | "prepend" | "insert_before" | "insert_after" | "replace_anchor" | "replace";

export interface WritingEditProposal {
  id: string;
  bookId: string;
  targetType: "outline" | "chapter";
  targetId: string;
  bookTitle: string;
  targetTitle: string;
  operation: WritingEditOperation;
  status: "pending" | "applied" | "rejected" | "stale" | "superseded" | "expired";
  createdAt: string;
  expiresAt: string;
  baseContent: string | null;
  proposedContent: string | null;
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
    writingRoleOptions: WritingSpecialistOption[];
    bookSkills: WritingBookSkillSummary[];
}

export function loadWritingWorkspace(): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>("/writing/workspace");
}

export function downloadWritingBookDeepWriteZip(bookId: string): Promise<Blob> {
  return requestBinary(`/writing/books/${encodeURIComponent(bookId)}/deepwrite.zip`);
}

export function importWritingBookDeepWriteZip(file: File): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>("/writing/import/deepwrite.zip", {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: file
  });
}

export function createWritingBook(title: string): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>("/writing/books", { method: "POST", body: JSON.stringify({ title }) });
}

export function createWritingVolume(bookId: string, title: string): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>(`/writing/books/${encodeURIComponent(bookId)}/volumes`, { method: "POST", body: JSON.stringify({ title }) });
}

export function renameWritingBook(bookId: string, title: string): Promise<{ book: WritingBook }> {
  return request<{ book: WritingBook }>(`/writing/books/${encodeURIComponent(bookId)}`, { method: "PATCH", body: JSON.stringify({ title }) });
}

export function saveWritingBookRole(bookId: string, roleId: WritingSpecialistId): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>(`/writing/books/${encodeURIComponent(bookId)}/ai-profile`, { method: "PATCH", body: JSON.stringify({ roleId }) });
}

export function listWritingBookSkills(bookId: string): Promise<{ skills: WritingBookSkillSummary[] }> {
  return request<{ skills: WritingBookSkillSummary[] }>(`/writing/books/${encodeURIComponent(bookId)}/skills`);
}

export function loadWritingBookSkill(bookId: string, skillId: string): Promise<{ skill: WritingBookSkill }> {
  return request<{ skill: WritingBookSkill }>(`/writing/books/${encodeURIComponent(bookId)}/skills/${encodeURIComponent(skillId)}`);
}

export function saveWritingBookSkill(bookId: string, input: { id?: string; title: string; description: string; instructions: string; enabled: boolean }): Promise<{ skill: WritingBookSkill; workspace: WritingWorkspace }> {
  const method = input.id ? "PATCH" : "POST";
  const path = input.id ? `/writing/books/${encodeURIComponent(bookId)}/skills/${encodeURIComponent(input.id)}` : `/writing/books/${encodeURIComponent(bookId)}/skills`;
  return request<{ skill: WritingBookSkill; workspace: WritingWorkspace }>(path, { method, body: JSON.stringify({ title: input.title, description: input.description, instructions: input.instructions, enabled: input.enabled }) });
}

export function deleteWritingBookSkill(bookId: string, skillId: string): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>(`/writing/books/${encodeURIComponent(bookId)}/skills/${encodeURIComponent(skillId)}`, { method: "DELETE" });
}

export function saveWritingBookOutline(bookId: string, content: string): Promise<{ outline: { bookId: string; content: string; updatedAt: string; wordCount: number } }> {
  return request<{ outline: { bookId: string; content: string; updatedAt: string; wordCount: number } }>(`/writing/books/${encodeURIComponent(bookId)}/outline`, { method: "PATCH", body: JSON.stringify({ content }) });
}

export function loadWritingBookOutlineRevisions(bookId: string): Promise<{ revisions: WritingBookOutlineRevision[] }> {
  return request<{ revisions: WritingBookOutlineRevision[] }>(`/writing/books/${encodeURIComponent(bookId)}/outline/revisions`);
}

export function restoreWritingBookOutlineRevision(bookId: string, revisionId: string): Promise<{ outline: { bookId: string; content: string; updatedAt: string; wordCount: number } }> {
  return request<{ outline: { bookId: string; content: string; updatedAt: string; wordCount: number } }>(`/writing/books/${encodeURIComponent(bookId)}/outline/revisions/${encodeURIComponent(revisionId)}/restore`, { method: "POST", body: JSON.stringify({}) });
}

export function deleteWritingBook(bookId: string): Promise<void> {
  return request<void>(`/writing/books/${encodeURIComponent(bookId)}`, { method: "DELETE" });
}

export function createWritingChapter(bookId: string, title: string, volumeId?: string): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>(`/writing/books/${encodeURIComponent(bookId)}/chapters`, { method: "POST", body: JSON.stringify({ title, ...(volumeId ? { volumeId } : {}) }) });
}

export function saveWritingChapter(chapterId: string, title: string, content: string): Promise<{ chapter: WritingChapter }> {
  return request<{ chapter: WritingChapter }>(`/writing/chapters/${encodeURIComponent(chapterId)}`, { method: "PATCH", body: JSON.stringify({ title, content }) });
}

export function deleteWritingChapter(chapterId: string): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>(`/writing/chapters/${encodeURIComponent(chapterId)}`, { method: "DELETE" });
}

export function selectWritingLocation(bookId: string | null, chapterId: string | null): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>("/writing/workspace/selection", { method: "PATCH", body: JSON.stringify({ bookId, chapterId }) });
}

export function loadWritingChapterRevisions(chapterId: string): Promise<{ revisions: WritingChapterRevision[] }> {
  return request<{ revisions: WritingChapterRevision[] }>(`/writing/chapters/${encodeURIComponent(chapterId)}/revisions`);
}

export function restoreWritingChapterRevision(chapterId: string, revisionId: string): Promise<{ chapter: WritingChapter }> {
  return request<{ chapter: WritingChapter }>(`/writing/chapters/${encodeURIComponent(chapterId)}/revisions/${encodeURIComponent(revisionId)}/restore`, { method: "POST", body: JSON.stringify({}) });
}

export function createWritingCatalogEntry(bookId: string, kind: WritingCatalogKind, title: string): Promise<{ entry: WritingCatalogEntry }> {
  return request<{ entry: WritingCatalogEntry }>(`/writing/books/${encodeURIComponent(bookId)}/catalog`, { method: "POST", body: JSON.stringify({ kind, title }) });
}

export function listWritingCatalogEntries(bookId: string, kind: WritingCatalogKind, offset = 0, search = ""): Promise<{ page: WritingCatalogPage }> {
  const query = new URLSearchParams({ kind, offset: String(offset) });
  if (search) query.set("search", search);
  return request<{ page: WritingCatalogPage }>(`/writing/books/${encodeURIComponent(bookId)}/catalog?${query.toString()}`);
}

export function loadWritingCatalogEntry(entryId: string): Promise<{ entry: WritingCatalogEntry }> {
  return request<{ entry: WritingCatalogEntry }>(`/writing/catalog/${encodeURIComponent(entryId)}`);
}

export function saveWritingCatalogEntry(entryId: string, title: string, content: string): Promise<{ entry: WritingCatalogEntry }> {
  return request<{ entry: WritingCatalogEntry }>(`/writing/catalog/${encodeURIComponent(entryId)}`, { method: "PATCH", body: JSON.stringify({ title, content }) });
}

export function deleteWritingCatalogEntry(entryId: string): Promise<void> {
  return request<void>(`/writing/catalog/${encodeURIComponent(entryId)}`, { method: "DELETE" });
}

export function loadWritingEditProposal(proposalId: string): Promise<{ proposal: WritingEditProposal }> {
  return request<{ proposal: WritingEditProposal }>(`/writing/proposals/${encodeURIComponent(proposalId)}`);
}

export function applyWritingEditProposal(proposalId: string): Promise<{ proposal: { id: string; status: WritingEditProposal["status"] } }> {
  return request<{ proposal: { id: string; status: WritingEditProposal["status"] } }>(`/writing/proposals/${encodeURIComponent(proposalId)}/apply`, { method: "POST", body: JSON.stringify({}) });
}

export function rejectWritingEditProposal(proposalId: string): Promise<{ proposal: { id: string; status: WritingEditProposal["status"] } }> {
  return request<{ proposal: { id: string; status: WritingEditProposal["status"] } }>(`/writing/proposals/${encodeURIComponent(proposalId)}/reject`, { method: "POST", body: JSON.stringify({}) });
}


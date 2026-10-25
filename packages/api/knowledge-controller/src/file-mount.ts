/** 功能：将当前账户 Markdown 资料挂入统一目录。作用：所有读写仍通过资料库 Owner，保留账户/App 隔离和摘要冲突校验。关联文件：index.ts、knowledge-library、fs/library.ts。 */
import { Buffer } from "node:buffer";
import type { FileMount } from "lfaa-fs/src/library.js";
import { assertSafeTextPreview } from "lfaa-fs/src/managed-files.mjs";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { createKnowledgeLibraryItem, getKnowledgeLibraryItem, listKnowledgeLibraryItems, updateKnowledgeLibraryItem } from "lfaa-knowledge-library/src/index.js";
export const knowledgeFileMount: FileMount = {
  id: "knowledge", name: "我的资料库", locationDescription: "Owner 管理的账户资料库 · Markdown 位于 data\\users\\<账户 SHA-256>\\knowledge\\<scope>，索引由资料库 Owner 管理", async operate(actor, operation, input) {
    const path = String(input.path);
    const items = listKnowledgeLibraryItems(actor.userId);
    if (!path && ["list", "search"].includes(operation)) {
      const query = String(input.query ?? "").toLocaleLowerCase();
      return { path: "", operations: ["list", "search", "create-file"], entries: items.filter(item => !query || item.title.toLocaleLowerCase().includes(query)).map(item => ({ name: `${item.title}.md`, path: `${item.id}.md`, kind: "file", fileType: "md", size: item.size, modifiedAt: item.updatedAt, operations: ["preview", "read", "write", "rename", "download"] })), truncated: false };
    }
    if (operation === "create-file" && path && !path.includes("/")) {
      if (!path.endsWith(".md")) throw new ApiError(400, "knowledge_markdown_only", "资料库只支持创建 Markdown 文档。");
      if (items.some(item => `${item.title}.md` === path)) throw new ApiError(409, "file_name_conflict", "已有同名资料。");
      const item = createKnowledgeLibraryItem(actor.userId, { applicationId: "all", kind: "knowledge", title: path.slice(0, -3), contentMarkdown: `# ${path.slice(0, -3)}`, sourceKind: "manual" });
      return { path: `${item.id}.md`, sha256: item.contentSha256 };
    }
    const summary = items.find(item => `${item.id}.md` === path);
    const item = summary ? getKnowledgeLibraryItem(actor.userId, summary.id, summary.applicationId === "all" ? "workspace" : summary.applicationId) : null;
    if (!item) throw new ApiError(404, "knowledge_file_missing", "找不到当前账户的资料文件。");
    assertSafeTextPreview(`${item.title}.md`, item.contentMarkdown);
    if (["preview", "read"].includes(operation)) return { path, content: item.contentMarkdown, sha256: item.contentSha256, previewKind: "text", size: Buffer.byteLength(item.contentMarkdown) };
    if (operation === "download") return { path, name: `${item.title}.md`, size: Buffer.byteLength(item.contentMarkdown), dataBase64: Buffer.from(item.contentMarkdown).toString("base64") };
    if (operation === "write" || operation === "rename") {
      const title = operation === "rename" ? String(input.name ?? "").replace(/\.md$/u, "") : item.title;
      if (items.some(other => other.id !== item.id && other.title === title)) throw new ApiError(409, "file_name_conflict", "已有同名资料。");
      const updated = updateKnowledgeLibraryItem(actor.userId, item.id, item.applicationId === "all" ? "workspace" : item.applicationId, { title, description: item.description, contentMarkdown: operation === "write" ? String(input.content) : item.contentMarkdown, expectedContentSha256: operation === "write" ? String(input.expectedSha256) : item.contentSha256 });
      if (!updated) throw new ApiError(404, "knowledge_file_missing", "资料文件已不存在。");
      return { path, sha256: updated.contentSha256, size: Buffer.byteLength(updated.contentMarkdown) };
    }
    throw new ApiError(400, "knowledge_file_operation_unavailable", "资料库文档支持预览、编辑、重命名和下载；删除请使用资料库的业务入口。");
  }
};

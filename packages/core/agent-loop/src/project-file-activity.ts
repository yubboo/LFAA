/**
 * 功能：把成功的项目文件变更结果整理为可展示的 AI Work 活动元数据。
 * 作用：只保留操作类型、Daemon 返回的安全项目相对路径和当前登记项目标识。
 * 关联文件：execute-turn.ts、core/session/src/sessions.ts；不保存文件正文或原始工具结果。
 */
import type { AiActivityFileChange } from "lfaa-session/src/sessions.js";

const mutationToolIds = new Set(["project.files", "fs.write", "fs.str-replace", "fs.delete-file"]);
const maxFileChanges = 128;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function safeRelativePath(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 1024 || value.startsWith("/") || /[\u0000-\u001f\u007f]/u.test(value)) return null;
  const segments = value.split("/");
  if (segments.some(segment => !segment || segment === "." || segment === ".." || segment.includes("\\"))) return null;
  return value;
}

/** 只接受成功 mutation 的 Daemon 相对路径，避免把工具参数或文件内容写入活动记录。 */
export function buildAiProjectFileChanges(
  toolId: string,
  parameters: Record<string, unknown> | null,
  toolResult: unknown,
  projectId: string | null
): AiActivityFileChange[] {
  if (!mutationToolIds.has(toolId) || !parameters) return [];
  const envelope = record(toolResult);
  const result = record(envelope?.result) ?? envelope;
  if (!result) return [];

  const operation = parameters.operation;
  const registeredProjectId = typeof projectId === "string" && projectId.length > 0 && projectId.length <= 128 ? projectId : null;
  const makeChange = (kind: AiActivityFileChange["operation"], pathValue: unknown): AiActivityFileChange | null => {
    const path = safeRelativePath(pathValue);
    return path ? { operation: kind, path, projectId: registeredProjectId } : null;
  };

  if (["read", "read_lines", "read_image"].includes(String(operation)) && result.relativePath && result.path) {
    const hasReadContent = typeof result.content === "string" || Array.isArray(result.content);
    if (hasReadContent) {
      const change = makeChange("read", result.relativePath);
      return change ? [change] : [];
    }
  }
  if (operation === "create" && result.created === true) {
    const change = makeChange("created", result.relativePath);
    return change ? [change] : [];
  }
  if (operation === "create_tree" && result.created === true && Array.isArray(result.files)) {
    return result.files.slice(0, maxFileChanges).flatMap(file => {
      const change = makeChange("created", record(file)?.relativePath);
      return change ? [change] : [];
    });
  }
  if ((operation === "write" || operation === "replace") && result.changed === true) {
    const change = makeChange("modified", result.relativePath);
    return change ? [change] : [];
  }
  if (operation === "delete" && result.deleted === true) {
    const change = makeChange("deleted", result.relativePath);
    return change ? [change] : [];
  }
  return [];
}

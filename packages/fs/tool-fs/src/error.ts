/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-tool-fs/src/error.ts。
 * 功能：模型可见的结构化文件工具错误分类与归一化。
 * 作用：把本机后端（lfaa-fs-local）抛出的错误统一成带稳定 code 的 FsToolError，供模型按 code 分支（重读/缩小范围/换工具）。
 * 关联文件：read-target.ts、write.ts、edit.ts、index.ts。
 */
import { FsLocalError } from "lfaa-fs-local/src/paths.js";

/** 稳定、可机读的文件工具错误码（与 DSH FsErrorCode 对齐）。 */
export type FsToolErrorCode =
  | "FS_NOT_FOUND"
  | "FS_NOT_DIRECTORY"
  | "FS_NOT_REGULAR_FILE"
  | "FS_NOT_TEXT"
  | "FS_TOO_LARGE"
  | "FS_SANDBOX_DENIED"
  | "FS_EDIT_NOT_FOUND"
  | "FS_AMBIGUOUS_EDIT"
  | "FS_INVALID_ARGUMENT";

/** 结构化文件工具错误：携带稳定 code，模型与 UI 据此决定重试/审批/提示。 */
export class FsToolError extends Error {
  readonly code: FsToolErrorCode;
  constructor(message: string, code: FsToolErrorCode) {
    super(message);
    this.name = "FsToolError";
    this.code = code;
  }
}

/**
 * 把任意抛出值归一化为模型可见错误。
 * 本机后端 FsLocalError 已有 code，保留并加方括号前缀；其余原样透传。
 */
export function toToolError(error: unknown): Error {
  if (error instanceof FsToolError) return error;
  if (error instanceof FsLocalError) {
    // 越界/找不到等：保留稳定 code 供模型分支，消息用中文说明。
    return new FsToolError(error.message, error.code as FsToolErrorCode);
  }
  return error instanceof Error ? error : new Error(String(error));
}

/** 写/编辑失败的“补救提示”：未读先改、版本过期等场景附加“先读再重试”。 */
export function remediateMutationError(error: unknown, display: string): Error {
  const normalized = toToolError(error);
  if (normalized instanceof FsToolError && normalized.code === "FS_SANDBOX_DENIED") {
    return new FsToolError(`${normalized.message}（${display}）。若确需写此处，请向用户申请更宽的工作目录后再试。`, "FS_SANDBOX_DENIED");
  }
  return normalized;
}
